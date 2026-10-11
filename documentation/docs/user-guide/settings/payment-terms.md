---
sidebar_position: 4
---

# Payment terms

**Settings > Invoicing > Payment terms** sets the due date a new quote or invoice starts with, so you
do not have to pick it on every document. Quotes and invoices each have their own setting.

- **Number of days** - how many days after the issue date the document falls due. Leave it empty to
  keep a quote's due date blank, and to let an invoice fall back to your country's default term
  (below).
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
- **Duplicated invoice**: the copy is dated today, and its due date is today plus the invoice term.

In both cases the due date stays editable on the new draft.

Recurring invoices keep their own date logic: each occurrence keeps the gap between the date and the
due date of the invoice it repeats.

## Country default for invoices

When you leave the invoice term empty, an invoice still gets a due date: your country's statutory
default payment term, the period the law applies when the parties agreed none. It is 30 days in
each of the five supported countries (France, Germany, Italy, Poland and Portugal), and each value
is read from that country's data file together with its legal source. Quotes have no country
default.

:::info[Counted from the invoice date]
The statutes count those 30 days from receipt of the invoice, or of the goods or service. The
application cannot know that date, so it counts from the invoice date, which gives the earliest due
date the law allows. Set your own term if your contracts say otherwise.
:::

## Legal maximum

Where your country's law caps the payment term between businesses, the screen shows a warning when
the days you enter exceed it. The warning never blocks the save: it tells you the term may not be
enforceable, nothing more. A country with no known cap shows no warning. See
[France](../../developer-guide/countries/france.md#payment-term-cap) for the cap that is configured
today.
