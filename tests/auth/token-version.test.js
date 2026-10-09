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

describe("token version", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionFindOneAndUpdate.mockResolvedValue({ _id: "ok" });
    mocks.sessionFindOne.mockResolvedValue({ _id: "s1", userId: "u1", isExp: false, expiredAt: null, refreshToken: "rt" });
  });

  function dbUser(v) {
    mocks.userFindById.mockResolvedValue({ _id: "u1", role: "student", email: "u@e.com", grade: "g", image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2", governorate: "G", tokenVersion: v });
  }

  it("V1: matching tokenVersion succeeds", async () => {
    dbUser(1);
    mocks.verifyJWT.mockResolvedValue({ _id: "u1", tokenVersion: 1 });
    const result = await refreshAuth(OID);
    expect(result.success).toBe(true);
  });

  it("V2: mismatched tokenVersion fails", async () => {
    dbUser(2);
    mocks.verifyJWT.mockResolvedValue({ _id: "u1", tokenVersion: 1 });
    const result = await refreshAuth(OID);
    expect(result.success).toBe(false);
  });

  it("V3: missing tokenVersion in JWT defaults to 1 and matches DB default", async () => {
    dbUser(1);
    mocks.verifyJWT.mockResolvedValue({ _id: "u1" });
    const result = await refreshAuth(OID);
    expect(result.success).toBe(true);
  });

  it("V4: missing tokenVersion in DB defaults to 1 and matches JWT default", async () => {
    mocks.userFindById.mockResolvedValue({ _id: "u1", role: "student", email: "u@e.com", grade: "g", image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2", governorate: "G" });
    mocks.verifyJWT.mockResolvedValue({ _id: "u1", tokenVersion: 1 });
    const result = await refreshAuth(OID);
    expect(result.success).toBe(true);
  });
});
