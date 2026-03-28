import { Clock3, Command, Database, Plus, Search, Workflow, X } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { useSearchRuntime } from '../hooks/useSearchRuntime'
import { useModalDialog } from '../hooks/useModalDialog'
import {
  createPreparedCommandPaletteEntries,
  getCommandPaletteHighlightQuery,
  getCommandPaletteQuickView,
  getPreparedCommandPaletteEntryMatchKind,
  searchCommandPaletteEntries,
} from '../lib/command-palette'
import { renderItemIcon } from '../lib/item-icons'
import { findNavItem } from '../lib/navigation'
import { TypeBadge } from './TypeBadge'
import type {
  CommandHistoryEntry,
  CommandPaletteEntry,
  DeskItem,
  ItemFormValues,
  ItemType,
} from '../types/items'

interface CommandPaletteProps {
  items: DeskItem[]
  commandHistory: CommandHistoryEntry[]
  defaultWorkflowId: string | null
  initialQuery?: string
  onClose: () => void
  onLaunch: (item: DeskItem) => Promise<void> | void
  onNavigate: (route: string) => void
  onCreateItem: (options: { type: ItemType; initialValues?: Partial<ItemFormValues> }) => void
  onOpenDataTools: () => void
  onClearRecentItems: () => Promise<void> | void
  onClearCommandHistory: () => Promise<void> | void
  onSetDefaultWorkflow: (id: string | null) => Promise<void> | void
  onRecordHistory: (entry: CommandPaletteEntry) => Promise<void> | void
}

interface EntryGroup {
  title: string
  entries: CommandPaletteEntry[]
}

function EntryKindBadge({ entry }: { entry: CommandPaletteEntry }) {
  if (entry.kind === 'item') {
    return <TypeBadge type={entry.item.type} />
  }

  if (entry.kind === 'route') {
    return (
      <span className="rounded-md border border-[#d8e4f4] bg-[#eef5fd] px-2 py-0.5 text-[10px] font-medium text-[#386ca8]">
        导航
      </span>
    )
  }

  return (
    <span className="rounded-md border border-[#dae8cf] bg-[#edf6e2] px-2 py-0.5 text-[10px] font-medium text-[color:var(--ready)]">
      动作
    </span>
  )
}

function EntryIcon({ entry }: { entry: CommandPaletteEntry }) {
  if (entry.kind === 'item') {
    return renderItemIcon(entry.item.type, 'h-4 w-4', entry.item.icon)
  }

  if (entry.kind === 'route') {
    const navItem = findNavItem(entry.route)
    const Icon = navItem?.icon ?? Command
    return <Icon className="h-4 w-4" />
  }

  if (entry.action === 'open_data_tools') {
    return <Database className="h-4 w-4" />
  }

  if (entry.action === 'clear_recent_items' || entry.action === 'clear_command_history') {
    return <Clock3 className="h-4 w-4" />
  }

  if (entry.action === 'create_item' || entry.action === 'create_from_starter_template') {
    return <Plus className="h-4 w-4" />
  }

  return <Workflow className="h-4 w-4" />
}

function getEntryIconTone(entry: CommandPaletteEntry) {
  if (entry.kind === 'item') {
    return 'bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]'
  }

  if (entry.kind === 'route') {
    return 'bg-[#eef5fd] text-[#386ca8]'
  }

  return 'bg-[#edf6e2] text-[color:var(--ready)]'
}

function getEntryRowTone(entry: CommandPaletteEntry, selected: boolean) {
  if (selected) {
    if (entry.kind === 'route') {
      return 'border-[#d8e4f4] bg-[#f3f8fe]'
    }

    if (entry.kind === 'action') {
      return 'border-[#dae8cf] bg-[#f3f9e9]'
    }

    return 'border-[color:var(--accent)] bg-[#f7fbff]'
  }

  return 'border-transparent bg-transparent hover:border-[color:var(--border)] hover:bg-[color:var(--bg)]'
}

