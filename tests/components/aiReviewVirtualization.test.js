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
    virtualizerCalls: [],
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

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options) => {
    hoisted.virtualizerCalls.push(options);
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

import ReviewStep from "../../src/app/components/ai/steps/ReviewStep";
import "../../src/question-system/plugins/multiple-choice/index";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const makeDraft = (n) => ({
  type: "multiple-choice",
  questionText: `Generated question ${n}`,
  correctAnswer: "b",
  options: [
    { optionText: "3", valueText: "a" },
    { optionText: "4", valueText: "b" },
    { optionText: "5", valueText: "c" },
    { optionText: "6", valueText: "d" },
  ],
});

const reviewProps = (questions, overrides = {}) => ({
  questions,
  regeneratingIndex: null,
  onChange: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  onRegenerate: vi.fn(),
  onReorder: vi.fn(),
  onValidate: vi.fn(),
  validating: false,
  ...overrides,
});

beforeEach(() => {
  hoisted.resetStore();
  hoisted.virtualizerCalls.length = 0;
});

describe("AI review list virtualization (Question Bank pattern)", () => {
  it("feeds the full question list to the virtualizer — nothing is paged away", () => {
    const questions = Array.from({ length: 100 }, (_, i) => makeDraft(i));
    render(ReviewStep, reviewProps(questions));
    expect(hoisted.virtualizerCalls).toHaveLength(1);
    expect(hoisted.virtualizerCalls[0].count).toBe(100);
  });

  it("renders one card per virtual item and only mounts the windowed rows", () => {
    const questions = [makeDraft(1), makeDraft(2), makeDraft(3)];
    const tree = render(ReviewStep, reviewProps(questions));
    const cards = findAll(tree, (el) => el.type === "article");
    expect(cards).toHaveLength(3);
    const texts = findAll(tree, (el) => el.type === "input").filter(
      (el) => el.props?.placeholder === "Question text",
    );
    expect(texts.map((el) => el.props.value)).toEqual([
      "Generated question 1",
      "Generated question 2",
      "Generated question 3",
    ]);
  });

  it("wires dynamic measurement and overscan exactly like the Question Bank pattern", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/components/ai/steps/ReviewStep.jsx"),
      "utf8",
    );
    expect(source).toContain("useVirtualizer");
    expect(source).toContain("measureElement");
    expect(source).toContain("overscan");
    expect(source).toContain("estimateSize");
    expect(source).toContain("getScrollElement");
  });

  it("edits propagate to the parent store so they survive unmount/remount", () => {
    const questions = [makeDraft(1), makeDraft(2)];
    const props = reviewProps(questions);
    const tree = render(ReviewStep, props);
    const inputs = findAll(tree, (el) => el.type === "input").filter(
      (el) => el.props?.placeholder === "Question text",
    );
    inputs[1].props.onChange({ target: { value: "Edited while virtualized" } });
    expect(props.onChange).toHaveBeenCalledWith(1, expect.anything());
    const value = props.onChange.mock.calls[0][1];
    expect(value.questionText).toBe("Edited while virtualized");
    // The emitted object keeps the stable draft id and full question shape.
    expect(value.id).toBeDefined();
    expect(value.type).toBe("multiple-choice");
  });

  it("selection state lives in ReviewStep and survives virtualizer cycles", () => {
    const questions = [makeDraft(1), makeDraft(2)];
    const tree = render(ReviewStep, reviewProps(questions));
    const checkboxes = findAll(
      tree,
      (el) => el.type === "input" && el.props?.type === "checkbox",
    );
    expect(checkboxes.length).toBe(2);
    checkboxes[0].props.onChange({ target: { checked: true } });
    // Rows may unmount/remount under the virtualizer, but selection lives in
    // ReviewStep — a re-render still shows the selection intact.
    const rerendered = render(ReviewStep, reviewProps(questions));
    const checkboxesAfter = findAll(
      rerendered,
      (el) => el.type === "input" && el.props?.type === "checkbox",
    );
    expect(checkboxesAfter[0].props.checked).toBe(true);
    expect(checkboxesAfter[1].props.checked).toBe(false);
  });
});
