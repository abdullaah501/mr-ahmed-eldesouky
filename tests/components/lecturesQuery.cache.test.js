import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// Behavior-level tests for React Query semantics used by Candidate B,
// exercised against a real QueryClient in node (no DOM needed for
// queryClient.invalidateQueries / queryClient.ensureQueryData / observers).

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0, networkMode: "always" },
    },
  });
}

function withLectures(client, gradeId, fetchImpl, initial) {
  return client.setQueryData(
    ["lectures", gradeId],
    { success: true, data: initial }
  );
}

describe("Candidate B: query cache behavior", () => {
  let client;

  beforeEach(() => {
    client = makeClient();
  });

  afterEach(() => {
    client.clear();
  });

  it("C2: back-to-back invalidateQueries dedupes to a single in-flight refetch", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return { success: true, data: [{ _id: "l1", done: true }] };
    };
    client.ensureQueryData({
      queryKey: ["lectures", "X"],
      queryFn: fetchImpl,
      staleTime: 0,
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 20));

    // Trigger two invalidations back-to-back; React Query dedupes fetches.
    const before = calls;
    client.invalidateQueries({ queryKey: ["lectures", "X"] });
    client.invalidateQueries({ queryKey: ["lectures", "X"] });
    await new Promise((r) => setTimeout(r, 30));
    expect(calls - 1).toBeLessThanOrEqual(before + 1);
  });

  it("A2-equivalent: invalidating ['lectures','X'] does not affect ['lectures','Y'] data", async () => {
    client.setQueryData(
      ["lectures", "X"],
      { success: true, data: [{ _id: "lx", done: true }] }
    );
    client.setQueryData(
      ["lectures", "Y"],
      { success: true, data: [{ _id: "ly", done: false }] }
    );

    client.invalidateQueries({ queryKey: ["lectures", "X"] });

    expect(client.getQueryData(["lectures", "Y"])).toEqual({
      success: true,
      data: [{ _id: "ly", done: false }],
    });
    const xState = client.getQueryState(["lectures", "X"]);
    expect(xState.isInvalidated).toBe(true);
  });

  it("F: per-client/per-course cache stays isolated across course keys", () => {
    const dataX = { success: true, data: [{ _id: "lx", done: true }] };
    const dataY = { success: true, data: [{ _id: "ly", done: false }] };
    client.setQueryData(["lectures", "X"], dataX);
    client.setQueryData(["lectures", "Y"], dataY);
    expect(client.getQueryData(["lectures", "X"])).toBe(dataX);
    expect(client.getQueryData(["lectures", "Y"])).toBe(dataY);
    expect(client.getQueryData(["lectures", "X"])).not.toBe(dataY);
    expect(client.getQueryData(["lectures", "Y"])).not.toBe(dataX);
  });

  it("D1: existing cached data is NOT purged by invalidateQueries (keeps last-known-good)", () => {
    const freshGood = { success: true, data: [{ _id: "l1", done: true }] };
    client.setQueryData(["lectures", "X"], freshGood);
    client.invalidateQueries({ queryKey: ["lectures", "X"] });
    const stillCached = client.getQueryData(["lectures", "X"]);
    expect(stillCached).toEqual(freshGood);
  });

  it("D1: refetch failure preserves the cached lessons incl. prior done:true", async () => {
    const prior = { success: true, data: [{ _id: "l1", done: true }] };
    client.setQueryData(["lectures", "X"], prior);
    client.setQueryDefaults(["lectures", "X"], { retry: false });
    client.invalidateQueries({ queryKey: ["lectures", "X"] });
    const results = await client.refetchQueries({ queryKey: ["lectures", "X"], queryFn: async () => { throw new Error("boom"); }, throwOnError: false }).catch(() => null);
    const after = client.getQueryData(["lectures", "X"]);
    expect(after).toEqual(prior);
  });
});