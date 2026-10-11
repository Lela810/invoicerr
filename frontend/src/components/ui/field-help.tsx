"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import { CircleHelp, Lock } from "lucide-react"
import type * as React from "react"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Label } from "@/components/ui/label"
import { PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export const fieldHelpId = (fieldId: string) => `${fieldId}-help`
export const fieldLockId = (fieldId: string) => `${fieldId}-lock`

// Only a Tab press opens the help on focus, so a dialog's autofocus or a focus restore never does.
let focusCameFromTab = false
if (typeof document !== "undefined") {
  document.addEventListener("keydown", (event) => (focusCameFromTab = event.key === "Tab"), true)
  document.addEventListener("pointerdown", () => (focusCameFromTab = false), true)
}

type LabelHintProps = Readonly<{
  id: string
  children: React.ReactNode
  triggerLabel: string
  icon: React.ReactNode
  triggerDataCy: string
  contentDataCy: string
  dataCy?: string
  className?: string
}>

// The hidden node is what aria-describedby resolves; the popover is the sighted copy.
function LabelHint({
  id,
  children,
  triggerLabel,
  icon,
  triggerDataCy,
  contentDataCy,
  dataCy,
  className,
}: LabelHintProps) {
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
          aria-label={triggerLabel}
          data-cy={triggerDataCy}
          className={cn(
            "relative -my-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors after:absolute after:-inset-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
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
          {icon}
        </PopoverPrimitive.Trigger>
        <PopoverContent
          side="top"
          align="start"
          collisionPadding={16}
          data-cy={contentDataCy}
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

type FieldHelpProps = Readonly<{
  id: string
  children: React.ReactNode
  label?: string
  dataCy?: string
  className?: string
}>

export function FieldHelp({ id, children, label, dataCy, className }: FieldHelpProps) {
  const { t } = useTranslation()
  return (
    <LabelHint
      id={id}
      triggerLabel={
        label ? t("common.fieldHelp.triggerFor", { field: label }) : t("common.fieldHelp.trigger")
      }
      icon={<CircleHelp className="size-3.5" aria-hidden="true" />}
      triggerDataCy={dataCy ? `${dataCy}-trigger` : "field-help-trigger"}
      contentDataCy={dataCy ? `${dataCy}-content` : "field-help-content"}
      dataCy={dataCy}
      className={cn(
        "text-muted-foreground hover:text-foreground data-[state=open]:text-foreground",
        className,
      )}
    >
      {children}
    </LabelHint>
  )
}

type FieldLockProps = Readonly<{
  id: string
  children: React.ReactNode
  label?: string
  dataCy?: string
}>

export function FieldLock({ id, children, label, dataCy }: FieldLockProps) {
  const { t } = useTranslation()
  return (
    <LabelHint
      id={id}
      triggerLabel={
        label ? t("common.fieldLock.triggerFor", { field: label }) : t("common.fieldLock.trigger")
      }
      icon={<Lock className="size-3.5" aria-hidden="true" />}
      triggerDataCy={dataCy ? `${dataCy}-trigger` : "field-lock-trigger"}
      contentDataCy={dataCy ? `${dataCy}-content` : "field-lock-content"}
      dataCy={dataCy}
      className="text-destructive hover:text-destructive/80"
    >
      {children}
    </LabelHint>
  )
}

type FieldLabelProps = React.ComponentProps<typeof Label> &
  Readonly<{
    required?: boolean
    description?: React.ReactNode
    descriptionId?: string
    helpDataCy?: string
    lockReason?: React.ReactNode
    lockReasonId?: string
    lockDataCy?: string
  }>

// Without descriptionId or lockReasonId, the ids derive from htmlFor, or a generated one when it is absent.
export function FieldLabel({
  children,
  required,
  description,
  descriptionId,
  helpDataCy,
  lockReason,
  lockReasonId,
  lockDataCy,
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
  if (!description && !lockReason) return label
  const fieldId = props.htmlFor ?? generatedId
  const fieldName = typeof children === "string" ? children : undefined
  return (
    <div className="flex items-center gap-1" data-slot="field-label-row">
      {label}
      {lockReason && (
        <FieldLock id={lockReasonId ?? fieldLockId(fieldId)} label={fieldName} dataCy={lockDataCy}>
          {lockReason}
        </FieldLock>
      )}
      {description && (
        <FieldHelp id={descriptionId ?? fieldHelpId(fieldId)} label={fieldName} dataCy={helpDataCy}>
          {description}
        </FieldHelp>
      )}
    </div>
  )
}
