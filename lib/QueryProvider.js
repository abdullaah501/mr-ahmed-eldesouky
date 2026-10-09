"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { registerAuthQueryClient } from "./auth/clientSync";

export default function QueryProvider({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    registerAuthQueryClient(queryClient);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
