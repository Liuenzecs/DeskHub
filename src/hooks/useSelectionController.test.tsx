import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSelectionController } from './useSelectionController'

function createVisibleIds(count: number) {
  return Array.from({ length: count }, (_, index) => `item-${index}`)
}

describe('useSelectionController', () => {
  it('supports select-all and filtered-range retention for larger visible sets', () => {
    const allIds = createVisibleIds(240)
    const { result, rerender } = renderHook(({ visibleIds }) => useSelectionController(visibleIds), {
      initialProps: { visibleIds: allIds },
    })

    act(() => {
      result.current.selectAll()
    })

    expect(result.current.selectedIds).toHaveLength(240)

    rerender({ visibleIds: allIds.slice(0, 80) })

    expect(result.current.selectedIds).toHaveLength(80)
    expect(result.current.selectedIds[0]).toBe('item-0')
    expect(result.current.selectedIds[79]).toBe('item-79')
  })

  it('supports shift range selection across larger collections', () => {
    const visibleIds = createVisibleIds(300)
    const { result } = renderHook(() => useSelectionController(visibleIds))

    act(() => {
      result.current.handleSelect('item-24')
    })

    act(() => {
      result.current.handleSelect('item-140', { shiftKey: true })
    })

    expect(result.current.selectedIds).toHaveLength(117)
    expect(result.current.selectedIds[0]).toBe('item-24')
    expect(result.current.selectedIds[result.current.selectedIds.length - 1]).toBe('item-140')
  })
})
