import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSessionDeleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });
const mockIsValidObjectId = vi.fn().mockReturnValue(true);

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data) => {
      const headers = { _map: new Map(), set(n, v) { this._map.set(n, v); }, append(n, v) { this._map.set(n, v); } };
      return { _data: data, headers };
    },
  },
}));

vi.mock("cookie", () => ({ serialize: (n, v) => `${n}=${v}` }));
vi.mock("../../lib/services/sessionService", () => ({
  revokeSession: (...a) => mockSessionDeleteOne(...a),
}));

import { POST as logout } from "../../src/app/api/auth/logout/route";

function req(sid) {
  return { cookies: { get: (n) => (n === "s-i" && sid ? { value: sid } : undefined) } };
}

describe("logout after rotation", () => {
  beforeEach(() => { vi.clearAllMocks(); mockSessionDeleteOne.mockResolvedValue({ deletedCount: 1 }); });

  it("LO1: logout after rotation deletes the session by ID", async () => {
    await logout(req("507f1f77bcf86cd799439011"));
    expect(mockSessionDeleteOne).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
  });
});
