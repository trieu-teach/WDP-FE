import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Coins, Loader2, Package, PencilLine, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatCoinString, formatVnd } from '@/utils/coinFormatter.js'

const NAME_MAX = 100
const DESC_MAX = 500
const MIN_PRICE = 1000
const MAX_DECIMALS = 2

const DEFAULT_FORM = {
  name: '',
  description: '',
  priceVnd: '',
  coinAmount: '',
  bonusCoin: '0',
  sortOrder: '0',
  isActive: true,
}

/** Build form state khởi tạo — dùng cho useState lazy initializer. */
function buildInitialForm(pkg, isEdit) {
  if (!isEdit || !pkg) return { ...DEFAULT_FORM }
  return {
    name: pkg.name ?? '',
    description: pkg.description ?? '',
    priceVnd: pkg.priceVnd > 0 ? String(pkg.priceVnd) : '',
    coinAmount: pkg.coinAmount > 0 ? pkg.coinAmount.toFixed(MAX_DECIMALS) : '',
    bonusCoin: pkg.bonusCoin > 0 ? pkg.bonusCoin.toFixed(MAX_DECIMALS) : '0',
    sortOrder: String(pkg.sortOrder ?? 0),
    isActive: Boolean(pkg.isActive),
  }
}

/**
 * Chuẩn hoá string thập phân — chỉ giữ digits + 1 dấu '.'; tự động cắt phần thập phân dài quá.
 */
function sanitizeDecimalString(value, { maxDecimals = MAX_DECIMALS, allowEmpty = false } = {}) {
  if (value == null) return allowEmpty ? '' : '0'
  const raw = String(value).trim()
  if (allowEmpty && raw === '') return ''
  // Chỉ cho digits và tối đa 1 dấu '.'
  let cleaned = raw.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  // Bỏ leading zero để tránh "000123.00"
  if (cleaned.length > 1 && cleaned.startsWith('0') && !cleaned.startsWith('0.')) {
    cleaned = cleaned.replace(/^0+/, '') || '0'
  }
  if (cleaned.startsWith('.')) cleaned = '0' + cleaned
  if (cleaned === '') return allowEmpty ? '' : '0'
  // Cắt thập phân
  const dotIdx = cleaned.indexOf('.')
  if (dotIdx !== -1 && cleaned.length - dotIdx - 1 > maxDecimals) {
    cleaned = cleaned.slice(0, dotIdx + 1 + maxDecimals)
  }
  return cleaned
}

function sanitizeIntString(value) {
  if (value == null) return ''
  return String(value).replace(/[^0-9]/g, '').slice(0, 9)
}

