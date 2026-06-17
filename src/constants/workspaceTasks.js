/** Loại việc giao cho Assistant trên từng vùng trang. */

export const NOTE_TASK_TYPES = [
  { value: 'background', label: 'Vẽ nền' },
  { value: 'shading', label: 'Tô bóng' },
  { value: 'fx', label: 'Hiệu ứng' },
  { value: 'other', label: 'Khác' },
]

export function noteTaskLabel(value) {
  return NOTE_TASK_TYPES.find(t => t.value === value)?.label ?? 'Khác'
}
