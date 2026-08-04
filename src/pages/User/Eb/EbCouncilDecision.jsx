import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSession, logout } from "@/lib/auth.js";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { EB_NAV_LINKS } from "@/constants/ebNav.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_SCORE_MAX,
  EB_COUNCIL_MIN_FOR_PUBLISH,
  EB_COUNCIL_MAX_FOR_EVALUATE,
  EB_EVALUATION_RESULTS,
  EB_PUBLICATION_SCHEDULES,
  buildMemberScoresPayload,
  formatEbClassification,
  getEbAgeSafetyFailFromError,
  getEbClassificationStyle,
  getEbDebutGateLockFromError,
  mapEbChapterDetailResponse,
  mapEbChapterPendingItem,
  mapEbPreviewCouncilAverageResponse,
  normalizeEbEvaluateResponse,
  resolveEbIsFirstReview,
  validateMemberScoresPayload,
} from "@/utils/ebEvaluationMappers.js";
import {
  buildEmptyContentLevels,
  mapAgeSafetyResponse,
  mapExtensionScoresToApi,
  normalizeContentLevels,
} from "@/utils/ebScoringRubric.js";
import {
  buildCouncilAggregate,
  readCouncilRoster,
  readCouncilSeriesScores,
  readCouncilSessionMeta,
} from "@/utils/ebCouncilStorage.js";
import { cn } from "@/lib/utils";
import "./Eb.css";

const NAV_LINKS = EB_NAV_LINKS;
const SCORE_MAX = EB_SCORE_MAX;
const CORE_KEYS = [
  "story_dialogue",
  "art_design",
  "panel_camera",
  "pacing_climax",
  "color",
];

