import { createHash } from "node:crypto";

export function hashState(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
