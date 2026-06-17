import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Clock,
  Filter,
  Globe,
  Search,
  Send,
  Sparkles,
  Star,
  UserCheck,
  Users,
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

const AVAILABILITY_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'available', label: 'Có thể thuê' },
  { value: 'mine', label: 'Đội của tôi' },
  { value: 'pending', label: 'Đang chờ' },
]

const AVAILABILITY_BADGE = {
  available: { label: 'Sẵn sàng', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
  mine: { label: 'Đội của bạn', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400' },
  pending: { label: 'Chờ phản hồi', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  unavailable: { label: 'Chưa liên kết tài khoản', className: 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-500/15 dark:text-zinc-400' },
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

function AssistantProfileCard({ profile, onHire }) {
  const badge = AVAILABILITY_BADGE[profile.availability] ?? AVAILABILITY_BADGE.available
  const canHire = profile.availability === 'available'

  return (
    <Card
      className={cn(
        'flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md',
        profile.availability === 'mine' && 'ring-1 ring-violet-500/30',
      )}
    >
      <div className="flex flex-1 flex-col p-5 pb-4">
        <div className="flex min-h-[92px] gap-3">
          <AssistantAvatar profile={profile} size="lg" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight">{profile.name}</p>
            <Badge className={cn('mt-1.5 w-fit', badge.className)}>{badge.label}</Badge>
            <p className="mt-1 truncate text-sm text-muted-foreground">{profile.handle}</p>
            <div className="mt-2 flex h-5 items-center gap-1 text-xs text-muted-foreground">
              {profile.rating > 0 ? (
                <>
                  <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" />
                  <strong className="text-amber-600">{profile.rating}</strong>
                  <span>· {profile.completedPages} trang</span>
                </>
              ) : (
                <span className="truncate">{profile.email || profile.handle}</span>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 line-clamp-2 h-10 text-sm leading-5 text-muted-foreground">
          {profile.bio}
        </p>

        <div className="mt-3 flex h-14 flex-wrap content-start gap-1.5 overflow-hidden">
          {profile.specialties.map(s => (
            <Badge key={s} variant="secondary" className="h-6 shrink-0 text-[10px]">
              {specialtyLabel(s)}
            </Badge>
          ))}
          <Badge variant="outline" className="h-6 shrink-0 text-[10px]">
            {styleLabel(profile.style)}
          </Badge>
        </div>

        <div className="mt-auto grid h-8 grid-cols-2 items-center gap-2 pt-3 text-[11px] text-muted-foreground">
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

  const [query, setQuery] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const [styleFilter, setStyleFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
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

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-500/10 via-background to-rose-500/5 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-2">
            <Badge variant="outline" className="gap-1 border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300">
              <Sparkles className="size-3" />
              Thuê Assistant
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Chọn trợ lý phù hợp</h2>
            <p className="text-sm text-muted-foreground">
              Một Mangaka có thể thuê nhiều Assistant. Một Assistant cũng có thể làm việc cho nhiều Mangaka —
              sau khi chấp nhận, tên sẽ xuất hiện sẵn khi giao việc ở tab Upload & Ghi chú.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Trên hệ thống', value: stats.total, icon: Users },
              { label: 'Có thể thuê', value: stats.available, icon: UserCheck },
              { label: 'Đội của bạn', value: stats.team, icon: CheckCircle2 },
              { label: 'Đang chờ', value: stats.pending, icon: Clock },
            ].map(item => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="flex min-h-[76px] flex-col justify-between rounded-xl border bg-card/80 px-3 py-3 backdrop-blur"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <div className="text-2xl font-bold leading-none">{item.value}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" />
                Đội Assistant
              </CardTitle>
              <CardDescription>Đã chốt hợp tác (API)</CardDescription>
            </CardHeader>
            <CardContent className="min-h-[120px] flex-1">
              {roster.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Chưa có Assistant — gửi yêu cầu thuê và chờ họ chấp nhận.
                </p>
              ) : (
                <ScrollArea className="max-h-72 pr-2">
                  <ul className="space-y-2">
                    {roster.map(r => (
                      <li
                        key={r.assistantId}
                        className="flex h-14 items-center gap-3 rounded-lg border px-3"
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
                        <Badge variant="secondary" className="shrink-0 text-[10px]">Active</Badge>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {pendingRequests.length > 0 ? (
            <Card className="border-amber-200/60 bg-amber-50/30 dark:border-amber-500/20 dark:bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Yêu cầu đang chờ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingRequests.map(r => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-0.5 rounded-lg border bg-background/80 px-3 py-2 text-sm"
                  >
                    <strong className="truncate">{r.assistantName}</strong>
                    <span className="text-[11px] text-muted-foreground">{requestStatusLabel(r.status)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </aside>

        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 pl-9"
                  placeholder="Tìm tên, handle, mô tả..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[480px]">
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
                <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                  <SelectTrigger className="h-10 w-full">
                    <Filter className="mr-1 size-3.5 opacity-60" />
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_FILTERS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Đang tải danh sách Assistant...
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Không có Assistant phù hợp bộ lọc — thử đổi từ khóa hoặc filter.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
              {filtered.map(profile => (
                <AssistantProfileCard
                  key={profile.id}
                  profile={profile}
                  onHire={openHireDialog}
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
