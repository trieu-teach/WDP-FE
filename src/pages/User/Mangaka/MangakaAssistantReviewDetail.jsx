import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardCheck,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { AssistantReviewChapterCard } from "@/components/Mangaka/AssistantReviewChapterCard.jsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession, logout } from "@/lib/auth.js";
import { useMangakaWorkspace } from "@/hooks/useMangakaWorkspace.js";
import { useMangakaTasks } from "@/hooks/useMangakaTasks.js";
import { getApiErrorMessage } from "@/api/http.js";
import { submissionsService } from "@/api/submissions.service.js";
import {
  canMangakaSendToTe,
  chapterPagesToCompareUrls,
} from "@/utils/apiMappers.js";
import {
  buildReviewPageCompare,
  canMangakaApproveChapterReview,
  countUnapprovedTasks,
} from "@/utils/chapterTaskFlow.js";
import { LABEL_TANTOU_EDITOR } from "@/constants/roleTerminology.js";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
  { to: "/mangaka/review", label: "Duyệt bản Assistant" },
];

export default function MangakaAssistantReviewDetail() {
  const navigate = useNavigate();
  const { chapterId } = useParams();
  const user = getSession();

  const {
    chapterRows,
    annotatorChapters,
    updateChapterStatus,
    loadChapterPages,
    refresh: refreshWorkspace,
  } = useMangakaWorkspace(user);

  const {
    pendingReviews,
    loading: tasksLoading,
    refresh: refreshMangakaTasks,
    requestRevision,
    acknowledgeTask,
    approveTask,
    approveChapterByMangaka,
  } = useMangakaTasks(chapterRows);

  const review = useMemo(
    () =>
      (pendingReviews ?? []).find(
        (r) => String(r?.chapter?.id) === String(chapterId),
      ) ?? null,
    [pendingReviews, chapterId],
  );

  const [taskActionBusy, setTaskActionBusy] = useState(null);
  const [revisionSending, setRevisionSending] = useState(false);

  const [teUsers, setTeUsers] = useState([]);
  const [teLoading, setTeLoading] = useState(false);
  const [selectedTeId, setSelectedTeId] = useState(null);
  const [teSending, setTeSending] = useState(false);
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(true);

  useEffect(() => {
    if (!chapterId) return;
    let cancelled = false;
    setPagesLoading(true);
    void loadChapterPages(chapterId, { force: true })
      .then((list) => {
        if (!cancelled) setPages(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setPages([]);
      })
      .finally(() => {
        if (!cancelled) setPagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chapterId, loadChapterPages]);

  // Đồng bộ khi annotatorChapters cập nhật (sau fetch khác)
  useEffect(() => {
    if (!chapterId) return;
    const ch = (annotatorChapters ?? []).find(
      (c) => String(c.id) === String(chapterId),
    );
    if (ch?.pages?.length) setPages(ch.pages);
  }, [annotatorChapters, chapterId]);

  useEffect(() => {
    if (!review?.chapter) return;
    const preset =
      review.submission?.te_id
      ?? review.chapter?.teId
      ?? null;
    setSelectedTeId(preset ? String(preset) : null);
  }, [review?.chapter?.id, review?.submission?.te_id]);

  useEffect(() => {
    if (!review?.chapter) return;
    let cancelled = false;
    setTeLoading(true);
    submissionsService
      .getTeUsers()
      .then((users) => {
        if (!cancelled) setTeUsers(Array.isArray(users) ? users : []);
      })
      .catch(() => {
        if (!cancelled) setTeUsers([]);
      })
      .finally(() => {
        if (!cancelled) setTeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [review?.chapter?.id]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function verifyChapterPagesReadyForTe(id) {
    const loaded = await loadChapterPages(id, { force: true });
    const { resultCount, pageCount } = chapterPagesToCompareUrls(loaded);
    if (pageCount > 0 && resultCount < pageCount) {
      throw new Error(
        `${pageCount - resultCount} trang chưa có ảnh kết quả từ Assistant.`,
      );
    }
    return loaded;
  }

  async function handleAcknowledgeTask(taskId) {
    if (!taskId) return;
    setTaskActionBusy(taskId);
    try {
      await acknowledgeTask(taskId);
      toast.success("Đã nhận task — có thể duyệt.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Nhận task thất bại."));
    } finally {
      setTaskActionBusy(null);
    }
  }

  async function handleApproveTask(taskId) {
    if (!taskId) return;
    setTaskActionBusy(taskId);
    try {
      await approveTask(taskId);
      toast.success("Đã duyệt task.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Duyệt task thất bại."));
    } finally {
      setTaskActionBusy(null);
    }
  }

  async function handleSendToTeFromReview() {
    if (!review?.chapter) return;
    const tasks = review.tasks ?? [];
    const pageCompare = buildReviewPageCompare(pages, tasks);
    if (!canMangakaApproveChapterReview(review, pageCompare)) {
      const unapproved = countUnapprovedTasks(tasks);
      if (unapproved > 0 && pageCompare.resultCount === 0) {
        toast.error(
          `${unapproved} task chưa được duyệt và chưa có ảnh kết quả.`,
        );
      } else if (pageCompare.resultCount === 0) {
        toast.error("Chưa có ảnh kết quả — chờ Assistant nộp.");
      } else {
        toast.error(`Chưa đủ điều kiện gửi ${LABEL_TANTOU_EDITOR}.`);
      }
      return;
    }

    const chapter = review.chapter;
    const apiStatus =
      chapter.apiStatus
      ?? review.submission?.status
      ?? chapter.status;

    setTeSending(true);
    try {
      if (!canMangakaSendToTe(apiStatus)) {
        const id = review.submission?.id ?? chapter.id;
        await approveChapterByMangaka(id);
      }

      await verifyChapterPagesReadyForTe(chapter.id);

      const teId = selectedTeId || undefined;
      const res = await submissionsService.submitChapterToTe(chapter.id, teId);

      const selectedTe = teId
        ? teUsers.find((te) => String(te._id) === String(teId))
        : null;
      const teName =
        selectedTe?.full_name
        ?? selectedTe?.username
        ?? null;

      if (teId && teName) {
        toast.success(`Đã gửi cho ${LABEL_TANTOU_EDITOR} ${teName}.`);
      } else {
        toast.success(
          res.message || `Đã gửi cho tất cả ${LABEL_TANTOU_EDITOR}.`,
        );
      }

      await refreshWorkspace();
      await refreshMangakaTasks();
      navigate("/mangaka/review");
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, `Gửi sang ${LABEL_TANTOU_EDITOR} thất bại.`),
      );
    } finally {
      setTeSending(false);
    }
  }

  async function handleRequestRevision(item) {
    if (!item?.chapter) return;
    setRevisionSending(true);
    try {
      await requestRevision(
        [item],
        "Mangaka yêu cầu chỉnh sửa chapter.",
      );
      await updateChapterStatus(item.chapter.id, "assistant");
      toast.success("Đã trả chapter cho Assistant.");
      navigate("/mangaka", {
        state: {
          tab: "annotate",
          series: item.chapter.series,
          chapterId: item.chapter.id,
        },
      });
      await refreshMangakaTasks();
      await refreshWorkspace();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Gửi yêu cầu sửa thất bại."));
    } finally {
      setRevisionSending(false);
    }
  }


  const chapterLabel = review?.chapter
    ? `${review.chapter.series} · Ch. ${review.chapter.num}`
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <main className="page-container flex min-h-0 flex-1 flex-col gap-6 py-6 lg:py-8">
        <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link to="/mangaka/review">
              <ArrowLeft className="size-4" />
              Danh sách chờ duyệt
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-amber-600">
              Duyệt bản Assistant
            </p>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              <ClipboardCheck className="size-5 shrink-0 text-amber-600" />
              {chapterLabel ?? "Chi tiết chapter"}
            </h1>
            <p className="text-sm text-muted-foreground">
              So sánh ảnh gốc và ảnh Assistant, nhận từng task rồi gửi
              {LABEL_TANTOU_EDITOR}.
            </p>
          </div>
        </header>

        {tasksLoading && !review ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Đang tải chapter...
            </CardContent>
          </Card>
        ) : !review ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <ClipboardCheck className="size-10 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="font-medium">Chapter không còn chờ duyệt</p>
                <p className="text-sm text-muted-foreground">
                  Có thể đã được duyệt hoặc trả lại cho Assistant.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/mangaka/review">Về danh sách</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <AssistantReviewChapterCard
            review={review}
            pages={pages}
            pagesLoading={pagesLoading}
            tasksLoading={tasksLoading}
            taskActionBusy={taskActionBusy}
            teUsers={teUsers}
            teUsersLoading={teLoading}
            selectedTeId={selectedTeId}
            teSending={teSending}
            onSelectTe={setSelectedTeId}
            onSendToTe={handleSendToTeFromReview}
            onAcknowledgeTask={handleAcknowledgeTask}
            onApproveTask={handleApproveTask}
            onRequestRevision={handleRequestRevision}
            revisionSending={revisionSending}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
