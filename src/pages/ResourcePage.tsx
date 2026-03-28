import { save as saveDialog } from '@tauri-apps/plugin-dialog'
import { ArrowUpDown, CheckSquare, Download, Plus } from 'lucide-react'
import { Suspense, lazy, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { BatchEditModal } from '../components/BatchEditModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DeferredModalFallback } from '../components/DeferredModalFallback'
import { EmptyState } from '../components/EmptyState'
import { ResourceRowCard } from '../components/ResourceRowCard'
import { SearchBar } from '../components/SearchBar'
import { SelectionToolbar } from '../components/SelectionToolbar'
import { TagFilterMenu } from '../components/TagFilterMenu'
import { VirtualList } from '../components/VirtualList'
import { useItems } from '../hooks/useItems'
import { usePersistedListControls } from '../hooks/usePersistedListControls'
import { useSelectionController } from '../hooks/useSelectionController'
import { useSelectionShortcuts } from '../hooks/useSelectionShortcuts'
import { useSearch } from '../hooks/useSearch'
import {
  buildItemsExportFile,
  collectItemTags,
  filterItemsByTags,
  itemToDuplicatePayload,
  LIST_SORT_LABELS,
  LIST_SORT_OPTIONS,
  sortItems,
} from '../lib/item-utils'
import type { ResourcePageConfig } from '../lib/navigation'
import { getReleaseCaptureConfig } from '../lib/release-demo'
import type { DeskItem, ItemPayload, ListSortOption } from '../types/items'

const ItemFormModal = lazy(() =>
  import('../components/ItemFormModal').then((module) => ({ default: module.ItemFormModal })),
)

interface ResourcePageProps {
  config: ResourcePageConfig
}

async function pickExportPath(pageTitle: string) {
  return saveDialog({
    title: `导出${pageTitle}`,
    defaultPath: `deskhub-${pageTitle}-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'DeskHub JSON', extensions: ['json'] }],
  })
}

export function ResourcePage({ config }: ResourcePageProps) {
  const location = useLocation()
  const releaseCapture = useMemo(
    () => getReleaseCaptureConfig(location.search),
    [location.search],
  )
  const {
    items,
    loading,
    createItem,
    updateItem,
    deleteItem,
    deleteItems,
    toggleFavorite,
    setItemsFavorite,
    batchEditItems,
    launchItem,
    exportItems,
  } = useItems()
  const [query, setQuery] = useState(() => releaseCapture.listQuery)
  const {
    sortOption,
    selectedTags,
    selectionMode,
    setSortOption,
    setSelectedTags,
    setSelectionMode,
  } = usePersistedListControls(
    `deskhub:list-controls:${config.route}`,
    releaseCapture.enabled
      ? {
          sortOption: releaseCapture.sortOption ?? undefined,
          selectedTags: releaseCapture.selectedTags,
          selectionMode: releaseCapture.selectionMode,
        }
      : null,
  )
  const [editingItem, setEditingItem] = useState<DeskItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<DeskItem | null>(null)
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [batchEditOpen, setBatchEditOpen] = useState(false)

  const itemsByType = useMemo(() => items.filter((item) => item.type === config.type), [config.type, items])
  const searchFiltered = useSearch(itemsByType, query)
  const tagFiltered = useMemo(
    () => filterItemsByTags(searchFiltered, selectedTags),
    [searchFiltered, selectedTags],
  )
  const filteredItems = useMemo(() => sortItems(tagFiltered, sortOption), [sortOption, tagFiltered])
  const availableTags = useMemo(() => collectItemTags(itemsByType), [itemsByType])
  const {
    selectedIds,
    clearSelection,
    selectAll,
    handleSelect,
  } = useSelectionController(filteredItems.map((item) => item.id))
  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedIds.includes(item.id)),
    [filteredItems, selectedIds],
  )

  const closeForm = () => {
    setEditingItem(null)
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

  const handleDuplicate = async (item: DeskItem) => {
    await createItem(itemToDuplicatePayload(item))
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

  const handleExportSelected = async () => {
    if (!selectedIds.length) {
      return
    }

    const path = await pickExportPath(config.title)
    if (!path) {
      return
    }

    await exportItems(path, selectedIds)
  }

  const handleExportFiltered = async () => {
    if (!filteredItems.length) {
      toast.message('当前筛选结果为空。')
      return
    }

    const path = await pickExportPath(config.title)
    if (!path) {
      return
    }

    await exportItems(
      path,
      filteredItems.map((item) => item.id),
    )
  }

  const handleCopySelectedJson = async () => {
    if (!selectedItems.length) {
      return
    }

    await navigator.clipboard.writeText(JSON.stringify(buildItemsExportFile(selectedItems), null, 2))
    toast.success('已复制所选条目的 JSON。')
  }

  return (
    <div className="grid gap-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="page-kicker">DeskHub Library</div>
          <h1 className="page-title">{config.title}</h1>
          <p className="page-description mt-1">{config.description}</p>
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => {
            setEditingItem(null)
            setFormOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          {config.addLabel}
        </button>
      </section>

      <SearchBar
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-muted)]">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <select
                aria-label={`${config.title}排序`}
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
        placeholder={config.searchPlaceholder}
        resultCount={filteredItems.length}
        value={query}
        onChange={setQuery}
      />

      {selectionMode ? (
        <SelectionToolbar
          selectedCount={selectedIds.length}
          totalCount={filteredItems.length}
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
        <EmptyState title={`正在加载${config.title}`} description="DeskHub 正在读取本地数据库中的条目。" />
      ) : filteredItems.length ? (
        <VirtualList
          estimateSize={112}
          getKey={(item) => item.id}
          items={filteredItems}
          renderItem={(item) => (
            <ResourceRowCard
              item={item}
              selected={selectedIds.includes(item.id)}
              selectionMode={selectionMode}
              onDelete={(nextItem) => setDeletingItem(nextItem)}
              onDuplicate={(nextItem) => void handleDuplicate(nextItem)}
              onEdit={(nextItem) => {
                setEditingItem(nextItem)
                setFormOpen(true)
              }}
              onLaunch={(nextItem) => void launchItem(nextItem.id)}
              onSelectChange={(nextItem, _selected, interaction) => handleSelect(nextItem.id, interaction)}
              onToggleFavorite={(nextItem) => void toggleFavorite(nextItem.id, !nextItem.favorite)}
            />
          )}
        />
      ) : (
        <EmptyState
          actionLabel={config.addLabel}
          description={config.emptyDescription}
          title={config.emptyTitle}
          onAction={() => {
            setEditingItem(null)
            setFormOpen(true)
          }}
        />
      )}

      {formOpen ? (
        <Suspense fallback={<DeferredModalFallback title="正在加载表单..." />}>
          <ItemFormModal
            allowedTypes={[config.type]}
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
        description={deletingItem ? `删除后，${deletingItem.name} 将从 DeskHub 中移除。` : ''}
        open={Boolean(deletingItem)}
        title="删除这个条目？"
        onCancel={() => setDeletingItem(null)}
        onConfirm={() => void handleDelete()}
      />

      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="批量删除"
        description={`将删除当前选中的 ${selectedIds.length} 个条目，这个操作不可撤销。`}
        open={showBatchDeleteConfirm}
        title="批量删除这些条目？"
        onCancel={() => setShowBatchDeleteConfirm(false)}
        onConfirm={() =>
          void (async () => {
            await deleteItems(selectedIds)
            setShowBatchDeleteConfirm(false)
            clearSelectionMode()
          })()
        }
      />
    </div>
  )
}
