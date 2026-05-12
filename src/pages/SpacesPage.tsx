import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Layers, Plus, Pencil, Trash2 } from 'lucide-react'
import { createSpace, deleteSpace, getSpaces, updateSpace } from '../lib/tauri'
import type { Space, SpacePayload } from '../types/items'

export function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Space | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#378add')

  const load = useCallback(async () => {
    try {
      const collection = await getSpaces()
      setSpaces(collection.spaces)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const resetForm = () => {
    setName('')
    setDescription('')
    setColor('#378add')
    setEditing(null)
    setShowForm(false)
  }

  const openCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (space: Space) => {
    setName(space.name)
    setDescription(space.description)
    setColor(space.color)
    setEditing(space)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    const payload: SpacePayload = { name: name.trim(), description, color }
    try {
      if (editing) {
        await updateSpace(editing.id, payload)
        toast.success('已更新空间。')
      } else {
        await createSpace(payload)
        toast.success('已创建空间。')
      }
      resetForm()
      await load()
    } catch (error) {
      toast.error(String(error))
    }
  }

  const handleDelete = async (space: Space) => {
    try {
      await deleteSpace(space.id)
      toast.success(`已删除「${space.name}」。`)
      await load()
    } catch (error) {
      toast.error(String(error))
    }
  }

  const COLORS = ['#378add', '#639922', '#d92d20', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6']

  return (
    <div className="px-3 py-4 lg:px-5 lg:py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="page-title">空间</h1>
          <p className="page-description mt-1">把条目分组到不同空间，按场景快速切换</p>
        </div>
        <button className="btn-primary gap-2" type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建空间
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[color:var(--text-soft)]">加载中...</div>
      ) : spaces.length === 0 ? (
        <div className="surface-muted py-16 text-center">
          <Layers className="mx-auto mb-3 h-8 w-8 text-[color:var(--text-soft)]" />
          <div className="text-sm font-medium text-[color:var(--text-muted)]">还没有空间</div>
          <div className="mt-1 text-xs text-[color:var(--text-soft)]">创建空间来组织你的条目</div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <div key={space.id} className="surface flex items-start gap-3 p-4">
              <div
                className="mt-0.5 h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: space.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[color:var(--text)]">{space.name}</div>
                {space.description && (
                  <div className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                    {space.description}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn-icon h-7 w-7" type="button" onClick={() => openEdit(space)}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button className="btn-icon h-7 w-7" type="button" onClick={() => handleDelete(space)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={resetForm}>
          <div className="modal-shell max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-kicker">{editing ? '编辑空间' : '新建空间'}</div>
            </div>
            <div className="modal-body grid gap-3">
              <input
                className="field"
                placeholder="空间名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <input
                className="field"
                placeholder="描述（可选）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div>
                <div className="field-label">颜色</div>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        color === c ? 'border-[color:var(--text)]' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      type="button"
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={resetForm}>取消</button>
              <button className="btn-primary" type="button" onClick={handleSave} disabled={!name.trim()}>
                {editing ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
