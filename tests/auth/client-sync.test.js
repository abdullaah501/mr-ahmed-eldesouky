import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAuth, registerAuthQueryClient } from "../../lib/auth/clientSync";
import { QueryObserver } from "@tanstack/react-query";
import { useUserStore } from "../../stores/user";

const ADMIN = { _id: "admin1", role: "admin", firstName: "Admin" };

describe("client auth synchronization — invalidateAuth", () => {
  beforeEach(() => {
    useUserStore.setState({ user: ADMIN });
  });

  it("CS1: atomically removes the RQ user cache and clears Zustand", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user"], ADMIN);

    invalidateAuth(queryClient);

    expect(queryClient.getQueryData(["user"])).toBeUndefined();
    expect(useUserStore.getState().user).toBeNull();
  });

  it("CS2: the registered QueryClient is used when no argument is supplied", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user"], ADMIN);
    registerAuthQueryClient(queryClient);

    invalidateAuth();

    expect(queryClient.getQueryData(["user"])).toBeUndefined();
    expect(useUserStore.getState().user).toBeNull();
  });

  it("CS3: repeated invalidation is idempotent", () => {
    const queryClient = new QueryClient();

    invalidateAuth(queryClient);
    invalidateAuth(queryClient);

    expect(queryClient.getQueryData(["user"])).toBeUndefined();
    expect(useUserStore.getState().user).toBeNull();
  });

  it("CS4: account-switch sequence removes Admin before Student is seeded", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user"], ADMIN);

    invalidateAuth(queryClient);
    const student = { _id: "student1", role: "student", firstName: "Student" };
    useUserStore.getState().setUser(student);

    const observer = new QueryObserver(queryClient, {
      queryKey: ["user"],
      queryFn: async () => student,
      initialData: student,
      enabled: false,
    });

    expect(observer.getCurrentResult().data).toEqual(student);
    expect(useUserStore.getState().user).toEqual(student);
    observer.destroy();
  });
});
