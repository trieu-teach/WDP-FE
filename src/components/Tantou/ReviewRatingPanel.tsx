import { Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { StarCriterionRating } from "./StarCriterionRating";
import { getReviewCriteria } from "./reviewCriteria";
import { RATING_MAX } from "./reviewUtils";
import type { ReviewDraft, ReviewStatus, TantouSubmission } from "./reviewTypes";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{
  value: ReviewStatus;
  label: string;
  description: string;
}> = [
  { value: "draft", label: "Draft", description: "Lưu nháp, chưa gửi đi." },
  {
    value: "reject",
    label: "Reject / Request Edit",
    description: "Trả về Mangaka kèm nhận xét chỉnh sửa.",
  },
  {
    value: "publish",
    label: "Approve & Publish",
    description: "Duyệt và chuyển bước phát hành tiếp theo.",
  },
];

type ReviewRatingPanelProps = {
  submission: TantouSubmission;
  draft: ReviewDraft;
  averageScore: number;
  onRatingChange: (key: keyof ReviewDraft["ratings"], value: number) => void;
  onReviewTextChange: (text: string) => void;
  onStatusChange: (status: ReviewStatus) => void;
  onCancel: () => void;
  onSave: () => void;
  onSaveAndNext: () => void;
  hasNextChapter: boolean;
};

export function ReviewRatingPanel({
  submission,
  draft,
  averageScore,
  onRatingChange,
  onReviewTextChange,
  onStatusChange,
  onCancel,
  onSave,
  onSaveAndNext,
  hasNextChapter,
}: ReviewRatingPanelProps) {
  const criteria = getReviewCriteria(submission);

  return (
    <Card className="flex h-full w-full flex-col gap-0 overflow-hidden py-0 shadow-xl border-border/70 dark:border-zinc-700/80 dark:bg-zinc-950/80">
      <CardHeader className="shrink-0 gap-1 border-b border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 px-4 py-3.5 text-white sm:px-5 sm:py-4 [.border-b]:pb-3.5 sm:[.border-b]:pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold leading-tight sm:text-lg">
          <Star className="size-5 shrink-0 fill-amber-400/20 text-amber-400" />
          Đánh giá & Xuất bản
        </CardTitle>
        <CardDescription className="text-pretty text-xs leading-relaxed text-zinc-400 sm:text-[0.8125rem]">
          Chấm 4 tiêu chí, ghi nhận xét và chọn hành động phát hành.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-5 p-4 lg:p-5">
        <div className="grid gap-3">
          {criteria.map((criterion) => (
            <StarCriterionRating
              key={criterion.key}
              label={criterion.label}
              labelVi={criterion.labelVi}
              hint={criterion.hint}
              value={draft.ratings[criterion.key]}
              onChange={(value) => onRatingChange(criterion.key, value)}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10 p-4 dark:from-emerald-500/5 dark:to-sky-500/5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Điểm trung bình
          </p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="text-5xl font-bold tabular-nums tracking-tight text-foreground">
              {averageScore.toFixed(1)}
            </p>
            <Badge
              variant="secondary"
              className="border-emerald-500/30 bg-background/80 text-emerald-700 dark:text-emerald-300"
            >
              / {RATING_MAX.toFixed(1)}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Tự động tính từ 4 tiêu chí khi bạn chỉnh sao hoặc nhập điểm.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tantou-review-notes" className="text-sm font-medium">
            Ghi chú / Nhận xét nhanh
          </Label>
          <Textarea
            id="tantou-review-notes"
            value={draft.reviewText}
            onChange={(e) => onReviewTextChange(e.target.value)}
            placeholder='VD: "Trang 4 lỗi ảnh", "Cần chỉnh font thoại chương này"...'
            className="min-h-36 resize-y border-border/80 bg-background/80 dark:bg-zinc-900/80"
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border/80 bg-card/40 p-3 dark:bg-zinc-900/40">
          <p className="text-sm font-semibold">Publishing action</p>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((option) => {
              const checked = draft.reviewStatus === option.value;
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
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </CardContent>

      <div className="shrink-0 border-t border-border/60 bg-muted/20 p-4 dark:bg-zinc-900/50">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={onSave}>
            Save Review
          </Button>
          <Button
            type="button"
            onClick={onSaveAndNext}
            disabled={!hasNextChapter}
            className="gap-1.5"
          >
            <Sparkles className="size-4" />
            Save & Next Chapter
          </Button>
        </div>
        {!hasNextChapter ? (
          <p className="mt-2 text-right text-xs text-muted-foreground">
            Không còn chapter pending trong hàng đợi.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
