import { PATH_EDITOR_BOARD } from '@/constants/roleTerminology.js'

/** Link header chung cho các trang role Editor Board (chỉ điều hướng). */
export const EB_NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: PATH_EDITOR_BOARD, label: 'Hàng chờ duyệt' },
  { to: `${PATH_EDITOR_BOARD}/history`, label: 'Lịch sử chấm' },
  { to: `${PATH_EDITOR_BOARD}/schedule`, label: 'Lịch publish' },
]
