import { faker } from "@faker-js/faker";

type Schema = Record<string, unknown>;
type Schemas = Record<string, unknown>;

function normalizeKey(key: string | undefined): string {
  return (key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function refName(ref: string): string | null {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  return match?.[1] ?? null;
}

function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickOne<T>(arr: T[], seed: number): T | undefined {
  if (arr.length === 0) return undefined;
  const idx = seed % arr.length;
  return arr[idx];
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function resolveSchema(schema: Schema, schemas: Schemas, seenRefs: Set<string>): Schema {
  const ref = schema["$ref"];
  if (typeof ref !== "string") return schema;
  const name = refName(ref);
  if (!name) return schema;
  if (seenRefs.has(name)) return schema;
  seenRefs.add(name);
  const resolved = schemas[name];
  if (!resolved || typeof resolved !== "object") return schema;
  return resolved as Schema;
}

function maybeFromExampleOrDefault(schema: Schema): unknown {
  if (schema["example"] !== undefined) return schema["example"];
  if (schema["default"] !== undefined) return schema["default"];
  return undefined;
}

function generateString(schema: Schema, keyName?: string): string {
  const format = asString(schema["format"]);
  const minLength = Math.max(1, Math.floor(asNumber(schema["minLength"]) ?? 1));
  const maxLengthRaw = asNumber(schema["maxLength"]);
  const maxLength = Math.max(minLength, Math.floor(maxLengthRaw ?? Math.min(48, minLength + 16)));

  if (format === "email") return faker.internet.email();
  if (format === "uuid") return faker.string.uuid();
  if (format === "date-time") return faker.date.recent().toISOString();
  if (format === "date") return faker.date.recent().toISOString().slice(0, 10);
  if (format === "uri" || format === "url") return faker.internet.url();

  const key = normalizeKey(keyName);

  if (key === "email" || key.endsWith("_email") || key.includes("email")) return faker.internet.email();
  if (key === "first_name" || key === "firstname") return faker.person.firstName();
  if (key === "last_name" || key === "lastname") return faker.person.lastName();
  if (key === "full_name" || key === "fullname" || key === "name") return faker.person.fullName();

  if (key.includes("password") || key === "pass" || key.endsWith("_password")) {
    const length = Math.max(minLength, Math.min(maxLength, 16));
    return faker.internet.password({ length });
  }

  if (key.includes("phone") || key.includes("msisdn") || key.includes("tel")) return faker.phone.number();

  if (key === "id" || key.endsWith("_id")) return faker.string.uuid();

  if (key.includes("url") || key.includes("link") || key.includes("website")) return faker.internet.url();

  if (key.includes("username") || key === "user") return faker.internet.username();

  const len = faker.number.int({ min: minLength, max: Math.min(maxLength, 64) });
  return faker.string.alphanumeric({ length: len });
}

function generateNumber(schema: Schema, isInteger: boolean, keyName?: string): number {
  const min = asNumber(schema["minimum"]);
  const max = asNumber(schema["maximum"]);

  const key = normalizeKey(keyName);
  const looksLikeMoney =
    key.includes("amount") ||
    key.includes("price") ||
    key.includes("total") ||
    key.includes("cost") ||
    key.includes("fee");

  const safeMin = min ?? 0;
  const safeMax = max ?? (looksLikeMoney ? safeMin + 1000 : safeMin + 100);

  if (isInteger) return faker.number.int({ min: Math.floor(safeMin), max: Math.floor(safeMax) });
  return faker.number.float({ min: safeMin, max: safeMax, fractionDigits: looksLikeMoney ? 2 : 2 });
}

function generateBoolean(): boolean {
  return faker.datatype.boolean();
}

function generateArray(
  schema: Schema,
  schemas: Schemas,
  depth: number,
  seenRefs: Set<string>,
  keyName?: string,
): unknown[] {
  const items = schema["items"];
  const itemSchema = items && typeof items === "object" ? (items as Schema) : undefined;
  if (!itemSchema) return [];
  const count = faker.number.int({ min: 1, max: 3 });
  return Array.from({ length: count }, () => generateFromSchema(itemSchema, schemas, depth + 1, seenRefs, keyName));
}

function generateObject(
  schema: Schema,
  schemas: Schemas,
  depth: number,
  seenRefs: Set<string>,
): Record<string, unknown> {
  const properties = schema["properties"];
  const props = properties && typeof properties === "object" ? (properties as Record<string, unknown>) : {};

  const requiredList = Array.isArray(schema["required"]) ? (schema["required"] as unknown[]).map((v) => String(v)) : [];
  const required = new Set(requiredList);

  const out: Record<string, unknown> = {};
  for (const [key, rawPropSchema] of Object.entries(props)) {
    const propSchema = rawPropSchema && typeof rawPropSchema === "object" ? (rawPropSchema as Schema) : ({} as Schema);

    const mustInclude = required.has(key);
    const includeOptional = faker.number.int({ min: 1, max: 100 }) <= 55;
    if (!mustInclude && !includeOptional) continue;

    out[key] = generateFromSchema(propSchema, schemas, depth + 1, seenRefs, key);
  }

  return out;
}

function generateFromSchema(
  inputSchema: Schema,
  schemas: Schemas,
  depth: number,
  seenRefs: Set<string>,
  keyName?: string,
): unknown {
  if (depth > 6) return null;

  const schema = resolveSchema(inputSchema, schemas, seenRefs);

  const fromExampleOrDefault = maybeFromExampleOrDefault(schema);
  if (fromExampleOrDefault !== undefined) return fromExampleOrDefault;

  const enumValues = schema["enum"];
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    return (
      pickOne(
        enumValues.map((v) => v),
        faker.number.int(),
      ) ?? enumValues[0]
    );
  }

  const type = asString(schema["type"]);
  if (type === "string") return generateString(schema, keyName);
  if (type === "integer") return generateNumber(schema, true, keyName);
  if (type === "number") return generateNumber(schema, false, keyName);
  if (type === "boolean") return generateBoolean();
  if (type === "array") return generateArray(schema, schemas, depth, seenRefs, keyName);
  if (type === "object" || schema["properties"]) return generateObject(schema, schemas, depth, seenRefs);

  return null;
}

export function generateExampleFromSchema(inputSchema: Schema, schemas: Schemas, seedOrSalt: number | string): unknown {
  const seed = typeof seedOrSalt === "string" ? hash32(seedOrSalt) : seedOrSalt >>> 0;
  faker.seed(seed);

  return generateFromSchema(inputSchema, schemas, 0, new Set());
}
