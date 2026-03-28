import { useMemo, useState } from 'react'
import { WorkflowExecutionSummaryDialog } from '../components/WorkflowExecutionSummaryDialog'
import { WorkflowLaunchDialog } from '../components/WorkflowLaunchDialog'
import { useItems } from './useItems'
import type { DeskItem, LaunchResponse, WorkflowItem, WorkflowVariableInput } from '../types/items'

export function useWorkflowLaunch() {
  const { launchItem, launchWorkflow } = useItems()
  const [pendingWorkflow, setPendingWorkflow] = useState<WorkflowItem | null>(null)
  const [lastWorkflowResult, setLastWorkflowResult] = useState<{
    workflow: WorkflowItem
    result: LaunchResponse
    variableInputs: WorkflowVariableInput[]
  } | null>(null)

  const launchItemWithPrompt = async (item: DeskItem): Promise<LaunchResponse | null> => {
    if (item.type !== 'workflow') {
      return launchItem(item.id)
    }

    setPendingWorkflow(item)
    return null
  }

  const openWorkflowLaunch = (workflow: WorkflowItem | null) => {
    if (!workflow) {
      return
    }

    setPendingWorkflow(workflow)
  }

  const workflowLaunchDialog = useMemo(
    () => (
      <WorkflowLaunchDialog
        open={Boolean(pendingWorkflow)}
        workflow={pendingWorkflow}
        onClose={() => setPendingWorkflow(null)}
        onConfirm={async (startStepIndex, variableInputs) => {
          if (!pendingWorkflow) {
            return
          }

          const result = await launchWorkflow(pendingWorkflow.id, startStepIndex, variableInputs)
          setLastWorkflowResult({
            workflow: pendingWorkflow,
            result,
            variableInputs,
          })
          setPendingWorkflow(null)
        }}
      />
    ),
    [launchWorkflow, pendingWorkflow],
  )

  const workflowExecutionSummaryDialog = useMemo(
    () => (
      <WorkflowExecutionSummaryDialog
        open={Boolean(lastWorkflowResult)}
        result={lastWorkflowResult?.result ?? null}
        variableInputs={lastWorkflowResult?.variableInputs ?? []}
        workflow={lastWorkflowResult?.workflow ?? null}
        onClose={() => setLastWorkflowResult(null)}
      />
    ),
    [lastWorkflowResult],
  )

  return {
    pendingWorkflow,
    launchItemWithPrompt,
    openWorkflowLaunch,
    workflowLaunchDialog,
    workflowExecutionSummaryDialog,
  }
}
