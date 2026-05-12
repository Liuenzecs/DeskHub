import { charToPinyin } from './pinyin-data'

interface PinyinOptions {
  toneType?: 'none'
  pattern?: 'pinyin' | 'first'
  nonZh?: 'consecutive'
  separator?: string
}

export function pinyin(text: string, options: PinyinOptions = {}): string {
  const { pattern = 'pinyin', separator = ' ' } = options
  const result: string[] = []
  let nonZhBuffer: string[] = []

  for (const char of text) {
    const py = charToPinyin.get(char)
    if (py) {
      if (nonZhBuffer.length > 0) {
        result.push(nonZhBuffer.join(''))
        nonZhBuffer = []
      }
      result.push(pattern === 'first' ? py[0] : py)
    } else {
      nonZhBuffer.push(char)
    }
  }

  if (nonZhBuffer.length > 0) {
    result.push(nonZhBuffer.join(''))
  }

  return result.join(separator).toLowerCase()
}
