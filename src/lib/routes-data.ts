// Types + small helpers shared by all pages.
// Storage is delegated to the PHP backend in `./api.ts`.

import { apiFetchRoutes } from "./api";

export interface RoutePoint {
  lat: number;
  lng: number;
  instruction?: string;
  mode?: "bike" | "walk";
}

export interface BikeRoute {
  id: string;
  code: string;
  name: string;
  description: string;
  distance: string;
  duration: string;
  difficulty: "Fácil" | "Media" | "Difícil";
  points: RoutePoint[];
}

export async function fetchRoutes(): Promise<BikeRoute[]> {
  return apiFetchRoutes();
}

export async function fetchRouteByCode(code: string): Promise<BikeRoute | null> {
  const all = await apiFetchRoutes();
  const wanted = code.trim().toUpperCase();
  return all.find((r) => r.code.toUpperCase() === wanted) ?? null;
}
