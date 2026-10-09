'use server';

import { headers } from 'next/headers';

export async function getClientIp() {
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const host = headersList.get('host');

  const ip = forwardedFor?.split(',')[0]?.trim() || host;

  console.log('Client IP:', ip);

  return ip;
}