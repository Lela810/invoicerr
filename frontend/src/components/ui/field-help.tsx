"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import { CircleHelp } from "lucide-react"
import type * as React from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Label } from "@/components/ui/label"
import { PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// Focus from a mouse press must not open the help (the click that follows would toggle it shut
// again), so focus only opens it when the last input was the keyboard.
let lastInputWasKeyboard = false
if (typeof document !== "undefined") {
  document.addEventListener("keydown", () => (lastInputWasKeyboard = true), true)
  document.addEventListener("pointerdown", () => (lastInputWasKeyboard = false), true)
}

/**
 * The `?` next to a field label. The description lives in a visually hidden node carrying `id`, so
 * the input it describes points at it with `aria-describedby`; the popover is the sighted copy.
 */
export function FieldHelp({
  id,
  children,
  dataCy,
  className,
}: {
  id: string
  children: React.ReactNode
  dataCy?: string
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)

  const show = (pin: boolean) => {
    setOpen(true)
    setPinned(pin)
  }
  const hide = () => {
    setOpen(false)
    setPinned(false)
  }

  return (
    <>
      <span id={id} className="sr-only" data-cy={dataCy}>
        {children}
      </span>
      <PopoverPrimitive.Root open={open} onOpenChange={(next) => (next ? show(true) : hide())}>
        <PopoverPrimitive.Trigger
          type="button"
          aria-label={t("common.fieldHelp.trigger")}
          data-cy={dataCy ? `${dataCy}-trigger` : "field-help-trigger"}
          className={cn(
            "-my-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:text-foreground",
            className,
          )}
          onPointerEnter={(event) => {
            if (event.pointerType !== "touch" && !open) show(false)
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch" && !pinned) hide()
          }}
          onFocus={() => {
            if (lastInputWasKeyboard) show(true)
          }}
          onClick={(event) => {
            event.preventDefault()
            if (open && pinned) hide()
            else show(true)
          }}
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
        </PopoverPrimitive.Trigger>
        <PopoverContent
          side="top"
          align="start"
          collisionPadding={16}
          data-cy={dataCy ? `${dataCy}-content` : "field-help-content"}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="w-auto max-w-[min(20rem,calc(100vw-2rem))] p-3 text-sm leading-relaxed text-pretty break-words whitespace-pre-line"
        >
          {children}
        </PopoverContent>
      </PopoverPrimitive.Root>
    </>
  )
}

/**
 * A field label: `Name *` when required, followed by the `?` help when a description is given.
 * Outside react-hook-form, pass `descriptionId` and point the input's `aria-describedby` at it.
 */
export function FieldLabel({
  children,
  required,
  description,
  descriptionId,
  helpDataCy,
  className,
  ...props
}: React.ComponentProps<typeof Label> & {
  required?: boolean
  description?: React.ReactNode
  descriptionId?: string
  helpDataCy?: string
}) {
  const label = (
    <Label className={cn(required && "gap-1", className)} {...props}>
      {children}
      {required && <span className="text-destructive">*</span>}
    </Label>
  )
  if (!description || !descriptionId) return label
  return (
    <div className="flex items-center gap-1" data-slot="field-label-row">
      {label}
      <FieldHelp id={descriptionId} dataCy={helpDataCy}>
        {description}
      </FieldHelp>
    </div>
  )
}
