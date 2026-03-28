import { gzipSync } from 'node:zlib'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distAssetsDir = path.join(rootDir, 'dist', 'assets')
const outputPath = path.join(rootDir, 'PERFORMANCE_BASELINE.md')

function formatKilobytes(bytes) {
  return `${(bytes / 1024).toFixed(bytes >= 100 * 1024 ? 0 : 1)} kB`
}

function toMarkdownTable(rows) {
  return [
    '| 文件 | 原始体积 | gzip |',
    '| --- | ---: | ---: |',
    ...rows.map((row) => `| ${row.name} | ${formatKilobytes(row.raw)} | ${formatKilobytes(row.gzip)} |`),
  ].join('\n')
}

function formatReportDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
  }).format(new Date())
}

async function main() {
  const dirEntries = await fs.readdir(distAssetsDir, { withFileTypes: true }).catch(() => null)
  if (!dirEntries) {
    throw new Error('未找到 dist/assets，请先运行 npm run build。')
  }

  const files = await Promise.all(
    dirEntries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fullPath = path.join(distAssetsDir, entry.name)
        const content = await fs.readFile(fullPath)
        return {
          name: entry.name,
          raw: content.byteLength,
          gzip: gzipSync(content).byteLength,
        }
      }),
  )

  const jsFiles = files
    .filter((file) => file.name.endsWith('.js'))
    .sort((left, right) => right.raw - left.raw)

  const cssFiles = files
    .filter((file) => file.name.endsWith('.css'))
    .sort((left, right) => right.raw - left.raw)

  const searchVendor = jsFiles.find((file) => file.name.startsWith('search-vendor-')) ?? null
  const mainIndex = jsFiles.find((file) => file.name.startsWith('index-')) ?? null
  const commandPalette = jsFiles.find((file) => file.name.startsWith('CommandPalette-')) ?? null
  const dataTools = jsFiles.find((file) => file.name.startsWith('DataToolsModal-')) ?? null
  const generatedAt = formatReportDate()

  const markdown = `# DeskHub 性能与包体基线

最后更新：${generatedAt}

本文档由 \`npm run perf:report\` 根据当前 \`dist/assets\` 自动生成，用来记录“性能与包体继续收敛第二阶段”的最新构建基线。

## 关键观察

- 当前最大的前端 JS chunk 仍然是搜索相关 vendor。
- 命令面板与数据工具都已经保持为独立懒加载模块。
- 主入口仍保持在较小体积，搜索增强成本主要集中在按需加载的 transliteration 相关资源。

## 重点文件

${toMarkdownTable(
  [searchVendor, mainIndex, commandPalette, dataTools].filter(Boolean),
)}

## 最大 JS Chunk Top 10

${toMarkdownTable(jsFiles.slice(0, 10))}

## CSS 产物

${cssFiles.length ? toMarkdownTable(cssFiles) : '_当前没有单独 CSS 产物。_'}
`

  await fs.writeFile(outputPath, markdown, 'utf8')
  console.log(`Performance baseline written to ${outputPath}`)
}

await main()
