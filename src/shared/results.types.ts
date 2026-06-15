export type CreateResult<T> = { status: "created"; data: T } | { status: "conflict" };

export type ReplaceResult<T> = { status: "replaced"; data: T } | { status: "parent_not_found" };

export type DeleteResult =
  | { status: "deleted" }
  | { status: "conflict"; cause: "referenced_by_other_rows" }
  | { status: "not_found" };
