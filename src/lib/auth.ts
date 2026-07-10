import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { one } from "./db";
import { createToken, verifyToken } from "./token";

const COOKIE = "sm96_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 días

export type SessionUser = {
  id: number;
  name: string;
  username: string;
  role: "admin" | "asesor" | "mecanico";
  tour_done_at: string | null;
};

export async function setSession(userId: number, tokenVersion: number) {
  const store = await cookies();
  store.set(COOKIE, await createToken(userId, tokenVersion, MAX_AGE * 1000), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const data = await verifyToken(token);
  if (!data) return null;
  const user = await one<SessionUser & { token_version: number }>(
    "SELECT id, name, username, role, tour_done_at, token_version FROM users WHERE id = ? AND active = 1",
    [data.userId]
  );
  if (!user || user.token_version !== data.tokenVersion) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    tour_done_at: user.tour_done_at ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("No autorizado");
  return user;
}

export function checkPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}
