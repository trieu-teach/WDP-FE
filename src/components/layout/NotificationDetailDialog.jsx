import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Handshake,
  Image as ImageIcon,
  Info,
  ListChecks,
  Sparkles,
  UserPlus,
  XCircle,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ScrollArea } from "@/components/ui/scroll-area";

import { cn } from "@/lib/utils";

import { chaptersService } from "@/api/chapters.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { EB_CLASSIFICATION_LABELS } from "@/utils/ebEvaluationMappers.js";
import {
  getMangakaTeRevisionPath,
  isEbApprovedNotification,
  isSafeNotificationLink,
  isTeRevisionNotification,
  readEbApprovalMeta,
  resolveChapterIdFromNotification,
  resolveEntityId,
} from "@/utils/notificationTarget.js";

const TYPE_META = {
  info: { icon: Info, label: "Thông báo", tone: "sky" },

  success: { icon: CheckCircle2, label: "Thành công", tone: "emerald" },

  warning: { icon: Clock, label: "Cảnh báo", tone: "amber" },

  error: { icon: XCircle, label: "Lỗi", tone: "rose" },

  assignment: { icon: UserPlus, label: "Giao việc", tone: "violet" },

  review: { icon: ListChecks, label: "Duyệt bản", tone: "amber" },

  cooperation: { icon: Handshake, label: "Hợp tác", tone: "violet" },

  te_review: { icon: ListChecks, label: "TE review", tone: "sky" },

  eb_evaluation: { icon: Sparkles, label: "EB đánh giá", tone: "emerald" },

  chapter_approved_by_eb: { icon: CheckCircle2, label: "EB đã duyệt", tone: "emerald" },

  chapter_pending_eb: { icon: ListChecks, label: "Chờ EB duyệt", tone: "amber" },

  chapter: { icon: FileText, label: "Chapter", tone: "sky" },

  series: { icon: TrendingUp, label: "Series", tone: "emerald" },

  page: { icon: ImageIcon, label: "Trang", tone: "violet" },

  task: { icon: UserPlus, label: "Task", tone: "violet" },

  vote: { icon: CheckCircle2, label: "Biểu quyết", tone: "emerald" },
};

const TONE_STYLE = {
  sky: { ring: "bg-sky-500/10 text-sky-600", dot: "bg-sky-500" },

  emerald: {
    ring: "bg-emerald-500/10 text-emerald-600",
    dot: "bg-emerald-500",
  },

  amber: { ring: "bg-amber-500/10 text-amber-600", dot: "bg-amber-500" },

  rose: { ring: "bg-rose-500/10 text-rose-600", dot: "bg-rose-500" },

  violet: { ring: "bg-violet-500/10 text-violet-600", dot: "bg-violet-500" },
};

const RELATED_TYPE_LABEL = {
  series: "Series",

  chapter: "Chapter",

  page: "Trang",

  task: "Task",

  cooperation_request: "Yêu cầu hợp tác",

  cooperation: "Hợp tác",

  te_review: "TE review",

  eb_evaluation: "EB đánh giá",

  vote: "Biểu quyết",
};

function timeText(iso) {
  if (!iso) return "";

  const t = new Date(iso).getTime();

  if (Number.isNaN(t)) return "";

  const full = new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",

    month: "2-digit",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit",
  });

  const diff = Date.now() - t;

  if (diff < 60_000) return `${full} · vừa xong`;

  if (diff < 3_600_000)
    return `${full} · ${Math.floor(diff / 60_000)} phút trước`;

  if (diff < 86_400_000)
    return `${full} · ${Math.floor(diff / 3_600_000)} giờ trước`;

  return full;
}

function MetaRow({ label, value, mono = false }) {
  if (!value && value !== 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>

      <span
        className={cn(
          "truncate text-right font-medium text-foreground",
          mono && "font-mono",
        )}
      >
        {String(value)}
      </span>
    </div>
  );
}

function Pill({ children, tone = "sky" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",

        TONE_STYLE[tone]?.ring ?? TONE_STYLE.sky.ring,
      )}
    >
      {children}
    </span>
  );
}

function TeRevisionLinkButton({ to, onClose, className, size, children }) {
  return (
    <Button asChild type="button" size={size} className={className}>
      <Link to={to} onClick={() => onClose(false)}>
        {children}
      </Link>
    </Button>
  );
}

