/** Bảng màu kiểu MS Paint + công cụ vẽ web / tablet. */

/** Màu lối tắt — màu tùy ý chọn trong khung phổ (ColorPickerPanel). */
export const QUICK_SWATCHES = [
  '#000000', '#ffffff', '#ed1c24', '#ff7f27', '#fff200', '#22b14c',
  '#00a2e8', '#3f48cc', '#a349a4', '#9b5de5', '#8b4513', '#c3c3c3',
]

/** @deprecated — dùng QUICK_SWATCHES + ColorPickerPanel */
export const PAINT_PALETTE = QUICK_SWATCHES

export const BRUSH_SIZE_PRESETS = [1, 3, 6, 12, 24, 36, 48]

export const PAINT_TOOLS = [
  { id: 'pencil', label: 'Bút chì', icon: '✏️', group: 'draw' },
  { id: 'brush', label: 'Cọ', icon: '🖌️', group: 'draw' },
  { id: 'marker', label: 'Bút dạ', icon: '🖍️', group: 'draw' },
  { id: 'eraser', label: 'Tẩy', icon: '🧹', group: 'draw' },
  { id: 'fill', label: 'Tô màu', icon: '🪣', group: 'draw' },
  { id: 'line', label: 'Đường thẳng', icon: '╱', group: 'shape' },
  { id: 'rect', label: 'Hình chữ nhật', icon: '▭', group: 'shape' },
  { id: 'ellipse', label: 'Hình elip', icon: '⬭', group: 'shape' },
  { id: 'text', label: 'Chữ', icon: 'A', group: 'shape' },
  { id: 'eyedropper', label: 'Hút màu', icon: '💧', group: 'utility' },
  { id: 'select', label: 'Chọn', icon: '↖', group: 'utility' },
]

export const INPUT_MODES = [
  {
    id: 'web',
    label: 'Vẽ trên web',
    desc: 'Chuột / cảm ứng — công cụ giống Paint',
  },
  {
    id: 'tablet',
    label: 'Thiết bị vẽ ngoài',
    desc: 'Wacom, XP-Pen, Huion… — áp lực bút & ngòi',
  },
]

/** Màu viền theo layer đang chọn (nhận biết nhanh). */
export const LAYER_ACCENT_COLORS = [
  '#9b5de5', '#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#ffb703', '#3f48cc', '#fb8500',
]

export function layerAccentColor(layerId, paintLayers) {
  const idx = paintLayers.findIndex(l => l.id === layerId)
  return LAYER_ACCENT_COLORS[Math.max(0, idx) % LAYER_ACCENT_COLORS.length]
}
