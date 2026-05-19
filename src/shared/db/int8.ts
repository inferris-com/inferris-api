function int8ToString(value: string | number | bigint | null): string | null {
  return value === null ? null : value.toString();
}

function int8ToStringOrDefault(value: string | number | bigint | null, fallback: string): string {
  return int8ToString(value) ?? fallback;
}

export { int8ToString, int8ToStringOrDefault };
