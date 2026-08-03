import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Clock,
  Globe,
  HandCoins,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Star,
  Users,
  UserSearch,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  ASSISTANT_SPECIALTIES,
  ASSISTANT_STYLES,
  specialtyLabel,
  styleLabel,
} from '@/constants/assistantCatalog.js'
import { useMangakaCooperation } from '@/hooks/useMangakaCooperation.js'
import { getApiErrorMessage } from '@/api/http.js'
import { isPendingRequest, requestStatusLabel } from '@/utils/cooperationMappers.js'

const AVAILABILITY_CHIPS = [
  { value: 'available', label: 'Có thể thuê' },
  { value: 'mine', label: 'Đội tôi' },
  { value: 'pending', label: 'Đang chờ' },
  { value: 'all', label: 'Tất cả' },
]

const AVAILABILITY_BADGE = {
  available: {
    label: 'Sẵn sàng',
    className:
      'border-emerald-200/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  mine: {
    label: 'Đang hợp tác',
    className:
      'border-violet-200/80 bg-violet-50 text-violet-800 hover:bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
  },
  pending: {
    label: 'Chờ phản hồi',
    className:
      'border-amber-200/80 bg-amber-50 text-amber-900 hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  },
  unavailable: {
    label: 'Chưa liên kết',
    className:
      'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-400',
  },
}

const SPECIALTY_BADGE = {
  background: 'border-sky-200/70 bg-sky-50 text-sky-800 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300',
  shading: 'border-fuchsia-200/70 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
  fx: 'border-orange-200/70 bg-orange-50 text-orange-800 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300',
  other: 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-500/25 dark:bg-zinc-500/10 dark:text-zinc-300',
}

const DEFAULT_FILTERS = {
  query: '',
  specialtyFilter: 'all',
  styleFilter: 'all',
  availabilityFilter: 'available',
}

const DEFAULT_ASSISTANT_BIO = 'Assistant đã đăng ký trên hệ thống.'

function truncateHandle(handle, max = 18) {
  const value = String(handle ?? '').trim()
  if (!value) return '@assistant'
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(1, max - 1))}…`
}

function formatRateLabel(profile) {
  if (profile?.rateLabel) return String(profile.rateLabel)
  if (profile?.ratePerChapter != null && profile.ratePerChapter !== '') {
    return `${profile.ratePerChapter}/chương`
  }
  if (profile?.hourlyRate != null && profile.hourlyRate !== '') {
    return `${profile.hourlyRate}/giờ`
  }
  return null
}

function AssistantAvatar({ profile, size = 'default', className }) {
  return (
    <Avatar size={size} className={cn('ring-2 ring-background', className)}>
      <AvatarFallback
        className="text-sm font-semibold text-white"
        style={{ background: profile.avatarColor }}
      >
        {profile.initials}
      </AvatarFallback>
    </Avatar>
  )
}

function ActionButton({ profile }) {
  if (profile.availability === 'pending') {
    return (
      <Button
        className="h-9 w-full rounded-lg"
        size="sm"
        variant="secondary"
        disabled
      >
        <span className="mk-pulse" aria-hidden />
        Đang chờ phản hồi
      </Button>
    )
  }
  if (profile.availability === 'mine') {
    return (
      <Button className="h-9 w-full rounded-lg" size="sm" variant="outline" disabled>
        <CheckCircle2 className="size-3.5" />
        Đã trong đội
      </Button>
    )
  }
  return (
    <Button className="h-9 w-full rounded-lg" size="sm" variant="outline" disabled>
      Chưa có tài khoản hệ thống
    </Button>
  )
}

function AssistantCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-xl p-0 shadow-sm">
      <div className="h-1 animate-pulse bg-muted" />
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="size-12 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="h-9 animate-pulse rounded-lg bg-muted" />
      </div>
    </Card>
  )
}

function AssistantProfileCard({ profile, onHire, highlighted = false, entranceDelayMs = 0 }) {
  const badge = AVAILABILITY_BADGE[profile.availability] ?? AVAILABILITY_BADGE.available
  const canHire = profile.availability === 'available'
  const accent = profile.avatarColor ?? '#e63946'
  const rateLabel = formatRateLabel(profile)

  const bioText = String(profile.bio ?? '').trim()
  const hasRealBio = bioText && bioText !== DEFAULT_ASSISTANT_BIO
  const specialties = Array.isArray(profile.specialties) ? profile.specialties : []
  const hasSpecialties = specialties.length > 0
  const hasCustomStyle = Boolean(profile.style) && profile.style !== 'manga'
  const responseTime = String(profile.responseTime ?? '').trim()
  const hasResponseTime = responseTime && responseTime !== '—'
  const languages = Array.isArray(profile.languages) ? profile.languages.filter(Boolean) : []
  const hasLanguages = languages.length > 1 || (languages.length === 1 && languages[0] !== 'VI')
  const hasRating = Number(profile.rating) > 0
  const displayHandle = truncateHandle(profile.handle)

  return (
    <Card
      id={profile.accountId ? `assistant-${profile.accountId}` : `assistant-${profile.id}`}
      style={{ animationDelay: `${entranceDelayMs}ms` }}
      className={cn(
        'group relative flex h-full flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md',
        profile.availability === 'mine' && 'ring-1 ring-violet-400/30',
        highlighted && 'ring-2 ring-primary/70 shadow-md',
      )}
    >
      <div
        className="absolute inset-x-0 top-0 z-10 h-1"
        style={{ background: accent }}
      />

      <div className="flex flex-1 flex-col gap-3.5 p-5 pb-4 pt-6">
        <div className="flex items-start gap-3">
          <AssistantAvatar
            profile={profile}
            size="lg"
            className="size-12 shrink-0 text-sm shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <p
                className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold leading-snug tracking-tight text-foreground"
                title={profile.name}
              >
                {profile.name}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  'mt-0.5 h-6 shrink-0 rounded-md px-2 text-[11px] font-medium',
                  badge.className,
                  profile.availability === 'pending' && 'gap-1',
                )}
              >
                {profile.availability === 'pending' ? (
                  <span className="mk-pulse" aria-hidden />
                ) : null}
                {badge.label}
              </Badge>
            </div>
            <p
              className="mt-1 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400"
              title={profile.handle}
            >
              {displayHandle}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              {hasRating ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" />
                  <strong className="tabular-nums text-amber-700 dark:text-amber-400">
                    {profile.rating}
                  </strong>
                </span>
              ) : null}
              {profile.completedPages > 0 ? (
                <span className="tabular-nums">{profile.completedPages} trang</span>
              ) : null}
              {rateLabel ? (
                <span className="inline-flex items-center gap-1 font-medium text-zinc-600 dark:text-zinc-300">
                  <HandCoins className="size-3 shrink-0" />
                  {rateLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {hasRealBio ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {bioText}
          </p>
        ) : null}

        {(hasSpecialties || hasCustomStyle) ? (
          <div className="flex flex-wrap gap-1.5">
            {specialties.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className={cn(
                  'h-6 rounded-md px-2 text-[11px] font-medium',
                  SPECIALTY_BADGE[s] ?? SPECIALTY_BADGE.other,
                )}
              >
                {specialtyLabel(s)}
              </Badge>
            ))}
            {hasCustomStyle ? (
              <Badge
                variant="outline"
                className="h-6 rounded-md border-zinc-200 bg-white px-2 text-[11px] text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300"
              >
                {styleLabel(profile.style)}
              </Badge>
            ) : null}
          </div>
        ) : null}

        {(hasResponseTime || hasLanguages) ? (
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {hasResponseTime ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Clock className="size-3 shrink-0" />
                <span className="truncate">{responseTime}</span>
              </span>
            ) : <span />}
            {hasLanguages ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Globe className="size-3 shrink-0" />
                <span className="truncate">{languages.join(' · ')}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <CardFooter className="shrink-0 border-t border-border/70 bg-muted/20 p-4 pt-3">
        {canHire ? (
          <Button
            className="h-9 w-full rounded-lg border-rose-200/80 text-rose-700 hover:border-rose-600 hover:bg-rose-600 hover:text-white dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white"
            size="sm"
            variant="outline"
            onClick={() => onHire(profile)}
          >
            <Send className="size-3.5" />
            Gửi yêu cầu thuê
          </Button>
        ) : (
          <ActionButton profile={profile} />
        )}
      </CardFooter>
    </Card>
  )
}

export default function MangakaAssistants() {
  const {
    roster,
    sentRequests,
    catalog,
    loading,
    sendHireRequest,
    refresh,
  } = useMangakaCooperation()

  const [query, setQuery] = useState(DEFAULT_FILTERS.query)
  const [specialtyFilter, setSpecialtyFilter] = useState(DEFAULT_FILTERS.specialtyFilter)
  const [styleFilter, setStyleFilter] = useState(DEFAULT_FILTERS.styleFilter)
  const [availabilityFilter, setAvailabilityFilter] = useState(DEFAULT_FILTERS.availabilityFilter)
  const [spotlightAssistantId, setSpotlightAssistantId] = useState(null)
  const [hireTarget, setHireTarget] = useState(null)
  const [hireNote, setHireNote] = useState('')
  const [manualAssistantId, setManualAssistantId] = useState('')
  const [sending, setSending] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.filter(a => {
      if (specialtyFilter !== 'all' && !a.specialties.includes(specialtyFilter)) return false
      if (styleFilter !== 'all' && a.style !== styleFilter) return false
      if (availabilityFilter !== 'all' && a.availability !== availabilityFilter) return false
      if (!q) return true
      const hay = `${a.name} ${a.handle} ${a.bio} ${styleLabel(a.style)}`.toLowerCase()
      return hay.includes(q)
    })
  }, [catalog, query, specialtyFilter, styleFilter, availabilityFilter])

  const stats = useMemo(() => ({
    total: catalog.length,
    available: catalog.filter(a => a.availability === 'available').length,
    team: roster.length,
    pending: catalog.filter(a => a.availability === 'pending').length,
  }), [catalog, roster.length])

  const pendingRequests = useMemo(
    () => sentRequests.filter(r => isPendingRequest(r.status) || r.status === 'accepted_meet'),
    [sentRequests],
  )

  const hasActiveFilters =
    query.trim() !== ''
    || specialtyFilter !== 'all'
    || styleFilter !== 'all'
    || availabilityFilter !== DEFAULT_FILTERS.availabilityFilter

  function clearFilters() {
    setQuery(DEFAULT_FILTERS.query)
    setSpecialtyFilter(DEFAULT_FILTERS.specialtyFilter)
    setStyleFilter(DEFAULT_FILTERS.styleFilter)
    setAvailabilityFilter(DEFAULT_FILTERS.availabilityFilter)
    setSpotlightAssistantId(null)
  }

  function focusAssistant(assistantId, availability = 'all') {
    const id = String(assistantId)
    setSpotlightAssistantId(id)
    setAvailabilityFilter(availability)
    setQuery('')
    requestAnimationFrame(() => {
      document.getElementById(`assistant-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function openHireDialog(profile) {
    if (profile.availability !== 'available') return
    setHireTarget(profile)
    setHireNote('')
  }

  async function submitHireRequest() {
    if (!hireTarget) return
    const assistantId = hireTarget.accountId ?? manualAssistantId.trim()
    if (!assistantId) {
      toast.error('Assistant chưa có user ID trên hệ thống — nhập Assistant User ID.')
      return
    }
    setSending(true)
    try {
      await sendHireRequest({ assistantId, message: hireNote })
      toast.success(`Đã gửi yêu cầu hợp tác cho ${hireTarget.name} — chờ Assistant phản hồi.`)
      setHireTarget(null)
      setManualAssistantId('')
      void refresh()
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không gửi được yêu cầu.'))
    } finally {
      setSending(false)
    }
  }

  const chipCount = useMemo(() => ({
    available: catalog.filter(a => a.availability === 'available').length,
    mine: catalog.filter(a => a.availability === 'mine').length,
    pending: catalog.filter(a => a.availability === 'pending').length,
    all: catalog.length,
  }), [catalog])

  return (
    <div className="mk-assistants space-y-6">
      <header className="space-y-4 border-b border-border/50 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
              <Sparkles className="size-4" />
              Thuê Assistant
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Chọn trợ lý phù hợp
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Sau khi chốt hợp tác, Assistant xuất hiện sẵn khi giao chapter ở tab Upload &amp; Ghi chú.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Có thể thuê
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {stats.available}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAvailabilityFilter('mine')
              setSpotlightAssistantId(null)
            }}
            className="rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left shadow-sm transition-colors hover:border-violet-300/70 hover:bg-violet-50/40 dark:hover:bg-violet-500/10"
          >
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <Users className="size-3" />
              Đội tôi
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-violet-700 dark:text-violet-300">
              {stats.team}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setAvailabilityFilter('pending')
              setSpotlightAssistantId(null)
            }}
            className="rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left shadow-sm transition-colors hover:border-amber-300/70 hover:bg-amber-50/40 dark:hover:bg-amber-500/10"
          >
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <Clock className="size-3" />
              Đang chờ
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              {stats.pending}
            </p>
          </button>
          <div className="rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Tổng hệ thống
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {stats.total}
            </p>
          </div>
        </div>

        {pendingRequests.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/50 px-3.5 py-2.5 dark:border-amber-500/25 dark:bg-amber-500/10">
            <Clock className="size-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
              {pendingRequests.length} yêu cầu đang chờ phản hồi
            </p>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 sm:justify-end">
              {pendingRequests.slice(0, 3).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => focusAssistant(r.assistantId, 'pending')}
                  className="max-w-[10rem] truncate rounded-md border border-amber-200/80 bg-white/80 px-2 py-1 text-[11px] font-medium text-amber-900 transition-colors hover:bg-white dark:border-amber-500/30 dark:bg-zinc-950/40 dark:text-amber-100"
                  title={`${r.assistantName} · ${requestStatusLabel(r.status)}`}
                >
                  {r.assistantName}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <div className="space-y-4">
        <div className="space-y-3.5 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {AVAILABILITY_CHIPS.map((chip) => {
              const active = availabilityFilter === chip.value
              return (
                <Button
                  key={chip.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    'h-9 rounded-lg gap-1.5 border-border/80 px-3 font-medium transition-all',
                    active
                      ? 'border-rose-600 bg-rose-600 text-white hover:bg-rose-600 hover:text-white dark:border-rose-500 dark:bg-rose-600'
                      : 'bg-background text-zinc-600 hover:bg-muted/60 hover:text-foreground dark:text-zinc-300',
                  )}
                  onClick={() => {
                    setAvailabilityFilter(chip.value)
                    setSpotlightAssistantId(null)
                  }}
                >
                  {chip.label}
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                    )}
                  >
                    {chipCount[chip.value]}
                  </span>
                </Button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1 xl:min-w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                className="h-10 rounded-lg border-border/80 bg-background pl-9 text-sm placeholder:text-zinc-400"
                placeholder="Tìm tên, handle, mô tả…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSpotlightAssistantId(null)
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:w-[340px] xl:shrink-0">
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger className="h-10 w-full rounded-lg border-border/80 bg-background px-3 text-sm text-zinc-700 dark:text-zinc-200">
                  <SelectValue placeholder="Chuyên môn" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi chuyên môn</SelectItem>
                  {ASSISTANT_SPECIALTIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={styleFilter} onValueChange={setStyleFilter}>
                <SelectTrigger className="h-10 w-full rounded-lg border-border/80 bg-background px-3 text-sm text-zinc-700 dark:text-zinc-200">
                  <SelectValue placeholder="Phong cách" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi phong cách</SelectItem>
                  {ASSISTANT_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              Hiển thị <strong className="text-foreground">{filtered.length}</strong>
              {availabilityFilter === 'all' ? ` / ${catalog.length}` : ''} Assistant
            </span>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 rounded-lg text-xs text-zinc-600"
                onClick={clearFilters}
              >
                <RotateCcw className="size-3" />
                Xóa bộ lọc
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <AssistantCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-xl border-dashed shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <UserSearch className="size-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Không có Assistant phù hợp</p>
                <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
                  {availabilityFilter === 'available'
                    ? 'Hiện không có ai sẵn sàng nhận việc — thử xem Đội tôi, Đang chờ hoặc Tất cả.'
                    : 'Thử đổi từ khóa hoặc bộ lọc khác.'}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {availabilityFilter !== 'available' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => setAvailabilityFilter('available')}
                  >
                    Xem có thể thuê
                  </Button>
                ) : null}
                {hasActiveFilters ? (
                  <Button size="sm" variant="secondary" className="rounded-lg" onClick={clearFilters}>
                    Xóa bộ lọc
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((profile, index) => (
              <AssistantProfileCard
                key={profile.id}
                profile={profile}
                onHire={openHireDialog}
                highlighted={
                  spotlightAssistantId != null
                  && String(profile.accountId) === spotlightAssistantId
                }
                entranceDelayMs={Math.min(index, 8) * 40}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!hireTarget} onOpenChange={(open) => !open && setHireTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gửi yêu cầu thuê Assistant</DialogTitle>
            <DialogDescription>
              {hireTarget ? (
                <>
                  Gửi lời mời làm việc cho <strong>{hireTarget.name}</strong>.
                  Assistant có thể đồng thời hợp tác với nhiều Mangaka.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {hireTarget ? (
            <div className="space-y-4 py-2">
              <div className="flex h-16 items-center gap-3 rounded-xl border bg-muted/30 px-3">
                <AssistantAvatar profile={hireTarget} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{hireTarget.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {truncateHandle(hireTarget.handle)}
                  </p>
                </div>
              </div>
              {!hireTarget.accountId ? (
                <div className="space-y-2">
                  <Label>Assistant User ID</Label>
                  <Input
                    className="rounded-lg"
                    placeholder="MongoDB userId của Assistant đã đăng ký"
                    value={manualAssistantId}
                    onChange={(e) => setManualAssistantId(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Lời nhắn (tuỳ chọn)</Label>
                <Textarea
                  rows={3}
                  className="min-h-[88px] resize-none rounded-lg"
                  placeholder="VD: Cần hỗ trợ vẽ nền fantasy, 2 chapter mỗi tuần..."
                  value={hireNote}
                  onChange={(e) => setHireNote(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setHireTarget(null)}>
              Huỷ
            </Button>
            <Button className="rounded-lg" onClick={submitHireRequest} disabled={sending}>
              <Send className="size-3.5" />
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
