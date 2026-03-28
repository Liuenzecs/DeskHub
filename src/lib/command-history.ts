import type {
  CommandHistoryPayload,
  CommandPaletteActionEntry,
  CommandPaletteEntry,
} from '../types/items'

export function getCommandPaletteActionHistoryTarget(entry: CommandPaletteActionEntry) {
  if (entry.action === 'create_item' && entry.itemType) {
    return `${entry.action}:${entry.itemType}`
  }

  if (
    (entry.action === 'create_from_starter_template' ||
      entry.action === 'create_from_workflow_template') &&
    entry.templateId
  ) {
    return `${entry.action}:${entry.templateId}`
  }

  if (entry.workflowId) {
    return `${entry.action}:${entry.workflowId}`
  }

  return entry.action
}

export function toCommandHistoryPayload(entry: CommandPaletteEntry): CommandHistoryPayload {
  if (entry.kind === 'item') {
    return {
      kind: 'item',
      target: entry.item.id,
      title: entry.title,
    }
  }

  if (entry.kind === 'route') {
    return {
      kind: 'route',
      target: entry.route,
      title: entry.title,
    }
  }

  return {
    kind: 'action',
    target: getCommandPaletteActionHistoryTarget(entry),
    title: entry.title,
  }
}