export function NotificationDetailDialog({ notification, open, onOpenChange }) {
  const [publishing, setPublishing] = useState(false);

  if (!notification) return null;

  const typeKey = String(notification.type ?? "").toLowerCase();

  const meta = TYPE_META[typeKey] ?? TYPE_META.info;

  const Icon = meta.icon;

  const tone = meta.tone;

  const toneStyle = TONE_STYLE[tone] ?? TONE_STYLE.sky;

  const relatedType = notification.relatedEntityType;

  const relatedId = resolveEntityId(notification.relatedEntityId);

  const metaObj = notification.meta ?? {};

  const chapterId = resolveChapterIdFromNotification(notification);

  const teRevisionPath = getMangakaTeRevisionPath(chapterId);

  const isTeRevision = isTeRevisionNotification(notification);
  const isEbApproved = isEbApprovedNotification(notification);
  const ebApproval = readEbApprovalMeta(notification);
  const publishChapterId = ebApproval.chapterId ?? chapterId;

  const canOpenTeReview = isTeRevision && Boolean(teRevisionPath);

  const showGenericLink =
    !isTeRevision && !isEbApproved && isSafeNotificationLink(notification.link);

  async function handlePublishChapter() {
    if (!publishChapterId) {
      toast.error("Không tìm thấy mã chapter để xuất bản.");
      return;
    }
    setPublishing(true);
    try {
      await chaptersService.publishChapter(publishChapterId);
      toast.success("Chapter đã được xuất bản — Reader có thể đọc.");
      onOpenChange?.(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không xuất bản được chapter."));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <div className={cn("relative px-6 pb-5 pt-6", toneStyle.ring)}>
          <span
            className={cn("absolute left-0 top-0 h-1 w-full", toneStyle.dot)}
            aria-hidden
          />

          <DialogHeader>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",

                  "bg-card text-foreground ring-border/60 shadow-sm",
                )}
              >
                <Icon className="size-4" />
              </span>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={tone}>
                    <span
                      className={cn("size-1.5 rounded-full", toneStyle.dot)}
                    />

                    {meta.label}
                  </Pill>

                  {relatedType ? (
                    <Pill tone="sky">
                      {RELATED_TYPE_LABEL[relatedType] ?? relatedType}
                    </Pill>
                  ) : null}
                </div>

                <DialogTitle className="text-base leading-snug">
                  {notification.title || meta.label}
                </DialogTitle>

                <DialogDescription className="text-xs">
                  {timeText(notification.createdAt)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 px-6 py-5">
            {notification.message ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm leading-relaxed text-foreground">
                {notification.message}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                Thông báo này không có nội dung chi tiết.
              </div>
            )}

            {relatedId || Object.keys(metaObj).length > 0 || isTeRevision ? (
              <div className="space-y-2.5 rounded-xl border border-border/60 bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Chi tiết
                </p>

                <div className="space-y-2">
                  {metaObj?.mangakaName ? (
                    <MetaRow label="Mangaka" value={metaObj.mangakaName} />
                  ) : null}

                  {metaObj?.assistantName ? (
                    <MetaRow label="Assistant" value={metaObj.assistantName} />
                  ) : null}

                  {metaObj?.seriesName ? (
                    <MetaRow label="Series" value={metaObj.seriesName} />
                  ) : null}

                  {metaObj?.chapterNumber ? (
                    <MetaRow label="Chapter" value={metaObj.chapterNumber} />
                  ) : null}

                  {metaObj?.pageNumber ? (
                    <MetaRow label="Trang" value={metaObj.pageNumber} />
                  ) : null}

                  {metaObj?.status ? (
                    <MetaRow
                      label="Trạng thái"
                      value={String(metaObj.status)}
                    />
                  ) : null}

                  {metaObj?.revision_notes || metaObj?.revisionNotes ? (
                    <MetaRow
                      label="Ghi chú TE"
                      value={metaObj.revision_notes ?? metaObj.revisionNotes}
                    />
                  ) : null}

                  {ebApproval.councilAverage != null ? (
                    <MetaRow
                      label="Điểm TB HĐ"
                      value={Number(ebApproval.councilAverage).toFixed(1)}
                    />
                  ) : null}

                  {ebApproval.classification ? (
                    <MetaRow
                      label="Xếp loại"
                      value={
                        ebApproval.classificationText
                        || EB_CLASSIFICATION_LABELS[ebApproval.classification]
                        || ebApproval.classification
                      }
                    />
                  ) : null}

                  {relatedId ? (
                    <MetaRow label="Mã đối tượng" value={relatedId} mono />
                  ) : null}
                </div>

                {canOpenTeReview ? (
                  <TeRevisionLinkButton
                    to={teRevisionPath}
                    onClose={onOpenChange}
                    className="mt-2 w-full justify-between gap-2"
                  >
                    Xem chapter & nhận xét TE
                    <ChevronRight className="size-4 shrink-0 opacity-70" />
                  </TeRevisionLinkButton>
                ) : isTeRevision ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Không tìm thấy mã chapter trong thông báo. Vui lòng mở từ
                    trang Mangaka.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {canOpenTeReview ? (
          <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
            <TeRevisionLinkButton
              to={teRevisionPath}
              onClose={onOpenChange}
              size="sm"
              className="gap-1.5"
            >
              <ListChecks className="size-3.5" />
              Xem chi tiết
            </TeRevisionLinkButton>
          </div>
        ) : isEbApproved ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/tantou" onClick={() => onOpenChange?.(false)}>
                <ExternalLink className="size-3.5" />
                Xem chi tiết
              </Link>
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={publishing || !publishChapterId}
              onClick={() => void handlePublishChapter()}
            >
              <CheckCircle2 className="size-3.5" />
              {publishing ? "Đang xuất bản..." : "Xuất bản ngay"}
            </Button>
          </div>
        ) : showGenericLink ? (
          <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
            <Button asChild size="sm" className="gap-1.5">
              <a href={notification.link}>
                <ExternalLink className="size-3.5" />
                Mở chi tiết
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default NotificationDetailDialog;
