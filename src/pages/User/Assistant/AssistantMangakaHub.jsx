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
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'sent',
    title: 'Đã gửi',
    description: 'Chờ duyệt & đã xong',
    icon: Send,
    iconClass: 'text-sky-600 dark:text-sky-400',
  },
  {
    key: 'revision',
    title: 'Yêu cầu làm lại',
    description: 'Mangaka cần chỉnh sửa',
    icon: PenLine,
    iconClass: 'text-rose-600 dark:text-rose-400',
  },
]

function taskStatusMeta(status) {
  switch (status) {
    case 'pending':
      return { label: 'Chờ nhận', className: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25' }
    case 'in_progress':
      return { label: 'Đang làm', className: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25' }
    case 'submitted':
      return { label: 'Đã gửi', className: 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/25' }
    case 'approved':
      return { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25' }
    case 'revision':
      return { label: 'Cần sửa', className: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25' }
    default:
      return status
        ? { label: status, className: 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' }
        : null
  }
}

function MangakaAvatar({ id, name, size = 'lg' }) {
  const color = mangakaAvatarColor(id)
  return (
    <Avatar
      size={size}
      className="ring-2 ring-white shadow-sm dark:ring-zinc-900"
    >
      <AvatarFallback
        className="text-sm font-bold"
        style={{
          background: `${color}22`,
          color,
        }}
      >
        {mangakaInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

function ChapterWorkCard({ chapter, onSelect, highlight }) {
  const coverUrl = chapter.coverUrl ?? null
  const pageCount = chapter.pageCount ?? chapter.pages?.length ?? 0
  const status = chapter._task?.status
  const statusMeta = taskStatusMeta(status)

  return (
    <button
      type="button"
      onClick={() => onSelect(chapter)}
      className={cn(
        'group mb-3 flex w-full cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm',
        'transition-all duration-150 hover:border-gray-200 hover:shadow-md',
        'dark:border-zinc-800 dark:bg-card dark:hover:border-zinc-700',
        highlight && 'border-red-100 ring-1 ring-red-100 dark:border-red-500/30 dark:ring-red-500/20',
      )}
    >
      <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-100 dark:border-zinc-700 dark:bg-zinc-800">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <ImageIcon className="size-4 text-gray-400" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 block text-sm font-semibold text-gray-900 dark:text-zinc-50">
          {chapter.seriesTitle?.trim() || 'Chapter'}
        </span>
        <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-zinc-400">
          Ch.{chapter.chapterNum}
          {chapter.title ? ` · ${chapter.title}` : ''}
          {' · '}{pageCount} trang
        </span>
        {statusMeta ? (
          <span
            className={cn(
              'mt-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
              statusMeta.className,
            )}
          >
            {statusMeta.label}
          </span>
        ) : null}
      </span>
      <ArrowRight className="mt-1 size-4 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

function WorkColumn({ config, items, onSelectChapter }) {
  const Icon = config.icon
  return (
    <div className="as-mangaka-board__column flex flex-col rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Icon className={cn('size-4 shrink-0', config.iconClass)} />
          <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-50">{config.title}</h3>
          <span className="rounded-full bg-gray-200/80 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-gray-700 dark:bg-zinc-700 dark:text-zinc-200">
            {items.length}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{config.description}</p>
      </div>
      <div className="as-mangaka-board__scroll max-h-[calc(100vh-220px)] flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center dark:border-zinc-700">
            <CheckCircle2 className="mb-2 size-5 text-gray-300 dark:text-zinc-600" />
            <p className="text-xs text-gray-500 dark:text-zinc-400">Chưa có chapter</p>
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
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-50">
            Chọn Mangaka
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="overflow-hidden rounded-2xl border-gray-100">
              <CardContent className="space-y-4 p-6">
                <div className="size-12 animate-pulse rounded-full bg-muted" />
                <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="h-14 animate-pulse rounded-lg bg-muted" />
                  <div className="h-14 animate-pulse rounded-lg bg-muted" />
                  <div className="h-14 animate-pulse rounded-lg bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (mangakas.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-50">
          Chọn Mangaka
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          Chọn Mangaka để xem chapter được giao
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {mangakas.map(m => {
          const list = assignmentsByMangaka.get(m.id) ?? []
          const counts = countMangakaWork(list)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              className="group cursor-pointer text-left"
            >
              <Card
                className={cn(
                  'h-full gap-0 overflow-hidden rounded-2xl border border-gray-100 bg-white py-0 shadow-sm',
                  'transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
                  'dark:border-zinc-800 dark:bg-card',
                )}
              >
                <CardHeader className="space-y-4 p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <MangakaAvatar id={m.id} name={m.name} />
                    <ArrowRight className="mt-1 size-4 shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gray-700 dark:text-zinc-500 dark:group-hover:text-zinc-200" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base font-semibold text-gray-900 dark:text-zinc-50">
                      {m.name}
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                      {counts.total} chapter được giao
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 px-5 pb-5 pt-0">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-2 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                    <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-zinc-50">
                      {counts.received}
                    </p>
                    <p className="text-xs font-medium text-gray-600 dark:text-zinc-400">Nhận</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-2 py-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                    <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-zinc-50">
                      {counts.sent}
                    </p>
                    <p className="text-xs font-medium text-gray-600 dark:text-zinc-400">Đã gửi</p>
                  </div>
                  <div
                    className={cn(
                      'rounded-xl border px-2 py-2.5 text-center',
                      counts.revision > 0
                        ? 'border-red-100 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
                        : 'border-gray-100 bg-gray-50/80 dark:border-zinc-800 dark:bg-zinc-900/50',
                    )}
                  >
                    <p
                      className={cn(
                        'text-lg font-bold tabular-nums',
                        counts.revision > 0
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-gray-900 dark:text-zinc-50',
                      )}
                    >
                      {counts.revision}
                    </p>
                    <p
                      className={cn(
                        'text-xs font-medium',
                        counts.revision > 0
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-gray-600 dark:text-zinc-400',
                      )}
                    >
                      Làm lại
                    </p>
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
    <div className="space-y-0">
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          onClick={onBack}
        >
          <ArrowLeft className="size-3.5" />
          Đổi Mangaka
        </Button>
        <div className="hidden h-8 w-px bg-gray-200 sm:block dark:bg-zinc-700" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <MangakaAvatar id={mangaka.id} name={mangaka.name} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-gray-900 dark:text-zinc-50">
              {mangaka.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
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
