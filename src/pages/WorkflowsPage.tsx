import { save as saveDialog } from '@tauri-apps/plugin-dialog'
import { ArrowUpDown, CheckSquare, Download, Plus } from 'lucide-react'
import { Suspense, lazy, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { BatchEditModal } from '../components/BatchEditModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DeferredModalFallback } from '../components/DeferredModalFallback'
import { EmptyState } from '../components/EmptyState'
import { SearchBar } from '../components/SearchBar'
import { SelectionToolbar } from '../components/SelectionToolbar'
import { TagFilterMenu } from '../components/TagFilterMenu'
import { WorkflowCard } from '../components/WorkflowCard'
import { useItems } from '../hooks/useItems'
import { usePersistedListControls } from '../hooks/usePersistedListControls'
import { useSelectionController } from '../hooks/useSelectionController'
import { useSelectionShortcuts } from '../hooks/useSelectionShortcuts'
import { useSearch } from '../hooks/useSearch'
import { useWorkflowLaunch } from '../hooks/useWorkflowLaunch'
import {
  buildItemsExportFile,
  collectItemTags,
  filterItemsByTags,
  itemToDuplicatePayload,
  isWorkflowItem,
  LIST_SORT_LABELS,
  LIST_SORT_OPTIONS,
  sortItems,
} from '../lib/item-utils'
import { getReleaseCaptureConfig } from '../lib/release-demo'
import { WORKFLOW_TEMPLATES, workflowTemplateToFormValues } from '../lib/workflow-templates'
import type { DeskItem, ItemFormValues, ItemPayload, ListSortOption, WorkflowItem } from '../types/items'

const ItemFormModal = lazy(() =>
  import('../components/ItemFormModal').then((module) => ({ default: module.ItemFormModal })),
)

async function pickWorkflowExportPath() {
  return saveDialog({
    title: '导出工作流',
    defaultPath: `deskhub-workflows-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'DeskHub JSON', extensions: ['json'] }],
  })
}

export function WorkflowsPage() {
  const {
    items,
    defaultWorkflow,
    loading,
    createItem,
    updateItem,
    deleteItem,
    deleteItems,
    toggleFavorite,
    setItemsFavorite,
    batchEditItems,
    setDefaultWorkflow,
    exportItems,
  } = useItems()
  const { launchItemWithPrompt, workflowExecutionSummaryDialog, workflowLaunchDialog } = useWorkflowLaunch()
  const location = useLocation()
  const releaseCapture = useMemo(
    () => getReleaseCaptureConfig(location.search),
    [location.search],
  )
  const [query, setQuery] = useState(() => releaseCapture.listQuery)
  const {
    sortOption,
    selectedTags,
    selectionMode,
    setSortOption,
    setSelectedTags,
    setSelectionMode,
  } = usePersistedListControls(
    'deskhub:list-controls:/workflows',
    releaseCapture.enabled
      ? {
          sortOption: releaseCapture.sortOption ?? undefined,
          selectedTags: releaseCapture.selectedTags,
          selectionMode: releaseCapture.selectionMode,
        }
      : null,
  )
  const [editingWorkflow, setEditingWorkflow] = useState<DeskItem | null>(null)
  const [initialWorkflowValues, setInitialWorkflowValues] = useState<Partial<ItemFormValues> | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deletingWorkflow, setDeletingWorkflow] = useState<DeskItem | null>(null)
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [batchEditOpen, setBatchEditOpen] = useState(false)

  const workflowItems = useMemo(() => items.filter(isWorkflowItem), [items])
  const searchedWorkflows = useSearch(workflowItems, query)
  const tagFiltered = useMemo(
    () => filterItemsByTags(searchedWorkflows, selectedTags),
    [searchedWorkflows, selectedTags],
  )
  const workflows = useMemo(
    () => sortItems(tagFiltered, sortOption).filter(isWorkflowItem),
    [sortOption, tagFiltered],
  )
  const availableTags = useMemo(() => collectItemTags(workflowItems), [workflowItems])
  const {
    selectedIds,
    clearSelection,
    selectAll,
    handleSelect,
  } = useSelectionController(workflows.map((item) => item.id))
  const selectedWorkflows = useMemo(
    () => workflows.filter((item) => selectedIds.includes(item.id)),
    [selectedIds, workflows],
  )
  const showDefaultHint = new URLSearchParams(location.search).get('focus') === 'default-workflow'

  const closeForm = () => {
    setEditingWorkflow(null)
    setInitialWorkflowValues(null)
    setFormOpen(false)
  }

  const clearSelectionMode = () => {
    setSelectionMode(false)
    clearSelection()
  }

  useSelectionShortcuts({
    enabled: selectionMode,
    hasSelection: selectedIds.length > 0,
    onSelectAll: selectAll,
    onExit: clearSelectionMode,
    onDelete: () => setShowBatchDeleteConfirm(true),
  })

  const handleDuplicate = async (workflow: WorkflowItem) => {
    await createItem(itemToDuplicatePayload(workflow))
  }

  const handleSubmit = async (payload: ItemPayload) => {
    if (editingWorkflow) {
      await updateItem(editingWorkflow.id, payload)
    } else {
      await createItem(payload)
    }
    closeForm()
  }

  const handleDelete = async () => {
    if (!deletingWorkflow) {
      return
    }

    await deleteItem(deletingWorkflow.id)
    setDeletingWorkflow(null)
  }

  const handleDefaultToggle = async (workflow: WorkflowItem) => {
    if (defaultWorkflow?.id === workflow.id) {
      await setDefaultWorkflow(null)
      return
    }

    await setDefaultWorkflow(workflow.id)
  }

  const handleExportSelected = async () => {
    if (!selectedIds.length) {
      return
    }

    const path = await pickWorkflowExportPath()
    if (!path) {
      return
    }

    await exportItems(path, selectedIds)
  }

  const handleExportFiltered = async () => {
    if (!workflows.length) {
      toast.message('当前筛选结果为空。')
      return
    }

    const path = await pickWorkflowExportPath()
    if (!path) {
      return
    }

    await exportItems(
      path,
      workflows.map((item) => item.id),
    )
  }

  const handleCopySelectedJson = async () => {
    if (!selectedWorkflows.length) {
      return
    }

    await navigator.clipboard.writeText(JSON.stringify(buildItemsExportFile(selectedWorkflows), null, 2))
    toast.success('已复制所选工作流的 JSON。')
  }

  return (
    <div className="grid gap-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="page-kicker">DeskHub Workflow Studio</div>
          <h1 className="page-title">工作流</h1>
          <p className="page-description mt-1">把路径、命令和网站编排成一条可以重复执行的工作链。</p>
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => {
            setEditingWorkflow(null)
            setInitialWorkflowValues(null)
            setFormOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          新建工作流
        </button>
      </section>

      {showDefaultHint ? (
        <div className="surface border-[color:var(--accent)] bg-[#f4f8fd] px-4 py-3 text-sm text-[color:var(--accent)] shadow-none">
          请选择一个工作流设为默认，这样顶部的“一键上班模式”就能直接启动它。
        </div>
      ) : null}

      <SearchBar
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-muted)]">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <select
                aria-label="工作流排序"
                className="bg-transparent outline-none"
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as ListSortOption)}
              >
                {LIST_SORT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {LIST_SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>

            <TagFilterMenu
              selectedTags={selectedTags}
              tags={availableTags}
              onClear={() => setSelectedTags([])}
              onToggleTag={(tag) =>
                setSelectedTags((current) =>
                  current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag],
                )
              }
            />

            <button
              className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
                selectionMode
                  ? 'border-[color:var(--accent)] bg-[#f4f8fd] text-[color:var(--accent)]'
                  : 'border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]'
              }`}
              type="button"
              onClick={() => (selectionMode ? clearSelectionMode() : setSelectionMode(true))}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {selectionMode ? '退出选择' : '选择模式'}
            </button>

            <button className="btn-secondary gap-2 px-3 py-2 text-xs" type="button" onClick={() => void handleExportFiltered()}>
              <Download className="h-3.5 w-3.5" />
              导出当前筛选
            </button>
          </div>
        }
        placeholder="按名称、标签、步骤或描述筛选工作流"
        resultCount={workflows.length}
        value={query}
        onChange={setQuery}
      />

      {!loading ? (
        <section className="grid gap-3 xl:grid-cols-3">
          {WORKFLOW_TEMPLATES.map((template) => (
            <button
              key={template.id}
              className="surface-muted flex flex-col items-start gap-2 px-4 py-4 text-left transition hover:-translate-y-[1px] hover:border-[color:var(--accent)] hover:bg-white hover:shadow-[0_12px_24px_rgba(15,23,42,0.04)]"
              type="button"
              onClick={() => {
                setEditingWorkflow(null)
                setInitialWorkflowValues(workflowTemplateToFormValues(template))
                setFormOpen(true)
              }}
            >
              <span className="text-sm font-semibold text-[color:var(--text)]">{template.name}</span>
              <span className="text-sm text-[color:var(--text-muted)]">{template.summary}</span>
            </button>
          ))}
        </section>
      ) : null}

      {selectionMode ? (
        <SelectionToolbar
          selectedCount={selectedIds.length}
          totalCount={workflows.length}
          onClearSelection={clearSelectionMode}
          onBatchEdit={() => setBatchEditOpen(true)}
          onCopyJson={() => void handleCopySelectedJson()}
          onDelete={() => setShowBatchDeleteConfirm(true)}
          onExport={() => void handleExportSelected()}
          onFavorite={() => void setItemsFavorite(selectedIds, true)}
          onSelectAll={selectAll}
          onUnfavorite={() => void setItemsFavorite(selectedIds, false)}
        />
      ) : null}

      {loading ? (
        <EmptyState title="正在加载工作流" description="DeskHub 正在从本地数据库读取自动化链路。" />
      ) : workflows.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {workflows.map((item) => (
            <WorkflowCard
              key={item.id}
              isDefault={defaultWorkflow?.id === item.id}
              item={item}
              selected={selectedIds.includes(item.id)}
              selectionMode={selectionMode}
              onDelete={(nextItem) => setDeletingWorkflow(nextItem)}
              onDuplicate={(nextItem: WorkflowItem) => void handleDuplicate(nextItem)}
              onEdit={(nextItem) => {
                setEditingWorkflow(nextItem)
                setInitialWorkflowValues(null)
                setFormOpen(true)
              }}
              onLaunch={(nextItem: WorkflowItem) => void launchItemWithPrompt(nextItem)}
              onSelectChange={(nextItem, _selected, interaction) => handleSelect(nextItem.id, interaction)}
              onSetDefault={(nextItem: WorkflowItem) => void handleDefaultToggle(nextItem)}
              onToggleFavorite={(nextItem: WorkflowItem) => void toggleFavorite(nextItem.id, !nextItem.favorite)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          actionLabel="新建工作流"
          description="把目录、网站和脚本串成一条工作链，减少每天重复操作。"
          title="还没有工作流"
          onAction={() => {
            setEditingWorkflow(null)
            setInitialWorkflowValues(null)
            setFormOpen(true)
          }}
        />
      )}

      {formOpen ? (
        <Suspense fallback={<DeferredModalFallback title="正在加载工作流表单..." />}>
          <ItemFormModal
            allowedTypes={['workflow']}
            initialValues={initialWorkflowValues ?? undefined}
            item={editingWorkflow}
            open={formOpen}
            onClose={closeForm}
            onSaveAsNew={async (payload) => {
              await createItem(payload)
              closeForm()
            }}
            onSubmit={handleSubmit}
          />
        </Suspense>
      ) : null}

      <BatchEditModal
        open={batchEditOpen}
        selectedCount={selectedIds.length}
        onClose={() => setBatchEditOpen(false)}
        onSubmit={async (payload) => {
          await batchEditItems({ ...payload, ids: selectedIds })
          setBatchEditOpen(false)
        }}
      />

      <ConfirmDialog
        cancelLabel="保留"
        confirmLabel="删除"
        description={deletingWorkflow ? `删除后，${deletingWorkflow.name} 将从 DeskHub 中移除。` : ''}
        open={Boolean(deletingWorkflow)}
        title="删除这个工作流？"
        onCancel={() => setDeletingWorkflow(null)}
        onConfirm={() => void handleDelete()}
      />

      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="批量删除"
        description={`将删除当前选中的 ${selectedIds.length} 个工作流，这个操作不可撤销。`}
        open={showBatchDeleteConfirm}
        title="批量删除这些工作流？"
        onCancel={() => setShowBatchDeleteConfirm(false)}
        onConfirm={() =>
          void (async () => {
            await deleteItems(selectedIds)
            setShowBatchDeleteConfirm(false)
            clearSelectionMode()
          })()
        }
      />

      {workflowLaunchDialog}
      {workflowExecutionSummaryDialog}
    </div>
  )
}
