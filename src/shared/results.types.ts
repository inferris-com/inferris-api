export type CreateResult =
  | { status: "created"; object: unknown}
  | { status: "conflict" }
  | { status: "not_found" };
