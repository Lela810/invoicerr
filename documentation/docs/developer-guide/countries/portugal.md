---
title: "Portugal e-invoicing in Invoicerr"
description: "Invoicerr ships Portugal country data — policy, identifiers, tax, corrections, B2G routing and channel policy. Which mechanisms are covered, read from the application's own files."
sidebar_label: "Portugal (supported)"
keywords: [Portugal e-invoicing, FE-AP, UBL]
---

# Portugal e-invoicing in Invoicerr

:::tip[Invoicerr supports Portugal]
Portugal is one of five countries with data files in the per-country catalogues, so the application
runs for a company established there. Support is per mechanism, not a single yes or no.
:::

Portugal's B2G entry (selling to a government client) names FE-AP as the transmission platform, and
UBL 2.1 as the format it carries; there is no channel mandate for an ordinary B2B seller. `fe-ap` is
not backed by a transport this app talks to yet, so a send to a government client is refused, naming
the channel, rather than silently falling back to email. The AT monthly declaration now carries each
document's real ATCUD and declares credit notes too (as `NC`, referencing the invoice they correct).
See [Compliance - Portugal](/compliance/pt) for the full, sourced picture.

This page is a pointer by design. Everything Invoicerr knows about Portugal lives in its own data
files, and two pages already say it without anyone retyping it:

- [Portugal in the country compliance matrix](../country-support/pt.md) — every mechanism, and the
  catalogue each answer comes from, regenerated from those files on every docs build.
- [Compliance — Portugal](/compliance/pt) — the same coverage, written for someone deciding whether
  to use Invoicerr in Portugal.

To widen that coverage, or to add a country of your own, see [Adding a
country](../adding-a-country.md): the catalogue files listed on every other page in this directory
are the ones Portugal already has.

## Default payment term

The `paymentTerms.defaultTerm` entry of `countries/data/pt.json` holds the term that applies when
the parties agreed none: 30 days, from Decreto-Lei n.º 62/2013, art. 4.º, n.º 3, alínea a): 30 days from the debtor's receipt of the invoice when the contract sets no date. An invoice gets its due date from it when the company
has no default term of its own (see [Payment terms](../../user-guide/settings/payment-terms.md)). The
statute counts from receipt, which the application cannot know, so the days are counted from the
invoice date.