function parseDecimal(value) {
  const n = Number(String(value ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

function parseInt(value) {
  const n = Number(String(value ?? '').trim())
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

/**
 * Dialog tạo / sửa gói nạp coin.
 * Props:
 *   pkg            — object gói coin từ list (khi edit) hoặc null (khi create).
 *   open / onClose — điều khiển Dialog.
 *   onSaved()      — callback sau khi lưu thành công (page reload list).
 */
export default function CoinPackageDialog({ pkg, open, onClose, onSaved }) {
  const isEdit = !!pkg?.id
  // State chỉ khởi tạo 1 lần khi mount — parent page sẽ set `key` (id gói hoặc 'new')
  // để force remount khi đổi sang gói khác, tránh vi phạm react-hooks/set-state-in-effect.
  const [form, setForm] = useState(() => buildInitialForm(pkg, isEdit))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Clear error khi user gõ lại field đó
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const setDecimal = (key, raw, opts) => {
    const cleaned = sanitizeDecimalString(raw, opts)
    set(key, cleaned)
  }

  const setInt = (key, raw) => {
    set(key, sanitizeIntString(raw))
  }

  const coinAmountNum = parseDecimal(form.coinAmount)
  const bonusCoinNum = parseDecimal(form.bonusCoin)
  const totalCoinPreview = coinAmountNum + bonusCoinNum

  function validate() {
    const next = {}
    const name = form.name.trim()
    if (!name) next.name = 'Tên gói là bắt buộc'
    else if (name.length > NAME_MAX) next.name = `Tối đa ${NAME_MAX} ký tự`

    const description = form.description.trim()
    if (description.length > DESC_MAX) next.description = `Tối đa ${DESC_MAX} ký tự`

    const priceVnd = parseInt(form.priceVnd)
    if (!form.priceVnd || Number(form.priceVnd) <= 0) {
      next.priceVnd = 'Giá VND là bắt buộc'
    } else if (!Number.isInteger(priceVnd) || priceVnd < MIN_PRICE) {
      next.priceVnd = `Tối thiểu ${formatVnd(MIN_PRICE)}`
    }

    const coinAmount = parseDecimal(form.coinAmount)
    if (!form.coinAmount || coinAmount <= 0) {
      next.coinAmount = 'Coin cơ bản phải lớn hơn 0'
    }

    const bonusCoin = parseDecimal(form.bonusCoin)
    if (bonusCoin < 0) next.bonusCoin = 'Coin thưởng không được âm'

    const sortOrder = parseInt(form.sortOrder)
    if (sortOrder < 0) next.sortOrder = 'Thứ tự phải ≥ 0'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      priceVnd: parseInt(form.priceVnd),
      coinAmount: sanitizeDecimalString(form.coinAmount),
      bonusCoin: sanitizeDecimalString(form.bonusCoin),
      sortOrder: parseInt(form.sortOrder),
      isActive: Boolean(form.isActive),
    }
    try {
      if (isEdit) {
        await api.updateCoinPackage(pkg.id, payload)
        toast.success('Đã cập nhật gói nạp Coin')
      } else {
        await api.createCoinPackage(payload)
        toast.success('Đã tạo gói nạp Coin mới')
      }
      onSaved?.()
      onClose?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  const nameLen = form.name.length
  const descLen = form.description.length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.85, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/25"
            >
              {isEdit ? (
                <PencilLine className="size-5 text-white" />
              ) : (
                <Package className="size-5 text-white" />
              )}
            </motion.div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl leading-none">
                {isEdit ? 'Chỉnh sửa gói nạp' : 'Tạo gói nạp Coin'}
              </DialogTitle>
              <DialogDescription>
                {isEdit
                  ? 'Cập nhật giá, số coin và trạng thái gói nạp'
                  : 'Tạo gói nạp mới cho reader (chưa kích hoạt sẽ không hiện)'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Tên gói */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">
                Tên gói <span className="text-destructive">*</span>
              </Label>
              <span
                className={cn(
                  'text-[11px]',
                  nameLen > NAME_MAX ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {nameLen}/{NAME_MAX}
              </span>
            </div>
            <div className="relative">
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value.slice(0, NAME_MAX + 1))}
                placeholder="VD: Gói 200 Coin"
                maxLength={NAME_MAX}
                className={cn('h-10 pl-10', errors.name && 'border-destructive')}
              />
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name}</p>
            ) : null}
          </div>

          {/* Mô tả */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">Mô tả</Label>
              <span
                className={cn(
                  'text-[11px]',
                  descLen > DESC_MAX ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {descLen}/{DESC_MAX}
              </span>
            </div>
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value.slice(0, DESC_MAX + 1))}
              placeholder="Mô tả ngắn cho gói nạp (không bắt buộc)"
              rows={3}
              maxLength={DESC_MAX}
              className={cn('resize-none', errors.description && 'border-destructive')}
            />
            {errors.description ? (
              <p className="text-xs text-destructive">{errors.description}</p>
            ) : null}
          </div>

          {/* Giá VND + Coin cơ bản */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Giá (VND) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  inputMode="numeric"
                  value={form.priceVnd}
                  onChange={(e) => setInt('priceVnd', e.target.value)}
                  placeholder="20000"
                  className={cn('h-10 pl-10', errors.priceVnd && 'border-destructive')}
                />
                <Coins className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              {errors.priceVnd ? (
                <p className="text-xs text-destructive">{errors.priceVnd}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Tối thiểu {formatVnd(MIN_PRICE)}, chỉ nhập số nguyên.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Coin cơ bản <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  inputMode="decimal"
                  value={form.coinAmount}
                  onChange={(e) => setDecimal('coinAmount', e.target.value)}
                  placeholder="200.00"
                  className={cn('h-10 pl-10', errors.coinAmount && 'border-destructive')}
                />
                <Coins className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-amber-500" />
              </div>
              {errors.coinAmount ? (
                <p className="text-xs text-destructive">{errors.coinAmount}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Tối đa {MAX_DECIMALS} chữ số thập phân, lớn hơn 0.
                </p>
              )}
            </div>
          </div>

          {/* Coin thưởng + Thứ tự */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Coin thưởng</Label>
              <div className="relative">
                <Input
                  inputMode="decimal"
                  value={form.bonusCoin}
                  onChange={(e) => setDecimal('bonusCoin', e.target.value)}
                  placeholder="10.00"
                  className={cn('h-10 pl-10', errors.bonusCoin && 'border-destructive')}
                />
                <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-purple-500" />
              </div>
              {errors.bonusCoin ? (
                <p className="text-xs text-destructive">{errors.bonusCoin}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Không bắt buộc, không âm.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Thứ tự hiển thị</Label>
              <Input
                inputMode="numeric"
                value={form.sortOrder}
                onChange={(e) => setInt('sortOrder', e.target.value)}
                placeholder="0"
                className={cn('h-10', errors.sortOrder && 'border-destructive')}
              />
              <p className="text-[11px] text-muted-foreground">
                Số nhỏ hiển thị trước. Mặc định 0.
              </p>
            </div>
          </div>

          {/* Tổng Coin (read-only) + Trạng thái */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Tổng Coin</Label>
              <div
                className={cn(
                  'flex h-10 items-center justify-between rounded-md border border-dashed border-amber-300/60 bg-gradient-to-r from-amber-50 to-orange-50 px-3 text-sm font-semibold text-amber-700 dark:from-amber-950/30 dark:to-orange-950/20 dark:text-amber-300',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Coins className="size-4" />
                  {formatCoinString(totalCoinPreview.toFixed(MAX_DECIMALS))} Coin
                </span>
                <span className="text-[11px] font-normal text-amber-600/80 dark:text-amber-400/70">
                  tự tính
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Trạng thái</Label>
              <Select
                value={form.isActive ? 'active' : 'inactive'}
                onValueChange={(v) => set('isActive', v === 'active')}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Đang hoạt động
                    </span>
                  </SelectItem>
                  <SelectItem value="inactive">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-zinc-400" />
                      Đã vô hiệu hoá
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ bỏ
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 hover:from-amber-600 hover:to-orange-700"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo gói nạp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}