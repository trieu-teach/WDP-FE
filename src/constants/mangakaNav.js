/** Link header chung cho các trang role Mangaka (chỉ điều hướng, không đổi logic nghiệp vụ). */
export const MANGAKA_WORKSPACE_TAB_IDS = [
  'series',
  'chapters',
  'assistants',
  'annotate',
]

export const MANGAKA_NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/mangaka?tab=series', label: 'Series' },
  { to: '/mangaka?tab=chapters', label: 'Chapter' },
  { to: '/mangaka?tab=assistants', label: 'Thuê Assistant' },
  { to: '/mangaka?tab=annotate', label: 'Upload & ghi chú' },
  { to: '/mangaka/review', label: 'Duyệt Assistant' },
]
