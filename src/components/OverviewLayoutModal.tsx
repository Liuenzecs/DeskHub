import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  LayoutTemplate,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'
import {
  OVERVIEW_LAYOUT_PRESETS,
  OVERVIEW_SECTION_DEFINITIONS,
  OVERVIEW_SECTION_LABELS,
  OVERVIEW_SECTION_ORDER_DEFAULT,
  OVERVIEW_WORKFLOW_LINK_MODE_LABELS,
  normalizeOverviewLayoutTemplates,
  normalizeOverviewHiddenSections,
  normalizeOverviewSectionOrder,
  resolveOverviewLayout,
  resolveOverviewLayoutPreset,
  resolveOverviewLayoutTemplate,
} from '../lib/overview-layout'
import type {
  OverviewLayoutPayload,
  OverviewLayoutTemplate,
  OverviewSectionId,
  OverviewWorkflowLinkMode,
} from '../types/items'

interface OverviewLayoutModalProps {
  open: boolean
  sectionOrder: OverviewSectionId[]
  hiddenSections: OverviewSectionId[]
  layoutTemplates: OverviewLayoutTemplate[]
  workflowLinkMode: OverviewWorkflowLinkMode
  hasDefaultWorkflow: boolean
  onClose: () => void
  onSubmit: (payload: OverviewLayoutPayload) => Promise<unknown>
}

function moveSection(sectionOrder: OverviewSectionId[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= sectionOrder.length) {
    return sectionOrder
  }

  const nextOrder = [...sectionOrder]
  ;[nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]]
  return nextOrder
}