function findHighlightToken(text: string, query: string) {
  const normalizedText = text.toLocaleLowerCase()
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)

  return tokens.find((token) => normalizedText.includes(token.toLocaleLowerCase())) ?? null
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const token = findHighlightToken(text, query)
  if (!token) {
    return <>{text}</>
  }

  const normalizedText = text.toLocaleLowerCase()
  const normalizedToken = token.toLocaleLowerCase()
  const startIndex = normalizedText.indexOf(normalizedToken)

  if (startIndex < 0) {
    return <>{text}</>
  }

  const endIndex = startIndex + token.length

  return (
    <>
      {text.slice(0, startIndex)}
      <mark className="rounded bg-[#e7f0fb] px-0.5 text-[color:var(--accent)]">
        {text.slice(startIndex, endIndex)}
      </mark>
      {text.slice(endIndex)}
    </>
  )
}

function MatchHintBadge({
  query,
  matchKind,
}: {
  query: string
  matchKind: 'raw' | 'pinyin' | 'initials' | null
}) {
  if (!query.trim() || !matchKind || matchKind === 'raw') {
    return null
  }

  const label = matchKind === 'pinyin' ? '拼音' : '首字母'
  return (
    <span className="rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
      {label}
    </span>
  )
}

function MetaBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-[color:var(--border)] bg-white px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
      {label}
    </span>
  )
}

function toOptionDomId(entryId: string) {
  return `command-palette-option-${entryId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function buildSearchGroups(entries: CommandPaletteEntry[]): EntryGroup[] {
  const groups = new Map<CommandPaletteEntry['kind'], EntryGroup>()

  for (const entry of entries) {
    const existingGroup =
      groups.get(entry.kind) ??
      {
        title: entry.kind === 'item' ? '条目' : entry.kind === 'route' ? '导航' : '动作',
        entries: [],
      }

    existingGroup.entries.push(entry)
    groups.set(entry.kind, existingGroup)
  }

  return [...groups.values()]
}

function shouldRecordHistory(entry: CommandPaletteEntry) {
  return !(entry.kind === 'action' && entry.action === 'clear_command_history')
}

function EntrySection({
  title,
  entries,
  selectedIndex,
  query,
  active,
  commandHistoryKeys,
  favoriteEntryIds,
  onSelect,
  onHover,
  onHeaderClick,
  onGetMatchKind,
}: {
  title: string
  entries: CommandPaletteEntry[]
  selectedIndex: number
  query: string
  active: boolean
  commandHistoryKeys: Set<string>
  favoriteEntryIds: Set<string>
  onSelect: (entry: CommandPaletteEntry) => void
  onHover: (index: number) => void
  onHeaderClick: () => void
  onGetMatchKind: (entry: CommandPaletteEntry) => 'raw' | 'pinyin' | 'initials' | null
}) {
  if (!entries.length) {
    return null
  }

  return (
    <section className="grid gap-1">
      <button
        aria-pressed={active}
        className={`flex items-center justify-between rounded-lg px-3 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition ${
          active
            ? 'bg-[color:var(--bg)] text-[color:var(--text)]'
            : 'text-[color:var(--text-soft)] hover:bg-[color:var(--bg)]'
        }`}
        type="button"
        onClick={onHeaderClick}
      >
        <span>{title}</span>
        <span>{entries.length}</span>
      </button>

      {entries.map((entry, index) => {
        const isHistory = commandHistoryKeys.has(entry.id)
        const isFavorite = favoriteEntryIds.has(entry.id)
        const matchKind = onGetMatchKind(entry)

        return (
          <button
            key={entry.id}
            aria-selected={index === selectedIndex}
            className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${getEntryRowTone(
              entry,
              index === selectedIndex,
            )}`}
            id={toOptionDomId(entry.id)}
            role="option"
            type="button"
            onMouseEnter={() => onHover(index)}
            onClick={() => void onSelect(entry)}
          >
            <div className={`mt-0.5 rounded-lg p-2 ${getEntryIconTone(entry)}`}>
              <EntryIcon entry={entry} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-[color:var(--text)]">
                  <HighlightedText query={query} text={entry.title} />
                </span>
                <EntryKindBadge entry={entry} />
                {isHistory ? <MetaBadge label="历史" /> : null}
                {isFavorite ? <MetaBadge label="收藏" /> : null}
                <MatchHintBadge matchKind={matchKind} query={query} />
              </div>
              <div className="mt-1 truncate text-xs text-[color:var(--text-muted)]">
                <HighlightedText query={query} text={entry.subtitle} />
              </div>
            </div>
          </button>
        )
      })}
    </section>
  )
}

