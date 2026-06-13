// Thin fetch client that talks to the PHP backend hosted alongside the SPA.
// In dev (Vite) the GET reads still work because `public/api/data/routes.json`
// is served as a static file. POST/DELETE require PHP and only work once
// the build is deployed to a server that runs PHP (e.g. IONOS).

import type { BikeRoute } from "./routes-data";

const API_BASE = "/api";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Respuesta no-JSON del servidor (${res.status}). ¿PHP está activo? — ${text.slice(0, 120)}`
    );
  }
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `Error ${res.status}`);
  }
  return body as T;
}

export async function apiFetchRoutes(): Promise<BikeRoute[]> {
  // Static JSON file — works in dev and in production.
  const res = await fetch(`${API_BASE}/data/routes.json`, { cache: "no-store" });
  if (!res.ok) return [];
  const body = (await res.json()) as BikeRoute[] | null;
  return Array.isArray(body) ? body : [];
}

export async function apiCheckSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/session.php`, { credentials: "include" });
    const body = await jsonOrThrow<{ authenticated: boolean }>(res);
    return body.authenticated === true;
  } catch {
    return false;
  }
}

export async function apiLogin(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/login.php`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  await jsonOrThrow<{ ok: true }>(res);
}

export async function apiLogout(): Promise<void> {
  await fetch(`${API_BASE}/logout.php`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

export async function apiSaveRoute(route: BikeRoute): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/save.php`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "upsert", route }),
  });
  return jsonOrThrow<{ id: string }>(res);
}

export async function apiDeleteRoute(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/save.php`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  await jsonOrThrow<{ ok: true }>(res);
}
