import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Lightbulb,
  ListChecks,
  MoreHorizontal,
  PenSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { WorkspaceHero } from "@/components/layout/WorkspaceHero.jsx";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSession, logout } from "@/lib/auth.js";
import { cn } from "@/lib/utils";
import ChapterAnnotator from "./ChapterAnnotator.jsx";
import AddSeriesModal from "./AddSeriesModal.jsx";
import MangakaAssistants from "./MangakaAssistants.jsx";
import { seriesPath } from "./SeriesUploadDetail.jsx";
import {
  LABEL_EDITOR_BOARD,
  LABEL_TANTOU_EDITOR,
  PATH_EDITOR_BOARD,
} from "@/constants/roleTerminology.js";
import { getMangakaTeRevisionPath } from "@/utils/notificationTarget.js";
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
import { uiNoteToTaskCreate, uiChapterToTaskCreate, uiTaskTypeToErrorType, canMangakaSendToTe, chapterPagesToCompareUrls, apiTaskToUi } from "@/utils/apiMappers.js";
import { useMangakaTasks } from "@/hooks/useMangakaTasks.js";
import { dedupeTasksByPage } from "@/utils/chapterTaskFlow.js";
import {
  mangakaTeSubmitMessage,
  resolveTePhase,
} from "@/utils/teReviewPhase.js";
import { useMangakaCooperation } from "@/hooks/useMangakaCooperation.js";
import {
  formatSeriesCardLine,
  seriesToExternalSummary,
  slugifySeriesTitle,
} from "@/utils/seriesModel.js";
import "@/styles/mangaPage.css";
import "./Mangaka.css";

const NAV_LINKS = [{ to: "/", label: "Trang chủ" }];

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

const PIPELINE_DEBUT_STEPS = [
  { step: 1, title: "Mangaka → Assistant", desc: "Gửi ảnh + ghi chú gộp → 1 task = 1 chapter" },
  {
    step: 2,
    title: "Assistant → Mangaka",
    desc: "Nộp ảnh kết quả cả chapter, bạn duyệt / yêu cầu sửa",
  },
  {
    step: 3,
    title: `Mangaka → ${LABEL_TANTOU_EDITOR}`,
    desc: "Chuyển bản đã duyệt sang Tantou Editor",
  },
  {
    step: 4,
    title: `${LABEL_TANTOU_EDITOR} → ${LABEL_EDITOR_BOARD}`,
    desc: "Tantou Editor duyệt rồi đưa lên Editor Board",
  },
  {
    step: 5,
    title: `${LABEL_EDITOR_BOARD} biểu quyết`,
    desc: "Editor Board chấp nhận → thông báo Mangaka",
  },
  {
    step: 6,
    title: "Xuất bản",
    desc: "Phát hành sau khi Editor Board đồng thuận",
  },
];

const PIPELINE_RECURRING_STEPS = [
  {
    step: 1,
    title: `Mangaka → ${LABEL_TANTOU_EDITOR}`,
    desc: "Gửi chapter / bản thảo",
  },
  {
    step: 2,
    title: `${LABEL_TANTOU_EDITOR} duyệt`,
    desc: "Chỉnh sửa & phê duyệt",
  },
  { step: 3, title: "Xuất bản", desc: `Không cần vòng ${LABEL_EDITOR_BOARD}` },
];

const TAB_ITEMS = [
  { id: "series", label: "Series", icon: BookOpen },
  { id: "chapters", label: "Chapter", icon: FileText },
  { id: "assistants", label: "Thuê Assistant", icon: UserPlus },
  { id: "annotate", label: "Upload & ghi chú", icon: PenSquare },
];

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

function WorkspaceActionBar({
  pendingReviewCount,
  teReadyCount,
  tantouRevisionCount,
  incompleteSeriesCount,
  onOpenChaptersTab,
  onOpenSeriesTab,
  onOpenAssistantsTab,
}) {
  const hasItems =
    pendingReviewCount > 0
    || teReadyCount > 0
    || tantouRevisionCount > 0
    || incompleteSeriesCount > 0;

  if (!hasItems) return null;

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
          onClick={onOpenChaptersTab}
        >
          <ListChecks className="size-3.5" />
          {tantouRevisionCount} nhận xét {LABEL_TANTOU_EDITOR}
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
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto h-8 text-muted-foreground"
        onClick={onOpenAssistantsTab}
      >
        <UserPlus className="size-3.5" />
        Thuê Assistant
      </Button>
    </div>
  );
}

