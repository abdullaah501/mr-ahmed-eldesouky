"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import {
  importRepositoryQuestions,
  cancelImportUpload,
} from "@/app/actions/repositoryActions";
import { DEFAULT_MAX_FILE_SIZE } from "../../../../lib/import/shared/file";
import Link from "next/link";
import { LuCheck } from "react-icons/lu";

const ERROR_MESSAGES = {
  NO_PLUGIN: "Unsupported file format",
  PARSE_FAILED: "Failed to parse file",
  VALIDATION_FAILED: "Question validation failed",
  IMAGE_EXTRACTION_FAILED: "Failed to extract images",
  PERSIST_FAILED: "Failed to save questions",
  NO_QUESTIONS: "File contains no questions",
  ALREADY_RUNNING: "An import is already running",
  UNEXPECTED: "Unexpected error",
  CLIENT_ERROR: "Connection error",
  QUESTION_TYPE_UNKNOWN: "Could not determine question type",
  LOW_DETECTION_CONFIDENCE: "Low detection confidence",
  UNKNOWN_MARKER: "Unknown marker",
  PDF_IMPORT_NOT_SUPPORTED:
    "PDF import has been removed. Please use DOCX or JSON",
  FILE_TOO_LARGE: "File size is too large",
  EMPTY_FILE: "File is empty",
  NOT_IMPLEMENTED: "Import is not available for this format",
  TOO_MANY_QUESTIONS: "Too many questions",
  NOTHING_TO_PERSIST: "No valid questions to save",
};

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function mapErrorCode(code) {
  return ERROR_MESSAGES[code] || code || "Unknown error";
}

function uploadWithRetry(file, url, contentType, onProgress) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000;

  return new Promise((resolve, reject) => {
    function attempt(retries) {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.timeout = 120000;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && typeof onProgress === "function") {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else if (retries > 0 && xhr.status >= 500) {
          setTimeout(
            () => attempt(retries - 1),
            BASE_DELAY * Math.pow(2, MAX_RETRIES - retries),
          );
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };

      xhr.onerror = () => {
        if (retries > 0) {
          setTimeout(
            () => attempt(retries - 1),
            BASE_DELAY * Math.pow(2, MAX_RETRIES - retries),
          );
        } else {
          reject(new Error("Network error during upload"));
        }
      };

      xhr.ontimeout = () => {
        if (retries > 0) {
          setTimeout(
            () => attempt(retries - 1),
            BASE_DELAY * Math.pow(2, MAX_RETRIES - retries),
          );
        } else {
          reject(new Error("Upload timed out"));
        }
      };

      xhr.send(file);
    }

    attempt(MAX_RETRIES - 1);
  });
}

