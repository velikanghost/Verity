import { apiRequest } from "@/api/client";
import type { Profile } from "@/lib/verity";

const TOKEN_KEY = "verity_auth_token";

export interface AuthResponse {
  token: string;
  user: Profile;
}

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function register(input: {
  email: string;
  password: string;
  username: string;
  display_name?: string | null;
}) {
  const response = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setAuthToken(response.token);
  return response;
}

export async function login(input: { email: string; password: string }) {
  const response = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setAuthToken(response.token);
  return response;
}

export function me() {
  const token = getAuthToken();
  return apiRequest<Profile>("/auth/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
