import { auth } from './firebase';
import type { ApiOptions, Row } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Sends the Firebase credential as an opaque Bearer string. The server decides the role.
export async function api(path: string, { method = 'GET', body }: ApiOptions = {}): Promise<Row> {
  const user = auth.currentUser;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
  return data;
}
