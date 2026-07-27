import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "surecomply.db");
let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    dbInstance = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    dbInstance = new SQL.Database();
  }
  return dbInstance;
}

export function saveDb() {
  if (!dbInstance) return;
  fs.writeFileSync(DB_PATH, Buffer.from(dbInstance.export()));
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error("DB not initialized");
  const stmt = dbInstance.prepare(sql);
  if (params.length) stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) results.push(stmt.getAsObject() as unknown as T);
  stmt.free();
  return results;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const r = queryAll<T>(sql, params);
  return r.length > 0 ? r[0] : null;
}

export function execute(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error("DB not initialized");
  dbInstance.run(sql, params);
}
