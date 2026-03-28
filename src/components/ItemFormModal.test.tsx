import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemFormModal } from './ItemFormModal'

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn(),
}))

const tauriMocks = vi.hoisted(() => ({
  inspectProjectDirectory: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => dialogMocks)
vi.mock('../lib/tauri', () => tauriMocks)

describe('ItemFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('prevents invalid app submission', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ItemFormModal open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: '创建条目' }))

    expect(screen.getByText('名称不能为空。')).toBeInTheDocument()
    expect(screen.getByText('应用启动路径不能为空。')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  }, 15000)

  it('switches to workflow fields and validates workflow steps', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ItemFormModal open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('类型'), 'workflow')
    expect(screen.getByText('工作流步骤')).toBeInTheDocument()

    await user.click(screen.getByLabelText('删除步骤 1'))
    await user.click(screen.getByRole('button', { name: '创建条目' }))

    expect(screen.getByText('至少保留一个工作流步骤。')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  }, 15000)

  it('fills the selected executable path back into the form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    dialogMocks.open.mockResolvedValue('C:\\Program Files\\DeskHub\\DeskHub.exe')

    render(<ItemFormModal open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: '选择 exe' }))

    await waitFor(() => {
      expect(dialogMocks.open).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: '',
          directory: false,
          multiple: false,
          filters: [{ name: 'Windows 可执行文件', extensions: ['exe'] }],
        }),
      )
      expect(screen.getByLabelText('应用启动路径')).toHaveValue('C:\\Program Files\\DeskHub\\DeskHub.exe')
    })
  })

  it('supports visual icon picking and writes the icon key back into the form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ItemFormModal open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: '选择图标 火箭' }))

    expect(screen.getByLabelText('图标')).toHaveValue('rocket')
    expect(screen.getAllByText('火箭').length).toBeGreaterThan(0)
  })

  it('shows execution mode controls for scripts and workflow commands', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ItemFormModal open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('类型'), 'script')
    expect(screen.getByLabelText('执行方式')).toHaveValue('new_terminal')

    await user.selectOptions(screen.getByLabelText('类型'), 'workflow')
    await user.selectOptions(screen.getByLabelText('步骤 1'), 'run_command')

    expect(screen.getAllByLabelText('执行方式')).toHaveLength(1)
  })

  it('applies a starter template to the form for non-workflow items', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ItemFormModal open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('类型'), 'project')
    await user.click(screen.getByRole('button', { name: /^Web 项目/ }))

    expect(screen.getByLabelText('名称')).toHaveValue('Web 项目')
    expect(screen.getByLabelText('启动命令')).toHaveValue('npm run dev')
    expect(screen.getByRole('button', { name: /frontend/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /daily/ })).toBeInTheDocument()
  })

  it('auto-fills project name and command after choosing a project directory', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    dialogMocks.open.mockResolvedValue('C:\\dev\\DeskHub')
    tauriMocks.inspectProjectDirectory.mockResolvedValue({
      suggestedName: 'DeskHub',
      suggestedCommand: 'pnpm dev',
      commandSuggestions: ['pnpm dev', 'npm run dev'],
      detectedFiles: ['package.json', 'pnpm-lock.yaml'],
    })

    render(<ItemFormModal open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('类型'), 'project')
    await user.click(screen.getByRole('button', { name: '选择目录' }))

    await waitFor(() => {
      expect(tauriMocks.inspectProjectDirectory).toHaveBeenCalledWith('C:\\dev\\DeskHub')
      expect(screen.getByLabelText('名称')).toHaveValue('DeskHub')
      expect(screen.getByLabelText('启动命令')).toHaveValue('pnpm dev')
    })
  })

  it('shows live url validation and confirms before discarding dirty changes', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ItemFormModal open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('类型'), 'url')
    await user.type(screen.getByLabelText('网站地址'), 'not-a-url')

    expect(screen.getByText('请输入有效的网址。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.getByText('放弃未保存的修改？')).toBeInTheDocument()
  })

  it('supports inserting and duplicating workflow steps', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ItemFormModal open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('类型'), 'workflow')
    await user.selectOptions(screen.getByLabelText('步骤 1'), 'run_command')
    await user.type(screen.getByLabelText('运行命令'), 'npm run dev')

    await user.click(screen.getByLabelText('复制步骤 1'))

    expect(screen.getAllByDisplayValue('npm run dev')).toHaveLength(2)

    await user.click(screen.getByLabelText('在下方插入步骤 1'))

    expect(screen.getByLabelText('步骤 3')).toBeInTheDocument()
  }, 15000)

  it('supports chips-style tags and browsing workflow open_path steps', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    dialogMocks.open.mockResolvedValue('C:\\workspace')

    render(<ItemFormModal open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('标签'), 'daily')
    await user.keyboard('{Enter}')

    expect(screen.getByRole('button', { name: /daily/ })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('类型'), 'workflow')
    await user.click(screen.getByRole('button', { name: '为步骤 1 选择目录' }))

    await waitFor(() => {
      expect(screen.getByLabelText('打开路径')).toHaveValue('C:\\workspace')
    })
  }, 15000)
})
