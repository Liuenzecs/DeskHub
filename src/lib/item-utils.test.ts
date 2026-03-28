import { describe, expect, it } from 'vitest'
import { searchItems } from './item-utils'
import type { DeskItem } from '../types/items'

function createSyntheticItems(count: number): DeskItem[] {
  const targetIndex = Math.min(count - 1, 913)

  return Array.from({ length: count }, (_, index) => ({
    id: `app-${index}`,
    name: index === targetIndex ? 'DeskHub Alpha Tool' : `Workspace ${index}`,
    type: 'app',
    description: index === targetIndex ? 'focused launch target' : `Synthetic application ${index}`,
    tags: index === targetIndex ? ['alpha', 'synthetic'] : ['synthetic'],
    icon: '',
    favorite: index % 13 === 0,
    createdAt: '2026-03-24T00:00:00Z',
    updatedAt: new Date(Date.UTC(2026, 2, 24, 0, 0, index)).toISOString(),
    lastLaunchedAt: new Date(Date.UTC(2026, 2, 24, 8, 0, index)).toISOString(),
    launchTarget: `C:\\Apps\\Synthetic-${index}.exe`,
  }))
}

describe('item-utils search cache', () => {
  it('reuses search results for the same items and query', () => {
    const itemCount = 200
    const items = createSyntheticItems(itemCount)

    const firstResult = searchItems(items, 'alpha tool')
    const secondResult = searchItems(items, 'alpha tool')

    expect(secondResult).toBe(firstResult)
    expect(firstResult[0]).toMatchObject({ id: `app-${itemCount - 1}` })
  })

  it('reuses the computed recent list for empty queries', () => {
    const items = createSyntheticItems(120)

    const firstResult = searchItems(items, '')
    const secondResult = searchItems(items, '')

    expect(secondResult).toBe(firstResult)
    expect(firstResult).toHaveLength(120)
    expect(firstResult[0]?.id).toBe('app-119')
  })

  it('keeps search correctness under larger synthetic datasets', () => {
    const items = createSyntheticItems(1500)

    const results = searchItems(items, 'focused launch target')

    expect(results[0]).toMatchObject({ id: 'app-913' })
    expect(results.some((item) => item.id === 'app-913')).toBe(true)
  })
})
