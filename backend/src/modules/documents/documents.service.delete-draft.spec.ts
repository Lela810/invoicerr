/**
 * Deleting a draft quote, invoice, credit note or purchase order, against a real database: the
 * guards that keep a delete from breaking something else are queries, so a mocked persistence layer
 * would prove nothing about them.
 */
import { ConflictException } from '@nestjs/common';

import prisma from '@/prisma/prisma.service';

import { ActionExtensionRegistry } from './actions/action-extensions';
import { ActionRegistry } from './actions/action-registry';
import { registerCreditNoteActions } from './actions/credit-note-actions';
import { registerInvoiceActions } from './actions/invoice-actions';
import { registerPurchaseOrderActions } from './actions/purchase-order-actions';
import { registerQuoteActions } from './actions/quote-actions';
import { ContributionRegistry } from './contributions/contribution-registry';
import { buildCreditNoteDescriptor } from './descriptors/credit-note.descriptor';
import { FieldKindRegistry, registerCoreFieldKinds } from './descriptors/field-kinds';
import { buildInvoiceDescriptor } from './descriptors/invoice.descriptor';
import { buildPurchaseOrderDescriptor } from './descriptors/purchase-order.descriptor';
import { buildQuoteDescriptor } from './descriptors/quote.descriptor';
import { DocumentTypeRegistry } from './descriptors/type-registry';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { EntityReferenceRegistry } from './references/reference-registry';
import { TransportRegistry } from './transports/transport-registry';
import { createTestCompany, NAME_ONLY_CLIENT_FIELDS } from './__tests__/issuable-client';

const DELETABLE_TYPES = ['invoice', 'quote', 'credit-note', 'purchase-order'] as const;

// The delete path never reaches any of these collaborators.
const unused = {} as never;

function buildService(): DocumentsService {
  const typeRegistry = new DocumentTypeRegistry();
  typeRegistry.register(buildInvoiceDescriptor());
  typeRegistry.register(buildQuoteDescriptor());
  typeRegistry.register(buildCreditNoteDescriptor());
  typeRegistry.register(buildPurchaseOrderDescriptor());

  const fieldKindRegistry = new FieldKindRegistry();
  registerCoreFieldKinds(fieldKindRegistry);

  const referenceRegistry = new EntityReferenceRegistry();
  const transportRegistry = new TransportRegistry();
  const actionRegistry = new ActionRegistry();
  registerInvoiceActions(actionRegistry, { transportRegistry, queueDispatcher: unused });
  registerQuoteActions(actionRegistry, {
    clientsService: unused,
    mailService: unused,
    typeRegistry,
    referenceRegistry,
    queueDispatcher: unused,
  });
  registerCreditNoteActions(actionRegistry, {
    queueDispatcher: unused,
    transportRegistry,
    referenceRegistry,
  });
  registerPurchaseOrderActions(actionRegistry, {
    clientsService: unused,
    mailService: unused,
    typeRegistry,
    referenceRegistry,
    queueDispatcher: unused,
  });

  return new DocumentsService(
    typeRegistry,
    fieldKindRegistry,
    actionRegistry,
    new ActionExtensionRegistry(),
    referenceRegistry,
    transportRegistry,
    new ContributionRegistry(),
  );
}

