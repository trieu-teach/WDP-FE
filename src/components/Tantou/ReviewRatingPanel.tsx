import { Star } from "lucide-react";
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
}> = [
  {
    value: "reject",
    label: "Reject / Request Edit",
    description: "Trả về Mangaka kèm nhận xét chỉnh sửa.",
  },
  {
    value: "publish",
    label: "Approve",
    description: "Duyệt theo giai đoạn hiện tại.",
  },
];

type ReviewRatingPanelProps = {
  draft: ReviewDraft;
  /** Giai đoạn 1 — duyệt series, gửi EB */
  requiresEbSubmit?: boolean;
  /** Giai đoạn 2B — chapter approved_by_EB, chỉ gọi POST .../publish */
  publishOnlyMode?: boolean;
  onReviewTextChange: (text: string) => void;
  onQuickNotesChange?: (text: string) => void;
  onRevisionFeedbackChange?: (text: string) => void;
  onStatusChange: (status: ReviewStatus) => void;
  onSaveDraft?: () => void;
  onSendToMangaka: () => void;
  onSendToEb: () => void;
  saving?: boolean;
};

export function ReviewRatingPanel({
  draft,
  requiresEbSubmit = true,
  publishOnlyMode = false,
  onReviewTextChange,
  onQuickNotesChange,
  onRevisionFeedbackChange,
  onStatusChange,
  onSaveDraft,
  onSendToMangaka,
  onSendToEb,
  saving = false,
}: ReviewRatingPanelProps) {
  const isReject = draft.reviewStatus === "reject";

  return (
    <Card className="flex h-full w-full flex-col gap-0 overflow-hidden border-border/70 py-0 shadow-xl dark:border-zinc-700/80 dark:bg-zinc-950/80">
      <CardHeader className="shrink-0 gap-1 border-b border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 px-4 py-3.5 text-white sm:px-5 sm:py-4 [.border-b]:pb-3.5 sm:[.border-b]:pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold leading-tight sm:text-lg">
          <Star className="size-5 shrink-0 fill-amber-400/20 text-amber-400" />
          {requiresEbSubmit ? "Series Review" : "Đánh giá Chapter"}
        </CardTitle>
        <CardDescription className="text-pretty text-xs leading-relaxed text-zinc-400 sm:text-[0.8125rem]">
          {requiresEbSubmit
            ? "Giai đoạn 1 — đánh giá series, gửi EB hoặc yêu cầu Mangaka sửa."
            : publishOnlyMode
              ? "Chapter đã EB duyệt — bấm Publish để phát hành."
              : "Giai đoạn 2 — duyệt và publish chapter."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 overflow-y-auto p-4 lg:p-5">
        {requiresEbSubmit ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="tantou-feedback" className="text-sm font-medium">
                Feedback (Series Review)
              </Label>
              <Textarea
                id="tantou-feedback"
                value={draft.reviewText}
                onChange={(e) => onReviewTextChange(e.target.value)}
                placeholder="Đánh giá tổng thể series, plot, art…"
                className="min-h-28 resize-y border-border/80 bg-background/80 dark:bg-zinc-900/80"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tantou-quick-notes" className="text-sm font-medium">
                Quick notes
              </Label>
              <Textarea
                id="tantou-quick-notes"
                value={draft.quickNotes ?? ""}
                onChange={(e) => onQuickNotesChange?.(e.target.value)}
                placeholder="Ưu / nhược điểm ngắn gọn…"
                className="min-h-20 resize-y border-border/80 bg-background/80 dark:bg-zinc-900/80"
              />
            </div>
            {isReject ? (
              <div className="space-y-2">
                <Label
                  htmlFor="tantou-revision-feedback"
                  className="text-sm font-medium"
                >
                  Revision feedback (gửi Mangaka sửa Series)
                </Label>
                <Textarea
                  id="tantou-revision-feedback"
                  value={draft.revisionFeedback ?? ""}
                  onChange={(e) => onRevisionFeedbackChange?.(e.target.value)}
                  placeholder="Hướng dẫn cụ thể để Mangaka cải thiện series…"
                  className="min-h-20 resize-y border-border/80 bg-background/80 dark:bg-zinc-900/80"
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="tantou-review-notes" className="text-sm font-medium">
              Ghi chú / Nhận xét
            </Label>
            <Textarea
              id="tantou-review-notes"
              value={draft.reviewText}
              onChange={(e) => onReviewTextChange(e.target.value)}
              placeholder='VD: "Trang 4 lỗi ảnh", "Cần chỉnh font thoại"…'
              className="min-h-36 resize-y border-border/80 bg-background/80 dark:bg-zinc-900/80"
            />
          </div>
        )}

        {!publishOnlyMode ? (
          <div className="space-y-3 rounded-2xl border border-border/80 bg-card/40 p-3 dark:bg-zinc-900/40">
            <p className="text-sm font-semibold">Hành động</p>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((option) => {
                const checked = draft.reviewStatus === option.value;
                const description =
                  option.value === "publish"
                    ? requiresEbSubmit
                      ? "Gửi chapter → pending_EB + submit series review."
                      : "Approve → chapter tự động published."
                    : option.value === "reject" && requiresEbSubmit
                      ? "Chapter → TE_revision, Series → revision."
                      : option.description;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      checked
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/60 hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="tantou-review-status"
                      value={option.value}
                      checked={checked}
                      onChange={() => onStatusChange(option.value)}
                      className="mt-1 size-4 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
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

      <div className="shrink-0 border-t border-border/60 bg-muted/20 p-4 dark:bg-zinc-900/50">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {requiresEbSubmit && onSaveDraft ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onSaveDraft}
            >
              Save Review
            </Button>
          ) : null}
          {publishOnlyMode ? (
            <Button type="button" disabled={saving} onClick={onSendToEb}>
              Publish chapter
            </Button>
          ) : isReject ? (
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={onSendToMangaka}
            >
              {requiresEbSubmit
                ? "Reject & Request Edit"
                : "Reject & Request Edit"}
            </Button>
          ) : (
            <Button type="button" disabled={saving} onClick={onSendToEb}>
              {requiresEbSubmit
                ? "Approve & Send to EB"
                : "Approve & Publish"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
