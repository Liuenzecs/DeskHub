import { AlertTriangle } from 'lucide-react'
import { useModalDialog } from '../hooks/useModalDialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open,
    onClose: onCancel,
  })

  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop z-[70] flex items-center justify-center" onClick={onCancel}>
      <div
        ref={containerRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-shell max-w-md"
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <div className="modal-header">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff4e8] text-[#b54708]">
              <AlertTriangle className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="modal-kicker">确认操作</div>
              <h2 className="modal-title" id={titleId}>
                {title}
              </h2>
              <p className="modal-description" id={descriptionId}>
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="btn-danger" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
