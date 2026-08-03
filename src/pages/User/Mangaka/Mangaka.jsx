import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Flag,
  Layers,
  Lightbulb,
  ListChecks,
  MoreHorizontal,
  Pencil,
  PenSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSession, logout } from "@/lib/auth.js";
import { cn } from "@/lib/utils";
import ChapterAnnotator from "./ChapterAnnotator.jsx";
import AddSeriesModal from "./AddSeriesModal.jsx";
import MangakaAssistants from "./MangakaAssistants.jsx";
import SeriesEndRequestDialog from "@/components/Mangaka/SeriesEndRequestDialog.jsx";
import { seriesPath } from "./SeriesUploadDetail.jsx";
import { seriesEndRequestsService } from "@/api/seriesEndRequests.service.js";
import {
  blocksNewEndRequest,
  canRequestSeriesEnd,
  mapSeriesEndRequestListResponse,
} from "@/utils/seriesEndRequestMappers.js";
import {
  LABEL_EDITOR_BOARD,
  LABEL_TANTOU_EDITOR,
  PATH_EDITOR_BOARD,
} from "@/constants/roleTerminology.js";
import { getMangakaTeRevisionPath } from "@/utils/notificationTarget.js";
import {
  isTeRevisionSeen,
  markTeRevisionSeen,
  pruneTeRevisionSeen,
  TE_REVISION_SEEN_EVENT,
} from "@/utils/teRevisionSeenStorage.js";
import {
  readEbDebutApproved,
  removeEbDebutApproval,
  syncEbDebutPendingFromSeries,
} from "@/utils/ebDebutStorage.js";
import { resolveAnnotatorChapter } from "@/utils/mangakaWorkspaceReader.js";
import { useMangakaWorkspace } from "@/hooks/useMangakaWorkspace.js";
import { getApiErrorMessage, resolveMediaUrl } from "@/api/http.js";
import { chaptersService } from "@/api/chapters.service.js";
import { submissionsService } from "@/api/submissions.service.js";
import { tasksService } from "@/api/tasks.service.js";
import { uiNoteToTaskCreate, uiChapterToTaskCreate, uiTaskTypeToErrorType, canMangakaSendToTe, chapterPagesToCompareUrls, apiTaskToUi, shouldShowAssistantEditedOnAnnotate } from "@/utils/apiMappers.js";
import {
  markAssistantApprovedPages,
  stampAssistantApprovedOnPages,
} from "@/utils/assistantApprovedPages.js";
import { useMangakaTasks } from "@/hooks/useMangakaTasks.js";
import { dedupeTasksByPage } from "@/utils/chapterTaskFlow.js";
import {
  mangakaTeSubmitMessage,
  resolveTePhase,
} from "@/utils/teReviewPhase.js";
import { useMangakaCooperation } from "@/hooks/useMangakaCooperation.js";
import {
  canSubmitMoreChaptersToTe,
  findSeriesDebutGate,
  getDebutSubmitLockedMessage,
} from "@/utils/debutGate.js";
import {
  formatSeriesCardLine,
  seriesToExternalSummary,
  slugifySeriesTitle,
} from "@/utils/seriesModel.js";
import { MANGAKA_NAV_LINKS, MANGAKA_WORKSPACE_TAB_IDS } from "@/constants/mangakaNav.js";
import "@/styles/mangaPage.css";
import "./Mangaka.css";

const NAV_LINKS = MANGAKA_NAV_LINKS;

const HERO_IMAGES = [
  "/images/mangaka1.png",
  "/images/mangaka2.png",
  "/images/mangaka3.png",
];
const HERO_SLIDE_MS = 5000;

