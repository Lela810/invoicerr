import { ActionExtensionRegistry } from './action-extensions';
import { ActionRegistry } from './action-registry';
import { applyDateRecalc, registerDuplicateExtension } from './duplicate-extension';
import { withDefaultDueDate } from './quote-to-invoice';

/**
 * Where a THIRD PARTY's extra actions get attached to an EXISTING type — none of this touches the
 * type's own descriptor factory above. Adding "duplicate" to quotes is exactly this one line, the
 * same way registering the quote type itself is exactly one line in buildDocumentTypeRegistry.
 *
 * Only the invoice gets `dateRecalc`: recomputing `issueDate`/`dueDate` on a scheduled occurrence
 * (schedules/) is exactly what the invoice case needs — the quote has no
 * recurrence screen wired to it today, so there is no real caller yet to build a `dateRecalc` for
 * without inventing one. Nothing here wires "send" chaining onto "duplicate" — see
 * duplicate-extension.ts's own header ("Why 'then send' does NOT live here") for why that is now
 * schedule-sweep-runner.ts's job instead.
 */
export function buildActionExtensionRegistry(actionRegistry: ActionRegistry): ActionExtensionRegistry {
  const registry = new ActionExtensionRegistry();
  registerDuplicateExtension('quote', registry, actionRegistry);
  const invoiceDateRecalc = { anchorField: 'issueDate', dependentFields: ['dueDate'] };
  registerDuplicateExtension('invoice', registry, actionRegistry, {
    dateRecalc: invoiceDateRecalc,
    prepareManualCopy: async (companyId, sourceData) => {
      const today = new Date().toISOString().slice(0, 10);
      const redated = applyDateRecalc(sourceData, today, invoiceDateRecalc);
      return withDefaultDueDate(companyId, { ...redated, issueDate: today });
    },
  });
  return registry;
}
