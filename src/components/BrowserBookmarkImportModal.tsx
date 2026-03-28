import { Bookmark, CheckSquare, Globe, Square, X } from 'lucide-react'
import { useMemo } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'
import type { BrowserBookmarkScanResponse } from '../types/items'

interface BrowserBookmarkImportModalProps {
  open: boolean
  scan: BrowserBookmarkScanResponse
  selectedIds: string[]
  busy: boolean
  onClose: () => void
  onToggleId: (id: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onConfirm: () => void
}

export function BrowserBookmarkImportModal({
  open,
  scan,
  selectedIds,
  busy,
  onClose,
  onToggleId,
  onSelectAll,
  onClearSelection,
  onConfirm,
}: BrowserBookmarkImportModalProps) {
  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open,
    onClose,
  })

  const importableIds = useMemo(
    () => scan.candidates.filter((candidate) => !candidate.existingItemId).map((candidate) => candidate.id),
    [scan.candidates],
  )

  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop z-[60] flex items-center justify-center" onClick={onClose}>
      <div
        ref={containerRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-shell max-h-[calc(100vh-4rem)] max-w-5xl"
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <div className="modal-header">
          <div>
            <div className="modal-kicker">Bookmark Import</div>
            <h3 className="modal-title text-lg" id={titleId}>
              导入浏览器收藏夹
            </h3>
            <p className="modal-description" id={descriptionId}>
              DeskHub 会扫描 Windows 下的 Chrome / Edge 收藏夹文件，并把选中的网址导入为网站条目。
            </p>
          </div>
          <button aria-label="关闭浏览器收藏夹导入预览" className="btn-icon" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-body flex-1 overflow-y-auto">
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  浏览器来源
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--text)]">{scan.sourceCount} 个配置</div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  扫描结果
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--text)]">{scan.candidateCount} 个收藏夹条目</div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  可导入
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--ready)]">{scan.importableCount} 个网址</div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  已存在
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--text-muted)]">{scan.existingCount} 个网址</div>
              </div>
            </div>

            {scan.sources.length ? (
              <section className="surface-muted px-4 py-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  来源配置
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {scan.sources.map((source) => (
                    <div key={source.id} className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                          {source.browser}
                        </span>
                        <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                          {source.profileName}
                        </span>
                        <span className="text-xs text-[color:var(--text-soft)]">{source.bookmarkCount} 个条目</span>
                      </div>
                      <div className="mt-2 break-all text-sm text-[color:var(--text-muted)]">{source.bookmarksPath}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[color:var(--text-muted)]">
                已选择 {selectedIds.length} / {importableIds.length} 个可导入网址
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary gap-2 px-3 py-2 text-xs" type="button" onClick={onSelectAll}>
                  <CheckSquare className="h-3.5 w-3.5" />
                  全选可导入
                </button>
                <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={onClearSelection}>
                  清空选择
                </button>
              </div>
            </div>

            <section className="surface-muted px-4 py-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                收藏夹条目
              </div>

              {scan.candidates.length ? (
                <div className="grid gap-2">
                  {scan.candidates.map((candidate) => {
                    const importable = !candidate.existingItemId
                    const selected = importable && selectedIds.includes(candidate.id)

                    return (
                      <button
                        key={candidate.id}
                        className={`rounded-xl border px-4 py-3 text-left transition ${
                          selected
                            ? 'border-[color:var(--accent)] bg-[#f4f8fd]'
                            : 'border-[color:var(--border)] bg-white hover:border-[color:var(--border-strong)]'
                        }`}
                        disabled={!importable}
                        type="button"
                        onClick={() => {
                          if (importable) {
                            onToggleId(candidate.id)
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-[color:var(--text-soft)]">
                            {importable ? (
                              selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-[color:var(--text)]">{candidate.name}</span>
                              <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                                {candidate.browser}
                              </span>
                              <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                                {candidate.profileName}
                              </span>
                              {candidate.folderPath ? (
                                <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                                  {candidate.folderPath}
                                </span>
                              ) : null}
                              {candidate.existingItemName ? (
                                <span className="rounded-md border border-[#ead7b2] bg-[#fbf5e8] px-2 py-0.5 text-[10px] text-[#8A5A1D]">
                                  已存在：{candidate.existingItemName}
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-2 flex items-start gap-2 break-all text-sm text-[color:var(--text-muted)]">
                              <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{candidate.url}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-white px-4 py-6 text-sm text-[color:var(--text-muted)]">
                  没有扫描到可导入的 Chrome / Edge 收藏夹网址。
                </div>
              )}
            </section>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" disabled={!selectedIds.length || busy} type="button" onClick={onConfirm}>
            {busy ? '导入中...' : `导入 ${selectedIds.length} 个网站`}
          </button>
        </div>
      </div>
    </div>
  )
}
