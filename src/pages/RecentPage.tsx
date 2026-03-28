import { History } from 'lucide-react'
import { Suspense, lazy, useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DeferredModalFallback } from '../components/DeferredModalFallback'
import { EmptyState } from '../components/EmptyState'
import { ResourceRowCard } from '../components/ResourceRowCard'
import { SearchBar } from '../components/SearchBar'
import { VirtualList } from '../components/VirtualList'
import { useItems } from '../hooks/useItems'
import { useWorkflowLaunch } from '../hooks/useWorkflowLaunch'
import { useSearch } from '../hooks/useSearch'
import { itemToDuplicatePayload, sortItemsByRecent } from '../lib/item-utils'
import type { DeskItem, ItemPayload } from '../types/items'

const ItemFormModal = lazy(() =>
  import('../components/ItemFormModal').then((module) => ({ default: module.ItemFormModal })),
)

export function RecentPage() {
  const { items, loading, createItem, updateItem, deleteItem, toggleFavorite, clearRecentItems } =
    useItems()
  const { launchItemWithPrompt, workflowExecutionSummaryDialog, workflowLaunchDialog } = useWorkflowLaunch()
  const [query, setQuery] = useState('')
  const [editingItem, setEditingItem] = useState<DeskItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<DeskItem | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const recentItemsSource = useMemo(
    () => sortItemsByRecent(items).filter((item) => item.lastLaunchedAt),
    [items],
  )
  const recentItems = useSearch(recentItemsSource, query)

  const closeForm = () => {
    setEditingItem(null)
    setFormOpen(false)
  }

  const handleSubmit = async (payload: ItemPayload) => {
    if (editingItem) {
      await updateItem(editingItem.id, payload)
    } else {
      await createItem(payload)
    }
    closeForm()
  }

  const handleDelete = async () => {
    if (!deletingItem) {
      return
    }

    await deleteItem(deletingItem.id)
    setDeletingItem(null)
  }

  const handleDuplicate = async (item: DeskItem) => {
    await createItem(itemToDuplicatePayload(item))
  }

  return (
    <div className="grid gap-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="page-kicker">DeskHub Timeline</div>
          <h1 className="page-title">最近使用</h1>
          <p className="page-description mt-1">所有最近启动过的入口会按时间倒序排列在这里。</p>
        </div>
        <button className="btn-secondary gap-2" type="button" onClick={() => setConfirmClear(true)}>
          <History className="h-4 w-4" />
          清空最近使用
        </button>
      </section>

      <SearchBar placeholder="按名称、标签或类型筛选最近使用" resultCount={recentItems.length} value={query} onChange={setQuery} />

      {loading ? (
        <EmptyState title="正在加载最近记录" description="DeskHub 正在读取本地数据库中的启动记录。" />
      ) : recentItems.length ? (
        <VirtualList
          estimateSize={112}
          getKey={(item) => item.id}
          items={recentItems}
          renderItem={(item) => (
            <ResourceRowCard
              compactMeta
              item={item}
              onDelete={(nextItem) => setDeletingItem(nextItem)}
              onDuplicate={(nextItem) => void handleDuplicate(nextItem)}
              onEdit={(nextItem) => {
                setEditingItem(nextItem)
                setFormOpen(true)
              }}
              onLaunch={(nextItem) => void launchItemWithPrompt(nextItem)}
              onToggleFavorite={(nextItem) => void toggleFavorite(nextItem.id, !nextItem.favorite)}
            />
          )}
        />
      ) : (
        <EmptyState title="还没有最近记录" description="启动任意条目后，这里会自动出现时间线。" />
      )}

      {formOpen ? (
        <Suspense fallback={<DeferredModalFallback title="正在加载表单..." />}>
          <ItemFormModal
            item={editingItem}
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

      <ConfirmDialog
        cancelLabel="保留"
        confirmLabel="删除"
        description={deletingItem ? `删除后，${deletingItem.name} 将从 DeskHub 中移除。` : ''}
        open={Boolean(deletingItem)}
        title="删除这个条目？"
        onCancel={() => setDeletingItem(null)}
        onConfirm={() => void handleDelete()}
      />

      <ConfirmDialog
        cancelLabel="保留"
        confirmLabel="清空最近使用"
        description="这会清空所有条目的最近启动时间，但不会删除任何条目。"
        open={confirmClear}
        title="清空最近使用记录？"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() =>
          void (async () => {
            await clearRecentItems()
            setConfirmClear(false)
          })()
        }
      />

      {workflowLaunchDialog}
      {workflowExecutionSummaryDialog}
    </div>
  )
}
