import type { Selectable } from "kysely";

import type { PlayerFlagDefinitions } from "../../db/types.js";

export type PlayerFlagDefinition = Selectable<PlayerFlagDefinitions>;

export type PlayerFlagDefinitionResponse = {
  key: string;
  bitPosition: number;
  bitValue: string;
  label: string;
  description: string | null;
  isActive: boolean;
};

export type PlayerFlagBitmaskResponse = {
  value: string;
  binary: string;
  flags: PlayerFlagDefinitionResponse[];
  unknownBits: string[];
};

export function toPlayerFlagDefinitionResponse(
  definition: PlayerFlagDefinition,
): PlayerFlagDefinitionResponse {
  return {
    key: definition.flag_key,
    bitPosition: definition.bit_position,
    bitValue: bitValueFor(definition.bit_position).toString(),
    label: definition.label,
    description: definition.description,
    isActive: definition.is_active,
  };
}

export function encodePlayerFlags(definitions: PlayerFlagDefinition[], keys: string[]): bigint {
  const definitionsByKey = new Map(
    definitions.map((definition) => [normalizeFlagKey(definition.flag_key), definition]),
  );

  let value = 0n;

  for (const key of keys) {
    const definition = definitionsByKey.get(normalizeFlagKey(key));

    if (!definition) {
      throw new UnknownPlayerFlagError(key, [...definitionsByKey.keys()]);
    }

    value |= bitValueFor(definition.bit_position);
  }

  return value;
}

export function decodePlayerFlags(
  definitions: PlayerFlagDefinition[],
  value: bigint,
): { flags: PlayerFlagDefinition[]; unknownBits: string[] } {
  const flags: PlayerFlagDefinition[] = [];
  let knownMask = 0n;

  for (const definition of definitions) {
    const bitValue = bitValueFor(definition.bit_position);
    knownMask |= bitValue;

    if ((value & bitValue) !== 0n) {
      flags.push(definition);
    }
  }

  return {
    flags,
    unknownBits: listUnknownBits(value & ~knownMask),
  };
}

export function toBitmaskResponse(
  definitions: PlayerFlagDefinition[],
  value: bigint,
): PlayerFlagBitmaskResponse {
  const decoded = decodePlayerFlags(definitions, value);

  return {
    value: value.toString(),
    binary: `0b${value.toString(2)}`,
    flags: decoded.flags.map(toPlayerFlagDefinitionResponse),
    unknownBits: decoded.unknownBits,
  };
}

export class UnknownPlayerFlagError extends Error {
  constructor(
    readonly flagKey: string,
    readonly knownFlags: string[],
  ) {
    super(`Unknown player flag '${flagKey}'.`);
    this.name = "UnknownPlayerFlagError";
  }
}

function normalizeFlagKey(key: string): string {
  return key.trim().toUpperCase();
}

function bitValueFor(bitPosition: number): bigint {
  return 1n << BigInt(bitPosition);
}

function listUnknownBits(value: bigint): string[] {
  const bits: string[] = [];
  let remaining = value;
  let position = 0;

  while (remaining > 0n) {
    if ((remaining & 1n) === 1n) {
      bits.push(position.toString());
    }

    remaining >>= 1n;
    position += 1;
  }

  return bits;
}
