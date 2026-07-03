import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Clock,
  Globe,
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
import { ScrollArea } from '@/components/ui/scroll-area'
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
  available: { label: 'Sẵn sàng', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
  mine: { label: 'Đội của bạn', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400' },
  pending: { label: 'Chờ phản hồi', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  unavailable: { label: 'Chưa liên kết tài khoản', className: 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-500/15 dark:text-zinc-400' },
}

const DEFAULT_FILTERS = {
  query: '',
  specialtyFilter: 'all',
  styleFilter: 'all',
  availabilityFilter: 'available',
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
      <Button className="h-9 w-full" size="sm" variant="secondary" disabled>
        <span className="mk-pulse" aria-hidden />
        Đang chờ phản hồi
      </Button>
    )
  }
  if (profile.availability === 'mine') {
    return (
      <Button className="h-9 w-full" size="sm" variant="outline" disabled>
        <CheckCircle2 className="size-3.5" />
        Đã trong đội
      </Button>
    )
  }
  return (
    <Button className="h-9 w-full" size="sm" variant="outline" disabled>
      Chưa có tài khoản hệ thống
    </Button>
  )
}

function AssistantCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 animate-pulse bg-muted" />
      <div className="space-y-4 p-5">
        <div className="flex gap-3">
          <div className="size-12 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-14 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-9 animate-pulse rounded-md bg-muted" />
      </div>
    </Card>
  )
}

