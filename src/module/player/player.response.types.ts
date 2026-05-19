export type ChatChannel = "global" | "staff" | "testing";

export type PlayerSummaryResponse = {
  id: string;
  username: string;
  flags: string;
  orbs: string;
  chatChannel: ChatChannel;
};

export type PlayerResponse = {
  id: string;
  username: string;
  flags: string;
  orbs: string;
  chatChannel: ChatChannel;

  profile: {
    bio: string | null;
    pronouns: string | null;
    badges: number[];
    featuredBadgeId: number | null;
    locale: string;
    preferences: unknown;
  } | null;

  rankAssignments: Array<{
    groupKey: string;
    rankKey: string;
  }>;

  createdAtMs: string;
  lastSeenAtMs: string | null;
  lastServerId: string | null;
};
