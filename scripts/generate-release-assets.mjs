import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const outputDir = path.join(rootDir, 'release-assets', 'first-release-draft', 'screenshots')
const baseUrl = 'http://127.0.0.1:4173'

const shots = [
  {
    fileName: '01-overview.png',
    path: '/overview?demo=release-assets',
    width: 1600,
    height: 1080,
  },
  {
    fileName: '02-command-palette-empty.png',
    path: '/overview?demo=release-assets&open=palette',
    width: 1600,
    height: 1080,
  },
  {
    fileName: '03-command-palette-workflow-search.png',
    path: '/overview?demo=release-assets&open=palette&paletteQuery=workflow%3Ayjsb',
    width: 1600,
    height: 1080,
  },
  {
    fileName: '04-projects-page.png',
    path: '/projects?demo=release-assets&sort=favorite&tags=backend,frontend',
    width: 1600,
    height: 1080,
  },
  {
    fileName: '05-workflows-page.png',
    path: '/workflows?demo=release-assets&sort=favorite',
    width: 1600,
    height: 1080,
  },
  {
    fileName: '06-data-tools.png',
    path: '/overview?demo=release-assets&open=data-tools',
    width: 1600,
    height: 1200,
  },
]

async function findBrowser() {
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          ]
        : [
            '/usr/bin/microsoft-edge',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
          ]

  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // continue
    }
  }

  throw new Error('未找到可用的 Edge / Chrome，可手动安装后再执行 npm run release:shots。')
}

async function waitForServer(url, timeoutMs = 30_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // retry
    }

    await new Promise((resolve) => setTimeout(resolve, 400))
  }

  throw new Error(`等待预览服务超时：${url}`)
}

async function stopServer(serverProcess) {
  if (!serverProcess.pid) {
    return
  }

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(serverProcess.pid), '/T', '/F'], {
        stdio: 'ignore',
      })
      killer.on('close', () => resolve())
      killer.on('error', () => resolve())
    })
    return
  }

  serverProcess.kill('SIGTERM')
}

async function captureShot(browserPath, shot) {
  const outputPath = path.join(outputDir, shot.fileName)
  const args = [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--run-all-compositor-stages-before-draw',
    '--force-device-scale-factor=1',
    '--virtual-time-budget=3000',
    `--window-size=${shot.width},${shot.height}`,
    `--screenshot=${outputPath}`,
    `${baseUrl}${shot.path}`,
  ]

  await new Promise((resolve, reject) => {
    const browser = spawn(browserPath, args, { stdio: 'ignore' })
    browser.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`截图失败：${shot.fileName}，退出码 ${code}`))
    })
    browser.on('error', reject)
  })

  return outputPath
}

async function main() {
  await fs.access(distDir).catch(() => {
    throw new Error('未找到 dist 目录，请先运行 npm run build。')
  })

  await fs.mkdir(outputDir, { recursive: true })
  const browserPath = await findBrowser()

  const previewServer =
    process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm run preview -- --host 127.0.0.1'], {
          cwd: rootDir,
          stdio: 'ignore',
        })
      : spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1'], {
          cwd: rootDir,
          stdio: 'ignore',
        })

  try {
    await waitForServer(`${baseUrl}/overview?demo=release-assets`)

    for (const shot of shots) {
      const outputPath = await captureShot(browserPath, shot)
      console.log(`Captured ${path.relative(rootDir, outputPath)}`)
    }
  } finally {
    await stopServer(previewServer)
  }
}

await main()