const STATUS_BADGE = {
  draft: {
    label: "Nháp",
    className:
      "bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/15 dark:text-zinc-400",
  },
  assistant: {
    label: "Chờ Assistant",
    className:
      "bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400",
  },
  review: {
    label: "Chờ duyệt",
    className:
      "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400",
  },
  approved: {
    label: "Đã duyệt",
    className:
      "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  tantou: {
    label: `Chờ ${LABEL_TANTOU_EDITOR}`,
    className:
      "bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400",
  },
  done: {
    label: "Hoàn tất",
    className:
      "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
};

function EmptyWorkspaceState({ icon: Icon, title, description, action }) {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Icon className="size-7 text-muted-foreground" />
        </div>
        <div className="max-w-sm space-y-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

function TeRevisionInboxPanel({ revisions, onClose, onMarkRead }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="size-4 text-amber-600" />
          Thông báo chỉnh sửa
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Yêu cầu chỉnh sửa từ {LABEL_TANTOU_EDITOR} gửi về cho bạn.
        </p>
      </div>

      {revisions.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-medium">Không có thông báo chưa đọc</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Khi TE gửi yêu cầu chỉnh sửa mới, thông báo sẽ hiện lại tại đây.
          </p>
        </div>
      ) : (
        <ul className="max-h-[min(24rem,55vh)] space-y-2 overflow-y-auto pr-1">
          {revisions.map((item) => {
            const revisionPath = getMangakaTeRevisionPath(
              item.chapterId ?? item.id,
            );
            const comment = String(item.editorialComment ?? "").trim();
            const chapterId = item.chapterId ?? item.id;
            return (
              <li
                key={item.id}
                className="rounded-xl border bg-background p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {item.seriesTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ch. {item.chapterNum}
                      {item.pageLabel ? ` · ${item.pageLabel}` : ""}
                    </p>
                    {comment ? (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-foreground/80">
                        {comment}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        Không có ghi chú kèm theo.
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                  >
                    Cần sửa
                  </Badge>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {revisionPath ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-full gap-1.5"
                      asChild
                    >
                      <Link
                        to={revisionPath}
                        onClick={() => {
                          onMarkRead?.(chapterId);
                          onClose?.();
                        }}
                      >
                        Xem nhận xét & chỉnh sửa
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onMarkRead?.(chapterId);
                    }}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Xác nhận đã đọc
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function WorkspaceActionBar({
  pendingReviewCount,
  teReadyCount,
  tantouRevisionCount,
  incompleteSeriesCount,
  onOpenChaptersTab,
  onOpenSeriesTab,
  onOpenRevisionInbox,
}) {
  const hasStatusItems =
    pendingReviewCount > 0
    || teReadyCount > 0
    || tantouRevisionCount > 0
    || incompleteSeriesCount > 0;

  if (!hasStatusItems) return null;

  return (
    <div className="mk-action-bar mb-6 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Việc cần làm
      </span>
      {pendingReviewCount > 0 ? (
        <Button size="sm" variant="secondary" className="h-8 gap-1.5" asChild>
          <Link to="/mangaka/review">
            <ClipboardCheck className="size-3.5" />
            {pendingReviewCount} chờ duyệt Assistant
          </Link>
        </Button>
      ) : null}
      {teReadyCount > 0 ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-sky-200 bg-sky-50/50 text-sky-800 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
          onClick={onOpenChaptersTab}
        >
          <Users className="size-3.5" />
          {teReadyCount} sẵn sàng gửi {LABEL_TANTOU_EDITOR}
        </Button>
      ) : null}
      {tantouRevisionCount > 0 ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-amber-200 bg-amber-50/50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          onClick={onOpenRevisionInbox}
        >
          <Bell className="size-3.5" />
          {tantouRevisionCount} thông báo chỉnh sửa
        </Button>
      ) : null}
      {incompleteSeriesCount > 0 ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={onOpenSeriesTab}
        >
          <AlertTriangle className="size-3.5 text-amber-600" />
          {incompleteSeriesCount} series thiếu hồ sơ
        </Button>
      ) : null}
    </div>
  );
}

/** Tooltip that still works when the child button is disabled. */
function HoverHint({ hint, disabled = false, children, className }) {
  if (!disabled || !hint) return children;
  return (
    <span className={cn("group/hint relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 w-max max-w-[14rem] -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-left text-[11px] leading-snug text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/hint:opacity-100"
      >
        {hint}
      </span>
    </span>
  );
}

function SeriesCard({
  series,
  ebApproved,
  onOpenAnnotate,
  onOpenEdit,
  onDelete,
  onCompleteDebut,
  onRequestEnd,
  hasBlockingEndRequest = false,
  /** @deprecated */
  hasPendingEndRequest = false,
}) {
  const toSeries = seriesPath(series);
  const statusBadge = STATUS_BADGE[series.status] ?? STATUS_BADGE.draft;
  const initials = (
    series.title.length >= 2 ? series.title : `${series.title}●`
  ).slice(0, 2);
  const isAdminHidden = Boolean(series.deletedAt);
  const metaLine = formatSeriesCardLine(series);

  const coverStyle = {
    background: series.coverImage
      ? `url(${resolveMediaUrl(series.coverImage)}) center / cover no-repeat`
      : `linear-gradient(145deg, ${series.color}, ${series.color}99)`,
  };

  return (
    <Card
      className={cn(
        "group relative gap-0 overflow-hidden rounded-xl border-border/70 p-0 shadow-sm",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md",
        isAdminHidden && "opacity-90",
      )}
      title={
        isAdminHidden ? "Liên hệ Admin để biết thêm chi tiết" : undefined
      }
    >
      <div
        className="absolute inset-x-0 top-0 z-10 h-1"
        style={{ background: series.color }}
      />

      {isAdminHidden ? (
        <div className="relative block overflow-hidden">
          <div
            className="flex aspect-video items-center justify-center bg-muted text-2xl font-extrabold tracking-tight text-white opacity-50 grayscale"
            style={coverStyle}
          >
            {!series.coverImage ? (
              <span className="drop-shadow-lg">{initials}</span>
            ) : null}
          </div>
          <Badge className="absolute left-2.5 top-2.5 z-10 border-0 bg-red-600 text-white shadow-sm hover:bg-red-600">
            Đã bị Admin ẩn
          </Badge>
        </div>
      ) : (
        <Link
          to={toSeries}
          className="relative block cursor-pointer overflow-hidden"
          aria-label={`Mở ${series.title}`}
        >
          <div
            className="flex aspect-video items-center justify-center bg-muted text-2xl font-extrabold tracking-tight text-white transition-transform duration-300 ease-out group-hover:scale-105"
            style={coverStyle}
          >
            {!series.coverImage ? (
              <span className="drop-shadow-lg">{initials}</span>
            ) : null}
          </div>
          {series.needsFullDebutPipeline ? (
            <Badge className="absolute left-2.5 top-2.5 z-10 gap-1 bg-amber-500 text-white shadow-sm hover:bg-amber-500">
              <Sparkles className="size-3" />
              Lần đầu
            </Badge>
          ) : null}
        </Link>
      )}

      <CardContent className="space-y-2 p-3.5 pb-3">
        <div className="flex items-start justify-between gap-2">
          {isAdminHidden ? (
            <span
              className="line-clamp-2 text-[0.95rem] font-bold leading-snug tracking-tight text-zinc-500"
              title={series.title}
            >
              {series.title}
            </span>
          ) : (
            <Link
              to={toSeries}
              className="line-clamp-2 text-[0.95rem] font-bold leading-snug tracking-tight text-foreground transition-colors hover:text-rose-700 dark:hover:text-rose-300"
              title={series.title}
            >
              {series.title}
            </Link>
          )}
          {isAdminHidden ? (
            <Badge
              className="h-6 shrink-0 rounded-md border-red-200 bg-red-50 px-2 text-[11px] font-medium text-red-700"
              variant="outline"
            >
              Ẩn
            </Badge>
          ) : (
            <Badge
              className={cn(
                "h-6 shrink-0 rounded-md px-2 text-[11px] font-medium",
                statusBadge.className,
              )}
              variant="secondary"
            >
              {series.statusLabel ?? statusBadge.label}
            </Badge>
          )}
        </div>

        <p
          className="line-clamp-1 text-xs font-medium text-zinc-600 dark:text-zinc-300"
          title={metaLine}
        >
          {metaLine}
        </p>

        {series.ebAssessment ? (
          <p className="truncate text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            EB · DTB {Number(series.ebAssessment.average ?? 0).toFixed(1)}
            {series.ebAssessment.classification
              ? ` · ${series.ebAssessment.classification}`
              : ""}
          </p>
        ) : null}

        {!series.metadataComplete && !isAdminHidden ? (
          <p className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3 shrink-0" />
            Thiếu mô tả hồ sơ
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
          <span>{series.chapters} chapter</span>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <span>{series.marks} ghi chú</span>
          {series.updated ? (
            <>
              <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
                ·
              </span>
              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                {series.updated}
              </span>
            </>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="flex items-center gap-2 border-t border-border/70 bg-muted/15 p-3 pt-2.5">
        {isAdminHidden ? (
          <p className="w-full text-center text-xs text-zinc-500">
            Series đã bị Admin ẩn — không thể chỉnh sửa / đăng chapter.
          </p>
        ) : (
          <>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 min-w-0 flex-1 rounded-lg border-zinc-200 bg-background text-zinc-800 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
            >
              <Link to={toSeries}>Vào series</Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="size-8 shrink-0 rounded-lg border-zinc-200 p-0 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Tùy chọn series</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Thao tác nhanh
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="gap-2 rounded-lg"
                  onClick={onOpenEdit}
                >
                  <Pencil className="size-3.5 text-zinc-500" />
                  Chỉnh sửa hồ sơ
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 rounded-lg" asChild>
                  <Link to={toSeries}>
                    <Layers className="size-3.5 text-zinc-500" />
                    Quản lý chapter
                  </Link>
                </DropdownMenuItem>
                {series.status === "draft" ? (
                  <DropdownMenuItem
                    className="gap-2 rounded-lg"
                    onClick={onOpenAnnotate}
                  >
                    <PenSquare className="size-3.5 text-zinc-500" />
                    Đánh dấu vùng
                  </DropdownMenuItem>
                ) : null}
                {series.needsFullDebutPipeline && !ebApproved ? (
                  <DropdownMenuItem className="gap-2 rounded-lg" asChild>
                    <Link to={PATH_EDITOR_BOARD}>
                      <ClipboardCheck className="size-3.5 text-zinc-500" />
                      Chờ {LABEL_EDITOR_BOARD} duyệt
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {series.needsFullDebutPipeline && ebApproved ? (
                  <DropdownMenuItem
                    className="gap-2 rounded-lg"
                    onClick={onCompleteDebut}
                  >
                    <Sparkles className="size-3.5 text-zinc-500" />
                    Hoàn tất vòng đầu
                  </DropdownMenuItem>
                ) : null}
                {canRequestSeriesEnd(series.publicationStatus)
                  && !hasBlockingEndRequest
                  && !hasPendingEndRequest ? (
                  <DropdownMenuItem
                    className="gap-2 rounded-lg"
                    onClick={onRequestEnd}
                  >
                    <Flag className="size-3.5 text-zinc-500" />
                    Yêu cầu kết thúc truyện
                  </DropdownMenuItem>
                ) : null}
                {(hasBlockingEndRequest || hasPendingEndRequest) ? (
                  <DropdownMenuItem disabled className="gap-2 rounded-lg">
                    <Flag className="size-3.5" />
                    Đã có yêu cầu kết thúc
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator className="my-1.5" />
                <DropdownMenuItem
                  className="gap-2 rounded-lg text-destructive focus:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="size-3.5" />
                  Xóa series
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

export default function Mangaka() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getSession();
  const mangakaId = user?.id ?? null;
  const mangakaName = user?.name ?? "Mangaka";

  const {
    seriesList,
    setSeriesList,
    chapterRows,
    setChapterRows,
    annotatorChapters,
    setAnnotatorChapters,
    annotatorNotes,
    setAnnotatorNotes,
    rankings,
    loading: workspaceLoading,
    createSeries,
    updateSeries,
    removeSeries,
    createChapter,
    createChapterWithPages,
    uploadChapterPages,
    updateChapterCover,
    removeChapterCover,
    assignChapter,
    unassignChapter,
    updateChapterStatus,
    deleteChapterPage,
    deleteChapter,
    loadPageNotes,
    loadChapterPages,
    savePageNote,
    syncChapterNotes,
    deletePageNote,
    refresh: refreshWorkspace,
  } = useMangakaWorkspace(user);

  const {
    pendingReviews,
    teReadyChapters,
    refresh: refreshMangakaTasks,
    requestRevision,
  } = useMangakaTasks(chapterRows);

  const { assignees: hiredAssistants } = useMangakaCooperation();

  const [tab, setTab] = useState("series");
  const [annotateSeries, setAnnotateSeries] = useState("");
  const [blockingEndSeriesIds, setBlockingEndSeriesIds] = useState(() => new Set());
  /** @deprecated alias — dùng blockingEndSeriesIds */
  const pendingEndSeriesIds = blockingEndSeriesIds;
  const setPendingEndSeriesIds = setBlockingEndSeriesIds;
  const [endRequestSeries, setEndRequestSeries] = useState(null);
  const [addSeriesOpen, setAddSeriesOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState(null);
  const [uploadPctBySeries, setUploadPctBySeries] = useState({});
  const [annotatorActiveChapterId, setAnnotatorActiveChapterId] = useState(null);
  const [annotatorPageIndex, setAnnotatorPageIndex] = useState(0);
  const [revisionChapterId, setRevisionChapterId] = useState(null);
  const [annotatorChapterNum, setAnnotatorChapterNum] = useState("1");
  const [annotatorPagesPerChapter, setAnnotatorPagesPerChapter] = useState("");
  const [annotatorUploadPageBudget, setAnnotatorUploadPageBudget] = useState("");
  const [ebApprovedTick, setEbApprovedTick] = useState(0);

  // TE assignment — luồng mới
  const [teUsers, setTeUsers] = useState([]);          // danh sách TE active
  const [teLoading, setTeLoading] = useState(false);
  const [teSelectorOpen, setTeSelectorOpen] = useState(false); // dialog chọn TE
  const [selectedTeId, setSelectedTeId] = useState(null);      // TE đã chọn cho lastApprovedChapter
  const [teAssigning, setTeAssigning] = useState(false);      // đang gán
  const [teSending, setTeSending] = useState(false);          // đang gửi sang TE
  const [teSendChapter, setTeSendChapter] = useState(null);   // chapter đang mở dialog gửi TE
  const [teRevisionInboxOpen, setTeRevisionInboxOpen] = useState(false);
  const [openRevisionAfterSeriesTab, setOpenRevisionAfterSeriesTab] = useState(false);
  const [teRevisionSeenTick, setTeRevisionSeenTick] = useState(0);
  const [heroSlide, setHeroSlide] = useState(0);
  const [lastApprovedChapter, setLastApprovedChapter] = useState(null);

  const teTargetChapter = teSelectorOpen
    ? (teSendChapter ?? lastApprovedChapter)
    : (lastApprovedChapter ?? teSendChapter);

  useEffect(() => {
    if (tab !== "series" || !openRevisionAfterSeriesTab) return;
    setTeRevisionInboxOpen(true);
    setOpenRevisionAfterSeriesTab(false);
  }, [tab, openRevisionAfterSeriesTab]);

  // Load danh sách TE khi mở selector
  useEffect(() => {
    if (!teSelectorOpen) return;
    let cancelled = false;
    setTeLoading(true);
    submissionsService.getTeUsers()
      .then((users) => { if (!cancelled) setTeUsers(Array.isArray(users) ? users : []) })
      .catch(() => { if (!cancelled) setTeUsers([]) })
      .finally(() => { if (!cancelled) setTeLoading(false) });
    return () => { cancelled = true; };
  }, [teSelectorOpen]);

  useEffect(() => {
    let cancelled = false;
    seriesEndRequestsService
      .getMine({ page: 1, limit: 100 })
      .then((raw) => {
        if (cancelled) return;
        const mapped = mapSeriesEndRequestListResponse(raw);
        const next = new Set();
        for (const it of mapped.items) {
          if (!blocksNewEndRequest(it)) continue;
          const sid = String(it.seriesId ?? it.series?.id ?? "");
          if (sid) next.add(sid);
        }
        setBlockingEndSeriesIds(next);
      })
      .catch(() => {
        if (!cancelled) setBlockingEndSeriesIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [seriesList.length]);

  async function verifyChapterPagesReadyForTe(chapterId) {
    const pages = await loadChapterPages(chapterId, { force: true });
    const { resultCount, pageCount } = chapterPagesToCompareUrls(pages);
    if (pageCount > 0 && resultCount < pageCount) {
      throw new Error(
        `${pageCount - resultCount} trang chưa có ảnh kết quả từ Assistant.`,
      );
    }
    return pages;
  }

  function openTeSelector(chapter) {
    if (!chapter) return;
    const debutGate = findSeriesDebutGate(seriesList, chapter);
    if (!canSubmitMoreChaptersToTe(debutGate)) {
      toast.error(getDebutSubmitLockedMessage(debutGate));
      return;
    }
    setTeSendChapter(chapter);
    setSelectedTeId(chapter.teId ?? chapter.te_id ?? null);
    setTeSelectorOpen(true);
  }

  /** Bước 6 — Gán TE (không đổi status chapter). */
  async function handleAssignTe(teId) {
    const chapter = teTargetChapter;
    if (!chapter?.id || !teId) return;
    setTeAssigning(true);
    try {
      const res = await submissionsService.assignTe(chapter.id, teId);
      setSelectedTeId(teId);
      toast.success(res.message || "Đã gán TE cho chapter.");
      await refreshMangakaTasks();
      await refreshWorkspace();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Gán TE thất bại."));
    } finally {
      setTeAssigning(false);
    }
  }

  /** Bước 7 — Gửi chapter sang TE. teId optional: override hoặc broadcast. */
  async function handleSubmitToTe(teId) {
    const chapter = teTargetChapter;
    if (!chapter?.id) return;
    const apiStatus = chapter.apiStatus ?? chapter.status;
    if (!canMangakaSendToTe(apiStatus)) {
      toast.error("Chapter chưa sẵn sàng gửi TE. Vui lòng duyệt chapter trước.");
      return;
    }
    const debutGate = findSeriesDebutGate(seriesList, chapter);
    if (!canSubmitMoreChaptersToTe(debutGate)) {
      toast.error(getDebutSubmitLockedMessage(debutGate));
      return;
    }

    setTeSending(true);
    try {
      await verifyChapterPagesReadyForTe(chapter.id);
      // Đảm bảo te_id được set trước submit (cần cho TE te-action approve / publish).
      if (teId) {
        try {
          await submissionsService.assignTe(chapter.id, teId);
          setSelectedTeId(teId);
        } catch (assignErr) {
          const status = assignErr?.response?.status;
          // 400 đã gán cùng TE — vẫn tiếp tục submit
          if (status !== 400 && status !== 409) {
            throw assignErr;
          }
        }
      }
      const res = await submissionsService.submitChapterToTe(
        chapter.id,
        teId || undefined,
      );
      const phase = resolveTePhase({
        phase: res.phase,
        seriesStatus: res.seriesInfo?.status,
      });
      toast.success(
        res.message || mangakaTeSubmitMessage(phase),
      );
      setTeSelectorOpen(false);
      setLastApprovedChapter(null);
      setTeSendChapter(null);
      await refreshMangakaTasks();
      await refreshWorkspace();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, `Gửi sang ${LABEL_TANTOU_EDITOR} thất bại.`),
      );
    } finally {
      setTeSending(false);
    }
  }

  async function handleRemoveTe(chapterId) {
    try {
      await submissionsService.removeTe(chapterId);
      toast.success('Đã gỡ TE khỏi chapter.');
      await refreshMangakaTasks();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Gỡ TE thất bại.'));
    }
  }

  const nextChapterNumSuggest = useMemo(() => {
    const rows = chapterRows.filter(
      (c) => String(c.series) === String(annotateSeries),
    );
    const nums = rows
      .map((r) => {
        const n =
          typeof r.num === "number" ? r.num : parseInt(String(r.num), 10);
        return Number.isNaN(n) ? null : n;
      })
      .filter((n) => n !== null);
    if (!nums.length) return "1";
    return String(Math.max(...nums) + 1);
  }, [chapterRows, annotateSeries]);

  const chapterRowsBySeries = useMemo(() => {
    const order = [];
    const map = new Map();
    for (const row of chapterRows) {
      const key = row.series || "Khác";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key).push(row);
    }

    const pendingIds = new Set(
      (pendingReviews ?? [])
        .map((r) => String(r?.chapter?.id ?? ""))
        .filter(Boolean),
    );

    function chapterSortKey(row) {
      const n =
        typeof row?.num === "number"
          ? row.num
          : parseInt(String(row?.num ?? ""), 10);
      return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
    }

    const groups = order.map((series) => {
      const chapters = [...(map.get(series) ?? [])].sort((a, b) => {
        const aPending = pendingIds.has(String(a.id)) ? 0 : 1;
        const bPending = pendingIds.has(String(b.id)) ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        return chapterSortKey(a) - chapterSortKey(b);
      });
      const pendingCount = chapters.filter((c) =>
        pendingIds.has(String(c.id)),
      ).length;
      return { series, chapters, pendingCount };
    });

    groups.sort((a, b) => {
      if (a.pendingCount !== b.pendingCount) return b.pendingCount - a.pendingCount;
      return a.series.localeCompare(b.series, "vi");
    });

    return groups.map(({ series, chapters }) => ({ series, chapters }));
  }, [chapterRows, pendingReviews]);

  /**
   * Map chapterId → pendingReview để chapter card tra nhanh khi render.
   * pendingReview có dạng { chapter, task, tasks } — task đang ở trạng thái `submitted` / `in_review`.
   */
  const pendingReviewByChapter = useMemo(() => {
    const m = new Map();
    for (const r of pendingReviews ?? []) {
      if (r?.chapter?.id) m.set(String(r.chapter.id), r);
    }
    return m;
  }, [pendingReviews]);

  // State cho accept / send-back ngay trong chapter card (chapter có ảnh assistant đã gửi)
  const [cardRevision, setCardRevision] = useState(null); // { row, review, note, busy }

  function openCardRevision(row, review) {
    if (!row?.id || !review) return;
    setAnnotateSeries(row.series);
    setAnnotatorActiveChapterId(row.id);
    setAnnotatorPageIndex(0);
    setRevisionChapterId(String(row.id));
    setTab("annotate");
  }
  function closeCardRevision() {
    setCardRevision(null);
  }

  async function handleCardSendBack() {
    if (!cardRevision) return;
    const { row, review, note } = cardRevision;
    if (!review?.submission?.id && !row?.id) return;
    setCardRevision((s) => (s ? { ...s, busy: true } : s));
    try {
      const finalNote =
        note.trim() ||
        "Mangaka yêu cầu chỉnh sửa — xem ghi chú trên từng trang.";
      const chapterPages =
        annotatorChapters.find((ch) => String(ch.id) === String(row.id))?.pages
        ?? []
      await requestRevision([review], finalNote, {
        getAnnotationsForTask: (task) => {
          const pageId = task?.pageId
          if (!pageId) return []
          const pageIndex = chapterPages.findIndex(
            (p) => String(p?.id ?? p?._id) === String(pageId),
          )
          if (pageIndex < 0) return []
          return annotatorNotes[`${row.id}-${pageIndex}`] ?? []
        },
      });
      await updateChapterStatus(row.id, "assistant");
      toast.success(
        `Đã gửi lại chapter ${row.num} cho Assistant kèm ghi chú lỗi.`,
      );
      closeCardRevision();
      await refreshMangakaTasks();
      await refreshWorkspace();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Gửi lại cho Assistant thất bại."));
      setCardRevision((s) => (s ? { ...s, busy: false } : s));
    }
  }

  async function handleSendRevisionFromAnnotator({
    chapter,
    pages,
    notesByPage,
  }) {
    const chapterId = String(chapter?.id ?? "");
    const review = pendingReviewByChapter.get(chapterId);
    if (!chapterId || !review) {
      toast.error("Không tìm thấy task đang chờ Mangaka yêu cầu sửa.");
      return;
    }

    const allNotes = (pages ?? []).flatMap((_, pageIndex) =>
      notesByPage?.[`${chapterId}-${pageIndex}`] ?? [],
    );
    const noteText = allNotes
      .map((n) => String(n?.text ?? "").trim())
      .filter(Boolean)
      .join("\n")
      || "Mangaka yêu cầu chỉnh sửa — xem vùng đánh dấu trên từng trang.";

    await requestRevision([review], noteText, {
      getAnnotationsForTask: (task) => {
        const pageIndex = (pages ?? []).findIndex(
          (p) => String(p?.id ?? p?._id) === String(task?.pageId),
        );
        return pageIndex >= 0
          ? (notesByPage?.[`${chapterId}-${pageIndex}`] ?? [])
          : [];
      },
    });
    await updateChapterStatus(chapterId, "assistant");
    toast.success("Đã gửi yêu cầu sửa kèm vùng đánh dấu cho Assistant.");
    setRevisionChapterId(null);
    setTab("chapters");
    await refreshMangakaTasks();
    await refreshWorkspace();
  }

  // Chapter vừa duyệt xong — dùng để nhắc gửi Tantou
  useEffect(() => {
    if (!lastApprovedChapter) return
    const t = window.setTimeout(() => setLastApprovedChapter(null), 60_000)
    return () => window.clearTimeout(t)
  }, [lastApprovedChapter])

  const pendingReviewChapterIds = useMemo(
    () => (pendingReviews ?? []).map((r) => r?.chapter?.id).filter(Boolean).join("|"),
    [pendingReviews],
  );

  // Luồng pages: refresh pages từ BE khi có chapter chờ duyệt (lấy result_image_url mới).
  useEffect(() => {
    if (!pendingReviewChapterIds) return;
    const ids = pendingReviewChapterIds.split("|").filter(Boolean);
    let cancelled = false;
    Promise.all(ids.map((id) => loadChapterPages(id, { force: true })))
      .then(() => { if (cancelled) void 0 })
      .catch(() => { if (cancelled) void 0 });
    return () => { cancelled = true };
  }, [pendingReviewChapterIds, loadChapterPages]);

  const seriesRankings = useMemo(() => {
    const titles = new Set(seriesList.map((s) => s.title));
    return rankings.filter((r) => titles.has(r.title) || titles.size === 0);
  }, [seriesList, rankings]);

  const atRiskSeries = useMemo(
    () => seriesRankings.filter((r) => r.atRisk),
    [seriesRankings],
  );

  const incompleteSeriesCount = useMemo(
    () => seriesList.filter((s) => !s.metadataComplete).length,
    [seriesList],
  );

  const userInitials = useMemo(() => {
    const parts = String(mangakaName ?? "MK").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return String(mangakaName ?? "MK").slice(0, 2).toUpperCase();
  }, [mangakaName]);

  const ebApprovedMap = useMemo(
    () => readEbDebutApproved(),
    [ebApprovedTick, seriesList],
  );

  const annotateChapters = useMemo(() => {
    const statusById = new Map(
      (chapterRows ?? []).map((row) => [String(row.id), row.apiStatus ?? null]),
    );
    return (annotatorChapters ?? []).map((ch) => {
      const fromRow = statusById.get(String(ch.id));
      const apiStatus = fromRow ?? ch.apiStatus ?? null;
      return {
        ...ch,
        apiStatus,
        pages: stampAssistantApprovedOnPages(ch.id, ch.pages ?? []),
      };
    });
  }, [annotatorChapters, chapterRows]);

  // Chapter đã approved_by_mangaka → đánh dấu session để Upload & ghi chú hiện ảnh result + ẩn note cũ
  useEffect(() => {
    for (const row of chapterRows ?? []) {
      if (shouldShowAssistantEditedOnAnnotate(row.apiStatus)) {
        markAssistantApprovedPages(row.id, [], { markAll: true });
      }
    }
  }, [chapterRows]);

  const workspaceApi = useMemo(
    () => ({
      createChapter,
      createChapterWithPages,
      uploadChapterPages,
      updateChapterCover,
      removeChapterCover,
      deleteChapterPage,
      deleteChapter,
      loadChapterPages,
      loadPageNotes,
      savePageNote,
      syncChapterNotes,
      deletePageNote,
      refresh: refreshWorkspace,
    }),
    [
      createChapter,
      createChapterWithPages,
      uploadChapterPages,
      updateChapterCover,
      removeChapterCover,
      deleteChapterPage,
      deleteChapter,
      loadChapterPages,
      loadPageNotes,
      savePageNote,
      syncChapterNotes,
      deletePageNote,
      refreshWorkspace,
    ],
  );

  /**
   * Luồng mới: Gửi chapter cho Assistant.
   * Bước 1 — POST /chapters/:id/assign { assistant_id } (nếu chưa gán hoặc đổi assistant).
   * Bước 2 — PATCH /chapters/:id { action: 'submit', assigned_to, revision_notes, revision_annotations }.
   *   BE tự động tạo Task cho mỗi Page chưa có task (kèm PageNote + region + assigned_to).
   *   assigned_to trong body là backup — BE có thể đọc từ body hoặc fallback về chapter.assistant_id đã set ở bước 1.
   *   Đổi status chapter → pending_assistant.
   */
  async function handleSendToAssistant({
    chapter,
    pages,
    assistantId,
    notesByPage,
  }) {
    if (!chapter?.id) return
    if (!pages?.length) {
      toast.error('Chapter chưa có trang nào — upload ảnh trước.')
      return
    }
    if (!assistantId) {
      toast.error('Chọn Assistant trước khi gửi chapter.')
      return
    }

    const targetAssistantId = String(assistantId)
    const chapterRow = chapterRows.find(r => r.id === chapter.id)
    const currentAssistantId = chapterRow?.assistantId ? String(chapterRow.assistantId) : null

    try {
      const notesSource = notesByPage ?? annotatorNotes

      // Đồng bộ note lên BE trước khi gom payload (Assistant đọc GET /pages/:id/notes)
      const syncedNotes = await syncChapterNotes(chapter.id, pages, notesSource)

      // Gom ghi chú để đính kèm revision_notes (string) + revision_annotations (array có toạ độ)
      const allNotes = []
      const annotationMap = {}  // pageIndex → array of annotation objects with coords

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const page = pages[pageIndex]
        if (!page?.id) continue
        const pageKey = `${chapter.id}-${pageIndex}`
        const pageNotes = syncedNotes[pageKey]?.length
          ? syncedNotes[pageKey]
          : await loadPageNotes(page.id, pageKey)

        const annotations = []
        for (const note of pageNotes) {
          const text = String(note.text ?? '').trim()
          allNotes.push({ pageNum: pageIndex + 1, note, text })
          // Chỉ ghi annotation nếu note có toạ độ cụ thể (không phải full-canvas)
          const hasCoords = Number(note.x) || Number(note.y) || Number(note.w) || Number(note.h)
          if (hasCoords) {
            annotations.push({
              text,
              x: Number(note.x) || 0,
              y: Number(note.y) || 0,
              w: Number(note.w) || 0,
              h: Number(note.h) || 0,
              taskType: note.taskType ?? 'other',
              error_type: uiTaskTypeToErrorType(note.taskType),
            })
          }
        }
        if (annotations.length > 0) {
          annotationMap[`page_${pageIndex}`] = annotations
        }
      }

      const revisionNotes = allNotes.length
        ? allNotes
            .map(({ pageNum, note }) => {
              const taskLabel = note.taskType ? `[${note.taskType}] ` : ''
              const text = String(note.text ?? '').trim()
              return `Trang ${pageNum}: ${taskLabel}${text || 'Cần xử lý.'}`
            })
            .join('\n')
        : `Xử lý toàn bộ chapter ${chapter.num} (${pages.length} trang).`

      // Bước 1 — đảm bảo gán assistant
      if (!currentAssistantId || currentAssistantId !== targetAssistantId) {
        try {
          await assignChapter(chapter.id, targetAssistantId)
        } catch (err) {
          const status = err?.response?.status
          const message = String(err?.response?.data?.message ?? '')
          const alreadyAssigned = status === 400 && /assistant|đã có/i.test(message)
          if (alreadyAssigned) {
            await chaptersService.unassignAssistant(chapter.id).catch(() => null)
            await assignChapter(chapter.id, targetAssistantId)
          } else if (status !== 409) {
            throw err
          }
        }
      }

      // Bước 2 — PATCH action:submit (BE gắn PageNote → task.note_ids + xử lý revision_annotations)
      const submitPayload = {
        assigned_to: targetAssistantId,
        revision_notes: revisionNotes,
        ...(Object.keys(annotationMap).length > 0 ? { revision_annotations: annotationMap } : {}),
      }

      await chaptersService.update(chapter.id, {
        action: 'submit',
        ...submitPayload,
      })

      // Bước 3 — cập nhật UI
      await updateChapterStatus(chapter.id, 'assistant')
      await refreshMangakaTasks()
      await refreshWorkspace()

      // Ẩn các ô ghi chú của chapter sau khi đã gửi cho Assistant
      setAnnotatorNotes((prev) => {
        const next = {}
        for (const [key, value] of Object.entries(prev)) {
          if (!key.startsWith(`${chapter.id}-`)) next[key] = value
        }
        return next
      })

      toast.success(
        `Đã gửi chapter ${chapter.num} (${pages.length} trang) cho Assistant.`,
      )
    } catch (err) {
      console.error('[SEND-ASSISTANT] error', err)
      toast.error(getApiErrorMessage(err, 'Gửi chapter cho Assistant thất bại.'))
    }
  }

  async function sendChapterToTantou({
    series,
    chapter,
    pageIndex = 0,
    pageName,
    notes = [],
    imageOverride,
  }) {
    if (!chapter?.series || !chapter?.id) return;
    const debutGate = findSeriesDebutGate(seriesList, chapter);
    if (!canSubmitMoreChaptersToTe(debutGate)) {
      toast.error(getDebutSubmitLockedMessage(debutGate));
      return;
    }
    try {
      const res = await submissionsService.submitChapterToTe(chapter.id);
      setChapterRows((prev) =>
        prev.map((r) =>
          r.id === chapter.id
            ? {
                ...r,
                status: "tantou",
                statusLabel: `Chờ ${LABEL_TANTOU_EDITOR}`,
              }
            : r,
        ),
      );
      setAnnotatorNotes((prev) => {
        const next = {};
        for (const [key, value] of Object.entries(prev)) {
          if (!key.startsWith(`${chapter.id}-`)) next[key] = value;
        }
        return next;
      });
      toast.success(
        res.message || `Đã gửi Ch. ${chapter.num} sang ${LABEL_TANTOU_EDITOR}.`,
      );
      await refreshWorkspace();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, `Gửi chapter sang ${LABEL_TANTOU_EDITOR} thất bại.`),
      );
    }
  }

  function handleSendToTantou({
    chapter,
    pageIndex,
    pageUrl,
    pageName,
    notes,
  }) {
    const series = seriesList.find((s) => s.title === chapter.series);
    sendChapterToTantou({
      series,
      chapter,
      pageIndex,
      pageName,
      notes,
      imageOverride: pageUrl,
    });
  }

  const tantouRevisions = useMemo(
    () =>
      chapterRows
        .filter((row) => String(row.apiStatus ?? "").toLowerCase() === "te_revision")
        .map((row) => ({
          id: row.id,
          chapterId: row.id,
          seriesTitle: row.series,
          chapterNum: row.num,
          pageLabel: row.title ? String(row.title) : `Chapter ${row.num}`,
          editorialComment: row.revisionNotes ?? "",
        })),
    [chapterRows],
  );

  const unreadTeRevisions = useMemo(() => {
    void teRevisionSeenTick;
    return tantouRevisions.filter(
      (item) => !isTeRevisionSeen(item.chapterId ?? item.id),
    );
  }, [tantouRevisions, teRevisionSeenTick]);

  useEffect(() => {
    if (HERO_IMAGES.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setHeroSlide((index) => (index + 1) % HERO_IMAGES.length);
    }, HERO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // Tránh prune khi chưa load xong (tantouRevisions = []) — sẽ xóa sạch localStorage "đã xem".
    if (workspaceLoading) return;
    pruneTeRevisionSeen(
      tantouRevisions.map((item) => item.chapterId ?? item.id),
    );
  }, [tantouRevisions, workspaceLoading]);

  useEffect(() => {
    function bumpSeen() {
      setTeRevisionSeenTick((t) => t + 1);
    }
    window.addEventListener(TE_REVISION_SEEN_EVENT, bumpSeen);
    window.addEventListener("storage", bumpSeen);
    return () => {
      window.removeEventListener(TE_REVISION_SEEN_EVENT, bumpSeen);
      window.removeEventListener("storage", bumpSeen);
    };
  }, []);

  useEffect(() => {
    const pending = seriesList
      .filter((s) => s.needsFullDebutPipeline)
      .map(seriesToExternalSummary);
    syncEbDebutPendingFromSeries(pending);
  }, [seriesList]);

  useEffect(() => {
    function bumpEbApproved() {
      setEbApprovedTick((t) => t + 1);
    }
    window.addEventListener("mk-eb-approved-update", bumpEbApproved);
    window.addEventListener("storage", bumpEbApproved);
    return () => {
      window.removeEventListener("mk-eb-approved-update", bumpEbApproved);
      window.removeEventListener("storage", bumpEbApproved);
    };
  }, []);

  useEffect(() => {
    setAnnotatorChapterNum(nextChapterNumSuggest);
  }, [annotateSeries, nextChapterNumSuggest]);

  useEffect(() => {
    // Đừng ghi đè lựa chọn khi seriesList đang load (race với location.state / openAnnotate).
    if (seriesList.length === 0) return;

    if (!annotateSeries) return;

    const stillExists = seriesList.some((s) => s.title === annotateSeries);
    if (!stillExists) {
      // Series đã bị xóa / đổi tên — để trống, không nhảy sang series đầu danh sách.
      setAnnotateSeries("");
    }
  }, [seriesList, annotateSeries]);

  useEffect(() => {
    const marksBySeries = {};
    annotatorChapters.forEach((ch) => {
      let c = 0;
      ch.pages.forEach((_, pi) => {
        c += annotatorNotes[`${ch.id}-${pi}`]?.length ?? 0;
      });
      marksBySeries[ch.series] = (marksBySeries[ch.series] ?? 0) + c;
    });
    setSeriesList((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        const nextMarks = marksBySeries[s.title];
        if (nextMarks === undefined) return s;
        if (s.marks !== nextMarks) {
          changed = true;
          return { ...s, marks: nextMarks };
        }
        return s;
      });
      return changed ? next : prev;
    });
  }, [annotatorChapters, annotatorNotes]);

  function handleUploadProgress(series, pct) {
    const key = series.trim();
    if (!key) return;
    if (pct === 0 || pct === undefined) {
      setUploadPctBySeries((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setUploadPctBySeries((prev) => ({ ...prev, [key]: pct }));
  }

  useEffect(() => {
    if (!addSeriesOpen) return;
    function onKey(e) {
      if (e.key === "Escape") setAddSeriesOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addSeriesOpen]);

  function openAddSeriesModal() {
    setEditingSeries(null);
    setAddSeriesOpen(true);
  }
  function openEditSeriesModal(series) {
    setEditingSeries(series);
    setAddSeriesOpen(true);
  }
  function closeAddSeriesModal() {
    setAddSeriesOpen(false);
    setEditingSeries(null);
  }

  async function confirmUpdateSeries(form, meta) {
    if (!editingSeries) return;
    try {
      const updated = await updateSeries(editingSeries, form, meta?.coverFile ?? null);
      syncEbDebutPendingFromSeries(
        seriesList
          .map(s => (s.id === editingSeries.id ? updated : s))
          .filter((s) => s.needsFullDebutPipeline)
          .map(seriesToExternalSummary),
      );
      if (annotateSeries === editingSeries.title) setAnnotateSeries(updated.title);
      closeAddSeriesModal();
      navigate(seriesPath(updated));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Cập nhật series thất bại."));
    }
  }

  async function confirmAddSeries(form, meta) {
    try {
      const newSeries = await createSeries(form);
      setAnnotateSeries(newSeries.title);
      closeAddSeriesModal();
      navigate(seriesPath(newSeries));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Tạo series thất bại."));
    }
  }

  const existingSeriesTitles = useMemo(
    () => seriesList.map((s) => s.title),
    [seriesList],
  );

  function completeDebutPipeline(seriesId) {
    const target = seriesList.find((x) => x.id === seriesId);
    if (target?.title) removeEbDebutApproval(target.title);
    setSeriesList((prev) =>
      prev.map((s) =>
        s.id === seriesId
          ? {
              ...s,
              needsFullDebutPipeline: false,
              statusLabel:
                s.status === "draft"
                  ? `Luồng ngắn (chỉ ${LABEL_TANTOU_EDITOR})`
                  : s.statusLabel,
              updated: "Đã chuyển sang luồng lần 2",
            }
          : s,
      ),
    );
  }

  async function deleteSeriesById(seriesId) {
    const target = seriesList.find((x) => x.id === seriesId);
    if (!target) return;
    const title = target.title;
    const ok = window.confirm(
      `Xóa series "${title}"?\n\nCác chapter của series này sẽ bị gỡ. Thao tác không hoàn tác.`,
    );
    if (!ok) return;

    removeEbDebutApproval(title);
    try {
      await removeSeries(seriesId);
      setAnnotateSeries((cur) =>
        cur !== title ? cur : (seriesList.filter(s => s.id !== seriesId)[0]?.title ?? ""),
      );
      toast.success(`Đã xóa series "${title}".`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Xóa series thất bại."));
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromQuery = params.get("tab");
    if (
      tabFromQuery
      && MANGAKA_WORKSPACE_TAB_IDS.includes(tabFromQuery)
    ) {
      setTab(tabFromQuery);
    }
  }, [location.search]);

  useEffect(() => {
    const st = location.state;
    if (!st || typeof st !== "object") return;
    if (
      st.tab === "chapters" ||
      st.tab === "annotate" ||
      st.tab === "series" ||
      st.tab === "assistants"
    )
      setTab(st.tab);
    if (typeof st.series === "string" && st.series.trim())
      setAnnotateSeries(st.series.trim());
    if (typeof st.chapterId === "string" && st.chapterId) {
      setAnnotatorActiveChapterId(st.chapterId);
      setAnnotatorPageIndex(0);
      setRevisionChapterId(st.revision === true ? st.chapterId : null);
    }
  }, [location.state]);

  function openAnnotate(seriesTitle, chapterLocalId) {
    setAnnotateSeries(seriesTitle);
    setTab("annotate");
    setRevisionChapterId(null);
    if (chapterLocalId) {
      setAnnotatorActiveChapterId(chapterLocalId);
      setAnnotatorPageIndex(0);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="ws-page--mangaka flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <section className="ws-hero--mangaka mk-hero-slideshow relative overflow-hidden border-b border-white/5 text-white">
        <div className="mk-hero-slides" aria-hidden>
          {HERO_IMAGES.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className={cn(
                "mk-hero-slides__img",
                index === heroSlide && "mk-hero-slides__img--active",
              )}
            />
          ))}
        </div>
        <div className="mk-hero-slides__veil" aria-hidden />
        <div className="page-container relative py-10 md:py-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <Badge
                variant="secondary"
                className="bg-white/10 text-white hover:bg-white/15"
              >
                Mangaka Workspace
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                {`Xin chào${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
              </h1>
              <p className="leading-relaxed text-zinc-300">
                {`Quản lý series, upload chapter và phối hợp Assistant · ${LABEL_TANTOU_EDITOR} · ${LABEL_EDITOR_BOARD}.`}
              </p>
            </div>
            <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-sm md:flex">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 text-sm font-bold text-white shadow-lg shadow-rose-900/30">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{mangakaName}</p>
                <p className="text-xs text-white/80">Tác giả · Workspace</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="page-container mk-main flex-1 py-8">
        {tab !== "annotate" && tab !== "assistants" && tab !== "series" ? (
          <WorkspaceActionBar
            pendingReviewCount={pendingReviews.length}
            teReadyCount={teReadyChapters.length}
            tantouRevisionCount={unreadTeRevisions.length}
            incompleteSeriesCount={incompleteSeriesCount}
            onOpenChaptersTab={() => setTab("chapters")}
            onOpenSeriesTab={() => setTab("series")}
            onOpenRevisionInbox={() => {
              if (tab !== "series") {
                setOpenRevisionAfterSeriesTab(true);
                setTab("series");
                return;
              }
              setTeRevisionInboxOpen(true);
            }}
          />
        ) : null}

        <div
          className={cn(
            'mk-layout grid gap-6',
            tab !== 'annotate' && 'mk-layout--with-sidebar lg:grid-cols-[1fr_300px]',
          )}
        >
          <div className="mk-content min-w-0">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsContent value="series" className="mk-panel space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Series của tôi</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Quản lý hồ sơ từng series
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <DropdownMenu
                      open={teRevisionInboxOpen}
                      onOpenChange={setTeRevisionInboxOpen}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(
                            "h-9 shrink-0 gap-1.5 rounded-lg border-zinc-200 bg-zinc-50/80 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-100 dark:hover:bg-zinc-800",
                            unreadTeRevisions.length > 0
                              && "border-amber-200/90 bg-amber-50 text-amber-950 hover:bg-amber-100/90 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
                            unreadTeRevisions.length > 0
                              && teRevisionInboxOpen
                              && "border-amber-300 bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15",
                          )}
                        >
                          <Bell className="size-3.5" />
                          Thông báo chỉnh sửa
                          {unreadTeRevisions.length > 0 ? (
                            <Badge
                              variant="secondary"
                              className="h-5 min-w-5 justify-center rounded-md bg-amber-600 px-1.5 text-[10px] text-white hover:bg-amber-600"
                            >
                              {unreadTeRevisions.length}
                            </Badge>
                          ) : null}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="w-[min(calc(100vw-2rem),24rem)] rounded-xl p-3"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                      >
                        <TeRevisionInboxPanel
                          revisions={unreadTeRevisions}
                          onClose={() => setTeRevisionInboxOpen(false)}
                          onMarkRead={(chapterId) => {
                            markTeRevisionSeen(chapterId);
                          }}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1.5 rounded-lg border-zinc-200 bg-zinc-50/80 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      asChild
                    >
                      <Link to="/mangaka/end-requests">
                        <Flag className="size-3.5" />
                        Yêu cầu kết thúc
                        {pendingEndSeriesIds.size > 0 ? (
                          <Badge
                            variant="secondary"
                            className="ml-0.5 h-5 min-w-5 justify-center rounded-md bg-amber-600 px-1.5 text-[10px] text-white hover:bg-amber-600"
                          >
                            {pendingEndSeriesIds.size}
                          </Badge>
                        ) : null}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1.5 rounded-lg border-rose-200/80 bg-rose-50/70 text-rose-800 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
                      onClick={openAddSeriesModal}
                    >
                      <Plus className="size-4" />
                      Đăng ký series
                    </Button>
                  </div>
                </div>

                {seriesList.length === 0 ? (
                  <EmptyWorkspaceState
                    icon={BookOpen}
                    title="Chưa có series nào"
                    description="Đăng ký series đầu tiên để bắt đầu upload chapter và gửi cho Assistant."
                    action={(
                      <Button onClick={openAddSeriesModal}>
                        <Plus className="size-4" />
                        Đăng ký series
                      </Button>
                    )}
                  />
                ) : (
                  <div className="mk-series-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {seriesList.map((s) => (
                      <SeriesCard
                        key={s.id}
                        series={s}
                        ebApproved={!!ebApprovedMap[s.title]}
                        onOpenAnnotate={() => openAnnotate(s.title)}
                        onOpenEdit={() => openEditSeriesModal(s)}
                        onDelete={() => deleteSeriesById(s.id)}
                        onCompleteDebut={() => completeDebutPipeline(s.id)}
                        hasBlockingEndRequest={blockingEndSeriesIds.has(String(s.id))}
                        hasPendingEndRequest={blockingEndSeriesIds.has(String(s.id))}
                        onRequestEnd={() => setEndRequestSeries(s)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="chapters" className="mk-panel space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-zinc-50">
                      Chapter đã upload
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                      {chapterRows.length} chapter · {chapterRowsBySeries.length} series
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5 rounded-lg border-zinc-200 bg-zinc-50/80 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    disabled={seriesList.length === 0}
                    onClick={() => {
                      if (annotateSeries) {
                        openAnnotate(annotateSeries);
                        return;
                      }
                      setTab("annotate");
                    }}
                  >
                    <Upload className="size-4" />
                    Upload mới
                  </Button>
                </div>

                {chapterRowsBySeries.length === 0 ? (
                  <EmptyWorkspaceState
                    icon={FileText}
                    title="Chưa có chapter"
                    description="Vào tab Upload & ghi chú để tạo chapter và tải ảnh trang lên."
                    action={(
                      <Button
                        disabled={seriesList.length === 0}
                        onClick={() => {
                          if (annotateSeries) {
                            openAnnotate(annotateSeries);
                            return;
                          }
                          setTab("annotate");
                        }}
                      >
                        <PenSquare className="size-4" />
                        Mở Upload & ghi chú
                      </Button>
                    )}
                  />
                ) : (
                  <div className="mk-chapter-registry space-y-6">
                    {chapterRowsBySeries.map(({ series, chapters: groupChapters }) => {
                      const seriesMeta = seriesList.find(x => x.title === series);
                      const slug = seriesMeta?.slug ?? slugifySeriesTitle(series);
                      const color = seriesMeta?.color ?? '#6366f1';
                      return (
                        <div
                          key={series}
                          className="mk-chapter-registry__series overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
                        >
                          <Link
                            to={`/mangaka/series/${slug}`}
                            className="mk-chapter-registry__series-head group flex items-center gap-3 rounded-t-xl bg-gray-50/80 px-4 py-3 transition-colors hover:bg-gray-100/90 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
                          >
                            <span
                              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold text-white shadow-sm"
                              style={{ background: color }}
                            >
                              {(series[0] || '?').toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-gray-900 group-hover:underline dark:text-zinc-50">
                                {series}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-zinc-400">
                                {groupChapters.length} chapter
                                {seriesMeta?.needsFullDebutPipeline ? (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600">
                                    <Sparkles className="size-2.5" /> Lần đầu
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <span className="inline-flex items-center text-xs font-medium text-gray-500 transition-colors group-hover:text-gray-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                              Xem series
                              <ChevronRight className="ml-0.5 size-3.5" />
                            </span>
                          </Link>

                          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3">
                            {groupChapters.map((c) => {
                              const annot = resolveAnnotatorChapter(c, annotatorChapters);
                              const review = pendingReviewByChapter.get(String(c.id));
                              const pageCompare = chapterPagesToCompareUrls(annot?.pages ?? []);
                              const resultUrls = pageCompare.results.filter(Boolean);
                              const hasSubmittedImages = Boolean(review && pageCompare.resultCount > 0);
                              const firstResultUrl = hasSubmittedImages ? resultUrls[0] : null;
                              const chapterCoverUrl = resolveMediaUrl(
                                annot?.cover?.url
                                || c.coverUrl
                                || seriesMeta?.coverImage
                                || null,
                              ) || null;
                              // Ưu tiên ảnh bìa chapter/series; chỉ dùng ảnh Assistant khi chưa có cover.
                              const thumbUrl = chapterCoverUrl || firstResultUrl || null;
                              const statusBadge = hasSubmittedImages
                                ? { label: 'Đã gửi ảnh', className: 'bg-emerald-100/90 text-emerald-800 hover:bg-emerald-100/90 dark:bg-emerald-500/20 dark:text-emerald-200' }
                                : (STATUS_BADGE[c.status] ?? STATUS_BADGE.draft);
                              const debutGate = findSeriesDebutGate(seriesList, c);
                              const debutSubmitAllowed = canSubmitMoreChaptersToTe(debutGate);
                              const canSendTe =
                                canMangakaSendToTe(c.apiStatus) && debutSubmitAllowed;
                              const pageCount = Math.max(
                                Number(c.pages) || 0,
                                Array.isArray(annot?.pages) ? annot.pages.length : 0,
                              );
                              return (
                                <div
                                  key={c.id}
                                  className="group/card relative flex flex-col overflow-hidden rounded-xl border border-border/70 bg-white transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:bg-card"
                                >
                                  <Link
                                    to={`/mangaka/series/${slug}/chapter/${c.id}`}
                                    className="flex flex-1 flex-col"
                                  >
                                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-zinc-800">
                                      {thumbUrl ? (
                                        <img
                                          src={thumbUrl}
                                          alt=""
                                          className="size-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                                        />
                                      ) : (
                                        <div className="flex size-full items-center justify-center text-gray-400">
                                          <BookOpen className="size-8 opacity-40" />
                                        </div>
                                      )}
                                      <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-1.5 p-2">
                                        {hasSubmittedImages ? (
                                          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                                            Assistant · {resultUrls.length}
                                          </span>
                                        ) : (
                                          <span />
                                        )}
                                        <span
                                          className={cn(
                                            "rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md",
                                            hasSubmittedImages
                                              ? "bg-emerald-100/90 text-emerald-800"
                                              : cn("shadow-sm", statusBadge.className),
                                          )}
                                        >
                                          {statusBadge.label}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                                      <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-zinc-50">
                                        Ch. {c.num}
                                        {c.title ? (
                                          <span className="text-gray-800 dark:text-zinc-200">
                                            {" "}· {c.title}
                                          </span>
                                        ) : null}
                                      </p>
                                      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500 dark:text-zinc-400">
                                        <span className="font-medium uppercase tracking-wide text-gray-600 dark:text-zinc-300">
                                          {c.type}
                                        </span>
                                        <span className="text-gray-300 dark:text-zinc-600" aria-hidden>·</span>
                                        <span>{pageCount} trang</span>
                                        {c.date ? (
                                          <>
                                            <span className="text-gray-300 dark:text-zinc-600" aria-hidden>·</span>
                                            <span>{c.date}</span>
                                          </>
                                        ) : null}
                                        {c.assistantName ? (
                                          <>
                                            <span className="text-gray-300 dark:text-zinc-600" aria-hidden>·</span>
                                            <span className="truncate">{c.assistantName}</span>
                                          </>
                                        ) : null}
                                      </p>
                                    </div>
                                  </Link>

                                  {/* Hành động cho chapter chờ Mangaka duyệt */}
                                  {review ? (
                                    <div className="flex gap-2 border-t border-border/70 bg-gray-50/60 px-3 py-2.5 dark:bg-zinc-900/40">
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        className="flex-1 border-red-100 bg-red-50 font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-600 dark:hover:text-white"
                                        asChild
                                      >
                                        <Link to={`/mangaka/review/chapter/${c.id}`}>
                                          <ClipboardCheck className="size-3" />
                                          Xem & duyệt
                                        </Link>
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        className="flex-1 border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                        onClick={() => openCardRevision(c, review)}
                                      >
                                        <Send className="size-3" />
                                        Gửi lại
                                      </Button>
                                    </div>
                                  ) : null}
                                  {canSendTe ? (
                                    <div className="border-t border-border/70 bg-sky-50/40 px-3 py-2.5 dark:bg-sky-500/5">
                                      <Button
                                        size="xs"
                                        variant="secondary"
                                        className="w-full"
                                        onClick={() => openTeSelector(c)}
                                      >
                                        <Users className="size-3" />
                                        Gửi cho {LABEL_TANTOU_EDITOR}
                                      </Button>
                                    </div>
                                  ) : canMangakaSendToTe(c.apiStatus) && !debutSubmitAllowed ? (
                                    <div className="border-t border-border/70 bg-muted/30 px-3 py-2.5">
                                      <p className="text-[11px] leading-snug text-muted-foreground">
                                        Đang khóa debut — chờ EB confirm-publish rồi mới gửi chapter tiếp.
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assistants" className="mk-panel">
                <MangakaAssistants />
              </TabsContent>

              <TabsContent value="annotate" className="mk-panel">
                <ChapterAnnotator
                  selectedSeriesTitle={annotateSeries}
                  onSelectedSeriesTitleChange={setAnnotateSeries}
                  seriesOptions={seriesList.map((s) => ({
                    id: s.id,
                    title: s.title,
                    needsFullDebutPipeline: !!s.needsFullDebutPipeline,
                  }))}
                  chapterNum={annotatorChapterNum}
                  onChapterNumChange={setAnnotatorChapterNum}
                  chapters={annotateChapters}
                  setChapters={setAnnotatorChapters}
                  activeChapterId={annotatorActiveChapterId}
                  setActiveChapterId={setAnnotatorActiveChapterId}
                  pageIndex={annotatorPageIndex}
                  setPageIndex={setAnnotatorPageIndex}
                  notes={annotatorNotes}
                  setNotes={setAnnotatorNotes}
                  hiredAssistants={hiredAssistants}
                  onOpenAssistantsTab={() => setTab("assistants")}
                  onUploadProgress={handleUploadProgress}
                  onSendToAssistant={handleSendToAssistant}
                  onSendRevision={handleSendRevisionFromAnnotator}
                  workspaceApi={workspaceApi}
                  pendingReviewCount={pendingReviews.length}
                  revisionMode={
                    Boolean(revisionChapterId)
                    && String(revisionChapterId) === String(annotatorActiveChapterId)
                  }
                />
              </TabsContent>
            </Tabs>
          </div>

          {tab !== "annotate" ? (
          <aside className="mk-sidebar sticky top-4 space-y-4 self-start">
            {(lastApprovedChapter
              || teReadyChapters.length > 0
              || tantouRevisions.length > 0
              || pendingReviews.length > 0) ? (
              <Card className="mk-sidebar-card rounded-xl border-primary/15 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="size-4 text-primary" />
                    Việc tiếp theo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingReviews.length > 0 ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200/80 bg-rose-50/70 px-3.5 py-3 dark:border-rose-500/25 dark:bg-rose-500/10">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                          Ưu tiên
                        </p>
                        <p className="mt-0.5 text-sm text-foreground">
                          <strong>{pendingReviews.length}</strong> chapter chờ duyệt Assistant
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 rounded-lg border-rose-300 bg-white/80 text-rose-800 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                        asChild
                      >
                        <Link to="/mangaka/review">Duyệt</Link>
                      </Button>
                    </div>
                  ) : null}

                  {lastApprovedChapter ? (
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 dark:border-emerald-500/30 dark:bg-emerald-500/5">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="size-4 shrink-0" />
                        Đã duyệt Ch. {lastApprovedChapter.num}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {lastApprovedChapter.series}
                      </p>
                      {(() => {
                        const gate = findSeriesDebutGate(seriesList, lastApprovedChapter);
                        const allowSubmit = canSubmitMoreChaptersToTe(gate);
                        const lockedHint = allowSubmit
                          ? ""
                          : (getDebutSubmitLockedMessage(gate)
                            || "Cần hoàn thành xác nhận trước khi gửi");
                        return (
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="xs"
                              variant="outline"
                              className="rounded-lg"
                              onClick={() => setLastApprovedChapter(null)}
                            >
                              Để sau
                            </Button>
                            <HoverHint disabled={!allowSubmit} hint={lockedHint}>
                              <Button
                                size="xs"
                                variant="outline"
                                className="rounded-lg border-emerald-300 bg-white/80 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                                disabled={!allowSubmit}
                                onClick={() => openTeSelector(lastApprovedChapter)}
                              >
                                Gửi {LABEL_TANTOU_EDITOR}
                              </Button>
                            </HoverHint>
                          </div>
                        );
                      })()}
                      {!canSubmitMoreChaptersToTe(
                        findSeriesDebutGate(seriesList, lastApprovedChapter),
                      ) ? (
                        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                          Đang khóa debut — chờ EB confirm-publish.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {teReadyChapters.slice(0, 3).map(({ chapter, submission }) => {
                    const payload = {
                      ...chapter,
                      apiStatus: submission?.status ?? chapter.apiStatus,
                      te_id: submission?.te_id,
                    };
                    const gate = findSeriesDebutGate(seriesList, payload);
                    const allowSubmit = canSubmitMoreChaptersToTe(gate);
                    const lockedHint = allowSubmit
                      ? ""
                      : (getDebutSubmitLockedMessage(gate)
                        || "Cần hoàn thành xác nhận trước khi gửi");
                    return (
                    <div
                      key={chapter.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-sky-200/70 bg-sky-50/50 px-3 py-2.5 dark:border-sky-500/25 dark:bg-sky-500/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {chapter.series} · Ch. {chapter.num}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {allowSubmit
                            ? `Sẵn sàng gửi ${LABEL_TANTOU_EDITOR}`
                            : "Khóa debut — chờ confirm-publish"}
                        </p>
                      </div>
                      <HoverHint disabled={!allowSubmit} hint={lockedHint}>
                        <Button
                          size="xs"
                          variant="outline"
                          className="rounded-lg border-sky-300 bg-white/80 text-sky-800 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200"
                          disabled={!allowSubmit}
                          onClick={() => openTeSelector(payload)}
                        >
                          Gửi
                        </Button>
                      </HoverHint>
                    </div>
                    );
                  })}

                  {tantouRevisions.slice(0, 2).map((s) => {
                    const revisionPath = getMangakaTeRevisionPath(s.chapterId ?? s.id);
                    return (
                      <div key={s.id} className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-500/25 dark:bg-amber-500/5">
                        <p className="text-sm font-medium text-foreground">{s.seriesTitle}</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Ch. {s.chapterNum} · nhận xét {LABEL_TANTOU_EDITOR}
                        </p>
                        {revisionPath ? (
                          <Link
                            to={revisionPath}
                            className="mt-2 inline-flex items-center text-xs font-medium text-amber-800 hover:underline dark:text-amber-300"
                          >
                            Xem chi tiết
                            <ChevronRight className="size-3" />
                          </Link>
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ) : null}

            {tab !== "annotate" && seriesRankings.length > 0 ? (
              <Card className="mk-sidebar-card rounded-xl shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="size-4 text-emerald-600" />
                    Bảng xếp hạng
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {seriesRankings.map((r) => {
                    const cover = seriesList.find((s) => s.title === r.title)?.coverImage;
                    const coverUrl = cover ? resolveMediaUrl(cover) : null;
                    return (
                      <div
                        key={r.title}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border border-border/70 p-2.5",
                          r.atRisk &&
                            "border-amber-200 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5",
                        )}
                      >
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-[10px] font-bold text-muted-foreground">
                              {(r.title?.[0] || "#").toUpperCase()}
                            </div>
                          )}
                          <span
                            className={cn(
                              "absolute left-0.5 top-0.5 flex size-5 items-center justify-center rounded-md text-[10px] font-bold shadow-sm",
                              r.rank === 1
                                ? "bg-amber-500 text-white"
                                : r.rank === 2
                                  ? "bg-zinc-400 text-white"
                                  : r.rank === 3
                                    ? "bg-orange-600 text-white"
                                    : "bg-background text-foreground ring-1 ring-border",
                            )}
                          >
                            #{r.rank}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {r.title}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                              {r.reads}
                            </span>
                            {" "}đọc
                            <span className="mx-1 text-border">·</span>
                            <span className="tabular-nums">{r.delta}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {atRiskSeries.length > 0 ? (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                      <p className="flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="size-3" />
                        Cảnh báo huỷ series
                      </p>
                      {atRiskSeries.map((r) => (
                        <p
                          key={r.title}
                          className="mt-1 text-amber-800/90 dark:text-amber-300/90"
                        >
                          {r.title}: {r.riskReason}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {tab !== "annotate" ? (
              <Card className="mk-sidebar-card mk-sidebar-card--tip border-primary/20 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="size-4 text-primary" />
                    Mẹo nhanh
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Chọn loại việc (nền, tô bóng, hiệu ứng) cho từng vùng trước
                    khi gửi Assistant — giảm vòng chỉnh sửa.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={seriesList.length === 0}
                    onClick={() => {
                      if (annotateSeries) {
                        openAnnotate(annotateSeries);
                        return;
                      }
                      setTab("annotate");
                    }}
                  >
                    Bắt đầu ghi chú
                    <ArrowRight className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </aside>
          ) : null}
        </div>
      </main>

      <Footer />

      <Dialog open={Boolean(cardRevision)} onOpenChange={(o) => { if (!o) closeCardRevision() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Gửi lại cho Assistant
              {cardRevision?.row ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  · Ch. {cardRevision.row.num} — {cardRevision.row.series}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Mô tả lỗi sai để Assistant chỉnh lại ảnh. Ảnh gốc và ghi chú trên từng trang sẽ được giữ nguyên.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="card-revision-note">Ghi chú lỗi</Label>
            <Textarea
              id="card-revision-note"
              rows={4}
              placeholder="VD: Trang 3–5 tô bóng chưa đều, trang 7 màu nền lệch..."
              value={cardRevision?.note ?? ""}
              onChange={(e) =>
                setCardRevision((s) => (s ? { ...s, note: e.target.value } : s))
              }
            />
            <p className="text-[10px] text-muted-foreground">
              Bỏ trống sẽ dùng ghi chú mặc định.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCardRevision} disabled={cardRevision?.busy}>
              Huỷ
            </Button>
            <Button
              disabled={cardRevision?.busy}
              onClick={() => void handleCardSendBack()}
            >
              <Send className="size-3.5" />
              {cardRevision?.busy ? "Đang gửi..." : "Gửi lại cho Assistant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TE Selector Dialog — luồng mới */}
      <Dialog open={teSelectorOpen} onOpenChange={setTeSelectorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4" />
              Chọn {LABEL_TANTOU_EDITOR}
            </DialogTitle>
            <DialogDescription>
              {teTargetChapter
                ? `Ch. ${teTargetChapter.num} — ${teTargetChapter.series}. Có thể chọn TE rồi gửi, hoặc Gửi tất cả TE. TE có thể tự nhận chapter khi phê duyệt (auto-claim) nếu chưa gán.`
                : "Chọn TE để gán cho chapter này."}
            </DialogDescription>
          </DialogHeader>

          {teLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <span>Đang tải danh sách TE...</span>
            </div>
          ) : teUsers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 size-8 opacity-30" />
              <p>Không tìm thấy TE nào đang active.</p>
              <p className="mt-1 text-xs">
                Vui lòng liên hệ admin để thêm TE vào hệ thống.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {teUsers.map((te) => (
                <button
                  key={te._id}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    selectedTeId === te._id
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/30",
                  )}
                  onClick={() => setSelectedTeId(te._id)}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {(te.full_name || te.username || 'TE')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {te.full_name || te.username || 'TE'}
                    </p>
                    {te.email ? (
                      <p className="truncate text-xs text-muted-foreground">{te.email}</p>
                    ) : null}
                  </div>
                  {selectedTeId === te._id ? (
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              ))}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setTeSelectorOpen(false)}
              disabled={teAssigning || teSending}
            >
              Huỷ
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!selectedTeId || teAssigning || teSending || teLoading}
                onClick={() => void handleAssignTe(selectedTeId)}
              >
                {teAssigning ? "Đang gán..." : "Gán TE"}
              </Button>
              <Button
                variant="outline"
                disabled={
                  teSending
                  || teLoading
                  || !canSubmitMoreChaptersToTe(
                    findSeriesDebutGate(seriesList, teTargetChapter),
                  )
                }
                onClick={() => void handleSubmitToTe(null)}
              >
                {teSending ? "Đang gửi..." : "Gửi tất cả TE"}
              </Button>
              <Button
                disabled={
                  teSending
                  || teLoading
                  || !canSubmitMoreChaptersToTe(
                    findSeriesDebutGate(seriesList, teTargetChapter),
                  )
                }
                onClick={() => void handleSubmitToTe(selectedTeId || undefined)}
              >
                {teSending ? "Đang gửi..." : selectedTeId ? "Gửi cho TE đã chọn" : "Gửi cho TE"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddSeriesModal
        open={addSeriesOpen}
        mode={editingSeries ? "edit" : "create"}
        initialSeries={editingSeries}
        onClose={closeAddSeriesModal}
        onSubmit={(form) =>
          editingSeries ? confirmUpdateSeries(form) : confirmAddSeries(form)
        }
        authorName={user?.name}
        existingTitles={existingSeriesTitles}
      />

      <SeriesEndRequestDialog
        key={endRequestSeries?.id ?? "end-closed"}
        series={endRequestSeries}
        open={Boolean(endRequestSeries)}
        onClose={() => setEndRequestSeries(null)}
        hasActiveRequest={
          endRequestSeries
            ? blockingEndSeriesIds.has(String(endRequestSeries.id))
            : false
        }
        hasPending={
          endRequestSeries
            ? blockingEndSeriesIds.has(String(endRequestSeries.id))
            : false
        }
        onSubmitted={() => {
          if (!endRequestSeries?.id) return
          setBlockingEndSeriesIds((prev) => {
            const next = new Set(prev)
            next.add(String(endRequestSeries.id))
            return next
          })
        }}
      />
    </div>
  );
}
