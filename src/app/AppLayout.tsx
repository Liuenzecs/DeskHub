import { Suspense, lazy, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { DeferredModalFallback } from '../components/DeferredModalFallback'
import { Sidebar } from '../components/Sidebar'
import { Topbar } from '../components/Topbar'
import { useWorkflowLaunch } from '../hooks/useWorkflowLaunch'
import { toCommandHistoryPayload } from '../lib/command-history'
import { scheduleIdleWork } from '../lib/idle'
import { getReleaseCaptureConfig } from '../lib/release-demo'
import { useItems } from '../hooks/useItems'
import type {
  CommandPaletteEntry,
  ItemFormValues,
  ItemPayload,
  ItemType,
} from '../types/items'

const CommandPalette = lazy(() =>
  import('../components/CommandPalette').then((module) => ({ default: module.CommandPalette })),
)
const DataToolsModal = lazy(() =>
  import('../components/DataToolsModal').then((module) => ({ default: module.DataToolsModal })),
)
const ItemFormModal = lazy(() =>
  import('../components/ItemFormModal').then((module) => ({ default: module.ItemFormModal })),
)

interface CreateModalState {
  allowedTypes: ItemType[]
  initialValues?: Partial<ItemFormValues>
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    items,
    commandHistory,
    defaultWorkflow,
    uiSettings,
    createItem,
    clearCommandHistory,
    clearRecentItems,
    setDefaultWorkflow,
    recordCommandHistory,
  } = useItems()
  const {
    launchItemWithPrompt,
    openWorkflowLaunch,
    workflowExecutionSummaryDialog,
    workflowLaunchDialog,
  } = useWorkflowLaunch()
  const releaseCapture = useMemo(
    () => getReleaseCaptureConfig(location.search),
    [location.search],
  )
  const warmHistory = useMemo(() => commandHistory.slice(0, 8), [commandHistory])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [dataToolsOpen, setDataToolsOpen] = useState(false)
  const [createModalState, setCreateModalState] = useState<CreateModalState | null>(null)

  const openPalette = useEffectEvent(() => {
    setPaletteOpen(true)
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openPalette()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (releaseCapture.overlay === 'palette') {
      setPaletteOpen(true)
    }

    if (releaseCapture.overlay === 'data-tools') {
      setDataToolsOpen(true)
    }
  }, [releaseCapture.overlay])

  useEffect(() => {
    return scheduleIdleWork(() => {
      void import('../components/CommandPalette')
      void import('../lib/command-palette').then((module) => {
        // 预热只依赖空查询会实际使用到的最近命令切片，避免命令历史小变动就整批重算。
        module.warmCommandPalette(items, warmHistory, uiSettings.defaultWorkflowId)
      })
    })
  }, [items, uiSettings.defaultWorkflowId, warmHistory])

  const handleRunDefaultWorkflow = async () => {
    if (!defaultWorkflow) {
      navigate('/workflows?focus=default-workflow')
      toast.message('先在工作流页设置一个默认工作流。')
      return
    }

    openWorkflowLaunch(defaultWorkflow)
  }

  const handlePaletteHistory = async (entry: CommandPaletteEntry) => {
    await recordCommandHistory(toCommandHistoryPayload(entry))
  }

  const openCreateModal = (type: ItemType, initialValues?: Partial<ItemFormValues>) => {
    setCreateModalState({
      allowedTypes: [type],
      initialValues,
    })
  }

  const handleCreateItem = async (payload: ItemPayload) => {
    await createItem(payload)
    setCreateModalState(null)
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)] lg:flex">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          defaultWorkflow={defaultWorkflow}
          onOpenDataTools={() => setDataToolsOpen(true)}
          onOpenSearch={() => setPaletteOpen(true)}
          onRunDefaultWorkflow={() => void handleRunDefaultWorkflow()}
        />
        <main className="flex-1 px-3 py-3 lg:px-4 lg:py-4">
          <div className="mx-auto w-full max-w-[1540px]">
            <Outlet />
          </div>
        </main>
      </div>

      {paletteOpen ? (
        <Suspense fallback={<DeferredModalFallback title="正在加载全局搜索..." />}>
          <CommandPalette
            key={`palette:${releaseCapture.overlay === 'palette' ? releaseCapture.paletteQuery : 'default'}`}
            commandHistory={commandHistory}
            defaultWorkflowId={uiSettings.defaultWorkflowId}
            initialQuery={releaseCapture.overlay === 'palette' ? releaseCapture.paletteQuery : ''}
            items={items}
            onClose={() => setPaletteOpen(false)}
            onLaunch={async (item) => {
              await launchItemWithPrompt(item)
            }}
            onNavigate={(route) => navigate(route)}
            onClearCommandHistory={async () => {
              await clearCommandHistory()
            }}
            onClearRecentItems={async () => {
              await clearRecentItems()
            }}
            onCreateItem={({ type, initialValues }) => openCreateModal(type, initialValues)}
            onOpenDataTools={() => setDataToolsOpen(true)}
            onRecordHistory={handlePaletteHistory}
            onSetDefaultWorkflow={async (id) => {
              await setDefaultWorkflow(id)
            }}
          />
        </Suspense>
      ) : null}

      {dataToolsOpen ? (
        <Suspense fallback={<DeferredModalFallback title="正在加载数据工具..." />}>
          <DataToolsModal open={dataToolsOpen} onClose={() => setDataToolsOpen(false)} />
        </Suspense>
      ) : null}

      {createModalState ? (
        <Suspense fallback={<DeferredModalFallback title="正在加载新建表单..." />}>
          <ItemFormModal
            allowedTypes={createModalState.allowedTypes}
            initialValues={createModalState.initialValues}
            open={Boolean(createModalState)}
            onClose={() => setCreateModalState(null)}
            onSaveAsNew={async (payload) => {
              await createItem(payload)
              setCreateModalState(null)
            }}
            onSubmit={handleCreateItem}
          />
        </Suspense>
      ) : null}

      {workflowLaunchDialog}
      {workflowExecutionSummaryDialog}
    </div>
  )
}
