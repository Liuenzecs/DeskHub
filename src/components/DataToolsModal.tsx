import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileJson,
  Lock,
  FolderOpen,
  HardDriveUpload,
  HeartPulse,
  RefreshCcw,
  Save,
  ShieldCheck,
  Workflow,
  X,
} from 'lucide-react'
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'
import { useItems } from '../hooks/useItems'
import { ITEM_TYPE_LABELS } from '../lib/item-utils'
import { ConfirmDialog } from './ConfirmDialog'
import { BrowserBookmarkImportModal } from './BrowserBookmarkImportModal'
import { ProjectDirectoryImportModal } from './ProjectDirectoryImportModal'
import type {
  BrowserBookmarkImportEntry,
  BrowserBookmarkScanResponse,
  DataToolAction,
  DataToolHistoryEntry,
  DataToolHistoryExtra,
  DataToolHistoryPayload,
  DataToolOperationStatus,
  DatabaseConsistencyReport,
  DatabaseHealthReport,
  DatabaseMaintenanceResponse,
  FileOperationResponse,
  ImportBrowserBookmarksResponse,
  ImportItemsPreviewResponse,
  ImportItemsResponse,
  ImportProjectDirectoriesResponse,
  ProjectImportConflictStrategy,
  ProjectImportPreferences,
  ProjectDirectoryImportOptions,
  ProjectDirectoryScanResponse,
  ProjectDirectoryScanOptions,
  UiSettingsUpdatePayload,
} from '../types/items'

interface DataToolsModalProps {
  open: boolean
  onClose: () => void
}

type BusyAction = DataToolAction | 'export_report'
const PROJECT_IMPORT_PREFERENCES_KEY = 'deskhub:data-tools-project-import'
const DEFAULT_PROJECT_IMPORT_PREFERENCES: ProjectImportPreferences = {
  recentRootPath: null,
  scanDepth: 1,
  excludePatterns: [
    '.git',
    'node_modules',
    'target',
    'dist',
    'build',
    '.next',
    '.turbo',
    'coverage',
    '.venv',
    'venv',
  ],
  conflictStrategy: 'skip_existing',
}

function parseProjectImportExcludePatterns(value: string) {
  return value
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment, index, values) => segment.length > 0 && values.indexOf(segment) === index)
}

function loadProjectImportPreferences(): ProjectImportPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_PROJECT_IMPORT_PREFERENCES
  }

  try {
    const rawValue = window.localStorage.getItem(PROJECT_IMPORT_PREFERENCES_KEY)
    if (!rawValue) {
      return DEFAULT_PROJECT_IMPORT_PREFERENCES
    }

    const parsed = JSON.parse(rawValue) as Partial<ProjectImportPreferences>
    const scanDepth = Number(parsed.scanDepth)
    return {
      recentRootPath:
        typeof parsed.recentRootPath === 'string' && parsed.recentRootPath.trim().length > 0
          ? parsed.recentRootPath.trim()
          : null,
      scanDepth: Number.isFinite(scanDepth) ? Math.min(4, Math.max(1, scanDepth)) : 1,
      excludePatterns: Array.isArray(parsed.excludePatterns) && parsed.excludePatterns.length
        ? parseProjectImportExcludePatterns(parsed.excludePatterns.join(','))
        : DEFAULT_PROJECT_IMPORT_PREFERENCES.excludePatterns,
      conflictStrategy:
        parsed.conflictStrategy === 'refresh_existing' ? 'refresh_existing' : 'skip_existing',
    }
  } catch {
    return DEFAULT_PROJECT_IMPORT_PREFERENCES
  }
}

function buildProjectImportScanOptions(
  preferences: ProjectImportPreferences,
): ProjectDirectoryScanOptions {
  return {
    scanDepth: preferences.scanDepth,
    excludePatterns: preferences.excludePatterns,
  }
}

function buildProjectImportRequestOptions(
  preferences: ProjectImportPreferences,
): ProjectDirectoryImportOptions {
  return {
    conflictStrategy: preferences.conflictStrategy,
  }
}

function buildProjectImportSelectablePaths(
  scan: ProjectDirectoryScanResponse,
  conflictStrategy: ProjectImportConflictStrategy,
) {
  return scan.candidates
    .filter((candidate) => conflictStrategy === 'refresh_existing' || !candidate.existingItemId)
    .map((candidate) => candidate.path)
}

async function pickJsonFile() {
  const selected = await openDialog({
    title: '导入 DeskHub 条目',
    multiple: false,
    directory: false,
    filters: [{ name: 'DeskHub JSON', extensions: ['json'] }],
  })

  return typeof selected === 'string' ? selected : null
}

async function pickDatabaseFile() {
  const selected = await openDialog({
    title: '恢复 DeskHub 数据库',
    multiple: false,
    directory: false,
    filters: [{ name: 'SQLite 数据库', extensions: ['db', 'sqlite', 'sqlite3'] }],
  })

  return typeof selected === 'string' ? selected : null
}

async function pickWorkspaceDirectory(defaultPath?: string | null) {
  const selected = await openDialog({
    title: '选择要扫描的项目工作区',
    multiple: false,
    directory: true,
    defaultPath: defaultPath ?? undefined,
  })

  return typeof selected === 'string' ? selected : null
}

async function pickDatabaseSavePath(defaultName: string) {
  return saveDialog({
    title: '备份 DeskHub 数据库',
    defaultPath: defaultName,
    filters: [{ name: 'SQLite 数据库', extensions: ['db'] }],
  })
}

async function pickJsonSavePath(defaultName: string) {
  return saveDialog({
    title: '导出 DeskHub 条目',
    defaultPath: defaultName,
    filters: [{ name: 'DeskHub JSON', extensions: ['json'] }],
  })
}

async function pickTextReportSavePath(defaultName: string) {
  return saveDialog({
    title: '导出报告',
    defaultPath: defaultName,
    filters: [{ name: '文本报告', extensions: ['txt'] }],
  })
}

async function pickStructuredReportSavePath(defaultName: string) {
  return saveDialog({
    title: '导出结构化报告',
    defaultPath: defaultName,
    filters: [{ name: 'DeskHub Report', extensions: ['json'] }],
  })
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))
}

