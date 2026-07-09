import { noteTaskLabel } from '@/constants/workspaceTasks.js'
import { isSpatialRegionNote } from '@/utils/apiMappers.js'

const NOTE_TASK_COLOR = {
  background: '#0ea5e9',
  shading: '#8b5cf6',
  fx: '#f59e0b',
  other: '#71717a',
}

function noteColor(type) {
  return NOTE_TASK_COLOR[type] ?? NOTE_TASK_COLOR.other
}

function hasVisibleRegion(note) {
  return isSpatialRegionNote(note)
}

/**
 * Overlay read-only — giống ô ghi chú Mangaka trên ChapterAnnotator (% tọa độ).
 */
export default function MangakaNoteOverlay({ notes = [], visible = true }) {
  if (!visible) return null

  const boxes = (notes ?? []).filter(hasVisibleRegion)
  if (!boxes.length) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-visible">
      {boxes.map((n, idx) => {
        const color = noteColor(n.taskType)
        const label = noteTaskLabel(n.taskType)
        const key = n.clientKey ?? n.id ?? `mk-note-${idx}`
        return (
          <div
            key={key}
            className="absolute box-border border-2 border-dashed border-rose-500 bg-rose-500/15 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
            title={n.text?.trim() || label || undefined}
            style={{
              left: `${n.x}%`,
              top: `${n.y}%`,
              width: `${n.w}%`,
              height: `${n.h}%`,
            }}
          >
            <span
              className="absolute -left-2.5 -top-2.5 flex size-[22px] items-center justify-center rounded-full text-[10px] font-bold text-white shadow-md"
              style={{ background: color }}
            >
              {idx + 1}
            </span>
            {label ? (
              <span
                className="absolute bottom-full left-0 mb-0.5 max-w-[min(100%,12rem)] truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white shadow-sm"
                style={{ background: color }}
                title={n.text?.trim() || label}
              >
                {label}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
