'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { OscComment, OscHistory, User, Role } from '@prisma/client'
import { formatDateTime, ROLE_LABELS, avatarColor } from '@/lib/utils'
import { History, Send, Loader2, Trash2, Pencil, Check, X } from 'lucide-react'

type CommentWithUser = OscComment & { user: Pick<User, 'name' | 'role'> }
type HistoryWithUser = OscHistory & { user: Pick<User, 'name'> }

interface OscTimelineProps {
  oscId: string
  comments: CommentWithUser[]
  history: HistoryWithUser[]
  currentUser: { id: string; role: string }
  canComment: boolean
}

function formatFieldName(field: string): string {
  const map: Record<string, string> = {
    status: 'Status', priority: 'Priority', remark: 'Remark',
    receivedDate: 'Received Date', oscRequestDate: 'OSC Request Date',
    mailSentDate: 'Mail Sent Date', updatedDate: 'Updated Date',
    partnerId: 'Partner', popzone: 'PopZone',
  }
  return map[field] ?? field
}

function formatValue(field: string, value: string | null | undefined): string {
  if (!value) return '—'
  if (field.toLowerCase().includes('date')) {
    try { return new Date(value).toLocaleDateString('en-BE') } catch { return value }
  }
  const labels: Record<string, string> = {
    OSC_UPDATED: 'OSC Updated', EMAIL_SENT: 'Email Sent',
    EMAIL_SENT_REMINDER: 'Email + Reminder', ON_HOLD: 'On Hold',
    CHECK_REMARKS: 'Check Remarks', HIGH_PRIO: 'High Priority', LOW_PRIO: 'Low Priority',
  }
  return labels[value] ?? value
}

function buildTimeline(comments: CommentWithUser[], history: HistoryWithUser[]) {
  const items = [
    ...comments.map((c) => ({ type: 'comment' as const, at: c.createdAt, data: c })),
    ...history.map((h) => ({ type: 'history' as const, at: h.changedAt, data: h })),
  ]
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const bg = avatarColor(name)
  return (
    <div className={`w-${size} h-${size} ${bg} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function CommentItem({
  comment,
  currentUser,
  oscId,
  onRefresh,
}: {
  comment: CommentWithUser
  currentUser: { id: string; role: string }
  oscId: string
  onRefresh: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.comment)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isOwner = comment.userId === currentUser.id
  const isAdmin = currentUser.role === 'ADMIN'

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText === comment.comment) {
      setEditing(false)
      return
    }
    setSaving(true)
    await fetch(`/api/osc/${oscId}/comments/${comment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: editText.trim() }),
    })
    setSaving(false)
    setEditing(false)
    onRefresh()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/osc/${oscId}/comments/${comment.id}`, { method: 'DELETE' })
    setDeleting(false)
    onRefresh()
  }

  const isEdited = new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime() + 1000

  return (
    <div className="flex gap-3 relative z-10">
      <Avatar name={comment.user.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-sm font-semibold text-slate-900">{comment.user.name}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
            {ROLE_LABELS[comment.user.role as Role]}
          </span>
          <span className="text-xs text-slate-400">{formatDateTime(comment.createdAt)}</span>
          {isEdited && (
            <span className="text-[10px] text-slate-400 italic">edited</span>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            {isOwner && !editing && (
              <button
                onClick={() => { setEditing(true); setEditText(comment.comment) }}
                className="p-1 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                title="Edit"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {(isAdmin || isOwner) && !editing && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete"
              >
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit()
                if (e.key === 'Escape') setEditing(false)
              }}
              rows={3}
              autoFocus
              className="jira-input w-full resize-none text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editText.trim()}
                className="jira-btn-primary text-xs py-1 px-3"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save
              </button>
              <button onClick={() => setEditing(false)} className="jira-btn-secondary text-xs py-1 px-3">
                <X className="w-3 h-3" />
                Cancel
              </button>
              <span className="text-xs text-slate-400">Ctrl+Enter · Esc</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2.5 whitespace-pre-wrap">
            {comment.comment}
          </div>
        )}
      </div>
    </div>
  )
}

const TAB_LABELS = { all: 'Activity', comments: 'Comments', history: 'History' } as const

export function OscTimeline({ oscId, comments, history, currentUser, canComment }: OscTimelineProps) {
  const router = useRouter()
  const [tab, setTab] = useState<'all' | 'comments' | 'history'>('all')
  const [comment, setComment] = useState('')
  const [submitting, startTransition] = useTransition()

  const timeline = buildTimeline(comments, history)
  const filteredTimeline = timeline.filter((item) => {
    if (tab === 'comments') return item.type === 'comment'
    if (tab === 'history') return item.type === 'history'
    return true
  })

  const handleSubmitComment = async () => {
    if (!comment.trim()) return
    const text = comment.trim()
    setComment('')
    startTransition(async () => {
      await fetch(`/api/osc/${oscId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: text }),
      })
      router.refresh()
    })
  }

  const handleRefresh = () => {
    startTransition(() => router.refresh())
  }

  return (
    <div className="jira-panel">
      {/* Tabs */}
      <div className="flex items-center gap-0 px-4 border-b border-slate-100">
        {(['all', 'comments', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {t === 'comments' ? `Comments (${comments.length})` : TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Timeline items */}
      <div className="p-4">
        {filteredTimeline.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No activity yet</p>
        ) : (
          <div className="relative space-y-5">
            {/* Vertical connector line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-100" />

            {filteredTimeline.map((item, idx) =>
              item.type === 'comment' ? (
                <CommentItem
                  key={(item.data as CommentWithUser).id}
                  comment={item.data as CommentWithUser}
                  currentUser={currentUser}
                  oscId={oscId}
                  onRefresh={handleRefresh}
                />
              ) : (
                <div key={idx} className="flex gap-3 relative z-10">
                  <div className="w-8 h-8 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <History className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <span className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{(item.data as HistoryWithUser).user.name}</span>
                      {' changed '}
                      <span className="font-medium">{formatFieldName((item.data as HistoryWithUser).fieldChanged)}</span>
                      {(item.data as HistoryWithUser).oldValue && (
                        <>
                          {' from '}
                          <span className="bg-red-50 text-red-600 px-1.5 py-0.5 text-xs font-medium rounded">
                            {formatValue((item.data as HistoryWithUser).fieldChanged, (item.data as HistoryWithUser).oldValue)}
                          </span>
                        </>
                      )}
                      {(item.data as HistoryWithUser).newValue && (
                        <>
                          {' to '}
                          <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 text-xs font-medium rounded">
                            {formatValue((item.data as HistoryWithUser).fieldChanged, (item.data as HistoryWithUser).newValue)}
                          </span>
                        </>
                      )}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">{formatDateTime(item.at)}</span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Comment compose */}
      {canComment && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4">
          <p className="jira-section-header mb-3">Add a comment</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitComment()
            }}
            placeholder="Write a comment... (Ctrl+Enter to submit)"
            rows={3}
            className="jira-input w-full resize-none text-sm mb-3"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmitComment}
              disabled={!comment.trim() || submitting}
              className="jira-btn-primary text-xs"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Save
            </button>
            <button
              onClick={() => setComment('')}
              disabled={!comment.trim()}
              className="text-sm text-blue-600 hover:underline disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