function formatBytes(value?: number) {
  if (value === undefined || value < 0) {
    return null
  }

  if (value < 1024) {
    return `${value} B`
  }

  const units = ['KB', 'MB', 'GB']
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function StatusBadge({ status }: { status: DataToolOperationStatus }) {
  const styleMap: Record<DataToolOperationStatus, string> = {
    success: 'border-[#cfe7b2] bg-[#f3f9e9] text-[color:var(--ready)]',
    warning: 'border-[#ead7b2] bg-[#fbf5e8] text-[#8A5A1D]',
    error: 'border-[#f1c9c9] bg-[#fff1f1] text-[#b42318]',
  }

  const labelMap: Record<DataToolOperationStatus, string> = {
    success: '成功',
    warning: '部分完成',
    error: '失败',
  }

  return (
    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${styleMap[status]}`}>
      {labelMap[status]}
    </span>
  )
}

function OperationIcon({ status }: { status: DataToolOperationStatus }) {
  if (status === 'error') {
    return <AlertTriangle className="h-4 w-4" />
  }

  if (status === 'warning') {
    return <ShieldCheck className="h-4 w-4" />
  }

  return <CheckCircle2 className="h-4 w-4" />
}

function OperationCard({
  icon,
  title,
  description,
  disabled,
  busy,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  disabled: boolean
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      className="surface-muted flex items-start gap-4 p-4 text-left transition hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-70"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <div className="rounded-lg bg-white p-2 text-[color:var(--accent)]">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-[color:var(--text)]">{title}</div>
          {busy ? (
            <span className="rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[11px] text-[color:var(--text-muted)]">
              处理中
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">{description}</p>
      </div>
    </button>
  )
}

function ResultField({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return (
    <div className="grid gap-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
        {label}
      </div>
      <div className="break-all text-sm text-[color:var(--text)]">{String(value)}</div>
    </div>
  )
}

function ExtraMetadata({ extra }: { extra: DataToolHistoryExtra }) {
  const tableEntries = Object.entries(extra.tableCounts ?? {})
  const metricFields = [
    { label: 'SHA256', value: extra.sha256 },
    { label: '源库 SHA256', value: extra.sourceSha256 },
    { label: 'Schema 版本', value: extra.schemaVersion },
    { label: '条目数量', value: extra.itemCount },
    { label: '工作流数量', value: extra.workflowCount },
    { label: 'Quick Check', value: extra.quickCheck },
    {
      label: '外键检查',
      value:
        extra.foreignKeysEnabled === undefined ? null : extra.foreignKeysEnabled ? 'ON' : 'OFF',
    },
    { label: '预检通过', value: extra.previewValidCount },
    { label: '预检失败', value: extra.previewInvalidCount },
    { label: '问题总数', value: extra.issueCount },
    { label: 'Warning 数', value: extra.warningCount },
    { label: 'Error 数', value: extra.errorCount },
    { label: '清理数量', value: extra.clearedCount },
    { label: 'Page Before', value: extra.pageCountBefore },
    { label: 'Page After', value: extra.pageCountAfter },
    { label: 'Freelist Before', value: extra.freelistCountBefore },
    { label: 'Freelist After', value: extra.freelistCountAfter },
    { label: '大小 Before', value: formatBytes(extra.sizeBeforeBytes) },
    { label: '大小 After', value: formatBytes(extra.sizeAfterBytes) },
    { label: '恢复前条目数', value: extra.restoreBeforeItemCount },
    { label: '恢复后条目数', value: extra.restoreAfterItemCount },
    { label: '恢复新增', value: extra.restoreAddedCount },
    { label: '恢复移除', value: extra.restoreRemovedCount },
    { label: '恢复更新', value: extra.restoreUpdatedCount },
    { label: '备份目录', value: extra.backupsDirectory },
  ].filter((field) => field.value !== undefined && field.value !== null && field.value !== '')

  if (!metricFields.length && !tableEntries.length) {
    return null
  }

  return (
    <div className="grid gap-3">
      {metricFields.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {metricFields.map((field) => (
            <ResultField key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
      ) : null}

      {tableEntries.length ? (
        <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-3" open>
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            表计数
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {tableEntries.map(([table, count]) => (
              <div
                key={table}
                className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-muted)]"
              >
                <span className="font-medium text-[color:var(--text)]">{table}</span>
                <span className="ml-2">{count}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

function LatestResultPanel({
  record,
  exportBusy,
  onExportErrors,
}: {
  record: DataToolHistoryEntry
  exportBusy: boolean
  onExportErrors: (record: DataToolHistoryEntry) => void
}) {
  return (
    <section className="surface grid gap-4 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            最新结果
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-[color:var(--text)]">
            <span className="rounded-lg bg-[color:var(--surface-muted)] p-2 text-[color:var(--text-muted)]">
              <OperationIcon status={record.status} />
            </span>
            {record.title}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={record.status} />
          <span className="text-xs text-[color:var(--text-soft)]">{formatTimestamp(record.occurredAt)}</span>
        </div>
      </div>

      <p className="text-sm text-[color:var(--text-muted)]">{record.summary}</p>

      <div className="grid gap-3 md:grid-cols-2">
        <ResultField label="源文件" value={record.sourcePath} />
        <ResultField label="输出位置" value={record.outputPath} />
        <ResultField label="安全备份" value={record.backupPath} />
      </div>

      <ExtraMetadata extra={record.extra} />

      {record.itemNames.length ? (
        <div className="grid gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            已处理条目
          </div>
          <div className="flex flex-wrap gap-2">
            {record.itemNames.map((name) => (
              <span
                key={`${record.id}-${name}`}
                className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-1 text-xs text-[color:var(--text-muted)]"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {record.errors.length ? (
        <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-3" open>
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            错误与问题详情
          </summary>
          <div className="mt-3 grid gap-3">
            <div className="max-h-52 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-white px-3 py-2">
              <div className="grid gap-2 text-sm text-[color:var(--text-muted)]">
                {record.errors.map((error, index) => (
                  <div key={`${record.id}-error-${index}`}>{error}</div>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                className="btn-secondary gap-2 px-3 py-2 text-xs"
                disabled={exportBusy}
                type="button"
                onClick={() => onExportErrors(record)}
              >
                <Download className="h-4 w-4" />
                {exportBusy ? '导出中...' : '导出错误列表'}
              </button>
            </div>
          </div>
        </details>
      ) : null}
    </section>
  )
}

function OperationHistoryList({
  records,
  onClear,
  clearDisabled,
}: {
  records: DataToolHistoryEntry[]
  onClear: () => void
  clearDisabled: boolean
}) {
  if (!records.length) {
    return null
  }

  return (
    <section className="surface px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
          最近操作
        </div>
        <button
          className="btn-secondary px-3 py-1.5 text-xs"
          disabled={clearDisabled}
          type="button"
          onClick={onClear}
        >
          清空历史
        </button>
      </div>
      <div className="grid gap-2">
        {records.map((record) => (
          <div
            key={record.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--text)]">
                <OperationIcon status={record.status} />
                <span>{record.title}</span>
              </div>
              <div className="mt-1 text-sm text-[color:var(--text-muted)]">{record.summary}</div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={record.status} />
              <span className="inline-flex items-center gap-1 text-xs text-[color:var(--text-soft)]">
                <Clock3 className="h-3 w-3" />
                {formatTimestamp(record.occurredAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ImportPreviewPanel({
  path,
  preview,
  busy,
  onClose,
  onConfirm,
  onExportErrors,
}: {
  path: string
  preview: ImportItemsPreviewResponse
  busy: boolean
  onClose: () => void
  onConfirm: () => void
  onExportErrors: () => void
}) {
  const canImport = preview.validCount > 0 && !busy
  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open: true,
    onClose,
  })

  return (
    <div className="modal-backdrop z-[60] flex items-center justify-center" onClick={onClose}>
      <div
        ref={containerRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-shell max-h-[calc(100vh-4rem)] max-w-3xl"
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <div className="modal-header">
          <div>
            <div className="modal-kicker">
              Import Preview
            </div>
            <h3 className="modal-title text-lg" id={titleId}>导入前预检</h3>
            <p className="modal-description" id={descriptionId}>
              DeskHub 已先校验这个导入文件。只有通过校验的条目才会被真正写入数据库。
            </p>
          </div>
          <button aria-label="关闭导入预检" className="btn-icon" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-body flex-1 overflow-y-auto">
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  文件
                </div>
                <div className="mt-2 break-all text-sm text-[color:var(--text)]">{path}</div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  版本
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--text)]">v{preview.version}</div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  可导入
                </div>
                <div className="mt-2 text-sm font-medium text-[color:var(--ready)]">{preview.validCount} 项</div>
              </div>
              <div className="surface-muted px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  失败
                </div>
                <div className="mt-2 text-sm font-medium text-[#b42318]">{preview.invalidCount} 项</div>
              </div>
            </div>

            <section className="surface-muted px-4 py-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                条目预览
              </div>
              <div className="grid gap-2">
                {preview.items.map((item) => (
                  <div
                    key={`${item.index}-${item.name}`}
                    className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--text-muted)]">
                        #{item.index}
                      </span>
                      <span className="text-sm font-medium text-[color:var(--text)]">{item.name}</span>
                      <span className="rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                        {ITEM_TYPE_LABELS[item.type]}
                      </span>
                      {typeof item.stepCount === 'number' ? (
                        <span className="rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                          {item.stepCount} 步
                        </span>
                      ) : null}
                    </div>
                    {item.target ? (
                      <div className="mt-2 text-sm text-[color:var(--text-muted)]">{item.target}</div>
                    ) : null}
                    {item.tags.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <span
                            key={`${item.index}-${tag}`}
                            className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {preview.errors.length ? (
              <section className="surface-muted px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                    失败明细
                  </div>
                  <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={onExportErrors}>
                    导出错误列表
                  </button>
                </div>
                <div className="max-h-44 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-muted)]">
                  <div className="grid gap-2">
                    {preview.errors.map((error, index) => (
                      <div key={`preview-error-${index}`}>{error}</div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" disabled={!canImport} type="button" onClick={onConfirm}>
            {busy ? '导入中...' : preview.validCount ? `导入 ${preview.validCount} 个条目` : '没有可导入条目'}
          </button>
        </div>
      </div>
    </div>
  )
}

function createBackupPayload(path: string, response: FileOperationResponse): DataToolHistoryPayload {
  return {
    action: 'backup',
    status: 'success',
    title: '数据库备份',
    summary: '已导出当前 deskhub.db 的完整副本。',
    sourcePath: path,
    outputPath: response.path,
    extra: {
      sha256: response.sha256,
      schemaVersion: response.schemaVersion,
      itemCount: response.itemCount,
      workflowCount: response.workflowCount,
      backupsDirectory: response.backupsDirectory,
      tableCounts: {},
    },
  }
}

function createRestorePayload(path: string, response: FileOperationResponse): DataToolHistoryPayload {
  const restoreDiff = response.restoreDiff
  return {
    action: 'restore',
    status: 'success',
    title: '数据库恢复',
    summary: `已恢复数据库，当前库中共有 ${response.itemCount ?? 0} 个条目、${response.workflowCount ?? 0} 个工作流。`,
    sourcePath: path,
    backupPath: response.backupPath,
    extra: {
      sha256: response.sha256,
      sourceSha256: response.sourceSha256,
      schemaVersion: response.schemaVersion,
      itemCount: response.itemCount,
      workflowCount: response.workflowCount,
      restoreBeforeItemCount: restoreDiff?.beforeItemCount,
      restoreAfterItemCount: restoreDiff?.afterItemCount,
      restoreAddedCount: restoreDiff?.addedCount,
      restoreRemovedCount: restoreDiff?.removedCount,
      restoreUpdatedCount: restoreDiff?.updatedCount,
      backupsDirectory: response.backupsDirectory,
      tableCounts: {},
    },
  }
}

function createPreviewImportPayload(
  path: string,
  response: ImportItemsPreviewResponse,
): DataToolHistoryPayload {
  const validCount = response.validCount
  const invalidCount = response.invalidCount

  let status: DataToolOperationStatus = 'success'
  let summary = `预检完成，可导入 ${validCount} 个条目。`

  if (invalidCount > 0 && validCount > 0) {
    status = 'warning'
    summary = `预检完成，可导入 ${validCount} 个条目，另有 ${invalidCount} 个条目未通过校验。`
  } else if (invalidCount > 0) {
    status = 'error'
    summary = `预检未通过，没有可导入条目，共有 ${invalidCount} 个条目失败。`
  }

  return {
    action: 'preview_import',
    status,
    title: '条目导入预检',
    summary,
    sourcePath: path,
    itemNames: response.items.map((item) => item.name).slice(0, 8),
    errors: response.errors,
    extra: {
      previewValidCount: validCount,
      previewInvalidCount: invalidCount,
      tableCounts: {},
    },
  }
}

function createImportPayload(path: string, response: ImportItemsResponse): DataToolHistoryPayload {
  const importedCount = response.items.length
  const failedCount = response.errors.length

  let status: DataToolOperationStatus = 'error'
  let summary = '未导入任何条目。'

  if (importedCount > 0 && failedCount > 0) {
    status = 'warning'
    summary = `已导入 ${importedCount} 个条目，另有 ${failedCount} 个条目校验失败。`
  } else if (importedCount > 0) {
    status = 'success'
    summary = `已成功导入 ${importedCount} 个条目。`
  } else if (failedCount > 0) {
    status = 'error'
    summary = `没有导入任何条目，共有 ${failedCount} 个条目未通过校验。`
  }

  return {
    action: 'import',
    status,
    title: '条目 JSON 导入',
    summary,
    sourcePath: path,
    itemNames: response.items.map((item) => item.name).slice(0, 8),
    errors: response.errors,
    extra: {
      itemCount: importedCount,
      tableCounts: {},
    },
  }
}

function createBookmarkImportPayload(response: ImportBrowserBookmarksResponse): DataToolHistoryPayload {
  const importedCount = response.items.length
  const skippedCount = response.skippedUrls.length
  const failedCount = response.errors.length

  let status: DataToolOperationStatus = 'success'
  let summary = `已导入 ${importedCount} 个网站条目。`

  if (!importedCount && (skippedCount > 0 || failedCount > 0)) {
    status = failedCount > 0 ? 'error' : 'warning'
    summary =
      failedCount > 0
        ? `没有成功导入收藏夹，失败 ${failedCount} 个条目。`
        : `没有新增网站条目，${skippedCount} 个网址已存在于 DeskHub。`
  } else if (skippedCount > 0 || failedCount > 0) {
    status = failedCount > 0 ? 'warning' : 'success'
    summary = `已导入 ${importedCount} 个网站条目，跳过 ${skippedCount} 个重复网址，失败 ${failedCount} 个条目。`
  }

  return {
    action: 'import_bookmarks',
    status,
    title: '浏览器收藏夹导入',
    summary,
    itemNames: response.items.map((item) => item.name).slice(0, 8),
    errors: response.errors,
    extra: {
      itemCount: importedCount,
      tableCounts: {},
    },
  }
}

function createProjectImportPayload(
  rootPath: string,
  response: ImportProjectDirectoriesResponse,
): DataToolHistoryPayload {
  const updatedCount = response.updatedPaths.length
  const importedCount = response.items.length - updatedCount
  const skippedCount = response.skippedPaths.length
  const failedCount = response.errors.length

  let status: DataToolOperationStatus = 'success'
  let summary =
    updatedCount > 0 && importedCount > 0
      ? `已从工作区导入 ${importedCount} 个项目，并刷新 ${updatedCount} 个已有项目。`
      : updatedCount > 0
        ? `已从工作区刷新 ${updatedCount} 个已有项目。`
        : `已从工作区导入 ${importedCount} 个项目。`

  if (!response.items.length && (skippedCount > 0 || failedCount > 0)) {
    status = failedCount > 0 ? 'error' : 'warning'
    summary =
      failedCount > 0
        ? `没有成功导入项目，${failedCount} 个目录识别失败。`
        : `没有新增项目，${skippedCount} 个目录已存在于 DeskHub。`
  } else if (skippedCount > 0 || failedCount > 0) {
    status = failedCount > 0 ? 'warning' : 'success'
    summary =
      updatedCount > 0
        ? `已导入 ${importedCount} 个项目，刷新 ${updatedCount} 个已有项目，跳过 ${skippedCount} 个重复目录，失败 ${failedCount} 个目录。`
        : `已导入 ${importedCount} 个项目，跳过 ${skippedCount} 个重复目录，失败 ${failedCount} 个目录。`
  }

  return {
    action: 'import_projects',
    status,
    title: '项目目录导入',
    summary,
    sourcePath: rootPath,
    itemNames: response.items.map((item) => item.name).slice(0, 8),
    errors: response.errors,
    extra: {
      itemCount: importedCount,
      tableCounts: {},
    },
  }
}

function createExportPayload(
  action: 'export_all' | 'export_workflows',
  path: string,
  exportedCount: number,
  itemNames: string[],
): DataToolHistoryPayload {
  return {
    action,
    status: 'success',
    title: action === 'export_all' ? '导出全部条目' : '导出工作流',
    summary:
      action === 'export_all'
        ? `已导出全部 ${exportedCount} 个条目。`
        : `已导出 ${exportedCount} 个工作流。`,
    outputPath: path,
    itemNames: itemNames.slice(0, 8),
    extra: {
      itemCount: exportedCount,
      tableCounts: {},
    },
  }
}

function createHealthCheckPayload(report: DatabaseHealthReport): DataToolHistoryPayload {
  return {
    action: 'health_check',
    status: report.quickCheck.toLowerCase() === 'ok' ? 'success' : 'warning',
    title: '数据库健康检查',
    summary: `Schema v${report.schemaVersion} 检查完成，SQLite quick_check = ${report.quickCheck}。`,
    sourcePath: report.path,
    extra: {
      schemaVersion: report.schemaVersion,
      quickCheck: report.quickCheck,
      foreignKeysEnabled: report.foreignKeysEnabled,
      backupsDirectory: report.backupsDirectory,
      tableCounts: report.tableCounts,
    },
  }
}

function createConsistencyPayload(report: DatabaseConsistencyReport): DataToolHistoryPayload {
  const status: DataToolOperationStatus =
    report.errorCount > 0 ? 'error' : report.warningCount > 0 ? 'warning' : 'success'
  const summary = report.issueCount
    ? `一致性检查完成，共发现 ${report.issueCount} 个问题，其中 ${report.errorCount} 个 error、${report.warningCount} 个 warning。`
    : '一致性检查完成，未发现问题。'

  return {
    action: 'consistency_check',
    status,
    title: '数据一致性检查',
    summary,
    sourcePath: report.path,
    errors: report.issues.map((issue) => `[${issue.severity}] ${issue.message}`),
    extra: {
      issueCount: report.issueCount,
      warningCount: report.warningCount,
      errorCount: report.errorCount,
      tableCounts: report.tableCounts,
    },
  }
}

function createOptimizePayload(report: DatabaseMaintenanceResponse): DataToolHistoryPayload {
  return {
    action: 'optimize_database',
    status: report.quickCheck.toLowerCase() === 'ok' ? 'success' : 'warning',
    title: '数据库优化',
    summary: `已执行 PRAGMA optimize / VACUUM，优化后 quick_check = ${report.quickCheck}。`,
    sourcePath: report.path,
    extra: {
      quickCheck: report.quickCheck,
      pageCountBefore: report.pageCountBefore,
      pageCountAfter: report.pageCountAfter,
      freelistCountBefore: report.freelistCountBefore,
      freelistCountAfter: report.freelistCountAfter,
      sizeBeforeBytes: report.sizeBeforeBytes,
      sizeAfterBytes: report.sizeAfterBytes,
      tableCounts: {},
    },
  }
}

function createClearCommandHistoryPayload(cleared: number): DataToolHistoryPayload {
  return {
    action: 'clear_command_history',
    status: 'success',
    title: '清空命令历史',
    summary: `已清空 ${cleared} 条命令面板历史记录。`,
    extra: {
      clearedCount: cleared,
      tableCounts: {},
    },
  }
}

function createStructuredReportHistoryPayload(response: FileOperationResponse): DataToolHistoryPayload {
  return {
    action: 'export_structured_report',
    status: 'success',
    title: '导出结构化报告',
    summary: '已导出当前数据工具摘要与设置快照。',
    outputPath: response.path,
    extra: {
      sha256: response.sha256,
      tableCounts: {},
    },
  }
}

function createErrorPayload(action: DataToolAction, path: string, error: unknown): DataToolHistoryPayload {
  const message = error instanceof Error ? error.message : String(error)
  const titleMap: Partial<Record<DataToolAction, string>> = {
    backup: '数据库备份',
    restore: '数据库恢复',
    import: '条目 JSON 导入',
    import_bookmarks: '浏览器收藏夹导入',
    import_projects: '项目目录导入',
    preview_import: '条目导入预检',
    export_all: '导出全部条目',
    export_workflows: '导出工作流',
    health_check: '数据库健康检查',
    consistency_check: '数据一致性检查',
    optimize_database: '数据库优化',
    clear_command_history: '清空命令历史',
    export_structured_report: '导出结构化报告',
  }

  return {
    action,
    status: 'error',
    title: titleMap[action] ?? '数据工具操作',
    summary: message,
    sourcePath: path,
    errors: [message],
    extra: { tableCounts: {} },
  }
}

export function DataToolsModal({ open, onClose }: DataToolsModalProps) {
  const {
    items,
    dataToolHistory,
    uiSettings,
    refreshDataToolHistory,
    recordDataToolHistory,
    clearDataToolHistory,
    clearCommandHistory,
    exportItems,
    previewImportItems,
    importItems,
    scanBrowserBookmarks,
    importBrowserBookmarks,
    scanProjectDirectories,
    importProjectDirectories,
    backupDatabase,
    restoreDatabase,
    runDatabaseHealthCheck,
    runDataConsistencyCheck,
    optimizeDatabase,
    openBackupsDirectory,
    exportTextReport,
    updateUiSettings,
    exportStructuredReport,
  } = useItems()
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [pendingRestorePath, setPendingRestorePath] = useState<string | null>(null)
  const [pendingImportPreview, setPendingImportPreview] = useState<{
    path: string
    preview: ImportItemsPreviewResponse
  } | null>(null)
  const [pendingBookmarkImportPreview, setPendingBookmarkImportPreview] = useState<{
    scan: BrowserBookmarkScanResponse
    selectedIds: string[]
  } | null>(null)
  const [pendingProjectImportPreview, setPendingProjectImportPreview] = useState<{
    scan: ProjectDirectoryScanResponse
    selectedPaths: string[]
    conflictStrategy: ProjectImportConflictStrategy
  } | null>(null)
  const [projectImportPreferences, setProjectImportPreferences] = useState<ProjectImportPreferences>(
    () => loadProjectImportPreferences(),
  )
  const [projectImportExcludeInput, setProjectImportExcludeInput] = useState(() =>
    loadProjectImportPreferences().excludePatterns.join(', '),
  )
  const [clearCommandHistoryConfirmOpen, setClearCommandHistoryConfirmOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<UiSettingsUpdatePayload>({
    autoBackupEnabled: true,
    autoBackupIntervalHours: 24,
    backupRetentionCount: 7,
    diagnosticMode: false,
  })
  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open,
    onClose,
  })
  const handleRefreshHistory = useEffectEvent(() => {
    void refreshDataToolHistory()
  })

  useEffect(() => {
    if (!open) {
      return
    }

    handleRefreshHistory()
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    setSettingsDraft({
      autoBackupEnabled: uiSettings.autoBackupEnabled,
      autoBackupIntervalHours: uiSettings.autoBackupIntervalHours,
      backupRetentionCount: uiSettings.backupRetentionCount,
      diagnosticMode: uiSettings.diagnosticMode,
    })
  }, [open, uiSettings])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      PROJECT_IMPORT_PREFERENCES_KEY,
      JSON.stringify(projectImportPreferences),
    )
  }, [projectImportPreferences])

  if (!open) {
    return null
  }

  const latestRecord = dataToolHistory[0] ?? null
  const hasBusyAction = busyAction !== null || savingSettings
  const workflowItems = items.filter((item) => item.type === 'workflow')
  const settingsDirty =
    settingsDraft.autoBackupEnabled !== uiSettings.autoBackupEnabled ||
    settingsDraft.autoBackupIntervalHours !== uiSettings.autoBackupIntervalHours ||
    settingsDraft.backupRetentionCount !== uiSettings.backupRetentionCount ||
    settingsDraft.diagnosticMode !== uiSettings.diagnosticMode
  const diagnosticModeLocked = uiSettings.diagnosticMode
  const projectImportConflictLabel =
    projectImportPreferences.conflictStrategy === 'refresh_existing'
      ? '刷新已有项目'
      : '跳过已存在'

  const handlePersistRecord = async (payload: DataToolHistoryPayload) => {
    await recordDataToolHistory(payload)
  }

  const handleExportErrors = async (record: DataToolHistoryEntry) => {
    if (!record.errors.length) {
      return
    }

    const path = await pickTextReportSavePath(
      `deskhub-${record.title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.txt`,
    )
    if (!path) {
      return
    }

    setBusyAction('export_report')
    try {
      await exportTextReport(path, `${record.title} 错误列表`, record.errors)
    } finally {
      setBusyAction(null)
    }
  }

  const handleExportPreviewErrors = async () => {
    if (!pendingImportPreview?.preview.errors.length) {
      return
    }

    const path = await pickTextReportSavePath(
      `deskhub-import-preview-${new Date().toISOString().slice(0, 10)}.txt`,
    )
    if (!path) {
      return
    }

    setBusyAction('export_report')
    try {
      await exportTextReport(path, 'DeskHub 导入预检错误列表', pendingImportPreview.preview.errors)
    } finally {
      setBusyAction(null)
    }
  }

  const handleImportPick = async () => {
    const path = await pickJsonFile()
    if (!path) {
      return
    }

    setBusyAction('preview_import')
    try {
      const preview = await previewImportItems(path)
      await handlePersistRecord(createPreviewImportPayload(path, preview))
      setPendingImportPreview({ path, preview })
    } catch (error) {
      await handlePersistRecord(createErrorPayload('preview_import', path, error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleConfirmImport = async () => {
    if (!pendingImportPreview) {
      return
    }

    const importPath = pendingImportPreview.path
    setBusyAction('import')
    try {
      const response = await importItems(importPath)
      await handlePersistRecord(createImportPayload(importPath, response))
      setPendingImportPreview(null)
    } catch (error) {
      await handlePersistRecord(createErrorPayload('import', importPath, error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleBookmarkImportPick = async () => {
    setBusyAction('import_bookmarks')
    try {
      const scan = await scanBrowserBookmarks()
      setPendingBookmarkImportPreview({
        scan,
        selectedIds: scan.candidates
          .filter((candidate) => !candidate.existingItemId)
          .map((candidate) => candidate.id),
      })
    } catch (error) {
      await handlePersistRecord(createErrorPayload('import_bookmarks', '', error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleToggleBookmarkSelection = (id: string) => {
    setPendingBookmarkImportPreview((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        selectedIds: current.selectedIds.includes(id)
          ? current.selectedIds.filter((value) => value !== id)
          : [...current.selectedIds, id],
      }
    })
  }

  const handleSelectAllBookmarks = () => {
    setPendingBookmarkImportPreview((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        selectedIds: current.scan.candidates
          .filter((candidate) => !candidate.existingItemId)
          .map((candidate) => candidate.id),
      }
    })
  }

  const handleClearBookmarkSelection = () => {
    setPendingBookmarkImportPreview((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        selectedIds: [],
      }
    })
  }

  const handleConfirmBookmarkImport = async () => {
    if (!pendingBookmarkImportPreview?.selectedIds.length) {
      return
    }

    const preview = pendingBookmarkImportPreview
    const selectedEntries: BrowserBookmarkImportEntry[] = preview.scan.candidates
      .filter((candidate) => preview.selectedIds.includes(candidate.id))
      .map((candidate) => ({
        browser: candidate.browser,
        profileName: candidate.profileName,
        sourcePath: candidate.sourcePath,
        name: candidate.name,
        url: candidate.url,
        folderPath: candidate.folderPath,
      }))

    setBusyAction('import_bookmarks')
    try {
      const response = await importBrowserBookmarks(selectedEntries)
      await handlePersistRecord(createBookmarkImportPayload(response))
      setPendingBookmarkImportPreview(null)
    } catch (error) {
      await handlePersistRecord(createErrorPayload('import_bookmarks', '', error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleProjectImportPick = async () => {
    const path = await pickWorkspaceDirectory(projectImportPreferences.recentRootPath)
    if (!path) {
      return
    }

    setBusyAction('import_projects')
    try {
      const nextPreferences = {
        ...projectImportPreferences,
        recentRootPath: path,
      }
      setProjectImportPreferences(nextPreferences)
      const scan = await scanProjectDirectories(path, buildProjectImportScanOptions(nextPreferences))
      setPendingProjectImportPreview({
        scan,
        selectedPaths: buildProjectImportSelectablePaths(
          scan,
          nextPreferences.conflictStrategy,
        ),
        conflictStrategy: nextPreferences.conflictStrategy,
      })
    } catch (error) {
      await handlePersistRecord(createErrorPayload('import_projects', path, error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleToggleProjectImportPath = (path: string) => {
    setPendingProjectImportPreview((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        selectedPaths: current.selectedPaths.includes(path)
          ? current.selectedPaths.filter((value) => value !== path)
          : [...current.selectedPaths, path],
      }
    })
  }

  const handleSelectAllProjectImports = () => {
    setPendingProjectImportPreview((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        selectedPaths: buildProjectImportSelectablePaths(current.scan, current.conflictStrategy),
      }
    })
  }

  const handleClearProjectImportSelection = () => {
    setPendingProjectImportPreview((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        selectedPaths: [],
      }
    })
  }

  const handleConfirmProjectImport = async () => {
    if (!pendingProjectImportPreview || !pendingProjectImportPreview.selectedPaths.length) {
      return
    }

    const preview = pendingProjectImportPreview
    setBusyAction('import_projects')
    try {
      const response = await importProjectDirectories(
        preview.selectedPaths,
        buildProjectImportRequestOptions({
          ...projectImportPreferences,
          conflictStrategy: preview.conflictStrategy,
        }),
      )
      await handlePersistRecord(createProjectImportPayload(preview.scan.rootPath, response))
      setPendingProjectImportPreview(null)
    } catch (error) {
      await handlePersistRecord(createErrorPayload('import_projects', preview.scan.rootPath, error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleProjectImportDepthChange = (value: number) => {
    setProjectImportPreferences((current) => ({
      ...current,
      scanDepth: Math.min(4, Math.max(1, value)),
    }))
  }

  const handleProjectImportConflictStrategyChange = (
    value: ProjectImportConflictStrategy,
  ) => {
    setProjectImportPreferences((current) => ({
      ...current,
      conflictStrategy: value,
    }))
  }

  const handleProjectImportExcludeInputChange = (value: string) => {
    setProjectImportExcludeInput(value)
    setProjectImportPreferences((current) => ({
      ...current,
      excludePatterns: parseProjectImportExcludePatterns(value),
    }))
  }

  const handleClearRecentProjectImportPath = () => {
    setProjectImportPreferences((current) => ({
      ...current,
      recentRootPath: null,
    }))
  }

  const handleBackup = async () => {
    const path = await pickDatabaseSavePath(`deskhub-backup-${new Date().toISOString().slice(0, 10)}.db`)
    if (!path) {
      return
    }

    setBusyAction('backup')
    try {
      const response = await backupDatabase(path)
      await handlePersistRecord(createBackupPayload(path, response))
    } catch (error) {
      await handlePersistRecord(createErrorPayload('backup', path, error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleRestorePick = async () => {
    const path = await pickDatabaseFile()
    if (!path) {
      return
    }

    setPendingRestorePath(path)
  }

  const handleConfirmRestore = async () => {
    if (!pendingRestorePath) {
      return
    }

    const restorePath = pendingRestorePath
    setPendingRestorePath(null)
    setBusyAction('restore')

    try {
      const response = await restoreDatabase(restorePath)
      await handlePersistRecord(createRestorePayload(restorePath, response))
    } catch (error) {
      await handlePersistRecord(createErrorPayload('restore', restorePath, error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleExport = async (action: 'export_all' | 'export_workflows') => {
    const sourceItems = action === 'export_all' ? items : workflowItems
    if (!sourceItems.length) {
      return
    }

    const path = await pickJsonSavePath(
      action === 'export_all' ? 'deskhub-all-items.json' : 'deskhub-workflows.json',
    )
    if (!path) {
      return
    }

    setBusyAction(action)
    try {
      const response = await exportItems(
        path,
        sourceItems.map((item) => item.id),
      )
      await handlePersistRecord(
        createExportPayload(action, response.path, response.exportedCount, sourceItems.map((item) => item.name)),
      )
    } catch (error) {
      await handlePersistRecord(createErrorPayload(action, path, error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleHealthCheck = async () => {
    setBusyAction('health_check')
    try {
      const report = await runDatabaseHealthCheck()
      await handlePersistRecord(createHealthCheckPayload(report))
    } catch (error) {
      await handlePersistRecord(createErrorPayload('health_check', '', error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleConsistencyCheck = async () => {
    setBusyAction('consistency_check')
    try {
      const report = await runDataConsistencyCheck()
      await handlePersistRecord(createConsistencyPayload(report))
    } catch (error) {
      await handlePersistRecord(createErrorPayload('consistency_check', '', error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleOptimize = async () => {
    setBusyAction('optimize_database')
    try {
      const report = await optimizeDatabase()
      await handlePersistRecord(createOptimizePayload(report))
    } catch (error) {
      await handlePersistRecord(createErrorPayload('optimize_database', '', error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleClearCommandHistory = async () => {
    setClearCommandHistoryConfirmOpen(false)
    setBusyAction('clear_command_history')
    try {
      const response = await clearCommandHistory()
      await handlePersistRecord(createClearCommandHistoryPayload(response.cleared))
    } catch (error) {
      await handlePersistRecord(createErrorPayload('clear_command_history', '', error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await updateUiSettings({
        autoBackupEnabled: settingsDraft.autoBackupEnabled,
        autoBackupIntervalHours: Math.max(1, settingsDraft.autoBackupIntervalHours),
        backupRetentionCount: Math.max(1, settingsDraft.backupRetentionCount),
        diagnosticMode: settingsDraft.diagnosticMode,
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleExportStructuredReport = async () => {
    const path = await pickStructuredReportSavePath(
      `deskhub-report-${new Date().toISOString().slice(0, 10)}.json`,
    )
    if (!path) {
      return
    }

    setBusyAction('export_structured_report')
    try {
      const response = await exportStructuredReport(path, 'DeskHub Structured Report', {
        generatedAt: new Date().toISOString(),
        uiSettings,
        latestRecord,
        recentRecords: dataToolHistory.slice(0, 10),
        stats: {
          itemCount: items.length,
          workflowCount: workflowItems.length,
        },
      })
      await handlePersistRecord(createStructuredReportHistoryPayload(response))
    } catch (error) {
      await handlePersistRecord(createErrorPayload('export_structured_report', path, error))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <>
      <div className="modal-backdrop flex items-center justify-center" onClick={onClose}>
        <div
          ref={containerRef}
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal="true"
          className="modal-shell max-h-[calc(100vh-3rem)] max-w-6xl"
          role="dialog"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
          onKeyDownCapture={handleKeyDownCapture}
        >
          <div className="modal-header">
            <div>
              <div className="modal-kicker">
                DeskHub Data Tools
              </div>
              <h2 className="modal-title" id={titleId}>数据工具</h2>
              <p className="modal-description" id={descriptionId}>
                管理数据库备份、恢复、导入导出、预检与一致性检查。关键操作会被持久化记录，方便回溯。
              </p>
            </div>
            <button aria-label="关闭数据工具" className="btn-icon" type="button" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="modal-body flex-1 overflow-y-auto">
            <div className="grid gap-5">
              <section className="surface grid gap-4 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                      设置中心
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                      自动备份、保留策略与诊断模式
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-secondary gap-2"
                      disabled={hasBusyAction || !latestRecord}
                      type="button"
                      onClick={() => void handleExportStructuredReport()}
                    >
                      <FileJson className="h-4 w-4" />
                      {busyAction === 'export_structured_report' ? '导出中...' : '导出结构化报告'}
                    </button>
                    <button
                      className="btn-primary gap-2"
                      disabled={!settingsDirty || hasBusyAction}
                      type="button"
                      onClick={() => void handleSaveSettings()}
                    >
                      <Save className="h-4 w-4" />
                      {savingSettings ? '保存中...' : '保存设置'}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <label className="surface-muted flex items-center gap-3 px-4 py-3 text-sm text-[color:var(--text)]">
                    <input
                      checked={settingsDraft.autoBackupEnabled}
                      className="h-4 w-4 rounded border-slate-300"
                      type="checkbox"
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          autoBackupEnabled: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block font-medium">启用自动备份</span>
                      <span className="text-[color:var(--text-muted)]">
                        应用启动时按间隔自动生成数据库备份。
                      </span>
                    </span>
                  </label>

                  <label className="surface-muted flex items-center gap-3 px-4 py-3 text-sm text-[color:var(--text)]">
                    <input
                      checked={settingsDraft.diagnosticMode}
                      className="h-4 w-4 rounded border-slate-300"
                      type="checkbox"
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          diagnosticMode: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block font-medium">诊断模式</span>
                      <span className="text-[color:var(--text-muted)]">
                        锁定恢复、导入、优化和历史清理等写操作。
                      </span>
                    </span>
                  </label>

                  <div className="surface-muted px-4 py-3">
                    <label className="field-label" htmlFor="auto-backup-interval">
                      自动备份间隔（小时）
                    </label>
                    <input
                      id="auto-backup-interval"
                      className="field"
                      disabled={!settingsDraft.autoBackupEnabled}
                      min={1}
                      type="number"
                      value={settingsDraft.autoBackupIntervalHours}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          autoBackupIntervalHours: Math.max(1, Number(event.target.value || 1)),
                        }))
                      }
                    />
                  </div>

                  <div className="surface-muted px-4 py-3">
                    <label className="field-label" htmlFor="backup-retention-count">
                      备份保留数量
                    </label>
                    <input
                      id="backup-retention-count"
                      className="field"
                      min={1}
                      type="number"
                      value={settingsDraft.backupRetentionCount}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          backupRetentionCount: Math.max(1, Number(event.target.value || 1)),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--text-muted)]">
                  <div>
                    上次自动备份：
                    {uiSettings.lastAutoBackupAt ? formatTimestamp(uiSettings.lastAutoBackupAt) : '尚未执行'}
                  </div>
                  {diagnosticModeLocked ? (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-[#ead7b2] bg-[#fbf5e8] px-3 py-2 text-[#8A5A1D]">
                      <Lock className="h-4 w-4" />
                      诊断模式已开启，危险写操作已被锁定。
                    </div>
                  ) : null}
                </div>
              </section>

              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary gap-2" disabled={hasBusyAction} type="button" onClick={() => void openBackupsDirectory()}>
                  <FolderOpen className="h-4 w-4" />
                  打开备份目录
                </button>
                <button className="btn-secondary gap-2" disabled={hasBusyAction} type="button" onClick={() => void handleHealthCheck()}>
                  <HeartPulse className="h-4 w-4" />
                  健康检查
                </button>
                <button className="btn-secondary gap-2" disabled={hasBusyAction} type="button" onClick={() => void handleConsistencyCheck()}>
                  <ShieldCheck className="h-4 w-4" />
                  一致性检查
                </button>
                <button className="btn-secondary gap-2" disabled={hasBusyAction} type="button" onClick={() => void handleOptimize()}>
                  <RefreshCcw className="h-4 w-4" />
                  数据库优化
                </button>
              </div>

              <section className="surface-muted grid gap-4 px-4 py-4 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
                <div className="grid gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                    项目导入偏好
                  </div>
                  <div className="text-sm text-[color:var(--text-muted)]">
                    下一次扫描会记住最近工作区、深度、忽略规则和冲突策略。
                  </div>
                  <div className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-3 text-sm text-[color:var(--text-muted)]">
                    <div className="font-medium text-[color:var(--text)]">最近工作区</div>
                    <div className="mt-1 break-all">
                      {projectImportPreferences.recentRootPath ?? '尚未选择过工作区'}
                    </div>
                    {projectImportPreferences.recentRootPath ? (
                      <div className="mt-3">
                        <button
                          className="btn-secondary px-3 py-1.5 text-xs"
                          disabled={hasBusyAction}
                          type="button"
                          onClick={handleClearRecentProjectImportPath}
                        >
                          清空最近路径
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="surface px-4 py-3">
                    <label className="field-label" htmlFor="project-import-depth">
                      扫描深度
                    </label>
                    <select
                      id="project-import-depth"
                      className="field"
                      disabled={hasBusyAction}
                      value={projectImportPreferences.scanDepth}
                      onChange={(event) => handleProjectImportDepthChange(Number(event.target.value))}
                    >
                      <option value={1}>1 级（根目录 + 一级子目录）</option>
                      <option value={2}>2 级（适合 monorepo）</option>
                      <option value={3}>3 级（更深扫描）</option>
                      <option value={4}>4 级（最大）</option>
                    </select>
                  </div>

                  <div className="surface px-4 py-3">
                    <label className="field-label" htmlFor="project-import-conflict-strategy">
                      冲突策略
                    </label>
                    <select
                      id="project-import-conflict-strategy"
                      className="field"
                      disabled={hasBusyAction}
                      value={projectImportPreferences.conflictStrategy}
                      onChange={(event) =>
                        handleProjectImportConflictStrategyChange(
                          event.target.value as ProjectImportConflictStrategy,
                        )
                      }
                    >
                      <option value="skip_existing">跳过已存在</option>
                      <option value="refresh_existing">刷新已有项目</option>
                    </select>
                  </div>
                </div>

                <div className="surface px-4 py-3">
                  <label className="field-label" htmlFor="project-import-exclude-patterns">
                    忽略目录规则
                  </label>
                  <textarea
                    id="project-import-exclude-patterns"
                    className="field min-h-28 resize-y"
                    disabled={hasBusyAction}
                    placeholder=".git, node_modules, target, dist"
                    value={projectImportExcludeInput}
                    onChange={(event) => handleProjectImportExcludeInputChange(event.target.value)}
                  />
                  <div className="mt-2 text-xs text-[color:var(--text-soft)]">
                    用逗号分隔。会匹配目录名或相对路径片段，例如 `node_modules, apps/demo/dist`。
                  </div>
                </div>
              </section>

              <div className="grid gap-3 xl:grid-cols-3">
                <OperationCard
                  busy={busyAction === 'backup'}
                  description="导出当前 deskhub.db 的完整副本，适合做整库备份。"
                  disabled={hasBusyAction}
                  icon={<Database className="h-4 w-4" />}
                  title="备份数据库"
                  onClick={() => void handleBackup()}
                />
                <OperationCard
                  busy={busyAction === 'restore'}
                  description="从外部 SQLite 备份恢复。恢复前会先把当前数据库自动备份到 DeskHub 的 data/backups 目录。"
                  disabled={hasBusyAction || diagnosticModeLocked}
                  icon={<RefreshCcw className="h-4 w-4" />}
                  title="恢复数据库"
                  onClick={() => void handleRestorePick()}
                />
                <OperationCard
                  busy={busyAction === 'preview_import' || busyAction === 'import'}
                  description="导入条目 JSON。点击后会先做 dry-run 预检，通过后再确认真正导入。"
                  disabled={hasBusyAction || diagnosticModeLocked}
                  icon={<HardDriveUpload className="h-4 w-4" />}
                  title="导入条目 JSON"
                  onClick={() => void handleImportPick()}
                />
                <OperationCard
                  busy={busyAction === 'import_projects'}
                  description={`使用 ${projectImportPreferences.scanDepth} 级扫描和“${projectImportConflictLabel}”策略，自动识别工作区中的项目入口。`}
                  disabled={hasBusyAction || diagnosticModeLocked}
                  icon={<FolderOpen className="h-4 w-4" />}
                  title="扫描项目目录"
                  onClick={() => void handleProjectImportPick()}
                />
                <OperationCard
                  busy={busyAction === 'import_bookmarks'}
                  description="扫描 Windows 下 Chrome / Edge 的收藏夹文件，预览后把选中的网址导入为网站条目。"
                  disabled={hasBusyAction || diagnosticModeLocked}
                  icon={<Bookmark className="h-4 w-4" />}
                  title="导入浏览器收藏夹"
                  onClick={() => void handleBookmarkImportPick()}
                />
                <OperationCard
                  busy={busyAction === 'export_all'}
                  description={`把当前 ${items.length} 个条目整体导出成 DeskHub JSON。`}
                  disabled={hasBusyAction || !items.length}
                  icon={<Download className="h-4 w-4" />}
                  title="导出全部条目"
                  onClick={() => void handleExport('export_all')}
                />
                <OperationCard
                  busy={busyAction === 'export_workflows'}
                  description={`单独导出 ${workflowItems.length} 个工作流，适合迁移自动化配置。`}
                  disabled={hasBusyAction || !workflowItems.length}
                  icon={<Workflow className="h-4 w-4" />}
                  title="导出工作流"
                  onClick={() => void handleExport('export_workflows')}
                />
                <OperationCard
                  busy={busyAction === 'health_check'}
                  description="执行 quick_check、schema 校验和表计数采样，快速确认本地数据库是否健康。"
                  disabled={hasBusyAction}
                  icon={<FileJson className="h-4 w-4" />}
                  title="数据库健康检查"
                  onClick={() => void handleHealthCheck()}
                />
                <OperationCard
                  busy={busyAction === 'consistency_check'}
                  description="检查默认工作流、孤儿记录、无步骤 workflow、无效 URL 与失效命令历史。"
                  disabled={hasBusyAction}
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="数据一致性检查"
                  onClick={() => void handleConsistencyCheck()}
                />
                <OperationCard
                  busy={busyAction === 'optimize_database'}
                  description="执行 PRAGMA optimize 与 VACUUM，回收空闲页并刷新数据库统计信息。"
                  disabled={hasBusyAction || diagnosticModeLocked}
                  icon={<Database className="h-4 w-4" />}
                  title="数据库优化"
                  onClick={() => void handleOptimize()}
                />
                <OperationCard
                  busy={busyAction === 'clear_command_history'}
                  description="清空命令面板的 route / action / item 历史，不影响条目本身与最近使用。"
                  disabled={hasBusyAction || diagnosticModeLocked}
                  icon={<Clock3 className="h-4 w-4" />}
                  title="清空命令历史"
                  onClick={() => setClearCommandHistoryConfirmOpen(true)}
                />
              </div>

              <div className="surface-muted flex items-start gap-3 px-4 py-3 text-sm text-[color:var(--text-muted)]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--ready)]" />
                <div>
                  数据库恢复不是直接覆盖。DeskHub 会先验证所选备份，再为当前数据库自动生成一份安全备份，然后执行替换和状态重载。
                </div>
              </div>

              {latestRecord ? (
                <LatestResultPanel
                  exportBusy={busyAction === 'export_report'}
                  record={latestRecord}
                  onExportErrors={(record) => void handleExportErrors(record)}
                />
              ) : null}
              <OperationHistoryList
                clearDisabled={hasBusyAction || diagnosticModeLocked}
                records={dataToolHistory}
                onClear={() => void clearDataToolHistory()}
              />
            </div>
          </div>

          <div className="modal-footer items-center justify-between">
            <div className="text-sm text-[color:var(--text-soft)]">
              {latestRecord ? `最近一次操作：${latestRecord.title}` : '还没有执行过数据工具操作。'}
            </div>
            <button className="btn-secondary gap-2" type="button" onClick={onClose}>
              <X className="h-4 w-4" />
              关闭
            </button>
          </div>
        </div>
      </div>

      {pendingImportPreview ? (
        <ImportPreviewPanel
          busy={busyAction === 'import'}
          path={pendingImportPreview.path}
          preview={pendingImportPreview.preview}
          onClose={() => setPendingImportPreview(null)}
          onConfirm={() => void handleConfirmImport()}
          onExportErrors={() => void handleExportPreviewErrors()}
        />
      ) : null}

      {pendingBookmarkImportPreview ? (
        <BrowserBookmarkImportModal
          busy={busyAction === 'import_bookmarks'}
          open
          scan={pendingBookmarkImportPreview.scan}
          selectedIds={pendingBookmarkImportPreview.selectedIds}
          onClearSelection={handleClearBookmarkSelection}
          onClose={() => setPendingBookmarkImportPreview(null)}
          onConfirm={() => void handleConfirmBookmarkImport()}
          onSelectAll={handleSelectAllBookmarks}
          onToggleId={handleToggleBookmarkSelection}
        />
      ) : null}

      {pendingProjectImportPreview ? (
        <ProjectDirectoryImportModal
          busy={busyAction === 'import_projects'}
          conflictStrategy={pendingProjectImportPreview.conflictStrategy}
          open
          scan={pendingProjectImportPreview.scan}
          selectedPaths={pendingProjectImportPreview.selectedPaths}
          onClearSelection={handleClearProjectImportSelection}
          onClose={() => setPendingProjectImportPreview(null)}
          onConfirm={() => void handleConfirmProjectImport()}
          onSelectAll={handleSelectAllProjectImports}
          onTogglePath={handleToggleProjectImportPath}
        />
      ) : null}

      <ConfirmDialog
        cancelLabel="取消恢复"
        confirmLabel="确认恢复"
        description={
          pendingRestorePath
            ? `将从 ${pendingRestorePath} 恢复数据库。恢复前，DeskHub 会先把当前数据库自动备份到应用数据目录下的 data/backups 中，然后立即重载界面状态。`
            : ''
        }
        open={Boolean(pendingRestorePath)}
        title="确认恢复数据库？"
        onCancel={() => setPendingRestorePath(null)}
        onConfirm={() => void handleConfirmRestore()}
      />

      <ConfirmDialog
        cancelLabel="保留历史"
        confirmLabel="确认清空"
        description="这会清空命令面板里的最近 route / action / item 历史，但不会删除条目本身，也不会影响“最近使用”页面。"
        open={clearCommandHistoryConfirmOpen}
        title="确认清空命令历史？"
        onCancel={() => setClearCommandHistoryConfirmOpen(false)}
        onConfirm={() => void handleClearCommandHistory()}
      />
    </>
  )
}
