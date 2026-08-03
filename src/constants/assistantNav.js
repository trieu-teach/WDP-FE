/** Link header chung cho các trang role Assistant (chỉ điều hướng, không đổi logic nghiệp vụ). */
export const ASSISTANT_WORKSPACE_VIEW_IDS = [
  'pick',
  'board',
  'coop',
  'editor',
]

export const ASSISTANT_NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/assistant?view=pick', label: 'Chọn Mangaka' },
  { to: '/assistant?view=coop', label: 'Hợp tác' },
  {
    to: '/assistant?view=editor',
    label: 'Layer Editor',
    shortLabel: 'Editor',
    intent: 'action',
  },
]
