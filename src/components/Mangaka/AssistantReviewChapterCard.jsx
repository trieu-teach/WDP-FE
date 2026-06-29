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
  dedupeTasksByPage,
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
}) {
  const chapter = review?.chapter;
  const submission = review?.submission ?? null;
  const submittedTasks = dedupeTasksByPage(review?.tasks ?? []);
  const pageCompare = buildReviewPageCompare(pages, submittedTasks);
  const chapterView = buildChapterView(submission);
  const chapterSubmitted = isChapterSubmittedByAssistant(review);
  const canApprove = canMangakaApproveChapterReview(review, pageCompare);
  const hasImages = pageCompare.resultCount > 0;
  const loading = pagesLoading || (tasksLoading && !hasImages);

  const canSend = canApprove;
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
        "border-primary/30 shadow-md",
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
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={REVIEW_BADGE_CLASS} variant="secondary">
            {chapterSubmitted && hasImages
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

        <div className="overflow-hidden rounded-lg border bg-muted">
          {hasImages ? (
            <ImageCompareGrid
              originals={pageCompare.originals}
              results={pageCompare.results}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 p-6 text-center text-xs text-muted-foreground">
              <ImageIcon className="size-6 opacity-40" />
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
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tasks · nhận (submitted) → duyệt (in_review)
              {chapterSubmitted && hasImages && countUnapprovedTasks(submittedTasks) > 0
                ? ` · hoặc gửi ${LABEL_TANTOU_EDITOR} trực tiếp nếu đủ ảnh`
                : ""}
            </p>
            <ul className="space-y-1.5">
              {submittedTasks.map((task) => {
                const hint = taskStatusHint(task, chapterSubmitted);
                return (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate">
                      {task.pageNumber != null
                        ? `Trang ${task.pageNumber}`
                        : task.pageId
                          ? "Trang task"
                          : "Task"}{" "}
                      · {task.status}
                    </span>
                    {task.status === "approved" ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
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
                      <span className="text-[10px] text-muted-foreground">
                        {hint}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {task.status}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-w-0 flex-1 justify-between gap-2"
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
            <Button
              type="button"
              size="sm"
              className="shrink-0 sm:min-w-[7rem]"
              disabled={teSending || !canSend}
              onClick={() => void onSendToTe?.()}
            >
              <Send className="size-3.5" />
              {teSending ? "Đang gửi..." : "Gửi"}
            </Button>
          </div>
          {selectedTeLabel ? (
            <p className="text-[11px] text-muted-foreground">
              Sẽ gửi cho: <strong className="text-foreground">{selectedTeLabel}</strong>
            </p>
          ) : canSend ? (
            <p className="text-[11px] text-muted-foreground">
              Chưa chọn {LABEL_TANTOU_EDITOR} — bấm Gửi để gửi cho tất cả.
            </p>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={revisionSending}
            onClick={() => void onRequestRevision?.(review)}
          >
            {revisionSending ? "Đang gửi..." : "Yêu cầu sửa"}
          </Button>
        </div>

        {chapterView?.revisionHistory?.length ? (
          <div className="rounded-lg border border-amber-200/70 bg-amber-50/40 p-3 text-xs dark:border-amber-500/20 dark:bg-amber-500/5">
            <p className="mb-1.5 font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Lịch sử · {chapterView.revisionHistory.length} mục
            </p>
            <ol className="space-y-1.5">
              {chapterView.revisionHistory.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-foreground/80">
                  <span
                    className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-500"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words">{h.note || "(không có ghi chú)"}</p>
                    {h.at ? (
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(h.at).toLocaleString("vi-VN")}
                      </p>
                    ) : null}
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
