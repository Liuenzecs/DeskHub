import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSearchRuntime } from './useSearchRuntime'

const searchIndexMocks = vi.hoisted(() => ({
  canSearchQueryBenefitFromTransliteration: vi.fn<(query: string) => boolean>(),
  getSearchRuntimeVersion: vi.fn<() => number>(),
  loadSearchTransliteration: vi.fn<() => Promise<void>>(),
  scheduleSearchTransliterationWarmup: vi.fn<() => () => void>(),
  subscribeSearchRuntime: vi.fn<(listener: () => void) => () => void>(),
}))

vi.mock('../lib/search-index', () => searchIndexMocks)

function TestHarness({ query }: { query?: string }) {
  useSearchRuntime(query)
  return null
}

describe('useSearchRuntime', () => {
  it('only eagerly loads transliteration runtime for latin queries', async () => {
    searchIndexMocks.getSearchRuntimeVersion.mockReturnValue(0)
    searchIndexMocks.loadSearchTransliteration.mockResolvedValue()
    searchIndexMocks.scheduleSearchTransliterationWarmup.mockReturnValue(() => undefined)
    searchIndexMocks.subscribeSearchRuntime.mockReturnValue(() => undefined)
    searchIndexMocks.canSearchQueryBenefitFromTransliteration.mockImplementation((query) =>
      /[a-z]/i.test(query),
    )

    const { rerender } = render(<TestHarness query="一键上班" />)

    await waitFor(() => {
      expect(searchIndexMocks.canSearchQueryBenefitFromTransliteration).toHaveBeenCalledWith('一键上班')
    })
    expect(searchIndexMocks.loadSearchTransliteration).not.toHaveBeenCalled()

    rerender(<TestHarness query="workflow:yjsb" />)

    await waitFor(() => {
      expect(searchIndexMocks.loadSearchTransliteration).toHaveBeenCalledTimes(1)
    })
  })
})
