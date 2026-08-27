import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

export const pool = new pg.Pool({ connectionString: databaseUrl });

export const db = drizzle({ client: pool, schema });
export { and, asc, desc, eq, gte, inArray, lte, notInArray, sql } from 'drizzle-orm';
export { schema };
