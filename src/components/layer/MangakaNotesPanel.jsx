import { Check, MessageSquareText, RotateCcw } from 'lucide-react'
import { noteTaskLabel } from '@/constants/workspaceTasks.js'
import { cn } from '@/lib/utils'
import { mangakaNoteDoneKey } from '@/utils/assistantMangakaNotesDone.js'

const NOTE_TASK_COLOR = {
  background: '#0ea5e9',
  shading: '#8b5cf6',
  fx: '#f59e0b',
  other: '#71717a',
}

/**
 * Panel đọc nội dung note Mangaka — chỉ hiển thị, không đổi logic load note.
 * Dấu tích = đánh dấu đã xong → ẩn khỏi list + overlay (local/session).
 */
export default function MangakaNotesPanel({
  notes = [],
  loading = false,
  doneCount = 0,
  onMarkDone,
  onRestoreDone,
  className,
}) {
  const list = Array.isArray(notes) ? notes : []

  return (
    <div className={cn('border-b border-slate-700/60 p-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
            <MessageSquareText className="size-3" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200">Ghi chú Mangaka</p>
            <p className="text-[10px] text-slate-500">
              {loading
                ? 'Đang tải…'
                : list.length
                  ? `${list.length} ô chưa xong`
                  : doneCount > 0
                    ? 'Đã hoàn thành hết ô trên trang'
                    : 'Chưa có ô ghi chú'}
              {doneCount > 0 && list.length > 0 ? ` · ${doneCount} đã xong` : ''}
            </p>
          </div>
        </div>
        {doneCount > 0 && typeof onRestoreDone === 'function' ? (
          <button
            type="button"
            onClick={onRestoreDone}
            title="Hiện lại các ô đã đánh dấu xong"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-700/60 bg-slate-800/50 px-2 text-[10px] font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <RotateCcw className="size-3" />
            Hiện lại
          </button>
        ) : null}
      </div>

      {list.length === 0 && !loading ? (
        <p className="rounded-xl border border-dashed border-slate-700/60 bg-slate-800/30 px-3 py-4 text-center text-[11px] text-slate-500">
          {doneCount > 0
            ? 'Đã đánh dấu xong mọi ghi chú trên trang này.'
            : 'Mangaka chưa gắn ghi chú vùng cho trang này.'}
        </p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto pr-0.5">
          {list.map((n, idx) => {
            const color = NOTE_TASK_COLOR[n.taskType] ?? NOTE_TASK_COLOR.other
            const label = noteTaskLabel(n.taskType)
            const text = String(n.text ?? n.content ?? '').trim()
            const key = mangakaNoteDoneKey(n) || `mk-note-panel-${idx}`
            return (
              <li
                key={key}
                className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-2.5 py-2 transition-colors hover:border-slate-600 hover:bg-slate-800"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: color }}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ background: color }}
                  >
                    {label}
                  </span>
                  {typeof onMarkDone === 'function' ? (
                    <button
                      type="button"
                      title="Đánh dấu đã hoàn thành — ẩn ghi chú và vùng đánh dấu"
                      onClick={() => onMarkDone(n)}
                      className={cn(
                        'inline-flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors',
                        'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
                        'hover:border-emerald-400/50 hover:bg-emerald-500/25 hover:text-emerald-200',
                      )}
                    >
                      <Check className="size-3.5" strokeWidth={2.5} />
                    </button>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-300">
                  {text || (
                    <span className="italic text-slate-500">(Không có nội dung chữ)</span>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
