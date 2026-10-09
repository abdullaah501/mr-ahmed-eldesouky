import { create } from "zustand";
import {parse} from "cookie";

const hasAuthCookies = () => {
  if (typeof document === "undefined") return false;
  const cookies = parse(document.cookie || "");
  return Boolean(cookies["access_token"] && cookies["s-i"]);
};

export const useUserStore = create(
  (set) => ({
    user: undefined,
    setUser: (user) => set({ user }),
    checkAuthCookies: () => {
      if (!hasAuthCookies()) {
        set({ user: null }); // امسح المستخدم لو الكوكي مش موجودة
      }
    },
    logout: () => set({ user: null }),
  })
);
