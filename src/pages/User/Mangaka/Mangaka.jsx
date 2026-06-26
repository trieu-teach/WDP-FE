import { useEffect, useMemo, useState, Fragment } from "react";
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
  Image as ImageIcon,
  Lightbulb,
  ListChecks,
  PenSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  User,
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
import { getSession, logout } from "@/lib/auth.js";
import { cn } from "@/lib/utils";
import ChapterAnnotator from "./ChapterAnnotator.jsx";
import AddSeriesModal from "./AddSeriesModal.jsx";
import MangakaAssistants from "./MangakaAssistants.jsx";
import { seriesPath } from "./SeriesUploadDetail.jsx";
import { ImageCompareGrid } from "@/components/layout/ImageCompareGrid.jsx";
import { ChapterPipeline } from "@/components/layout/ChapterPipeline.jsx";
import {
  LABEL_EDITOR_BOARD,
  LABEL_TANTOU_EDITOR,
  PATH_EDITOR_BOARD,
  PATH_TANTOU_EDITOR,
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
import { tasksService } from "@/api/tasks.service.js";
import { chaptersService } from "@/api/chapters.service.js";
import { submissionsService } from "@/api/submissions.service.js";
import { uiNoteToTaskCreate, uiChapterToTaskCreate, apiTaskToUi, uiTaskTypeToErrorType } from "@/utils/apiMappers.js";
import { useMangakaTasks } from "@/hooks/useMangakaTasks.js";
import {
  listTantouSubmissions,
} from "@/utils/tantouWorkspaceStorage.js";
import { useMangakaCooperation } from "@/hooks/useMangakaCooperation.js";
import {
  formatSeriesCardLine,
  seriesToExternalSummary,
  slugifySeriesTitle,
} from "@/utils/seriesModel.js";
import "@/styles/mangaPage.css";
import "./Mangaka.css";

const NAV_LINKS = [{ to: "/", label: "Trang chủ" }];

const STAT_DEFS = [
  { label: "Series draft", icon: BookOpen, color: "rose" },
  { label: "Chapter đã upload", icon: FileText, color: "sky" },
  { label: "Chờ Assistant", icon: ImageIcon, color: "violet" },
  { label: "Chờ duyệt bản tổng hợp", icon: ClipboardCheck, color: "amber" },
];

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
  { id: "series", label: "Series draft", icon: BookOpen },
  { id: "chapters", label: "Chapter", icon: FileText },
  { id: "assistants", label: "Thuê Assistant", icon: UserPlus },
  { id: "annotate", label: "Upload & Ghi chú", icon: PenSquare },
];

const STAT_ICON_BG = {
  rose: "bg-rose-500/10 text-rose-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
  amber: "bg-amber-500/10 text-amber-600",
};

