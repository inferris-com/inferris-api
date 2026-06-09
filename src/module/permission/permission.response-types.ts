export type PermissionNodeResponse = {
  id: string,
  key: string,
  description: string | null,
  isActive: boolean,
  createdAtMs: string,
  updatedAtMs: string | null,
}

export type PermissionRuleResponse = {
  id: string,
  permissionId: string,
  minRankKey: string | null,
  effect: "allow" | "deny",
  priority: number,
  createdAtMs: string,
  updatedAtMs: string | null,
}
