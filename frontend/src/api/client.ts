import { storage } from "@/src/utils/storage";

export const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;
const TOKEN_KEY = "maghrebtalk_session_token";

let authToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  authToken = await storage.secureGet(TOKEN_KEY, null);
  return authToken;
}

export async function setToken(token: string): Promise<void> {
  authToken = token;
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  authToken = null;
  await storage.secureRemove(TOKEN_KEY);
}

export function getToken(): string | null {
  return authToken;
}

interface RequestOptions {
  method?: string;
  body?: any;
  isForm?: boolean;
}

async function request(path: string, options: RequestOptions = {}): Promise<any> {
  const { method = "GET", body, isForm = false } = options;
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let payload: any;
  if (isForm) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}/api${path}`, { method, headers, body: payload });

  if (!res.ok) {
    let detail = "Une erreur est survenue";
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {
      /* ignore */
    }
    const err: any = new Error(detail);
    err.status = res.status;
    throw err;
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: "POST", body }),
  del: (path: string) => request(path, { method: "DELETE" }),
  postForm: (path: string, form: FormData) => request(path, { method: "POST", body: form, isForm: true }),
};
