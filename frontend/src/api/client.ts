const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export function hasApiConfig() {
  return Boolean(API_BASE_URL);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "API request failed.");
  }

  return payload.data;
}
