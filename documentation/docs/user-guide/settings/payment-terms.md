---
sidebar_position: 4
---

# Payment terms

**Settings > Invoicing > Payment terms** sets the due date a new quote or invoice starts with, so you
do not have to pick it on every document. Quotes and invoices each have their own setting.

- **Number of days** - how many days after the issue date the document falls due. Leave it empty to
  keep a quote's due date blank, and to let an invoice use the country fallback (below).
- **Counted** - **Net, from the issue date** adds the days to the issue date. **End of month, from
  the issue date** adds the days, then moves to the last day of the month it lands in. An invoice
  issued on 15 October with 30 days, end of month, is due on 30 November.

## How it applies

As soon as you pick the issue date on a new quote or invoice, the due date is filled in. Changing the
issue date recalculates it, until you edit the due date yourself: from then on your own value is
kept. A document that already exists is never changed by this setting.

The same rule fills the due date of an invoice made from another document:

- **Invoice created from a quote** (including a deposit invoice): the invoice's own date plus the
  invoice term. The quote's due date is its validity, and is never copied.
- **Duplicated invoice**: the copy is dated today (the current UTC date), and its due date is that
  date plus the invoice term.

In both cases the due date stays editable on the new draft.

Recurring invoices keep their own date logic: each occurrence keeps the gap between the date and the
due date of the invoice it repeats.

## Country fallback for invoices

When you leave the invoice term empty, an invoice still gets a due date: 30 days after the invoice
date in each of the five supported countries (France, Germany, Italy, Poland and Portugal). Quotes
have no fallback.

None of these countries sets a payment term by law. The 30 days come from what each statute does
say, quoted in that country's data file:

- **France** and **Italy**: the payment period may not exceed 30 days when nothing was agreed.
  France counts from receipt of the goods or performance of the service, Italy from receipt of the
  invoice.
- **Germany**: a debtor is in default at the latest 30 days after the due date and receipt of the
  invoice; without an agreed date, payment is due at once.
- **Portugal**: late-payment interest is due 30 days after the debtor receives the invoice, when
  the contract sets no date.
- **Poland**: statutory interest runs 30 days after you have performed, when the contract sets no
  payment date.

:::info[Counted from the invoice date]
Those statutes count from receipt of the invoice, of the goods or service, or from your own
performance. The application cannot know those dates and counts from the invoice date instead, so
the result can differ from the statutory date. Set your own term if your contracts say otherwise.
:::

## Legal maximum

Where your country's law caps the payment term between businesses, the screen shows a warning when
the days you enter exceed it. The warning never blocks the save: it tells you the term may not be
enforceable, nothing more. A country with no known cap shows no warning. See
[France](../../developer-guide/countries/france.md#payment-term-cap) for the cap that is configured
today.
