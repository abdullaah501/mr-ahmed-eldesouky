'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DelayedRedirectClient({ id, redirectTo }) {
  const router = useRouter();

  useEffect(() => {
    const destination = redirectTo || `/course/${id}`;
    const timer = setTimeout(() => {
      router.push(destination);
    }, 10000);

    return () => clearTimeout(timer);
  }, [router, id, redirectTo]);

  return null;
}