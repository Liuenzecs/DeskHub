import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VirtualList } from './VirtualList'

describe('VirtualList', () => {
  let currentTop = 0
  let pendingAnimationFrame: FrameRequestCallback | null = null

  beforeEach(() => {
    currentTop = 0
    pendingAnimationFrame = null

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      pendingAnimationFrame = callback
      return 1
    })

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return {
        x: 0,
        y: currentTop,
        top: currentTop,
        left: 0,
        right: 800,
        bottom: currentTop + 1600,
        width: 800,
        height: 1600,
        toJSON: () => ({}),
      } as DOMRect
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a moving window for large lists instead of mounting every row', async () => {
    const items = Array.from({ length: 80 }, (_, index) => `Item ${index}`)

    render(
      <VirtualList
        estimateSize={20}
        gap={0}
        getKey={(item) => item}
        items={items}
        minItemsToVirtualize={10}
        overscan={2}
        renderItem={(item) => <div>{item}</div>}
      />,
    )

    act(() => {
      pendingAnimationFrame?.(performance.now())
    })

    expect(screen.getByText('Item 0')).toBeInTheDocument()
    expect(screen.queryByText('Item 79')).not.toBeInTheDocument()

    currentTop = -900
    fireEvent.scroll(window)
    act(() => {
      pendingAnimationFrame?.(performance.now())
    })

    await waitFor(() => {
      expect(screen.getByText('Item 60')).toBeInTheDocument()
    })

    expect(screen.queryByText('Item 0')).not.toBeInTheDocument()
  })
})