function createOverviewLayoutTemplateId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `overview-layout-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function OverviewLayoutModal({
  open,
  sectionOrder,
  hiddenSections,
  layoutTemplates,
  workflowLinkMode,
  hasDefaultWorkflow,
  onClose,
  onSubmit,
}: OverviewLayoutModalProps) {
  const [draftOrder, setDraftOrder] = useState<OverviewSectionId[]>(OVERVIEW_SECTION_ORDER_DEFAULT)
  const [draftHiddenSections, setDraftHiddenSections] = useState<OverviewSectionId[]>([])
  const [draftLayoutTemplates, setDraftLayoutTemplates] = useState<OverviewLayoutTemplate[]>([])
  const [draftWorkflowLinkMode, setDraftWorkflowLinkMode] = useState<OverviewWorkflowLinkMode>('none')
  const [layoutTemplateName, setLayoutTemplateName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open,
    onClose,
    initialFocusRef: headingRef,
  })

  useEffect(() => {
    if (!open) {
      return
    }

    setDraftOrder(normalizeOverviewSectionOrder(sectionOrder))
    setDraftHiddenSections(normalizeOverviewHiddenSections(hiddenSections))
    setDraftLayoutTemplates(normalizeOverviewLayoutTemplates(layoutTemplates))
    setDraftWorkflowLinkMode(workflowLinkMode)
    setLayoutTemplateName('')
    setSubmitting(false)
  }, [hiddenSections, layoutTemplates, open, sectionOrder, workflowLinkMode])

  const hiddenSectionSet = useMemo(() => new Set(draftHiddenSections), [draftHiddenSections])
  const activePreset = useMemo(
    () => resolveOverviewLayoutPreset(draftOrder, draftHiddenSections),
    [draftHiddenSections, draftOrder],
  )
  const activeLayoutTemplate = useMemo(
    () => resolveOverviewLayoutTemplate(draftOrder, draftHiddenSections, draftLayoutTemplates),
    [draftHiddenSections, draftLayoutTemplates, draftOrder],
  )
  const activeLayout = useMemo(
    () => resolveOverviewLayout(draftOrder, draftHiddenSections, draftLayoutTemplates),
    [draftHiddenSections, draftLayoutTemplates, draftOrder],
  )

  if (!open) {
    return null
  }

  const handleToggleHidden = (sectionId: OverviewSectionId) => {
    setDraftHiddenSections((currentSections) => {
      if (currentSections.includes(sectionId)) {
        return currentSections.filter((currentSectionId) => currentSectionId !== sectionId)
      }

      return normalizeOverviewHiddenSections([...currentSections, sectionId])
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setSubmitting(true)
    try {
      await onSubmit({
        sectionOrder: normalizeOverviewSectionOrder(draftOrder),
        hiddenSections: normalizeOverviewHiddenSections(draftHiddenSections),
        layoutTemplates: normalizeOverviewLayoutTemplates(draftLayoutTemplates),
        workflowLinkMode: draftWorkflowLinkMode,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveCurrentAsTemplate = () => {
    const normalizedName = layoutTemplateName.trim()
    if (!normalizedName) {
      return
    }

    setDraftLayoutTemplates((currentTemplates) => {
      const matchedTemplate = currentTemplates.find(
        (layoutTemplate) => layoutTemplate.name.localeCompare(normalizedName, 'zh-CN') === 0,
      )

      const nextTemplate: OverviewLayoutTemplate = {
        id: matchedTemplate?.id ?? activeLayoutTemplate?.id ?? createOverviewLayoutTemplateId(),
        name: normalizedName,
        sectionOrder: normalizeOverviewSectionOrder(draftOrder),
        hiddenSections: normalizeOverviewHiddenSections(draftHiddenSections),
      }

      return normalizeOverviewLayoutTemplates(
        matchedTemplate
          ? currentTemplates.map((layoutTemplate) =>
              layoutTemplate.id === matchedTemplate.id ? nextTemplate : layoutTemplate,
            )
          : [...currentTemplates, nextTemplate],
      )
    })
    setLayoutTemplateName('')
  }

  const handleDeleteTemplate = (templateId: string) => {
    setDraftLayoutTemplates((currentTemplates) =>
      currentTemplates.filter((layoutTemplate) => layoutTemplate.id !== templateId),
    )
  }

  return (
    <div className="modal-backdrop overflow-y-auto" onClick={onClose}>
      <div
        ref={containerRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-shell max-w-3xl"
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <div className="modal-header">
          <div>
            <div className="modal-kicker">DeskHub Overview</div>
            <h2 ref={headingRef} className="modal-title" id={titleId} tabIndex={-1}>
              自定义总览布局
            </h2>
            <p className="modal-description" id={descriptionId}>
              调整总览页区块顺序、显示状态和预设风格，让 DeskHub 更贴合你的使用习惯。
            </p>
          </div>
          <button aria-label="关闭总览布局设置" className="btn-icon" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="modal-body grid gap-5" onSubmit={handleSubmit}>
          <section className="modal-panel">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  预设布局
                </div>
                <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                  先套用一个总览模板，再按你的习惯细调区块顺序和显隐。
                </div>
              </div>
              <div className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1 text-xs text-[color:var(--text-muted)]">
                当前：{activeLayout.title}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {OVERVIEW_LAYOUT_PRESETS.map((preset) => {
                const selected = activePreset?.id === preset.id

                return (
                  <button
                    key={preset.id}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      selected
                        ? 'border-[color:var(--accent)] bg-[#f4f8fd] shadow-[0_12px_24px_rgba(55,138,221,0.08)]'
                        : 'border-[color:var(--border)] bg-white hover:border-[color:var(--border-strong)] hover:bg-[#fcfcfb]'
                    }`}
                    type="button"
                    onClick={() => {
                      setDraftOrder(preset.sectionOrder)
                      setDraftHiddenSections(preset.hiddenSections)
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-xl p-2 ${
                            selected
                              ? 'bg-white text-[color:var(--accent)]'
                              : 'bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]'
                          }`}
                        >
                          <LayoutTemplate className="h-4 w-4" />
                        </span>
                        <div className="text-sm font-semibold text-[color:var(--text)]">{preset.title}</div>
                      </div>
                      {selected ? (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--accent)]">
                          当前
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm text-[color:var(--text-muted)]">{preset.description}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {preset.sectionOrder.map((sectionId) => (
                        <span
                          key={`${preset.id}-${sectionId}`}
                          className={`rounded-full border px-2 py-1 text-[11px] ${
                            preset.hiddenSections.includes(sectionId)
                              ? 'border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]'
                              : 'border-[#d8e4f4] bg-white text-[color:var(--text-muted)]'
                          }`}
                        >
                          {OVERVIEW_SECTION_LABELS[sectionId]}
                          {preset.hiddenSections.includes(sectionId) ? ' · 隐藏' : ''}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="modal-panel">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  我的布局模板
                </div>
                <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                  把当前区块顺序和显隐保存为命名快照，之后可以快速复用。
                </div>
              </div>
              <div className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1 text-xs text-[color:var(--text-muted)]">
                已保存 {draftLayoutTemplates.length} 个
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),auto]">
              <input
                aria-label="布局模板名称"
                className="field"
                placeholder="例如：晨间开工 / 盘点模式"
                value={layoutTemplateName}
                onChange={(event) => setLayoutTemplateName(event.target.value)}
              />
              <button
                className="btn-secondary gap-2 px-3 py-2"
                disabled={!layoutTemplateName.trim()}
                type="button"
                onClick={handleSaveCurrentAsTemplate}
              >
                <Plus className="h-4 w-4" />
                保存为模板
              </button>
            </div>

            {draftLayoutTemplates.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {draftLayoutTemplates.map((layoutTemplate) => {
                  const selected = activeLayoutTemplate?.id === layoutTemplate.id

                  return (
                    <div
                      key={layoutTemplate.id}
                      className={`rounded-2xl border px-4 py-4 transition ${
                        selected
                          ? 'border-[color:var(--accent)] bg-[#f4f8fd]'
                          : 'border-[color:var(--border)] bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[color:var(--text)]">
                            {layoutTemplate.name}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--text-soft)]">
                            {selected ? '当前正在使用这组布局' : '已保存的命名布局快照'}
                          </div>
                        </div>
                        <button
                          aria-label={`删除模板 ${layoutTemplate.name}`}
                          className="btn-icon"
                          type="button"
                          onClick={() => handleDeleteTemplate(layoutTemplate.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {layoutTemplate.sectionOrder.map((sectionId) => (
                          <span
                            key={`${layoutTemplate.id}-${sectionId}`}
                            className={`rounded-full border px-2 py-1 text-[11px] ${
                              layoutTemplate.hiddenSections.includes(sectionId)
                                ? 'border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]'
                                : 'border-[#d8e4f4] bg-white text-[color:var(--text-muted)]'
                            }`}
                          >
                            {OVERVIEW_SECTION_LABELS[sectionId]}
                            {layoutTemplate.hiddenSections.includes(sectionId) ? ' · 隐藏' : ''}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4">
                        <button
                          aria-label={`应用模板 ${layoutTemplate.name}`}
                          className="btn-secondary px-3 py-2 text-xs"
                          type="button"
                          onClick={() => {
                            setDraftOrder(layoutTemplate.sectionOrder)
                            setDraftHiddenSections(layoutTemplate.hiddenSections)
                          }}
                        >
                          应用模板
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border)] bg-white px-4 py-4 text-sm text-[color:var(--text-muted)]">
                还没有保存过命名模板。先调好区块顺序，再把当前布局存成一个快照。
              </div>
            )}
          </section>

          <section className="modal-panel">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  默认工作流联动
                </div>
                <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                  当你设置了默认工作流后，总览可以自动把工作流区块提到更前面。
                </div>
              </div>
              <div
                className={`rounded-full px-3 py-1 text-xs ${
                  hasDefaultWorkflow
                    ? 'border border-[#d9e7c0] bg-[#f3f9e9] text-[color:var(--ready)]'
                    : 'border border-[color:var(--border)] bg-white text-[color:var(--text-soft)]'
                }`}
              >
                {hasDefaultWorkflow ? '已检测到默认工作流' : '当前未设置默认工作流'}
              </div>
            </div>

            <div className="grid gap-3">
              {(
                Object.entries(OVERVIEW_WORKFLOW_LINK_MODE_LABELS) as Array<
                  [OverviewWorkflowLinkMode, string]
                >
              ).map(([mode, label]) => {
                const selected = draftWorkflowLinkMode === mode

                return (
                  <label
                    key={mode}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 ${
                      selected
                        ? 'border-[color:var(--accent)] bg-[#f4f8fd]'
                        : 'border-[color:var(--border)] bg-white'
                    }`}
                  >
                    <input
                      checked={selected}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                      name="overview-workflow-link-mode"
                      type="radio"
                      onChange={() => setDraftWorkflowLinkMode(mode)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[color:var(--text)]">{label}</span>
                      <span className="mt-1 block text-sm text-[color:var(--text-muted)]">
                        {mode === 'none'
                          ? '保持你手动设置的区块顺序和显隐，不做自动调整。'
                          : '一旦存在默认工作流，DeskHub 会自动显示工作流区块并把它提到最前面。'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

          <section className="modal-panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  总览区块
                </div>
                <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                  已开启的区块会按这里的顺序从上到下展示。
                </div>
              </div>
              <button
                className="btn-secondary gap-2 px-3 py-2 text-xs"
                type="button"
                onClick={() => {
                  setDraftOrder(OVERVIEW_SECTION_ORDER_DEFAULT)
                  setDraftHiddenSections([])
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                恢复默认
              </button>
            </div>

            <div className="grid gap-2">
              {draftOrder.map((sectionId, index) => {
                const definition = OVERVIEW_SECTION_DEFINITIONS.find((section) => section.id === sectionId)
                if (!definition) {
                  return null
                }

                const hidden = hiddenSectionSet.has(sectionId)

                return (
                  <div
                    key={sectionId}
                    className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[color:var(--text)]">
                          {OVERVIEW_SECTION_LABELS[sectionId]}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            hidden
                              ? 'bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]'
                              : 'bg-[#eef5fd] text-[color:var(--accent)]'
                          }`}
                        >
                          {hidden ? '已隐藏' : '显示中'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[color:var(--text-muted)]">{definition.description}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        aria-label={`上移 ${definition.title}`}
                        className="btn-icon"
                        disabled={index === 0}
                        type="button"
                        onClick={() => setDraftOrder((currentOrder) => moveSection(currentOrder, index, -1))}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`下移 ${definition.title}`}
                        className="btn-icon"
                        disabled={index === draftOrder.length - 1}
                        type="button"
                        onClick={() => setDraftOrder((currentOrder) => moveSection(currentOrder, index, 1))}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`${hidden ? '显示' : '隐藏'} ${definition.title}`}
                        className="btn-secondary gap-2 px-3 py-2 text-xs"
                        type="button"
                        onClick={() => handleToggleHidden(sectionId)}
                      >
                        {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {hidden ? '显示' : '隐藏'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="modal-footer px-0 pb-0">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="btn-secondary" type="button" onClick={onClose}>
                取消
              </button>
              <button className="btn-primary" disabled={submitting} type="submit">
                {submitting ? '保存中...' : '保存布局'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
