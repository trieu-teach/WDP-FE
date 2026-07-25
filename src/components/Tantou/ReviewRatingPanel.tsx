import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function ReviewRatingPanel({
  draft,
  requiresEbSubmit = true,
  publishOnlyMode = false,
  publishEnabled = false,
  publishDisabledReason,
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
    <Card className="flex w-full flex-col gap-0 overflow-visible border-border/70 py-0 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-950/80">
      <CardHeader className="shrink-0 gap-1 border-b border-border/60 bg-muted/30 px-4 py-3 sm:px-5 [.border-b]:pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold leading-tight text-foreground sm:text-lg">
          <ClipboardCheck className="size-5 shrink-0 text-sky-600 dark:text-sky-400" />
          Đánh giá & Phê duyệt
        </CardTitle>
        {publishOnlyMode ? (
          <CardDescription className="text-pretty text-xs leading-relaxed sm:text-[0.8125rem]">
            Chapter đã được phê duyệt — bấm Phát hành để xuất bản.
          </CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3 p-4 lg:p-5">
        {requiresEbSubmit ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="tantou-feedback" className="text-sm font-medium">
                Đánh giá tổng thể
              </Label>
              <Textarea
                id="tantou-feedback"
                value={draft.reviewText}
                onChange={(e) => onReviewTextChange(e.target.value)}
                placeholder="Đánh giá tổng thể series, cốt truyện, nghệ thuật…"
                className="min-h-16 resize-y border-border/80 bg-background/80 dark:bg-zinc-900/80"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tantou-quick-notes" className="text-sm font-medium">
                Ghi chú nhanh
              </Label>
              <Textarea
                id="tantou-quick-notes"
                value={draft.quickNotes ?? ""}
                onChange={(e) => onQuickNotesChange?.(e.target.value)}
                placeholder="Ưu / nhược điểm ngắn gọn…"
                className="min-h-14 resize-y border-border/80 bg-background/80 dark:bg-zinc-900/80"
              />
            </div>
            {isReject ? (
              <div className="space-y-1.5">
                <Label
                  htmlFor="tantou-revision-feedback"
                  className="text-sm font-medium"
                >
                  Phản hồi chỉnh sửa (gửi Mangaka)
                </Label>
                <Textarea
                  id="tantou-revision-feedback"
                  value={draft.revisionFeedback ?? ""}
                  onChange={(e) => onRevisionFeedbackChange?.(e.target.value)}
                  placeholder="Hướng dẫn cụ thể để Mangaka cải thiện series…"
                  className="min-h-14 resize-y border-border/80 bg-background/80 dark:bg-zinc-900/80"
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="tantou-review-notes" className="text-sm font-medium">
              Ghi chú / Nhận xét
            </Label>
            <Textarea
              id="tantou-review-notes"
              value={draft.reviewText}
              onChange={(e) => onReviewTextChange(e.target.value)}
              placeholder='VD: "Trang 4 lỗi ảnh", "Cần chỉnh font thoại"…'
              className="min-h-20 resize-y border-border/80 bg-background/80 dark:bg-zinc-900/80"
            />
          </div>
        )}

        {!publishOnlyMode ? (
          <div className="space-y-2 rounded-xl border border-border/80 bg-card/40 p-2.5 dark:bg-zinc-900/40">
            <p className="text-sm font-semibold">Hành động</p>
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
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                      checked && option.tone === "approve"
                        ? "border-emerald-500/50 bg-emerald-500/10 dark:bg-emerald-500/15"
                        : checked && option.tone === "reject"
                          ? "border-rose-400/50 bg-rose-500/10 dark:bg-rose-500/15"
                          : "border-border/60 hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="tantou-review-status"
                      value={option.value}
                      checked={checked}
                      onChange={() => onStatusChange(option.value)}
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        option.tone === "approve"
                          ? "accent-emerald-600"
                          : "accent-rose-600",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          checked && option.tone === "approve"
                            ? "text-emerald-800 dark:text-emerald-200"
                            : checked && option.tone === "reject"
                              ? "text-rose-800 dark:text-rose-200"
                              : undefined,
                        )}
                      >
                        {option.label}
                      </span>
                      <span className="block text-xs leading-snug text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>

      <div className="shrink-0 border-t border-border/60 bg-muted/20 p-3 sm:p-4 dark:bg-zinc-900/50">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {requiresEbSubmit && onSaveDraft ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onSaveDraft}
              className="border-border bg-background"
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
                className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Phát hành
              </Button>
              {!canPublish && publishDisabledReason ? (
                <p className="text-xs text-muted-foreground sm:text-right">
                  {publishDisabledReason}
                </p>
              ) : null}
            </div>
          ) : isReject ? (
            <Button
              type="button"
              disabled={saving}
              onClick={onSendToMangaka}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Gửi yêu cầu chỉnh sửa
            </Button>
          ) : requiresEbSubmit ? (
            <Button
              type="button"
              disabled={saving}
              onClick={onSendToEb}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Phê duyệt & Gửi EB
            </Button>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                disabled={saving}
                onClick={onSendToEb}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
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
                  className="border-emerald-500/40 disabled:opacity-50"
                >
                  Phát hành
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
