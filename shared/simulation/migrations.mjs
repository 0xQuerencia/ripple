import { SCHEMA_VERSION, SchemaError } from "./schema.mjs";

export function migrateSchema(value) {
  if (!value || typeof value !== "object")
    throw new SchemaError("schema", "expected an object");
  if (value.schemaVersion !== SCHEMA_VERSION)
    throw new SchemaError("schemaVersion", "unsupported schema version");
  return structuredClone(value);
}
