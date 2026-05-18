import { apiRequest } from "@/api/client";
import type { Profile } from "@/lib/verity";

export function getOrCreateProfile(walletAddress: string) {
  return apiRequest<Profile>(`/users/wallet/${encodeURIComponent(walletAddress)}`);
}

export function getDevProfile() {
  return apiRequest<Profile>("/users/dev");
}

export function updateProfile(
  profileId: string,
  input: Pick<Profile, "username" | "display_name" | "avatar_url" | "bio">,
) {
  return apiRequest<Profile>(`/users/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchDailyVotes(userId: string) {
  return apiRequest<{
    votesLimit: number;
    votesUsed: number;
    votesRemaining: number;
    date: string;
  }>(`/users/${userId}/daily-votes`);
}
