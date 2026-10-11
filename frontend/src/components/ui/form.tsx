"use client"

import * as React from "react"
import type * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { FieldLabel } from "@/components/ui/field-help"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formLabelId: `${id}-form-item-label`,
    formDescriptionId: `${id}-form-item-description`,
    formLockId: `${id}-form-item-lock`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue)

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId()

    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    )
  },
)
FormItem.displayName = "FormItem"

function FormLabel({
  className,
  required,
  description,
  helpDataCy,
  lockReason,
  lockDataCy,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
  required?: boolean
  description?: React.ReactNode
  helpDataCy?: string
  lockReason?: React.ReactNode
  lockDataCy?: string
}) {
  const { error, formItemId, formLabelId, formDescriptionId, formLockId } = useFormField()

  return (
    <FieldLabel
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      id={formLabelId}
      htmlFor={formItemId}
      required={required}
      description={description}
      descriptionId={formDescriptionId}
      helpDataCy={helpDataCy}
      lockReason={lockReason}
      lockReasonId={formLockId}
      lockDataCy={lockDataCy}
      {...props}
    />
  )
}

// The help and lock ids are always listed; a reference to a node that is not rendered is ignored.
const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ")

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formLockId, formMessageId } = useFormField()

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={describedBy(formDescriptionId, formLockId, error && formMessageId)}
      aria-invalid={!!error}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

// For a control made of several inputs: the label cannot point at a group, so the group names itself.
const FormGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => {
  const { error, formItemId, formLabelId, formDescriptionId, formLockId, formMessageId } = useFormField()

  return (
    <div
      ref={ref}
      role="group"
      id={formItemId}
      aria-labelledby={formLabelId}
      aria-describedby={describedBy(formDescriptionId, formLockId, error && formMessageId)}
      aria-invalid={!!error}
      {...props}
    />
  )
})
FormGroup.displayName = "FormGroup"

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField()
    const body = error ? String(error?.message) : children

    if (!body) {
      return null
    }

    return (
      <p
        ref={ref}
        id={formMessageId}
        className={cn("text-sm font-medium text-destructive", className)}
        {...props}
      >
        {body}
      </p>
    )
  },
)
FormMessage.displayName = "FormMessage"

export { useFormField, Form, FormItem, FormLabel, FormControl, FormGroup, FormMessage, FormField }