export default function ImportRepositoryModal({ onClose, onSuccess }) {
  const closeButtonRef = useRef(null);
  const fileInputRef = useRef(null);

  const [workflow, setWorkflow] = useState("idle");
  const [plugins, setPlugins] = useState([]);
  const [pluginsLoaded, setPluginsLoaded] = useState(false);

  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [presignedKey, setPresignedKey] = useState(null);
  const presignedKeyRef = useRef(null);
  const [presignedMeta, setPresignedMeta] = useState(null);

  const [dryRunResult, setDryRunResult] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const maxFileSizeMB = Math.round(DEFAULT_MAX_FILE_SIZE / 1024 / 1024);

  useEffect(() => {
    fetch("/api/repository/import/plugins")
      .then((r) => r.json())
      .then((data) => {
        setPlugins(Array.isArray(data) ? data : []);
        setPluginsLoaded(true);
      })
      .catch(() => setPluginsLoaded(true));
  }, []);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(e) {
      if (
        e.key === "Escape" &&
        workflow !== "uploading" &&
        workflow !== "processing"
      ) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, workflow]);

  useEffect(() => {
    return () => {
      const pendingKey = presignedKeyRef.current;
      if (pendingKey) {
        cancelImportUpload(pendingKey).catch(() => {});
      }
    };
  }, []);

  const acceptedExtensions = useMemo(() => {
    const exts = plugins.flatMap((p) => p.extensions || []);
    const mimes = plugins.flatMap((p) => p.mimeTypes || []);
    return [...exts, ...mimes].join(",");
  }, [plugins]);

  const validateFile = useCallback(
    (candidate) => {
      if (!candidate) return "Please select a file";

      if (candidate.size > DEFAULT_MAX_FILE_SIZE) {
        return `File size is too large (max ${maxFileSizeMB} MB)`;
      }

      const name = candidate.name.toLowerCase();
      if (name.endsWith(".pdf")) {
        return "PDF import has been removed. Please use DOCX or JSON";
      }

      const supported = plugins.some((p) =>
        (p.extensions || []).some((ext) => name.endsWith(ext.toLowerCase())),
      );

      if (!supported) {
        return "Unsupported file format";
      }

      return null;
    },
    [maxFileSizeMB, plugins],
  );

  const updateFile = useCallback(
    (candidate) => {
      setDryRunResult(null);
      setImportResult(null);
      setPresignedKey(null);
      presignedKeyRef.current = null;
      setValidationError(null);
      setWorkflow("idle");

      const error = validateFile(candidate);
      if (error) {
        setFile(null);
        setValidationError(error);
        return;
      }
      setFile(candidate);
    },
    [validateFile],
  );

  const handleFileChange = useCallback(
    (e) => {
      const candidate = e.target.files?.[0] || null;
      updateFile(candidate);
    },
    [updateFile],
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragActive(true);
  }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
  }, []);
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragActive(false);
      updateFile(e.dataTransfer.files?.[0] || null);
    },
    [updateFile],
  );

  const handlePreview = useCallback(async () => {
    if (!file) return;
    setValidationError(null);
    setDryRunResult(null);
    setWorkflow("uploading");
    setUploadProgress(0);

    const filetype = file.type || "application/octet-stream";

    try {
      const presignedRes = await fetch("/api/repository/import/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          filesize: file.size,
          filetype,
        }),
      });

      if (!presignedRes.ok) {
        const err = await presignedRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to get upload URL");
      }

      const { presignedUrl, key } = await presignedRes.json();

      await uploadWithRetry(file, presignedUrl, filetype, setUploadProgress);

      setPresignedKey(key);
      presignedKeyRef.current = key;
      setPresignedMeta({ filename: file.name, filetype, filesize: file.size });
      setWorkflow("previewing");

      const res = await importRepositoryQuestions({
        key,
        filename: file.name,
        filetype,
        filesize: file.size,
        options: { dryRun: true },
      });

      setDryRunResult(res);
    } catch (err) {
      setDryRunResult({
        success: false,
        errors: [
          { code: "CLIENT_ERROR", message: err?.message || "Unexpected error" },
        ],
        warnings: [],
        timings: {},
      });
      toast.error(err?.message || "Error while previewing file");
      setWorkflow("failed");
    }
  }, [file]);

  const handleConfirmImport = useCallback(async () => {
    if (!presignedKey || !presignedMeta) return;

    setImportResult(null);
    setWorkflow("processing");

    try {
      const res = await importRepositoryQuestions({
        key: presignedKey,
        filename: presignedMeta.filename,
        filetype: presignedMeta.filetype,
        filesize: presignedMeta.filesize,
        options: { dryRun: false },
      });

      setImportResult(res);
      setWorkflow(res.success ? "completed" : "failed");

      const report = res.report || {};

      if (res.success && report.imported > 0) {
        toast.success(`Imported ${report.imported} question`);
        if (typeof onSuccess === "function") {
          onSuccess(report);
        }
      } else if (res.success && report.skipped > 0) {
        toast("File skipped: already imported");
      } else {
        toast.error("Import failed");
      }
    } catch (err) {
      setImportResult({
        success: false,
        errors: [
          { code: "CLIENT_ERROR", message: err?.message || "Unexpected error" },
        ],
        warnings: [],
        timings: {},
      });
      toast.error(err?.message || "Error during import");
      setWorkflow("failed");
    }
  }, [presignedKey, presignedMeta, onSuccess]);

  const handleReset = useCallback(() => {
    const keyToCancel = presignedKeyRef.current;
    if (keyToCancel) {
      cancelImportUpload(keyToCancel).catch(() => {});
      presignedKeyRef.current = null;
    }
    setFile(null);
    setDryRunResult(null);
    setImportResult(null);
    setPresignedKey(null);
    setPresignedMeta(null);
    setValidationError(null);
    setWorkflow("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const renderErrors = (errors) => {
    if (!errors || errors.length === 0) return null;
    const visible = errors.slice(0, 10);
    const remaining = errors.length - visible.length;

    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-red-700">Errors</h4>
        <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
          {visible.map((err, idx) => (
            <li key={idx}>
              {err.message || mapErrorCode(err.code)}
              {err.stage ? ` (${err.stage})` : null}
            </li>
          ))}
        </ul>
        {remaining > 0 && (
          <p className="mt-2 text-sm font-medium text-red-700">
            ... and {remaining} more errors
          </p>
        )}
      </div>
    );
  };

  const renderWarnings = (warnings) => {
    if (!warnings || warnings.length === 0) return null;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-amber-700">Warnings</h4>
        <ul className="list-inside list-disc space-y-1 text-sm text-amber-700">
          {warnings.slice(0, 10).map((w, idx) => (
            <li key={idx}>{w.message || mapErrorCode(w.code)}</li>
          ))}
        </ul>
        {warnings.length > 10 && (
          <p className="mt-2 text-sm font-medium text-amber-700">
            ... and {warnings.length - 10} more warnings
          </p>
        )}
      </div>
    );
  };

  const renderProgressSteps = (timings) => {
    if (!timings) return null;
    const STAGE_LABELS = {
      preFlightStage: "Validating file",
      readStage: "Reading file",
      parseStage: "Parsing content",
      normalizeStage: "Normalizing data",
      validateStage: "Validating questions",
      mapStage: "Mapping questions",
      persistStage: "Saving questions",
    };

    const steps = Object.entries(STAGE_LABELS).filter(
      ([key]) => timings[key] != null,
    );

    if (steps.length === 0) return null;

    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-gray-700">
          Processing stages
        </h4>
        <div className="space-y-1">
          {steps.map(([key, label]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <LuCheck size={14} className="text-green-500" />
              <span className="text-gray-600 flex-1">{label}</span>
              <span className="text-gray-400 tabular-nums">
                {timings[key]} ms
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    const result = dryRunResult;
    if (!result) return null;
    const report = result.report || {};

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${result.success ? "bg-green-500" : "bg-red-500"}`}
          ></span>
          <h3 className="text-sm font-semibold text-gray-800">
            Import Preview
          </h3>
        </div>

        {report.parsed != null && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <p className="text-lg font-bold text-gray-800">
                {report.parsed ?? 0}
              </p>
              <p className="text-xs text-gray-500">Detected</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <p className="text-lg font-bold text-gray-800">
                {report.validated ?? 0}
              </p>
              <p className="text-xs text-gray-500">Valid</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <p className="text-lg font-bold text-gray-800">
                {report.mapped ?? 0}
              </p>
              <p className="text-xs text-gray-500">Ready to save</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <p className="text-lg font-bold text-gray-800">
                {report.failed ?? 0}
              </p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          </div>
        )}

        {report.duration != null && (
          <p className="text-xs text-gray-500">
            Duration: {report.duration} ms
            {report.plugin ? ` | Parser: ${report.plugin}` : ""}
          </p>
        )}

        {renderWarnings(result.warnings)}
        {renderErrors(result.errors)}
        {renderProgressSteps(result.timings)}
      </div>
    );
  };

  const renderResult = () => {
    const result = importResult;
    if (!result) return null;
    const report = result.report || {};

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${result.success ? "bg-green-500" : "bg-red-500"}`}
          ></span>
          <h3 className="text-sm font-semibold text-gray-800">
            {result.success ? "Import completed" : "Import failed"}
          </h3>
        </div>

        {report.skipped > 0 && report.skipReason === "already_imported" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            File skipped because it was already imported
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-800">
              {report.imported ?? 0}
            </p>
            <p className="text-xs text-gray-500">Imported</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-800">
              {report.parsed ?? 0}
            </p>
            <p className="text-xs text-gray-500">Read</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-800">
              {report.validated ?? 0}
            </p>
            <p className="text-xs text-gray-500">Valid</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-800">
              {report.failed ?? 0}
            </p>
            <p className="text-xs text-gray-500">Failed</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-800">
              {report.skipped ?? 0}
            </p>
            <p className="text-xs text-gray-500">Skipped</p>
          </div>
        </div>

        {report.duration != null && (
          <p className="text-xs text-gray-500">
            Duration: {report.duration} ms
          </p>
        )}

        {renderErrors(result.errors)}
        {renderWarnings(result.warnings)}
        {renderProgressSteps(result.timings)}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Import another file
          </button>
        </div>
      </div>
    );
  };

  const isWorking =
    workflow === "uploading" ||
    workflow === "processing" ||
    workflow === "previewing";
  const showIdle = workflow === "idle" || workflow === "failed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      dir="ltr"
      onClick={isWorking ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2
            id="import-modal-title"
            className="text-lg font-bold text-gray-800"
          >
            Import Questions
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isWorking}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {workflow === "completed" && importResult ? (
            renderResult()
          ) : workflow === "previewing" && dryRunResult ? (
            <>
              {renderPreview()}

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-gray-600">
                    Preview completed successfully. Do you want to proceed with
                    the actual import?
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                    >
                      Start Import
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {!pluginsLoaded ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Supported Formats
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {plugins.map((plugin) => (
                        <span
                          key={plugin.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-green-50 border-green-200 text-green-700"
                        >
                          {plugin.label}
                          <span className="text-[10px] opacity-80">
                            {(plugin.extensions || []).join(", ")}
                          </span>
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Max: {maxFileSizeMB} MB
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-gray-600">
                        Download template:
                      </span>
                      <Link
                        href="/api/repository/import/template?format=json"
                        download
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        JSON
                      </Link>
                      <Link
                        href="/api/repository/import/template?format=docx"
                        download
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        DOCX
                      </Link>
                    </div>
                  </div>

                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                      dragActive
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      id="import-file-input"
                      type="file"
                      accept={acceptedExtensions}
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isWorking}
                    />
                    <label
                      htmlFor="import-file-input"
                      className="cursor-pointer inline-flex flex-col items-center gap-2"
                    >
                      <span className="text-3xl">📁</span>
                      <span className="text-sm text-gray-600">
                        Click to select a file or drag one here
                      </span>
                      <span className="text-xs text-gray-400">
                        {plugins
                          .flatMap((p) => p.extensions || [])
                          .join(", ") || ".json"}
                      </span>
                    </label>
                  </div>

                  {file && (
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={isWorking}
                        className="text-xs text-red-600 hover:text-red-700 disabled:text-gray-400 px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {validationError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {validationError}
                    </div>
                  )}

                  {workflow === "failed" &&
                    dryRunResult &&
                    renderErrors(dryRunResult.errors)}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isWorking}
                      className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePreview}
                      disabled={isWorking || !file}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                    >
                      {workflow === "uploading" ? (
                        <span className="inline-flex items-center gap-1">
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          {uploadProgress > 0
                            ? `Uploading ${uploadProgress}%`
                            : "Uploading..."}
                        </span>
                      ) : workflow === "processing" ? (
                        <span className="inline-flex items-center gap-1">
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Importing...
                        </span>
                      ) : workflow === "previewing" ? (
                        <span className="inline-flex items-center gap-1">
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Previewing...
                        </span>
                      ) : (
                        "Preview"
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
