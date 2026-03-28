import { LayoutPanelTop, Plus } from 'lucide-react'
import { Suspense, lazy, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CompactTileCard } from '../components/CompactTileCard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DeferredModalFallback } from '../components/DeferredModalFallback'
import { EmptyState } from '../components/EmptyState'
import { OverviewLayoutModal } from '../components/OverviewLayoutModal'
import { ResourceRowCard } from '../components/ResourceRowCard'
import { WorkflowCard } from '../components/WorkflowCard'
import { useItems } from '../hooks/useItems'
import { useWorkflowLaunch } from '../hooks/useWorkflowLaunch'
import {
  applyOverviewWorkflowLinkMode,
  OVERVIEW_SECTION_ORDER_DEFAULT,
  OVERVIEW_WORKFLOW_LINK_MODE_LABELS,
  resolveOverviewLayout,
} from '../lib/overview-layout'
import { isWorkflowItem, itemToDuplicatePayload, sortItemsByRecent } from '../lib/item-utils'
import { RESOURCE_PAGES, findNavItem } from '../lib/navigation'
import type { DeskItem, ItemPayload, OverviewSectionId, WorkflowItem } from '../types/items'

const ItemFormModal = lazy(() =>
  import('../components/ItemFormModal').then((module) => ({ default: module.ItemFormModal })),
)

function SectionHeading({
  title,
  actionLabel,
  to,
}: {
  title: string
  actionLabel: string
  to: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="section-heading">
        {title}
      </h2>
      <Link className="text-xs text-[color:var(--text-soft)] transition hover:text-[color:var(--text)]" to={to}>
        {actionLabel} →
      </Link>
    </div>
  )
}

