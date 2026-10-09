import { describe, it, expect, vi, beforeEach } from "vitest";

const setup = vi.hoisted(() => {
  const ROOT = "D:/projects/edu-mr-talaat";
  const mocks = {
    checkUser: vi.fn(),
    cookiesGet: vi.fn(),
    findOneAndUpdate: vi.fn(),
    sessionUpdateOne: vi.fn(),
    bcryptHash: vi.fn().mockResolvedValue("hashed.pw"),
    gradeFindById: vi.fn(),
  };
  return { mocks, ROOT };
});

vi.mock("server-only", () => ({}));
vi.mock(`${setup.ROOT}/lib/checkUser.js`, () => ({ default: (...args) => setup.mocks.checkUser(...args) }));
vi.mock("next/server", () => ({ NextResponse: { json: (d, i = {}) => ({ _data: d, status: i.status || 200 }) } }));
vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue({ get: (...a) => setup.mocks.cookiesGet(...a), set: vi.fn() }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock(`${setup.ROOT}/models/Session.js`, () => ({ default: { updateOne: (...args) => setup.mocks.sessionUpdateOne(...args) } }));
vi.mock(`${setup.ROOT}/lib/jwt.js`, () => ({ signJWT: vi.fn().mockResolvedValue("signed.token"), verifyJWT: vi.fn() }));
vi.mock(`${setup.ROOT}/lib/mongoClient.js`, () => ({ default: Promise.resolve({ db: () => ({ collection: () => ({ findOneAndUpdate: (...a) => setup.mocks.findOneAndUpdate(...a) }) }) }) }));
vi.mock(`${setup.ROOT}/lib/deleteFromStorage.js`, () => ({ deleteFromStorage: vi.fn(), deleteMultipleFromStorage: vi.fn() }));
vi.mock(`${setup.ROOT}/lib/connectToDb.js`, () => ({ default: vi.fn() }));
vi.mock(`${setup.ROOT}/models/Grade.js`, () => ({ default: { findById: (...a) => setup.mocks.gradeFindById(...a) } }));
vi.mock(`${setup.ROOT}/models/Exam.js`, () => ({ default: {} }));
vi.mock(`${setup.ROOT}/models/Submission.js`, () => ({ default: {} }));
vi.mock(`${setup.ROOT}/models/Essay.js`, () => ({ default: {} }));
vi.mock(`${setup.ROOT}/models/User.js`, () => ({ default: { find: vi.fn(() => ({ select: vi.fn(() => ({ lean: vi.fn(async () => []) })) })) } }));
vi.mock("bcryptjs", () => ({ default: { hash: (...a) => setup.mocks.bcryptHash(...a) }, hash: (...a) => setup.mocks.bcryptHash(...a) }));
vi.mock("hashids", () => ({ default: function () { return { encode: () => "1", decode: () => 1 }; } }));

const { updateUserData } = await import("../../src/app/actions/userActions");
const { mocks } = setup;

function setCaller({ role = "student", _id = "u1", email = "u@example.com" } = {}) {
  mocks.checkUser.mockResolvedValue({ success: true, user: { role, _id, email } });
  mocks.cookiesGet.mockReturnValue(undefined);
  mocks.findOneAndUpdate.mockResolvedValue({ _id: "target", role, email });
  mocks.sessionUpdateOne.mockResolvedValue({ modifiedCount: 1 });
}

describe("updateUserData — privilege-escalation defense (allow-list)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("U1: student submitting role:'admin' — role is stripped, NOT persisted", async () => {
    setCaller({ role: "student" });
    const res = await updateUserData("target@example.com", { role: "admin", firstName: "New" });
    expect(res.success).toBe(true);
    expect(mocks.findOneAndUpdate).toHaveBeenCalled();
    const setArg = mocks.findOneAndUpdate.mock.calls[0][1].$set;
    expect(setArg).not.toHaveProperty("role");
    expect(setArg.firstName).toBe("New");
  });

  it("U2: assistant submitting role:'admin' + firstName — role is stripped, firstName persists", async () => {
    setCaller({ role: "assistant" });
    const res = await updateUserData("target@example.com", { role: "admin", firstName: "New" });
    expect(res.success).toBe(true);
    const setArg = mocks.findOneAndUpdate.mock.calls[0][1].$set;
    expect(setArg).not.toHaveProperty("role");
    expect(setArg.firstName).toBe("New");
  });

  it("U3: admin submitting role:'student' on a user — role IS persisted", async () => {
    setCaller({ role: "admin" });
    const res = await updateUserData("target@example.com", { role: "student" });
    expect(res.success).toBe(true);
    const setArg = mocks.findOneAndUpdate.mock.calls[0][1].$set;
    expect(setArg.role).toBe("student");
  });

  it("U4: unknown field isSuperuser:true silently dropped", async () => {
    setCaller({ role: "student" });
    const res = await updateUserData("target@example.com", { isSuperuser: true, firstName: "X" });
    expect(res.success).toBe(true);
    const setArg = mocks.findOneAndUpdate.mock.calls[0][1].$set;
    expect(setArg).not.toHaveProperty("isSuperuser");
    expect(setArg.firstName).toBe("X");
  });

  it("U5: normal profile update by student succeeds (firstName + image)", async () => {
    setCaller({ role: "student" });
    const res = await updateUserData("target@example.com", { firstName: "NewName", image: { url: "u", cloudId: "c" } });
    expect(res.success).toBe(true);
    const setArg = mocks.findOneAndUpdate.mock.calls[0][1].$set;
    expect(setArg.firstName).toBe("NewName");
    expect(setArg.image).toEqual({ url: "u", cloudId: "c" });
    expect(Object.keys(setArg).sort()).toEqual(["firstName", "image"]);
  });

  it("U7: profile update targets the SESSION user, never a client-supplied email", async () => {
    setCaller({ role: "student", email: "me@example.com" });
    const res = await updateUserData("victim@example.com", { firstName: "Hijack" });
    expect(res.success).toBe(true);
    const filter = mocks.findOneAndUpdate.mock.calls[0][0];
    expect(filter).toEqual({ email: "me@example.com" });
  });

  it("U8: gradeId update validates the Grade and synchronizes the display string", async () => {
    setCaller({ role: "student" });
    mocks.gradeFindById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "الصف الأول الثانوي", active: true }),
    });
    const res = await updateUserData("me@example.com", { gradeId: "aaaaaaaaaaaaaaaaaaaaaaaa" });
    expect(res.success).toBe(true);
    const setArg = mocks.findOneAndUpdate.mock.calls[0][1].$set;
    expect(String(setArg.gradeId)).toBe("aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(setArg.grade).toBe("الصف الأول الثانوي");
  });

  it("U9: inactive/missing gradeId is rejected and nothing is persisted", async () => {
    setCaller({ role: "student" });
    mocks.gradeFindById.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Grade A", active: false }),
    });
    const res = await updateUserData("me@example.com", { gradeId: "aaaaaaaaaaaaaaaaaaaaaaaa" });
    expect(res.success).toBe(false);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("U10: malformed gradeId is rejected before any DB hit", async () => {
    setCaller({ role: "student" });
    const res = await updateUserData("me@example.com", { gradeId: "not-an-id" });
    expect(res.success).toBe(false);
    expect(mocks.gradeFindById).not.toHaveBeenCalled();
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("U6: session refresh-token rotation records predecessor fields (grace-window compatible)", async () => {
    setCaller({ role: "student" });
    const res = await updateUserData("target@example.com", { firstName: "New" });

    expect(res.success).toBe(true);
    const [filter, update] = mocks.sessionUpdateOne.mock.calls[0];
    expect(filter).toEqual({ _id: undefined, userId: "target" });
    expect(Array.isArray(update)).toBe(true);

    const $set = update[0].$set;
    expect($set.previousRefreshToken).toBe("$refreshToken");
    expect($set.previousRefreshTokenExpiresAt).toEqual(expect.any(Date));
    expect($set.refreshToken).toBe("signed.token");

    // Phase 4: the rotation slides the session lifetime forward so a
    // profile update does not shorten an active session.
    expect($set.expiresAt).toEqual(expect.any(Date));
    const eaMs = $set.expiresAt.getTime();
    expect(eaMs).toBeGreaterThan(Date.now() + 1000);
  });
});
