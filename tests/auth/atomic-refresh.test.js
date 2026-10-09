import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  signJWT: vi.fn().mockResolvedValue("tok"),
  sessionFindOne: vi.fn(),
  sessionFindOneAndUpdate: vi.fn().mockResolvedValue({ _id: "ok" }),
  userFindById: vi.fn(),
  connectToDb: vi.fn().mockResolvedValue(true),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("../../lib/jwt", () => ({ verifyJWT: (...a) => mocks.verifyJWT(...a), signJWT: (...a) => mocks.signJWT(...a) }));
vi.mock("../../lib/connectToDb", () => ({ default: (...a) => mocks.connectToDb(...a) }));
vi.mock("../../models/Session", () => ({
  default: {
    findOne: () => ({ select: () => ({ lean: (...a) => mocks.sessionFindOne(...a) }) }),
    findOneAndUpdate: (...a) => mocks.sessionFindOneAndUpdate(...a),
  },
}));
vi.mock("../../models/User", () => ({
  default: { findById: () => ({ select: () => ({ lean: (...a) => mocks.userFindById(...a) }) }) },
}));

import { refreshAuth } from "../../lib/refreshAuth";

const OID = "507f1f77bcf86cd799439011";

describe("atomic refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionFindOneAndUpdate.mockResolvedValue({ _id: "ok" });
    mocks.sessionFindOne.mockResolvedValue({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt" });
    mocks.userFindById.mockResolvedValue({ _id: "u1", role: "student", email: "u@e.com", grade: "g", image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2", governorate: "G", tokenVersion: 1 });
    mocks.verifyJWT.mockResolvedValue({ _id: "u1", tokenVersion: 1 });
  });

  it("A1: if signJWT fails after CAS, next refresh still succeeds", async () => {
    mocks.signJWT
      .mockResolvedValueOnce("new.rt")
      .mockRejectedValueOnce(new Error("sign failed"));

    const result = await refreshAuth(OID);
    expect(result.success).toBe(false);

    mocks.sessionFindOne.mockReset();
    mocks.sessionFindOne.mockResolvedValue({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "new.rt" });
    mocks.signJWT.mockClear();
    mocks.signJWT.mockResolvedValue("tok");

    const retry = await refreshAuth(OID);
    expect(retry.success).toBe(true);
  });
});
