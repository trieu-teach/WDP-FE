import { PATH_TANTOU_EDITOR } from '@/constants/roleTerminology.js'

/** Các khu vực làm việc Tantou (UI hub → trang riêng). */
export const TANTOU_SECTIONS = [
  {
    id: 'series-pending',
    path: `${PATH_TANTOU_EDITOR}/series-pending`,
    title: 'Series chưa được duyệt',
    description: 'Duyệt series mới từ Mangaka, nhận xét và chuyển sang bước tiếp theo.',
    icon: 'sparkles',
  },
  {
    id: 'series-approved',
    path: `${PATH_TANTOU_EDITOR}/series-approved`,
    title: 'Series đã được duyệt',
    description: 'Series đã được Hội đồng chấp nhận — duyệt từng chapter để phát hành.',
    icon: 'file',
  },
  {
    id: 'publication-status',
    path: `${PATH_TANTOU_EDITOR}/publication-status`,
    title: 'Trạng thái phát hành',
    description: 'Cập nhật đang phát hành, tạm ngưng, hoàn thành hoặc bị drop.',
    icon: 'book',
  },
  {
    id: 'history',
    path: `${PATH_TANTOU_EDITOR}/history`,
    title: 'Lịch sử duyệt',
    description: 'Xem lại các lần lưu nháp hoặc gửi nhận xét gần đây.',
    icon: 'history',
  },
  {
    id: 'schedule',
    path: `${PATH_TANTOU_EDITOR}/schedule`,
    title: 'Lịch phát hành',
    description: 'Theo dõi và đặt lịch phát hành theo tuần hoặc theo tháng.',
    icon: 'calendar',
  },
]

export const TANTOU_SECTION_IDS = TANTOU_SECTIONS.map((s) => s.id)

export function getTantouSection(id) {
  return TANTOU_SECTIONS.find((s) => s.id === id) ?? null
}
