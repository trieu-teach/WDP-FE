import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Gavel, Star } from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { WorkspaceHero } from "@/components/layout/WorkspaceHero.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSession, logout } from "@/lib/auth.js";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { updateSeriesEbAssessmentInWorkspace } from "@/utils/mangakaWorkspaceReader.js";
import { placeholderPageDataUrl } from "@/utils/placeholderPageDataUrl.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_SCORE_CRITERIA,
  EB_SCORE_MAX,
  EB_PUBLICATION_SCHEDULES,
  buildEmptyEbComments,
  buildEmptyEbScores,
  buildMemberScoresPayload,
  clampEbScore,
  formatEbClassification,
  formatEbScheduledPublishDate,
  mapEbChapterDetailResponse,
  mapEbChapterPendingItem,
  normalizeEbEvaluateResponse,
  normalizeMemberCommentsMap,
  normalizeMemberScoreMap,
  validateEbScore,
  validateMemberScoresPayload,
} from "@/utils/ebEvaluationMappers.js";
import {
  EB_COUNCIL_MEMBERS,
  buildCouncilAggregate,
  isEbChapterFullyScored,
  readCouncilSeriesScores,
  saveCouncilMemberAssessment,
} from "@/utils/ebCouncilStorage.js";
import "./Eb.css";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
  { to: "/tantou", label: "Tantou Editor" },
];

const SCORE_FIELDS = EB_SCORE_CRITERIA;
const SCORE_MAX = EB_SCORE_MAX;

function clampScore(value) {
  return clampEbScore(value);
}

function validateScore(value) {
  return validateEbScore(value);
}

function buildInitialNotes() {
  return buildEmptyEbComments();
}

function buildInitialScores() {
  return buildEmptyEbScores();
}

function buildEmptyScoreErrors() {
  return Object.fromEntries(SCORE_FIELDS.map((field) => [field.key, ""]));
}

