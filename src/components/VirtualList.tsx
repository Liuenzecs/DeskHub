import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

interface VirtualListProps<T> {
  items: T[]
  getKey: (item: T, index: number) => string
  estimateSize?: number
  overscan?: number
  gap?: number
  minItemsToVirtualize?: number
  renderItem: (item: T, index: number) => ReactNode
}

interface RangeState {
  start: number
  end: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function VirtualList<T>({
  items,
  getKey,
  estimateSize = 118,
  overscan = 5,
  gap = 8,
  minItemsToVirtualize = 36,
  renderItem,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const [range, setRange] = useState<RangeState>({
    start: 0,
    end: Math.min(items.length, Math.max(minItemsToVirtualize, 18)),
  })

  const itemSize = Math.max(estimateSize, 1)
  const totalHeight = Math.max(items.length * itemSize - gap, 0)
  const normalizedRange = useMemo(
    () => ({
      start: clamp(range.start, 0, items.length),
      end: clamp(
        Math.max(range.end, Math.min(items.length, Math.max(minItemsToVirtualize, 18))),
        0,
        items.length,
      ),
    }),
    [items.length, minItemsToVirtualize, range.end, range.start],
  )

  useEffect(() => {
    if (items.length <= minItemsToVirtualize) {
      return
    }

    const updateRange = () => {
      frameRef.current = null

      const container = containerRef.current
      if (!container) {
        return
      }

      const rect = container.getBoundingClientRect()
      const viewportHeight = window.innerHeight

      if (rect.height <= 0) {
        return
      }

      const visibleTop = clamp(-rect.top, 0, rect.height)
      const visibleBottom = clamp(viewportHeight - rect.top, 0, rect.height)
      const start = clamp(Math.floor(visibleTop / itemSize) - overscan, 0, items.length)
      const end = clamp(Math.ceil(visibleBottom / itemSize) + overscan, start, items.length)

      setRange((current) =>
        current.start === start && current.end === end ? current : { start, end },
      )
    }

    const scheduleUpdate = () => {
      if (frameRef.current !== null) {
        return
      }

      frameRef.current = window.requestAnimationFrame(updateRange)
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [gap, itemSize, items.length, minItemsToVirtualize, overscan])

  const virtualItems = useMemo(
    () =>
      items.slice(normalizedRange.start, normalizedRange.end).map((item, index) => {
        const actualIndex = normalizedRange.start + index
        return {
          item,
          index: actualIndex,
          key: getKey(item, actualIndex),
          offsetTop: actualIndex * itemSize,
        }
      }),
    [getKey, itemSize, items, normalizedRange.end, normalizedRange.start],
  )

  if (items.length <= minItemsToVirtualize) {
    return <div className="grid gap-2">{items.map((item, index) => renderItem(item, index))}</div>
  }

  return (
    <div ref={containerRef} className="relative" style={{ height: totalHeight }}>
      {virtualItems.map(({ item, index, key, offsetTop }) => (
        <div
          key={key}
          className="absolute inset-x-0"
          style={{ top: offsetTop, height: itemSize - gap }}
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  )
}
