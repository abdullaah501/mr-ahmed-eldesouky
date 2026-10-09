import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const store = { cursor: 0, states: [], initialized: [] };
  return {
    store,
    resetStore() {
      store.cursor = 0;
      store.states = [];
      store.initialized = [];
    },
  };
});

vi.mock("react", () => ({
  useState: (init) => {
    const { store } = hoisted;
    const i = store.cursor++;
    if (!store.initialized[i]) {
      store.states[i] = typeof init === "function" ? init() : init;
      store.initialized[i] = true;
    }
    const setValue = (v) => {
      store.states[i] = typeof v === "function" ? v(store.states[i]) : v;
    };
    return [store.states[i], setValue];
  },
  useRef: (init) => {
    const { store } = hoisted;
    const i = store.cursor++;
    if (!store.initialized[i]) {
      store.states[i] = { current: init };
      store.initialized[i] = true;
    }
    return store.states[i];
  },
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useEffect: () => {},
  useLayoutEffect: () => {},
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  Fragment: "Fragment",
}));

vi.mock("react/jsx-runtime", () => ({
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
  Fragment: "Fragment",
}));

vi.mock("../../lib/ai/resources", async (importOriginal) => {
  const orig = await importOriginal();
  return {
    ...orig,
    extractResource: vi.fn(async () => ({
      kind: "documents",
      text: "extracted-text",
      metadata: { resourceKind: "documents", extractorId: "docx" },
      refs: [],
      warnings: [],
    })),
  };
});

import "../../lib/ai/providers";
import { clearProviders, getProvider, listProviders, registerProvider } from "../../lib/ai/providers/registry";
import { staticProfile } from "../../lib/ai/capabilities/staticCapabilities";
import { listExtractors } from "../../lib/ai/resources";
import resourceNormalizationStage from "../../lib/ai/workflows/knowledgeExtraction/stages/resourceNormalizationStage";
import SourceStep, { FILE_SUPPORT_REASONS, resolveFileSupport } from "../../src/app/components/ai/steps/SourceStep";
import SourceCard from "../../src/app/components/ai/shared/SourceCard";
import { makeFakeProvider } from "../ai/helpers/fakeProvider";

const realProviders = listProviders();

function realExtractorMap() {
  return Object.fromEntries(listExtractors().map((extractor) => [
    extractor.id,
    { category: extractor.category, implemented: extractor.implemented !== false },
  ]));
}

function modelSupport(providerId, modelId, extractors = realExtractorMap()) {
  const provider = getProvider(providerId);
  return resolveFileSupport(staticProfile(provider, { model: modelId }), extractors);
}

function fileCapableProvider(id, overrides) {
  const adapter = makeFakeProvider({ id });
  adapter.capabilities = { ...adapter.capabilities, ...overrides };
  return adapter;
}

function render(Comp, props) {
  hoisted.resetStore();
  return Comp(props);
}

function findAll(node, pred, out = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, pred, out));
    return out;
  }
  if (node && typeof node === "object" && node.type) {
    if (pred(node)) out.push(node);
    if (typeof node.type === "function") findAll(node.type(node.props), pred, out);
    const children = node.props?.children;
    if (children !== undefined && children !== null) findAll(children, pred, out);
  }
  return out;
}

function collectText(node, out = []) {
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, out));
    return out;
  }
  if (node && typeof node === "object" && node.props) {
    collectText(node.props.children, out);
  }
  return out;
}

const textFileInput = (name, type) => ({
  name,
  type,
  arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
});

