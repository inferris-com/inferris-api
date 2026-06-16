export type GroupResponse = {
  key: string;
  label: string;
  priority: number;
  isStaff: boolean;
  createdAtMs: string;
  updatedAtMs: string | null;
};

export type RankResponse = {
  key: string;
  groupKey: string | null;
  label: string;
  description: string | null;
  displayTag: string | null;
  usernameColorHex: string | null;
  tier: number;
  isStaff: boolean;
  isActive: boolean;
  createdAtMs: string;
  updatedAtMs: string | null;
};

export type BadgeResponse = {
  id: number;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
  emoji: string | null;
  displayOrder: number;
  isActive: boolean;
};
