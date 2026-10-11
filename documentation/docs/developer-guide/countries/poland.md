---
title: "Poland e-invoicing in Invoicerr"
description: "Invoicerr ships Poland country data — policy, identifiers, tax, corrections, B2G routing and channel policy. Which mechanisms are covered, read from the application's own files."
sidebar_label: "Poland (supported)"
keywords: [Poland e-invoicing, FA(3), KSeF]
---

# Poland e-invoicing in Invoicerr

:::tip[Invoicerr supports Poland]
Poland is one of five countries with data files in the per-country catalogues, so the application
runs for a company established there. Support is per mechanism, not a single yes or no.
:::

Poland's entries name KSeF as its invoice transmission platform, and FA(3) as the format it carries.
A Polish seller's foreign-currency invoice also states its VAT in PLN, sourced to the NBP's own
Table A rather than the ECB, frozen at issue.

This page is a pointer by design. Everything Invoicerr knows about Poland lives in its own data
files, and two pages already say it without anyone retyping it:

- [Poland in the country compliance matrix](../country-support/pl.md) — every mechanism, and the
  catalogue each answer comes from, regenerated from those files on every docs build.
- [Compliance — Poland](/compliance/pl) — the same coverage, written for someone deciding whether
  to use Invoicerr in Poland.

To widen that coverage, or to add a country of your own, see [Adding a
country](../adding-a-country.md): the catalogue files listed on every other page in this directory
are the ones Poland already has.

## Default payment term

The `paymentTerms.defaultTerm` entry of `countries/data/pl.json` holds the term that applies when
the parties agreed none: 30 days, from the Act of 8 March 2013 on preventing excessive delays in commercial transactions, art. 6 ust. 1: statutory interest runs 30 days after the creditor's performance when the contract sets no payment date. An invoice gets its due date from it when the company
has no default term of its own (see [Payment terms](../../user-guide/settings/payment-terms.md)). The
statute counts from receipt, which the application cannot know, so the days are counted from the
invoice date.
