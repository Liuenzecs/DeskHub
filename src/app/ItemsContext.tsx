import {
  startTransition,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react'
import { toast } from 'sonner'
import { ItemsContext } from './items-context'
import {
  backupDatabase as backupDatabaseRequest,
  batchEditItems as batchEditItemsRequest,
  clearCommandHistory as clearCommandHistoryRequest,
  clearDataToolHistory as clearDataToolHistoryRequest,
  clearRecentItems as clearRecentItemsRequest,
  createItem as createItemRequest,
  deleteItem as deleteItemRequest,
  deleteItems as deleteItemsRequest,
  exportItems as exportItemsRequest,
  exportStructuredReport as exportStructuredReportRequest,
  exportTextReport as exportTextReportRequest,
  getDataToolHistory,
  getCommandHistory,
  getItems,
  getUiSettings,
  importBrowserBookmarks as importBrowserBookmarksRequest,
  importProjectDirectories as importProjectDirectoriesRequest,
  importItems as importItemsRequest,
  previewImportItems as previewImportItemsRequest,
  openBackupsDirectory as openBackupsDirectoryRequest,
  optimizeDatabase as optimizeDatabaseRequest,
  recordDataToolHistory as recordDataToolHistoryRequest,
  runDataConsistencyCheck as runDataConsistencyCheckRequest,
  runDatabaseHealthCheck as runDatabaseHealthCheckRequest,
  launchItem as launchItemRequest,
  launchWorkflow as launchWorkflowRequest,
  recordCommandHistory as recordCommandHistoryRequest,
  restoreDatabase as restoreDatabaseRequest,
  scanBrowserBookmarks as scanBrowserBookmarksRequest,
  scanProjectDirectories as scanProjectDirectoriesRequest,
  setDefaultWorkflow as setDefaultWorkflowRequest,
  setItemsFavorite as setItemsFavoriteRequest,
  toggleFavorite as toggleFavoriteRequest,
  updateOverviewLayout as updateOverviewLayoutRequest,
  updateUiSettings as updateUiSettingsRequest,
  updateItem as updateItemRequest,
} from '../lib/tauri'
import { scheduleIdleWork } from '../lib/idle'
import { sortItemsByUpdated, warmDeskItemSearchIndexes } from '../lib/item-utils'
import { RELEASE_DEMO_SNAPSHOT } from '../lib/release-demo-data'
import { isReleaseDemoEnabled } from '../lib/release-demo'
import { scheduleSearchTransliterationWarmup } from '../lib/search-index'
import type {
  BatchEditItemsPayload,
  CommandHistoryEntry,
  CommandHistoryPayload,
  DataToolHistoryEntry,
  DataToolHistoryPayload,
  DeskItem,
  ItemPayload,
  OverviewLayoutPayload,
  ProjectDirectoryImportOptions,
  ProjectDirectoryScanOptions,
  UiSettings,
  UiSettingsUpdatePayload,
  WorkflowItem,
  WorkflowVariableInput,
} from '../types/items'
import type { RehydrateOptions } from './items-context'

function toErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  return '发生了一些问题。'
}

function sortCommandHistory(entries: CommandHistoryEntry[]) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left.lastUsedAt).getTime()
    const rightTime = new Date(right.lastUsedAt).getTime()

    if (rightTime !== leftTime) {
      return rightTime - leftTime
    }

    if (right.useCount !== left.useCount) {
      return right.useCount - left.useCount
    }

    return left.title.localeCompare(right.title, 'zh-CN')
  })
}

function sortDataToolHistory(entries: DataToolHistoryEntry[]) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left.occurredAt).getTime()
    const rightTime = new Date(right.occurredAt).getTime()

    if (rightTime !== leftTime) {
      return rightTime - leftTime
    }

    return left.title.localeCompare(right.title, 'zh-CN')
  })
}

