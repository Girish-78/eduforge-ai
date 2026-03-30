import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { isUserRole, type UserRole } from "@/lib/roles";

export const SESSION_COOKIE_NAME = "eduforge-session";

export interface SessionUser {
  email: string;
  name: string;
  role: UserRole;
  plan: "free" | "pro";
}

function isPlan(value: string): value is "free" | "pro" {
  return value === "free" || value === "pro";
}

function normalizeSessionUser(value: unknown): SessionUser | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const role = typeof raw.role === "string" ? raw.role : "";
  const plan = typeof raw.plan === "string" ? raw.plan : "free";

  if (!email || !name || !isUserRole(role) || !isPlan(plan)) {
    return null;
  }

  return {
    email,
    name,
    role,
    plan,
  };
}

function encodeSessionUser(user: SessionUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

function decodeSessionUser(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    return normalizeSessionUser(JSON.parse(json));
  } catch (error) {
    console.error("decodeSessionUser error", error);
    return null;
  }
}

export async function getServerSessionUser() {
  const cookieStore = await cookies();
  return decodeSessionUser(cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null);
}

export function attachSessionCookie(response: NextResponse, user: SessionUser) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSessionUser(user),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

