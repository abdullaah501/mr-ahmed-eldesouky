import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockFind = vi.fn();
const mockCountDocuments = vi.fn();
vi.mock("../../models/Question", () => ({
  default: {
    find: (...args) => mockFind(...args),
    countDocuments: (...args) => mockCountDocuments(...args),
  },
}));

const mockGetStaffedGradeNames = vi.fn();
vi.mock("../../lib/repository/staffScope", () => ({
  getStaffedGradeNames: (...args) => mockGetStaffedGradeNames(...args),
}));

import { resolveExportQuestions } from "../../lib/repository/exportSelectionService";

const ADMIN = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", role: "admin" };
const ASSISTANT = { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", role: "assistant" };
const A = "111111111111111111111111";
const B = "222222222222222222222222";

function makeId(n) {
  return n.toString(16).padStart(24, "0");
}

function findChain(docs) {
  const chain = {
    sort: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    lean: vi.fn(async () => docs),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetStaffedGradeNames.mockResolvedValue([]);
  mockCountDocuments.mockResolvedValue(0);
  mockFind.mockReturnValue(findChain([]));
});

describe("resolveExportQuestions — explicit mode", () => {
  it("queries authoritatively by id with the existing bank status filter", async () => {
    const docs = [{ _id: A, type: "multiple-choice", questionText: "q" }];
    mockFind.mockReturnValue(findChain(docs));

    const result = await resolveExportQuestions({
      user: ADMIN,
      request: { mode: "explicit", selectedIds: [A], includeAnswers: false },
    });

    expect(result.success).toBe(true);
    expect(result.questions).toEqual(docs);
    expect(mockFind).toHaveBeenCalledTimes(1);
    const filter = mockFind.mock.calls[0][0];
    expect(filter.status).toEqual({ $in: ["draft", "active"] });
    expect(String(filter._id.$in[0])).toBe(A);
    expect(mockCountDocuments).not.toHaveBeenCalled();
  });

  it("rejects more than 1000 selected ids before any DB query", async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => makeId(i + 1));

    const result = await resolveExportQuestions({
      user: ADMIN,
      request: { mode: "explicit", selectedIds: ids },
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe("EXPORT_LIMIT_EXCEEDED");
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("ignores malformed ids instead of trusting the client list", async () => {
    await resolveExportQuestions({
      user: ADMIN,
      request: { mode: "explicit", selectedIds: ["not-an-id", A, A] },
    });

    const filter = mockFind.mock.calls[0][0];
    expect(filter._id.$in).toHaveLength(1);
  });

  it("applies assistant scope to explicit ids", async () => {
    mockGetStaffedGradeNames.mockResolvedValue(["الصف الأول"]);

    await resolveExportQuestions({
      user: ASSISTANT,
      request: { mode: "explicit", selectedIds: [A] },
    });

    const filter = mockFind.mock.calls[0][0];
    expect(filter.grade).toEqual({ $in: ["الصف الأول"] });
  });
});

describe("resolveExportQuestions — allFiltered mode", () => {
  it("counts then loads one bounded query with the filter snapshot", async () => {
    mockCountDocuments.mockResolvedValue(2);
    const docs = [{ _id: A }, { _id: B }];
    mockFind.mockReturnValue(findChain(docs));

    const result = await resolveExportQuestions({
      user: ADMIN,
      request: {
        mode: "allFiltered",
        filters: { type: ["multiple-choice"], subject: ["math"] },
        excludedIds: [],
        includeAnswers: true,
      },
    });

    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
    expect(result.includeAnswers).toBe(true);
    const filter = mockCountDocuments.mock.calls[0][0];
    expect(filter.status).toEqual({ $in: ["draft", "active"] });
    expect(filter.type).toEqual({ $in: ["multiple-choice"] });
    expect(filter.subject).toEqual({ $in: ["math"] });
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind.mock.calls[0][0]).toEqual(filter);
  });

  it("rejects when the matching count exceeds 1000 without truncating", async () => {
    mockCountDocuments.mockResolvedValue(1001);

    const result = await resolveExportQuestions({
      user: ADMIN,
      request: { mode: "allFiltered", filters: {} },
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe("EXPORT_LIMIT_EXCEEDED");
    expect(result.message).toContain("narrow");
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("applies exclusions server-side as a bounded $nin", async () => {
    mockCountDocuments.mockResolvedValue(1);

    await resolveExportQuestions({
      user: ADMIN,
      request: {
        mode: "allFiltered",
        filters: {},
        excludedIds: [B, "bad-id"],
      },
    });

    const filter = mockCountDocuments.mock.calls[0][0];
    expect(filter._id.$nin).toHaveLength(1);
    expect(String(filter._id.$nin[0])).toBe(B);
  });

  it("rejects unbounded exclusion arrays", async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => makeId(i + 1));

    const result = await resolveExportQuestions({
      user: ADMIN,
      request: { mode: "allFiltered", filters: {}, excludedIds: ids },
    });

    expect(result.success).toBe(false);
    expect(mockCountDocuments).not.toHaveBeenCalled();
  });

  it("intersects the assistant scope with the requested grade filter", async () => {
    mockGetStaffedGradeNames.mockResolvedValue(["G1"]);
    mockCountDocuments.mockResolvedValue(0);

    await resolveExportQuestions({
      user: ASSISTANT,
      request: {
        mode: "allFiltered",
        filters: { grade: ["G1", "G2"] },
      },
    });

    const filter = mockCountDocuments.mock.calls[0][0];
    expect(filter.grade).toEqual({ $in: ["G1"] });
  });

  it("returns empty without touching Questions when the requested grade is out of scope", async () => {
    mockGetStaffedGradeNames.mockResolvedValue(["G1"]);

    const result = await resolveExportQuestions({
      user: ASSISTANT,
      request: { mode: "allFiltered", filters: { grade: ["G2"] } },
    });

    expect(result).toEqual({
      success: true,
      questions: [],
      total: 0,
      includeAnswers: false,
    });
    expect(mockCountDocuments).not.toHaveBeenCalled();
  });

  it("returns empty without touching Questions when the assistant has no staffed grades", async () => {
    mockGetStaffedGradeNames.mockResolvedValue([]);

    const result = await resolveExportQuestions({
      user: ASSISTANT,
      request: { mode: "allFiltered", filters: {} },
    });

    expect(result.questions).toEqual([]);
    expect(mockCountDocuments).not.toHaveBeenCalled();
    expect(mockFind).not.toHaveBeenCalled();
  });
});

describe("resolveExportQuestions — request hardening", () => {
  it("rejects an invalid mode", async () => {
    const result = await resolveExportQuestions({
      user: ADMIN,
      request: { mode: "everything" },
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it("treats includeAnswers strictly as === true", async () => {
    mockCountDocuments.mockResolvedValue(0);
    const result = await resolveExportQuestions({
      user: ADMIN,
      request: { mode: "allFiltered", filters: {}, includeAnswers: "yes" },
    });
    expect(result.includeAnswers).toBe(false);
  });

  it("ignores unknown filter keys and client-supplied Question documents", async () => {
    mockCountDocuments.mockResolvedValue(0);

    await resolveExportQuestions({
      user: ADMIN,
      request: {
        mode: "allFiltered",
        filters: { status: ["deleted"], createdBy: A },
        questions: [{ _id: A, questionText: "injected" }],
      },
    });

    const filter = mockCountDocuments.mock.calls[0][0];
    expect(filter.status).toEqual({ $in: ["draft", "active"] });
    expect(filter.createdBy).toBeUndefined();
  });
});
