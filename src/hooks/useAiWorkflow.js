"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CANCEL_BACK = {
  extracting: "source",
  "missing-info": "source",
  settings: "missing-info",
  generating: "settings",
  review: "settings",
  validating: "review",
  importing: "validating",
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultModel(provider) {
  return provider?.models?.find((model) => model.default)?.id || provider?.models?.[0]?.id || "";
}

export function isAbortError(error, signal) {
  return Boolean(signal?.aborted || error?.name === "AbortError" || error?.code === "ABORT_ERR");
}

export function structuredContextErrorMessage(context) {
  void context;
  return "Could not parse the content extracted from the source. Try again or use a clearer source.";
}

function isStructuredContextFailure(error) {
  return error?.code === "AI_ASSERTION_FAILED" && (
    String(error.message || "").includes("StructuredContext")
    || String(error.message || "").includes("Field ")
  );
}

export function toError(error, context) {
  if (isAbortError(error)) return Object.assign(new Error("Operation cancelled"), { name: "AbortError", code: "ABORT_ERR" });
  const result = error instanceof Error ? error : new Error(error?.message || "AI workflow failed");
  result.code = error?.code || result.code;
  result.extra = error?.extra || result.extra;
  if (isStructuredContextFailure(result)) {
    result.extra = { ...(result.extra || {}), internalMessage: result.message };
    result.message = structuredContextErrorMessage(context);
  }
  const attribution = result.extra;
  if (attribution?.actualProvider || attribution?.requestedProvider) {
    const requested = [attribution.requestedProvider, attribution.requestedModel].filter(Boolean).join("/") || "Unspecified";
    const actual = [attribution.actualProvider, attribution.actualModel].filter(Boolean).join("/") || "Unspecified";
    result.message = `${result.message}\nRequested provider: ${requested}\nActual provider: ${actual}${attribution.fallback ? "\nAlternative providers were tried." : ""}`;
  }
  return result;
}

function parseSseBuffer(buffer, onEvent) {
  const frames = buffer.split("\n\n");
  const remainder = frames.pop() || "";
  for (const frame of frames) {
    let event = "message";
    const data = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (!data.length) continue;
    try { onEvent(event, JSON.parse(data.join("\n"))); } catch { onEvent(event, { raw: data.join("\n") }); }
  }
  return remainder;
}

