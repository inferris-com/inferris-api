import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { openApiDocument } from "../src/openapi/openapi.js";
import { logger } from "../src/logger.js";

const outputPath = resolve("openapi.json");

mkdirSync(dirname(outputPath), { recursive: true });

writeFileSync(outputPath, JSON.stringify(openApiDocument, null, 2), "utf-8");

logger.info(`OpenAPI document written to ${outputPath}`);
