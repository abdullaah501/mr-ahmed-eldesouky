import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const hoisted = vi.hoisted(() => {
  const state = {
    cursor: 0,
    states: [],
    initialized: [],
    refs: [],
    effectDeps: [],
    pendingEffects: [],
    searchFilters: null,
    fetch: vi.fn(),
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
    anchorClick: vi.fn(),
  };
  // Marker components so tests can find their elements and read props.
  state.QuestionList = function QuestionListMarker() {
    return null;
  };
  state.QuestionFilters = function QuestionFiltersMarker() {
    return null;
  };
  return state;
});

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
  useEffect: (fn, deps) => {
    const i = hoisted.cursor++;
    const prev = hoisted.effectDeps[i];
    const changed =
      !deps ||
      !prev ||
      deps.length !== prev.length ||
      deps.some((dep, index) => !Object.is(dep, prev[index]));
    hoisted.effectDeps[i] = deps;
    if (changed) hoisted.pendingEffects.push(fn);
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

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { total: 0 } }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("react-icons/fi", () => {
  const Stub = () => null;
  return {
    FiPlus: Stub,
    FiUpload: Stub,
    FiCpu: Stub,
    FiSearch: Stub,
    FiFilter: Stub,
    FiDownload: Stub,
  };
});

vi.mock("@/question-system/capabilities", () => ({
  getCapabilities: () => ({}),
}));

vi.mock("@/question-system/engine", () => ({
  QuestionEngine: { createBlank: vi.fn() },
}));

vi.mock(
  "@/app/components/Exams/ExamGenerator/QuestionWorkspace/QuestionWorkspace",
  () => ({ __esModule: true, default: () => null })
);

vi.mock("@/question-system/plugins/multiple-choice/index", () => ({}));
vi.mock("@/question-system/plugins/true-false/index", () => ({}));
vi.mock("@/question-system/plugins/essay/index", () => ({}));
vi.mock("@/question-system/plugins/fill-blank/index", () => ({}));
vi.mock("@/question-system/plugins/matching/index", () => ({}));
vi.mock("@/question-system/plugins/image-choice/index", () => ({}));

