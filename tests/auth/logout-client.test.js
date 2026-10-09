import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { useUserStore } from "../../stores/user";

const mockPost = vi.fn();

vi.mock("axios", () => ({
  default: { post: (...a) => mockPost(...a) },
}));

const { performClientLogout } = await import("../../lib/auth/clientSync");

const USER = { _id: "u1", role: "student", firstName: "S" };

function makeRouter() {
  return { refresh: vi.fn(), push: vi.fn() };
}

describe("performClientLogout — single client logout pipeline (Phase 6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({ user: USER });
  });

  it("LO1: success — POST, then invalidate, then refresh, then navigate home", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user"], USER);
    const router = makeRouter();
    mockPost.mockResolvedValue({ data: { success: true, message: "تم تسجيل الخروج" } });

    const res = await performClientLogout({ router, queryClient });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith("/api/auth/logout");
    expect(res?.data?.success).toBe(true);

    expect(queryClient.getQueryData(["user"])).toBeUndefined();
    expect(useUserStore.getState().user).toBeNull();

    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/");

    // Pipeline order: server revocation precedes navigation.
    expect(router.push.mock.invocationCallOrder[0]).toBeGreaterThan(mockPost.mock.invocationCallOrder[0]);
  });

  it("LO2: network failure — still invalidates and navigates (no stranded authenticated UI)", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user"], USER);
    const router = makeRouter();
    mockPost.mockRejectedValue(new Error("network down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await performClientLogout({ router, queryClient });

    expect(res).toBeNull();
    expect(queryClient.getQueryData(["user"])).toBeUndefined();
    expect(useUserStore.getState().user).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/");
    consoleSpy.mockRestore();
  });

  it("LO3: SSE path — redirectTo=/login is honored (useIsNewDevice wiring)", async () => {
    const router = makeRouter();
    mockPost.mockResolvedValue({ data: { success: true } });

    await performClientLogout({ router, queryClient: new QueryClient(), redirectTo: "/login" });

    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("LO4: falls back to the registered QueryClient when none is passed", async () => {
    const registered = new QueryClient();
    registered.setQueryData(["user"], USER);
    const { registerAuthQueryClient } = await import("../../lib/auth/clientSync");
    registerAuthQueryClient(registered);

    await performClientLogout({ router: makeRouter() });

    expect(registered.getQueryData(["user"])).toBeUndefined();
    expect(useUserStore.getState().user).toBeNull();
  });
});