describe("file capability resolution across real providers", () => {
  beforeEach(() => {
    clearProviders();
    realProviders.forEach(registerProvider);
  });

  it("google catalog models enable native PDF, DOCX through local extraction, images unsupported (catalog images:false)", () => {
    for (const model of ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"]) {
      const support = modelSupport("google", model);
      expect(support.pdf.mode).toBe("native");
      expect(support.docx.mode).toBe("local");
      expect(support.images.mode).toBe("unsupported");
    }
  });

  it("openrouter non-file models disable native file types and only DOCX survives via local extraction", () => {
    const support = modelSupport("openrouter", "liquid/lfm-2.5-2.6b:free");
    expect(support.pdf.mode).toBe("unsupported");
    expect(support.docx.mode).toBe("local");
    expect(support.images.mode).toBe("unsupported");
  });

  it("groq models without files capability only support DOCX locally", () => {
    for (const model of ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]) {
      const support = modelSupport("groq", model);
      expect(support.pdf.mode).toBe("unsupported");
      expect(support.docx.mode).toBe("local");
      expect(support.images.mode).toBe("unsupported");
    }
  });

  it("opencode and openrouter models never gain native files from model-level vision overrides", () => {
    expect(modelSupport("opencode", "mimo-v2.5-free").images.mode).toBe("unsupported");
    expect(modelSupport("opencode", "deepseek-v4-flash-free").images.mode).toBe("unsupported");
    expect(modelSupport("openrouter", "liquid/lfm-2.5-2.6b:free").images.mode).toBe("unsupported");
    expect(modelSupport("openrouter", "liquid/lfm-2.5-2.6b:free").pdf.mode).toBe("unsupported");
    expect(modelSupport("opencode", "mimo-v2.5-free").docx.mode).toBe("local");
  });

  it("files=true alone never enables a file type", () => {
    const support = resolveFileSupport({ files: true }, realExtractorMap());
    expect(support.pdf.mode).toBe("unsupported");
    expect(support.images.mode).toBe("unsupported");
  });

  it("local extractors keep file types enabled even without model capabilities", () => {
    const support = resolveFileSupport({}, realExtractorMap());
    expect(support.docx.mode).toBe("local");
    expect(support.pdf.mode).toBe("unsupported");
  });
});