function sameValue(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

export function clearWorkflowRunState(setters) {
  setters.setContext(null);
  setters.setContextArtifact(null);
  setters.setMissingFields([]);
  setters.setMissingInfoAnswers({});
  setters.setGenerationParams({});
  setters.setDraftQuestions([]);
  setters.setDraftArtifact(null);
  setters.setCanonicalJson(null);
  setters.setCanonicalArtifact(null);
  setters.setPreflightResult(null);
  setters.setImportReport(null);
  setters.setStageProgress([]);
  setters.setDebugMetadata(null);
  setters.setError(null);
  setters.setRequestId(null);
  setters.setUploadProgress(0);
  setters.setRegeneratingIndex(null);
  setters.setCancelled(false);
  setters.setStale({ draft: false, canonical: false });
}

export function useAiWorkflow() {
  const [step, setStep] = useState("source");
  const [providers, setProviders] = useState([]);
  const [resourceExtractors, setResourceExtractors] = useState({});
  const [provider, setProviderState] = useState("");
  const [model, setModelState] = useState("");
  const [health, setHealth] = useState({});
  const [context, setContext] = useState(null);
  const [contextArtifact, setContextArtifact] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [missingInfoAnswers, setMissingInfoAnswers] = useState({});
  const [generationParams, setGenerationParams] = useState({});
  const [draftQuestions, setDraftQuestions] = useState([]);
  const [draftArtifact, setDraftArtifact] = useState(null);
  const [canonicalJson, setCanonicalJson] = useState(null);
  const [canonicalArtifact, setCanonicalArtifact] = useState(null);
  const [preflightResult, setPreflightResult] = useState(null);
  const [importReport, setImportReport] = useState(null);
  const [stageProgress, setStageProgress] = useState([]);
  const [debugMetadata, setDebugMetadata] = useState(null);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [regeneratingIndex, setRegeneratingIndex] = useState(null);
  const [cancelled, setCancelled] = useState(false);
  const [stale, setStale] = useState({ draft: false, canonical: false });

const abortRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const xhrRef = useRef(null);
  const lastCallRef = useRef(null);
  const bootstrappedRef = useRef(false);

  const loadProviders = useCallback(async () => {
    const response = await fetch("/api/ai/providers", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load AI providers");
    const data = await response.json();
    setProviders(data.providers || []);
    setResourceExtractors(data.resourceExtractors || {});
    if (!bootstrappedRef.current && data.providers?.length) {
      bootstrappedRef.current = true;
      const available = data.providers.find((item) => item.configured && item.status === "healthy") || data.providers[0];
      setProviderState(available.id);
      setModelState(defaultModel(available));
    }
    return data.providers || [];
  }, []);

  const loadHealth = useCallback(async () => {
    const response = await fetch("/api/ai/health", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setHealth(Object.fromEntries((data.providers || []).map((item) => [item.id, item])));
  }, []);

useEffect(() => {
    let mounted = true;
    Promise.all([loadProviders(), loadHealth()]).catch((err) => { if (mounted) setError(toError(err)); });
    const timer = setInterval(() => { loadHealth().catch(() => {}); }, 10_000);
    return () => {
      mounted = false;
      clearInterval(timer);
      abortRef.current?.abort();
      uploadAbortRef.current?.abort();
      xhrRef.current?.abort();
    };
  }, [loadHealth, loadProviders]);

  const selectedProvider = useMemo(() => providers.find((item) => item.id === provider) || null, [providers, provider]);
  const selectedModel = useMemo(() => selectedProvider?.models?.find((item) => item.id === model) || null, [selectedProvider, model]);
  const capabilities = selectedModel?.capabilities || {};

  const setProvider = useCallback((id) => {
    const next = providers.find((item) => item.id === id);
    setProviderState(id);
    setModelState(defaultModel(next));
  }, [providers]);
  const setModel = useCallback((id) => setModelState(id), []);

  const runWorkflow = useCallback(async (type, payload = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const nextRequestId = makeId();
    setRequestId(nextRequestId);
    setError(null);
    setCancelled(false);
    setStageProgress([]);

    let reader = null;
    let finalResult = null;
    let failedResult = null;

    const onEvent = (event, data) => {
      if (event === "stage.started") setStageProgress((current) => [...current.filter((item) => item.stage !== data.stage), { ...data, status: "running" }]);
      else if (event === "stage.finished") setStageProgress((current) => [...current.filter((item) => item.stage !== data.stage), { ...data, status: "done" }]);
      else if (event === "artifact") setStageProgress((current) => [...current, { ...data, status: "artifact" }]);
      else if (event === "task.completed") {
        finalResult = data.result || data;
         setDebugMetadata({ provider: data.provider, model: data.model, promptVersion: data.promptVersion, schema: finalResult?.artifact ? `${finalResult.artifact.type} ${finalResult.artifact.version}` : null, cacheHit: data.cacheHit, cost: data.cost, retries: data.retries, latencyMs: data.totalDurationMs, requestId: data.requestId, warnings: finalResult?.warnings || data.warnings || [] });
      } else if (event === "task.failed") failedResult = data.error || data.result?.errors?.[0] || data;
    };

    try {
      const response = await fetch("/api/ai/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ ...payload, type, requestId: nextRequestId, provider, model, prefer: provider || undefined }),
      });
      if (!response.ok || !response.body) {
        const message = await response.text().catch(() => "AI workflow failed");
        const failure = new Error(message || "AI workflow failed");
        failure.code = `HTTP_${response.status}`;
        throw failure;
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseBuffer(buffer, onEvent);
      }
      buffer += decoder.decode();
      parseSseBuffer(`${buffer}\n\n`, onEvent);
    } catch (err) {
      if (isAbortError(err, controller.signal)) {
        setCancelled(true);
        setError(null);
        return { cancelled: true, requestId: nextRequestId };
      }
      const normalized = toError(err, context);
      setError(normalized);
      if (normalized.extra) setDebugMetadata((current) => ({ ...(current || {}), errorAttribution: normalized.extra }));
      throw normalized;
    } finally {
      try { await reader?.cancel(); } catch { /* already closed */ }
      try { reader?.releaseLock(); } catch { /* already released */ }
      if (abortRef.current === controller) abortRef.current = null;
    }

    if (failedResult) {
      const failure = toError(failedResult, context);
      setError(failure);
      if (failure.extra) setDebugMetadata((current) => ({ ...(current || {}), errorAttribution: failure.extra }));
      throw failure;
    }
    if (!finalResult) {
      const failure = new Error("The AI connection ended without a result");
      failure.code = "AI_EMPTY_RESULT";
      setError(failure);
      throw failure;
    }
    if (finalResult.status === "failed") {
      const failure = toError({ code: finalResult.errors?.[0]?.code || "AI_WORKFLOW_FAILED", message: finalResult.errors?.[0]?.message || "AI workflow failed" }, context);
      setError(failure);
      throw failure;
    }
    return finalResult;
  }, [context, model, provider]);

  const runAndApply = useCallback((type, payload, apply) => {
    const replay = async () => {
      const result = await runWorkflow(type, payload);
      if (!result?.cancelled) await apply(result);
      return result;
    };
    lastCallRef.current = { replay };
    return replay();
  }, [runWorkflow]);

  const uploadFile = useCallback(async (file, signal) => {
    const response = await fetch("/api/repository/import/presigned", { method: "POST", headers: { "Content-Type": "application/json" }, signal, body: JSON.stringify({ filename: file.name, filesize: file.size, filetype: file.type }) });
    if (!response.ok) throw new Error("Could not prepare the file upload");
    const upload = await response.json();
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      const abortUpload = () => xhr.abort();
      signal?.addEventListener("abort", abortUpload, { once: true });
      xhr.open("PUT", upload.presignedUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100)); };
      xhr.onload = () => { signal?.removeEventListener("abort", abortUpload); xhrRef.current = null; xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("File upload failed")); };
      xhr.onerror = () => { xhrRef.current = null; reject(new Error("File upload connection failed")); };
      xhr.onabort = () => { xhrRef.current = null; reject(Object.assign(new Error("File upload cancelled"), { name: "AbortError" })); };
      xhr.send(file);
    });
    return { fileKey: upload.key, filename: file.name, filetype: file.type, filesize: file.size };
  }, []);

  const extract = useCallback(async (input) => {
    setStep("extracting");
    clearWorkflowRunState({
      setContext, setContextArtifact, setMissingFields, setMissingInfoAnswers,
      setGenerationParams, setDraftQuestions, setDraftArtifact, setCanonicalJson,
      setCanonicalArtifact, setPreflightResult, setImportReport, setStageProgress,
      setDebugMetadata, setError, setRequestId, setUploadProgress, setRegeneratingIndex,
      setCancelled, setStale,
    });
    const uploadController = new AbortController();
    uploadAbortRef.current = uploadController;
    const hints = Object.fromEntries(["subject", "grade", "lessonTitle", "language"]
      .map((field) => [field, typeof input?.[field] === "string" ? input[field].trim() : ""])
      .filter(([, value]) => value));
    let resolvedInput;
    try { resolvedInput = input?.file ? await uploadFile(input.file, uploadController.signal) : input; }
    finally { if (uploadAbortRef.current === uploadController) uploadAbortRef.current = null; }
    const result = await runAndApply("knowledge-extraction", { input: resolvedInput, ...(Object.keys(hints).length ? { hints } : {}) }, async (value) => {
      const nextContext = value.context || value.artifact?.data?.context || null;
      setContext(nextContext);
      setContextArtifact(value.artifact || null);
      setMissingInfoAnswers({});
      setStale({ draft: false, canonical: false });
      setStep("missing-info");
    });
    return result;
  }, [runAndApply, uploadFile]);

  const collect = useCallback(async (nextContext, answers = {}) => {
    setStep("missing-info");
    setMissingInfoAnswers((current) => ({ ...current, ...answers }));
    const contextInput = nextContext || context;
    return runAndApply("missing-info-collection", { context: contextInput, answers: { ...missingInfoAnswers, ...answers }, parentArtifactId: contextArtifact?.id || null }, async (result) => {
      if (result.status === "complete") {
        setContext(result.context || result.artifact?.data?.context || contextInput);
        setGenerationParams(result.generationParams || generationParams);
        setStale({ draft: draftQuestions.length > 0, canonical: Boolean(canonicalArtifact) });
        setStep("settings");
      } else {
        setMissingFields(result.missingFields || result.artifact?.data?.missingFields || []);
      }
    });
  }, [canonicalArtifact, context, contextArtifact, draftQuestions.length, generationParams, missingInfoAnswers, runAndApply]);

  const generate = useCallback(async (params) => {
    const changed = !sameValue(params, generationParams);
    if (changed && draftQuestions.length) setStale({ draft: true, canonical: true });
    setGenerationParams(params);
    setStep("generating");
    return runAndApply("question-generation", { context, generationParams: params, parentArtifactId: contextArtifact?.id || null }, async (result) => {
      const questions = result.questions || result.artifact?.data?.questions || [];
      setDraftQuestions(questions);
      setDraftArtifact(result.artifact || null);
      setStale({ draft: false, canonical: false });
      setStep("review");
    });
  }, [context, contextArtifact, draftQuestions.length, generationParams, runAndApply]);

  const updateDraftArtifact = useCallback((questions) => {
    setDraftQuestions(questions);
    setDraftArtifact((current) => current ? { ...current, data: { ...current.data, questions } } : current);
    setStale((current) => ({ ...current, draft: true, canonical: true }));
  }, []);
  const updateQuestion = useCallback((index, patch) => updateDraftArtifact(draftQuestions.map((question, position) => position === index ? { ...question, ...patch } : question)), [draftQuestions, updateDraftArtifact]);
  const deleteQuestion = useCallback((index) => updateDraftArtifact(draftQuestions.filter((_, position) => position !== index)), [draftQuestions, updateDraftArtifact]);
  const duplicateQuestion = useCallback((index) => {
    const copy = { ...draftQuestions[index], _gen: draftQuestions[index]?._gen ? { ...draftQuestions[index]._gen } : undefined };
    delete copy.id;
    delete copy._id;
    updateDraftArtifact([...draftQuestions.slice(0, index + 1), copy, ...draftQuestions.slice(index + 1)]);
  }, [draftQuestions, updateDraftArtifact]);
  const reorderQuestions = useCallback((from, to) => { const next = [...draftQuestions]; const [item] = next.splice(from, 1); next.splice(to, 0, item); updateDraftArtifact(next); }, [draftQuestions, updateDraftArtifact]);

  const regenerateQuestion = useCallback(async (index) => {
    setRegeneratingIndex(index);
    try {
      return await runAndApply("question-generation", { context, generationParams: { ...generationParams, questionCount: 1, focusIndex: index, focusTopic: draftQuestions[index]?._gen?.sourceTopicRef }, parentArtifactId: draftArtifact?.id || null }, async (result) => {
        const replacement = result.questions?.[0] || result.artifact?.data?.questions?.[0];
        if (replacement) setDraftQuestions((current) => current.map((question, position) => position === index ? replacement : question));
      });
    } finally {
      setRegeneratingIndex(null);
      setStep("review");
    }
  }, [context, draftArtifact, draftQuestions, generationParams, runAndApply]);

  const validate = useCallback(async () => {
    setStep("validating");
    return runAndApply("canonical-json-build", { context, generationParams, draftArtifact }, async (result) => {
      setCanonicalJson(result.canonicalJson || result.artifact?.data || null);
      setCanonicalArtifact(result.artifact || null);
      setPreflightResult(result.preflight || null);
      if (result.preflight?.ok === true) setStale((current) => ({ ...current, canonical: false }));
      setStep("validating");
    });
  }, [context, draftArtifact, generationParams, runAndApply]);

  const importRepository = useCallback(async () => {
    if (stale.draft || stale.canonical) return null;
    setStep("importing");
    return runAndApply("repository-import", { canonicalArtifact }, async (result) => { setImportReport(result.importResult || result); setStep("done"); });
  }, [canonicalArtifact, runAndApply, stale.canonical, stale.draft]);

