import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import prisma from '@/prisma/prisma.service';

import { knownUnitCode, UNAMBIGUOUS_UNIT_WORDS } from './unit-code';

const MIGRATION = join(
  __dirname,
  '../../../../../prisma/migrations/20261011100000_document_line_unit_codes/migration.sql',
);

const FREE_TEXT = ['sprint', 'm', 'lot', 'forfait', ''];

/** Runs the migration on one company's rows only, so parallel specs sharing the database are untouched. */
async function migrate(companyId: string) {
  const sql = readFileSync(MIGRATION, 'utf-8').replace(
    'WHERE (',
    `WHERE d."companyId" = '${companyId}' AND (`,
  );
  await prisma.$executeRawUnsafe(sql);
}

async function createDocument(companyId: string, typeId: string, status: string, units: unknown[]) {
  return prisma.documentInstance.create({
    data: {
      companyId,
      typeId,
      status,
      data: { lines: units.map((unit, index) => ({ description: `Line ${index}`, quantity: 1, unit })) },
    },
  });
}

async function unitsOf(id: string): Promise<unknown[]> {
  const document = await prisma.documentInstance.findUniqueOrThrow({ where: { id } });
  return ((document.data as { lines: { unit?: unknown }[] }).lines ?? []).map((line) => line.unit);
}

describe('migration 20261011100000_document_line_unit_codes', () => {
  let companyId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        name: 'Unit migration Co',
        foundedAt: new Date('2020-01-01'),
        address: '1 Test Street',
        postalCode: '00000',
        city: 'Testville',
        country: 'France',
        countryCode: 'FR',
        phone: '+33000000000',
        email: `unit-migration-${Date.now()}@example.com`,
      },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    await prisma.documentInstance.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
  });

  it('maps every unambiguous word on a draft invoice to the code the export uses, whatever its case', async () => {
    const words = Object.values(UNAMBIGUOUS_UNIT_WORDS).flat();
    const typed = words.map((word, index) => (index % 2 === 0 ? ` ${word.toUpperCase()} ` : word));
    const draft = await createDocument(companyId, 'invoice', 'draft', typed);

    await migrate(companyId);

    expect(await unitsOf(draft.id)).toEqual(words.map((word) => knownUnitCode(word)));
  });

  it('maps h to HUR and Stunde to HUR on a quote, whatever its status', async () => {
    const quote = await createDocument(companyId, 'quote', 'signed', ['h', 'Stunde', 'DAY']);

    await migrate(companyId);

    expect(await unitsOf(quote.id)).toEqual(['HUR', 'HUR', 'DAY']);
  });

  it('leaves ambiguous or unknown text, and lines with no unit, exactly as typed', async () => {
    const draft = await createDocument(companyId, 'credit-note', 'draft', [...FREE_TEXT, undefined, 3]);

    await migrate(companyId);

    expect(await unitsOf(draft.id)).toEqual([...FREE_TEXT, undefined, 3]);
  });

  it('never touches an issued invoice, an issued credit note or a received invoice', async () => {
    const issued = await createDocument(companyId, 'invoice', 'sent', ['hour', 'h']);
    const credit = await createDocument(companyId, 'credit-note', 'validated', ['day']);
    const received = await createDocument(companyId, 'received-invoice', 'draft', ['kg']);

    await migrate(companyId);

    expect(await unitsOf(issued.id)).toEqual(['hour', 'h']);
    expect(await unitsOf(credit.id)).toEqual(['day']);
    expect(await unitsOf(received.id)).toEqual(['kg']);
  });
});
