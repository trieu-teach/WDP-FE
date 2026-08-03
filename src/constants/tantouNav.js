import { PATH_TANTOU_EDITOR } from '@/constants/roleTerminology.js'
import { TANTOU_SECTIONS } from '@/constants/tantouSections.js'

/** Link header chung cho các trang role Editor / Tantou (chỉ điều hướng). */
export const TANTOU_NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: PATH_TANTOU_EDITOR, label: 'Tổng quan' },
  ...TANTOU_SECTIONS.map((section) => ({
    to: section.path,
    label: section.navLabel ?? section.title,
  })),
]
