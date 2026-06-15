import assert from "node:assert/strict";
import test from "node:test";

import {
  decodePlayerFlags,
  encodePlayerFlags,
  toBitmaskResponse,
  UnknownPlayerFlagError,
  type PlayerFlagDefinition,
} from "./player-flags.js";

const definitions: PlayerFlagDefinition[] = [
  {
    flag_key: "STAFF",
    bit_position: 0,
    label: "Staff",
    description: null,
    is_active: true,
    created_at_ms: "0",
    updated_at_ms: null,
  },
  {
    flag_key: "VANISHED",
    bit_position: 1,
    label: "Vanished",
    description: null,
    is_active: true,
    created_at_ms: "0",
    updated_at_ms: null,
  },
  {
    flag_key: "ARGUS_ACCESS",
    bit_position: 20,
    label: "Argus Access",
    description: null,
    is_active: true,
    created_at_ms: "0",
    updated_at_ms: null,
  },
];

void test("encodePlayerFlags computes bitmask from flag keys", () => {
  assert.equal(encodePlayerFlags(definitions, ["staff", "ARGUS_ACCESS"]).toString(), "1048577");
});

void test("decodePlayerFlags returns matching flags and unknown bits", () => {
  const decoded = decodePlayerFlags(definitions, 1048581n);

  assert.deepEqual(
    decoded.flags.map((flag) => flag.flag_key),
    ["STAFF", "ARGUS_ACCESS"],
  );
  assert.deepEqual(decoded.unknownBits, ["2"]);
});

void test("toBitmaskResponse returns stable string values", () => {
  const response = toBitmaskResponse(definitions, 3n);

  assert.equal(response.value, "3");
  assert.equal(response.binary, "0b11");
  assert.deepEqual(
    response.flags.map((flag) => flag.key),
    ["STAFF", "VANISHED"],
  );
});

void test("encodePlayerFlags rejects unknown flag keys", () => {
  assert.throws(
    () => encodePlayerFlags(definitions, ["MISSING"]),
    (error) => error instanceof UnknownPlayerFlagError && error.flagKey === "MISSING",
  );
});
