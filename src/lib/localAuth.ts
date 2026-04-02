"use client";

// Local (browser) storage based auth fallback for when server filesystem
// is read-only or unavailable. Stores minimal user records in localStorage.
import { LOCAL_SESSION_COOKIE as SESSION_COOKIE } from "@/lib/localAuthShared";

export type LocalUser = {
  id: string;
  username: string;
  salt: string; // hex
  passwordHash: string; // hex SHA-256(salt:password)
  createdAt: string;
};

const USERS_KEY = "localAuth.users";
// Cookie name shared with server fallback auth

function toHex(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr;
}

function getUsers(): LocalUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as LocalUser[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: LocalUser[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function findLocalUser(username: string): LocalUser | undefined {
  const list = getUsers();
  return list.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  // simple deterministic input: salt:password
  const input = enc.encode(`${saltHex}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return toHex(digest);
}

export async function createLocalUser(username: string, password: string): Promise<LocalUser> {
  const existing = findLocalUser(username);
  if (existing) throw new Error("Username already exists locally");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(salt.buffer);
  const passwordHash = await hashPassword(password, saltHex);
  const user: LocalUser = {
    id: crypto.randomUUID(),
    username,
    salt: saltHex,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  const list = getUsers();
  list.push(user);
  saveUsers(list);
  return user;
}

export async function verifyLocalUser(username: string, password: string): Promise<LocalUser | null> {
  const u = findLocalUser(username);
  if (!u) return null;
  const hash = await hashPassword(password, u.salt);
  return hash === u.passwordHash ? u : null;
}

export function setLocalSession(user: { id: string; username: string }, ttlSeconds = 60 * 60 * 24) {
  // Value format: id|username
  const value = `${user.id}|${user.username}`;
  const maxAge = ttlSeconds;
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

export function clearLocalSession() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export const LOCAL_SESSION_COOKIE = SESSION_COOKIE;
