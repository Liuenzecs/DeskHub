import { Clock3, ExternalLink, FolderOpen, PlayCircle, TerminalSquare, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'
import {
  createWorkflowVariableInputs,
  EXECUTION_MODE_LABELS,
  formatDelayMs,
  getWorkflowStepValue,
  WORKFLOW_STEP_LABELS,
} from '../lib/item-utils'
import type { WorkflowItem, WorkflowStep, WorkflowVariableInput } from '../types/items'

interface WorkflowLaunchDialogProps {
  open: boolean
  workflow: WorkflowItem | null
  onClose: () => void
  onConfirm: (startStepIndex: number, variableInputs: WorkflowVariableInput[]) => Promise<void> | void
}

function StepIcon({ step }: { step: WorkflowStep }) {
  if (step.type === 'open_url') {
    return <ExternalLink className="h-4 w-4" />
  }

  if (step.type === 'run_command') {
    return <TerminalSquare className="h-4 w-4" />
  }

  return <FolderOpen className="h-4 w-4" />
}

export function WorkflowLaunchDialog({
  open,
  workflow,
  onClose,
  onConfirm,
}: WorkflowLaunchDialogProps) {
  const [startStepIndex, setStartStepIndex] = useState(0)
  const [variableInputs, setVariableInputs] = useState<WorkflowVariableInput[]>([])
  const [variableError, setVariableError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const selectRef = useRef<HTMLSelectElement | null>(null)
  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open,
    onClose,
    initialFocusRef: selectRef,
  })

  useEffect(() => {
    if (!open || !workflow) {
      return
    }

    setStartStepIndex(0)
    setVariableInputs(createWorkflowVariableInputs(workflow.variables ?? []))
    setVariableError(null)
    setSubmitting(false)
  }, [open, workflow])

  if (!open || !workflow) {
    return null
  }

  const remainingSteps = workflow.steps.slice(startStepIndex)
  const variableInputMap = new Map(variableInputs.map((entry) => [entry.key, entry.value]))

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
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef5fd] text-[color:var(--accent)]">
              <PlayCircle className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="modal-kicker">Workflow Preview</div>
              <h2 className="modal-title" id={titleId}>
                执行工作流
              </h2>
              <p className="modal-description" id={descriptionId}>
                {workflow.name}
                {workflow.description ? ` · ${workflow.description}` : ''}
              </p>
            </div>
          </div>
          <button aria-label="关闭工作流执行确认" className="btn-icon" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-body grid gap-5">
          <section className="modal-panel grid gap-4 md:grid-cols-[220px,1fr]">
            <div>
              <label className="field-label" htmlFor="workflow-start-step">
                从哪一步开始
              </label>
              <select
                ref={selectRef}
                id="workflow-start-step"
                className="field"
                value={startStepIndex}
                onChange={(event) => setStartStepIndex(Number(event.target.value))}
              >
                {workflow.steps.map((step, index) => (
                  <option key={step.id} value={index}>
                    第 {index + 1} 步 · {WORKFLOW_STEP_LABELS[step.type]}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3">
              <div className="text-sm font-semibold text-[color:var(--text)]">
                本次将执行 {remainingSteps.length} / {workflow.steps.length} 步
              </div>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                你可以从任意步骤开始，长命令会按步骤自己的执行方式启动，方便快速恢复工作状态。
              </p>
            </div>
          </section>

          {(workflow.variables ?? []).length ? (
            <section className="modal-panel grid gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--text)]">启动变量</h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  为这次执行填入动态值，步骤中的
                  {' '}
                  <code className="rounded bg-[color:var(--surface-muted)] px-1 py-0.5 text-xs">
                    {'{{variableKey}}'}
                  </code>
                  {' '}
                  会在启动时自动替换。
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {(workflow.variables ?? []).map((variable) => {
                  const currentValue = variableInputMap.get(variable.key) ?? ''

                  return (
                    <div key={variable.id}>
                      <label className="field-label" htmlFor={`workflow-variable-input-${variable.id}`}>
                        {variable.label || variable.key}
                      </label>
                      <input
                        id={`workflow-variable-input-${variable.id}`}
                        className="field"
                        placeholder={variable.required ? '请输入变量值' : '可选，留空则回退默认值'}
                        value={currentValue}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          setVariableInputs((currentInputs) =>
                            currentInputs.map((entry) =>
                              entry.key === variable.key ? { ...entry, value: nextValue } : entry,
                            ),
                          )
                          setVariableError(null)
                        }}
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-soft)]">
                        <span>占位符：{'{{'}{variable.key}{'}}'}</span>
                        {variable.defaultValue ? <span>默认值：{variable.defaultValue}</span> : null}
                        {variable.required ? <span>必填</span> : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              {variableError ? <p className="text-sm text-red-600">{variableError}</p> : null}
            </section>
          ) : null}

          <section className="grid gap-3">
            {workflow.steps.map((step, index) => {
              const isMuted = index < startStepIndex

              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border px-4 py-3 ${
                    isMuted
                      ? 'border-[color:var(--border)] bg-[color:var(--surface-muted)] opacity-60'
                      : 'border-[color:var(--accent)] bg-[#f8fbff]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-xl bg-white p-2 text-[color:var(--accent)]">
                          <StepIcon step={step} />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                          Step {index + 1}
                        </span>
                        <span className="rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[11px] font-medium text-[color:var(--text-muted)]">
                          {WORKFLOW_STEP_LABELS[step.type]}
                        </span>
                        {step.type === 'run_command' ? (
                          <span className="rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[11px] text-[color:var(--text-muted)]">
                            {EXECUTION_MODE_LABELS[step.executionMode]}
                          </span>
                        ) : null}
                        {step.delayMs > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[11px] text-[color:var(--text-muted)]">
                            <Clock3 className="h-3 w-3" />
                            延迟 {formatDelayMs(step.delayMs)}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 break-all text-sm font-medium text-[color:var(--text)]">
                        {getWorkflowStepValue(step)}
                      </div>
                      {step.note ? (
                        <div className="mt-2 text-sm text-[color:var(--text-muted)]">{step.note}</div>
                      ) : null}
                    </div>

                    <span
                      className={`rounded-md px-2 py-1 text-xs ${
                        isMuted
                          ? 'bg-white text-[color:var(--text-soft)]'
                          : 'bg-white text-[color:var(--accent)]'
                      }`}
                    >
                      {isMuted ? '本次跳过' : '本次执行'}
                    </span>
                  </div>
                </div>
              )
            })}
          </section>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" disabled={submitting} type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="btn-primary"
            disabled={submitting}
            type="button"
            onClick={() =>
              void (async () => {
                const invalidVariable = (workflow.variables ?? []).find((variable) => {
                  if (!variable.required) {
                    return false
                  }

                  const value = variableInputMap.get(variable.key) ?? variable.defaultValue
                  return !value.trim()
                })

                if (invalidVariable) {
                  setVariableError(`变量“${invalidVariable.label || invalidVariable.key}”不能为空。`)
                  return
                }

                setSubmitting(true)
                try {
                  await onConfirm(startStepIndex, variableInputs)
                } finally {
                  setSubmitting(false)
                }
              })()
            }
          >
            {submitting ? '执行中...' : startStepIndex > 0 ? '从这里开始执行' : '执行整个工作流'}
          </button>
        </div>
      </div>
    </div>
  )
}
