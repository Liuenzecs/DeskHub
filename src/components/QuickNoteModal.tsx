import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createNote, deleteNote, updateNote } from '../lib/tauri'
import type { QuickNote } from '../types/items'
import { formatRelativeTimestamp } from '../lib/item-utils'

interface QuickNoteModalProps {
  note: QuickNote | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function QuickNoteModal({ note, open, onClose, onSaved }: QuickNoteModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(note?.title ?? '')
      setContent(note?.content ?? '')
    }
  }, [open, note])

  if (!open) return null

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) return
    setSaving(true)
    try {
      if (note) {
        await updateNote(note.id, { title, content })
        toast.success('已更新便签。')
      } else {
        await createNote({ title, content })
        toast.success('已创建便签。')
      }
      onSaved()
      onClose()
    } catch (error) {
      toast.error(String(error))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!note) return
    try {
      await deleteNote(note.id)
      toast.success('已删除便签。')
      onSaved()
      onClose()
    } catch (error) {
      toast.error(String(error))
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-shell max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="modal-kicker">便签</div>
            <input
              className="mt-1 w-full bg-transparent text-xl font-semibold tracking-[-0.03em] text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
              placeholder="标题（可选）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  document.getElementById('note-content')?.focus()
                }
              }}
            />
          </div>
          {note && (
            <div className="text-[11px] text-[color:var(--text-soft)]">
              {formatRelativeTimestamp(note.updatedAt)}
            </div>
          )}
        </div>

        <div className="modal-body">
          <textarea
            id="note-content"
            className="field min-h-[200px] resize-y"
            placeholder="在这里写下内容..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="modal-footer">
          {note && (
            <button
              className="btn-danger mr-auto"
              type="button"
              onClick={handleDelete}
              disabled={saving}
            >
              删除
            </button>
          )}
          <button className="btn-secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={handleSave}
            disabled={saving || (!title.trim() && !content.trim())}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
