// Browser-side API client. Auth is an httpOnly cookie set by the server (the mobile app uses a Bearer token instead).
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
  const r = await fetch('/api/v1' + path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(d.error || 'Request failed. Please try again.', r.status);
  return d as T;
}
export const money = (minor: number | null | undefined, currency = 'GHS') => new Intl.NumberFormat('en', { style: 'currency', currency }).format((minor || 0) / 100);
export const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

export interface Me {
  id: number; member_id: string; username: string; email: string; full_name: string; country: string; phone: string; status: string; eligible: boolean; email_verified: boolean;
  role: string; deadline_at: string; currency: string; referrer_id: number | null;
  balances: { total_earned: number; pending: number; available: number; held: number; withdrawn: number };
}
export interface Achievement {
  key: string; label: string; description: string; icon: string; earned: boolean; progress: number;
}
export interface LearningStats {
  current_streak: number; longest_streak: number; active_days: number;
  lessons_done: number; courses_completed: number; certificates: number;
  quiz_attempts: number; quiz_passed: number; average_score: number;
  achievements: Achievement[];
}
export interface CourseItem {
  id: number; title: string; author: string | null; description?: string | null; cover_url: string | null; minutes: number; level: string; rating: number; rating_count: number;
  reward_eligible: boolean; enrolments?: number; category?: string | null; lessons?: number; percent?: number; completed_at?: string | null; cert_code?: string | null;
  has_free_preview?: boolean; quiz_count?: number;
}
