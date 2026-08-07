import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowDownAZ,
  CheckCircle2,
  Coins,
  Loader2,
  Package,
  PencilLine,
  Plus,
  Power,
  RefreshCcw,
  Search,
  Sparkles,
  Wallet,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
import CoinPackageDialog from '@/components/Admin/CoinPackageDialog.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatCoinString, formatCoinStringWithUnit, formatVnd } from '@/utils/coinFormatter.js'

const STATUS_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Đang hoạt động' },
  { id: 'inactive', label: 'Đã vô hiệu hoá' },
]

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CoinPackages() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const [confirmDeactivate, setConfirmDeactivate] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  // Refetch — dùng cho nút "Tải lại" / sau khi save/deactivate.
  const fetchData = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getCoinPackages()
      .then((data) => {
        if (cancelled) return
        setItems(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách gói nạp')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Initial fetch — setState nằm trong .then/.catch callback (async) nên
  // không vi phạm react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    api
      .getCoinPackages()
      .then((data) => {
        if (cancelled) return
        setItems(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách gói nạp')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Sort theo giá VND tăng dần (phụ: createdAt tăng dần → tên vi-VN) — không mutate `items`.
  const sortedItems = useMemo(() => {
    const locale = 'vi'
    return [...items].sort((a, b) => {
      if (a.priceVnd !== b.priceVnd) return a.priceVnd - b.priceVnd
      const aDate = new Date(a.createdAt || 0).getTime()
      const bDate = new Date(b.createdAt || 0).getTime()
      if (aDate !== bDate) return aDate - bDate
      return String(a.name || '').localeCompare(String(b.name || ''), locale)
    })
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sortedItems.filter((p) => {
      if (statusFilter === 'active' && !p.isActive) return false
      if (statusFilter === 'inactive' && p.isActive) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      )
    })
  }, [sortedItems, search, statusFilter])

  const stats = useMemo(() => {
    const active = items.filter((p) => p.isActive).length
    const inactive = items.length - active
    const cheapest = items
      .filter((p) => p.isActive && p.priceVnd > 0)
      .reduce((min, p) => (p.priceVnd < (min?.priceVnd ?? Infinity) ? p : min), null)
    const mostCoin = items
      .filter((p) => p.isActive)
      .reduce((max, p) => (p.totalCoin > (max?.totalCoin ?? -1) ? p : max), null)
    return { total: items.length, active, inactive, cheapest, mostCoin }
  }, [items])

  function handleCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(pkg) {
    setEditing(pkg)
    setDialogOpen(true)
  }

  async function handleDeactivate() {
    if (!confirmDeactivate) return
    setDeactivating(true)
    try {
      await api.deleteCoinPackage(confirmDeactivate.id)
      toast.success(`Đã vô hiệu hoá gói "${confirmDeactivate.name}"`)
      setConfirmDeactivate(null)
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Vô hiệu hoá thất bại')
    } finally {
      setDeactivating(false)
    }
  }

  // ============ RENDER ============

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25"
            >
              <Wallet className="size-5 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Quản lý gói nạp Coin
              </h1>
              <p className="text-sm text-muted-foreground">
                Tạo, chỉnh sửa và vô hiệu hoá các gói nạp Coin cho reader.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleCreate}
          className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 hover:from-amber-600 hover:to-orange-700"
        >
          <Plus className="size-4" />
          Tạo gói nạp
        </Button>
      </motion.div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Package}
          label="Tổng gói"
          value={stats.total}
          gradient="from-slate-500 to-slate-700"
          delay={0}
        />
        <StatCard
          icon={CheckCircle2}
          label="Đang hoạt động"
          value={stats.active}
          gradient="from-emerald-500 to-green-600"
          delay={0.05}
        />
        <StatCard
          icon={Power}
          label="Đã vô hiệu hoá"
          value={stats.inactive}
          gradient="from-zinc-400 to-zinc-600"
          delay={0.1}
        />
        <StatCard
          icon={Sparkles}
          label="Gói nhiều Coin nhất"
          value={stats.mostCoin ? formatCoinStringWithUnit(stats.mostCoin.totalCoin) : '—'}
          gradient="from-amber-500 to-orange-600"
          delay={0.15}
          highlight={Boolean(stats.mostCoin)}
        />
      </div>

      {/* Filters */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc mô tả..."
              className="h-9 pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {f.label}
                </button>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="ml-1 gap-1 text-xs"
            >
              <RefreshCcw className={cn('size-3.5', loading && 'animate-spin')} />
              Tải lại
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table / States */}
      <Card className="overflow-hidden border-border/60 shadow-sm">
        {error ? (
          <div className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Không thể tải dữ liệu</AlertTitle>
              <AlertDescription className="mt-1 flex flex-col gap-2">
                <span>{error}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-fit gap-1.5"
                  onClick={fetchData}
                  disabled={loading}
                >
                  <RefreshCcw className="size-3.5" />
                  Thử lại
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            isFiltered={search.trim() !== '' || statusFilter !== 'all'}
            onCreate={handleCreate}
            onResetFilters={() => {
              setSearch('')
              setStatusFilter('all')
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-12 text-center font-semibold">STT</TableHead>
                  <TableHead className="font-semibold">Tên gói</TableHead>
                  <TableHead className="font-semibold">Giá VND</TableHead>
                  <TableHead className="text-right font-semibold">Coin cơ bản</TableHead>
                  <TableHead className="text-right font-semibold">Coin thưởng</TableHead>
                  <TableHead className="text-right font-semibold">Tổng Coin</TableHead>
                  <TableHead className="font-semibold">Trạng thái</TableHead>
                  <TableHead className="font-semibold">Ngày cập nhật</TableHead>
                  <TableHead className="text-right font-semibold">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {filtered.map((pkg, idx) => (
                    <motion.tr
                      key={pkg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.2) }}
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
                      <TableCell className="text-center">
                        <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted/70 text-xs font-medium text-muted-foreground">
                          {idx + 1}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              'flex size-9 shrink-0 items-center justify-center rounded-lg',
                              pkg.isActive
                                ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-500/25'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            <Coins className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">
                              {pkg.name}
                            </div>
                            {pkg.description ? (
                              <div className="line-clamp-1 text-[11px] text-muted-foreground">
                                {pkg.description}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-foreground">
                        {formatVnd(pkg.priceVnd)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                        {formatCoinString(pkg.coinAmount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {pkg.bonusCoin > 0 ? (
                          <span className="font-medium text-purple-600 dark:text-purple-400">
                            +{formatCoinString(pkg.bonusCoin)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-2 py-0.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
                          <Coins className="size-3.5" />
                          {formatCoinString(pkg.totalCoin)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {pkg.isActive ? (
                          <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <span className="relative flex size-2">
                              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" />
                              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                            </span>
                            Đang hoạt động
                          </Badge>
                        ) : (
                          <Badge className="gap-1 border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
                            <Power className="size-3" />
                            Đã vô hiệu hoá
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(pkg.updatedAt || pkg.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(pkg)}
                            className="h-8 gap-1 px-2 text-xs hover:bg-primary/10 hover:text-primary"
                            title="Chỉnh sửa"
                          >
                            <PencilLine className="size-3.5" />
                            Sửa
                          </Button>
                          {pkg.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeactivate(pkg)}
                              className="h-8 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              title="Vô hiệu hoá"
                            >
                              <Power className="size-3.5" />
                              Vô hiệu hoá
                            </Button>
                          ) : (
                            <span className="px-2 text-[11px] italic text-muted-foreground">
                              không khả dụng
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Tổng số row */}
      {!loading && !error && filtered.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Hiển thị <b>{filtered.length}</b> / {items.length} gói
        </p>
      ) : null}

      {/* Dialog create/edit — key dựa trên editing.id để remount khi đổi gói,
          tránh vi phạm react-hooks/set-state-in-effect. */}
      <CoinPackageDialog
        key={editing?.id ?? 'new'}
        pkg={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchData}
      />

      {/* Confirm deactivate */}
      <Dialog
        open={Boolean(confirmDeactivate)}
        onOpenChange={(o) => !o && !deactivating && setConfirmDeactivate(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Power className="size-5" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base">Vô hiệu hoá gói nạp?</DialogTitle>
                <DialogDescription>
                  Hành động này sẽ ẩn gói khỏi danh sách nạp của reader.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {confirmDeactivate ? (
            <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Tên gói</span>
                <span className="font-medium">{confirmDeactivate.name}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Giá</span>
                <span className="font-medium">{formatVnd(confirmDeactivate.priceVnd)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Tổng Coin</span>
                <span className="font-medium text-amber-600">
                  {formatCoinStringWithUnit(confirmDeactivate.totalCoin)}
                </span>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmDeactivate(null)}
              disabled={deactivating}
            >
              Huỷ bỏ
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
              className="gap-1.5"
            >
              {deactivating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Power className="size-4" />
              )}
              {deactivating ? 'Đang xử lý...' : 'Xác nhận vô hiệu hoá'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ Sub components ============

function StatCard({ icon: Icon, label, value, gradient, delay = 0, highlight = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card
        className={cn(
          'border-border/60 shadow-sm transition-shadow hover:shadow-md',
          highlight && 'ring-1 ring-amber-300/40',
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
              gradient,
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="truncate text-lg font-semibold text-foreground">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md border border-border/40 bg-muted/20 p-3"
        >
          <div className="size-9 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-2 w-1/2 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
      <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Đang tải danh sách gói nạp...
      </div>
    </div>
  )
}

function EmptyState({ isFiltered, onCreate, onResetFilters }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/15 to-orange-500/15">
        {isFiltered ? (
          <ArrowDownAZ className="size-6 text-amber-600" />
        ) : (
          <XCircle className="size-6 text-amber-600" />
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          {isFiltered ? 'Không tìm thấy gói nạp phù hợp' : 'Chưa có gói nạp nào'}
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {isFiltered
            ? 'Thử bỏ bộ lọc hoặc đổi từ khoá tìm kiếm.'
            : 'Tạo gói nạp Coin đầu tiên để reader có thể mua và đọc truyện.'}
        </p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        {isFiltered ? (
          <Button variant="outline" size="sm" onClick={onResetFilters} className="gap-1.5">
            <RefreshCcw className="size-3.5" />
            Xoá bộ lọc
          </Button>
        ) : null}
        <Button
          size="sm"
          onClick={onCreate}
          className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25"
        >
          <Plus className="size-3.5" />
          Tạo gói nạp
        </Button>
      </div>
    </div>
  )
}