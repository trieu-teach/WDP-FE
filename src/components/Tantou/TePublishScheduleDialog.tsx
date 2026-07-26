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
      <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <CalendarClock className="size-4" />
              </span>
              Chọn thời điểm phát hành
            </DialogTitle>
          </DialogHeader>

        <div className="grid gap-3 py-1 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="te-scheduled-publish-date">Ngày</Label>
            <Input
              id="te-scheduled-publish-date"
              type="date"
              min={vietnamDateNow}
              value={dateValue}
              disabled={confirming}
              onChange={(e) => applyDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="te-scheduled-publish-time">Giờ (HH:mm)</Label>
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
            />
          </div>
        </div>

        {preview ? (
          <p className="text-xs text-muted-foreground">
            Dự kiến:{" "}
            <strong className="text-foreground">
              {formatEbScheduledPublishDisplay(preview)}
            </strong>
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={confirming}
            onClick={() => onOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={confirming || !dateValue}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleConfirm}
          >
            {confirming ? "Đang phát hành…" : "Xác nhận phát hành"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
