import { ChevronDown, ClipboardCheck, Image as ImageIcon, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.jsx";
import { ImageCompareGrid } from "@/components/layout/ImageCompareGrid.jsx";
import { LABEL_TANTOU_EDITOR } from "@/constants/roleTerminology.js";
import {
  buildReviewPageCompare,
  canMangakaApproveChapterReview,
  countUnapprovedTasks,
  dedupeTasksForMangakaReview,
  isChapterSubmittedByAssistant,
} from "@/utils/chapterTaskFlow.js";
import { cn } from "@/lib/utils";

const REVIEW_BADGE_CLASS =
  "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400";

function buildChapterView(submission) {
  if (!submission) return null;
  return {
    id: submission.id,
    revisionNote: submission.revision_notes ?? "",
    revisionHistory: Array.isArray(submission.revision_history)
      ? submission.revision_history.map((h) => ({
          at: h.at ?? h.createdAt ?? h.updatedAt ?? submission.updatedAt,
          by: h.by ?? h.requested_by ?? null,
          note: h.note ?? h.revision_note ?? "",
        }))
      : submission.revision_notes
        ? [{ at: submission.updatedAt, note: submission.revision_notes }]
        : [],
  };
}

function taskResultUrl(task) {
  if (!task) return null;
  if (task.resultImageUrl) return task.resultImageUrl;
  const fromList = Array.isArray(task.resultImageUrls)
    ? task.resultImageUrls.find(Boolean)
    : null;
  return fromList ?? null;
}

function taskStatusHint(task, chapterSubmitted) {
  if (task.status === "approved") return null;
  if (task.status === "submitted" || task.status === "in_review") return null;
  if (taskResultUrl(task)) {
    return chapterSubmitted
      ? "Đã có ảnh (nộp chapter)"
      : "Đã có ảnh kết quả";
  }
  if (task.status === "in_progress") return "Assistant đang xử lý";
  if (task.status === "pending") return "Chưa bắt đầu task";
  return task.status;
}

/** Soft pastel label for raw task.status — display only. */
function TaskStatusPill({ status }) {
  const key = String(status ?? "").toLowerCase();
  const map = {
    pending: {
      label: "Pending",
      className: "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25",
    },
    in_progress: {
      label: "In progress",
      className: "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25",
    },
    submitted: {
      label: "Submitted",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
    },
    in_review: {
      label: "In review",
      className: "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25",
    },
    approved: {
      label: "Done",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
    },
  };
  const meta = map[key] ?? {
    label: status || "—",
    className: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function AssistantReviewChapterCard({
  review,
  pages = [],
  pagesLoading = false,
  tasksLoading = false,
  taskActionBusy = null,
  teUsers = [],
  teUsersLoading = false,
  selectedTeId = null,
  teSending = false,
  onSelectTe,
  onSendToTe,
  highlighted = false,
  onAcknowledgeTask,
  onApproveTask,
  onRequestRevision,
  revisionSending = false,
  highlightPageNumbers = [],
  debutSubmitLocked = false,
  debutSubmitLockedMessage = "",
}) {
  const chapter = review?.chapter;
  const submission = review?.submission ?? null;
  const submittedTasks = dedupeTasksForMangakaReview(
    review?.allTasks ?? review?.tasks ?? [],
  );
  const pageCompare = buildReviewPageCompare(pages, submittedTasks);
  const chapterView = buildChapterView(submission);
  const chapterSubmitted = isChapterSubmittedByAssistant(review);
  const canApprove = canMangakaApproveChapterReview(review, pageCompare);
  const hasImages = pageCompare.resultCount > 0;
  const loading = pagesLoading || (tasksLoading && !hasImages);

  const canSend = canApprove && !debutSubmitLocked;
  const highlightSet = new Set(
    (highlightPageNumbers ?? []).map((n) => Number(n)).filter((n) => !Number.isNaN(n)),
  );
  const selectedTe = (teUsers ?? []).find(
    (te) => String(te._id) === String(selectedTeId),
  );
  const selectedTeLabel = selectedTe
    ? (selectedTe.full_name || selectedTe.username || LABEL_TANTOU_EDITOR)
    : null;

  if (!chapter) return null;

  return (
    <Card
      id={`review-chapter-${chapter.id}`}
      className={cn(
        "overflow-hidden border-border/70 shadow-sm",
        highlighted && "ring-2 ring-primary ring-offset-2",
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-4 text-primary" />
          Bản tổng hợp từ Assistant
        </CardTitle>
        <CardDescription>
          <strong className="text-foreground">{chapter.series}</strong> · Ch.{" "}
          {chapter.num}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={REVIEW_BADGE_CLASS} variant="secondary">
            {review?.awaitingTe
              ? "Đã duyệt — chờ gửi TE"
              : chapterSubmitted && hasImages
                ? "Assistant đã nộp — chờ duyệt"
                : "Chờ duyệt từ Assistant"}
          </Badge>
          {pageCompare.pageCount > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              {pageCompare.pageCount} trang · {pageCompare.resultCount} đã có ảnh
              kết quả
            </span>
          ) : hasImages ? (
            <span className="text-[11px] text-muted-foreground">
              {pageCompare.resultCount} ảnh kết quả
            </span>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl bg-muted/20">
          {hasImages ? (
            <ImageCompareGrid
              originals={pageCompare.originals}
              results={pageCompare.results}
            />
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-1 p-8 text-center text-sm text-muted-foreground">
              <ImageIcon className="size-7 opacity-40" />
              <span>
                {loading
                  ? "Đang tải ảnh từ Assistant..."
                  : chapterSubmitted
                    ? "Assistant đã nộp chapter — đang đồng bộ ảnh, thử tải lại trang"
                    : "Chờ Assistant nộp đủ ảnh các trang"}
              </span>
            </div>
          )}
        </div>

        {chapterView ? (
          <p className="text-xs text-muted-foreground">
            {pageCompare.resultCount}/
            {pageCompare.pageCount || pageCompare.resultCount || "?"}{" "}
            trang có ảnh Assistant
            {submittedTasks.length > 0
              ? ` · ${submittedTasks.filter((t) => t.status === "approved").length}/${submittedTasks.length} task đã duyệt`
              : ""}
            {chapterView.revisionNote
              ? ` · yêu cầu sửa trước: "${chapterView.revisionNote}"`
              : ""}
          </p>
        ) : null}

        {submittedTasks.length > 0 ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Tasks cần xử lý
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Nhận task đã nộp, rồi duyệt từng mục
                {chapterSubmitted && hasImages && countUnapprovedTasks(submittedTasks) > 0
                  ? ` — hoặc gửi ${LABEL_TANTOU_EDITOR} trực tiếp nếu đủ ảnh`
                  : ""}
              </p>
            </div>
            <ul className="space-y-2">
              {submittedTasks.map((task) => {
                const hint = taskStatusHint(task, chapterSubmitted);
                const pageNum = task.pageNumber;
                const isHighlighted = pageNum != null && highlightSet.has(Number(pageNum));
                return (
                  <li
                    key={task.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5 text-sm",
                      isHighlighted && "border-amber-500/70 bg-amber-50/50 ring-1 ring-amber-400/40 dark:bg-amber-500/10",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {task.pageNumber != null
                          ? `Trang ${task.pageNumber}`
                          : task.pageId
                            ? "Trang task"
                            : "Task"}
                      </span>
                      <TaskStatusPill status={task.status} />
                    </div>
                    {task.status === "approved" ? (
                      <Badge
                        variant="secondary"
                        className="shrink-0 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300"
                      >
                        Đã duyệt
                      </Badge>
                    ) : task.status === "submitted" ? (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={taskActionBusy === task.id}
                        onClick={() => void onAcknowledgeTask?.(task.id)}
                      >
                        {taskActionBusy === task.id ? "..." : "Nhận"}
                      </Button>
                    ) : task.status === "in_review" ? (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={taskActionBusy === task.id}
                        onClick={() => void onApproveTask?.(task.id)}
                      >
                        {taskActionBusy === task.id ? "..." : "Duyệt"}
                      </Button>
                    ) : hint ? (
                      <span className="text-xs text-muted-foreground">
                        {hint}
                      </span>
                    ) : (
                      <TaskStatusPill status={task.status} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {highlightSet.size > 0 ? (
          <div className="rounded-xl border border-amber-500/50 bg-amber-50/60 px-3.5 py-2.5 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Còn task chưa duyệt tại{" "}
            {[...highlightSet].sort((a, b) => a - b).map((n) => `Trang ${n}`).join(", ")}
            . Bấm <strong>Nhận</strong> rồi <strong>Duyệt</strong> trước khi gửi{" "}
            {LABEL_TANTOU_EDITOR}.
          </div>
        ) : null}

        <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-10 min-w-0 flex-1 justify-between gap-2 rounded-lg"
                  disabled={teUsersLoading || !canSend}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Users className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {teUsersLoading
                        ? "Đang tải..."
                        : selectedTeLabel
                          ? selectedTeLabel
                          : `Chọn ${LABEL_TANTOU_EDITOR}`}
                    </span>
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => onSelectTe?.(null)}
                  className={!selectedTeId ? "bg-accent" : ""}
                >
                  Tất cả {LABEL_TANTOU_EDITOR}
                </DropdownMenuItem>
                {(teUsers ?? []).length > 0 ? <DropdownMenuSeparator /> : null}
                {(teUsers ?? []).map((te) => (
                  <DropdownMenuItem
                    key={te._id}
                    onClick={() => onSelectTe?.(te._id)}
                    className={
                      String(selectedTeId) === String(te._id) ? "bg-accent" : ""
                    }
                  >
                    <span className="truncate">
                      {te.full_name || te.username || LABEL_TANTOU_EDITOR}
                    </span>
                  </DropdownMenuItem>
                ))}
                {!teUsersLoading && !(teUsers ?? []).length ? (
                  <DropdownMenuItem disabled>
                    Không có {LABEL_TANTOU_EDITOR} active
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-10 rounded-lg bg-red-600 px-5 font-medium text-white hover:bg-red-700 dark:bg-rose-600 dark:hover:bg-rose-500"
                disabled={teSending || !canSend}
                onClick={() => void onSendToTe?.()}
              >
                <Send className="size-3.5" />
                {teSending ? "Đang gửi..." : "Gửi"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                disabled={revisionSending}
                onClick={() => void onRequestRevision?.(review)}
              >
                {revisionSending ? "Đang gửi..." : "Yêu cầu sửa"}
              </Button>
            </div>
          </div>

          {selectedTeLabel ? (
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              Sẽ gửi cho: <strong className="text-foreground">{selectedTeLabel}</strong>
            </p>
          ) : canSend ? (
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              Chưa chọn {LABEL_TANTOU_EDITOR} — bấm Gửi để gửi cho tất cả.
            </p>
          ) : debutSubmitLocked ? (
            <p className="mt-2.5 text-[11px] text-amber-700 dark:text-amber-400">
              {debutSubmitLockedMessage
                || "Đang khóa debut — chờ EB confirm-publish rồi mới gửi chapter tiếp."}
            </p>
          ) : null}
        </div>

        {chapterView?.revisionHistory?.length ? (
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Lịch sử
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                · {chapterView.revisionHistory.length} mục
              </span>
            </h3>
            <ol className="relative mt-4 space-y-4 border-l border-amber-200/80 pl-5 dark:border-amber-500/30">
              {chapterView.revisionHistory.map((h, i) => (
                <li key={i} className="relative">
                  <span
                    className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full border-2 border-background bg-amber-500 shadow-sm"
                    aria-hidden
                  />
                  <div className="min-w-0 space-y-1">
                    {h.at ? (
                      <p className="text-[11px] font-medium tabular-nums text-muted-foreground">
                        {new Date(h.at).toLocaleString("vi-VN")}
                      </p>
                    ) : null}
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {h.note || "(không có ghi chú)"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
