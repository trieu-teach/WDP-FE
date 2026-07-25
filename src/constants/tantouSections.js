import { PATH_TANTOU_EDITOR } from '@/constants/roleTerminology.js'

/** Các khu vực làm việc Tantou (UI hub → trang riêng). */
export const TANTOU_SECTIONS = [
  {
    id: 'series-pending',
    path: `${PATH_TANTOU_EDITOR}/series-pending`,
    title: 'Series chưa được duyệt',
    description: 'Giai đoạn 1 — series chưa EB-approved, duyệt series + chapter.',
    icon: 'sparkles',
  },
  {
    id: 'series-approved',
    path: `${PATH_TANTOU_EDITOR}/series-approved`,
    title: 'Series đã được duyệt',
    description: 'Giai đoạn 2 — series đã EB-approved, duyệt chapter để publish.',
    icon: 'file',
  },
  {
    id: 'publication-status',
    path: `${PATH_TANTOU_EDITOR}/publication-status`,
    title: 'Trạng thái phát hành',
    description: 'Cập nhật ongoing / hiatus / completed / dropped.',
    icon: 'book',
  },
  {
    id: 'history',
    path: `${PATH_TANTOU_EDITOR}/history`,
    title: 'Lịch sử duyệt',
    description: 'Các lần lưu hoặc gửi nhận xét gần đây.',
    icon: 'history',
  },
  {
    id: 'schedule',
    path: `${PATH_TANTOU_EDITOR}/schedule`,
    title: 'Lịch phát hành',
    description: 'Đặt lịch weekly / monthly cho series đã qua Editor Board.',
    icon: 'calendar',
  },
]

export const TANTOU_SECTION_IDS = TANTOU_SECTIONS.map((s) => s.id)

export function getTantouSection(id) {
  return TANTOU_SECTIONS.find((s) => s.id === id) ?? null
}