export function OverviewPage() {
  const {
    items,
    loading,
    uiSettings,
    defaultWorkflow,
    createItem,
    updateItem,
    deleteItem,
    toggleFavorite,
    updateOverviewLayout,
  } = useItems()
  const { launchItemWithPrompt, workflowExecutionSummaryDialog, workflowLaunchDialog } = useWorkflowLaunch()
  const [editingItem, setEditingItem] = useState<DeskItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<DeskItem | null>(null)
  const [layoutModalOpen, setLayoutModalOpen] = useState(false)

  const favorites = items.filter((item) => item.favorite).slice(0, 7)
  const recentItems = sortItemsByRecent(items)
    .filter((item) => item.lastLaunchedAt)
    .slice(0, 5)
  const workflows = items.filter(isWorkflowItem).slice(0, 4)
  const libraryRoutes = useMemo(
    () =>
      [
        ...RESOURCE_PAGES.map((page) => page.route),
        '/workflows',
      ].map((route) => {
        const navItem = findNavItem(route)
        const count =
          route === '/workflows'
            ? items.filter(isWorkflowItem).length
            : items.filter(
                (item) => item.type === RESOURCE_PAGES.find((page) => page.route === route)?.type,
              ).length

        return {
          route,
          count,
          label: navItem?.label ?? route,
          icon: navItem?.icon,
        }
      }),
    [items],
  )
  const visibleSectionIds = useMemo(() => {
    const hiddenSections = new Set(uiSettings.overviewHiddenSections)
    const baseVisibleSections = (uiSettings.overviewSectionOrder.length
      ? uiSettings.overviewSectionOrder
      : OVERVIEW_SECTION_ORDER_DEFAULT
    ).filter((sectionId) => !hiddenSections.has(sectionId))

    return applyOverviewWorkflowLinkMode(
      baseVisibleSections,
      uiSettings.overviewWorkflowLinkMode,
      Boolean(defaultWorkflow),
    )
  }, [
    defaultWorkflow,
    uiSettings.overviewHiddenSections,
    uiSettings.overviewSectionOrder,
    uiSettings.overviewWorkflowLinkMode,
  ])
  const activeOverviewLayout = useMemo(
    () =>
      resolveOverviewLayout(
        uiSettings.overviewSectionOrder,
        uiSettings.overviewHiddenSections,
        uiSettings.overviewLayoutTemplates,
      ),
    [
      uiSettings.overviewHiddenSections,
      uiSettings.overviewLayoutTemplates,
      uiSettings.overviewSectionOrder,
    ],
  )

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

  const renderSection = (sectionId: OverviewSectionId) => {
    if (sectionId === 'recent') {
      return (
        <section key={sectionId}>
          <SectionHeading actionLabel="全部查看" title="最近使用" to="/recent" />
          {loading ? (
            <EmptyState title="正在加载最近记录" description="DeskHub 正在读取你的本地工作台数据。" />
          ) : recentItems.length ? (
            <div className="grid gap-2">
              {recentItems.map((item) => (
                <ResourceRowCard
                  key={item.id}
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
              ))}
            </div>
          ) : (
            <EmptyState title="还没有最近记录" description="启动任意一个条目后，它会自动出现在这里。" />
          )}
        </section>
      )
    }

    if (sectionId === 'favorites') {
      return (
        <section key={sectionId}>
          <SectionHeading actionLabel="进入管理" title="收藏" to="/apps" />
          {loading ? (
            <EmptyState title="正在加载收藏" description="DeskHub 正在准备你的常用入口。" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {favorites.map((item) => (
                <CompactTileCard
                  key={item.id}
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
              ))}
              <button
                className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-white text-[color:var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                type="button"
                onClick={() => {
                  setEditingItem(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">添加条目</span>
              </button>
            </div>
          )}
        </section>
      )
    }

    if (sectionId === 'workflows') {
      return (
        <section key={sectionId}>
          <SectionHeading actionLabel="工作流页" title="工作流" to="/workflows" />
          {loading ? (
            <EmptyState title="正在加载工作流" description="请稍候，DeskHub 正在读取你的自动化链路。" />
          ) : workflows.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {workflows.map((item) => (
                <WorkflowCard
                  key={item.id}
                  item={item}
                  onDelete={(nextItem) => setDeletingItem(nextItem)}
                  onDuplicate={(nextItem: WorkflowItem) => void handleDuplicate(nextItem)}
                  onEdit={(nextItem) => {
                    setEditingItem(nextItem)
                    setFormOpen(true)
                  }}
                  onLaunch={(nextItem: WorkflowItem) => void launchItemWithPrompt(nextItem)}
                  onToggleFavorite={(nextItem: WorkflowItem) => void toggleFavorite(nextItem.id, !nextItem.favorite)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              actionLabel="新建工作流"
              description="把打开目录、启动命令和网站整理成一个一键上班模式。"
              title="还没有工作流"
              onAction={() => {
                setEditingItem(null)
                setFormOpen(true)
              }}
            />
          )}
        </section>
      )
    }

    return (
      <section key={sectionId}>
        <SectionHeading actionLabel="打开资源页" title="资源库概览" to="/apps" />
        {loading ? (
          <EmptyState title="正在整理资源库概览" description="DeskHub 正在统计各类入口的分布情况。" />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {libraryRoutes.map((entry) => (
              <Link
                key={entry.route}
                className="surface-muted flex items-center justify-between gap-3 px-4 py-3 transition hover:border-[color:var(--accent)] hover:bg-white"
                to={entry.route}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[color:var(--text-soft)]">
                    {entry.icon ? <entry.icon className="h-4 w-4" /> : null}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[color:var(--text)]">{entry.label}</div>
                    <div className="text-xs text-[color:var(--text-soft)]">查看该类型全部条目</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text)]">{entry.count}</div>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">items</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="grid gap-6">
      <section className="surface flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="page-kicker">DeskHub Overview</div>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-[color:var(--text)]">
            你的本地工作台
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)]">
            把应用、项目、网站、文件夹和工作流收进一个高密度控制台里，减少切换成本。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1 text-xs text-[color:var(--text-muted)]">
              当前布局：{activeOverviewLayout.title}
            </span>
            <span className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1 text-xs text-[color:var(--text-muted)]">
              联动策略：{OVERVIEW_WORKFLOW_LINK_MODE_LABELS[uiSettings.overviewWorkflowLinkMode]}
            </span>
            {defaultWorkflow ? (
              <span className="rounded-full border border-[#d9e7c0] bg-[#f3f9e9] px-3 py-1 text-xs text-[color:var(--ready)]">
                默认工作流：{defaultWorkflow.name}
              </span>
            ) : (
              <span className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1 text-xs text-[color:var(--text-soft)]">
                尚未设置默认工作流
              </span>
            )}
          </div>
          <button
            className="btn-secondary mt-4 gap-2 px-3 py-2 text-xs"
            type="button"
            onClick={() => setLayoutModalOpen(true)}
          >
            <LayoutPanelTop className="h-3.5 w-3.5" />
            自定义总览
          </button>
          {defaultWorkflow ? (
            <button
              className="btn-primary mt-2 gap-2 px-3 py-2 text-xs"
              type="button"
              onClick={() => void launchItemWithPrompt(defaultWorkflow)}
            >
              执行默认工作流
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[320px]">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--text-soft)]">收藏</div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text)]">{favorites.length}</div>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--text-soft)]">最近</div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text)]">{recentItems.length}</div>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--text-soft)]">工作流</div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text)]">{workflows.length}</div>
          </div>
        </div>
      </section>

      {visibleSectionIds.length ? (
        visibleSectionIds.map((sectionId) => renderSection(sectionId))
      ) : (
        <EmptyState
          actionLabel="恢复默认布局"
          description="你已经把所有总览区块都隐藏了，可以恢复默认顺序后继续使用。"
          title="当前总览没有可显示的区块"
          onAction={() =>
            void updateOverviewLayout({
              sectionOrder: OVERVIEW_SECTION_ORDER_DEFAULT,
              hiddenSections: [],
            })
          }
        />
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

      {workflowLaunchDialog}
      {workflowExecutionSummaryDialog}

      <OverviewLayoutModal
        hiddenSections={uiSettings.overviewHiddenSections}
        hasDefaultWorkflow={Boolean(defaultWorkflow)}
        layoutTemplates={uiSettings.overviewLayoutTemplates}
        open={layoutModalOpen}
        sectionOrder={uiSettings.overviewSectionOrder}
        workflowLinkMode={uiSettings.overviewWorkflowLinkMode}
        onClose={() => setLayoutModalOpen(false)}
        onSubmit={updateOverviewLayout}
      />
    </div>
  )
}
