export class DurableSqliteAdapter {
  constructor(storage) {
    if (!storage?.sql || typeof storage.transactionSync !== "function")
      throw new Error("SQLite-backed Durable Object storage is required");
    this.storage = storage;
    this.sql = storage.sql;
  }

  exec(statement) {
    return this.sql.exec(statement);
  }

  prepare(statement) {
    const sql = this.sql;
    return {
      get(...bindings) {
        return sql.exec(statement, ...bindings).toArray()[0];
      },
      all(...bindings) {
        return sql.exec(statement, ...bindings).toArray();
      },
      run(...bindings) {
        sql.exec(statement, ...bindings);
        const row = sql.exec("SELECT changes() AS count").toArray()[0];
        return { changes: row?.count || 0 };
      }
    };
  }

  transactionSync(callback) {
    return this.storage.transactionSync(callback);
  }

  close() {}
}
