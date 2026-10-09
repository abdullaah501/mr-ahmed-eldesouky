import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const STUDENT = "aaaaaaaaaaaaaaaaaaaaaaaa";
const EXAM = "111111111111111111111111";
const Q1 = "cccccccccccccccccccccccc";
const Q2 = "dddddddddddddddddddddddd";

const hoisted = vi.hoisted(() => ({
  cursor: 0,
  states: [],
  initialized: [],
  refs: [],
  effects: [],
  rhf: { defaults: null, current: {}, subs: [] },
  saveQuizDraft: vi.fn(),
  addSubmission: vi.fn(),
}));

vi.mock("react", () => ({
  useState: (init) => {
    const i = hoisted.cursor++;
    if (!hoisted.initialized[i]) {
      hoisted.states[i] = typeof init === "function" ? init() : init;
      hoisted.initialized[i] = true;
    }
    const setState = (value) => {
      hoisted.states[i] =
        typeof value === "function" ? value(hoisted.states[i]) : value;
    };
    return [hoisted.states[i], setState];
  },
  useReducer: (reducer, init) => {
    const i = hoisted.cursor++;
    if (!hoisted.initialized[i]) {
      hoisted.states[i] = init;
      hoisted.initialized[i] = true;
    }
    return [
      hoisted.states[i],
      (action) => {
        hoisted.states[i] = reducer(hoisted.states[i], action);
      },
    ];
  },
  useRef: (init) => {
    const i = hoisted.cursor++;
    if (!hoisted.refs[i]) hoisted.refs[i] = { current: init };
    return hoisted.refs[i];
  },
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useEffect: (fn) => {
    hoisted.effects.push(fn);
  },
  createElement: (type, props, ...children) => ({
    type,
    props: { ...props, children },
  }),
  Fragment: "Fragment",
}));

vi.mock("react/jsx-runtime", () => ({
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
  Fragment: "Fragment",
}));

vi.mock("react-hook-form", () => ({
  useForm: (options) => {
    hoisted.rhf.defaults = options?.defaultValues || {};
    return {
      register: () => ({}),
      handleSubmit: (fn) => fn,
      setValue: vi.fn(),
      watch: (callback) => {
        if (typeof callback === "function") {
          hoisted.rhf.subs.push(callback);
          return {
            unsubscribe: () => {
              hoisted.rhf.subs = hoisted.rhf.subs.filter((s) => s !== callback);
            },
          };
        }
        return { ...hoisted.rhf.defaults, ...hoisted.rhf.current };
      },
      trigger: vi.fn(async () => true),
      formState: {
        errors: {},
        isSubmitted: false,
        isValid: true,
        isSubmitting: false,
      },
    };
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { success: false }, isLoading: false }),
}));

vi.mock("next/image", () => ({ __esModule: true, default: () => null }));
vi.mock("next/link", () => ({
  __esModule: true,
  default: (props) => ({ type: "Link", props }),
}));

vi.mock("react-icons/fi", () => {
  const Stub = () => null;
  return {
    FiCheckCircle: Stub,
    FiXCircle: Stub,
    FiClock: Stub,
    FiHelpCircle: Stub,
    FiSend: Stub,
    FiAlertTriangle: Stub,
  };
});