function ScoreStars({ value }) {
  const safe = clampScore(value);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: SCORE_MAX }, (_, idx) => {
        const score = idx + 1;
        const isFull = safe >= score;
        const isHalf = !isFull && safe >= score - 0.5;
        return (
          <span key={score} className="relative inline-flex size-4">
            <Star className="size-4 text-muted-foreground/35" />
            {isFull ? (
              <Star className="absolute inset-0 size-4 fill-amber-400 text-amber-400" />
            ) : null}
            {isHalf ? (
              <span className="absolute inset-0 w-1/2 overflow-hidden">
                <Star className="size-4 fill-amber-400 text-amber-400" />
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function getClassification(average) {
  if (average < 2.5) {
    return {
      label: "KHÔNG ĐẠT",
      note: "Series chưa đạt chất lượng, cần chỉnh sửa lớn trước khi xét lại.",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (average < 3.5) {
    return {
      label: "ĐẠT",
      note: "Series có thể thông qua, nhưng cần cải thiện theo ghi chú.",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (average < 4.25) {
    return {
      label: "TỐT",
      note: "Chất lượng series ổn định, phù hợp duyệt nhanh.",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  return {
    label: "XUẤT SẮC",
    note: "Series chất lượng cao, phù hợp đẩy nổi bật/banner.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function CouncilScoresTable({
  memberRows,
  scoreFields,
  criterionAverages,
  councilAverage,
  scoredCount,
  activeMemberId,
}) {
  return (
    <div className="eb-council-table-wrap overflow-x-auto rounded-xl border bg-card">
      <table className="eb-council-table w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">Thành viên HĐ</th>
            {scoreFields.map((field) => (
              <th key={field.key} className="px-2 py-2.5 font-medium">
                {field.hint}
              </th>
            ))}
            <th className="px-3 py-2.5 font-medium">DTB</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {memberRows.map((row) => {
            const isActive = row.id === activeMemberId;
            return (
              <tr
                key={row.id}
                className={isActive ? "bg-primary/5" : undefined}
              >
                <td className="px-3 py-2.5">
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.title}</p>
                  {isActive ? (
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      Đang nhập
                    </Badge>
                  ) : null}
                </td>
                {scoreFields.map((field) => (
                  <td
                    key={field.key}
                    className="px-2 py-2.5 text-center tabular-nums"
                  >
                    {row.scored ? (
                      <span className="inline-flex flex-col items-center gap-0.5">
                        <span className="font-medium">
                          {clampScore(row.scores?.[field.key]).toFixed(1)}
                        </span>
                        <ScoreStars value={row.scores?.[field.key]} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center font-semibold tabular-nums">
                  {row.scored ? row.average.toFixed(1) : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="eb-council-table__avg border-t-2 bg-muted/25 font-medium">
            <td className="px-3 py-3">
              Trung bình Hội đồng
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {scoredCount}/{memberRows.length} thành viên đã chấm
              </span>
            </td>
            {scoreFields.map((field) => (
              <td
                key={field.key}
                className="px-2 py-3 text-center tabular-nums text-foreground"
              >
                {criterionAverages?.[field.key] != null
                  ? criterionAverages[field.key].toFixed(1)
                  : "—"}
              </td>
            ))}
            <td className="px-3 py-3 text-center text-base font-bold tabular-nums text-primary">
              {councilAverage.toFixed(1)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Eb() {
  const navigate = useNavigate();
  const { chapterId: routeChapterId } = useParams();
  const user = getSession();
  const isChapterDetail = Boolean(routeChapterId);
  const [councilTick, bumpCouncil] = useState(0);
  const [pendingChapters, setPendingChapters] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [publicationSchedule, setPublicationSchedule] = useState("");
  const [activeMemberId, setActiveMemberId] = useState(EB_COUNCIL_MEMBERS[0].id);
  const [scores, setScores] = useState(buildInitialScores);
  const [criterionNotes, setCriterionNotes] = useState(buildInitialNotes);
  const [overallComment, setOverallComment] = useState("");
  const [memberNotes, setMemberNotes] = useState("");
  const [evaluationNotes, setEvaluationNotes] = useState("");
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [scoreErrors, setScoreErrors] = useState(buildEmptyScoreErrors);
  const [pinnedChapter, setPinnedChapter] = useState(null);
  const refresh = useCallback(() => bumpCouncil((n) => n + 1), []);

  const loadPending = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setApiLoading(true);
    try {
      const { items } = await ebEvaluationsService.getChapterPending({
        page: 1,
        limit: 50,
      });
      const list = (Array.isArray(items) ? items : [])
        .map(mapEbChapterPendingItem)
        .filter(Boolean);
      setPendingChapters(list);
    } catch (err) {
      if (!silent) {
        toast.error(getApiErrorMessage(err, "Không tải được hàng chờ EB."));
        setPendingChapters([]);
      }
    } finally {
      if (!silent) setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending, councilTick]);

  const queueChapters = useMemo(
    () => pendingChapters.filter((item) => !isEbChapterFullyScored(item)),
    [pendingChapters, councilTick],
  );

  const loadChapterDetail = useCallback(async (chapterId) => {
    if (!chapterId) return null
    try {
      const data = await ebEvaluationsService.getChapterDetail(chapterId)
      const mapped = mapEbChapterDetailResponse(data)
      if (mapped) {
        setPinnedChapter(mapped)
        const latestEval = mapped.evaluationHistory?.at(-1)
        const normalized = normalizeEbEvaluateResponse({
          evaluation: latestEval,
          council_average: mapped.councilAverage,
          classification: mapped.classification,
          classification_text: mapped.classificationText,
        })
        if (normalized.councilAverage != null) {
          setLastEvaluation({
            ...(normalized.evaluation ?? {}),
            council_average: normalized.councilAverage,
            classification: normalized.classification,
            classification_text: normalized.classificationText,
          })
        }
        return mapped
      }
    } catch {
      // fallback: dùng item từ pending list
    }
    return null
  }, []);

  useEffect(() => {
    if (routeChapterId) {
      setSelectedChapterId(routeChapterId);
    }
  }, [routeChapterId]);

  useEffect(() => {
    if (!routeChapterId) return
    void loadChapterDetail(routeChapterId)
  }, [routeChapterId, loadChapterDetail]);

  useEffect(() => {
    function onSync() {
      refresh();
    }
    window.addEventListener("mk-eb-pending-update", onSync);
    window.addEventListener("mk-eb-council-update", onSync);
    window.addEventListener("storage", onSync);
    window.addEventListener("mk-eb-approved-update", onSync);
    return () => {
      window.removeEventListener("mk-eb-pending-update", onSync);
      window.removeEventListener("mk-eb-council-update", onSync);
      window.removeEventListener("storage", onSync);
      window.removeEventListener("mk-eb-approved-update", onSync);
    };
  }, [refresh]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const activeChapter = useMemo(() => {
    const targetId = routeChapterId || selectedChapterId;
    if (targetId) {
      const fromPending = pendingChapters.find(
        (c) => c.id === targetId || String(c.raw?._id) === targetId,
      );
      if (fromPending) return fromPending;
      if (
        pinnedChapter
        && (pinnedChapter.id === targetId
          || String(pinnedChapter.raw?._id) === targetId)
      ) {
        return pinnedChapter;
      }
      return null;
    }
    return pendingChapters[0] ?? null;
  }, [pendingChapters, selectedChapterId, routeChapterId, pinnedChapter]);

  useEffect(() => {
    const targetId = routeChapterId || selectedChapterId;
    if (!targetId) return;
    const fromPending = pendingChapters.find(
      (c) => c.id === targetId || String(c.raw?._id) === targetId,
    );
    if (fromPending) {
      setPinnedChapter(fromPending);
    }
  }, [pendingChapters, routeChapterId, selectedChapterId]);

  const councilKey = activeChapter?.id ?? "";
  const activeTitle = activeChapter?.seriesName ?? "";
  const scoreFields = SCORE_FIELDS;

  const councilRecord = useMemo(
    () => (councilKey ? readCouncilSeriesScores(councilKey) : null),
    [councilKey, councilTick],
  );

  useEffect(() => {
    if (!councilKey) return;
    const record = readCouncilSeriesScores(councilKey);
    const memberEntry = record?.members?.[activeMemberId];
    if (memberEntry?.scores) {
      const normalizedScores = normalizeMemberScoreMap(memberEntry.scores);
      setScores((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(normalizedScores).map(([key, value]) => [
            key,
            Number(value).toFixed(1),
          ]),
        ),
      }));
      setCriterionNotes((current) => ({
        ...current,
        ...normalizeMemberCommentsMap(memberEntry.criterionNotes),
      }));
      setOverallComment(memberEntry.overallComment ?? "");
      setMemberNotes(memberEntry.notes ?? "");
      setScoreErrors(buildEmptyScoreErrors());
      return;
    }

    setScores(buildInitialScores());
    setCriterionNotes(buildInitialNotes());
    setOverallComment("");
    setMemberNotes("");
    setScoreErrors(buildEmptyScoreErrors());
  }, [councilKey, activeMemberId, councilTick]);
  const activeSeriesImage =
    activeChapter?.previewImageUrl ||
    placeholderPageDataUrl(
      activeChapter
        ? `${activeChapter.seriesName} · Ch.${activeChapter.chapterNumber}`
        : "Chưa chọn chapter",
    );
  const average = useMemo(() => {
    const total = scoreFields.reduce(
      (sum, field) => sum + clampScore(scores[field.key]),
      0,
    );
    return scoreFields.length ? total / scoreFields.length : 0;
  }, [scoreFields, scores]);
  const classification = getClassification(average);
  const councilAggregate = useMemo(() => {
    const keys = scoreFields.map((field) => field.key);
    return buildCouncilAggregate(councilRecord, keys);
  }, [councilRecord, scoreFields]);
  const councilClassification = getClassification(councilAggregate.councilAverage);
  const activeMember = EB_COUNCIL_MEMBERS.find((m) => m.id === activeMemberId);

  function updateScore(key, value) {
    setScores((current) => ({ ...current, [key]: value }));
    setScoreErrors((current) => ({ ...current, [key]: validateScore(value) }));
  }

  function normalizeScoreField(key) {
    const nextValue = clampScore(scores[key]).toFixed(1);
    setScores((current) => ({ ...current, [key]: nextValue }));
    setScoreErrors((current) => ({ ...current, [key]: validateScore(nextValue) }));
  }

  function updateCriterionNote(key, value) {
    setCriterionNotes((current) => ({ ...current, [key]: value }));
  }

  function openChapterEvaluate(chapterId) {
    if (!chapterId) return;
    setSelectedChapterId(chapterId);
    void loadChapterDetail(chapterId);
    navigate(`/eb/chapter/${encodeURIComponent(chapterId)}`);
  }

  function buildMemberScoresDraft() {
    return buildMemberScoresPayload({
      councilRecord,
      activeMemberId,
      draft: {
        scores,
        criterionNotes,
        overallComment,
        notes: memberNotes,
        enteredBy: user?.name ?? "Đại diện EB",
      },
    });
  }

  function validateCurrentMemberForm() {
    const nextErrors = Object.fromEntries(
      scoreFields.map((field) => [field.key, validateScore(scores[field.key])]),
    );
    setScoreErrors((current) => ({ ...current, ...nextErrors }));
    return !Object.values(nextErrors).some(Boolean);
  }

  async function handleSubmitScores() {
    if (!activeChapter?.id) {
      toast.error("Chưa có chapter trong hàng chờ để chấm điểm.");
      return;
    }
    if (!validateCurrentMemberForm()) {
      toast.error("Có tiêu chí chưa hợp lệ. Vui lòng kiểm tra lại điểm thành viên đang nhập.");
      return;
    }

    const memberScores = buildMemberScoresDraft();
    const payloadError = validateMemberScoresPayload(memberScores);
    if (payloadError) {
      toast.error(payloadError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await ebEvaluationsService.evaluateChapter(activeChapter.id, {
        member_scores: memberScores,
        ...(evaluationNotes.trim() ? { notes: evaluationNotes.trim() } : {}),
      });
      const normalized = normalizeEbEvaluateResponse(res);
      const evaluation = {
        ...(normalized.evaluation ?? {}),
        council_average: normalized.councilAverage,
        classification: normalized.classification,
        classification_text: normalized.classificationText,
      };
      setLastEvaluation(evaluation);
      setPinnedChapter((current) => {
        const base =
          current?.id === activeChapter.id ? current : activeChapter;
        return {
          ...base,
          councilAverage: normalized.councilAverage ?? base?.councilAverage ?? null,
          classification: normalized.classification ?? base?.classification ?? null,
          classificationText:
            normalized.classificationText || base?.classificationText || "",
        };
      });
      if (activeChapter?.id) {
        setSelectedChapterId(activeChapter.id);
      }
      const classificationLabel = formatEbClassification(evaluation);
      const councilAvg = normalized.councilAverage;
      toast.success(
        normalized.message
        || `Đã gửi điểm Hội đồng${classificationLabel ? ` · ${classificationLabel}` : ""}${councilAvg != null ? ` · DTB ${Number(councilAvg).toFixed(1)}` : ""}.`,
      );
      void loadPending({ silent: true });
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không gửi được điểm đánh giá."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmPublish() {
    if (!activeChapter?.id) {
      toast.error("Chưa có chapter trong hàng chờ để xác nhận publish.");
      return;
    }
    const schedule = publicationSchedule.trim();
    const scheduled_publish_at = formatEbScheduledPublishDate(scheduledPublishAt);
    if (!schedule && !scheduled_publish_at) {
      toast.error("Chọn lịch phát hành (weekly/monthly) hoặc ngày publish cụ thể.");
      return;
    }
    const hasScores =
      lastEvaluation?.council_average != null
      || activeChapter?.councilAverage != null;
    if (!hasScores) {
      toast.error("Gửi điểm Hội đồng trước khi xác nhận publish.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await ebEvaluationsService.confirmPublish(activeChapter.id, {
        ...(schedule ? { publication_schedule: schedule } : {}),
        ...(scheduled_publish_at ? { scheduled_publish_at } : {}),
      });
      const seriesName = res?.series?.name ?? activeChapter?.seriesName ?? "Series";
      toast.success(
        res?.message
        || `Series "${seriesName}" đã publish${scheduled_publish_at ? ` ngày ${scheduled_publish_at}` : ""}${res?.council_average != null ? ` · DTB ${Number(res.council_average).toFixed(1)}` : ""}.`,
      );
      setSelectedChapterId("");
      setScheduledPublishAt("");
      setPublicationSchedule("");
      setEvaluationNotes("");
      setLastEvaluation(null);
      await loadPending();
      refresh();
      if (isChapterDetail) {
        navigate("/eb");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không xác nhận được lịch publish."));
    } finally {
      setSubmitting(false);
    }
  }

  function handleApproveChapter() {
    void handleConfirmPublish();
  }

  function handleSaveAssessment() {
    if (!activeChapter?.id) {
      toast.error("Chưa có chapter trong hàng chờ để chấm điểm.");
      return;
    }

    const nextErrors = Object.fromEntries(
      scoreFields.map((field) => [field.key, validateScore(scores[field.key])]),
    );
    setScoreErrors((current) => ({ ...current, ...nextErrors }));
    const hasInvalid = Object.values(nextErrors).some(Boolean);
    if (hasInvalid) {
      toast.error("Có tiêu chí chưa hợp lệ. Vui lòng kiểm tra lại điểm.");
      return;
    }

    const criterionDetails = scoreFields.map((field) => ({
      key: field.key,
      label: field.label,
      hint: field.hint,
      score: clampScore(scores[field.key]),
      note: criterionNotes[field.key] || "",
    }));
    const summaryNotes = criterionDetails
      .filter((criterion) => criterion.note.trim())
      .map((criterion) => `${criterion.label}: ${criterion.note.trim()}`);

    saveCouncilMemberAssessment(councilKey, activeMemberId, {
      scores: Object.fromEntries(
        criterionDetails.map((criterion) => [criterion.key, criterion.score]),
      ),
      criterionNotes: { ...criterionNotes },
      overallComment,
      notes: memberNotes,
      average: Number(average.toFixed(1)),
      assessedAt: new Date().toISOString(),
      enteredBy: user?.name ?? "Đại diện EB",
    });

    const updatedRecord = readCouncilSeriesScores(councilKey);
    const keys = scoreFields.map((field) => field.key);
    const aggregate = buildCouncilAggregate(updatedRecord, keys);
    const councilClass = getClassification(aggregate.councilAverage);

    const memberAssessments = aggregate.memberRows
      .filter((row) => row.scored)
      .map((row) => ({
        memberId: row.id,
        memberName: row.name,
        memberTitle: row.title,
        average: row.average,
        scores: row.scores,
        assessedAt: row.assessedAt,
        enteredBy: row.enteredBy,
      }));

    updateSeriesEbAssessmentInWorkspace(activeTitle, {
      seriesTitle: activeTitle,
      chapterNum: activeChapter?.chapterNumber ?? null,
      average: aggregate.councilAverage,
      councilAverage: aggregate.councilAverage,
      memberAverage: Number(average.toFixed(1)),
      activeMemberId,
      activeMemberName: activeMember?.name ?? null,
      classification: councilClass.label,
      classificationNote: councilClass.note,
      scores: aggregate.criterionAverages,
      criteria: scoreFields.map((field) => ({
        key: field.key,
        label: field.label,
        hint: field.hint,
        score: aggregate.criterionAverages[field.key] ?? 0,
        note: "",
      })),
      memberAssessments,
      councilScoredCount: aggregate.scoredCount,
      councilMemberCount: EB_COUNCIL_MEMBERS.length,
      summaryNotes,
      source: "eb-council",
      assessedAt: new Date().toISOString(),
      enteredBy: user?.name ?? "Đại diện EB",
    });

    refresh();
    toast.success(
      `Đã lưu điểm ${activeMember?.name ?? "thành viên"} · DTB HĐ ${aggregate.councilAverage.toFixed(1)} (${aggregate.scoredCount}/${EB_COUNCIL_MEMBERS.length})`,
    );
  }

  return (
    <div className="ws-page--eb flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      {!isChapterDetail ? (
        <WorkspaceHero
          label={LABEL_EDITOR_BOARD}
          title={`Xin chào${user?.name ? `, ${user.name}` : ""}`}
          description="Chọn chapter trong hàng chờ để chấm điểm và phê duyệt xuất bản."
          className="ws-hero--eb"
        />
      ) : null}

      <main className="page-container flex-1 space-y-8 py-8">
        {isChapterDetail ? (
          <>
            <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to="/eb">
                  <ArrowLeft className="size-4" />
                  Quay lại hàng chờ
                </Link>
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-widest text-primary">
                  Chấm điểm chapter
                </p>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {activeChapter
                    ? `${activeChapter.seriesName} · Ch.${activeChapter.chapterNumber}`
                    : "Chapter"}
                </h1>
                {activeChapter?.title ? (
                  <p className="text-sm text-muted-foreground">{activeChapter.title}</p>
                ) : null}
              </div>
            </header>

            {apiLoading ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  Đang tải thông tin chapter...
                </CardContent>
              </Card>
            ) : !activeChapter ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                  <p className="text-muted-foreground">
                    Không tìm thấy chapter trong hàng chờ EB.
                  </p>
                  <Button asChild variant="outline">
                    <Link to="/eb">Về hàng chờ</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>Nhập điểm (tài khoản đại diện)</CardTitle>
              <CardDescription>
                Đại diện Hội đồng nhập điểm cho từng thành viên. Bảng bên dưới
                luôn hiển thị đủ điểm của cả Hội đồng và DTB chung.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="eb-rep-banner rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">
                  Tài khoản đại diện:{" "}
                  <span className="text-primary">
                    {user?.name ?? "Thư ký Hội đồng"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chọn thành viên HĐ, nhập điểm thay họ, rồi lưu — có thể lần
                  lượt nhập cho từng người trong cùng series.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Chapter đang chấm</Label>
                  <Select
                    value={activeChapter?.id || undefined}
                    onValueChange={(id) => openChapterEvaluate(id)}
                    disabled={queueChapters.length === 0 || apiLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          apiLoading
                            ? "Đang tải hàng chờ..."
                            : queueChapters.length
                              ? "Chọn chapter trong hàng chờ"
                              : "Chưa có chapter chờ EB duyệt"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {queueChapters.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.seriesName} · Ch.{item.chapterNumber}
                          {item.title ? ` — ${item.title}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {apiLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Đang tải từ <code className="text-[10px]">GET /eb-evaluations/pending</code>...
                    </p>
                  ) : queueChapters.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      TE cần bấm Approve series trước — chapters sẽ chuyển sang{" "}
                      <code className="text-[10px]">pending_EB</code>.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Thành viên đang nhập điểm</Label>
                <Select value={activeMemberId} onValueChange={setActiveMemberId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn thành viên Hội đồng" />
                  </SelectTrigger>
                  <SelectContent>
                    {EB_COUNCIL_MEMBERS.map((member) => {
                      const scored = councilAggregate.memberRows.find(
                        (row) => row.id === member.id,
                      )?.scored;
                      return (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                          {scored ? " · đã chấm" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {activeMember ? (
                  <p className="text-xs text-muted-foreground">
                    {activeMember.title} — DTB cá nhân tạm tính:{" "}
                    <strong className="text-foreground">
                      {average.toFixed(1)}
                    </strong>
                  </p>
                ) : null}
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Điểm các thành viên Hội đồng
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Hiển thị đầy đủ điểm đã lưu của từng thành viên và trung
                    bình chung.
                  </p>
                </div>
                <CouncilScoresTable
                  memberRows={councilAggregate.memberRows}
                  scoreFields={scoreFields}
                  criterionAverages={councilAggregate.criterionAverages}
                  councilAverage={councilAggregate.councilAverage}
                  scoredCount={councilAggregate.scoredCount}
                  activeMemberId={activeMemberId}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {scoreFields.map((field) => (
                  <div
                    key={field.key}
                    className="space-y-3 rounded-xl border bg-card p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {clampScore(scores[field.key]).toFixed(1)} / {SCORE_MAX}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {field.hint}
                      </p>
                      <ScoreStars value={scores[field.key]} />
                    </div>
                    <Input
                      id={field.key}
                      type="number"
                      min="0"
                      max={String(SCORE_MAX)}
                      step="0.5"
                      value={scores[field.key]}
                      onChange={(event) =>
                        updateScore(field.key, event.target.value)
                      }
                      onBlur={() => normalizeScoreField(field.key)}
                      aria-invalid={Boolean(scoreErrors[field.key])}
                    />
                    {scoreErrors[field.key] ? (
                      <p className="text-xs text-red-600">{scoreErrors[field.key]}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Nhập điểm từ 0 đến {SCORE_MAX}, bước 0.5.
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label
                        htmlFor={`${field.key}-note`}
                        className="text-xs text-muted-foreground"
                      >
                        Ghi chú riêng cho tiêu chí này
                      </Label>
                      <Textarea
                        id={`${field.key}-note`}
                        value={criterionNotes[field.key]}
                        onChange={(event) =>
                          updateCriterionNote(field.key, event.target.value)
                        }
                        placeholder="Nhận xét ngắn cho tiêu chí này..."
                        className="min-h-20"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eb-overall-comment">Nhận xét tổng thể</Label>
                  <Textarea
                    id="eb-overall-comment"
                    value={overallComment}
                    onChange={(event) => setOverallComment(event.target.value)}
                    placeholder="Nhận xét chung của thành viên này..."
                    className="min-h-24"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eb-member-notes">Ghi chú thêm</Label>
                  <Textarea
                    id="eb-member-notes"
                    value={memberNotes}
                    onChange={(event) => setMemberNotes(event.target.value)}
                    placeholder="Ghi chú bổ sung (optional)..."
                    className="min-h-24"
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  DTB Hội đồng (tổng hợp)
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-4xl font-bold tracking-tight text-foreground">
                    {councilAggregate.councilAverage.toFixed(1)}
                  </div>
                  <Badge variant="outline">/ {SCORE_MAX}.0</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {councilAggregate.scoredCount}/{EB_COUNCIL_MEMBERS.length} thành
                  viên đã chấm
                  {activeMember ? (
                    <>
                      {" "}
                      · Đang nhập cho{" "}
                      <strong className="text-foreground">
                        {activeMember.name}
                      </strong>{" "}
                      (DTB {average.toFixed(1)})
                    </>
                  ) : null}
                </p>
                <Badge
                  variant="secondary"
                  className={`mt-3 border ${councilClassification.className}`}
                >
                  {councilClassification.label}
                </Badge>
                <p className="mt-3 text-sm text-muted-foreground">
                  {councilClassification.note}
                </p>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>Dưới 2.5 điểm</span>
                    <span className="font-medium text-red-700">KHÔNG ĐẠT</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Từ 2.5 đến dưới 3.5 điểm</span>
                    <span className="font-medium text-amber-700">ĐẠT</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Từ 3.5 đến dưới 4.25 điểm</span>
                    <span className="font-medium text-sky-700">TỐT</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Từ 4.25 đến 5.0 điểm</span>
                    <span className="font-medium text-emerald-700">
                      XUẤT SẮC
                    </span>
                  </div>
                </div>

                <Button className="mt-4 w-full" onClick={handleSaveAssessment}>
                  Lưu nháp thành viên đang chọn
                </Button>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="eb-evaluation-notes">Ghi chú đánh giá (optional)</Label>
                  <Textarea
                    id="eb-evaluation-notes"
                    value={evaluationNotes}
                    onChange={(event) => setEvaluationNotes(event.target.value)}
                    placeholder="Ghi chú gửi kèm khi chấm điểm series..."
                    className="min-h-20"
                  />
                </div>

                <Button
                  className="mt-2 w-full"
                  variant="secondary"
                  disabled={submitting || !activeChapter?.id}
                  onClick={() => void handleSubmitScores()}
                >
                  Gửi điểm Hội đồng
                </Button>

                {lastEvaluation?.council_average != null ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Kết quả vừa gửi: DTB{" "}
                    <strong className="text-foreground">
                      {Number(lastEvaluation.council_average).toFixed(1)}
                    </strong>
                    {formatEbClassification(lastEvaluation)
                      ? ` · ${formatEbClassification(lastEvaluation)}`
                      : ""}
                  </p>
                ) : null}

                <div className="mt-4 space-y-3 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="eb-publication-schedule">
                      Lịch phát hành (weekly / monthly)
                    </Label>
                    <Select
                      value={publicationSchedule || undefined}
                      onValueChange={setPublicationSchedule}
                    >
                      <SelectTrigger id="eb-publication-schedule" className="w-full">
                        <SelectValue placeholder="Chọn weekly hoặc monthly (tùy chọn)" />
                      </SelectTrigger>
                      <SelectContent>
                        {EB_PUBLICATION_SCHEDULES.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eb-scheduled-publish">
                      Ngày publish cụ thể (YYYY-MM-DD)
                    </Label>
                    <Input
                      id="eb-scheduled-publish"
                      type="date"
                      value={scheduledPublishAt}
                      onChange={(event) => setScheduledPublishAt(event.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={
                      submitting
                      || !activeChapter?.id
                      || (!publicationSchedule && !scheduledPublishAt)
                    }
                    onClick={handleApproveChapter}
                  >
                    <CheckCircle2 className="size-4" />
                    Xác nhận publish series
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Bước 1: <code className="text-[10px]">POST .../evaluate</code>{" "}
                    — lưu điểm, không đổi status chapter/series · Bước 2:{" "}
                    <code className="text-[10px]">POST .../confirm-publish</code>{" "}
                    — cần DTB ≥ 2.5; gửi <code className="text-[10px]">publication_schedule</code>{" "}
                    và/hoặc <code className="text-[10px]">scheduled_publish_at</code>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Preview chapter</CardTitle>
              <CardDescription>
                Ảnh trang đầu từ chapter đang chờ EB duyệt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-muted/30">
                <img
                  src={activeSeriesImage}
                  alt={
                    activeChapter
                      ? `${activeChapter.seriesName} Ch.${activeChapter.chapterNumber}`
                      : "Ảnh chapter đang chấm"
                  }
                  className="h-[520px] w-full object-cover"
                />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">pending_EB</Badge>
                  {activeChapter?.classification ? (
                    <Badge variant="outline">{activeChapter.classification}</Badge>
                  ) : null}
                  {activeChapter?.chapterNumber != null ? (
                    <Badge variant="outline">Ch. {activeChapter.chapterNumber}</Badge>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {activeChapter
                    ? `${activeChapter.seriesName}${activeChapter.title ? ` — ${activeChapter.title}` : ""}`
                    : "Chưa có chapter trong hàng chờ"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeChapter?.classificationText ||
                    activeChapter?.mangakaName ||
                    "Chọn chapter từ hàng chờ để chấm điểm và đánh giá."}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
            )}
          </>
        ) : null}

        {!isChapterDetail ? (
        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Gavel className="size-5 text-primary" />
              Hàng chờ duyệt
            </h2>
            <p className="text-sm text-muted-foreground">
              Đồng bộ từ{" "}
              <Link
                to="/mangaka"
                className="font-medium text-primary hover:underline"
              >
                Mangaka
              </Link>
              {" / "}
              <Link
                to="/tantou"
                className="font-medium text-primary hover:underline"
              >
                Tantou
              </Link>
            </p>
          </div>

          {apiLoading ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Đang tải hàng chờ EB...
              </CardContent>
            </Card>
          ) : queueChapters.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Không có chapter nào đang chờ EB duyệt.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {queueChapters.map((ch) => (
                <Card
                  key={ch.id}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-4">
                      {ch.previewImageUrl ? (
                        <img
                          src={ch.previewImageUrl}
                          alt=""
                          className="size-16 shrink-0 rounded-lg border object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">
                            {ch.seriesName} · Ch.{ch.chapterNumber}
                          </h3>
                          <Badge variant="secondary">{ch.status}</Badge>
                          {ch.classification ? (
                            <Badge variant="outline">{ch.classification}</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {[ch.title, ch.mangakaName, ch.classificationText]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {ch.submittedAt ? (
                          <p className="text-xs text-muted-foreground">
                            Gửi:{" "}
                            {new Date(ch.submittedAt).toLocaleString("vi-VN")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Button onClick={() => openChapterEvaluate(ch.id)}>
                      <CheckCircle2 className="size-4" />
                      Chấm điểm
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
