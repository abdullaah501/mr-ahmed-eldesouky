"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/axios/axios";

export function useStudentAnalytics() {
  return useQuery({
    queryKey: ["studentAnalytics"],
    queryFn: async () => {
      const res = await api.get("/api/student/analytics");
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache to minimize server requests
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
