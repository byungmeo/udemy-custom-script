import fs from "node:fs";
import path from "node:path";

import {
  parseCustomScript,
} from "../shared/custom-script-format.js";
import {
  sanitizeOpenAiTranslatedScript,
} from "../background/openai-provider.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
const samplePath = path.join(projectRoot, "test", "Test1_Response.txt");

const rawSample = fs.readFileSync(samplePath, "utf8");
const sanitizedSample = sanitizeOpenAiTranslatedScript(rawSample);
const parsed = parseCustomScript(sanitizedSample);

console.log("OpenAI sample validation passed.");
console.log(`Lookup key: ${parsed.metadata.identity.lookup_key}`);
console.log(`Cue count: ${parsed.cues.length}`);
