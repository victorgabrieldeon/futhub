import { db, schema } from '@dreamfut/database';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { isCreateCardBaseBody } from '../../card-bases.js';

export async function GET() {
  const bases = await db.select().from(schema.cardBases).orderBy(desc(schema.cardBases.updatedAt));
  return NextResponse.json(bases);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  if (!isCreateCardBaseBody(body)) {
    return NextResponse.json({ message: 'Dados da base invalidos.' }, { status: 400 });
  }

  const [base] = await db.insert(schema.cardBases).values(body).returning();

  if (!base) {
    return NextResponse.json({ message: 'Nao foi possivel salvar a base.' }, { status: 500 });
  }

  return NextResponse.json(base, { status: 201 });
}
