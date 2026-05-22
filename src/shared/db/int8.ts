function int8ToString(value: string | number | bigint ): string {
  return value.toString();
}

function int8ToStringOrNull(value: string | number | bigint | null): string | null {
  return value === null ? null : value.toString();
}

function int8ToStringOrDefault(value: string | number | bigint | null, fallback: string): string {
  return int8ToStringOrNull(value) ?? fallback;
}

export { int8ToString, int8ToStringOrNull, int8ToStringOrDefault };
