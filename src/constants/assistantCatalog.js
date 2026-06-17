/** Danh sách Assistant có trên hệ thống (demo). userId gắn tài khoản đăng ký thật. */

export const ASSISTANT_SPECIALTIES = [
  { value: 'background', label: 'Vẽ nền' },
  { value: 'shading', label: 'Tô bóng' },
  { value: 'fx', label: 'Hiệu ứng' },
  { value: 'other', label: 'Khác' },
]

export const ASSISTANT_STYLES = [
  { value: 'manga', label: 'Manga' },
  { value: 'semi', label: 'Bán thực tế' },
  { value: 'action', label: 'Action' },
  { value: 'slice', label: 'Slice of life' },
  { value: 'chibi', label: 'Chibi' },
]

export const ASSISTANT_CATALOG = [
  {
    id: 'asst-demo',
    accountId: '6a27d5d41725192a4826edba',
    name: 'Demo Assistant',
    handle: '@demo_assistant',
    avatarColor: '#8b5cf6',
    initials: 'DA',
    bio: 'Trợ lý demo — nhận draft, vẽ nền & hiệu ứng, phản hồi nhanh trong ngày.',
    specialties: ['background', 'fx'],
    style: 'manga',
    rating: 4.9,
    completedPages: 186,
    responseTime: '< 12h',
    languages: ['VI', 'JP'],
    timezone: 'GMT+7',
  },
  {
    id: 'asst-1',
    name: 'Minh Anh',
    handle: '@minhanh_bg',
    avatarColor: '#0ea5e9',
    initials: 'MA',
    bio: 'Chuyên nền đô thị, hoàng hôn và cảnh mưa — từng làm background cho 3 series webtoon.',
    specialties: ['background'],
    style: 'semi',
    rating: 4.8,
    completedPages: 412,
    responseTime: '< 24h',
    languages: ['VI'],
    timezone: 'GMT+7',
  },
  {
    id: 'asst-2',
    name: 'Kenji Sato',
    handle: '@kenji_fx',
    avatarColor: '#f97316',
    initials: 'KS',
    bio: 'Hiệu ứng tốc độ, khói, lửa và impact frame — thích hợp action shonen.',
    specialties: ['fx', 'shading'],
    style: 'action',
    rating: 4.7,
    completedPages: 298,
    responseTime: '< 36h',
    languages: ['VI', 'EN'],
    timezone: 'GMT+7',
  },
  {
    id: 'asst-3',
    name: 'Lan Phương',
    handle: '@lanp_shading',
    avatarColor: '#ec4899',
    initials: 'LP',
    bio: 'Tô bóng nhân vật & đạo cụ, giữ nét gốc Mangaka, tone ấm slice-of-life.',
    specialties: ['shading'],
    style: 'slice',
    rating: 4.9,
    completedPages: 521,
    responseTime: '< 18h',
    languages: ['VI'],
    timezone: 'GMT+7',
  },
  {
    id: 'asst-4',
    name: 'Hiro Tan',
    handle: '@hirotan',
    avatarColor: '#14b8a6',
    initials: 'HT',
    bio: 'All-rounder: nền + tô bóng nhẹ, làm việc theo brief chi tiết từ Mangaka.',
    specialties: ['background', 'shading', 'other'],
    style: 'manga',
    rating: 4.6,
    completedPages: 167,
    responseTime: '< 48h',
    languages: ['VI', 'JP'],
    timezone: 'GMT+7',
  },
  {
    id: 'asst-5',
    name: 'Quỳnh Nhi',
    handle: '@qnhi_chibi',
    avatarColor: '#a855f7',
    initials: 'QN',
    bio: 'Mini panel, sticker và chibi reaction — phù hợp comedy & 4-koma.',
    specialties: ['other', 'fx'],
    style: 'chibi',
    rating: 4.5,
    completedPages: 89,
    responseTime: '< 24h',
    languages: ['VI'],
    timezone: 'GMT+7',
  },
  {
    id: 'asst-6',
    name: 'Đức Thịnh',
    handle: '@ducthinh_bg',
    avatarColor: '#6366f1',
    initials: 'ĐT',
    bio: 'Nền thiên nhiên, rừng và fantasy map — layer PSD gọn, dễ chỉnh.',
    specialties: ['background'],
    style: 'semi',
    rating: 4.8,
    completedPages: 334,
    responseTime: '< 30h',
    languages: ['VI', 'EN'],
    timezone: 'GMT+7',
  },
  {
    id: 'asst-7',
    name: 'Yuki Mori',
    handle: '@yukimori',
    avatarColor: '#ef4444',
    initials: 'YM',
    bio: 'Composite & clean-up cuối trang trước khi gửi Tantou — kỹ line art.',
    specialties: ['shading', 'fx'],
    style: 'manga',
    rating: 4.7,
    completedPages: 245,
    responseTime: '< 20h',
    languages: ['JP', 'VI'],
    timezone: 'GMT+9',
  },
]

export function getAssistantById(id) {
  return ASSISTANT_CATALOG.find(a => a.id === id) ?? null
}

export function getAssistantByUserId(userId) {
  return ASSISTANT_CATALOG.find(a => a.userId === userId) ?? null
}

export function specialtyLabel(value) {
  return ASSISTANT_SPECIALTIES.find(s => s.value === value)?.label ?? value
}

export function styleLabel(value) {
  return ASSISTANT_STYLES.find(s => s.value === value)?.label ?? value
}
