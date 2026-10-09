import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

// Documents the root cause of "Admin remains visible after Student login".
// Mirrors hooks/useUser.js exactly: queryKey ["user"], initialData,
// enabled: !initialUser, refetchOnMount: initialUser ? false : true.
// The QueryClient is created once for the whole SPA lifetime
// (lib/QueryProvider.js), so the ["user"] cache entry survives logout/login
// and layout remounts — exactly like the real app.

const ADMIN = { _id: "admin1", role: "admin", firstName: "Admin" };
const STUDENT = { _id: "student1", role: "student", firstName: "Student" };

function makeObserver(queryClient, initialUser) {
  return new QueryObserver(queryClient, {
    queryKey: ["user"],
    queryFn: async () => {
      throw new Error("queryFn must never run — query is disabled when initialUser is present");
    },
    initialData: initialUser,
    enabled: !initialUser,
    refetchOnMount: initialUser ? false : true,
    retry: 4,
  });
}

describe("client identity — React Query [user] cache baseline", () => {
  it("CI1: BUG — cached previous user wins over new initialData (stale Admin after Student login)", async () => {
    const queryClient = new QueryClient();

    // Tab session 1: ClientWrapper mounts with initialData = ADMIN
    const first = makeObserver(queryClient, ADMIN);
    expect(first.getCurrentResult().data).toEqual(ADMIN);
    first.destroy();

    // Logout happens (Zustand cleared) but the global QueryClient cache
    // still holds ADMIN — nothing removes it.
    expect(queryClient.getQueryData(["user"])).toEqual(ADMIN);

    // Tab session 2: ClientWrapper remounts with initialData = STUDENT
    const second = makeObserver(queryClient, STUDENT);

    // The disabled query IGNORES the new initialData and serves the stale
    // cached ADMIN — the exact mechanism of the reported bug.
    expect(second.getCurrentResult().data).toEqual(ADMIN);
    expect(second.getCurrentResult().data).not.toEqual(STUDENT);
    second.destroy();
  });

  it("CI2: hard refresh simulation — fresh QueryClient seeds correctly from initialData", async () => {
    const freshClient = new QueryClient();
    const observer = makeObserver(freshClient, STUDENT);
    expect(observer.getCurrentResult().data).toEqual(STUDENT);
    observer.destroy();
  });

  it("CI3: invalidateQueries alone does NOT fix a disabled query — data stays stale", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user"], ADMIN);

    const observer = makeObserver(queryClient, STUDENT);
    expect(observer.getCurrentResult().data).toEqual(ADMIN);

    await queryClient.invalidateQueries({ queryKey: ["user"] });
    await Promise.resolve();

    // Still the stale admin: invalidation marks it stale but the disabled
    // query never refetches.
    expect(observer.getCurrentResult().data).toEqual(ADMIN);
    observer.destroy();
  });

  it("CI4: removeQueries fixes it — new mount seeds from fresh initialData (invalidateAuth mechanism)", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user"], ADMIN);

    await queryClient.removeQueries({ queryKey: ["user"] });
    expect(queryClient.getQueryData(["user"])).toBeUndefined();

    const observer = makeObserver(queryClient, STUDENT);
    expect(observer.getCurrentResult().data).toEqual(STUDENT);
    observer.destroy();
  });
});