vi.mock("../../src/app/components/math/MathRenderer", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("../../lib/axios/axios", () => ({
  api: { get: vi.fn() },
}));

vi.mock("../../src/app/actions/examActions", () => ({
  addSubmission: (...args) => hoisted.addSubmission(...args),
  saveQuizDraft: (...args) => hoisted.saveQuizDraft(...args),
}));

const StubRenderer = () => null;
vi.mock("../../src/question-system/plugins/registry", () => ({
  get: () => ({ Renderer: StubRenderer }),
  register: vi.fn(),
  meta: () => ({}),
  docxContent: () => null,
}));
vi.mock("@/question-system/plugins/multiple-choice/index", () => ({}));
vi.mock("@/question-system/plugins/true-false/index", () => ({}));
vi.mock("@/question-system/plugins/essay/index", () => ({}));
vi.mock("@/question-system/plugins/fill-blank/index", () => ({}));
vi.mock("@/question-system/plugins/matching/index", () => ({}));
vi.mock("@/question-system/plugins/image-choice/index", () => ({}));

import Quiz from "../../src/app/components/Quiz";

const storageMap = new Map();
const listeners = { window: {}, document: {} };

function addListener(registry, type, fn) {
  (registry[type] = registry[type] || []).push(fn);
}

function removeListener(registry, type, fn) {
  registry[type] = (registry[type] || []).filter((entry) => entry !== fn);
}

function fire(registry, type) {
  for (const fn of [...(registry[type] || [])]) fn({ type });
}

function renderQuiz(props) {
  hoisted.cursor = 0;
  hoisted.effects = [];
  const tree = Quiz(props);
  const cleanups = hoisted.effects
    .map((fn) => fn())
    .filter((cleanup) => typeof cleanup === "function");
  return { tree, cleanups };
}

function change(values) {
  hoisted.rhf.current = { ...hoisted.rhf.current, ...values };
  const merged = { ...hoisted.rhf.defaults, ...hoisted.rhf.current };
  for (const sub of [...hoisted.rhf.subs]) sub(merged);
}

function findAll(node, predicate, out = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, out));
    return out;
  }
  if (!node || typeof node !== "object") return out;
  if (predicate(node)) out.push(node);
  findAll(node.props?.children, predicate, out);
  return out;
}

function findRenderer(tree) {
  return findAll(tree, (node) => node.type === StubRenderer);
}

const QUESTIONS = [
  {
    _id: Q1,
    type: "multiple-choice",
    questionText: "Question 1",
    options: [{ valueText: "a", optionText: "A" }],
    correctAnswer: "a",
  },
  {
    _id: Q2,
    type: "multiple-choice",
    questionText: "Question 2",
    options: [{ valueText: "b", optionText: "B" }],
    correctAnswer: "b",
  },
];

function baseProps(overrides = {}) {
  return {
    questions: QUESTIONS,
    title: "Exam",
    userId: JSON.stringify(STUDENT),
    examId: EXAM,
    draft: null,
    ...overrides,
  };
}

function readStoredDraft() {
  const raw = storageMap.get(`quizDraft_${STUDENT}_${EXAM}`);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  vi.useFakeTimers();
  storageMap.clear();
  listeners.window = {};
  listeners.document = {};
  hoisted.rhf.defaults = null;
  hoisted.rhf.current = {};
  hoisted.rhf.subs = [];
  hoisted.states = [];
  hoisted.initialized = [];
  hoisted.refs = [];
  hoisted.saveQuizDraft.mockReset();
  hoisted.saveQuizDraft.mockResolvedValue({ success: true, revision: 1 });
  hoisted.addSubmission.mockReset();

  globalThis.window = {
    localStorage: {
      getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
      setItem: (key, value) => storageMap.set(key, String(value)),
      removeItem: (key) => storageMap.delete(key),
    },
    addEventListener: (type, fn) => addListener(listeners.window, type, fn),
    removeEventListener: (type, fn) => removeListener(listeners.window, type, fn),
  };
  globalThis.document = {
    visibilityState: "visible",
    addEventListener: (type, fn) => addListener(listeners.document, type, fn),
    removeEventListener: (type, fn) =>
      removeListener(listeners.document, type, fn),
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.window;
  delete globalThis.document;
});