const goBack = useCallback(() => {
    const allowed = { "missing-info": "source", settings: "missing-info", review: "settings", validating: "review", importing: "validating" };
    const target = allowed[step];
    if (target) setStep(target);
  }, [step]);

  const retryStage = useCallback(() => {
    const replay = lastCallRef.current?.replay;
    if (!replay) return Promise.resolve(null);
    return replay().catch((err) => {
      if (!isAbortError(err)) {
        const failure = toError(err, context);
        setError(failure);
        if (failure.extra) setDebugMetadata((current) => ({ ...(current || {}), errorAttribution: failure.extra }));
      }
      return null;
    });
  }, [context]);

  const cancel = useCallback(() => {
    if (!abortRef.current?.signal.aborted) abortRef.current?.abort();
    if (!uploadAbortRef.current?.signal.aborted) uploadAbortRef.current?.abort();
    xhrRef.current?.abort();
    abortRef.current = null;
    uploadAbortRef.current = null;
    setCancelled(true);
    setError(null);
    setStep((current) => CANCEL_BACK[current] || current);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setStep("source");
    clearWorkflowRunState({
      setContext, setContextArtifact, setMissingFields, setMissingInfoAnswers,
      setGenerationParams, setDraftQuestions, setDraftArtifact, setCanonicalJson,
      setCanonicalArtifact, setPreflightResult, setImportReport, setStageProgress,
      setDebugMetadata, setError, setRequestId, setUploadProgress, setRegeneratingIndex,
      setCancelled, setStale,
    });
  }, [cancel]);

  return { step, error, cancelled, stageProgress, uploadProgress, capabilities, resourceExtractors, stale, context, missingFields, missingInfoAnswers, generationParams, draftQuestions, canonicalJson, preflightResult, importReport, provider, model, providers, health, debugMetadata, regeneratingIndex, requestId, selectedModel, setProvider, setModel, goBack, runWorkflow, extract, collect, generate, validate, importRepository, regenerateQuestion, retryStage, cancel, reset, updateQuestion, deleteQuestion, duplicateQuestion, reorderQuestions };
}
