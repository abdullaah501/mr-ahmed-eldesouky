import { describe, it, expect, vi, beforeEach } from "vitest";

// Phase 3 — centralized access-token persistence.
// Verifies that checkUser() persists the refreshed access token itself
// (Route Handler / Server Action contexts) and degrades cleanly in Server
// Component renders, where Next.js forbids cookie mutation.

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  signJWT: vi.fn().mockResolvedValue("new.access.token.signed"),
  sessionFindOne: vi.fn(),
  sessionFindOneAndUpdate: vi.fn().mockResolvedValue({ _id: "ok" }),
  sessionUpdateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
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
    updateOne: (...a) => mocks.sessionUpdateOne(...a),
  },
}));
vi.mock("../../models/User", () => ({
  default: { findById: () => ({ select: () => ({ lean: (...a) => mocks.userFindById(...a) }) }) },
}));

import { cookies } from "next/headers";
import checkUser from "../../lib/checkUser";
import { persistNewAccessToken } from "../../lib/auth/persistAuth";
import { AUTH_COOKIES, ACCESS_TOKEN_COOKIE_MAX_AGE } from "../../lib/auth/config";

const VALID_OBJECT_ID = "507f1f77bcf86cd799439011";
const USER_OBJECT_ID = "507f1f77bcf86cd799439022";

// Writable cookie store (Route Handler / Server Action semantics)
function cookieStoreWith(setSpy) {
  cookies.mockResolvedValue({
    get: (name) => {
      if (name === "access_token") return { value: "expired.jwt" };
      if (name === "s-i") return { value: VALID_OBJECT_ID };
      return undefined;
    },
    set: setSpy,
  });
}

function seedRefreshSuccess() {
  mocks.sessionFindOne.mockResolvedValue({
    _id: VALID_OBJECT_ID, userId: USER_OBJECT_ID, isExp: false, expiredAt: null, refreshToken: "rt",
  });
  mocks.userFindById.mockResolvedValue({
    _id: USER_OBJECT_ID, role: "student", email: "u@e.com", grade: "g",
    image: {}, firstName: "F", lastName: "L", phone: "1", guardianPhone: "2",
    governorate: "G", tokenVersion: 1,
  });
  mocks.verifyJWT
    .mockRejectedValueOnce(new Error("access token expired"))
    .mockResolvedValueOnce({ _id: USER_OBJECT_ID, tokenVersion: 1 });
}

describe("Phase 3 — centralized token persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signJWT.mockResolvedValue("new.access.token.signed");
    mocks.sessionFindOneAndUpdate.mockResolvedValue({ _id: "ok" });
  });

  it("P1: refresh via checkUser persists the new access token with canonical opts", async () => {
    const setSpy = vi.fn();
    cookieStoreWith(setSpy);
    seedRefreshSuccess();

    const result = await checkUser();

    expect(result.success).toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(
      AUTH_COOKIES.access,
      "new.access.token.signed",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
      })
    );
  });

  it("P2: RSC render (cookies().set throws) — refresh still succeeds, no crash", async () => {
    cookies.mockResolvedValue({
      get: (name) => {
        if (name === "access_token") return { value: "expired.jwt" };
        if (name === "s-i") return { value: VALID_OBJECT_ID };
        return undefined;
      },
      set: vi.fn(() => {
        throw new Error("Cookies can only be modified in a Server Action or Route Handler");
      }),
    });
    seedRefreshSuccess();

    const result = await checkUser();

    expect(result.success).toBe(true);
    expect(result.newAccessToken).toBe("new.access.token.signed");
  });

  it("P3: valid access token (fast path) writes no cookies", async () => {
    const setSpy = vi.fn();
    cookieStoreWith(setSpy);
    mocks.verifyJWT.mockResolvedValue({ _id: USER_OBJECT_ID, role: "student" });

    const result = await checkUser();

    expect(result.success).toBe(true);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("P4: failed refresh writes no cookies", async () => {
    const setSpy = vi.fn();
    cookieStoreWith(setSpy);
    mocks.sessionFindOne.mockResolvedValue(null);
    mocks.verifyJWT.mockRejectedValue(new Error("expired"));

    const result = await checkUser();

    expect(result.success).toBe(false);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("P5: persistNewAccessToken is a no-op for falsy tokens", async () => {
    const setSpy = vi.fn();
    cookies.mockResolvedValue({ get: () => undefined, set: setSpy });

    expect(await persistNewAccessToken(null)).toBe(false);
    expect(await persistNewAccessToken(undefined)).toBe(false);
    expect(await persistNewAccessToken("")).toBe(false);
    expect(setSpy).not.toHaveBeenCalled();
  });
});
