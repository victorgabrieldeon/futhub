import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as catalogSchema from './schema.js';
import * as aiHistorySchema from './ai-history.schema.js';

const schema = { ...catalogSchema, ...aiHistorySchema };

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

export const pool = new pg.Pool({ connectionString: databaseUrl });

export const db = drizzle({ client: pool, schema });
export { and, asc, desc, eq, gte, inArray, lte, ne, notInArray, sql } from 'drizzle-orm';
export { schema };
