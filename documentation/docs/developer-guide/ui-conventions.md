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

Outside a form, use `FieldLabel` from `@/components/ui/field-help` and point the input at the same
`descriptionId`:

```tsx
<FieldLabel htmlFor="pattern" description={t("settings.declareLastNumber.patternHint")} descriptionId="pattern-help">
  {t("settings.declareLastNumber.pattern")}
</FieldLabel>
<Input id="pattern" aria-describedby="pattern-help" />
```

:::warning[Enforced in CI]
`src/components/ui/field-help.guard.spec.ts` fails the frontend unit tests when a description is
rendered under a field again: the removed `FormDescription` component, or muted helper text
(`text-muted-foreground`) placed right after a control, a label, or anywhere in a `FormItem` outside
its `FormControl`. A line that reports live state rather than describing the field, such as an
upload count, is marked `role="status"` and is allowed.
:::