describe("Quiz hybrid draft hydration", () => {
  it("restores a local draft synchronously into defaultValues and userAnswer", () => {
    storageMap.set(
      `quizDraft_${STUDENT}_${EXAM}`,
      JSON.stringify({
        v: 2,
        updatedAt: 1,
        serverRevision: 0,
        baseAnswers: {},
        answers: { [Q1]: "local-answer" },
      })
    );

    const { tree } = renderQuiz(baseProps());

    expect(hoisted.rhf.defaults[Q1]).toBe("local-answer");
    const renderers = findRenderer(tree);
    expect(renderers[0].props.userAnswer).toBe("local-answer");
  });

  it("restores the server draft when no local draft exists", () => {
    const { tree } = renderQuiz(
      baseProps({
        draft: { answers: { [Q2]: "server-answer" }, revision: 4 },
      })
    );

    expect(hoisted.rhf.defaults[Q2]).toBe("server-answer");
    const renderers = findRenderer(tree);
    expect(renderers[1].props.userAnswer).toBe("server-answer");
  });

  it("reconciles a newer local draft against the canonical server state", () => {
    storageMap.set(
      `quizDraft_${STUDENT}_${EXAM}`,
      JSON.stringify({
        v: 2,
        updatedAt: 1,
        serverRevision: 4,
        baseAnswers: { [Q1]: "server-a" },
        answers: { [Q1]: "local-a" },
      })
    );

    renderQuiz(
      baseProps({ draft: { answers: { [Q1]: "server-a" }, revision: 5 } })
    );

    // server == base → local wins.
    expect(hoisted.rhf.defaults[Q1]).toBe("local-a");
  });
});

