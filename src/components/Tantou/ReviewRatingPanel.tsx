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
    label: "Approve & Publish",
    description: "Duyệt và chuyển bước phát hành tiếp theo.",
  },
];

type ReviewRatingPanelProps = {
  draft: ReviewDraft;
  onReviewTextChange: (text: string) => void;
  onStatusChange: (status: ReviewStatus) => void;
  onSendToMangaka: () => void;
  onSendToEb: () => void;
};

export function ReviewRatingPanel({
  draft,
  onReviewTextChange,
  onStatusChange,
  onSendToMangaka,
  onSendToEb,
}: ReviewRatingPanelProps) {
  return (
    <Card className="flex h-full w-full flex-col gap-0 overflow-hidden py-0 shadow-xl border-border/70 dark:border-zinc-700/80 dark:bg-zinc-950/80">
      <CardHeader className="shrink-0 gap-1 border-b border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 px-4 py-3.5 text-white sm:px-5 sm:py-4 [.border-b]:pb-3.5 sm:[.border-b]:pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold leading-tight sm:text-lg">
          <Star className="size-5 shrink-0 fill-amber-400/20 text-amber-400" />
          Đánh giá & Xuất bản
        </CardTitle>
        <CardDescription className="text-pretty text-xs leading-relaxed text-zinc-400 sm:text-[0.8125rem]">
          Ghi nhận xét và chọn hành động phát hành.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-5 p-4 lg:p-5">
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
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {draft.reviewStatus === "reject" ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onSendToMangaka}
            >
              Send to Mangaka
            </Button>
          ) : null}
          {draft.reviewStatus === "publish" ? (
            <Button type="button" onClick={onSendToEb}>
              Send to EB
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
