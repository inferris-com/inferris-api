export enum PgErrorCode {
  ForeignKeyViolation = "23503",
  UniqueViolation = "23505",
  NotNullViolation = "23502",
  CheckViolation = "23514",
}

type PgErrorLike = {
  code: string;
  constraint?: string;
  detail?: string;
  table?: string;
  schema?: string;
};

export function isPgError(err: unknown): err is PgErrorLike {
  return typeof err === "object" && err !== null && "code" in err && typeof err.code === "string";
}

export function isPgErrorCode(err: unknown, code: PgErrorCode): err is PgErrorLike {
  const pgCode: string = code;

  return isPgError(err) && err.code === pgCode;
}

export function isForeignKeyViolation(err: unknown): err is PgErrorLike {
  return isPgErrorCode(err, PgErrorCode.ForeignKeyViolation);
}