export default function EbCouncilDecision() {
  const navigate = useNavigate();
  const { chapterId } = useParams();
  const user = getSession();

  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [scoresSubmitted, setScoresSubmitted] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState("approved");
  const [publicationSchedule, setPublicationSchedule] = useState("weekly");
  const [evaluationNotes, setEvaluationNotes] = useState("");
  const [quickNotes, setQuickNotes] = useState("");
  const [previewCouncilAvg, setPreviewCouncilAvg] = useState(null);
  const [previewClassification, setPreviewClassification] = useState(null);
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [contentLevels, setContentLevels] = useState(buildEmptyContentLevels);
  const [rubricOverrideId, setRubricOverrideId] = useState(null);
  const [councilTick, setCouncilTick] = useState(0);

  const councilKey = String(chapterId ?? "").trim();

  const loadChapter = useCallback(async () => {
    if (!chapterId) return;
    setLoading(true);
    try {
      const data = await ebEvaluationsService.getChapterDetail(chapterId);
      const mapped = mapEbChapterDetailResponse(data);
      if (mapped) {
        setChapter(mapped);
        const latestEval = mapped.evaluationHistory?.at(-1);
        if (latestEval?.content_levels) {
          setContentLevels(normalizeContentLevels(latestEval.content_levels));
        }
        if (mapped.publicationSchedule) {
          setPublicationSchedule(mapped.publicationSchedule);
        }
        const normalized = normalizeEbEvaluateResponse({
          evaluation: latestEval,
          council_average: mapped.councilAverage,
          classification: mapped.classification,
          classification_text: mapped.classificationText,
        });
        if (normalized.councilAverage != null || normalized.evaluation) {
          setLastEvaluation({
            ...(normalized.evaluation ?? {}),
            council_average: normalized.councilAverage,
            classification: normalized.classification,
            classification_text: normalized.classificationText,
          });
          if (normalized.councilAverage != null) {
            setPreviewCouncilAvg(Number(normalized.councilAverage));
          }
          if (normalized.classification) {
            setPreviewClassification(normalized.classification);
          }
          if (normalized.evaluation?.result || latestEval?.result) {
            setScoresSubmitted(true);
            setEvaluationResult(
              String(normalized.evaluation?.result || latestEval.result),
            );
          }
        }
        return;
      }
      throw new Error("empty");
    } catch {
      try {
        const { items } = await ebEvaluationsService.getChapterPending({
          page: 1,
          limit: 50,
        });
        const found = (items ?? [])
          .map(mapEbChapterPendingItem)
          .find((item) => String(item.id) === String(chapterId));
        setChapter(found ?? null);
      } catch {
        setChapter(null);
      }
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    void loadChapter();
  }, [loadChapter]);

  useEffect(() => {
    function onSync() {
      setCouncilTick((n) => n + 1);
    }
    window.addEventListener("mk-eb-council-update", onSync);
    return () => window.removeEventListener("mk-eb-council-update", onSync);
  }, []);

  useEffect(() => {
    if (!councilKey) return;
    const meta = readCouncilSessionMeta(councilKey);
    if (meta?.contentLevels) {
      setContentLevels(normalizeContentLevels(meta.contentLevels));
    }
    if (meta?.rubricOverrideId) {
      setRubricOverrideId(String(meta.rubricOverrideId));
    }
  }, [councilKey, councilTick]);

  const councilRoster = useMemo(
    () => (councilKey ? readCouncilRoster(councilKey) : []),
    [councilKey, councilTick],
  );
  const councilRecord = useMemo(
    () => (councilKey ? readCouncilSeriesScores(councilKey) : null),
    [councilKey, councilTick],
  );

  const extensionKeys = useMemo(() => {
    const first = Object.values(councilRecord?.members ?? {})[0];
    return Object.keys(first?.extensionScores ?? {});
  }, [councilRecord]);

  const scoreKeys = useMemo(() => {
    const fromMembers = new Set(CORE_KEYS);
    for (const entry of Object.values(councilRecord?.members ?? {})) {
      Object.keys(entry?.scores ?? {}).forEach((k) => fromMembers.add(k));
      Object.keys(entry?.extensionScores ?? {}).forEach((k) => fromMembers.add(k));
    }
    return [...fromMembers];
  }, [councilRecord]);

  const councilAggregate = useMemo(
    () => buildCouncilAggregate(councilRecord, scoreKeys, councilRoster),
    [councilRecord, scoreKeys, councilRoster],
  );

  const rosterCount = councilRoster.length;
  const allMembersDraftSaved =
    rosterCount > 0 && councilAggregate.scoredCount >= rosterCount;
  const canSubmitScores =
    allMembersDraftSaved && rosterCount >= EB_COUNCIL_MIN_FOR_PUBLISH;

  const unscoredMemberNames = useMemo(
    () =>
      councilAggregate.memberRows
        .filter((row) => !row.scored)
        .map((row) => row.name)
        .filter(Boolean),
    [councilAggregate.memberRows],
  );

  const seriesId = chapter?.seriesId ?? null;
  const hasPriorEvaluation = useMemo(() => {
    const history = chapter?.evaluationHistory;
    if (Array.isArray(history) && history.length > 0) return true;
    return Boolean(lastEvaluation?.result || lastEvaluation?.council_average != null);
  }, [chapter?.evaluationHistory, lastEvaluation]);

  const isFirstReview = useMemo(
    () =>
      resolveEbIsFirstReview({
        seriesStatus: chapter?.seriesStatus ?? chapter?.status,
        firstReviewFlag:
          chapter?.firstReview === true
            ? true
            : chapter?.firstReview === false
              ? false
              : null,
        hasPriorEvaluation,
      }),
    [chapter, hasPriorEvaluation],
  );

  const canDecide = isFirstReview ? canSubmitScores : true;

  const councilClassification = getEbClassificationStyle(
    previewClassification ?? lastEvaluation?.classification ?? null,
    {
      scored:
        previewCouncilAvg != null
        || councilAggregate.scoredCount > 0
        || lastEvaluation?.classification != null,
      average: previewCouncilAvg ?? councilAggregate.councilAverage,
    },
  );

  useEffect(() => {
    if (!isFirstReview || !canSubmitScores || previewCouncilAvg != null) return undefined;
    const timer = window.setTimeout(() => {
      void runPreviewCouncilAverage({ silent: true });
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirstReview, canSubmitScores, councilTick, rubricOverrideId]);

  function buildMemberScoresDraft() {
    return buildMemberScoresPayload({
      councilRecord,
      members: councilRoster,
      activeMemberId: null,
      draft: null,
      scoreKeys: CORE_KEYS,
      extensionKeys,
      mapExtensionScoresToApi,
    });
  }

  async function runPreviewCouncilAverage({ silent = false } = {}) {
    const memberScores = buildMemberScoresDraft();
    if (!memberScores.length) {
      if (!silent) toast.error("Cần lưu nháp điểm trước khi cập nhật ĐTB.");
      return;
    }
    if (!silent) setPreviewLoading(true);
    try {
      const res = await ebEvaluationsService.previewCouncilAverage({
        ...(rubricOverrideId ? { rubric_id: rubricOverrideId } : {}),
        member_scores: memberScores,
      });
      const mapped = mapEbPreviewCouncilAverageResponse(res);
      setPreviewCouncilAvg(mapped.weightedCouncilAverage);
      setPreviewClassification(mapped.classification);
      if (!silent && mapped.weightedCouncilAverage != null) {
        toast.success(
          `ĐTB: ${Number(mapped.weightedCouncilAverage).toFixed(2)}`
          + (mapped.classificationText ? ` · ${mapped.classificationText}` : ""),
        );
      }
    } catch (err) {
      if (!silent) {
        toast.error(getApiErrorMessage(err, "Không cập nhật được ĐTB."));
      }
    } finally {
      if (!silent) setPreviewLoading(false);
    }
  }

  async function handleSubmitScores() {
    if (isFirstReview && !canSubmitScores) {
      toast.error(
        `Cần lưu nháp đủ hội đồng (${councilAggregate.scoredCount}/${rosterCount || 0}${
          unscoredMemberNames.length
            ? ` · thiếu: ${unscoredMemberNames.join(", ")}`
            : ""
        }).`,
      );
      return false;
    }
    if (isFirstReview && rosterCount > EB_COUNCIL_MAX_FOR_EVALUATE) {
      toast.error(`Tối đa ${EB_COUNCIL_MAX_FOR_EVALUATE} thành viên Hội đồng mỗi lần chấm.`);
      return false;
    }
    if (!evaluationResult) {
      toast.error("Chọn kết quả đánh giá.");
      return false;
    }
    if (evaluationResult === "approved" && !String(publicationSchedule || "").trim()) {
      toast.error("Khi duyệt bắt buộc chọn tần suất phát hành.");
      return false;
    }
    if (
      (evaluationResult === "revision" || evaluationResult === "rejected")
      && !String(isFirstReview ? evaluationNotes : (quickNotes || evaluationNotes)).trim()
    ) {
      toast.error(
        evaluationResult === "revision"
          ? "Khi chọn revision bắt buộc ghi chú feedback cho Mangaka."
          : "Khi từ chối bắt buộc ghi chú feedback cho Mangaka.",
      );
      return false;
    }
    if (!seriesId && !chapterId) {
      toast.error("Thiếu series/chapter để nộp đánh giá.");
      return false;
    }

    let memberScores = [];
    if (isFirstReview) {
      memberScores = buildMemberScoresDraft();
      const payloadError = validateMemberScoresPayload(
        memberScores,
        rosterCount,
        {
          scoreKeys: CORE_KEYS,
          criteria: CORE_KEYS.map((key) => ({ key, label: key })),
          extensionKeys,
          minCount: EB_COUNCIL_MIN_FOR_PUBLISH,
          maxCount: EB_COUNCIL_MAX_FOR_EVALUATE,
        },
      );
      if (payloadError) {
        toast.error(payloadError);
        return false;
      }
    }

    setSubmitting(true);
    try {
      if (isFirstReview) {
        const ageRating = chapter?.ageRating ?? "";
        if (ageRating) {
          const safetyBody = await ebEvaluationsService.checkAgeSafety({
            age_rating: ageRating,
            content_levels: contentLevels,
          });
          const safety = mapAgeSafetyResponse(safetyBody);
          if (safety && !safety.passed) {
            toast.error(
              safety.violations?.[0]?.message
              || "Age safety không đạt — không thể nộp đánh giá.",
            );
            return false;
          }
        }
      }

      const feedbackNotes = isFirstReview
        ? evaluationNotes.trim()
        : (quickNotes.trim() || evaluationNotes.trim());

      const payload = isFirstReview
        ? {
            result: evaluationResult,
            member_scores: memberScores,
            content_levels: contentLevels,
            ...(rubricOverrideId ? { rubric_id: rubricOverrideId } : {}),
            ...(feedbackNotes ? { notes: feedbackNotes } : {}),
            ...(evaluationResult === "approved"
              ? { publication_schedule: publicationSchedule }
              : {}),
          }
        : {
            quick_decision: evaluationResult,
            result: evaluationResult,
            ...(feedbackNotes ? { quick_notes: feedbackNotes } : {}),
            ...(evaluationNotes.trim() && evaluationNotes.trim() !== feedbackNotes
              ? { notes: evaluationNotes.trim() }
              : {}),
            ...(evaluationResult === "approved"
              ? { publication_schedule: publicationSchedule }
              : {}),
          };

      let res;
      try {
        if (seriesId) {
          res = await ebEvaluationsService.evaluateSeries(seriesId, payload);
        } else {
          res = await ebEvaluationsService.evaluateChapter(chapterId, payload);
        }
      } catch (primaryErr) {
        const gate = getEbDebutGateLockFromError(primaryErr);
        if (gate) {
          toast.error(gate.message);
          return false;
        }
        if (seriesId && primaryErr?.response?.status === 404 && chapterId) {
          res = await ebEvaluationsService.evaluateChapter(chapterId, payload);
        } else {
          throw primaryErr;
        }
      }

      const normalized = normalizeEbEvaluateResponse(res);
      if (normalized.ageSafety && !normalized.ageSafety.passed) {
        toast.error("Age safety không đạt — BE từ chối lưu đánh giá.");
        return false;
      }
      if (normalized.councilAverage != null) {
        setPreviewCouncilAvg(Number(normalized.councilAverage));
      }
      if (normalized.classification) {
        setPreviewClassification(normalized.classification);
      }
      const evaluation = {
        ...(normalized.evaluation ?? {}),
        council_average: normalized.councilAverage,
        classification: normalized.classification,
        classification_text: normalized.classificationText,
        result: evaluationResult,
      };
      setLastEvaluation(evaluation);
      setScoresSubmitted(true);
      toast.success(
        normalized.message
        || `Đã nộp kết quả · ${evaluationResult}${
          normalized.councilAverage != null
            ? ` · ĐTB ${Number(normalized.councilAverage).toFixed(1)}`
            : ""
        }.`,
      );
      return true;
    } catch (err) {
      const gate = getEbDebutGateLockFromError(err);
      if (gate) {
        toast.error(gate.message);
        return false;
      }
      const apiSafety = getEbAgeSafetyFailFromError(err);
      if (apiSafety) {
        toast.error(
          err?.response?.data?.message
          || "AGE_SAFETY_FAIL — nội dung vượt mức cho phép theo age rating.",
        );
        return false;
      }
      toast.error(getApiErrorMessage(err, "Không nộp được kết quả đánh giá."));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmClick() {
    if (isFirstReview && !canSubmitScores) {
      toast.error(
        `Cần lưu nháp đủ hội đồng (${councilAggregate.scoredCount}/${rosterCount || 0}${
          unscoredMemberNames.length
            ? ` · thiếu: ${unscoredMemberNames.join(", ")}`
            : ""
        }).`,
      );
      return;
    }

    let submitted = scoresSubmitted;
    if (!submitted) {
      submitted = await handleSubmitScores();
      if (!submitted) return;
    }

    if (evaluationResult === "approved") {
      navigate(`/eb/chapter/${encodeURIComponent(chapterId)}/publish`);
      return;
    }
    toast.message("Đã nộp quyết định — series không chuyển sang xác nhận lịch.");
    navigate("/eb");
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const scoreDisplay =
    previewCouncilAvg != null
      ? Number(previewCouncilAvg).toFixed(2)
      : (councilAggregate.scoredCount > 0
        ? councilAggregate.councilAverage.toFixed(1)
        : "—");

  return (
    <div className="ws-page--eb flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <main className="page-container flex-1 space-y-6 py-8">
        <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link to={chapterId ? `/eb/chapter/${encodeURIComponent(chapterId)}` : "/eb"}>
              <ArrowLeft className="size-4" />
              Về trang chấm điểm
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-sky-600">
              {LABEL_EDITOR_BOARD} · Quyết định
            </p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {loading
                ? "Đang tải…"
                : chapter
                  ? `${chapter.seriesName} · Ch.${chapter.chapterNumber}`
                  : "Quyết định đánh giá"}
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-500 shadow-sm">
            Đang tải thông tin chapter…
          </div>
        ) : !chapter ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-500 shadow-sm">
            Không tìm thấy chapter.
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link to="/eb">Về hàng chờ</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            {isFirstReview ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    ĐTB Hội đồng
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-3 py-1 text-xs font-semibold tracking-wide",
                      councilClassification.className,
                    )}
                  >
                    {councilClassification.label}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex items-end gap-2">
                      <span
                        className={cn(
                          "text-3xl font-extrabold tracking-tight tabular-nums",
                          (previewCouncilAvg != null || councilAggregate.scoredCount > 0)
                            ? "text-gray-900"
                            : "text-gray-300",
                        )}
                      >
                        {scoreDisplay}
                      </span>
                      <span className="mb-1 text-sm font-medium text-gray-400">
                        / {SCORE_MAX}.0
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Đã lưu nháp{" "}
                      <span className="font-medium text-gray-700">
                        {councilAggregate.scoredCount}/{rosterCount || 0}
                      </span>{" "}
                      thành viên
                    </p>
                    {councilClassification.code && councilClassification.note ? (
                      <p className="mt-1 text-[11px] text-gray-400">
                        {councilClassification.note}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={previewLoading || !canSubmitScores}
                    onClick={() => void runPreviewCouncilAverage()}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {previewLoading ? "Đang tính…" : "Cập nhật ĐTB"}
                  </button>
                </div>
              </>
            ) : (
              <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-800">
                  Second review · Quyết định nhanh
                </p>
                <p className="mt-1 text-sm text-sky-900/80">
                  Series đã được chấm trước đó — không cần nhập lại điểm hội đồng.
                  {lastEvaluation?.council_average != null
                    ? ` ĐTB lần trước: ${Number(lastEvaluation.council_average).toFixed(1)}.`
                    : ""}
                </p>
              </div>
            )}

            <div className={cn("space-y-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4", isFirstReview && "mt-5")}>
              <h4 className="text-sm font-semibold text-gray-900">
                {isFirstReview ? "Quyết định đánh giá" : "Quyết định nhanh"}
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eb-decision-result" className="text-xs text-gray-600">
                    Kết quả
                  </Label>
                  <Select
                    value={evaluationResult}
                    onValueChange={setEvaluationResult}
                  >
                    <SelectTrigger
                      id="eb-decision-result"
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <SelectValue placeholder="Chọn kết quả" />
                    </SelectTrigger>
                    <SelectContent>
                      {EB_EVALUATION_RESULTS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {evaluationResult === "approved" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="eb-decision-schedule" className="text-xs text-gray-600">
                      Tần suất phát hành
                    </Label>
                    <Select
                      value={publicationSchedule}
                      onValueChange={setPublicationSchedule}
                    >
                      <SelectTrigger
                        id="eb-decision-schedule"
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      >
                        <SelectValue placeholder="Chọn lịch" />
                      </SelectTrigger>
                      <SelectContent>
                        {EB_PUBLICATION_SCHEDULES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
              {!isFirstReview ? (
                <div className="space-y-1.5">
                  <Label htmlFor="eb-decision-quick-notes" className="text-xs text-gray-600">
                    Ghi chú quyết định
                  </Label>
                  <Textarea
                    id="eb-decision-quick-notes"
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                    placeholder="Lý do ngắn gọn…"
                    className="min-h-16 rounded-xl border border-gray-200 bg-white text-sm shadow-none"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="eb-decision-notes" className="text-xs text-gray-600">
                Ghi chú đánh giá (tuỳ chọn)
              </Label>
              <Textarea
                id="eb-decision-notes"
                value={evaluationNotes}
                onChange={(e) => setEvaluationNotes(e.target.value)}
                placeholder="Ghi chú kèm theo khi nộp điểm…"
                className="min-h-16 rounded-xl border border-gray-200 bg-white text-sm shadow-none"
              />
            </div>

            {lastEvaluation?.council_average != null ? (
              <p className="mt-2 text-[11px] text-gray-400">
                Đã nộp · ĐTB{" "}
                <strong className="font-medium text-gray-700">
                  {Number(lastEvaluation.council_average).toFixed(1)}
                </strong>
                {formatEbClassification(lastEvaluation)
                  ? ` · ${formatEbClassification(lastEvaluation)}`
                  : ""}
              </p>
            ) : null}

            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleConfirmClick()}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-black disabled:opacity-60",
                  !canDecide && "opacity-70",
                )}
              >
                <Calendar className="size-3.5" />
                {submitting
                  ? "Đang xử lý…"
                  : evaluationResult === "approved"
                    ? (scoresSubmitted
                      ? "Xác nhận lịch phát hành"
                      : "Nộp & xác nhận lịch phát hành")
                    : "Nộp kết quả đánh giá"}
                <ArrowRight className="size-3.5" />
              </button>
              {isFirstReview && !canSubmitScores ? (
                <p className="text-[11px] text-gray-400">
                  Cần lưu nháp đủ hội đồng ({councilAggregate.scoredCount}/{rosterCount || 0}
                  {unscoredMemberNames.length
                    ? ` · thiếu: ${unscoredMemberNames.join(", ")}`
                    : ""}
                  ).
                  {rosterCount > 0 && rosterCount < EB_COUNCIL_MIN_FOR_PUBLISH
                    ? ` Tối thiểu ${EB_COUNCIL_MIN_FOR_PUBLISH} thành viên.`
                    : ""}
                </p>
              ) : scoresSubmitted ? (
                <p className="text-[11px] text-gray-400">
                  Đã nộp kết quả — tiếp tục chốt lịch phát hành.
                </p>
              ) : (
                <p className="text-[11px] text-gray-400">
                  {isFirstReview
                    ? "Hội đồng đã lưu nháp đủ. Chọn kết quả rồi nộp để hoàn tất."
                    : "Chọn quick decision rồi nộp — không cần điểm hội đồng lần này."}
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
