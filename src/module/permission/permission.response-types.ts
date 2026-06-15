export type PermissionNodeResponse = {
  id: string;
  key: string;
  category: string;
  description: string | null;
  isActive: boolean;
  createdAtMs: string;
  updatedAtMs: string | null;
};

export type PermissionRuleResponse = {
  permissionId: string;
  rankKey: string | null;
  effect: "allow" | "deny";
  createdAtMs: string;
  updatedAtMs: string | null;
};