describe("resource normalization request path", () => {
  beforeEach(() => {
    clearProviders();
  });

  it("routes PDF natively only when the model supports files+pdf and no local extractor exists", async () => {
    registerProvider(fileCapableProvider("native-files", { files: true, pdf: true }));
    const ctx = { input: textFileInput("a.pdf", "application/pdf"), prefer: "native-files", model: "fake-model", warnings: [] };
    await resourceNormalizationStage.run(ctx);
    expect(ctx.useNativeFile).toBe(true);
    expect(ctx.resolvedInputType).toBe("native-file");
    expect(ctx.normalizedInput).toBeNull();
    // Native files are now cacheable via content-addressed identity.
    expect(ctx.skipCache).toBeUndefined();
    expect(ctx.fileHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects PDF when neither native support nor a local extractor exists", async () => {
    registerProvider(fileCapableProvider("no-files", { files: false, pdf: false, word: false, images: false, vision: false }));
    const ctx = { input: textFileInput("a.pdf", "application/pdf"), prefer: "no-files", model: "fake-model", warnings: [] };
    const result = await resourceNormalizationStage.run(ctx);
    expect(result.fatal).toBe(true);
    expect(result.errors[0].code).toBe("AI_RESOURCE_UNSUPPORTED");
    expect(ctx.useNativeFile).toBeUndefined();
  });

  it("extracts DOCX locally regardless of model file capabilities", async () => {
    registerProvider(fileCapableProvider("no-files", { files: false, pdf: false, word: false, images: false, vision: false }));
    const ctx = {
      input: textFileInput("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      prefer: "no-files",
      model: "fake-model",
      warnings: [],
    };
    const result = await resourceNormalizationStage.run(ctx);
    expect(result.success).toBe(true);
    expect(ctx.useNativeFile).toBeUndefined();
    expect(ctx.text).toBe("extracted-text");
    expect(ctx.resolvedInputType).toBe("documents");
  });

  it("routes images natively only for vision models with file support", async () => {
    registerProvider(fileCapableProvider("vision-files", { files: true, images: true, vision: true }));
    const ctx = { input: textFileInput("a.png", "image/png"), prefer: "vision-files", model: "fake-model", warnings: [] };
    await resourceNormalizationStage.run(ctx);
    expect(ctx.useNativeFile).toBe(true);
    expect(ctx.fileHash).toMatch(/^[a-f0-9]{64}$/);

    clearProviders();
    registerProvider(fileCapableProvider("vision-no-files", { files: false, images: true, vision: true }));
    const rejected = { input: textFileInput("a.png", "image/png"), prefer: "vision-no-files", model: "fake-model", warnings: [] };
    const failure = await resourceNormalizationStage.run(rejected);
    expect(failure.fatal).toBe(true);
    expect(failure.errors[0].code).toBe("AI_RESOURCE_UNSUPPORTED");
  });
});

describe("SourceStep capability UI", () => {
  const baseProps = (capabilities, resourceExtractors, source = { type: "text", text: "" }) => ({
    providers: [],
    health: {},
    provider: "p",
    model: "m",
    capabilities,
    resourceExtractors,
    source,
    onProviderChange: vi.fn(),
    onModelChange: vi.fn(),
    onSourceChange: vi.fn(),
    onStart: vi.fn(),
    loading: false,
  });

  const realExtractors = realExtractorMap();

  it("shows the real reason per file type for a vision-capable model", () => {
    const tree = render(SourceStep, baseProps(
      { files: true, pdf: true, word: false, images: true, vision: true },
      realExtractors,
    ));
    const text = collectText(tree).join("\n");
    expect(text).toContain(FILE_SUPPORT_REASONS.native);
    expect(text).toContain(FILE_SUPPORT_REASONS.local);
    expect(text).not.toContain(FILE_SUPPORT_REASONS.unsupported);

    const fileInput = findAll(tree, (el) => el.type === "input" && el.props.type === "file")[0];
    expect(fileInput.props.accept).toContain(".pdf");
    expect(fileInput.props.accept).toContain(".docx");
    expect(fileInput.props.accept).toContain(".png");
  });

  it("marks unsupported types and restricts the picker for models without file support", () => {
    const tree = render(SourceStep, baseProps(
      { files: false, pdf: false, word: false, images: false, vision: false },
      realExtractors,
    ));
    const text = collectText(tree).join("\n");
    expect(text).toContain(FILE_SUPPORT_REASONS.local);
    expect(text).toContain(FILE_SUPPORT_REASONS.unsupported);
    expect(text).not.toContain(FILE_SUPPORT_REASONS.native);

    const fileInput = findAll(tree, (el) => el.type === "input" && el.props.type === "file")[0];
    expect(fileInput.props.accept).not.toContain(".pdf");
    expect(fileInput.props.accept).not.toContain(".png");
    expect(fileInput.props.accept).toContain(".docx");

    const cards = findAll(tree, (el) => el.type === SourceCard);
    const fileCard = cards.find((card) => card.props.title === "Upload File");
    expect(fileCard.props.disabled).toBe(false);
  });

  it("disables the file card entirely when no type is supported", () => {
    const tree = render(SourceStep, baseProps({ files: false, pdf: false, word: false, images: false, vision: false }, {}));
    const cards = findAll(tree, (el) => el.type === SourceCard);
    const fileCard = cards.find((card) => card.props.title === "Upload File");
    expect(fileCard.props.disabled).toBe(true);
    expect(fileCard.props.description).toBe("No supported formats");
  });

  it("rejects unsupported file picks and accepts supported ones with the resolved mode", () => {
    const onSourceChange = vi.fn();
    const capabilities = { files: false, pdf: false, word: false, images: false, vision: false };
    const props = baseProps(capabilities, realExtractors, { type: "file", file: null });
    props.onSourceChange = onSourceChange;
    const tree = render(SourceStep, props);
    const fileInput = findAll(tree, (el) => el.type === "input" && el.props.type === "file")[0];

    fileInput.props.onChange({ target: { files: [{ name: "lesson.pdf", type: "application/pdf" }], value: "" } });
    expect(onSourceChange).toHaveBeenLastCalledWith(expect.objectContaining({ file: null }));

    fileInput.props.onChange({ target: { files: [{ name: "lesson.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }], value: "" } });
    expect(onSourceChange).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "docx",
      file: expect.objectContaining({ name: "lesson.docx" }),
    }));
  });
});