function AssistantProfileCard({ profile, onHire, highlighted = false, entranceDelayMs = 0 }) {
  const badge = AVAILABILITY_BADGE[profile.availability] ?? AVAILABILITY_BADGE.available
  const canHire = profile.availability === 'available'
  const accent = profile.avatarColor ?? '#e63946'

  return (
    <Card
      id={profile.accountId ? `assistant-${profile.accountId}` : `assistant-${profile.id}`}
      style={{ animationDelay: `${entranceDelayMs}ms` }}
      className={cn(
        'group relative flex h-full flex-col gap-0 overflow-hidden p-0 transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg',
        profile.availability === 'mine' && 'ring-1 ring-violet-500/35',
        highlighted && 'ring-2 ring-primary shadow-md',
      )}
    >
      <div
        className="absolute inset-x-0 top-0 z-10 h-1"
        style={{ background: accent }}
      />

      <div className="flex flex-1 flex-col p-5 pb-4 pt-6">
        <div className="flex gap-3">
          <AssistantAvatar profile={profile} size="lg" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight">{profile.name}</p>
            <Badge
              className={cn(
                'mt-1.5 w-fit',
                badge.className,
                profile.availability === 'pending' && 'gap-1',
              )}
            >
              {profile.availability === 'pending' ? (
                <span className="mk-pulse" aria-hidden />
              ) : null}
              {badge.label}
            </Badge>
            <p className="mt-1 truncate text-sm text-muted-foreground">{profile.handle}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {profile.rating > 0 ? (
                <>
                  <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" />
                  <strong className="text-amber-600 dark:text-amber-400">{profile.rating}</strong>
                  <span>· {profile.completedPages} trang</span>
                </>
              ) : (
                <span className="truncate">{profile.email || profile.handle}</span>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {profile.bio}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.specialties.map(s => (
            <Badge key={s} variant="secondary" className="h-6 shrink-0 text-xs">
              {specialtyLabel(s)}
            </Badge>
          ))}
          <Badge variant="outline" className="h-6 shrink-0 text-xs">
            {styleLabel(profile.style)}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1">
            <Clock className="size-3 shrink-0" />
            <span className="truncate">{profile.responseTime}</span>
          </span>
          <span className="inline-flex min-w-0 items-center justify-end gap-1">
            <Globe className="size-3 shrink-0" />
            <span className="truncate">{profile.languages.join(' · ')}</span>
          </span>
        </div>
      </div>

      <CardFooter className="shrink-0 border-t bg-muted/20 p-4 pt-3">
        {canHire ? (
          <Button className="h-9 w-full" size="sm" onClick={() => onHire(profile)}>
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
    <div className="mk-assistants space-y-5">
      <header className="space-y-3 border-b border-border/60 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="size-4" />
              Thuê Assistant
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Chọn trợ lý phù hợp</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Sau khi chốt hợp tác, Assistant xuất hiện sẵn khi giao chapter ở tab Upload &amp; Ghi chú.
            </p>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {stats.total} trên hệ thống
            <span className="mx-1.5 text-border">·</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{stats.available} có thể thuê</span>
            <span className="mx-1.5 text-border">·</span>
            {stats.team} trong đội
            <span className="mx-1.5 text-border">·</span>
            {stats.pending} đang chờ
          </p>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card className="flex flex-col shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" />
                Đội Assistant
              </CardTitle>
              <CardDescription>Đã chốt hợp tác</CardDescription>
            </CardHeader>
            <CardContent className="min-h-[100px] flex-1">
              {roster.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Chưa có Assistant — gửi yêu cầu thuê và chờ họ chấp nhận.
                </p>
              ) : (
                <ScrollArea className="max-h-72 pr-2">
                  <ul className="space-y-2">
                    {roster.map(r => {
                      const active = spotlightAssistantId === String(r.assistantId)
                      return (
                        <li key={r.assistantId}>
                          <button
                            type="button"
                            onClick={() => focusAssistant(r.assistantId, 'mine')}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                              'hover:border-primary/30 hover:bg-muted/50',
                              active && 'border-primary/40 bg-primary/5 ring-1 ring-primary/20',
                            )}
                          >
                            <Avatar size="sm" className="shrink-0">
                              <AvatarFallback
                                className="text-[10px] font-semibold text-white"
                                style={{ background: r.avatarColor ?? '#8b5cf6' }}
                              >
                                {r.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{r.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{r.handle ?? 'Assistant'}</p>
                            </div>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">Đang hợp tác</Badge>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {pendingRequests.length > 0 ? (
            <Card className="border-amber-200/60 bg-amber-50/30 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="size-3.5 text-amber-600" />
                  Yêu cầu đang chờ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingRequests.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => focusAssistant(r.assistantId, 'pending')}
                    className="flex w-full flex-col gap-0.5 rounded-lg border bg-background/80 px-3 py-2 text-left text-sm transition-colors hover:border-amber-300/60 hover:bg-background"
                  >
                    <strong className="truncate">{r.assistantName}</strong>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="mk-pulse" aria-hidden />
                      {requestStatusLabel(r.status)}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="space-y-3 rounded-lg border bg-card/50 p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_CHIPS.map(chip => (
                <Button
                  key={chip.value}
                  type="button"
                  size="sm"
                  variant={availabilityFilter === chip.value ? 'default' : 'outline'}
                  className="h-8 gap-1.5 transition-all"
                  onClick={() => {
                    setAvailabilityFilter(chip.value)
                    setSpotlightAssistantId(null)
                  }}
                >
                  {chip.label}
                  <span className={cn(
                    'rounded-full px-1.5 py-0 text-[10px] tabular-nums',
                    availabilityFilter === chip.value
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {chipCount[chip.value]}
                  </span>
                </Button>
              ))}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 pl-9"
                  placeholder="Tìm tên, handle, mô tả..."
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value)
                    setSpotlightAssistantId(null)
                  }}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[320px]">
                <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Chuyên môn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Mọi chuyên môn</SelectItem>
                    {ASSISTANT_SPECIALTIES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={styleFilter} onValueChange={setStyleFilter}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Phong cách" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Mọi phong cách</SelectItem>
                    {ASSISTANT_STYLES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Hiển thị <strong className="text-foreground">{filtered.length}</strong>
                {availabilityFilter === 'all' ? ` / ${catalog.length}` : ''} Assistant
              </span>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={clearFilters}
                >
                  <RotateCcw className="size-3" />
                  Xóa bộ lọc
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <AssistantCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed shadow-sm">
              <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <UserSearch className="size-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Không có Assistant phù hợp</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {availabilityFilter === 'available'
                      ? 'Hiện không có ai sẵn sàng nhận việc — thử xem Đội tôi, Đang chờ hoặc Tất cả.'
                      : 'Thử đổi từ khóa hoặc bộ lọc khác.'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {availabilityFilter !== 'available' ? (
                    <Button size="sm" variant="outline" onClick={() => setAvailabilityFilter('available')}>
                      Xem có thể thuê
                    </Button>
                  ) : null}
                  {hasActiveFilters ? (
                    <Button size="sm" variant="secondary" onClick={clearFilters}>
                      Xóa bộ lọc
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
              {filtered.map((profile, index) => (
                <AssistantProfileCard
                  key={profile.id}
                  profile={profile}
                  onHire={openHireDialog}
                  highlighted={spotlightAssistantId != null && String(profile.accountId) === spotlightAssistantId}
                  entranceDelayMs={Math.min(index, 8) * 40}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!hireTarget} onOpenChange={open => !open && setHireTarget(null)}>
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
              <div className="flex h-16 items-center gap-3 rounded-lg border bg-muted/30 px-3">
                <AssistantAvatar profile={hireTarget} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{hireTarget.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{hireTarget.handle}</p>
                </div>
              </div>
              {!hireTarget.accountId ? (
                <div className="space-y-2">
                  <Label>Assistant User ID</Label>
                  <Input
                    placeholder="MongoDB userId của Assistant đã đăng ký"
                    value={manualAssistantId}
                    onChange={e => setManualAssistantId(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Lời nhắn (tuỳ chọn)</Label>
                <Textarea
                  rows={3}
                  className="min-h-[88px] resize-none"
                  placeholder="VD: Cần hỗ trợ vẽ nền fantasy, 2 chapter mỗi tuần..."
                  value={hireNote}
                  onChange={e => setHireNote(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHireTarget(null)}>Huỷ</Button>
            <Button onClick={submitHireRequest} disabled={sending}>
              <Send className="size-3.5" />
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
