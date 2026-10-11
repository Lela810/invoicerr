import { useTranslation } from "react-i18next"

import { ConfirmationDialog } from "@/components/confirmation-dialog"

interface DocumentDeleteConfirmDialogProps {
  onCancel: () => void
  onConfirm: () => void
  loading: boolean
  dataCy: string
}

/** The confirmation every "delete" goes through, from a list row or from the record's own page. */
export function DocumentDeleteConfirmDialog({
  onCancel,
  onConfirm,
  loading,
  dataCy,
}: DocumentDeleteConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      title={t("documents.form.deleteConfirmation.title")}
      description={t("documents.form.deleteConfirmation.description")}
      confirmLabel={t("documents.form.deleteConfirmation.confirm")}
      cancelLabel={t("documents.form.deleteConfirmation.cancel")}
      onConfirm={onConfirm}
      loading={loading}
      destructive
      dataCy={dataCy}
    />
  )
}
