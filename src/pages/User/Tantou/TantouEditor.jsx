import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Calendar, FileText, Sparkles } from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { WorkspaceHero } from "@/components/layout/WorkspaceHero.jsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getSession, logout } from "@/lib/auth.js";
import {
  LABEL_EDITOR_BOARD,
  LABEL_TANTOU_EDITOR,
  PATH_EDITOR_BOARD,
} from "@/constants/roleTerminology.js";
import { readEbDebutApproved } from "@/utils/ebDebutStorage.js";
import {
  applyScheduleForEbApprovedSeries,
  approveRecurringSubmission,
  forwardSubmissionToEb,
  isSeriesEbApproved,
  listPublishSchedules,
  listTantouSubmissions,
  rejectSubmissionToMangaka,
  seedTantouDemoIfEmpty,
  suggestPublishCadence,
  updateTantouSubmission,
} from "@/utils/tantouWorkspaceStorage.js";
import TantouPageReview from "./TantouPageReview.jsx";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
  { to: PATH_EDITOR_BOARD, label: LABEL_EDITOR_BOARD },
];

function statusVariant(status) {
  if (status === "pending") return "secondary";
  if (status === "forwarded_eb") return "default";
  if (status === "revision") return "destructive";
  return "outline";
}

function statusLabel(status) {
  const map = {
    pending: "Chờ duyệt",
    revision: "Đã gửi chỉnh",
    forwarded_eb: `Đã chuyển ${LABEL_EDITOR_BOARD}`,
    approved_publish: "Đã duyệt phát hành",
  };
  return map[status] ?? status;
}

