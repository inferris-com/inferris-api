export type ChatChannel = string;

export type PlayerSummaryResponse = {
  id: string;
  username: string;
  flags: string;
  orbs: string;
  chatChannel: ChatChannel;
};

export type PlayerFlagDefinitionResponse = {
  key: string;
  bitPosition: number;
  bitValue: string;
  label: string;
  description: string | null;
  isActive: boolean;
};

export type PlayerFlagBitmaskResponse = {
  value: string;
  binary: string;
  flags: PlayerFlagDefinitionResponse[];
  unknownBits: string[];
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
    featuredBadgeId: number | null;
    locale: string;
    preferences: unknown;
  } | null;

  badges: number[];

  rankAssignments: Array<{
    groupKey: string;
    rankKey: string;
  }>;

  createdAtMs: string;
  lastSeenAtMs: string | null;
  lastServerId: string | null;
};

export type PlayerProfileResponse = {
  playerId: string;
  bio: string | null;
  pronouns: string | null;
  featuredBadgeId: number | null;
  locale: string;
  preferences: unknown;
};

export type PlayerRankAssignmentResponse = {
  playerId: string;
  groupKey: string;
  rankKey: string;
  assignedAtMs: string;
  assignedByActorId: string | null;
  source: string | null;
};

export type PlayerBadgeAssignmentResponse = {
  playerId: string;
  badgeId: number;
  earnedAtMs: string;
  source: string | null;
};