describe("Quiz hybrid draft persistence", () => {
  it("writes localStorage after the 500ms local debounce only", async () => {
    renderQuiz(baseProps());

    change({ [Q1]: "a" });
    await vi.advanceTimersByTimeAsync(499);
    expect(readStoredDraft()).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(readStoredDraft().answers).toEqual({ [Q1]: "a" });
  });

  it("syncs to the server after the 5000ms debounce only", async () => {
    renderQuiz(baseProps());

    change({ [Q1]: "a" });
    await vi.advanceTimersByTimeAsync(4999);
    expect(hoisted.saveQuizDraft).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(hoisted.saveQuizDraft).toHaveBeenCalledTimes(1);
    expect(hoisted.saveQuizDraft).toHaveBeenCalledWith({
      examId: EXAM,
      baseRevision: 0,
      answers: { [Q1]: "a" },
    });
  });

  it("coalesces many changes into one server save", async () => {
    renderQuiz(baseProps());

    change({ [Q1]: "a" });
    await vi.advanceTimersByTimeAsync(100);
    change({ [Q1]: "ab" });
    await vi.advanceTimersByTimeAsync(100);
    change({ [Q1]: "abc" });
    await vi.advanceTimersByTimeAsync(5000);

    expect(hoisted.saveQuizDraft).toHaveBeenCalledTimes(1);
    expect(hoisted.saveQuizDraft.mock.calls[0][0].answers).toEqual({
      [Q1]: "abc",
    });
  });

  it("flushes localStorage on visibilitychange → hidden; the flush itself makes no network call", async () => {
    renderQuiz(baseProps());

    change({ [Q1]: "a" });
    globalThis.document.visibilityState = "hidden";
    fire(listeners.document, "visibilitychange");

    expect(readStoredDraft().answers).toEqual({ [Q1]: "a" });
    // The interruption path is local-only; the already-scheduled coalesced
    // server sync is allowed to run afterwards.
    expect(hoisted.saveQuizDraft).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(hoisted.saveQuizDraft).toHaveBeenCalledTimes(1);
  });

  it("flushes localStorage on pagehide", () => {
    renderQuiz(baseProps());

    change({ [Q1]: "a" });
    fire(listeners.window, "pagehide");

    expect(readStoredDraft().answers).toEqual({ [Q1]: "a" });
  });

  it("flushes on unmount and cancels pending synchronization", async () => {
    const { cleanups } = renderQuiz(baseProps());

    change({ [Q1]: "a" });
    for (const cleanup of cleanups) cleanup();

    expect(readStoredDraft().answers).toEqual({ [Q1]: "a" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(hoisted.saveQuizDraft).not.toHaveBeenCalled();
  });

  it("synchronizes immediately when the browser comes back online", async () => {
    renderQuiz(baseProps());

    change({ [Q1]: "a" });
    fire(listeners.window, "online");
    await vi.advanceTimersByTimeAsync(0);

    expect(hoisted.saveQuizDraft).toHaveBeenCalledTimes(1);
  });

  it("bounds conflict retries to two attempts per invocation", async () => {
    hoisted.saveQuizDraft
      .mockResolvedValueOnce({
        success: false,
        conflict: true,
        draft: { answers: { [Q1]: "server" }, revision: 1 },
      })
      .mockResolvedValueOnce({ success: true, revision: 2 });

    renderQuiz(baseProps());

    change({ [Q1]: "local" });
    await vi.advanceTimersByTimeAsync(5000);

    expect(hoisted.saveQuizDraft).toHaveBeenCalledTimes(2);
    expect(hoisted.saveQuizDraft.mock.calls[1][0].baseRevision).toBe(1);

    await vi.advanceTimersByTimeAsync(20000);
    expect(hoisted.saveQuizDraft).toHaveBeenCalledTimes(2);
  });

  it("never loses a newer local edit made while a save is in flight", async () => {
    let resolveFirst;
    hoisted.saveQuizDraft
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({ success: true, revision: 2 });

    renderQuiz(baseProps());

    change({ [Q1]: "first" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(hoisted.saveQuizDraft).toHaveBeenCalledTimes(1);

    change({ [Q1]: "second" });
    resolveFirst({ success: true, revision: 1 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5000);

    expect(hoisted.saveQuizDraft).toHaveBeenCalledTimes(2);
    const secondCall = hoisted.saveQuizDraft.mock.calls[1][0];
    expect(secondCall.baseRevision).toBe(1);
    expect(secondCall.answers).toEqual({ [Q1]: "second" });
  });

  it("stops all draft writes once the exam is submitted elsewhere", async () => {
    hoisted.saveQuizDraft.mockResolvedValue({ success: true, submitted: true });

    renderQuiz(baseProps());

    change({ [Q1]: "a" });
    await vi.advanceTimersByTimeAsync(5000);

    expect(readStoredDraft()).toBeNull();

    change({ [Q1]: "b" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(hoisted.saveQuizDraft).toHaveBeenCalledTimes(1);
  });

  it("keeps the local buffer when the network fails", async () => {
    hoisted.saveQuizDraft.mockRejectedValue(new Error("offline"));

    renderQuiz(baseProps());

    change({ [Q1]: "a" });
    await vi.advanceTimersByTimeAsync(5000);

    expect(readStoredDraft().answers).toEqual({ [Q1]: "a" });
  });

  it("clears the local draft after a successful submission", async () => {
    hoisted.addSubmission.mockResolvedValue({ success: true });
    const { tree } = renderQuiz(baseProps());

    change({ [Q1]: "a" });
    fire(listeners.window, "pagehide");
    expect(readStoredDraft()).not.toBeNull();

    const form = findAll(tree, (node) => node.type === "form")[0];
    await form.props.onSubmit({ [Q1]: "a" });

    expect(hoisted.addSubmission).toHaveBeenCalledTimes(1);
    expect(readStoredDraft()).toBeNull();
  });

  it("preserves the local draft when submission fails", async () => {
    hoisted.addSubmission.mockResolvedValue({
      success: false,
      message: "Error adding submission",
    });
    const { tree } = renderQuiz(baseProps());

    change({ [Q1]: "a" });
    fire(listeners.window, "pagehide");

    const form = findAll(tree, (node) => node.type === "form")[0];
    await form.props.onSubmit({ [Q1]: "a" });

    expect(readStoredDraft().answers).toEqual({ [Q1]: "a" });
  });
});