function SeriesCard({
  series,
  ebApproved,
  uploadPct,
  onOpenAnnotate,
  onOpenEdit,
  onDelete,
  onCompleteDebut,
}) {
  const isUploading = uploadPct > 0 && uploadPct < 100;
  const barPct = isUploading ? uploadPct : Math.min(100, series.progress ?? 0);
  const toSeries = seriesPath(series);
  const statusBadge = STATUS_BADGE[series.status] ?? STATUS_BADGE.draft;
  const initials = (
    series.title.length >= 2 ? series.title : `${series.title}●`
  ).slice(0, 2);

  return (
    <Card className="group relative gap-0 overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div
        className="absolute inset-x-0 top-0 z-10 h-1"
        style={{ background: series.color }}
      />

      <Link to={toSeries} className="relative block overflow-hidden">
        <div
          className="aspect-[3/4] flex items-center justify-center bg-muted text-3xl font-extrabold tracking-tight text-white transition-transform duration-300 group-hover:scale-[1.02]"
          style={{
            background: series.coverImage
              ? `url(${resolveMediaUrl(series.coverImage)}) center / cover no-repeat`
              : `linear-gradient(145deg, ${series.color}, ${series.color}99)`,
          }}
        >
          {!series.coverImage ? (
            <span className="drop-shadow-lg">{initials}</span>
          ) : null}
        </div>
        {series.needsFullDebutPipeline ? (
          <Badge className="absolute left-3 top-3 bg-amber-500 text-white shadow-sm hover:bg-amber-500">
            <Sparkles className="size-3" />
            Lần đầu
          </Badge>
        ) : null}
      </Link>

      <CardContent className="space-y-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={toSeries}
            className="line-clamp-2 font-semibold leading-snug hover:underline"
            title={series.title}
          >
            {series.title}
          </Link>
          <Badge className={cn("shrink-0", statusBadge.className)} variant="secondary">
            {series.statusLabel ?? statusBadge.label}
          </Badge>
        </div>

        <p className="line-clamp-1 text-xs text-muted-foreground">
          {formatSeriesCardLine(series)}
        </p>

        {series.ebAssessment ? (
          <p className="truncate text-xs font-medium text-emerald-700 dark:text-emerald-400">
            EB · DTB {Number(series.ebAssessment.average ?? 0).toFixed(1)}
            {series.ebAssessment.classification
              ? ` · ${series.ebAssessment.classification}`
              : ""}
          </p>
        ) : null}

        {!series.metadataComplete ? (
          <p className="flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="size-3 shrink-0" />
            Thiếu mô tả hồ sơ
          </p>
        ) : null}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{series.chapters} chapter</span>
          <span aria-hidden>·</span>
          <span>{series.marks} ghi chú</span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{isUploading ? "Đang tải" : "Tiến độ"}</span>
            <span className="font-medium tabular-nums">{Math.round(barPct)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${barPct}%`, background: series.color }}
            />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">{series.updated}</p>
      </CardContent>

      <CardFooter className="flex items-center gap-2 border-t bg-muted/20 p-3">
        <Button asChild size="sm" className="min-w-0 flex-1">
          <Link to={toSeries}>Vào series</Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="size-8 shrink-0 p-0">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Tùy chọn series</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onOpenEdit}>Chỉnh sửa hồ sơ</DropdownMenuItem>
            {series.status === "draft" ? (
              <DropdownMenuItem onClick={onOpenAnnotate}>Đánh dấu vùng</DropdownMenuItem>
            ) : null}
            {series.needsFullDebutPipeline && !ebApproved ? (
              <DropdownMenuItem asChild>
                <Link to={PATH_EDITOR_BOARD}>
                  Chờ {LABEL_EDITOR_BOARD} duyệt
                </Link>
              </DropdownMenuItem>
            ) : null}
            {series.needsFullDebutPipeline && ebApproved ? (
              <DropdownMenuItem onClick={onCompleteDebut}>
                Hoàn tất vòng đầu
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
              Xóa series
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
    assignChapter,
    unassignChapter,
    updateChapterStatus,
    deleteChapterPage,
    loadPageNotes,
    loadChapterPages,
    savePageNote,
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
  const [addSeriesOpen, setAddSeriesOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState(null);
  const [uploadPctBySeries, setUploadPctBySeries] = useState({});
  const [annotatorActiveChapterId, setAnnotatorActiveChapterId] = useState(null);
  const [annotatorPageIndex, setAnnotatorPageIndex] = useState(0);
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
  const [lastApprovedChapter, setLastApprovedChapter] = useState(null);

  const teTargetChapter = teSelectorOpen
    ? (teSendChapter ?? lastApprovedChapter)
    : (lastApprovedChapter ?? teSendChapter);

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

    setTeSending(true);
    try {
      await verifyChapterPagesReadyForTe(chapter.id);
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

  const annotateChapterHint = useMemo(() => {
    const n = chapterRows.filter((c) => c.series === annotateSeries).length;
    const tail = n
      ? `${n} dòng trong bảng Chapter`
      : "Chưa có dòng trong bảng Chapter";
    return `Gợi ý tiếp theo Ch. ${nextChapterNumSuggest} · ${tail}`;
  }, [chapterRows, annotateSeries, nextChapterNumSuggest]);

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
    return order.map((series) => ({ series, chapters: map.get(series) }));
  }, [chapterRows]);

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
    setCardRevision({ row, review, note: "", busy: false });
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
      await requestRevision([review], finalNote);
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

  const pipelineSeries = useMemo(
    () => seriesList.find((s) => s.title === annotateSeries) ?? seriesList[0],
    [seriesList, annotateSeries],
  );

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

  const workspaceApi = useMemo(
    () => ({
      createChapter,
      createChapterWithPages,
      uploadChapterPages,
      deleteChapterPage,
      loadChapterPages,
      loadPageNotes,
      savePageNote,
      deletePageNote,
      refresh: refreshWorkspace,
    }),
    [
      createChapter,
      createChapterWithPages,
      uploadChapterPages,
      deleteChapterPage,
      loadChapterPages,
      loadPageNotes,
      savePageNote,
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
      // Gom ghi chú để đính kèm revision_notes (string) + revision_annotations (array có toạ độ)
      const allNotes = []
      const annotationMap = {}  // pageIndex → array of annotation objects with coords

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const page = pages[pageIndex]
        if (!page?.id) continue
        const pageKey = `${chapter.id}-${pageIndex}`
        const pageNotes = annotatorNotes[pageKey]?.length
          ? annotatorNotes[pageKey]
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

      // Bước 2 — gửi chapter cho Assistant.
      // LUỒNG 2: POST /chapters đã tạo 1 task/trang — không gọi action:submit (tránh tạo task trùng).
      const existingRaw = await tasksService.getByChapter(chapter.id).catch(() => [])
      const existingTasks = dedupeTasksByPage(
        (Array.isArray(existingRaw) ? existingRaw : []).map(apiTaskToUi),
      )
      const pageIds = new Set(
        pages.map((p) => String(p.id)).filter(Boolean),
      )
      const taskPageIds = new Set(
        existingTasks.map((t) => String(t.pageId)).filter(Boolean),
      )
      const tasksAlreadyCoverPages =
        pageIds.size > 0 && [...pageIds].every((id) => taskPageIds.has(id))

      const submitPayload = {
        assigned_to: targetAssistantId,
        revision_notes: revisionNotes,
        ...(Object.keys(annotationMap).length > 0 ? { revision_annotations: annotationMap } : {}),
      }

      if (tasksAlreadyCoverPages) {
        await chaptersService.update(chapter.id, submitPayload)
      } else {
        await chaptersService.update(chapter.id, {
          action: 'submit',
          ...submitPayload,
        })
      }

      // Bước 3 — cập nhật UI
      await updateChapterStatus(chapter.id, 'assistant')
      await refreshMangakaTasks()
      await refreshWorkspace()

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
      toast.success(
        res.message || `Đã gửi Ch. ${chapter.num} sang ${LABEL_TANTOU_EDITOR}.`,
      );
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

  const workflowSteps = useMemo(() => {
    if (!pipelineSeries) return PIPELINE_DEBUT_STEPS;
    return pipelineSeries.needsFullDebutPipeline
      ? PIPELINE_DEBUT_STEPS
      : PIPELINE_RECURRING_STEPS;
  }, [pipelineSeries]);

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
    if (seriesList.length === 0) {
      setAnnotateSeries("");
      return;
    }
    if (
      !annotateSeries ||
      !seriesList.some((s) => s.title === annotateSeries)
    ) {
      setAnnotateSeries(seriesList[0].title);
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
    }
  }, [location.state]);

  function openAnnotate(seriesTitle, chapterLocalId) {
    setAnnotateSeries(seriesTitle);
    setTab("annotate");
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

      <WorkspaceHero
        className="border-b-0 bg-[linear-gradient(135deg,#141210_0%,#1f1518_45%,#151c28_100%)]"
        label="Mangaka Workspace"
        title={`Xin chào${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={`Quản lý series, upload chapter và phối hợp Assistant · ${LABEL_TANTOU_EDITOR} · ${LABEL_EDITOR_BOARD}.`}
        badge={(
          <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-sm md:flex">
            <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 text-sm font-bold text-white shadow-lg shadow-rose-900/30">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{mangakaName}</p>
              <p className="text-xs text-zinc-400">Tác giả · Workspace</p>
            </div>
          </div>
        )}
      />

      <main className="page-container mk-main flex-1 py-8">
        {tab !== "annotate" ? (
          <WorkspaceActionBar
            pendingReviewCount={pendingReviews.length}
            teReadyCount={teReadyChapters.length}
            tantouRevisionCount={tantouRevisions.length}
            incompleteSeriesCount={incompleteSeriesCount}
            onOpenChaptersTab={() => setTab("chapters")}
            onOpenSeriesTab={() => setTab("series")}
            onOpenAssistantsTab={() => setTab("assistants")}
          />
        ) : null}

        <div className={cn("mk-layout grid gap-6", tab !== "annotate" && "lg:grid-cols-[1fr_300px]")}>
          <div className="mk-content min-w-0">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mk-tabs mb-5 h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
                {TAB_ITEMS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger
                      key={t.id}
                      value={t.id}
                      className="gap-2 data-[state=active]:shadow-sm"
                    >
                      <Icon className="size-4" />
                      {t.label}
                      {t.id === "chapters" && pendingReviews.length > 0 ? (
                        <Badge
                          variant="secondary"
                          className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
                        >
                          {pendingReviews.length}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="series" className="mk-panel space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Series của tôi</h2>
                    <p className="text-sm text-muted-foreground">
                      Quản lý hồ sơ và tiến độ từng series
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openAddSeriesModal}
                  >
                    <Plus className="size-4" />
                    Đăng ký series
                  </Button>
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
                  <div className="mk-series-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {seriesList.map((s) => (
                      <SeriesCard
                        key={s.id}
                        series={s}
                        ebApproved={!!ebApprovedMap[s.title]}
                        uploadPct={uploadPctBySeries[s.title] ?? 0}
                        onOpenAnnotate={() => openAnnotate(s.title)}
                        onOpenEdit={() => openEditSeriesModal(s)}
                        onDelete={() => deleteSeriesById(s.id)}
                        onCompleteDebut={() => completeDebutPipeline(s.id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="chapters" className="mk-panel space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Chapter đã upload</h2>
                    <p className="text-sm text-muted-foreground">
                      {chapterRows.length} chapter · {chapterRowsBySeries.length} series
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={seriesList.length === 0}
                    onClick={() => seriesList[0] && openAnnotate(seriesList[0].title)}
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
                        onClick={() => setTab("annotate")}
                      >
                        <PenSquare className="size-4" />
                        Mở Upload & ghi chú
                      </Button>
                    )}
                  />
                ) : (
                  <div className="mk-chapter-registry space-y-8">
                    {chapterRowsBySeries.map(({ series, chapters: groupChapters }) => {
                      const seriesMeta = seriesList.find(x => x.title === series);
                      const slug = seriesMeta?.slug ?? slugifySeriesTitle(series);
                      const color = seriesMeta?.color ?? '#6366f1';
                      return (
                        <div
                          key={series}
                          className="mk-chapter-registry__series overflow-hidden rounded-xl border bg-card shadow-sm"
                        >
                          <Link
                            to={`/mangaka/series/${slug}`}
                            className="mk-chapter-registry__series-head group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                          >
                            <span
                              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold text-white shadow-sm"
                              style={{ background: color }}
                            >
                              {(series[0] || '?').toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold group-hover:underline">{series}</p>
                              <p className="text-xs text-muted-foreground">
                                {groupChapters.length} chapter
                                {seriesMeta?.needsFullDebutPipeline ? (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600">
                                    <Sparkles className="size-2.5" /> Lần đầu
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                              Xem series
                              <ChevronRight className="ml-0.5 inline size-3.5" />
                            </span>
                          </Link>

                          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                            {groupChapters.map((c) => {
                              const annot = resolveAnnotatorChapter(c, annotatorChapters);
                              const review = pendingReviewByChapter.get(String(c.id));
                              const pageCompare = chapterPagesToCompareUrls(annot?.pages ?? []);
                              const resultUrls = pageCompare.results.filter(Boolean);
                              const hasSubmittedImages = Boolean(review && pageCompare.resultCount > 0);
                              const firstResultUrl = hasSubmittedImages ? resultUrls[0] : null;
                              const originalUrl = annot?.pages?.find(p => p?.url)?.url;
                              // Đã có ảnh assistant → hiện ảnh kết quả làm thumbnail, đánh dấu "đã chỉnh"
                              const thumbUrl = hasSubmittedImages ? firstResultUrl : originalUrl;
                              const statusBadge = hasSubmittedImages
                                ? { label: 'Đã gửi ảnh', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' }
                                : (STATUS_BADGE[c.status] ?? STATUS_BADGE.draft);
                              const canSendTe = canMangakaSendToTe(c.apiStatus);
                              return (
                                <div
                                  key={c.id}
                                  className="group/card relative flex flex-col overflow-hidden rounded-lg border bg-background transition-all hover:-translate-y-0.5 hover:shadow-md"
                                >
                                  <Link
                                    to={`/mangaka/series/${slug}/chapter/${c.id}`}
                                    className="flex flex-1 flex-col"
                                  >
                                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                                      {thumbUrl ? (
                                        <img
                                          src={thumbUrl}
                                          alt=""
                                          className="size-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                                        />
                                      ) : (
                                        <div className="flex size-full items-center justify-center text-muted-foreground">
                                          <BookOpen className="size-8 opacity-30" />
                                        </div>
                                      )}
                                      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
                                        {hasSubmittedImages ? (
                                          <Badge
                                            variant="secondary"
                                            className="bg-black/65 text-[10px] text-white hover:bg-black/65"
                                          >
                                            Assistant · {resultUrls.length}
                                          </Badge>
                                        ) : (
                                          <span />
                                        )}
                                        <Badge className={cn("shadow-sm", statusBadge.className)} variant="secondary">
                                          {statusBadge.label}
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="flex flex-1 flex-col gap-1 p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-semibold leading-tight">
                                          Ch. {c.num}
                                          {c.title ? (
                                            <span className="ml-1 font-normal text-muted-foreground">
                                              · {c.title}
                                            </span>
                                          ) : null}
                                        </p>
                                        <Badge variant="outline" className="shrink-0 text-[10px]">
                                          {c.type}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {c.pages} trang
                                        {c.assistantName ? ` · ${c.assistantName}` : ""}
                                      </p>
                                      <p className="mt-auto text-[11px] text-muted-foreground">
                                        {c.date}
                                      </p>
                                    </div>
                                  </Link>

                                  {/* Hành động cho chapter chờ Mangaka duyệt */}
                                  {review ? (
                                    <div className="flex gap-2 border-t bg-muted/30 px-3 py-2">
                                      <Button
                                        size="xs"
                                        variant="default"
                                        className="flex-1"
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
                                        className="flex-1"
                                        onClick={() => openCardRevision(c, review)}
                                      >
                                        <Send className="size-3" />
                                        Gửi lại
                                      </Button>
                                    </div>
                                  ) : null}
                                  {canSendTe ? (
                                    <div className="border-t bg-sky-50/40 px-3 py-2 dark:bg-sky-500/5">
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
                  chapterNumHint={annotateChapterHint}
                  chapters={annotatorChapters}
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
                  onSendToTantou={handleSendToTantou}
                  workspaceApi={workspaceApi}
                />
              </TabsContent>
            </Tabs>
          </div>

          {tab !== "annotate" ? (
          <aside className="mk-sidebar space-y-4">
            {(lastApprovedChapter
              || teReadyChapters.length > 0
              || tantouRevisions.length > 0
              || pendingReviews.length > 0) ? (
              <Card className="mk-sidebar-card border-primary/15 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="size-4 text-primary" />
                    Việc tiếp theo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingReviews.length > 0 ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                      <p className="text-sm">
                        <strong>{pendingReviews.length}</strong> chapter chờ duyệt Assistant
                      </p>
                      <Button size="xs" asChild>
                        <Link to="/mangaka/review">Duyệt</Link>
                      </Button>
                    </div>
                  ) : null}

                  {lastApprovedChapter ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/5">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-4 shrink-0" />
                        Đã duyệt Ch. {lastApprovedChapter.num}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {lastApprovedChapter.series}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setLastApprovedChapter(null)}
                        >
                          Để sau
                        </Button>
                        <Button
                          size="xs"
                          onClick={() => openTeSelector(lastApprovedChapter)}
                        >
                          Gửi {LABEL_TANTOU_EDITOR}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {teReadyChapters.slice(0, 3).map(({ chapter, submission }) => (
                    <div
                      key={chapter.id}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {chapter.series} · Ch. {chapter.num}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Sẵn sàng gửi {LABEL_TANTOU_EDITOR}
                        </p>
                      </div>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() =>
                          openTeSelector({
                            ...chapter,
                            apiStatus: submission?.status ?? chapter.apiStatus,
                            te_id: submission?.te_id,
                          })
                        }
                      >
                        Gửi
                      </Button>
                    </div>
                  ))}

                  {tantouRevisions.slice(0, 2).map((s) => {
                    const revisionPath = getMangakaTeRevisionPath(s.chapterId ?? s.id);
                    return (
                      <div key={s.id} className="rounded-lg border bg-card p-3">
                        <p className="text-sm font-medium">{s.seriesTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          Ch. {s.chapterNum} · nhận xét {LABEL_TANTOU_EDITOR}
                        </p>
                        {revisionPath ? (
                          <Link
                            to={revisionPath}
                            className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
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

            <Card className="mk-sidebar-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Workflow className="size-4 text-primary" />
                  Quy trình làm việc
                </CardTitle>
                <CardDescription>
                  Theo series{" "}
                  <strong className="text-foreground">
                    {pipelineSeries?.title ?? "—"}
                  </strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge
                  className={
                    pipelineSeries?.needsFullDebutPipeline
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400"
                  }
                  variant="secondary"
                >
                  {pipelineSeries?.needsFullDebutPipeline
                    ? `✦ Lần đầu · có ${LABEL_EDITOR_BOARD}`
                    : `Lần 2+ · chỉ ${LABEL_TANTOU_EDITOR}`}
                </Badge>

                {pipelineSeries?.needsFullDebutPipeline &&
                pipelineSeries.title &&
                !ebApprovedMap[pipelineSeries.title] ? (
                  <p className="text-xs text-muted-foreground">
                    Chờ {LABEL_EDITOR_BOARD} duyệt vòng đầu —{" "}
                    <Link
                      to={PATH_EDITOR_BOARD}
                      className="font-medium text-primary hover:underline"
                    >
                      mở trang {LABEL_EDITOR_BOARD}
                    </Link>
                  </p>
                ) : null}

                <ol className="relative space-y-3 border-l border-muted pl-5">
                  {workflowSteps.map((w, i) => {
                    const isActive = i === 0;
                    return (
                      <li key={w.step} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[26px] flex size-5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-card",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {w.step}
                        </span>
                        <p className="text-sm font-medium">{w.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {w.desc}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>

            {tab !== "annotate" && seriesRankings.length > 0 ? (
              <Card className="mk-sidebar-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="size-4 text-emerald-600" />
                    Bảng xếp hạng
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {seriesRankings.map((r) => (
                    <div
                      key={r.title}
                      className={cn(
                        "flex items-center gap-3 rounded-md border p-2.5",
                        r.atRisk &&
                          "border-amber-200 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5",
                      )}
                    >
                      <span className="flex size-7 items-center justify-center rounded-md bg-muted text-xs font-bold">
                        #{r.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {r.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.reads} đọc · {r.delta}
                        </p>
                      </div>
                    </div>
                  ))}
                  {atRiskSeries.length > 0 ? (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                      <p className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="size-3" />
                        Cảnh báo huỷ series
                      </p>
                      {atRiskSeries.map((r) => (
                        <p
                          key={r.title}
                          className="mt-1 text-amber-700 dark:text-amber-400"
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
                    onClick={() =>
                      seriesList[0] && openAnnotate(seriesList[0].title)
                    }
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
                ? `Ch. ${teTargetChapter.num} — ${teTargetChapter.series}. Chọn TE (tuỳ chọn) rồi gán hoặc gửi. Không chọn TE → gửi cho tất cả TE active.`
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
                disabled={teSending || teLoading}
                onClick={() => void handleSubmitToTe(null)}
              >
                {teSending ? "Đang gửi..." : "Gửi tất cả TE"}
              </Button>
              <Button
                disabled={teSending || teLoading}
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
    </div>
  );
}
