import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatEbScheduledPublishDateTime,
  formatEbScheduledPublishDisplay,
  getEbVietnamDateNow,
  getEbVietnamTimeNow,
} from "@/utils/ebEvaluationMappers.js";

const PAST_MSG =
  "Không thể chọn thời gian trong quá khứ. Vui lòng chọn thời điểm hiện tại hoặc tương lai.";

const INPUT_CLASS =
  "h-11 w-full rounded-xl border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-medium text-gray-900 shadow-none outline-none transition-all focus-visible:border-emerald-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/20";

type TePublishScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scheduledPublishAtIso: string) => void;
  /** ISO sẵn có (nếu chapter đã lên lịch) — prefill */
  initialScheduledAt?: string | null;
  confirming?: boolean;
};

function clampTime(dateValue: string, timeValue: string) {
  const nextTime = String(timeValue ?? "").trim() || getEbVietnamTimeNow();
  if (!dateValue || dateValue !== getEbVietnamDateNow()) return nextTime;
  const nowTime = getEbVietnamTimeNow();
  return nextTime < nowTime ? nowTime : nextTime;
}

function splitIsoToVnDateTime(iso?: string | null) {
  if (!iso) {
    return {
      date: getEbVietnamDateNow(),
      time: getEbVietnamTimeNow(),
    };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return {
      date: getEbVietnamDateNow(),
      time: getEbVietnamTimeNow(),
    };
  }
  return {
    date: getEbVietnamDateNow(d),
    time: getEbVietnamTimeNow(d),
  };
}

/**
 * Dialog chọn scheduled_publish_at — chỉ dùng cho lần publish đầu series (BE bắt buộc).
 * Chapter 2+ không mở dialog; job auto-schedule theo publication_schedule.
 */
export function TePublishScheduleDialog({
  open,
  onOpenChange,
  onConfirm,
  initialScheduledAt = null,
  confirming = false,
}: TePublishScheduleDialogProps) {
  const [dateValue, setDateValue] = useState(getEbVietnamDateNow);
  const [timeValue, setTimeValue] = useState(getEbVietnamTimeNow);
  const vietnamDateNow = getEbVietnamDateNow();

  useEffect(() => {
    if (!open) return;
    const { date, time } = splitIsoToVnDateTime(initialScheduledAt);
    setDateValue(date);
    setTimeValue(clampTime(date, time));
  }, [open, initialScheduledAt]);

  function applyDate(nextDate: string) {
    const today = getEbVietnamDateNow();
    if (nextDate && nextDate < today) {
      toast.error(PAST_MSG);
      setDateValue(today);
      setTimeValue((prev) => clampTime(today, prev));
      return;
    }
    setDateValue(nextDate);
    setTimeValue((prev) => clampTime(nextDate, prev));
  }

  function applyTime(nextTime: string) {
    setTimeValue(clampTime(dateValue, nextTime));
  }

  function handleConfirm() {
    if (!dateValue) {
      toast.error("Vui lòng chọn ngày phát hành.");
      return;
    }
    const iso = formatEbScheduledPublishDateTime(dateValue, timeValue);
    if (!iso) {
      toast.error("Thời điểm phát hành không hợp lệ.");
      return;
    }
    if (new Date(iso).getTime() < Date.now() - 1000) {
      toast.error(PAST_MSG);
      return;
    }
    onConfirm(iso);
  }

  const preview = formatEbScheduledPublishDateTime(dateValue, timeValue);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!confirming) onOpenChange(next);
      }}
    >
      <DialogContent
        overlayClassName="bg-black/50 backdrop-blur-xs"
        className="w-full max-w-md gap-5 rounded-2xl border-gray-100 bg-white p-6 shadow-2xl duration-150 sm:max-w-md"
      >
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-gray-100 pb-4 pr-8 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CalendarClock className="size-5" />
          </span>
          <DialogTitle className="text-base font-bold text-gray-900">
            Chọn thời điểm phát hành
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label
              htmlFor="te-scheduled-publish-date"
              className="text-xs font-semibold text-gray-700"
            >
              Ngày
            </Label>
            <Input
              id="te-scheduled-publish-date"
              type="date"
              min={vietnamDateNow}
              value={dateValue}
              disabled={confirming}
              onChange={(e) => applyDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="te-scheduled-publish-time"
              className="text-xs font-semibold text-gray-700"
            >
              Giờ (HH:mm)
            </Label>
            <Input
              id="te-scheduled-publish-time"
              type="time"
              step={60}
              value={timeValue}
              disabled={confirming}
              min={
                dateValue === vietnamDateNow ? getEbVietnamTimeNow() : undefined
              }
              onChange={(e) => applyTime(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {preview ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
            <span>Dự kiến</span>
            <strong className="font-semibold text-gray-900">
              {formatEbScheduledPublishDisplay(preview)}
            </strong>
          </div>
        ) : null}

        <DialogFooter className="flex-row items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            disabled={confirming}
            className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900"
            onClick={() => onOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={confirming || !dateValue}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
            onClick={handleConfirm}
          >
            {confirming ? "Đang phát hành…" : "Xác nhận phát hành"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
