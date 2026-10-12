---
title: "Germany e-invoicing in Invoicerr"
description: "Invoicerr ships Germany country data — policy, identifiers, tax, corrections, B2G routing and channel policy. Which mechanisms are covered, read from the application's own files."
sidebar_label: "Germany (supported)"
keywords: [Germany e-invoicing, XRechnung, ZRE, OZG-RE]
---

# Germany e-invoicing in Invoicerr

:::tip[Invoicerr supports Germany]
Germany is one of five countries with data files in the per-country catalogues, so the application
runs for a company established there. Support is per mechanism, not a single yes or no.
:::

Germany's entries name ZRE and OZG-RE as the public-sector invoice receipt platforms, and XRechnung
as the format they carry.

This page is a pointer by design. Everything Invoicerr knows about Germany lives in its own data
files, and two pages already say it without anyone retyping it:

- [Germany in the country compliance matrix](../country-support/de.md) — every mechanism, and the
  catalogue each answer comes from, regenerated from those files on every docs build.
- [Compliance — Germany](/compliance/de) — the same coverage, written for someone deciding whether
  to use Invoicerr in Germany.

To widen that coverage, or to add a country of your own, see [Adding a
country](../adding-a-country.md): the catalogue files listed on every other page in this directory
are the ones Germany already has.

## Fallback payment term

The `paymentTerms.fallbackTerm` entry of `countries/data/de.json` is the 30 days an invoice's due
date falls back to when the company has no default term of its own (see [Payment
terms](../../user-guide/settings/payment-terms.md)). BGB § 286 Abs. 3 puts a debtor in default at
the latest 30 days after the due date and receipt of the invoice (`basis: "latePaymentThreshold"`).
It sets no payment term: without an agreed date a claim is due at once (BGB § 271 Abs. 1). The
application counts the 30 days from the invoice date, not from receipt of the invoice.
