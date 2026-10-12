---
sidebar_position: 15
---

# UI Conventions

Conventions the frontend (`frontend/src`) follows, so every screen behaves the same way.

## Field labels and descriptions

A field's label reads `Name *` when the field is required. When the field has a description, a
small `?` follows the label: hovering, tapping or keyboard-focusing it opens the description in a
popover, and tapping elsewhere or pressing Escape closes it. Nothing is printed under the field
except a validation error.

Inside a react-hook-form `FormItem`, pass the description to `FormLabel`. It is wired to the input
with `aria-describedby`, and `FormMessage` still renders errors under the field:

```tsx
<FormItem>
  <FormLabel required description={t("settings.company.form.iban.description")}>
    {t("settings.company.form.iban.label")}
  </FormLabel>
  <FormControl>
    <Input {...field} />
  </FormControl>
  <FormMessage />
</FormItem>
```

Outside a form, use `FieldLabel` from `@/components/ui/field-help`. The description id is derived
from `htmlFor`, so point the input at `fieldHelpId(id)`:

```tsx
<FieldLabel htmlFor="pattern" description={t("settings.declareLastNumber.patternHint")}>
  {t("settings.declareLastNumber.pattern")}
</FieldLabel>
<Input id="pattern" aria-describedby={fieldHelpId("pattern")} />
```

### Locked fields

A field disabled by a business rule, such as a credit note's currency once it follows the linked
invoice, shows a red lock after its label. Hovering, tapping or keyboard-focusing the lock opens the
reason, with the same behaviour as the `?`: a short close delay so the pointer can reach the text,
Escape and a tap elsewhere close it. The lock carries only the reason; the `?` keeps the field's
ordinary description. Screen readers name the lock button after the field, as in "Why is Currency locked?".

Pass the reason to `FormLabel` with `lockReason`, and disable the control yourself. `FormControl`
adds the reason to the input's `aria-describedby`, after the description:

```tsx
<FormLabel lockReason={isLocked ? t("documents.form.select.lockedFromReference") : undefined}>
  {field.label}
</FormLabel>
<FormControl>
  <SearchSelect disabled={isLocked} {...props} />
</FormControl>
```

Outside a form, `FieldLabel` takes the same `lockReason` and derives the id from `htmlFor`; point the
input at `fieldLockId(id)`. A control without a field label, such as a radio inside a row, can place
`FieldLock` next to its own label and point the control at the same id.

### Custom controls

`FormControl` passes `id`, `aria-describedby` and `aria-invalid` to its direct child. A custom control
placed inside it must forward those three props to its focusable element, or the label and the
description reach nothing. For a Radix `Select`, put `FormControl` around the `SelectTrigger`, not
around the `Select`. When a field is made of several inputs, such as a file picker or a checklist,
use `FormGroup` in place of `FormControl`: it renders a `role="group"` container named by the label
and described by the help.

:::warning[Enforced in CI]
`src/components/ui/field-help.guard.spec.ts` fails the frontend unit tests when a description is
rendered under a field again: the removed `FormDescription` component, or muted helper text
(`text-muted-foreground`) placed right after a control, a label, or anywhere in a `FormItem` outside
its `FormControl`. The only muted lines allowed next to a control report live state, carry
`role="status"`, and are named by their `data-cy` in the guard's allow-list. A lock reason printed
next to a control is flagged in any colour: a text element whose key, variable or `data-cy` names a
lock belongs behind the label's lock instead.
:::

## Accessibility checks

Every control has an accessible name, and that name contains the text the control shows (WCAG 2.5.3).
A button that hides its label on small screens, such as an icon-only "Import" below `md`, keeps it in
`aria-label` and marks its icon `aria-hidden`. A link whose visible text is not the whole story keeps
that text as its name and adds the rest as screen-reader-only text after it, rather than replacing it
with an `aria-label`. Headings go down one level at a time: a list row or an empty state under a page
`h1` is an `h2`. A page has one `main`, the layout's: a screen's own content area is a
plain element. A toggle that opens a group carries `aria-expanded`, and the group's list sits inside
the toggle's own list item.

The Cypress specs of the key screens (document lists and detail, the document editor and its line
rows, the create-document, delete-confirmation and client dialogs, onboarding, sign-in, sign-up and
the company settings) call `cy.assertAccessible()` from `e2e/cypress/support/a11y.ts`. It runs
[axe-core](https://github.com/dequelabs/axe-core) on the page through `cypress-axe` and fails the test
on any **serious** or **critical** violation, printing each one with its rule and element to the
runner output:

```ts
cy.assertAccessible() // the whole page, serious and critical violations fail
cy.assertAccessible({ context: '[data-cy="client-dialog"]' }) // one region
cy.assertAccessible({ rules: ["heading-order"] }) // only these rules, at every impact level
```

Call it once the screen has settled, after the element the test waits for, and again after a dialog
opens or a step changes. To run it locally, start the e2e stack and run one spec:

```bash
cd e2e
npx cypress run --browser firefox --spec "cypress/e2e/05-clients.cy.ts"
```

Never disable an axe rule for the whole suite. A violation inside a third-party element the app does
not control may be excluded with `context: { exclude: [...] }` at the one call site that needs it, with
a one-line comment naming the element.

:::warning[Enforced in CI]
The axe checks run with the Cypress suite on every pull request. On the pull request from `dev` to
`main`, `lighthouse.yml` also fails when an audited page scores below 100 in Lighthouse accessibility.
:::