vi.mock("@/hooks/useRepositorySearch", () => ({
  useRepositorySearch: (filters) => {
    hoisted.searchFilters = filters;
    return {
      data: { pages: [{ items: [] }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    };
  },
}));

vi.mock("@/app/components/Repository/QuestionList", () => ({
  __esModule: true,
  default: hoisted.QuestionList,
}));

vi.mock("@/app/components/Repository/QuestionFilters", () => ({
  __esModule: true,
  default: hoisted.QuestionFilters,
}));

vi.mock("@/app/components/Repository/ImportRepositoryModal", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/app/components/Repository/AIGeneratorModal", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/app/actions/repositoryActions", () => ({
  createRepositoryQuestion: vi.fn(),
  updateRepositoryQuestion: vi.fn(),
  deleteRepositoryQuestion: vi.fn(),
  archiveRepositoryQuestion: vi.fn(),
  duplicateRepositoryQuestion: vi.fn(),
  getRepositoryStatsAction: vi.fn(),
  bulkDeleteRepositoryQuestions: vi.fn(),
}));

import RepositoryClient from "../../src/app/(dashboard)/dashboard/repository/RepositoryClient";

const A = "111111111111111111111111";
const B = "222222222222222222222222";

function renderClient() {
  hoisted.cursor = 0;
  hoisted.pendingEffects = [];
  const tree = RepositoryClient({ user: { role: "admin" }, isAssistant: false });
  const cleanups = hoisted.pendingEffects
    .map((fn) => fn())
    .filter((cleanup) => typeof cleanup === "function");
  return { tree, cleanups };
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

function findComponent(tree, component) {
  return findAll(tree, (node) => node.type === component)[0];
}

function findButton(tree, label) {
  return findAll(
    tree,
    (node) =>
      node.type === "button" &&
      (Array.isArray(node.props?.children)
        ? node.props.children.includes(label)
        : node.props?.children === label)
  )[0];
}

function selectionOf(tree) {
  return findComponent(tree, hoisted.QuestionList).props.selection;
}

beforeEach(() => {
  hoisted.states = [];
  hoisted.initialized = [];
  hoisted.refs = [];
  hoisted.effectDeps = [];
  hoisted.pendingEffects = [];
  hoisted.searchFilters = null;
  hoisted.fetch.mockReset();
  hoisted.fetch.mockResolvedValue({
    ok: true,
    blob: async () => new Blob(["docx"]),
  });
  hoisted.createObjectURL.mockClear();
  hoisted.revokeObjectURL.mockClear();
  hoisted.anchorClick.mockClear();

  globalThis.fetch = hoisted.fetch;
  globalThis.URL.createObjectURL = hoisted.createObjectURL;
  globalThis.URL.revokeObjectURL = hoisted.revokeObjectURL;
  globalThis.document = {
    createElement: () => ({
      href: "",
      download: "",
      click: hoisted.anchorClick,
      remove: vi.fn(),
    }),
    body: { appendChild: vi.fn() },
  };
});

afterEach(() => {
  delete globalThis.fetch;
  delete globalThis.document;
});

describe("Question Bank selection state", () => {
  it("select all filtered stores filters intent only — no id materialization", () => {
    const { tree } = renderClient();

    findButton(tree, "تحديد الكل").props.onClick();
    const next = renderClient();

    expect(selectionOf(next.tree).mode).toBe("allFiltered");
    expect(selectionOf(next.tree).selectedIds).toEqual([]);
    expect(selectionOf(next.tree).excludedIds).toEqual([]);
  });

  it("deselecting/reselecting a row toggles exactly one exclusion", () => {
    const { tree } = renderClient();
    findButton(tree, "تحديد الكل").props.onClick();
    renderClient();

    findComponent(renderClient().tree, hoisted.QuestionList).props.onToggleSelect(
      A,
      false
    );
    let next = renderClient();
    expect(selectionOf(next.tree).excludedIds).toEqual([A]);
    expect(selectionOf(next.tree).selectedIds).toEqual([]);

    findComponent(next.tree, hoisted.QuestionList).props.onToggleSelect(A, true);
    next = renderClient();
    expect(selectionOf(next.tree).excludedIds).toEqual([]);
    expect(selectionOf(next.tree).mode).toBe("allFiltered");
  });

  it("a filter change resets allFiltered selection", () => {
    const { tree } = renderClient();
    findButton(tree, "تحديد الكل").props.onClick();
    renderClient();
    expect(selectionOf(renderClient().tree).mode).toBe("allFiltered");

    const filtersProps = findComponent(
      renderClient().tree,
      hoisted.QuestionFilters
    ).props;
    filtersProps.onChange({ ...filtersProps.filters, type: ["essay"] });
    renderClient();
    const next = renderClient();

    expect(selectionOf(next.tree).mode).toBe("explicit");
    expect(selectionOf(next.tree).excludedIds).toEqual([]);
  });

  it("keeps explicit selection behavior unchanged", () => {
    renderClient();

    findComponent(renderClient().tree, hoisted.QuestionList).props.onToggleSelect(
      A,
      true
    );
    const next = renderClient();

    expect(selectionOf(next.tree).mode).toBe("explicit");
    expect(selectionOf(next.tree).selectedIds).toEqual([A]);
    expect(findButton(next.tree, "حذف المحدد")).toBeTruthy();
  });
});

describe("Question Bank export request", () => {
  it("sends one compact allFiltered request and downloads once", async () => {
    const { tree } = renderClient();
    findButton(tree, "تحديد الكل").props.onClick();
    renderClient();

    await findButton(renderClient().tree, "تصدير Word").props.onClick();

    expect(hoisted.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = hoisted.fetch.mock.calls[0];
    expect(url).toBe("/api/repository/export/docx");
    const body = JSON.parse(init.body);
    expect(body.mode).toBe("allFiltered");
    expect(body).not.toHaveProperty("selectedIds");
    expect(body.excludedIds).toEqual([]);
    expect(body.includeAnswers).toBe(false);
    expect(body.filters).toEqual(
      expect.objectContaining({ subject: ["الكيمياء"] })
    );
    expect(body).not.toHaveProperty("questions");

    expect(hoisted.createObjectURL).toHaveBeenCalledTimes(1);
    expect(hoisted.anchorClick).toHaveBeenCalledTimes(1);
    expect(hoisted.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("sends only explicit ids in explicit mode", async () => {
    renderClient();
    findComponent(renderClient().tree, hoisted.QuestionList).props.onToggleSelect(
      A,
      true
    );
    renderClient();
    findComponent(renderClient().tree, hoisted.QuestionList).props.onToggleSelect(
      B,
      true
    );
    renderClient();

    await findButton(renderClient().tree, "تصدير Word").props.onClick();

    const body = JSON.parse(hoisted.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      mode: "explicit",
      selectedIds: [A, B],
      includeAnswers: false,
    });
  });

  it("surfaces the server limit message and downloads nothing", async () => {
    hoisted.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        code: "EXPORT_LIMIT_EXCEEDED",
        message: "More than 1000 questions match",
      }),
    });

    const { tree } = renderClient();
    findButton(tree, "تحديد الكل").props.onClick();
    renderClient();

    await findButton(renderClient().tree, "تصدير Word").props.onClick();

    expect(hoisted.createObjectURL).not.toHaveBeenCalled();
  });
});
