// The part of Node's built-in SQLite module the tests use (Node >= 22.5, required by package.json
// engines). Declared here instead of adding @types/node for one module.
declare module 'node:sqlite' {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;
  export type SQLOutputRow = Record<string, unknown>;
  export class StatementSync {
    run(...values: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...values: SQLInputValue[]): SQLOutputRow | undefined;
    all(...values: SQLInputValue[]): SQLOutputRow[];
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
