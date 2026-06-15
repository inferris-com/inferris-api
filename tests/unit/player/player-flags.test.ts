import { describe, expect, test } from "@jest/globals";

import {
  decodePlayerFlags,
  encodePlayerFlags,
  toBitmaskResponse,
  UnknownPlayerFlagError,
  type PlayerFlagDefinition,
} from "../../../src/module/player/player-flags.js";

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

describe("player flags", () => {
  test("encodePlayerFlags computes bitmask from flag keys", () => {
    expect(encodePlayerFlags(definitions, ["staff", "ARGUS_ACCESS"]).toString()).toBe("1048577");
  });

  test("decodePlayerFlags returns matching flags and unknown bits", () => {
    const decoded = decodePlayerFlags(definitions, 1048581n);

    expect(decoded.flags.map((flag) => flag.flag_key)).toEqual(["STAFF", "ARGUS_ACCESS"]);
    expect(decoded.unknownBits).toEqual(["2"]);
  });

  test("toBitmaskResponse returns stable string values", () => {
    const response = toBitmaskResponse(definitions, 3n);

    expect(response.value).toBe("3");
    expect(response.binary).toBe("0b11");
    expect(response.flags.map((flag) => flag.key)).toEqual(["STAFF", "VANISHED"]);
  });

  test("encodePlayerFlags rejects unknown flag keys", () => {
    expect(() => encodePlayerFlags(definitions, ["MISSING"])).toThrow(UnknownPlayerFlagError);

    try {
      encodePlayerFlags(definitions, ["MISSING"]);
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownPlayerFlagError);
      expect((error as UnknownPlayerFlagError).flagKey).toBe("MISSING");
    }
  });
});