export function CommandPalette({
  items,
  commandHistory,
  defaultWorkflowId,
  initialQuery = '',
  onClose,
  onLaunch,
  onNavigate,
  onCreateItem,
  onOpenDataTools,
  onClearRecentItems,
  onClearCommandHistory,
  onSetDefaultWorkflow,
  onRecordHistory,
}: CommandPaletteProps) {
  const [query, setQuery] = useState(initialQuery)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listboxId = useId()
  const helperId = useId()
  const resultsId = useId()
  const { containerRef, titleId, descriptionId, handleKeyDownCapture } = useModalDialog({
    open: true,
    onClose,
    initialFocusRef: inputRef,
  })
  const searchRuntimeVersion = useSearchRuntime(query)

  const preparedEntries = useMemo(
    () => createPreparedCommandPaletteEntries(items, defaultWorkflowId),
    [defaultWorkflowId, items],
  )

  const preparedEntryMap = useMemo(
    () => new Map(preparedEntries.map((entry) => [entry.entry.id, entry])),
    [preparedEntries],
  )

  const searchResults = useMemo(
    () => {
      void searchRuntimeVersion
      return searchCommandPaletteEntries(preparedEntries, commandHistory, query).slice(0, 18)
    },
    [commandHistory, preparedEntries, query, searchRuntimeVersion],
  )

  const quickView = useMemo(
    () => getCommandPaletteQuickView(preparedEntries, commandHistory),
    [commandHistory, preparedEntries],
  )
  const highlightQuery = useMemo(() => getCommandPaletteHighlightQuery(query), [query])

  const groupedEntries = query.trim()
    ? buildSearchGroups(searchResults)
    : [
        { title: '历史', entries: quickView.recentCommands },
        { title: '收藏', entries: quickView.favoriteItems },
        { title: '导航', entries: quickView.quickRoutes },
        { title: '动作', entries: quickView.quickActions },
      ].filter((group) => group.entries.length)

  const flatEntries = groupedEntries.flatMap((group) => group.entries)
  const selectedIndex = Math.min(activeIndex, Math.max(flatEntries.length - 1, 0))

  const groupStartIndexes = groupedEntries.reduce<number[]>((accumulator, _group, groupIndex) => {
    const previous = accumulator[groupIndex - 1]
    const startIndex =
      previous === undefined ? 0 : previous + groupedEntries[groupIndex - 1].entries.length
    accumulator.push(startIndex)
    return accumulator
  }, [])

  const activeGroupIndex = groupStartIndexes.reduce((currentIndex, startIndex, groupIndex) => {
    const nextStart = groupStartIndexes[groupIndex + 1] ?? flatEntries.length
    if (selectedIndex >= startIndex && selectedIndex < nextStart) {
      return groupIndex
    }

    return currentIndex
  }, 0)

  const favoriteEntryIds = useMemo(
    () =>
      new Set(
        items
          .filter((item) => item.favorite)
          .map((item) => `item:${item.id}`),
      ),
    [items],
  )

  const commandHistoryKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const entry of commandHistory.slice(0, 8)) {
      if (entry.kind === 'item') {
        keys.add(`item:${entry.target}`)
      } else if (entry.kind === 'route') {
        keys.add(`route:${entry.target}`)
      } else {
        keys.add(`action:${entry.target}`)
      }
    }
    return keys
  }, [commandHistory])

  const handleSelect = async (entry: CommandPaletteEntry) => {
    if (entry.kind === 'item') {
      await onLaunch(entry.item)
    } else if (entry.kind === 'route') {
      onNavigate(entry.route)
    } else {
      switch (entry.action) {
        case 'create_item':
        case 'create_from_starter_template':
        case 'create_from_workflow_template': {
          const nextType = entry.itemType ?? entry.initialValues?.type
          if (nextType) {
            onCreateItem({
              type: nextType,
              initialValues: entry.initialValues,
            })
          }
          break
        }
        case 'open_data_tools':
          onOpenDataTools()
          break
        case 'clear_recent_items':
          await onClearRecentItems()
          break
        case 'clear_command_history':
          await onClearCommandHistory()
          break
        case 'clear_default_workflow':
          await onSetDefaultWorkflow(null)
          break
        case 'set_default_workflow':
          await onSetDefaultWorkflow(entry.workflowId ?? null)
          break
      }
    }

    if (shouldRecordHistory(entry)) {
      await onRecordHistory(entry)
    }
    onClose()
  }

  const getMatchKind = (entry: CommandPaletteEntry) => {
    const preparedEntry = preparedEntryMap.get(entry.id)
    if (!preparedEntry) {
      return null
    }

    return getPreparedCommandPaletteEntryMatchKind(preparedEntry, query)
  }

  const activeEntry = flatEntries[selectedIndex] ?? null

  return (
    <div className="modal-backdrop px-4 py-8" onClick={onClose}>
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
          <div className="min-w-0 flex-1">
            <div className="modal-kicker">
              Command Palette
            </div>
            <h2 className="modal-title mt-1" id={titleId}>
              全局搜索
            </h2>
            <p className="modal-description" id={descriptionId}>
              搜索条目、导航、模板和快捷动作，Enter 执行，Tab 切组。
            </p>
          </div>
          <button aria-label="关闭全局搜索" className="btn-icon" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[color:var(--border)] px-4 py-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
            <input
              ref={inputRef}
              aria-activedescendant={activeEntry ? toOptionDomId(activeEntry.id) : undefined}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-describedby={`${descriptionId} ${helperId} ${resultsId}`}
              aria-expanded={flatEntries.length > 0}
              aria-label="全局搜索"
              className="w-full border-0 bg-transparent py-2 pl-10 pr-4 text-sm text-[color:var(--text)] outline-none"
              placeholder="搜索条目、模板或动作，也可以输入 app: / workflow: / route: / action:"
              role="combobox"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={async (event) => {
                if (event.key === 'Escape') {
                  onClose()
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveIndex((current) => Math.min(current + 1, Math.max(flatEntries.length - 1, 0)))
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveIndex((current) => Math.max(current - 1, 0))
                }

                if (event.key === 'Tab' && groupedEntries.length > 1) {
                  event.preventDefault()
                  const nextGroupIndex = event.shiftKey
                    ? (activeGroupIndex <= 0 ? groupedEntries.length - 1 : activeGroupIndex - 1)
                    : (activeGroupIndex + 1) % groupedEntries.length
                  setActiveIndex(groupStartIndexes[nextGroupIndex] ?? 0)
                }

                if (
                  event.altKey &&
                  event.key.toLowerCase() === 'd' &&
                  flatEntries[selectedIndex]?.kind === 'item' &&
                  flatEntries[selectedIndex].item.type === 'workflow'
                ) {
                  event.preventDefault()
                  const workflow = flatEntries[selectedIndex].item
                  await onSetDefaultWorkflow(workflow.id === defaultWorkflowId ? null : workflow.id)
                }

                if (event.key === 'Enter' && flatEntries[selectedIndex]) {
                  event.preventDefault()
                  await handleSelect(flatEntries[selectedIndex])
                }
              }}
            />
          </label>
          <div className="sr-only" id={resultsId} aria-live="polite">
            {flatEntries.length ? `当前有 ${flatEntries.length} 条可用结果。` : '当前没有匹配结果。'}
          </div>
        </div>

        <div
          aria-label="搜索结果"
          className="max-h-[520px] overflow-y-auto p-2"
          id={listboxId}
          role="listbox"
        >
          {flatEntries.length ? (
            <div className="grid gap-3">
              {groupedEntries.map((group, groupIndex) => {
                const startIndex = groupStartIndexes[groupIndex] ?? 0

                return (
                  <EntrySection
                    key={group.title}
                    active={groupIndex === activeGroupIndex}
                    commandHistoryKeys={commandHistoryKeys}
                    entries={group.entries}
                    favoriteEntryIds={favoriteEntryIds}
                    query={highlightQuery}
                    selectedIndex={Math.max(-1, selectedIndex - startIndex)}
                    title={group.title}
                    onGetMatchKind={getMatchKind}
                    onHeaderClick={() => setActiveIndex(startIndex)}
                    onHover={(index) => setActiveIndex(startIndex + index)}
                    onSelect={(entry) => void handleSelect(entry)}
                  />
                )
              })}
            </div>
          ) : (
            <div className="px-3 py-8 text-sm text-[color:var(--text-muted)]">没有匹配结果。</div>
          )}
        </div>

        <div className="border-t border-[color:var(--border)] px-4 py-2 text-xs text-[color:var(--text-soft)]" id={helperId}>
          Enter 执行，↑↓ 选择，Tab 切组，Alt+D 切换默认工作流，Esc 关闭
        </div>
      </div>
    </div>
  )
}
