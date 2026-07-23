/**
 * Koppelt een club-id (uit clubs.ts) aan de manier waarop we 'm kunnen pollen.
 * Clubs die hier niet in staan, worden overgeslagen door de polling-job —
 * hun boekingssysteem is nog niet bevestigd (zie PROJECTPLAN.md §7).
 */
export type PollBron =
  | { type: "meetandplay"; meetAndPlayClubId: string }
  | { type: "playtomic"; tenantId: string };

export const POLL_CONFIG: Record<string, PollBron> = {
  hofgeest: { type: "meetandplay", meetAndPlayClubId: "29942" },
  wepadel: { type: "playtomic", tenantId: "dd28050e-35c4-4bd0-ab58-b2f88111846d" },
  padel25: { type: "playtomic", tenantId: "68640cb4-c026-4bb1-8184-6e2cfe0f5ccf" },
};
