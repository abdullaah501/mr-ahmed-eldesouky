"use client";

import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { searchRepositoryQuestions } from "@/app/actions/repositoryActions";

export function useRepositorySearch(filters, options = {}) {
  const { enabled } = options;

  return useInfiniteQuery({
    queryKey: ["repository", filters],
    queryFn: async ({ pageParam }) => {
      const res = await searchRepositoryQuestions({ ...filters, cursor: pageParam });
      if (!res.success) {
        throw new Error(res.message || "Failed to search questions");
      }
      return {
        items: res.items || [],
        nextCursor: res.nextCursor,
        hasMore: res.hasMore,
      };
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => (lastPage && lastPage.hasMore ? lastPage.nextCursor : undefined),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
    enabled: enabled !== false,
  });
}
