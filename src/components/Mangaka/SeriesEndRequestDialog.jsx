import { useState } from 'react'
import { Flag, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { seriesEndRequestsService } from '@/api/seriesEndRequests.service.js'
import { getApiErrorMessage } from '@/api/http.js'
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

/**
 * Modal Mangaka gửi yêu cầu kết thúc series.
 * planned_final_chapter_number là bắt buộc (>= 1).
 */
export default function SeriesEndRequestDialog({
  series,
  open,
  onClose,
  onSubmitted,
  hasActiveRequest = false,
  /** @deprecated dùng hasActiveRequest */
  hasPending = false,
}) {
  const blocked = hasActiveRequest || hasPending
  const [reason, setReason] = useState('')
  const [plannedChapter, setPlannedChapter] = useState('')
  const [saving, setSaving] = useState(false)

  const plannedNum = Number(plannedChapter)
  const plannedValid =
    plannedChapter !== ''
    && Number.isInteger(plannedNum)
    && plannedNum >= 1

  async function handleSubmit() {
    if (!series?.id) return
    if (blocked) {
      toast.error(
        'Series này đã có yêu cầu kết thúc đang chờ xử lý hoặc đã được duyệt.',
      )
      return
    }
    if (!plannedValid) {
      toast.error('Vui lòng nhập chapter cuối bạn muốn kết thúc.')
      return
    }
    setSaving(true)
    try {
      const res = await seriesEndRequestsService.create(series.id, {
        reason,
        planned_final_chapter_number: plannedNum,
      })
      toast.success(
        res.message
          || 'Yêu cầu kết thúc truyện đã được gửi. Admin sẽ xem xét trong 7 ngày.',
      )
      onSubmitted?.(res.data)
      onClose()
    } catch (err) {
      const status = err?.response?.status
      if (status === 409) {
        toast.error(
          getApiErrorMessage(
            err,
            'Series này đã có yêu cầu kết thúc đang chờ xử lý hoặc đã được duyệt.',
          ),
        )
      } else if (status === 400) {
        toast.error(
          getApiErrorMessage(
            err,
            'Vui lòng nhập chapter cuối bạn muốn kết thúc.',
          ),
        )
      } else {
        toast.error(getApiErrorMessage(err, 'Không gửi được yêu cầu kết thúc.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const title = series?.title ?? series?.name ?? 'series'

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
        else {
          setReason('')
          setPlannedChapter('')
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <Flag className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle>Yêu cầu kết thúc truyện</DialogTitle>
              <DialogDescription className="line-clamp-2">
                Gửi yêu cầu kết thúc “{title}”. Admin sẽ duyệt trong tối đa 7 ngày.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {blocked ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            Series này đã có yêu cầu kết thúc đang chờ xử lý hoặc đã được duyệt.
            {hasPending && !hasActiveRequest
              ? ' Hãy hủy yêu cầu cũ trong trang “Yêu cầu kết thúc” nếu cần.'
              : null}
          </p>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="end-final-ch">
                Muốn kết thúc ở chapter số{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="end-final-ch"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={plannedChapter}
                onChange={(e) => setPlannedChapter(e.target.value)}
                placeholder="VD: 25"
                required
              />
              <p className="text-xs text-muted-foreground">
                Bắt buộc. Series chỉ hoàn thành khi chapter này được publish thật sự
                (sau khi Admin duyệt).
              </p>
              {plannedChapter !== '' && !plannedValid ? (
                <p className="text-xs text-destructive">
                  Nhập số nguyên dương ≥ 1.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-reason">Lý do (tuỳ chọn)</Label>
              <Textarea
                id="end-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 1000))}
                placeholder="Ví dụ: Đã hoàn thành cốt truyện theo kế hoạch..."
                rows={4}
                maxLength={1000}
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {reason.length}/1000
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          {!blocked ? (
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || !plannedValid}
              className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Gửi yêu cầu
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
