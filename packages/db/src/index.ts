import { drizzle } from "drizzle-orm/node-postgres";

import { getPool } from "./pool";
import * as schema from "./schema";

export { closePool, getPool } from "./pool";

export function createDb() {
  return drizzle(getPool(), { schema });
}

export const db = createDb();

export type Db = typeof db;
