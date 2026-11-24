import "server-only";
import { cookies } from "next/headers";

export const ACCESS_COOKIE = "mm_at";
export const REFRESH_COOKIE = "mm_rt";
export const API_URL = process.env.API_URL ?? "http://localhost:8000";

export interface Tokens { accessToken: string; refreshToken: string; expiresIn: number }

const base = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export async function setSession(t: Tokens) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, t.accessToken, { ...base, maxAge: Math.max(60, t.expiresIn - 30) });
  jar.set(REFRESH_COOKIE, t.refreshToken, { ...base, maxAge: 30 * 24 * 3600 });
}
export async function clearSession() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}
export async function readSession() {
  const jar = await cookies();
  return { accessToken: jar.get(ACCESS_COOKIE)?.value, refreshToken: jar.get(REFRESH_COOKIE)?.value };
}
