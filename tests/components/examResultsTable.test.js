import { describe, it, expect, vi } from "vitest";
import ExamResultsTable from "../../src/app/components/analytics/ExamResultsTable";

function findAll(node, pred, out = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, pred, out));
    return out;
  }
  if (node && typeof node === "object" && node.type && node.props) {
    if (pred(node)) out.push(node);
    if (typeof node.type === "function") {
      findAll(node.type(node.props), pred, out);
    }
    const children = node.props?.children;
    if (children !== undefined && children !== null) findAll(children, pred, out);
  }
  return out;
}

const ROW = {
  _id: "sub1",
  examId: "exam1",
  examTitle: "Algebra Quiz",
  gradeName: "Grade 10",
  score: { correct: 3, wrong: 1 },
  createdAt: "2026-01-01T10:00:00.000Z",
  isCompleted: true,
};

function render(props = {}) {
  return ExamResultsTable({
    examResults: [ROW],
    pagination: null,
    currentPage: 1,
    onPageChange: vi.fn(),
    ...props,
  });
}

describe("ExamResultsTable optional onExamResultClick", () => {
  it("is inert when no callback is supplied (no handlers, no cursor)", () => {
    const tree = render();

    const clickables = findAll(tree, (el) => Boolean(el.props?.onClick));
    expect(clickables).toHaveLength(0);
    expect(findAll(tree, (el) => el.props?.tabIndex !== undefined)).toHaveLength(0);

    const rows = findAll(tree, (el) => el.type === "tr");
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((row) => !String(row.props.className).includes("cursor-pointer"))
    ).toBe(true);
  });

  it("wires the desktop row and the mobile card when the callback is supplied", () => {
    const onExamResultClick = vi.fn();
    const tree = render({ onExamResultClick });

    const desktopRows = findAll(
      tree,
      (el) => el.type === "tr" && typeof el.props.onClick === "function"
    );
    const mobileCards = findAll(
      tree,
      (el) => el.type === "div" && typeof el.props.onClick === "function"
    );

    expect(desktopRows).toHaveLength(1);
    expect(mobileCards).toHaveLength(1);
    expect(desktopRows[0].props.className).toContain("cursor-pointer");
    expect(mobileCards[0].props.className).toContain("cursor-pointer");

    desktopRows[0].props.onClick();
    mobileCards[0].props.onClick();
    expect(onExamResultClick).toHaveBeenCalledTimes(2);
    expect(onExamResultClick).toHaveBeenCalledWith(ROW);
  });

  it("activates the row with Enter", () => {
    const onExamResultClick = vi.fn();
    const tree = render({ onExamResultClick });

    const row = findAll(
      tree,
      (el) => el.type === "tr" && typeof el.props.onKeyDown === "function"
    )[0];
    const preventDefault = vi.fn();
    row.props.onKeyDown({ key: "Enter", preventDefault });

    expect(onExamResultClick).toHaveBeenCalledWith(ROW);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("activates the mobile card with Space and ignores other keys", () => {
    const onExamResultClick = vi.fn();
    const tree = render({ onExamResultClick });

    const card = findAll(
      tree,
      (el) => el.type === "div" && typeof el.props.onKeyDown === "function"
    )[0];
    const preventDefault = vi.fn();

    card.props.onKeyDown({ key: "Tab", preventDefault });
    expect(onExamResultClick).not.toHaveBeenCalled();

    card.props.onKeyDown({ key: " ", preventDefault });
    expect(onExamResultClick).toHaveBeenCalledWith(ROW);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("keeps pagination behavior unchanged", () => {
    const onPageChange = vi.fn();
    const tree = render({
      pagination: { totalPages: 3, currentPage: 1, totalResults: 3, limit: 1 },
      currentPage: 1,
      onPageChange,
    });

    const nextButton = findAll(
      tree,
      (el) =>
        el.type === "button" &&
        JSON.stringify(el.props.children).includes("التالي")
    )[0];
    expect(nextButton).toBeTruthy();
    nextButton.props.onClick();
    expect(onPageChange).toHaveBeenCalledWith(2);

    const previousButton = findAll(
      tree,
      (el) =>
        el.type === "button" &&
        JSON.stringify(el.props.children).includes("السابق")
    )[0];
    expect(previousButton.props.disabled).toBe(true);
  });
});
