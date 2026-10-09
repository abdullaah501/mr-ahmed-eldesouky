import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => {
  class MockNextResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.headers = init.headers || {};
    }
    static json(data, init = {}) {
      return new MockNextResponse(data, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

vi.mock("../../lib/trace/index.js", () => ({
  withCaller: (_name, fn) => fn(),
  withTracePhase: (_phase, fn) => fn(),
  withHttpTrace: (_req, _name, fn) => fn(),
}));

const mockCheckUser = vi.fn();
vi.mock("../../lib/checkUser", () => ({
  default: (...args) => mockCheckUser(...args),
}));

const mockValidateOrigin = vi.fn();
vi.mock("../../lib/validateOrigin", () => ({
  validateOrigin: (...args) => mockValidateOrigin(...args),
}));

const mockCheckRouteRateLimit = vi.fn();
vi.mock("../../lib/routeRateLimit", () => ({
  checkRouteRateLimit: (...args) => mockCheckRouteRateLimit(...args),
}));

const mockResolveExportQuestions = vi.fn();
vi.mock("../../lib/repository/exportSelectionService", () => ({
  resolveExportQuestions: (...args) => mockResolveExportQuestions(...args),
}));

const mockExportQuestionsDocx = vi.fn();
vi.mock("../../lib/repository/exporters/docx", () => ({
  exportQuestionsDocx: (...args) => mockExportQuestionsDocx(...args),
}));

const { POST: exportRoute } = await import(
  "../../src/app/api/repository/export/docx/route"
);

const ADMIN = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", role: "admin" };
const STUDENT = { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", role: "student" };

function makeReq(body = {}) {
  return {
    json: async () => body,
    headers: { get: () => null },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateOrigin.mockReturnValue(null);
  mockCheckRouteRateLimit.mockResolvedValue(false);
  mockCheckUser.mockResolvedValue({ success: true, user: ADMIN });
  mockResolveExportQuestions.mockResolvedValue({
    success: true,
    questions: [{ _id: "q1" }],
    total: 1,
    includeAnswers: false,
  });
  mockExportQuestionsDocx.mockResolvedValue(Buffer.from("PK-docx"));
});

describe("POST /api/repository/export/docx", () => {
  it("rejects a cross-origin request before any other work", async () => {
    mockValidateOrigin.mockReturnValue({ status: 403 });

    const res = await exportRoute(makeReq());

    expect(res.status).toBe(403);
    expect(mockCheckRouteRateLimit).not.toHaveBeenCalled();
    expect(mockCheckUser).not.toHaveBeenCalled();
  });

  it("rate limits before authentication and before DB/DOCX work", async () => {
    mockCheckRouteRateLimit.mockResolvedValue(true);

    const res = await exportRoute(makeReq());

    expect(res.status).toBe(429);
    expect(mockCheckUser).not.toHaveBeenCalled();
    expect(mockResolveExportQuestions).not.toHaveBeenCalled();
    expect(mockExportQuestionsDocx).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mockCheckUser.mockResolvedValue({ success: false });

    const res = await exportRoute(makeReq());

    expect(res.status).toBe(401);
    expect(mockResolveExportQuestions).not.toHaveBeenCalled();
  });

  it("denies students", async () => {
    mockCheckUser.mockResolvedValue({ success: true, user: STUDENT });

    const res = await exportRoute(makeReq());

    expect(res.status).toBe(403);
    expect(mockResolveExportQuestions).not.toHaveBeenCalled();
  });

  it("rejects an unparsable body with 400", async () => {
    const res = await exportRoute({
      json: async () => {
        throw new Error("bad json");
      },
      headers: { get: () => null },
    });

    expect(res.status).toBe(400);
    expect(mockResolveExportQuestions).not.toHaveBeenCalled();
  });

  it("passes resolver failures through without generating a document", async () => {
    mockResolveExportQuestions.mockResolvedValue({
      success: false,
      status: 400,
      code: "EXPORT_LIMIT_EXCEEDED",
      message: "More than 1000 questions match",
    });

    const res = await exportRoute(makeReq({ mode: "allFiltered" }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("EXPORT_LIMIT_EXCEEDED");
    expect(mockExportQuestionsDocx).not.toHaveBeenCalled();
  });

  it("returns one binary DOCX response with no-store headers", async () => {
    const res = await exportRoute(
      makeReq({
        mode: "explicit",
        selectedIds: ["111111111111111111111111"],
        includeAnswers: true,
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers["Content-Type"]).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(res.headers["Content-Disposition"]).toBe(
      'attachment; filename="questions-export.docx"'
    );
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
    expect(res.body).toBeInstanceOf(Buffer);

    expect(mockResolveExportQuestions).toHaveBeenCalledTimes(1);
    expect(mockResolveExportQuestions.mock.calls[0][0].user).toBe(ADMIN);
    expect(mockExportQuestionsDocx).toHaveBeenCalledTimes(1);
    expect(mockExportQuestionsDocx).toHaveBeenCalledWith([{ _id: "q1" }], {
      includeAnswers: false,
    });
  });

  it("returns 500 when generation fails", async () => {
    mockExportQuestionsDocx.mockRejectedValue(new Error("packer failed"));

    const res = await exportRoute(makeReq({ mode: "allFiltered", filters: {} }));

    expect(res.status).toBe(500);
  });
});
