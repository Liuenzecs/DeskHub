import { Sparkles, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'
import type { BatchEditItemsPayload, BatchTagMode } from '../types/items'

interface BatchEditModalProps {
  open: boolean
  selectedCount: number
  onClose: () => void
  onSubmit: (payload: Omit<BatchEditItemsPayload, 'ids'>) => Promise<void>
}

export function BatchEditModal({
  open,
  selectedCount,
  onClose,
  onSubmit,
}: BatchEditModalProps) {
  const [applyDescription, setApplyDescription] = useState(false)
  const [applyIcon, setApplyIcon] = useState(false)
  const [applyTags, setApplyTags] = useState(false)
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [tags, setTags] = useState('')
  const [tagMode, setTagMode] = useState<BatchTagMode>('replace')
  const [submitting, setSubmitting] = useState(false)
  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open,
    onClose,
  })

  useEffect(() => {
    if (!open) {
      return
    }

    setApplyDescription(false)
    setApplyIcon(false)
    setApplyTags(false)
    setDescription('')
    setIcon('')
    setTags('')
    setTagMode('replace')
    setSubmitting(false)
  }, [open])

  if (!open) {
    return null
  }

  const hasChanges = applyDescription || applyIcon || applyTags

  return (
    <div className="modal-backdrop overflow-y-auto" onClick={onClose}>
      <div
        ref={containerRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-shell max-w-2xl"
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <div className="modal-header">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef5fd] text-[color:var(--accent)]">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="modal-kicker">Batch Edit</div>
              <h2 className="modal-title" id={titleId}>
                批量编辑条目
              </h2>
              <p className="modal-description" id={descriptionId}>
                本次会同时更新 {selectedCount} 个条目，只会应用你显式勾选的字段。
              </p>
            </div>
          </div>
          <button aria-label="关闭批量编辑" className="btn-icon" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="modal-body grid gap-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (!hasChanges) {
              return
            }

            void (async () => {
              setSubmitting(true)
              try {
                await onSubmit({
                  description: applyDescription ? description : undefined,
                  icon: applyIcon ? icon : undefined,
                  tags: applyTags
                    ? tags
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean)
                    : undefined,
                  tagMode,
                })
              } finally {
                setSubmitting(false)
              }
            })()
          }}
        >
          <div className="modal-panel flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[color:var(--text)]">修改策略</div>
              <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                描述、标签和图标都支持按需更新，不会影响未勾选字段。
              </div>
            </div>
            <span className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--text-muted)]">
              {selectedCount} 项
            </span>
          </div>

          <label className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
            <div className="flex items-center gap-3">
              <input
                checked={applyDescription}
                className="h-4 w-4 rounded border-slate-300"
                type="checkbox"
                onChange={(event) => setApplyDescription(event.target.checked)}
              />
              <div>
                <div className="text-sm font-semibold text-[color:var(--text)]">批量更新描述</div>
                <div className="text-sm text-[color:var(--text-muted)]">同一段说明会写入全部选中条目。</div>
              </div>
            </div>
            <textarea
              className="field min-h-24 resize-y"
              disabled={!applyDescription}
              placeholder="例如：团队共享入口，请勿删除"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
            <div className="flex items-center gap-3">
              <input
                checked={applyTags}
                className="h-4 w-4 rounded border-slate-300"
                type="checkbox"
                onChange={(event) => setApplyTags(event.target.checked)}
              />
              <div>
                <div className="text-sm font-semibold text-[color:var(--text)]">批量更新标签</div>
                <div className="text-sm text-[color:var(--text-muted)]">支持直接替换，也支持把新标签追加进去。</div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[180px,1fr]">
              <select
                className="field"
                disabled={!applyTags}
                value={tagMode}
                onChange={(event) => setTagMode(event.target.value as BatchTagMode)}
              >
                <option value="replace">替换现有标签</option>
                <option value="append">追加到现有标签</option>
              </select>
              <input
                className="field"
                disabled={!applyTags}
                placeholder="例如：daily, frontend"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
            </div>
          </label>

          <label className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
            <div className="flex items-center gap-3">
              <input
                checked={applyIcon}
                className="h-4 w-4 rounded border-slate-300"
                type="checkbox"
                onChange={(event) => setApplyIcon(event.target.checked)}
              />
              <div>
                <div className="text-sm font-semibold text-[color:var(--text)]">批量更新图标</div>
                <div className="text-sm text-[color:var(--text-muted)]">把同一个 icon key 应用到所有选中条目。</div>
              </div>
            </div>
            <input
              className="field"
              disabled={!applyIcon}
              placeholder="例如：rocket"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
            />
          </label>

          <div className="modal-footer px-0 pb-0">
            <button className="btn-secondary" type="button" onClick={onClose}>
              取消
            </button>
            <button className="btn-primary" disabled={!hasChanges || submitting} type="submit">
              {submitting ? '应用中...' : '应用到所选条目'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