function StatCard({ def, value, trend }) {
  const Icon = def.icon;
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {def.label}
          </p>
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          <p className="text-xs text-muted-foreground">{trend}</p>
        </div>
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-xl",
            STAT_ICON_BG[def.color],
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
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
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: series.color }}
      />
      {series.needsFullDebutPipeline ? (
        <Badge
          className="absolute right-3 top-3 z-10 bg-amber-500 text-white hover:bg-amber-500"
          title={`Series lần đầu: đủ vòng ${LABEL_EDITOR_BOARD}.`}
        >
          <Sparkles className="size-3" />
          Lần đầu
        </Badge>
      ) : null}

      <Link
        to={toSeries}
        className="flex aspect-[16/7] items-center justify-center overflow-hidden text-3xl font-extrabold tracking-tight text-white transition-transform group-hover:scale-[1.02]"
        style={{
          background: series.coverImage
            ? `url(${resolveMediaUrl(series.coverImage)}) center / cover no-repeat`
            : `linear-gradient(135deg, ${series.color}, ${series.color}88)`,
        }}
      >
        {!series.coverImage && <span className="drop-shadow-lg">{initials}</span>}
      </Link>

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={toSeries}
            className="line-clamp-1 font-semibold hover:underline"
            title={series.title}
          >
            {series.title}
          </Link>
          <Badge className={statusBadge.className} variant="secondary">
            {series.statusLabel ?? statusBadge.label}
          </Badge>
        </div>

        <p className="line-clamp-1 text-xs text-muted-foreground">
          {formatSeriesCardLine(series)}
        </p>
        {series.ebAssessment ? (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                EB đánh giá
              </span>
              <Badge
                variant="outline"
                className="border-emerald-300 bg-white/80 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              >
                DTB {Number(series.ebAssessment.average ?? 0).toFixed(1)} ·{" "}
                {series.ebAssessment.classification ?? "N/A"}
              </Badge>
            </div>
            <p className="line-clamp-2 text-xs text-emerald-900/80 dark:text-emerald-100/85">
              {series.ebAssessment.classificationNote ??
                "Chưa có ghi chú từ Editor Board."}
            </p>
            {Array.isArray(series.ebAssessment.summaryNotes) &&
            series.ebAssessment.summaryNotes.length > 0 ? (
              <p className="line-clamp-2 text-xs text-emerald-900/70 dark:text-emerald-100/75">
                {series.ebAssessment.summaryNotes.slice(0, 2).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {!series.metadataComplete ? (
          <p className="flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="size-3" />
            Thiếu mô tả hồ sơ
          </p>
        ) : null}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{series.chapters} ch</span>
          <span>·</span>
          <span>{series.marks} vùng ghi chú</span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{isUploading ? "Đang tải chapter" : "Tiến độ"}</span>
            <span className="font-medium tabular-nums">
              {Math.round(barPct)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${barPct}%`, background: series.color }}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{series.updated}</p>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t bg-muted/30 p-3">
        <div className="flex w-full flex-wrap gap-1.5">
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link to={toSeries}>Xem truyện</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenEdit}>
            Chỉnh sửa
          </Button>
          {series.status === "draft" ? (
            <Button size="sm" variant="ghost" onClick={onOpenAnnotate}>
              Đánh dấu vùng
            </Button>
          ) : null}
        </div>

        {series.needsFullDebutPipeline && !ebApproved ? (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="w-full bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300"
          >
            <Link to={PATH_EDITOR_BOARD}>
              <Sparkles className="size-3.5" />
              Chờ {LABEL_EDITOR_BOARD} duyệt
            </Link>
          </Button>
        ) : null}

        {series.needsFullDebutPipeline && ebApproved ? (
          <Button size="sm" className="w-full" onClick={onCompleteDebut}>
            <CheckCircle2 className="size-3.5" />
            Hoàn tất vòng đầu
          </Button>
        ) : null}

        <div className="flex w-full justify-end">
          <Button
            size="xs"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3" />
            Xóa
          </Button>
        </div>
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
    loading: tasksLoading,
    refresh: refreshMangakaTasks,
    requestRevision,
    acknowledgeTask,
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
  const [tantouTick, setTantouTick] = useState(0);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [ackBusy, setAckBusy] = useState(false);

  // TE assignment — luồng mới
  const [teUsers, setTeUsers] = useState([]);          // danh sách TE active
  const [teLoading, setTeLoading] = useState(false);
  const [teSelectorOpen, setTeSelectorOpen] = useState(false); // dialog chọn TE
  const [selectedTeId, setSelectedTeId] = useState(null);      // TE đã chọn cho lastApprovedChapter
  const [teAssigning, setTeAssigning] = useState(false);      // đang gán
  const [teSending, setTeSending] = useState(false);          // đang gửi sang TE

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

  /**
   * Gán TE cho chapter rồi gửi sang TE.
   * Bước 1: PATCH assign-te
   * Bước 2: POST submit-to-te
   *
   * @param {string|null} teId  — TE được chọn trong dialog
   */
  async function handleAssignTeAndSend(teId) {
    const chapter = lastApprovedChapter ?? pendingCompositeReview
    if (!chapter) return
    const chapterId = chapter.id
    setTeAssigning(true)

    // Bước 0: nếu chapter vẫn ở submitted_by_assistant thì approve trước
    // (PATCH /approve chỉ chấp nhận draft | pending_assistant | TE_revision | review | submitted_by_assistant)
    if (chapter.status === 'submitted_by_assistant') {
      try {
        await submissionsService.approveChapter(chapterId)
        chapter.status = 'review'
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Duyệt chapter thất bại.'))
        setTeAssigning(false)
        return
      }
    }

    try {
      await submissionsService.assignTe(chapterId, teId)
      setSelectedTeId(teId)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Gán TE thất bại.'))
      setTeAssigning(false)
      return
    }
    setTeAssigning(false);

    // Gửi sang TE
    setTeSending(true);
    try {
      await submissionsService.submitChapterToTe(chapterId);
      toast.success(
        `Đã gửi Ch. ${chapter.num} sang ${LABEL_TANTOU_EDITOR}.`,
      );
      setTeSelectorOpen(false);
      setLastApprovedChapter(null);
      await refreshMangakaTasks();
      await refreshWorkspace();
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Gửi sang ${LABEL_TANTOU_EDITOR} thất bại.`));
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

  const statValues = useMemo(() => {
    const pendingAssistant = chapterRows.filter(
      (c) => c.status === "assistant",
    ).length;
    const pendingComposite = chapterRows.filter(
      (c) => c.status === "review",
    ).length;
    return [
      { value: String(seriesList.length), trend: "Hồ sơ trong workspace" },
      {
        value: String(chapterRows.length),
        trend: `${chapterRows.length} dòng trong bảng Chapter`,
      },
      {
        value: String(pendingAssistant),
        trend: pendingAssistant > 0 ? "Đang gửi Assistant" : "Không có",
      },
      {
        value: String(pendingComposite),
        trend: pendingComposite > 0 ? "Cần duyệt" : "Không có",
      },
    ];
  }, [seriesList.length, chapterRows]);

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

  async function handleCardApprove(row, review) {
    if (!review?.submission?.id && !row?.id) return;
    // Đảm bảo row có status API để handleAssignTeAndSend biết có cần approve hay không
    if (!row.status && review?.submission?.status) {
      row.status = review.submission.status
    }
    setLastApprovedChapter(row);
    setSelectedTeId(null);
    setTeSelectorOpen(true);
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

  const pendingReview = pendingReviews[0] ?? null;
  const pendingCompositeReview = pendingReview?.chapter ?? null;
  const pendingSubmittedTasks = pendingReview?.tasks ?? [];
  // Flow mới (submission-driven): load lại pages của chapter đang duyệt
  // để lấy ảnh mới nhất (kết quả Assistant vừa nộp).
  const pendingResultUrls = useMemo(() => {
    const urls = []
    for (const task of pendingSubmittedTasks) {
      if (Array.isArray(task.resultImageUrls) && task.resultImageUrls.length) {
        urls.push(...task.resultImageUrls)
      } else if (task.resultImageUrl) {
        urls.push(task.resultImageUrl)
      }
    }
    if (urls.length) return urls
    if (!pendingCompositeReview) return []
    const list = (annotatorChapters ?? []).find(
      c => c.id === pendingCompositeReview.id,
    )
    return (list?.pages ?? []).map(p => p?.url).filter(Boolean)
  }, [pendingSubmittedTasks, pendingCompositeReview, annotatorChapters]);
  const pendingChapterTask = pendingReview?.task ?? null;
  // Flow mới (submission-driven): tổng hợp thông tin hiển thị từ submission
  // để UI dùng chung shape với phiên bản cũ (status / revisionNote / revisionHistory).
  const pendingSubmission = pendingReview?.submission ?? null;
  const pendingChapterSummary = pendingSubmission
    ? {
        id: pendingSubmission.id,
        status: 'in_review', // Mangaka đã nhận thông tin từ API → luôn ở trạng thái "đã nhận"
        revisionNote: pendingSubmission.revision_notes ?? '',
        revisionHistory: Array.isArray(pendingSubmission.revision_history)
          ? pendingSubmission.revision_history.map((h) => ({
              at: h.at ?? h.createdAt ?? h.updatedAt ?? pendingSubmission.updatedAt,
              by: h.by ?? h.requested_by ?? null,
              note: h.note ?? h.revision_note ?? '',
            }))
          : pendingSubmission.revision_notes
            ? [{ at: pendingSubmission.updatedAt, note: pendingSubmission.revision_notes }]
            : [],
      }
    : null;
  const pendingChapterView = pendingChapterTask ?? pendingChapterSummary;
  // Ảnh gốc các trang của chapter đang duyệt (fallback nếu BE không trả diff)
  const pendingOriginalUrls = useMemo(() => {
    if (!pendingCompositeReview) return []
    const list = (annotatorChapters ?? []).find(
      c => c.id === pendingCompositeReview.id,
    )
    return (list?.pages ?? []).map(p => p?.url).filter(Boolean)
  }, [pendingCompositeReview, annotatorChapters])

  // Chapter vừa duyệt xong — dùng để nhắc gửi Tantou
  const [lastApprovedChapter, setLastApprovedChapter] = useState(null)
  useEffect(() => {
    if (!lastApprovedChapter) return
    const t = window.setTimeout(() => setLastApprovedChapter(null), 60_000)
    return () => window.clearTimeout(t)
  }, [lastApprovedChapter])

  // Khi chapter chờ duyệt thay đổi → load lại pages để lấy ảnh mới nhất (kết quả Assistant nộp).
  useEffect(() => {
    const id = pendingCompositeReview?.id
    if (!id) return
    let cancelled = false
    loadChapterPages(id)
      .then(() => { if (cancelled) void 0 })
      .catch(() => { if (cancelled) void 0 })
    return () => { cancelled = true }
  }, [pendingCompositeReview?.id, loadChapterPages])

  const seriesRankings = useMemo(() => {
    const titles = new Set(seriesList.map((s) => s.title));
    return rankings.filter((r) => titles.has(r.title) || titles.size === 0);
  }, [seriesList, rankings]);

  const atRiskSeries = useMemo(
    () => seriesRankings.filter((r) => r.atRisk),
    [seriesRankings],
  );

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

      // Bước 2 — gửi cả chapter (BE tạo Task cho pages từ PageNotes đã lưu ở bước upload)
      // Gửi kèm assigned_to ở top-level làm backup — BE có thể đọc trực tiếp từ body
      // hoặc fallback về chapter.assistant_id đã set ở /assign (bước 1).
      await chaptersService.update(chapter.id, {
        action: 'submit',
        assigned_to: targetAssistantId,
        revision_notes: revisionNotes,
        // Gửi kèm revision_annotations (có toạ độ) để Assistant hiển thị đúng vị trí
        ...(Object.keys(annotationMap).length > 0 ? { revision_annotations: annotationMap } : {}),
      })

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

  async function handleApproveChapter() {
    if (!pendingReview?.chapter) return;
    const row = pendingReview.chapter;
    if (!row.status && pendingReview.submission?.status) {
      row.status = pendingReview.submission.status;
    }
    setLastApprovedChapter(row);
    setSelectedTeId(null);
    setTeSelectorOpen(true);
  }

  async function handleAcknowledgeTask() {
    if (!pendingChapterTask?.id) return;
    if (pendingChapterTask.status !== 'submitted') return;
    setAckBusy(true);
    try {
      await acknowledgeTask(pendingChapterTask.id);
      toast.success(`Đã nhận task chương ${pendingReview.chapter.num} — đang kiểm duyệt.`);
      await refreshMangakaTasks();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Nhận task thất bại.'));
    } finally {
      setAckBusy(false);
    }
  }

  async function handleConfirmChapterRevision() {
    if (!pendingReview?.chapter) return;
    setRevisionBusy(true);
    try {
      const note =
        revisionNote.trim()
        || "Mangaka yêu cầu chỉnh sửa — xem ghi chú trên từng trang.";
      await requestRevision([pendingReview], note);
      await updateChapterStatus(pendingReview.chapter.id, "assistant");
      setRevisionOpen(false);
      setRevisionNote("");
      toast.success(
        "Đã trả chapter cho Assistant. Thêm ghi chú trên trang cần sửa rồi bấm Gửi cả chapter.",
      );
      openAnnotate(pendingReview.chapter.series, pendingReview.chapter.id);
      await refreshMangakaTasks();
      await refreshWorkspace();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Gửi yêu cầu sửa thất bại."));
    } finally {
      setRevisionBusy(false);
    }
  }

  const tantouRevisions = useMemo(
    () => listTantouSubmissions().filter((s) => s.status === "revision"),
    [tantouTick],
  );

  useEffect(() => {
    const onTantou = () => setTantouTick((t) => t + 1);
    window.addEventListener("mk-tantou-storage", onTantou);
    return () => window.removeEventListener("mk-tantou-storage", onTantou);
  }, []);

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
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        className="from-rose-950 to-zinc-950"
        label="Mangaka Workspace"
        title={`Xin chào${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={`Tạo hồ sơ giới thiệu & nộp bản thảo lên ${LABEL_EDITOR_BOARD} · đánh dấu vùng giao việc cho Assistant · duyệt bản tổng hợp ngay trên trang.`}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={openAddSeriesModal}
            className="bg-white text-zinc-900 hover:bg-zinc-100"
          >
            <Plus className="size-4" />
            Đăng ký series
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            disabled={seriesList.length === 0}
            onClick={() => seriesList[0] && openAnnotate(seriesList[0].title)}
          >
            <Upload className="size-4" />
            Upload chapter
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setTab("assistants")}
          >
            <UserPlus className="size-4" />
            Thuê Assistant
          </Button>
        </div>
      </WorkspaceHero>

      <main className="page-container flex-1 py-8">
        {tab !== "annotate" ? (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_DEFS.map((def, i) => (
              <StatCard
                key={def.label}
                def={def}
                value={statValues[i].value}
                trend={statValues[i].trend}
              />
            ))}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-5 h-auto flex-wrap">
                {TAB_ITEMS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger key={t.id} value={t.id} className="gap-2">
                      <Icon className="size-4" />
                      {t.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="series" className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Series của tôi</h2>
                    <p className="text-sm text-muted-foreground">
                      Quản lý draft và luồng duyệt
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
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Chưa có series nào — bấm "Đăng ký series" để bắt đầu.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

              <TabsContent value="chapters" className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Chapter đã upload</h2>
                    <p className="text-sm text-muted-foreground">
                      {chapterRows.length} chapter trên {chapterRowsBySeries.length} series
                    </p>
                  </div>
                </div>

                {chapterRowsBySeries.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Chưa có chapter — upload ở tab Upload & Ghi chú.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-8">
                    {chapterRowsBySeries.map(({ series, chapters: groupChapters }) => {
                      const seriesMeta = seriesList.find(x => x.title === series);
                      const slug = seriesMeta?.slug ?? slugifySeriesTitle(series);
                      const color = seriesMeta?.color ?? '#6366f1';
                      return (
                        <div key={series} className="space-y-3">
                          {/* Series header */}
                          <Link
                            to={`/mangaka/series/${slug}`}
                            className="group flex items-center gap-3"
                          >
                            <span
                              className="flex size-9 shrink-0 items-center justify-center rounded-xl font-extrabold text-lg text-white shadow-sm"
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
                            <span className="text-xs text-muted-foreground group-hover:text-foreground">
                              Xem series <ChevronRight className="inline size-3.5" />
                            </span>
                          </Link>

                          {/* Chapter grid */}
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {groupChapters.map((c) => {
                              const annot = resolveAnnotatorChapter(c, annotatorChapters);
                              const review = pendingReviewByChapter.get(String(c.id));
                              const submittedTasks = review?.tasks ?? [];
                              const submittedTask = review?.task ?? null;
                              // Ảnh assistant đã gửi: ưu tiên mảng resultImageUrls, fallback 1 ảnh resultImageUrl
                              const resultUrls = [];
                              for (const t of submittedTasks) {
                                if (Array.isArray(t?.resultImageUrls) && t.resultImageUrls.length) {
                                  resultUrls.push(...t.resultImageUrls);
                                } else if (t?.resultImageUrl) {
                                  resultUrls.push(t.resultImageUrl);
                                }
                              }
                              const hasSubmittedImages = resultUrls.length > 0;
                              const firstResultUrl = hasSubmittedImages ? resultUrls[0] : null;
                              const originalUrl = annot?.pages?.find(p => p?.url)?.url;
                              // Đã có ảnh assistant → hiện ảnh kết quả làm thumbnail, đánh dấu "đã chỉnh"
                              const thumbUrl = hasSubmittedImages ? firstResultUrl : originalUrl;
                              const statusBadge = hasSubmittedImages
                                ? { label: 'Đã gửi ảnh', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' }
                                : (STATUS_BADGE[c.status] ?? STATUS_BADGE.draft);
                              return (
                                <div
                                  key={c.id}
                                  className="group/card relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
                                >
                                  <Link
                                    to={`/mangaka/series/${slug}/chapter/${c.id}`}
                                    className="flex flex-1 flex-col"
                                  >
                                    {/* Thumbnail */}
                                    <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                                      {thumbUrl ? (
                                        <img src={thumbUrl} alt="" className="size-full object-cover transition-transform group-hover/card:scale-105" />
                                      ) : (
                                        <div className="flex size-full items-center justify-center text-muted-foreground">
                                          <BookOpen className="size-8 opacity-30" />
                                        </div>
                                      )}
                                      {/* Status badge overlay */}
                                      <div className="absolute right-2 top-2">
                                        <Badge className={statusBadge.className} variant="secondary">
                                          {statusBadge.label}
                                        </Badge>
                                      </div>
                                      {hasSubmittedImages ? (
                                        <div className="absolute left-2 top-2">
                                          <Badge variant="secondary" className="bg-black/60 text-white hover:bg-black/60 text-[10px]">
                                            Ảnh Assistant · {resultUrls.length}
                                          </Badge>
                                        </div>
                                      ) : null}
                                    </div>

                                    {/* Info */}
                                    <div className="flex flex-1 flex-col gap-1.5 p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-semibold leading-tight">
                                          Ch. {c.num}
                                          {c.title ? <span className="ml-1 font-normal text-muted-foreground">· {c.title}</span> : null}
                                        </p>
                                        <Badge variant="outline" className="shrink-0 text-[10px]">
                                          {c.type}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {c.pages} trang
                                        {c.assistantName ? ` · ${c.assistantName}` : null}
                                      </p>
                                      <p className="mt-auto text-[10px] text-muted-foreground">
                                        {c.date}
                                      </p>
                                    </div>
                                  </Link>

                                  {/* Hành động cho chapter đã có ảnh Assistant gửi */}
                                  {review && submittedTask ? (
                                    <div className="flex gap-2 border-t bg-muted/30 px-3 py-2">
                                      <Button
                                        size="xs"
                                        variant="default"
                                        className="flex-1"
                                        onClick={() => void handleCardApprove(c, review)}
                                      >
                                        <CheckCircle2 className="size-3" />
                                        Chấp nhận
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

              <TabsContent value="assistants">
                <MangakaAssistants />
              </TabsContent>

              <TabsContent value="annotate">
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

          <aside className="space-y-4">
            <Card>
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

            {pendingCompositeReview ? (
              <Card className="border-primary/30 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardCheck className="size-4 text-primary" />
                    Bản tổng hợp từ Assistant
                  </CardTitle>
                  <CardDescription>
                    <strong className="text-foreground">
                      {pendingCompositeReview.series}
                    </strong>{" "}
                    · Ch. {pendingCompositeReview.num}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        pendingChapterView?.status === 'in_review'
                          ? 'bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400'
                          : STATUS_BADGE.review.className
                      }
                      variant="secondary"
                    >
                      {pendingChapterView?.status === 'in_review' ? 'Đang duyệt' : 'Chờ duyệt'}
                    </Badge>
                    {pendingChapterView?.status === 'in_review' ? (
                      <span className="text-[11px] text-muted-foreground">
                        Bạn đã nhận task này
                      </span>
                    ) : null}
                  </div>

                  <div className="overflow-hidden rounded-lg border bg-muted">
                    {pendingResultUrls.length > 0 ? (
                      <ImageCompareGrid
                        originals={pendingOriginalUrls}
                        results={pendingResultUrls}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 p-6 text-center text-xs text-muted-foreground">
                        <ImageIcon className="size-6 opacity-40" />
                        <span>
                          {tasksLoading
                            ? "Đang tải chapter từ Assistant..."
                            : "Chờ Assistant nộp đủ ảnh các trang"}
                        </span>
                      </div>
                    )}
                  </div>

                  {pendingSubmittedTasks.length > 0 || pendingChapterView ? (
                    <p className="text-xs text-muted-foreground">
                      {pendingResultUrls.length} trang kết quả · submission {pendingChapterView?.id ?? ''}
                      {pendingChapterView?.revisionNote
                        ? ` · yêu cầu sửa trước: "${pendingChapterView.revisionNote}"`
                        : ''}
                    </p>
                  ) : null}

                  {/* TE info — nếu đã gán TE trong submission */}
                  {pendingReview?.submission?.te_id ? (
                    <div className="flex items-center gap-2 rounded-lg border border-sky-200/60 bg-sky-50/40 px-3 py-2 dark:border-sky-500/20 dark:bg-sky-500/5">
                      <User className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                      <span className="text-xs text-sky-700 dark:text-sky-300">
                        TE đã gán
                      </span>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="ml-auto h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                        onClick={() => void handleRemoveTe(pendingCompositeReview.id)}
                      >
                        Gỡ
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSelectedTeId(null)
                        setTeSelectorOpen(true)
                      }}
                    >
                      <Users className="size-3.5" />
                      Chọn {LABEL_TANTOU_EDITOR} và gửi
                    </Button>
                  )}

                  {pendingChapterView?.revisionHistory?.length ? (
                    <div className="rounded-lg border border-amber-200/70 bg-amber-50/40 p-3 text-xs dark:border-amber-500/20 dark:bg-amber-500/5">
                      <p className="mb-1.5 font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Lịch sử yêu cầu sửa · {pendingChapterView.revisionHistory.length} lần
                      </p>
                      <ol className="space-y-1.5">
                        {pendingChapterView.revisionHistory.map((h, i) => (
                          <li key={i} className="flex items-start gap-2 text-foreground/80">
                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="break-words">{h.note || '(không có ghi chú)'}</p>
                              {h.at ? (
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(h.at).toLocaleString('vi-VN')}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {pendingChapterView?.status === 'submitted' ? (
                    <Button
                      size="sm"
                      className="w-full"
                      variant="secondary"
                      disabled={ackBusy}
                      onClick={() => void handleAcknowledgeTask()}
                    >
                      {ackBusy ? 'Đang nhận task...' : 'Nhận task để duyệt'}
                    </Button>
                  ) : null}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => void handleApproveChapter()}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Phê duyệt chapter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setRevisionOpen(true)}
                    >
                      Yêu cầu sửa
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    disabled={seriesList.length === 0}
                    onClick={() => openAnnotate(pendingCompositeReview.series)}
                  >
                    Mở trên trang
                    <ArrowRight className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {lastApprovedChapter ? (
              <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/5">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-4" />
                      Đã duyệt chapter {lastApprovedChapter.num} — {lastApprovedChapter.series}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Chọn {LABEL_TANTOU_EDITOR} rồi gửi để hoàn tất pipeline.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLastApprovedChapter(null)}
                    >
                      Để sau
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        // Lưu chapter đang chờ để gán TE
                        setSelectedTeId(null)
                        setTeSelectorOpen(true)
                      }}
                    >
                      <Users className="size-3.5" />
                      Chọn {LABEL_TANTOU_EDITOR}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {tantouRevisions.length > 0 ? (
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="size-4 text-amber-600" />
                    Nhận xét từ {LABEL_TANTOU_EDITOR}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tantouRevisions.slice(0, 3).map((s) => {
                    const revisionPath = getMangakaTeRevisionPath(s.chapterId ?? s.id)
                    return (
                    <div key={s.id} className="rounded-lg border bg-card p-3">
                      <p className="text-sm font-semibold">{s.seriesTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        Ch. {s.chapterNum} · {s.pageLabel}
                      </p>
                      {s.editorialComment ? (
                        <p className="mt-1.5 line-clamp-3 text-xs">
                          {s.editorialComment}
                        </p>
                      ) : null}
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
                    )
                  })}
                </CardContent>
              </Card>
            ) : null}

            {tab !== "annotate" && seriesRankings.length > 0 ? (
              <Card>
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
              <Card className="border-primary/20 bg-primary/5">
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
        </div>
      </main>

      <Footer />

      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yêu cầu sửa chapter</DialogTitle>
            <DialogDescription>
              Ghi chú chung (tuỳ chọn), sau đó thêm ghi chú trên từng trang chưa đạt
              rồi <strong>gửi lại cả chapter</strong> cho Assistant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="revision-note">Ghi chú cho Assistant</Label>
            <Textarea
              id="revision-note"
              rows={4}
              placeholder="VD: Trang 3–5 cần tô bóng lại, trang 7 màu nền chưa khớp..."
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={revisionBusy}
              onClick={() => void handleConfirmChapterRevision()}
            >
              {revisionBusy ? "Đang gửi..." : "Trả chapter & mở ghi chú"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {lastApprovedChapter
                ? `Gán TE cho Ch. ${lastApprovedChapter.num} — ${lastApprovedChapter.series} rồi gửi sang duyệt.`
                : 'Chọn TE để gán cho chapter này.'}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setTeSelectorOpen(false)} disabled={teAssigning || teSending}>
              Huỷ
            </Button>
            <Button
              disabled={!selectedTeId || teAssigning || teSending || teLoading}
              onClick={() => void handleAssignTeAndSend(selectedTeId)}
            >
              {teAssigning ? 'Đang gán TE...' : teSending ? 'Đang gửi...' : 'Gán và gửi sang TE'}
            </Button>
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
