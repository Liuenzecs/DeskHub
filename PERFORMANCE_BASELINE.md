# DeskHub 性能与包体基线

最后更新：2026-03-28

本文档由 `npm run perf:report` 根据当前 `dist/assets` 自动生成，用来记录“性能与包体继续收敛第二阶段”的最新构建基线。

## 关键观察

- 当前最大的前端 JS chunk 仍然是搜索相关 vendor。
- 命令面板与数据工具都已经保持为独立懒加载模块。
- 主入口仍保持在较小体积，搜索增强成本主要集中在按需加载的 transliteration 相关资源。

## 重点文件

| 文件 | 原始体积 | gzip |
| --- | ---: | ---: |
| search-vendor-rXZ36iYn.js | 280 kB | 138 kB |
| index-Dqk2PK3B.js | 50.4 kB | 13.8 kB |
| CommandPalette-eS6kXH7t.js | 9.8 kB | 3.8 kB |
| DataToolsModal-B8mHQeBR.js | 55.2 kB | 11.6 kB |

## 最大 JS Chunk Top 10

| 文件 | 原始体积 | gzip |
| --- | ---: | ---: |
| search-vendor-rXZ36iYn.js | 280 kB | 138 kB |
| react-vendor-CUL_XuUY.js | 175 kB | 54.5 kB |
| DataToolsModal-B8mHQeBR.js | 55.2 kB | 11.6 kB |
| index-Dqk2PK3B.js | 50.4 kB | 13.8 kB |
| feedback-vendor-DzqlZgKy.js | 42.5 kB | 12.5 kB |
| router-vendor-CID1LPJ3.js | 39.8 kB | 14.0 kB |
| ItemFormModal-Ci6WzlQB.js | 39.1 kB | 9.4 kB |
| OverviewPage-D4_mUrDS.js | 27.1 kB | 7.5 kB |
| item-utils-CRYkjX1V.js | 13.7 kB | 4.8 kB |
| useSelectionShortcuts-BOYUniVI.js | 13.3 kB | 4.0 kB |

## CSS 产物

| 文件 | 原始体积 | gzip |
| --- | ---: | ---: |
| index-Bux7QCH5.css | 32.7 kB | 6.6 kB |
