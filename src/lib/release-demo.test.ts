import { describe, expect, it } from 'vitest'
import { getReleaseCaptureConfig } from './release-demo'

describe('release demo capture config', () => {
  it('parses release asset capture parameters', () => {
    const config = getReleaseCaptureConfig(
      '?demo=release-assets&open=palette&paletteQuery=workflow%3Ayjsb&query=desk&sort=favorite&tags=tauri,release&selection=mode',
    )

    expect(config).toEqual({
      enabled: true,
      overlay: 'palette',
      paletteQuery: 'workflow:yjsb',
      listQuery: 'desk',
      sortOption: 'favorite',
      selectedTags: ['tauri', 'release'],
      selectionMode: true,
    })
  })

  it('returns disabled config outside release demo mode', () => {
    expect(getReleaseCaptureConfig('?query=desk')).toEqual({
      enabled: false,
      overlay: null,
      paletteQuery: '',
      listQuery: '',
      sortOption: null,
      selectedTags: [],
      selectionMode: false,
    })
  })
})
