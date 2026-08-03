import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewDraft, ReviewStatus } from "./reviewTypes";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{
  value: ReviewStatus;
  label: string;
  description: string;
  tone: "reject" | "approve";
}> = [
  {
    value: "reject",
    label: "Yêu cầu chỉnh sửa",
    description:
      "Gửi phản hồi yêu cầu tác giả/editor chỉnh sửa lại trước khi duyệt.",
    tone: "reject",
  },
  {
    value: "publish",
    label: "Phê duyệt",
    description: "Chấp nhận chapter và chuyển sang bước tiếp theo.",
    tone: "approve",
  },
];

type ReviewRatingPanelProps = {
  draft: ReviewDraft;
  /** Giai đoạn 1 — duyệt series, gửi EB */
  requiresEbSubmit?: boolean;
  /** Giai đoạn 2B — chapter approved_by_EB, chỉ gọi POST .../publish */
  publishOnlyMode?: boolean;
  /** Publish chỉ khi approved_by_EB + TE hiện tại được gán chapter */
  publishEnabled?: boolean;
  publishDisabledReason?: string;
  /** Gợi ý buffer / lịch — chỉ hiển thị, không chặn */
  publishHint?: string;
  /** ISO scheduled_publish_at nếu chapter đã lên lịch */
  scheduledPublishAt?: string | null;
  onReviewTextChange: (text: string) => void;
  onQuickNotesChange?: (text: string) => void;
  onRevisionFeedbackChange?: (text: string) => void;
  onStatusChange: (status: ReviewStatus) => void;
  onSaveDraft?: () => void;
  onSendToMangaka: () => void;
  /** Phê duyệt (gửi EB hoặc te-action approve) */
  onSendToEb: () => void;
  /** Phát hành chapter (POST publish) — tách riêng khỏi phê duyệt */
  onPublish?: () => void;
  saving?: boolean;
};

const textareaClass =
  "min-h-[4.75rem] resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-none transition-colors placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30";