describe('DocumentsService — deleting a draft', () => {
  let companyId: string;
  const service = buildService();

  beforeEach(async () => {
    companyId = (await createTestCompany('Draft Delete Co')).id;
  });

  afterEach(async () => {
    await prisma.company.delete({ where: { id: companyId } });
  });

  function insertDocument(
    typeId: string,
    status: string,
    extra: { data?: Record<string, unknown>; number?: number; displayNumber?: string } = {},
  ) {
    return prisma.documentInstance.create({
      data: {
        companyId,
        typeId,
        status,
        data: (extra.data ?? {}) as object,
        number: extra.number,
        displayNumber: extra.displayNumber,
      },
    });
  }

  function runDelete(typeId: string, documentId: string) {
    return service.runAction(companyId, typeId, 'delete', { documentId, data: {} });
  }

  async function stillExists(id: string) {
    return (await prisma.documentInstance.count({ where: { id } })) === 1;
  }

  it('refuses at the API a draft that already carries a number', async () => {
    const controller = new DocumentsController(service, unused, unused, unused, unused);
    const reEdited = await insertDocument('quote', 'draft', { number: 3, displayNumber: 'QUOTE-2026-0003' });

    await expect(
      controller.runAction(companyId, 'quote', 'delete', { documentId: reEdited.id, data: {} }, undefined, {
        id: 'user-1',
        firstname: 'Test',
        lastname: 'User',
        email: 'test@example.com',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await stillExists(reEdited.id)).toBe(true);
  });

  describe('what is attached to the draft', () => {
    it('refuses while a credit note names the draft invoice as its source', async () => {
      const invoice = await insertDocument('invoice', 'draft');
      const creditNote = await insertDocument('credit-note', 'draft', { data: { invoice: invoice.id } });

      await expect(runDelete('invoice', invoice.id)).rejects.toThrow(/credit-note/);
      expect(await stillExists(invoice.id)).toBe(true);

      await runDelete('credit-note', creditNote.id);
      await runDelete('invoice', invoice.id);
      expect(await stillExists(invoice.id)).toBe(false);
    });

    it('refuses while an invoice was converted from the draft quote', async () => {
      const quote = await insertDocument('quote', 'draft');
      await insertDocument('invoice', 'draft', { data: { origin: { entity: 'quote', id: quote.id } } });

      await expect(runDelete('quote', quote.id)).rejects.toBeInstanceOf(ConflictException);
      expect(await stillExists(quote.id)).toBe(true);
    });

    it('refuses while a recurrence uses the draft as its template', async () => {
      const invoice = await insertDocument('invoice', 'draft');
      const schedule = await prisma.documentSchedule.create({
        data: {
          companyId,
          typeId: 'invoice',
          sourceDocumentId: invoice.id,
          actionId: 'duplicate',
          cadence: 'monthly',
          nextRunAt: new Date('2030-01-01T00:00:00.000Z'),
        },
      });

      await expect(runDelete('invoice', invoice.id)).rejects.toThrow(/recurrence/);
      expect(await stillExists(invoice.id)).toBe(true);
      expect(await prisma.documentSchedule.count({ where: { id: schedule.id } })).toBe(1);
    });

    it('returns time entries billed into the draft invoice to unbilled', async () => {
      const client = await prisma.client.create({
        data: { companyId, name: 'Time Client', ...NAME_ONLY_CLIENT_FIELDS },
      });
      const project = await prisma.project.create({ data: { companyId, clientId: client.id, name: 'P' } });
      const invoice = await insertDocument('invoice', 'draft');
      const entry = await prisma.timeEntry.create({
        data: {
          companyId,
          projectId: project.id,
          date: new Date(),
          durationMinutes: 60,
          invoiceId: invoice.id,
        },
      });

      await runDelete('invoice', invoice.id);

      expect((await prisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } })).invoiceId).toBeNull();
    });
  });

  describe.each(DELETABLE_TYPES)('%s', (typeId) => {
    const descriptor = buildService().getType(typeId);
    const issuedStatuses = (descriptor.statuses ?? []).map((s) => s.id).filter((id) => id !== 'draft');

    it('deletes a draft, and refuses (409) in every other status', async () => {
      const draft = await insertDocument(typeId, 'draft');
      const result = await runDelete(typeId, draft.id);
      expect(result.changed).toBe(true);
      expect(await stillExists(draft.id)).toBe(false);

      for (const status of issuedStatuses) {
        // Unnumbered on purpose, so only the status gate can be what refuses it.
        const issued = await insertDocument(typeId, status);
        await expect(runDelete(typeId, issued.id), status).rejects.toBeInstanceOf(ConflictException);
        expect(await stillExists(issued.id), status).toBe(true);
      }
    });
  });
});
