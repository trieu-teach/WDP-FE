import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  Inbox,
  PenLine,
  Send,
  Users,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  countMangakaWork,
  groupAssignmentsByWorkStatus,
  mangakaAvatarColor,
  mangakaInitials,
} from './assistantMangakaHub.js'

const WORK_COLUMNS = [
  {
    key: 'received',
    title: 'Việc nhận',
    description: 'Chờ nhận & đang làm',
    icon: Inbox,
    accent: 'border-amber-200/80 bg-amber-50/40 dark:border-amber-500/25 dark:bg-amber-500/5',
    iconClass: 'text-amber-600 dark:text-amber-400',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  },
  {
    key: 'sent',
    title: 'Đã gửi',
    description: 'Chờ duyệt & đã xong',
    icon: Send,
    accent: 'border-sky-200/80 bg-sky-50/40 dark:border-sky-500/25 dark:bg-sky-500/5',
    iconClass: 'text-sky-600 dark:text-sky-400',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  },
  {
    key: 'revision',
    title: 'Yêu cầu làm lại',
    description: 'Mangaka cần chỉnh sửa',
    icon: PenLine,
    accent: 'border-rose-200/80 bg-rose-50/40 dark:border-rose-500/25 dark:bg-rose-500/5',
    iconClass: 'text-rose-600 dark:text-rose-400',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  },
]

function MangakaAvatar({ id, name, size = 'lg' }) {
  const color = mangakaAvatarColor(id)
  return (
    <Avatar size={size} className="ring-2 ring-background">
      <AvatarFallback className="text-sm font-bold text-white" style={{ background: color }}>
        {mangakaInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

function ChapterWorkCard({ chapter, onSelect, highlight }) {
  const cover = chapter.pages?.find(p => p.url) ?? chapter.pages?.[0]
  const pageCount = chapter.pageCount ?? chapter.pages?.length ?? 0
  const status = chapter._task?.status

  return (
    <button
      type="button"
      onClick={() => onSelect(chapter)}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-all',
        'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md',
        highlight && 'border-primary/40 ring-1 ring-primary/20',
      )}
    >
      <span className="manga-page manga-page--thumb-md shrink-0 overflow-hidden rounded-md border bg-muted">
        {cover?.url ? (
          <img src={cover.url} alt="" className="manga-page__media" />
        ) : (
          <span className="flex h-full items-center justify-center">
            <ImageIcon className="size-4 text-muted-foreground/50" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {chapter.seriesTitle?.trim() || 'Chapter'}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          Ch.{chapter.chapterNum}
          {chapter.title ? ` · ${chapter.title}` : ''}
          {' · '}{pageCount} trang
        </span>
        {status ? (
          <Badge variant="secondary" className="mt-2 h-5 text-[10px]">
            {status === 'pending' && 'Chờ nhận'}
            {status === 'in_progress' && 'Đang làm'}
            {status === 'submitted' && 'Đã gửi'}
            {status === 'approved' && 'Đã duyệt'}
            {status === 'revision' && 'Cần sửa'}
            {!['pending', 'in_progress', 'submitted', 'approved', 'revision'].includes(status) && status}
          </Badge>
        ) : null}
      </span>
      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

function WorkColumn({ config, items, onSelectChapter }) {
  const Icon = config.icon
  return (
    <div className={cn('as-mangaka-board__column flex flex-col rounded-2xl border p-4', config.accent)}>
      <div className="mb-4 shrink-0 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Icon className={cn('size-4', config.iconClass)} />
            <h3 className="text-sm font-semibold">{config.title}</h3>
            <Badge className={cn('h-5 px-1.5 text-[10px]', config.badgeClass)}>{items.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
        </div>
      </div>
      <div className="as-mangaka-board__scroll flex min-h-0 flex-1 flex-col gap-2">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/20 px-4 py-8 text-center">
            <CheckCircle2 className="mb-2 size-5 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">Chưa có chapter</p>
          </div>
        ) : (
          items.map(ch => (
            <ChapterWorkCard
              key={ch.chapterId}
              chapter={ch}
              onSelect={onSelectChapter}
              highlight={ch._task?.status === 'revision'}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function AssistantMangakaPicker({ mangakas, assignmentsByMangaka, loading, onSelect }) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="h-1 animate-pulse bg-muted" />
            <CardContent className="space-y-4 p-6">
              <div className="size-14 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (mangakas.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Users className="size-10 text-muted-foreground/40" />
          <p className="font-medium">Chưa có Mangaka hợp tác</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Chấp nhận yêu cầu hợp tác ở trên — sau đó chapter được giao sẽ hiện tại đây.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Chọn Mangaka</h2>
        <p className="text-sm text-muted-foreground">
          Mỗi Mangaka có danh sách chapter riêng — nhận việc, gửi bài và chỉnh sửa.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mangakas.map(m => {
          const list = assignmentsByMangaka.get(m.id) ?? []
          const counts = countMangakaWork(list)
          const color = mangakaAvatarColor(m.id)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              className="group text-left"
            >
              <Card className="h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="h-1" style={{ background: color }} />
                <CardHeader className="space-y-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <MangakaAvatar id={m.id} name={m.name} />
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{m.name}</CardTitle>
                    <CardDescription>
                      {counts.total} chapter được giao
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 pt-0">
                  <div className="rounded-lg border bg-amber-50/50 px-2 py-2 text-center dark:bg-amber-500/5">
                    <p className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">{counts.received}</p>
                    <p className="text-[10px] text-muted-foreground">Nhận</p>
                  </div>
                  <div className="rounded-lg border bg-sky-50/50 px-2 py-2 text-center dark:bg-sky-500/5">
                    <p className="text-lg font-bold tabular-nums text-sky-700 dark:text-sky-300">{counts.sent}</p>
                    <p className="text-[10px] text-muted-foreground">Đã gửi</p>
                  </div>
                  <div className="rounded-lg border bg-rose-50/50 px-2 py-2 text-center dark:bg-rose-500/5">
                    <p className="text-lg font-bold tabular-nums text-rose-700 dark:text-rose-300">{counts.revision}</p>
                    <p className="text-[10px] text-muted-foreground">Làm lại</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AssistantMangakaBoard({
  mangaka,
  assignments,
  onBack,
  onSelectChapter,
}) {
  const groups = groupAssignmentsByWorkStatus(assignments)
  const columns = {
    received: groups.received,
    sent: groups.sent,
    revision: groups.revision,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          Đổi Mangaka
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <MangakaAvatar id={mangaka.id} name={mangaka.name} />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">{mangaka.name}</h2>
            <p className="text-sm text-muted-foreground">
              {assignments.length} chapter · chọn một mục để mở Layer Editor
            </p>
          </div>
        </div>
      </div>

      <div className="as-mangaka-board grid gap-4 lg:grid-cols-3">
        {WORK_COLUMNS.map(col => (
          <WorkColumn
            key={col.key}
            config={col}
            items={columns[col.key]}
            onSelectChapter={onSelectChapter}
          />
        ))}
      </div>
    </div>
  )
}