export function ItemsProvider({ children }: PropsWithChildren) {
  const releaseDemoSnapshot = isReleaseDemoEnabled() ? RELEASE_DEMO_SNAPSHOT : null
  const [items, setItems] = useState<DeskItem[]>(() =>
    releaseDemoSnapshot ? sortItemsByUpdated(releaseDemoSnapshot.items) : [],
  )
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>(() =>
    releaseDemoSnapshot ? sortCommandHistory(releaseDemoSnapshot.commandHistory) : [],
  )
  const [dataToolHistory, setDataToolHistory] = useState<DataToolHistoryEntry[]>(() =>
    releaseDemoSnapshot ? sortDataToolHistory(releaseDemoSnapshot.dataToolHistory) : [],
  )
  const [uiSettings, setUiSettings] = useState<UiSettings>(() =>
    releaseDemoSnapshot
      ? releaseDemoSnapshot.uiSettings
      : {
          defaultWorkflowId: null,
          autoBackupEnabled: true,
          autoBackupIntervalHours: 24,
          backupRetentionCount: 7,
          diagnosticMode: false,
          lastAutoBackupAt: null,
          overviewSectionOrder: ['recent', 'favorites', 'workflows', 'library'],
          overviewHiddenSections: [],
          overviewLayoutTemplates: [],
          overviewWorkflowLinkMode: 'none',
        },
  )
  const [loading, setLoading] = useState(() => !releaseDemoSnapshot)

  const replaceItems = (nextItems: DeskItem[]) => {
    startTransition(() => {
      setItems(sortItemsByUpdated(nextItems))
    })
  }

  const replaceCommandHistory = (entries: CommandHistoryEntry[]) => {
    startTransition(() => {
      setCommandHistory(sortCommandHistory(entries))
    })
  }

  const replaceDataToolHistory = (entries: DataToolHistoryEntry[]) => {
    startTransition(() => {
      setDataToolHistory(sortDataToolHistory(entries))
    })
  }

  const upsertItem = (nextItem: DeskItem) => {
    startTransition(() => {
      setItems((currentItems) => {
        const exists = currentItems.some((item) => item.id === nextItem.id)
        const nextItems = exists
          ? currentItems.map((item) => (item.id === nextItem.id ? nextItem : item))
          : [nextItem, ...currentItems]

        return sortItemsByUpdated(nextItems)
      })
    })
  }

  const removeItems = (ids: string[]) => {
    startTransition(() => {
      setItems((currentItems) => currentItems.filter((item) => !ids.includes(item.id)))
    })
  }

  const upsertCommandHistoryEntry = (entry: CommandHistoryEntry) => {
    startTransition(() => {
      setCommandHistory((currentEntries) => {
        const nextEntries = currentEntries.some(
          (currentEntry) => currentEntry.kind === entry.kind && currentEntry.target === entry.target,
        )
          ? currentEntries.map((currentEntry) =>
              currentEntry.kind === entry.kind && currentEntry.target === entry.target
                ? entry
                : currentEntry,
            )
          : [entry, ...currentEntries]

        return sortCommandHistory(nextEntries)
      })
    })
  }

  const upsertDataToolHistoryEntry = (entry: DataToolHistoryEntry) => {
    startTransition(() => {
      setDataToolHistory((currentEntries) => sortDataToolHistory([entry, ...currentEntries]))
    })
  }

  const refreshItems = async () => {
    try {
      const itemsResponse = await getItems()
      replaceItems(itemsResponse.items)
      return itemsResponse.items
    } catch (error) {
      toast.error(toErrorMessage(error))
      throw error
    }
  }

  const refreshUiSettings = async () => {
    try {
      const settingsResponse = await getUiSettings()
      setUiSettings(settingsResponse)
      return settingsResponse
    } catch (error) {
      toast.error(toErrorMessage(error))
      throw error
    }
  }

  const refreshCommandHistory = async () => {
    try {
      const historyResponse = await getCommandHistory()
      replaceCommandHistory(historyResponse.entries)
      return historyResponse.entries
    } catch (error) {
      toast.error(toErrorMessage(error))
      throw error
    }
  }

  const refreshDataToolHistory = async () => {
    try {
      const historyResponse = await getDataToolHistory()
      replaceDataToolHistory(historyResponse.records)
      return historyResponse.records
    } catch (error) {
      toast.error(toErrorMessage(error))
      throw error
    }
  }

  const rehydrate = async (options: RehydrateOptions = {}) => {
    const {
      items: shouldRefreshItems = true,
      uiSettings: shouldRefreshUiSettings = true,
      commandHistory: shouldRefreshCommandHistory = true,
      dataToolHistory: shouldRefreshDataToolHistory = false,
    } = options

    const tasks: Promise<unknown>[] = []

    if (shouldRefreshItems) {
      tasks.push(refreshItems())
    }

    if (shouldRefreshUiSettings) {
      tasks.push(refreshUiSettings())
    }

    if (shouldRefreshCommandHistory) {
      tasks.push(refreshCommandHistory())
    }

    if (shouldRefreshDataToolHistory) {
      tasks.push(refreshDataToolHistory())
    }

    await Promise.all(tasks)
  }

  useEffect(() => {
    if (releaseDemoSnapshot) {
      setLoading(false)
      return
    }

    void (async () => {
      try {
        const [itemsResponse, settingsResponse, historyResponse] = await Promise.all([
          getItems(),
          getUiSettings(),
          getCommandHistory(),
        ])
        replaceItems(itemsResponse.items)
        replaceCommandHistory(historyResponse.entries)
        setUiSettings(settingsResponse)
      } finally {
        setLoading(false)
      }
    })()
  }, [releaseDemoSnapshot])

  useEffect(() => {
    if (!items.length) {
      return
    }

    return scheduleIdleWork(() => {
      warmDeskItemSearchIndexes(items)
      scheduleSearchTransliterationWarmup()
    })
  }, [items])

  const createItem = async (payload: ItemPayload) => {
    try {
      const createdItem = await createItemRequest(payload)
      upsertItem(createdItem)
      toast.success(`已添加 ${createdItem.name}。`)
      return createdItem
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const updateItem = async (id: string, payload: ItemPayload) => {
    try {
      const updatedItem = await updateItemRequest(id, payload)
      upsertItem(updatedItem)
      if (uiSettings.defaultWorkflowId === id && updatedItem.type !== 'workflow') {
        setUiSettings((current) => ({ ...current, defaultWorkflowId: null }))
      }
      toast.success(`已更新 ${updatedItem.name}。`)
      return updatedItem
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const deleteItem = async (id: string) => {
    try {
      const deleted = await deleteItemRequest(id)
      removeItems([deleted.id])
      if (uiSettings.defaultWorkflowId === id) {
        setUiSettings((current) => ({ ...current, defaultWorkflowId: null }))
      }
      toast.success('已删除条目。')
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const deleteItems = async (ids: string[]) => {
    try {
      const response = await deleteItemsRequest(ids)
      removeItems(response.ids)
      if (response.ids.includes(uiSettings.defaultWorkflowId ?? '')) {
        setUiSettings((current) => ({ ...current, defaultWorkflowId: null }))
      }
      toast.success(`已删除 ${response.ids.length} 个条目。`)
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const toggleFavorite = async (id: string, favorite: boolean) => {
    try {
      const updatedItem = await toggleFavoriteRequest(id, favorite)
      upsertItem(updatedItem)
      toast.success(favorite ? `已收藏 ${updatedItem.name}。` : `已取消收藏 ${updatedItem.name}。`)
      return updatedItem
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const setItemsFavorite = async (ids: string[], favorite: boolean) => {
    try {
      const response = await setItemsFavoriteRequest(ids, favorite)
      startTransition(() => {
        setItems((currentItems) => {
          const updatedMap = new Map(response.items.map((item) => [item.id, item]))
          return sortItemsByUpdated(
            currentItems.map((item) => updatedMap.get(item.id) ?? item),
          )
        })
      })
      toast.success(
        favorite ? `已收藏 ${response.items.length} 个条目。` : `已取消收藏 ${response.items.length} 个条目。`,
      )
      return response.items
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const batchEditItems = async (payload: BatchEditItemsPayload) => {
    try {
      const response = await batchEditItemsRequest(payload)
      startTransition(() => {
        setItems((currentItems) => {
          const updatedMap = new Map(response.items.map((item) => [item.id, item]))
          return sortItemsByUpdated(currentItems.map((item) => updatedMap.get(item.id) ?? item))
        })
      })
      toast.success(`已更新 ${response.items.length} 个条目。`)
      return response.items
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const launchItem = async (id: string) => {
    try {
      const result = await launchItemRequest(id)
      upsertItem(result.item)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      return result
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const launchWorkflow = async (
    id: string,
    startStepIndex?: number,
    variableInputs?: WorkflowVariableInput[],
  ) => {
    try {
      const result = await launchWorkflowRequest(id, startStepIndex, variableInputs)
      upsertItem(result.item)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      return result
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const clearRecentItems = async () => {
    try {
      const response = await clearRecentItemsRequest()
      startTransition(() => {
        setItems((currentItems) =>
          currentItems.map((item) => ({
            ...item,
            lastLaunchedAt: null,
          })),
        )
      })
      toast.success('最近使用记录已清空。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const setDefaultWorkflow = async (id: string | null) => {
    try {
      const settings = await setDefaultWorkflowRequest(id)
      setUiSettings(settings)
      toast.success(id ? '已设置默认工作流。' : '已清除默认工作流。')
      return settings
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const updateUiSettings = async (payload: UiSettingsUpdatePayload) => {
    try {
      const settings = await updateUiSettingsRequest(payload)
      setUiSettings(settings)
      toast.success('设置已更新。')
      return settings
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const updateOverviewLayout = async (payload: OverviewLayoutPayload) => {
    try {
      const settings = await updateOverviewLayoutRequest(payload)
      setUiSettings(settings)
      toast.success('总览设置已更新。')
      return settings
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const recordCommandHistory = async (payload: CommandHistoryPayload) => {
    try {
      const entry = await recordCommandHistoryRequest(payload)
      upsertCommandHistoryEntry(entry)
      return entry
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const recordDataToolHistory = async (payload: DataToolHistoryPayload) => {
    try {
      const entry = await recordDataToolHistoryRequest(payload)
      upsertDataToolHistoryEntry(entry)
      return entry
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const clearDataToolHistory = async () => {
    try {
      const response = await clearDataToolHistoryRequest()
      replaceDataToolHistory([])
      toast.success('数据工具历史已清空。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const clearCommandHistory = async () => {
    try {
      const response = await clearCommandHistoryRequest()
      replaceCommandHistory([])
      toast.success('命令历史已清空。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const exportItems = async (path: string, ids: string[]) => {
    try {
      const response = await exportItemsRequest(path, ids)
      toast.success(`已导出 ${response.exportedCount} 个条目。`)
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const previewImportItems = async (path: string) => {
    try {
      const response = await previewImportItemsRequest(path)
      toast.success('导入预检完成。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const importItems = async (path: string) => {
    try {
      const response = await importItemsRequest(path)
      if (response.items.length) {
        startTransition(() => {
          setItems((currentItems) => sortItemsByUpdated([...response.items, ...currentItems]))
        })
      }

      if (response.items.length) {
        toast.success(`已导入 ${response.items.length} 个条目。`)
      }

      if (response.errors.length) {
        toast.warning(`有 ${response.errors.length} 个条目导入失败。`)
      }

      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const scanBrowserBookmarks = async () => {
    try {
      return await scanBrowserBookmarksRequest()
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const importBrowserBookmarks = async (entries: Parameters<typeof importBrowserBookmarksRequest>[0]) => {
    try {
      const response = await importBrowserBookmarksRequest(entries)
      if (response.items.length) {
        startTransition(() => {
          setItems((currentItems) => sortItemsByUpdated([...response.items, ...currentItems]))
        })
      }

      if (response.items.length) {
        toast.success(`已导入 ${response.items.length} 个网站条目。`)
      }

      if (response.skippedUrls.length) {
        toast.message(`跳过 ${response.skippedUrls.length} 个已存在的网址。`)
      }

      if (response.errors.length) {
        toast.warning(`有 ${response.errors.length} 个收藏夹条目导入失败。`)
      }

      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const scanProjectDirectories = async (
    path: string,
    options?: ProjectDirectoryScanOptions,
  ) => {
    try {
      return await scanProjectDirectoriesRequest(path, options)
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const importProjectDirectories = async (
    paths: string[],
    options?: ProjectDirectoryImportOptions,
  ) => {
    try {
      const response = await importProjectDirectoriesRequest(paths, options)
      if (response.items.length) {
        startTransition(() => {
          setItems((currentItems) => sortItemsByUpdated([...response.items, ...currentItems]))
        })
      }

      const refreshedCount = response.updatedPaths.length
      const createdCount = response.items.length - refreshedCount

      if (createdCount > 0 && refreshedCount > 0) {
        toast.success(`已导入 ${createdCount} 个项目，并刷新 ${refreshedCount} 个已有项目。`)
      } else if (createdCount > 0) {
        toast.success(`已导入 ${createdCount} 个项目。`)
      } else if (refreshedCount > 0) {
        toast.success(`已刷新 ${refreshedCount} 个已有项目。`)
      }

      if (response.skippedPaths.length) {
        toast.message(`跳过 ${response.skippedPaths.length} 个已存在的项目。`)
      }

      if (response.errors.length) {
        toast.warning(`有 ${response.errors.length} 个目录导入失败。`)
      }

      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const backupDatabase = async (path: string) => {
    try {
      const response = await backupDatabaseRequest(path)
      toast.success('数据库备份完成。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const restoreDatabase = async (path: string) => {
    try {
      const response = await restoreDatabaseRequest(path)
      await rehydrate({ dataToolHistory: true })
      toast.success('数据库恢复完成。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const runDatabaseHealthCheck = async () => {
    try {
      const response = await runDatabaseHealthCheckRequest()
      toast.success('数据库健康检查完成。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const runDataConsistencyCheck = async () => {
    try {
      const response = await runDataConsistencyCheckRequest()
      toast.success('数据一致性检查完成。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const optimizeDatabase = async () => {
    try {
      const response = await optimizeDatabaseRequest()
      toast.success('数据库优化完成。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const openBackupsDirectory = async () => {
    try {
      const response = await openBackupsDirectoryRequest()
      toast.success('已打开备份目录。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const exportTextReport = async (path: string, title: string, lines: string[]) => {
    try {
      const response = await exportTextReportRequest(path, title, lines)
      toast.success('报告已导出。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const exportStructuredReport = async (path: string, title: string, payload: unknown) => {
    try {
      const response = await exportStructuredReportRequest(path, title, payload)
      toast.success('结构化报告已导出。')
      return response
    } catch (error) {
      const message = toErrorMessage(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const defaultWorkflow =
    (items.find(
      (item): item is WorkflowItem =>
        item.id === uiSettings.defaultWorkflowId && item.type === 'workflow',
    ) ?? null)

  return (
    <ItemsContext.Provider
      value={{
        items,
        commandHistory,
        dataToolHistory,
        uiSettings,
        defaultWorkflow,
        loading,
        rehydrate,
        refreshItems,
        refreshCommandHistory,
        refreshDataToolHistory,
        refreshUiSettings,
        createItem,
        updateItem,
        deleteItem,
        deleteItems,
        toggleFavorite,
        setItemsFavorite,
        batchEditItems,
        launchItem,
        launchWorkflow,
        clearRecentItems,
        setDefaultWorkflow,
        updateUiSettings,
        updateOverviewLayout,
        recordCommandHistory,
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
        exportStructuredReport,
      }}
    >
      {children}
    </ItemsContext.Provider>
  )
}
