import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("next/image", () => ({ __esModule: true, default: () => null }));
vi.mock("../../lib/upload", () => ({ upload: vi.fn() }));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options) => {
    const count = options.count || 0;
    return {
      getTotalSize: () => count * 280,
      getVirtualItems: () =>
        Array.from({ length: count }, (_, i) => ({
          index: i,
          start: i * 280,
          size: 280,
        })),
      measureElement: () => {},
    };
  },
}));

import QuestionWorkspace from "../../src/app/components/Exams/ExamGenerator/QuestionWorkspace/QuestionWorkspace";
import ReviewStep from "../../src/app/components/ai/steps/ReviewStep";
import "../../src/question-system/plugins/multiple-choice/index";

function render(Comp, props) {
  hoisted.store.cursor = 0;
  return Comp(props);
}

function findAll(node, pred, out = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, pred, out));
    return out;
  }
  if (node && typeof node === "object" && node.type) {
    if (pred(node)) out.push(node);
    if (typeof node.type === "function") {
      findAll(node.type(node.props), pred, out);
    }
    const children = node.props?.children;
    if (children !== undefined && children !== null) findAll(children, pred, out);
  }
  return out;
}

const isCorrectAnswerSelect = (el) =>
  el.type === "select"
  && findAll(el, (option) => option.type === "option" && option.props?.value === "a").length > 0
  && findAll(el, (option) => option.type === "option" && option.props?.value === "d").length > 0;

const correctAnswerSelect = (tree) => findAll(tree, isCorrectAnswerSelect)[0];

const draftWithCorrectB = () => ({
  type: "multiple-choice",
  questionText: "ما ناتج 2+2؟",
  correctAnswer: "b",
  options: [
    { optionText: "3", valueText: "a" },
    { optionText: "4", valueText: "b" },
    { optionText: "5", valueText: "c" },
    { optionText: "6", valueText: "d" },
  ],
});

const workspaceProps = (question, onSave) => ({
  question,
  capabilities: { canUpload: false, canChangeType: false },
  showRepositoryFields: true,
  isNew: false,
  onSave,
});

beforeEach(() => {
  hoisted.resetStore();
});

describe("AI review editor reuse — MCQ correct answer", () => {
  it("renders the correct option selected for an AI draft (correctAnswer = b)", () => {
    const tree = render(QuestionWorkspace, workspaceProps(draftWithCorrectB(), vi.fn()));
    const select = correctAnswerSelect(tree);
    expect(select).toBeTruthy();
    expect(select.props.value).toBe("b");

    const optionInputs = findAll(
      tree,
      (el) => el.type === "input" && typeof el.props.placeholder === "string" && el.props.placeholder.includes("Option")
    );
    expect(optionInputs.map((el) => el.props.value)).toEqual(["3", "4", "5", "6"]);
  });

  it("selecting C updates the draft and onSave delivers correctAnswer c with untouched options", () => {
    const onSave = vi.fn();
    const draft = draftWithCorrectB();
    let tree = render(QuestionWorkspace, workspaceProps(draft, onSave));

    correctAnswerSelect(tree).props.onChange({ target: { value: "c" } });
    tree = render(QuestionWorkspace, workspaceProps(draft, onSave));
    expect(correctAnswerSelect(tree).props.value).toBe("c");

    const saveButton = findAll(
      tree,
      (el) => el.type === "button" && JSON.stringify(el.props.children).includes("Save Changes")
    )[0];
    saveButton.props.onClick();

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][1];
    expect(saved.correctAnswer).toBe("c");
    expect(saved.options).toEqual(draftWithCorrectB().options);
  });

  it("syncs state only when the question prop identity changes, preserving unsaved edits", () => {
    const draft = draftWithCorrectB();
    let tree = render(QuestionWorkspace, workspaceProps(draft, vi.fn()));

    correctAnswerSelect(tree).props.onChange({ target: { value: "d" } });
    tree = render(QuestionWorkspace, workspaceProps(draft, vi.fn()));
    expect(correctAnswerSelect(tree).props.value).toBe("d");

    const regenerated = { ...draftWithCorrectB(), correctAnswer: "b" };
    render(QuestionWorkspace, workspaceProps(regenerated, vi.fn()));
    tree = render(QuestionWorkspace, workspaceProps(regenerated, vi.fn()));
    expect(correctAnswerSelect(tree).props.value).toBe("b");
  });

  it("ReviewStep reuses QuestionWorkspace with stable draft ids and onSave wired to onChange", () => {
    const onChange = vi.fn();
    const questions = [draftWithCorrectB(), { type: "essay", questionText: "اشرح." }];
    const props = {
      questions,
      onChange,
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
      onRegenerate: vi.fn(),
      onReorder: vi.fn(),
      onValidate: vi.fn(),
      validating: false,
    };

    const firstTree = render(ReviewStep, props);
    const firstWorkspaces = findAll(firstTree, (el) => el.type === QuestionWorkspace);
    expect(firstWorkspaces).toHaveLength(2);
    expect(firstWorkspaces[0].props.question.id).toBe("draft-0");
    expect(firstWorkspaces[0].props.question.correctAnswer).toBe("b");

    const secondTree = render(ReviewStep, props);
    const secondWorkspaces = findAll(secondTree, (el) => el.type === QuestionWorkspace);
    expect(secondWorkspaces[0].props.question).toBe(firstWorkspaces[0].props.question);

    firstWorkspaces[0].props.onSave("ignored-id", { correctAnswer: "c" });
    expect(onChange).toHaveBeenCalledWith(0, { correctAnswer: "c" });
  });

  it("assigns distinct local ids when duplicated drafts carry the same id", () => {
    const duplicated = { ...draftWithCorrectB(), id: "draft-1" };
    const tree = render(ReviewStep, {
      questions: [duplicated, { ...duplicated }],
      onChange: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
      onRegenerate: vi.fn(),
      onReorder: vi.fn(),
      onValidate: vi.fn(),
      validating: false,
    });
    const workspaces = findAll(tree, (el) => el.type === QuestionWorkspace);
    expect(workspaces.map((workspace) => workspace.props.question.id)).toEqual(["draft-1", "draft-1-1"]);
  });
});
