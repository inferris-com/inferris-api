import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { openApiDocument } from "../src/openapi/openapi.js";
import { logger } from "../src/logger.js";

const jsonOutputPath = resolve("openapi.json");
const yamlOutputPath = resolve("openapi.yaml");

mkdirSync(dirname(jsonOutputPath), { recursive: true });
mkdirSync(dirname(yamlOutputPath), { recursive: true });

const jsonDocument = `${JSON.stringify(openApiDocument, null, 2)}\n`;
const normalizedOpenApiDocument = JSON.parse(jsonDocument) as unknown;

writeFileSync(jsonOutputPath, jsonDocument, "utf-8");
writeFileSync(yamlOutputPath, toYaml(normalizedOpenApiDocument), "utf-8");

logger.info(`OpenAPI JSON document written to ${jsonOutputPath}`);
logger.info(`OpenAPI YAML document written to ${yamlOutputPath}`);

function toYaml(value: unknown, indent = 0): string {
  const lines = stringifyYaml(value, indent);

  return `${lines.join("\n")}\n`;
}

function stringifyYaml(value: unknown, indent: number): string[] {
  const prefix = " ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${prefix}[]`];
    }

    return value.flatMap((item) => {
      if (isScalar(item)) {
        return [`${prefix}- ${formatScalar(item)}`];
      }

      const childLines = stringifyYaml(item, indent + 2);
      const [firstLine, ...remainingLines] = childLines;

      return [`${prefix}- ${firstLine?.trimStart()}`, ...remainingLines];
    });
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return [`${prefix}{}`];
    }

    return entries.flatMap(([key, item]) => {
      const formattedKey = formatKey(key);

      if (isScalar(item)) {
        return [`${prefix}${formattedKey}: ${formatScalar(item)}`];
      }

      return [`${prefix}${formattedKey}:`, ...stringifyYaml(item, indent + 2)];
    });
  }

  return [`${prefix}${formatScalar(value)}`];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isScalar(value: unknown): value is boolean | number | string | null | undefined {
  return (
    value === null || value === undefined || ["boolean", "number", "string"].includes(typeof value)
  );
}

function formatKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function formatScalar(value: unknown): string {
  if (value === undefined || value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
}
