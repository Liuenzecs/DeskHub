import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  PlayCircle,
  RotateCcw,
  SkipForward,
  X,
} from 'lucide-react'
import { useMemo } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'
import {
  EXECUTION_MODE_LABELS,
  formatDelayMs,
  getWorkflowStepValue,
  resolveWorkflowPlaceholders,
  WORKFLOW_STEP_LABELS,
} from '../lib/item-utils'
import type {
  LaunchResponse,
  WorkflowItem,
  WorkflowStepResult,
  WorkflowStepStatus,
  WorkflowVariableInput,
} from '../types/items'

interface WorkflowExecutionSummaryDialogProps {
  open: boolean
  workflow: WorkflowItem | null
  result: LaunchResponse | null
  variableInputs: WorkflowVariableInput[]
  onClose: () => void
}

type VisualStepStatus = WorkflowStepStatus | 'pending'

const STATUS_LABELS: Record<VisualStepStatus, string> = {
  completed: '执行完成',
  failed: '执行失败',
  continued: '失败后继续',
  skipped: '条件跳过',
  jumped: '条件跳转',
  pending: '未执行',
}

const STATUS_STYLES: Record<VisualStepStatus, string> = {
  completed: 'border-[color:var(--accent)] bg-[#f8fbff]',
  failed: 'border-[#f0b7a2] bg-[#fff7f4]',
  continued: 'border-[#ead7b2] bg-[#fbf5e8]',
  skipped: 'border-[color:var(--border)] bg-[color:var(--surface-muted)]',
  jumped: 'border-[#d8d2f0] bg-[#f7f4ff]',
  pending: 'border-[color:var(--border)] bg-white',
}

const STATUS_BADGE_STYLES: Record<VisualStepStatus, string> = {
  completed: 'bg-white text-[color:var(--accent)]',
  failed: 'bg-white text-[#c95a28]',
  continued: 'bg-white text-[#8A5A1D]',
  skipped: 'bg-white text-[color:var(--text-soft)]',
  jumped: 'bg-white text-[#5a46b2]',
  pending: 'bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]',
}

function buildVariableMap(
  workflow: WorkflowItem,
  usedWorkflowVariables: WorkflowVariableInput[] | null | undefined,
  variableInputs: WorkflowVariableInput[],
) {
  const providedMap = new Map((usedWorkflowVariables ?? variableInputs).map((entry) => [entry.key, entry.value]))
  return new Map(
    (workflow.variables ?? []).map((variable) => [
      variable.key,
      (providedMap.get(variable.key) ?? variable.defaultValue).trim(),
    ]),
  )
}

function resolveVisualStatus(
  index: number,
  stepResult: WorkflowStepResult | undefined,
  startedStepIndex: number,
  executedUntil: number,
  failedStepIndex: number | null,
): VisualStepStatus {
  if (stepResult) {
    return stepResult.status
  }

  if (index < startedStepIndex) {
    return 'skipped'
  }

  if (failedStepIndex === index) {
    return 'failed'
  }

  if (index < executedUntil) {
    return 'completed'
  }

  return 'pending'
}

function fallbackStepMessage(status: VisualStepStatus, startedStepIndex: number, index: number) {
  if (status === 'skipped' && index < startedStepIndex) {
    return '本次从后续步骤开始执行，这一步没有被触发。'
  }

  if (status === 'pending') {
    return '本次未执行到此步骤。'
  }

  if (status === 'completed') {
    return '步骤已执行完成。'
  }

  return null
}