function SubmissionCard({ sub, onReview, onQuickApprove, showQuickApprove }) {
  return (
    <Card className="group transition-all hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="flex size-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-20">
          {sub.mangakaImageUrl ? (
            <img
              src={sub.mangakaImageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl">
              📄
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{sub.seriesTitle}</h3>
            <Badge variant={statusVariant(sub.status)}>
              {statusLabel(sub.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Ch. {sub.chapterNum} · {sub.pageLabel} · {sub.mangakaName}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onReview(sub)}>
            Mở & nhận xét
          </Button>
          {showQuickApprove && sub.status === "pending" ? (
            <Button size="sm" onClick={() => onQuickApprove(sub.id)}>
              Duyệt nhanh
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TantouEditor() {
  const navigate = useNavigate();
  const user = getSession();
  const [tick, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    seedTantouDemoIfEmpty();
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onSync = () => refresh();
    window.addEventListener("mk-tantou-storage", onSync);
    window.addEventListener("mk-eb-approved-update", onSync);
    return () => {
      window.removeEventListener("mk-tantou-storage", onSync);
      window.removeEventListener("mk-eb-approved-update", onSync);
    };
  }, [refresh]);

  const submissions = useMemo(() => listTantouSubmissions(), [tick]);
  const schedules = useMemo(() => listPublishSchedules(), [tick]);
  const ebApproved = useMemo(() => readEbDebutApproved(), [tick]);

  const selected = useMemo(
    () => submissions.find((s) => s.id === selectedId) ?? null,
    [submissions, selectedId],
  );

  const debutQueue = useMemo(
    () =>
      submissions.filter(
        (s) => s.pipeline === "debut" && s.status !== "approved_publish",
      ),
    [submissions],
  );

  const recurringQueue = useMemo(
    () =>
      submissions.filter(
        (s) =>
          (s.pipeline === "recurring" || isSeriesEbApproved(s.seriesTitle)) &&
          s.status === "pending",
      ),
    [submissions, tick],
  );

  const scheduleSeries = useMemo(() => {
    const titles = new Set([
      ...Object.keys(ebApproved).filter((t) => ebApproved[t]),
      ...submissions
        .filter((s) => s.status === "forwarded_eb")
        .map((s) => s.seriesTitle),
    ]);
    return [...titles].map((title) => {
      const sub = submissions.find((s) => s.seriesTitle === title);
      const sched = schedules[title];
      const q = sub?.qualityScore ?? 70;
      const p = sub?.popularityScore ?? 65;
      return {
        title,
        qualityScore: q,
        popularityScore: p,
        suggested: suggestPublishCadence(q, p),
        cadence: sched?.cadence ?? sub?.publishCadence,
        label: sched?.label,
      };
    });
  }, [ebApproved, submissions, schedules]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function openReview(sub) {
    setSelectedId(sub.id);
    setReviewOpen(true);
  }

  function closeReview() {
    setReviewOpen(false);
    refresh();
  }

  function handleSaveReview(reviewData, options = {}) {
    if (!selected) return;

    const advanceNext = options.advanceNext === true;
    const nextStatus = reviewData.reviewStatus ?? "draft";
    const nextText = String(reviewData.reviewText ?? "").trim();
    const nextAverage = Number(reviewData.averageScore ?? 0);
    const nextTitle =
      String(reviewData.storyTitle ?? selected.seriesTitle).trim() ||
      selected.seriesTitle;
    const nextAuthor =
      String(reviewData.authorName ?? selected.mangakaName).trim() ||
      selected.mangakaName;
    const nextGenres = Array.isArray(reviewData.genres)
      ? reviewData.genres
      : [];
    const nextSynopsis = String(reviewData.synopsis ?? "").trim();

    if (nextStatus === "reject" && !nextText) {
      toast.error("Nhập lý do trước khi gửi Mangaka chỉnh.");
      return;
    }

    const editorialNotes = Array.isArray(reviewData.editorialNotes)
      ? reviewData.editorialNotes
      : [];
    const editorialNotesByPage = reviewData.editorialNotesByPage ?? undefined;

    updateTantouSubmission(selected.id, {
      seriesTitle: nextTitle,
      mangakaName: nextAuthor,
      mangakaImageUrl: reviewData.coverImageUrl ?? selected.mangakaImageUrl,
      seriesMeta: {
        ...(selected.seriesMeta ?? {}),
        genres: nextGenres,
        authorName: nextAuthor,
        synopsis: nextSynopsis,
      },
      reviewStatus: nextStatus,
      reviewRatings: reviewData.ratings ?? {},
      reviewAverageScore: nextAverage,
      reviewText: nextText,
      editorialComment: nextText,
      editorialNotes,
      editorialNotesByPage,
      reviewedAt: new Date().toISOString(),
    });

    const pool = submissions.filter((s) => s.status === "pending");
    const currentIndex = pool.findIndex((s) => s.id === selected.id);
    const nextInQueue =
      currentIndex >= 0 && currentIndex < pool.length - 1
        ? pool[currentIndex + 1]
        : pool.find((s) => s.id !== selected.id) ?? null;

    function maybeAdvance() {
      if (advanceNext && nextInQueue) {
        setSelectedId(nextInQueue.id);
        toast.success(`Đã lưu · chuyển sang Ch. ${nextInQueue.chapterNum}`);
        refresh();
        return true;
      }
      return false;
    }

    if (nextStatus === "reject") {
      rejectSubmissionToMangaka(selected.id, {
        editorialComment: nextText,
        reviewNotes: reviewData.ratings ?? {},
        editorialNotes,
      });
      toast.success("Đã gửi review và lý do về Mangaka.");
      if (!maybeAdvance()) {
        setReviewOpen(false);
        refresh();
      }
      return;
    }

    if (nextStatus === "publish") {
      if (selected.pipeline === "debut") {
        forwardSubmissionToEb(selected.id);
        toast.success(
          "Đã lưu review và chuyển series lần đầu sang Editor Board.",
        );
      } else {
        approveRecurringSubmission(selected.id);
        toast.success("Đã lưu review và duyệt chapter phát hành.");
      }
      if (!maybeAdvance()) {
        setReviewOpen(false);
        refresh();
      }
      return;
    }

    toast.success("Đã lưu bản nháp review.");
    if (!maybeAdvance()) {
      setReviewOpen(false);
      refresh();
    }
  }

  function handleApproveRecurring(id) {
    approveRecurringSubmission(id);
    toast.success("Chapter đã duyệt — sẵn sàng phát hành.");
    refresh();
  }

  function handleSetSchedule(title, q, p, cadence) {
    applyScheduleForEbApprovedSeries(title, q, p, cadence);
    toast.success(`Đã đặt lịch ${title}.`);
    refresh();
  }

  if (reviewOpen && selected) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />
        <main className="page-container flex-1 py-8">
          <TantouPageReview
            submission={selected}
            relatedSubmissions={submissions.filter(
              (s) => s.seriesTitle === selected.seriesTitle,
            )}
            allSubmissions={submissions}
            onCancel={closeReview}
            onSaveReview={handleSaveReview}
            onSelectChapter={(submissionId) => setSelectedId(submissionId)}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        className="from-sky-950 to-zinc-950"
        label={LABEL_TANTOU_EDITOR}
        title={`Xin chào${user?.name ? `, ${user.name}` : ""}`}
        description={`Nhận bản thảo từ Mangaka · viết nhận xét · chuyển ${LABEL_EDITOR_BOARD} hoặc duyệt phát hành.`}
      />

      <main className="page-container flex-1 space-y-8 py-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-amber-500" />
                Duyệt series riêng
              </CardTitle>
              <CardDescription>
                Xét chuyển {LABEL_EDITOR_BOARD} hoặc gửi Mangaka chỉnh (kèm nhận
                xét).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {debutQueue.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Không có series chờ duyệt.
                  </CardContent>
                </Card>
              ) : (
                debutQueue.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    onReview={openReview}
                    onQuickApprove={handleApproveRecurring}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <SidebarFlow />
        </section>

        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-sky-500" />
                Duyệt chapter riêng
              </CardTitle>
              <CardDescription>
                Series đã qua EB — chỉ cần Tantou duyệt chapter để phát hành.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recurringQueue.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Không có chapter chờ duyệt.
                  </CardContent>
                </Card>
              ) : (
                recurringQueue.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    onReview={openReview}
                    onQuickApprove={handleApproveRecurring}
                    showQuickApprove
                  />
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Lịch phát hành</h2>
            <p className="text-sm text-muted-foreground">
              Series đã được {LABEL_EDITOR_BOARD} chấp nhận.
            </p>
          </div>
          {scheduleSeries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Chưa có series qua {LABEL_EDITOR_BOARD}.
              </CardContent>
            </Card>
          ) : (
            scheduleSeries.map((row) => (
              <Card key={row.title}>
                <CardHeader>
                  <CardTitle>{row.title}</CardTitle>
                  <CardDescription>
                    Chất lượng {row.qualityScore}% · Độ nổi{" "}
                    {row.popularityScore}%{" · Gợi ý: "}
                    {row.suggested === "weekly"
                      ? "Theo tuần"
                      : row.suggested === "biweekly"
                        ? "2 tuần/lần"
                        : "Theo tháng"}
                    {row.label ? ` · Đang: ${row.label}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="gap-2">
                  <Button
                    variant={row.cadence === "weekly" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      handleSetSchedule(
                        row.title,
                        row.qualityScore,
                        row.popularityScore,
                        "weekly",
                      )
                    }
                  >
                    Theo tuần
                  </Button>
                  <Button
                    variant={row.cadence === "monthly" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      handleSetSchedule(
                        row.title,
                        row.qualityScore,
                        row.popularityScore,
                        "monthly",
                      )
                    }
                  >
                    Theo tháng
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

function SidebarFlow() {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Luồng công việc</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Lần đầu</p>
          <p>Mangaka → Assistant → Mangaka → Tantou → {LABEL_EDITOR_BOARD}</p>
        </div>
        <Separator />
        <div>
          <p className="font-medium text-foreground">Lần 2+</p>
          <p>Mangaka → chỉ Tantou duyệt → phát hành</p>
        </div>
        <Button variant="link" className="h-auto p-0" asChild>
          <Link to={PATH_EDITOR_BOARD}>Mở {LABEL_EDITOR_BOARD} →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