export function ReviewRatingPanel({
  draft,
  requiresEbSubmit = true,
  publishOnlyMode = false,
  publishEnabled = false,
  publishDisabledReason,
  publishHint,
  scheduledPublishAt,
  onReviewTextChange,
  onQuickNotesChange,
  onRevisionFeedbackChange,
  onStatusChange,
  onSaveDraft,
  onSendToMangaka,
  onSendToEb,
  onPublish,
  saving = false,
}: ReviewRatingPanelProps) {
  const isReject = draft.reviewStatus === "reject";
  const canPublish = typeof onPublish === "function" && publishEnabled;

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-100 bg-slate-50/90 px-3.5 py-2.5 sm:px-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold leading-tight text-slate-900">
          <ClipboardCheck className="size-4 shrink-0 text-emerald-600" />
          Đánh giá & Phê duyệt
        </h2>
      </div>

      <div className="space-y-3 p-3.5 lg:p-4">
        {requiresEbSubmit ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="tantou-feedback" className="text-xs font-medium text-slate-700">
                Đánh giá tổng thể
              </Label>
              <Textarea
                id="tantou-feedback"
                value={draft.reviewText}
                onChange={(e) => onReviewTextChange(e.target.value)}
                placeholder="Đánh giá tổng thể series, cốt truyện, nghệ thuật…"
                rows={3}
                className={textareaClass}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tantou-quick-notes" className="text-xs font-medium text-slate-700">
                Ghi chú nhanh
              </Label>
              <Textarea
                id="tantou-quick-notes"
                value={draft.quickNotes ?? ""}
                onChange={(e) => onQuickNotesChange?.(e.target.value)}
                placeholder="Ưu / nhược điểm ngắn gọn…"
                rows={3}
                className={textareaClass}
              />
            </div>
            {isReject ? (
              <div className="space-y-1">
                <Label
                  htmlFor="tantou-revision-feedback"
                  className="text-xs font-medium text-slate-700"
                >
                  Phản hồi chỉnh sửa (gửi Mangaka)
                </Label>
                <Textarea
                  id="tantou-revision-feedback"
                  value={draft.revisionFeedback ?? ""}
                  onChange={(e) => onRevisionFeedbackChange?.(e.target.value)}
                  placeholder="Hướng dẫn cụ thể để Mangaka cải thiện series…"
                  rows={3}
                  className={textareaClass}
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="tantou-review-notes" className="text-xs font-medium text-slate-700">
              Ghi chú / Nhận xét
            </Label>
            <Textarea
              id="tantou-review-notes"
              value={draft.reviewText}
              onChange={(e) => onReviewTextChange(e.target.value)}
              placeholder='VD: "Trang 4 lỗi ảnh", "Cần chỉnh font thoại"…'
              rows={3}
              className={textareaClass}
            />
          </div>
        )}

        {publishOnlyMode && (publishHint || scheduledPublishAt) ? (
          <div className="space-y-1 rounded-lg border border-amber-200/80 bg-amber-50/80 p-2 text-[11px] leading-relaxed text-amber-950">
            {scheduledPublishAt ? (
              <p>
                Đã lên lịch:{" "}
                <strong className="font-semibold">{scheduledPublishAt}</strong>
                . Bấm Phát hành lại vẫn được (override lịch hiện tại).
              </p>
            ) : null}
            {publishHint ? <p>{publishHint}</p> : null}
          </div>
        ) : null}

        {!publishOnlyMode ? (
          <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
            <p className="text-xs font-semibold text-slate-900">Hành động</p>
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map((option) => {
                const checked = draft.reviewStatus === option.value;
                const description =
                  option.value === "publish"
                    ? requiresEbSubmit
                      ? "Chấp nhận chapter và gửi Editor Board đánh giá series."
                      : "Chấp nhận chapter → chuyển approved_by_EB (chưa phát hành)."
                    : option.value === "reject" && requiresEbSubmit
                      ? "Gửi phản hồi yêu cầu tác giả/editor chỉnh sửa lại."
                      : option.description;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-all duration-150",
                      checked && option.tone === "approve"
                        ? "border-emerald-500 bg-emerald-50/60 shadow-sm"
                        : checked && option.tone === "reject"
                          ? "border-rose-500 bg-rose-50/60 shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="tantou-review-status"
                      value={option.value}
                      checked={checked}
                      onChange={() => onStatusChange(option.value)}
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        option.tone === "approve"
                          ? "accent-emerald-600"
                          : "accent-rose-600",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-xs font-medium sm:text-sm",
                          checked && option.tone === "approve"
                            ? "text-emerald-800"
                            : checked && option.tone === "reject"
                              ? "text-rose-800"
                              : "text-slate-900",
                        )}
                      >
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                        {description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-slate-50/70 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {requiresEbSubmit && onSaveDraft ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onSaveDraft}
              className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Lưu tạm
            </Button>
          ) : null}
          {publishOnlyMode ? (
            <div className="flex w-full flex-col items-stretch gap-1.5 sm:items-end">
              <Button
                type="button"
                disabled={saving || !canPublish}
                title={
                  canPublish
                    ? undefined
                    : (publishDisabledReason
                      || "Chỉ TE đã phê duyệt mới phát hành được khi chapter ở approved_by_EB.")
                }
                onClick={onPublish}
                className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                Phát hành
              </Button>
              {!canPublish && publishDisabledReason ? (
                <p className="text-xs text-slate-500 sm:text-right">
                  {publishDisabledReason}
                </p>
              ) : null}
            </div>
          ) : isReject ? (
            <Button
              type="button"
              disabled={saving}
              onClick={onSendToMangaka}
              className="h-11 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
            >
              Gửi yêu cầu chỉnh sửa
            </Button>
          ) : requiresEbSubmit ? (
            <Button
              type="button"
              disabled={saving}
              onClick={onSendToEb}
              className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              Phê duyệt & Gửi EB
            </Button>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                disabled={saving}
                onClick={onSendToEb}
                className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                Phê duyệt
              </Button>
              <div className="flex flex-col gap-1 sm:items-end">
                <Button
                  type="button"
                  disabled={saving || !canPublish}
                  title={
                    canPublish
                      ? undefined
                      : (publishDisabledReason || undefined)
                  }
                  onClick={onPublish}
                  variant="outline"
                  className="h-10 rounded-xl border-emerald-500/40 disabled:opacity-50"
                >
                  Phát hành
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
