import { DatabaseSync } from "node:sqlite";
import { SqliteEventStoreCore } from "./eventStore.mjs";

export class SqliteEventStore extends SqliteEventStoreCore {
  constructor(filename = ":memory:") {
    super(new DatabaseSync(filename), { native: true });
  }
}
