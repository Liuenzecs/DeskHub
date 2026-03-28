import { CheckSquare, FolderTree, Square, X } from 'lucide-react'
import { useMemo } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'
import type { ProjectDirectoryScanResponse, ProjectImportConflictStrategy } from '../types/items'

interface ProjectDirectoryImportModalProps {
  open: boolean
  scan: ProjectDirectoryScanResponse
  selectedPaths: string[]
  conflictStrategy: ProjectImportConflictStrategy
  busy: boolean
  onClose: () => void
  onTogglePath: (path: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onConfirm: () => void
}

export function ProjectDirectoryImportModal({
  open,
  scan,
  selectedPaths,
  conflictStrategy,
  busy,
  onClose,
  onTogglePath,
  onSelectAll,
  onClearSelection,
  onConfirm,
}: ProjectDirectoryImportModalProps) {
  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open,
    onClose,
  })

  const selectablePaths = useMemo(
    () =>
      scan.candidates
        .filter(
          (candidate) => conflictStrategy === 'refresh_existing' || !candidate.existingItemId,
        )
        .map((candidate) => candidate.path),
    [conflictStrategy, scan.candidates],
  )
  const conflictLabel = conflictStrategy === 'refresh_existing' ? '刷新已有项目' : '跳过已存在'

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
        className="modal-shell max-h-[calc(100vh-4rem)] max-w-4xl"
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <div className="modal-header">
          <div>
            <div className="modal-kicker">Project Import</div>
            <h3 className="modal-title text-lg" id={titleId}>
              导入项目目录
            </h3>
            <p className="modal-description" id={descriptionId}>
              DeskHub 会按当前扫描偏好递归扫描工作区，并根据冲突策略决定是跳过还是刷新已存在项目。
            </p>
          </div>
          <button aria-label="关闭项目目录导入预览" className="btn-icon" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-body flex-1 overflow-y-auto">
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  工作区
                </div>
                <div className="mt-2 break-all text-sm text-[color:var(--text)]">{scan.rootPath}</div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  扫描深度
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--text)]">{scan.scanDepth} 级</div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  已扫描
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--text)]">
                  {scan.scannedDirectoryCount} 个目录
                </div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  已过滤
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--text)]">
                  {scan.skippedDirectoryCount} 个目录
                </div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  可导入
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--ready)]">
                  {scan.importableCount} 个项目
                </div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  已存在
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--text-muted)]">
                  {scan.existingCount} 个项目
                </div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  冲突策略
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--text)]">{conflictLabel}</div>
              </div>
            </div>

            <div className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                忽略规则
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {scan.excludePatterns.length ? (
                  scan.excludePatterns.map((pattern) => (
                    <span
                      key={pattern}
                      className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]"
                    >
                      {pattern}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[color:var(--text-muted)]">未配置忽略规则</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[color:var(--text-muted)]">
                已选择 {selectedPaths.length} / {selectablePaths.length} 个可处理项目
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary gap-2 px-3 py-2 text-xs" type="button" onClick={onSelectAll}>
                  <CheckSquare className="h-3.5 w-3.5" />
                  {conflictStrategy === 'refresh_existing' ? '全选当前候选' : '全选可导入'}
                </button>
                <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={onClearSelection}>
                  清空选择
                </button>
              </div>
            </div>

            <section className="surface-muted px-4 py-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                候选项目
              </div>

              <div className="grid gap-2">
                {scan.candidates.map((candidate) => {
                  const selectable =
                    conflictStrategy === 'refresh_existing' || !candidate.existingItemId
                  const selected = selectable && selectedPaths.includes(candidate.path)

                  return (
                    <button
                      key={candidate.path}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        selected
                            ? 'border-[color:var(--accent)] bg-[#f4f8fd]'
                            : 'border-[color:var(--border)] bg-white hover:border-[color:var(--border-strong)]'
                      }`}
                      disabled={!selectable}
                      type="button"
                      onClick={() => {
                        if (selectable) {
                          onTogglePath(candidate.path)
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-[color:var(--text-soft)]">
                          {selectable ? (
                            selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />
                          ) : (
                            <FolderTree className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-[color:var(--text)]">
                              {candidate.suggestedName}
                            </span>
                            {candidate.suggestedCommand ? (
                              <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                                {candidate.suggestedCommand}
                              </span>
                            ) : null}
                            <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                              {candidate.relativePath === '.' ? '工作区根目录' : candidate.relativePath}
                            </span>
                            <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                              深度 {candidate.depth}
                            </span>
                            {candidate.existingItemName ? (
                              <span className="rounded-md border border-[#ead7b2] bg-[#fbf5e8] px-2 py-0.5 text-[10px] text-[#8A5A1D]">
                                {conflictStrategy === 'refresh_existing' ? '将刷新：' : '已存在：'}
                                {candidate.existingItemName}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 break-all text-sm text-[color:var(--text-muted)]">
                            {candidate.path}
                          </div>

                          {candidate.detectedFiles.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {candidate.detectedFiles.map((fileName) => (
                                <span
                                  key={`${candidate.path}-${fileName}`}
                                  className="rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]"
                                >
                                  {fileName}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" disabled={!selectedPaths.length || busy} type="button" onClick={onConfirm}>
            {busy
              ? '处理中...'
              : conflictStrategy === 'refresh_existing'
                ? `导入 / 刷新 ${selectedPaths.length} 个项目`
                : `导入 ${selectedPaths.length} 个项目`}
          </button>
        </div>
      </div>
    </div>
  )
}