export function WorkflowExecutionSummaryDialog({
  open,
  workflow,
  result,
  variableInputs,
  onClose,
}: WorkflowExecutionSummaryDialogProps) {
  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open,
    onClose,
  })

  const variableMap = useMemo(
    () =>
      workflow
        ? buildVariableMap(workflow, result?.usedWorkflowVariables ?? null, variableInputs)
        : new Map<string, string>(),
    [result?.usedWorkflowVariables, variableInputs, workflow],
  )

  const stepResultMap = useMemo(
    () =>
      new Map(
        (result?.stepResults ?? []).map((entry) => [entry.stepId, entry] satisfies [string, WorkflowStepResult]),
      ),
    [result?.stepResults],
  )

  if (!open || !workflow || !result) {
    return null
  }

  const startedStepIndex = result.startedStepIndex ?? 0
  const executedStepCount = result.executedStepCount ?? 0
  const failedStepIndex = result.failedStepIndex ?? null
  const totalStepCount = result.totalStepCount ?? workflow.steps.length
  const warningCount = result.warningCount ?? 0
  const executedUntil = startedStepIndex + executedStepCount

  return (
    <div className="modal-backdrop overflow-y-auto" onClick={onClose}>
      <div
        ref={containerRef}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal-shell max-w-5xl"
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <div className="modal-header">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
                result.success ? 'bg-[#edf6e2] text-[color:var(--ready)]' : 'bg-[#fff5f2] text-[#c95a28]'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="h-4.5 w-4.5" />
              ) : (
                <AlertTriangle className="h-4.5 w-4.5" />
              )}
            </span>
            <div>
              <div className="modal-kicker">Workflow Result</div>
              <h2 className="modal-title" id={titleId}>
                {result.success ? '工作流执行完成' : '工作流执行结束'}
              </h2>
              <p className="modal-description" id={descriptionId}>
                {workflow.name} · {result.message}
              </p>
            </div>
          </div>
          <button aria-label="关闭工作流执行摘要" className="btn-icon" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-body grid gap-5">
          <section className="grid gap-3 md:grid-cols-4">
            <div className="surface-muted px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                起始步骤
              </div>
              <div className="mt-2 text-lg font-semibold text-[color:var(--text)]">
                第 {startedStepIndex + 1} 步
              </div>
            </div>
            <div className="surface-muted px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                已处理步骤
              </div>
              <div className="mt-2 text-lg font-semibold text-[color:var(--text)]">
                {executedStepCount} / {totalStepCount}
              </div>
            </div>
            <div className="surface-muted px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                Warning
              </div>
              <div className="mt-2 text-lg font-semibold text-[color:var(--text)]">{warningCount}</div>
            </div>
            <div className="surface-muted px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                最终状态
              </div>
              <div className="mt-2 text-lg font-semibold text-[color:var(--text)]">
                {result.success ? '成功' : '失败'}
              </div>
            </div>
          </section>

          {(workflow.variables ?? []).length ? (
            <section className="modal-panel grid gap-3">
              <div className="text-sm font-semibold text-[color:var(--text)]">本次变量</div>
              <div className="grid gap-3 md:grid-cols-2">
                {(workflow.variables ?? []).map((variable) => (
                  <div
                    key={variable.id}
                    className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-3"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                      {variable.label || variable.key}
                    </div>
                    <div className="mt-2 break-all text-sm font-medium text-[color:var(--text)]">
                      {variableMap.get(variable.key) || '未填写'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-3">
            {workflow.steps.map((step, index) => {
              const resolvedValue = resolveWorkflowPlaceholders(getWorkflowStepValue(step), variableMap)
              const stepResult = stepResultMap.get(step.id)
              const visualStatus = resolveVisualStatus(
                index,
                stepResult,
                startedStepIndex,
                executedUntil,
                failedStepIndex,
              )
              const attempts = stepResult?.attempts ?? (visualStatus === 'completed' || visualStatus === 'failed' ? 1 : 0)
              const message =
                stepResult?.message ?? fallbackStepMessage(visualStatus, startedStepIndex, index)
              const targetStepIndex = stepResult?.targetStepIndex ?? null

              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border px-4 py-3 ${STATUS_STYLES[visualStatus]}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-xl bg-white p-2 text-[color:var(--accent)]">
                          <PlayCircle className="h-4 w-4" />
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
                        {attempts > 1 ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[11px] text-[color:var(--text-muted)]">
                            <RotateCcw className="h-3 w-3" />
                            尝试 {attempts} 次
                          </span>
                        ) : null}
                        {visualStatus === 'jumped' && targetStepIndex !== null ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[11px] text-[color:var(--text-muted)]">
                            <ChevronRight className="h-3 w-3" />
                            跳至 Step {targetStepIndex + 1}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 break-all text-sm font-medium text-[color:var(--text)]">
                        {visualStatus === 'failed' && result.failedStepValue ? result.failedStepValue : resolvedValue}
                      </div>

                      {step.note ? (
                        <div className="mt-2 text-sm text-[color:var(--text-muted)]">{step.note}</div>
                      ) : null}

                      {message ? (
                        <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-white/80 px-3 py-2 text-sm text-[color:var(--text-muted)]">
                          {message}
                        </div>
                      ) : null}

                      {visualStatus === 'skipped' ? (
                        <div className="mt-2 inline-flex items-center gap-1 text-xs text-[color:var(--text-soft)]">
                          <SkipForward className="h-3.5 w-3.5" />
                          该步骤未真正执行
                        </div>
                      ) : null}
                    </div>

                    <span className={`rounded-md px-2 py-1 text-xs ${STATUS_BADGE_STYLES[visualStatus]}`}>
                      {STATUS_LABELS[visualStatus]}
                    </span>
                  </div>
                </div>
              )
            })}
          </section>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" type="button" onClick={onClose}>
            关闭摘要
          </button>
        </div>
      </div>
    </div>
  )
}
