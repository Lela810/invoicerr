"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import { CircleHelp } from "lucide-react"
import type * as React from "react"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Label } from "@/components/ui/label"
import { PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export const fieldHelpId = (fieldId: string) => `${fieldId}-help`

// Only a Tab press opens the help on focus, so a dialog's autofocus or a focus restore never does.
let focusCameFromTab = false
if (typeof document !== "undefined") {
  document.addEventListener("keydown", (event) => (focusCameFromTab = event.key === "Tab"), true)
  document.addEventListener("pointerdown", () => (focusCameFromTab = false), true)
}

type FieldHelpProps = Readonly<{
  id: string
  children: React.ReactNode
  label?: string
  dataCy?: string
  className?: string
}>

// The hidden node is what aria-describedby resolves; the popover is the sighted copy.
export function FieldHelp({ id, children, label, dataCy, className }: FieldHelpProps) {
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
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const hoverIn = (event: React.PointerEvent) => {
    if (event.pointerType === "touch") return
    clearTimeout(closeTimer.current)
    if (!open) show(false)
  }
  // A short delay lets the pointer cross from the trigger onto the text without closing it (WCAG 1.4.13).
  const hoverOut = (event: React.PointerEvent) => {
    if (event.pointerType === "touch" || pinned) return
    closeTimer.current = setTimeout(hide, 150)
  }

  return (
    <>
      <span id={id} hidden data-cy={dataCy}>
        {children}
      </span>
      <PopoverPrimitive.Root open={open} onOpenChange={(next) => (next ? show(true) : hide())}>
        <PopoverPrimitive.Trigger
          type="button"
          aria-label={
            label ? t("common.fieldHelp.triggerFor", { field: label }) : t("common.fieldHelp.trigger")
          }
          data-cy={dataCy ? `${dataCy}-trigger` : "field-help-trigger"}
          className={cn(
            "relative -my-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:text-foreground",
            className,
          )}
          onPointerEnter={hoverIn}
          onPointerLeave={hoverOut}
          onFocus={() => {
            if (focusCameFromTab) show(true)
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
          onPointerEnter={hoverIn}
          onPointerLeave={hoverOut}
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

type FieldLabelProps = React.ComponentProps<typeof Label> &
  Readonly<{
    required?: boolean
    description?: React.ReactNode
    descriptionId?: string
    helpDataCy?: string
  }>

// Without descriptionId, the id is fieldHelpId(htmlFor), or a generated one when htmlFor is absent.
export function FieldLabel({
  children,
  required,
  description,
  descriptionId,
  helpDataCy,
  className,
  ...props
}: FieldLabelProps) {
  const generatedId = useId()
  const label = (
    <Label className={cn(required && "gap-1", className)} {...props}>
      {children}
      {required && <span className="text-destructive">*</span>}
    </Label>
  )
  if (!description) return label
  return (
    <div className="flex items-center gap-1" data-slot="field-label-row">
      {label}
      <FieldHelp
        id={descriptionId ?? fieldHelpId(props.htmlFor ?? generatedId)}
        label={typeof children === "string" ? children : undefined}
        dataCy={helpDataCy}
      >
        {description}
      </FieldHelp>
    </div>
  )
}
