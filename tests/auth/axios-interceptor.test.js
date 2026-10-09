import { describe, it, expect, vi, beforeEach } from "vitest";

// Single-flight refresh coordinator test (Phase 2).
// lib/axios/axios.js creates two axios instances at import time (`api` and
// `refreshAxios`). We mock the axios module so each created instance is a
// callable vi.fn (the retry path calls `api(original)` directly) with captured
// interceptor registrations, then drive the RESPONSE ERROR handler the way
// axios would on 401s.

const h = vi.hoisted(() => {
  const instances = [];
  const responseUse = vi.fn();
  return {
    instances,
    responseUse,
    createInstance() {
      const fn = vi.fn(() => Promise.resolve({ status: 200, data: "retried" }));
      fn.interceptors = {
        request: { use: vi.fn() },
        response: { use: responseUse },
      };
      fn.get = vi.fn();
      instances.push(fn);
      return fn;
    },
  };
});

vi.mock("axios", () => ({
  default: { create: () => h.createInstance() },
  create: () => h.createInstance(),
}));

const { api, refreshAxios } = await import("../../lib/axios/axios");

const errorHandler = h.responseUse.mock.calls[0][1];

function make401(url) {
  return {
    config: { url, method: "get", headers: {}, _retry: false },
    response: { status: 401, data: {} },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("axios interceptor — single-flight refresh (Phase 2)", () => {
  it("AX1: 20 concurrent 401s produce exactly ONE refresh call; all 20 retry", async () => {
    refreshAxios.get.mockResolvedValue({ status: 200, data: { newAccessToken: "t" } });

    const settled = Array.from({ length: 20 }, (_, i) =>
      errorHandler(make401(`/api/thing/${i}`)).catch(() => "rejected")
    );
    await Promise.all(settled);

    expect(refreshAxios.get).toHaveBeenCalledTimes(1);
    expect(refreshAxios.get).toHaveBeenCalledWith(
      "/api/auth/refresh",
      expect.objectContaining({ headers: expect.objectContaining({ "x-request-id": expect.any(String) }) })
    );
    expect(api).toHaveBeenCalledTimes(20);
  });

  it("AX2: refresh failure rejects every pending request; no retries dispatched", async () => {
    refreshAxios.get.mockRejectedValue(new Error("refresh 401"));

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => errorHandler(make401(`/api/x/${i}`)))
    );

    expect(refreshAxios.get).toHaveBeenCalledTimes(1);
    expect(api).not.toHaveBeenCalled();
    expect(results.every((r) => r.status === "rejected")).toBe(true);
  });

  it("AX3: a 401 arriving AFTER the refresh settles starts a NEW refresh (no stuck state)", async () => {
    refreshAxios.get.mockResolvedValue({ status: 200, data: {} });

    await errorHandler(make401("/api/first")).catch(() => {});
    expect(refreshAxios.get).toHaveBeenCalledTimes(1);

    await errorHandler(make401("/api/second")).catch(() => {});
    expect(refreshAxios.get).toHaveBeenCalledTimes(2);
  });

  it("AX4: non-401 errors pass through without triggering refresh", async () => {
    const error = { config: { url: "/api/x", headers: {}, _retry: false }, response: { status: 500 } };

    await expect(errorHandler(error)).rejects.toBe(error);
    expect(refreshAxios.get).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it("AX5: already-retried request (_retry=true) never refreshes again (no retry loop)", async () => {
    const error = {
      config: { url: "/api/x", headers: {}, _retry: true },
      response: { status: 401 },
    };

    await expect(errorHandler(error)).rejects.toBe(error);
    expect(refreshAxios.get).not.toHaveBeenCalled();
  });
});
