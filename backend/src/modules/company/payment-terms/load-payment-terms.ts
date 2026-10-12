import { NotFoundException } from '@nestjs/common';

import prisma from '@/prisma/prisma.service';
import { guessCountryCode } from '@/utils/country-name-to-iso';
import {
  computeDueDate,
  effectiveInvoiceTerm,
  ResolvedPaymentTerms,
  resolvePaymentTerms,
} from './resolve-payment-terms';

export async function loadPaymentTerms(companyId: string): Promise<ResolvedPaymentTerms> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      quoteDueDays: true,
      quoteDueMode: true,
      invoiceDueDays: true,
      invoiceDueMode: true,
      countryCode: true,
      country: true,
    },
  });
  if (!company) {
    throw new NotFoundException(`Company "${companyId}" not found.`);
  }
  const countryCode = company.countryCode || guessCountryCode(company.country ?? undefined) || '';
  return resolvePaymentTerms({ ...company, countryCode });
}

/** The due date a new invoice dated `issueDate` gets by default, or `undefined` when neither the
 *  company nor its country declares a term. */
export async function defaultInvoiceDueDate(
  companyId: string,
  issueDate: string,
): Promise<string | undefined> {
  const term = effectiveInvoiceTerm(await loadPaymentTerms(companyId));
  return term ? computeDueDate(issueDate, term) : undefined;
}
