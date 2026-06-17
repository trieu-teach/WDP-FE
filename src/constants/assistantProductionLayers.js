/** Các bước layer sản xuất manga — Assistant upload từ phần mềm ngoài (PS/CSP). */

export const ASSISTANT_PRODUCTION_STEPS = [
  {
    key: 'sketch',
    label: 'Sketch Layer',
    labelVi: 'Phác thảo',
    hint: 'Bản phác thảo / layout ban đầu',
    color: '#a78bfa',
  },
  {
    key: 'line_art',
    label: 'Line Art Layer',
    labelVi: 'Nét vẽ',
    hint: 'Ink / line art trong suốt',
    color: '#38bdf8',
  },
  {
    key: 'color',
    label: 'Color Layer',
    labelVi: 'Tô màu',
    hint: 'Flat color / rendering',
    color: '#f472b6',
  },
  {
    key: 'text',
    label: 'Text Layer',
    labelVi: 'Thoại / chữ',
    hint: 'Balloon, SFX, typography',
    color: '#fbbf24',
  },
  {
    key: 'effect',
    label: 'Effect Layer',
    labelVi: 'Hiệu ứng',
    hint: 'FX, tone, highlight',
    color: '#34d399',
  },
  {
    key: 'final',
    label: 'Final Layer',
    labelVi: 'Hoàn thiện',
    hint: 'Bản polish cuối trước khi gửi',
    color: '#fb7185',
  },
]

export function productionStepByKey(key) {
  return ASSISTANT_PRODUCTION_STEPS.find((s) => s.key === key) ?? null
}
