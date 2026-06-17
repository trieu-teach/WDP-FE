/** Loại nhận xét vùng — Tantou Editor khi duyệt trang. */

export const TANTOU_REVIEW_NOTE_TYPES = [
  { value: 'dialogue', label: 'Lời thoại / dịch' },
  { value: 'layout', label: 'Bố cục / phân khung' },
  { value: 'art', label: 'Hình ảnh / nét vẽ' },
  { value: 'pacing', label: 'Nhịp truyện' },
  { value: 'technical', label: 'Kỹ thuật / typo' },
  { value: 'other', label: 'Khác' },
]

export function tantouReviewNoteLabel(value) {
  return TANTOU_REVIEW_NOTE_TYPES.find(t => t.value === value)?.label ?? 'Khác'
}
