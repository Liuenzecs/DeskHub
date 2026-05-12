import { useCallback, useEffect, useState } from 'react'
import { Plus, StickyNote } from 'lucide-react'
import { getNotes } from '../lib/tauri'
import { QuickNoteModal } from '../components/QuickNoteModal'
import { formatRelativeTimestamp } from '../lib/item-utils'
import type { QuickNote } from '../types/items'

export function NotesPage() {
  const [notes, setNotes] = useState<QuickNote[]>([])
  const [loading, setLoading] = useState(true)
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadNotes = useCallback(async () => {
    try {
      const collection = await getNotes()
      setNotes(collection.notes)
    } catch {
      // notes not available
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  const openNew = () => {
    setEditingNote(null)
    setModalOpen(true)
  }

  const openEdit = (note: QuickNote) => {
    setEditingNote(note)
    setModalOpen(true)
  }

  return (
    <div className="px-3 py-4 lg:px-5 lg:py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="page-title">便签</h1>
          <p className="page-description mt-1">快速记录与查找</p>
        </div>
        <button className="btn-primary gap-2" type="button" onClick={openNew}>
          <Plus className="h-4 w-4" />
          新建便签
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[color:var(--text-soft)]">加载中...</div>
      ) : notes.length === 0 ? (
        <div className="surface-muted py-16 text-center">
          <StickyNote className="mx-auto mb-3 h-8 w-8 text-[color:var(--text-soft)]" />
          <div className="text-sm font-medium text-[color:var(--text-muted)]">还没有便签</div>
          <div className="mt-1 text-xs text-[color:var(--text-soft)]">
            点击「新建便签」创建第一条
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <button
              key={note.id}
              className="surface cursor-pointer p-4 text-left transition hover:border-[color:var(--border-strong)]"
              type="button"
              onClick={() => openEdit(note)}
            >
              {note.title && (
                <div className="mb-1 text-sm font-semibold text-[color:var(--text)]">
                  {note.title}
                </div>
              )}
              <div className="line-clamp-3 text-xs leading-5 text-[color:var(--text-muted)]">
                {note.content || '(无内容)'}
              </div>
              <div className="mt-2 text-[10px] text-[color:var(--text-soft)]">
                {formatRelativeTimestamp(note.updatedAt)}
              </div>
            </button>
          ))}
        </div>
      )}

      <QuickNoteModal
        note={editingNote}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadNotes}
      />
    </div>
  )
}
