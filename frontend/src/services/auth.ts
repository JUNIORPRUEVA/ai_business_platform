export type AuthUser = {
  userId: string;
  companyId: string;
  role: "admin" | "operator" | "viewer";
  email: string;
  name: string;
};

export type Company = {
  id: string;
  name: string;
  plan: string;
  status: string;
};

export type Session = {
  user: AuthUser;
  company: Company;
};

import { jsonFetch } from "@/services/app-error";

export async function registerCompany(input: {
  companyName: string;
  adminName: string;
  email: string;
  password: string;
}): Promise<void> {
  await jsonFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: {
  email: string;
  password: string;
  companyId?: string;
}): Promise<void> {
  await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  await jsonFetch("/api/auth/logout", { method: "POST" });
}

export async function getSession(): Promise<Session> {
  return await jsonFetch<Session>("/api/auth/session", { cache: "no-store" });
}
