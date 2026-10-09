import { describe, it, expect, vi, beforeEach } from "vitest";

const harness = vi.hoisted(() => ({
  boxes: [],
  cursor: 0,
  questionCardProps: null,
}));

vi.mock("react", () => ({
  useState: (init) => {
    const i = harness.cursor++;
    if (!harness.boxes[i]) {
      harness.boxes[i] = {
        value: typeof init === "function" ? init() : init,
      };
    }
    const box = harness.boxes[i];
    const set = (v) => {
      box.value = typeof v === "function" ? v(box.value) : v;
    };
    return [box.value, set];
  },
  useCallback: (fn) => fn,
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

vi.mock("react-icons/fa", () => ({ FaCheckCircle: () => null }));
vi.mock("react-icons/fi", () => ({
  FiUser: () => null,
  FiMail: () => null,
  FiAward: () => null,
}));
vi.mock("../../src/app/components/essays/QuestionCard", () => ({
  default: (props) => {
    harness.questionCardProps = props;
    return null;
  },
}));
vi.mock("@/app/actions/examActions", () => ({
  updateSubmission: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import EssayCard from "../../src/app/components/essays/EssayCard";

function collectText(node, out = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, out));
    return out;
  }
  if (node && typeof node === "object") {
    if (typeof node.type === "function") {
      collectText(node.type(node.props), out);
      return out;
    }
    const children = node.props?.children;
    if (children !== undefined && children !== null) collectText(children, out);
  } else if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
  }
  return out;
}

function resetHarness() {
  harness.boxes = [];
  harness.cursor = 0;
  harness.questionCardProps = null;
}

function renderCard(essay) {
  harness.cursor = 0;
  return collectText(
    EssayCard({ essay, queryClient: {}, currentPage: 1 })
  ).join(" ");
}

beforeEach(() => {
  resetHarness();
});

const baseEssay = {
  _id: "essay1",
  submissionId: "sub1",
  userId: {
    firstName: "Ahmed",
    lastName: "Mohamed",
    email: "ahmed@example.com",
  },
  examTitle: "Algebra Midterm",
  gradeName: "Grade 7",
};

describe("EssayCard — grading context display (target domain)", () => {
  it("renders student, exam and grade for a single essay answer", () => {
    const text = renderCard({
      ...baseEssay,
      essays: [{ _id: "a1", questionId: "q1", question: "Q1", answer: "A1" }],
    });

    expect(text).toContain("Ahmed");
    expect(text).toContain("Mohamed");
    expect(text).toContain("ahmed@example.com");
    expect(text).toContain("Algebra Midterm");
    expect(text).toContain("Grade 7");
  });

  it("hides the exam/grade block when both fields are missing, keeping student info", () => {
    const text = renderCard({
      _id: "essay2",
      submissionId: "sub2",
      userId: { firstName: "Sara", lastName: "Ali", email: "sara@example.com" },
      essays: [{ _id: "a1", questionId: "q1", question: "Q1", answer: "A1" }],
    });

    expect(text).toContain("Sara");
    expect(text).toContain("sara@example.com");
    expect(text).not.toContain("Exam:");
    expect(text).not.toContain("Grade:");
  });
});

describe("EssayCard — per-question grading state (handleCount)", () => {
  const gradingEssay = {
    ...baseEssay,
    essays: [
      { _id: "a1", questionId: "q1", question: "Q1", answer: "A1" },
      { _id: "a2", questionId: "q2", question: "Q2", answer: "A2" },
    ],
  };

  function renderGradingCard() {
    renderCard(gradingEssay);
  }

  function grade(type, id) {
    harness.questionCardProps.handleCount(type, id);
  }

  function gradingState() {
    return harness.boxes[0].value;
  }

  it("A: Q1 Correct + Q2 Correct persists both", () => {
    renderGradingCard();
    grade("correct", "a1");
    grade("correct", "a2");

    expect(gradingState().correct).toEqual(["a1", "a2"]);
    expect(gradingState().wrong).toEqual([]);
    expect(renderCard(gradingEssay)).toContain("2 / 2");
  });

  it("B: Q1 Correct, Q2 Correct, Q1 Incorrect moves only Q1", () => {
    renderGradingCard();
    grade("correct", "a1");
    grade("correct", "a2");
    grade("wrong", "a1");

    expect(gradingState().correct).toEqual(["a2"]);
    expect(gradingState().wrong).toEqual(["a1"]);
  });

  it("C: alternating questions keep independent state", () => {
    renderGradingCard();
    grade("correct", "a1");
    grade("wrong", "a2");
    grade("wrong", "a1");
    grade("correct", "a2");

    expect(gradingState().correct).toEqual(["a2"]);
    expect(gradingState().wrong).toEqual(["a1"]);
  });

  it("D: same button twice is a no-op without duplicates", () => {
    renderGradingCard();
    grade("correct", "a1");
    grade("correct", "a1");

    expect(gradingState().correct).toEqual(["a1"]);
  });

  it("E: consecutive wrongs across questions all persist without duplicates", () => {
    renderGradingCard();
    grade("wrong", "a1");
    grade("wrong", "a2");
    grade("wrong", "a1");

    expect(gradingState().wrong).toEqual(["a1", "a2"]);
    expect(gradingState().correct).toEqual([]);
  });

  it("F: rapid toggling ends in the last status", () => {
    renderGradingCard();
    grade("correct", "a1");
    grade("wrong", "a1");
    grade("correct", "a1");
    grade("wrong", "a1");

    expect(gradingState().correct).toEqual([]);
    expect(gradingState().wrong).toEqual(["a1"]);
  });
});
