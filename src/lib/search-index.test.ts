import { describe, expect, it } from 'vitest'
import {
  buildSearchIndex,
  getSearchMatchKind,
  loadSearchTransliteration,
  scoreSearchIndex,
} from './search-index'

describe('search-index', () => {
  it('supports raw matching before transliteration runtime is ready', () => {
    const index = buildSearchIndex(['工作流', 'workflow'], 'search-index:test:raw')

    expect(scoreSearchIndex(index, '工作')).toBeGreaterThan(0)
    expect(getSearchMatchKind(index, '工作')).toBe('raw')
  })

  it('hydrates cached indexes for pinyin search after transliteration runtime loads', async () => {
    const index = buildSearchIndex(['工作流'], 'search-index:test:pinyin')

    expect(scoreSearchIndex(index, 'gongzuoliu')).toBe(0)

    await loadSearchTransliteration()

    expect(scoreSearchIndex(index, 'gongzuoliu')).toBeGreaterThan(0)
    expect(getSearchMatchKind(index, 'gzl')).toBe('initials')
  })
})
