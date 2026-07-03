'use client';

import type { ApiResponse } from '@/lib/api-response';

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success || json.data === null) {
    throw new Error(json.error || 'Request failed');
  }
  return json.data;
}
