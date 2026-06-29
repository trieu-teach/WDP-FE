import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Calendar, CheckCircle2, Gavel, Plus, Star } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { getSession, logout } from "@/lib/auth.js";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { ebScoresService } from "@/api/ebScores.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { updateSeriesEbAssessmentInWorkspace } from "@/utils/mangakaWorkspaceReader.js";
import { placeholderPageDataUrl } from "@/utils/placeholderPageDataUrl.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_SCORE_CRITERIA,
  EB_SCORE_MAX,
  buildEmptyEbComments,
  buildEmptyEbScores,
  buildMemberScoresPayload,
  clampEbScore,
  formatEbClassification,
  mapEbChapterDetailResponse,
  mapEbChapterPendingItem,
  mapEbChapterPreviewResponse,
  mapEbSeriesPendingItem,
  normalizeEbEvaluateResponse,
  normalizeMemberCommentsMap,
  normalizeMemberScoreMap,
  validateEbScore,
  validateMemberScoresPayload,
} from "@/utils/ebEvaluationMappers.js";
import {
  addCouncilMember,
  buildCouncilAggregate,
  isEbChapterFullyScored,
  readCouncilRoster,
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

function isSeriesPendingShape(item) {
  if (!item || typeof item !== "object") return false;
  if (item.first_pending_chapter != null) return true;
  return Boolean(
    item.name
    && item.author_id != null
    && item.chapter_number == null
    && !item.chapter_id,
  );
}

function mapEbPendingListItem(item) {
  if (isSeriesPendingShape(item)) return mapEbSeriesPendingItem(item);
  return mapEbChapterPendingItem(item);
}

function seriesItemToQueueChapter(seriesItem) {
  const fc = seriesItem?.firstChapter;
  if (!fc?.id) return null;
  return {
    id: fc.id,
    seriesId: seriesItem.seriesId ?? seriesItem.id,
    seriesName: seriesItem.seriesName ?? seriesItem.name ?? "Series",
    chapterNumber: fc.chapterNumber,
    title: fc.title ?? "",
    status: seriesItem.status ?? "pending_EB",
    previewImageUrl: seriesItem.coverUrl ?? seriesItem.previewImageUrl,
    mangakaName: seriesItem.mangakaName ?? "",
    classification: seriesItem.classification ?? null,
    classificationText: seriesItem.classificationText ?? "",
    councilAverage: seriesItem.councilAverage ?? null,
    pages: [],
    raw: seriesItem.raw,
  };
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
          {memberRows.length === 0 ? (
            <tr>
              <td
                colSpan={scoreFields.length + 2}
                className="px-3 py-10 text-center text-sm text-muted-foreground"
              >
                Chưa có thành viên Hội đồng — thêm tên ở trên để bắt đầu chấm điểm.
              </td>
            </tr>
          ) : (
            memberRows.map((row) => {
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
          })
          )}
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
  const [pendingSeries, setPendingSeries] = useState([]);
  const [chapterPages, setChapterPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [apiLoading, setApiLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [activeMemberId, setActiveMemberId] = useState("");
  const [newCouncilMemberName, setNewCouncilMemberName] = useState("");
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
        .map(mapEbPendingListItem)
        .filter(Boolean);
      const seriesList = list.filter((item) => item.firstChapter != null);
      const chapterList = list.flatMap((item) => {
        if (item.firstChapter) {
          const mapped = seriesItemToQueueChapter(item);
          return mapped ? [mapped] : [];
        }
        if (item.id && item.chapterNumber != null) return [item];
        return [];
      });
      setPendingSeries(seriesList);
      setPendingChapters(chapterList);
    } catch (err) {
      if (!silent) {
        toast.error(getApiErrorMessage(err, "Không tải được hàng chờ EB."));
        setPendingChapters([]);
        setPendingSeries([]);
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
    if (!routeChapterId) return;
    void loadChapterDetail(routeChapterId);
  }, [routeChapterId, loadChapterDetail]);

  useEffect(() => {
    if (!routeChapterId) {
      setChapterPages([]);
      return;
    }
    let cancelled = false;
    setPagesLoading(true);
    void (async () => {
      try {
        const data = await ebScoresService.getChapterPreview(routeChapterId);
        if (cancelled) return;
        const mapped = mapEbChapterPreviewResponse(data);
        setChapterPages(mapped?.pages ?? []);
      } catch {
        if (!cancelled) setChapterPages([]);
      } finally {
        if (!cancelled) setPagesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeChapterId]);

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

  const councilRoster = useMemo(
    () => (councilKey ? readCouncilRoster(councilKey) : []),
    [councilKey, councilTick],
  );

  useEffect(() => {
    if (!councilKey) {
      setActiveMemberId("");
      return;
    }
    const roster = readCouncilRoster(councilKey);
    setActiveMemberId((prev) => {
      if (prev && roster.some((m) => m.id === prev)) return prev;
      return roster[0]?.id ?? "";
    });
  }, [councilKey, councilTick]);

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
    return buildCouncilAggregate(councilRecord, keys, councilRoster);
  }, [councilRecord, scoreFields, councilRoster]);
  const councilClassification = getClassification(councilAggregate.councilAverage);
  const activeMember = councilRoster.find((m) => m.id === activeMemberId) ?? null;

  function handleAddCouncilMember() {
    const name = newCouncilMemberName.trim();
    if (!name) {
      toast.error("Nhập tên thành viên Hội đồng.");
      return;
    }
    if (!councilKey) {
      toast.error("Chưa có chapter để thêm thành viên.");
      return;
    }
    const added = addCouncilMember(councilKey, name);
    if (!added) {
      toast.error("Thành viên này đã có trong Hội đồng.");
      return;
    }
    setNewCouncilMemberName("");
    setActiveMemberId(added.id);
    refresh();
    toast.success(`Đã thêm ${added.name} vào Hội đồng chấm.`);
  }

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

  function openSeriesReview(seriesId) {
    if (!seriesId) return;
    navigate(`/eb/series/${encodeURIComponent(seriesId)}`);
  }

  function buildMemberScoresDraft() {
    return buildMemberScoresPayload({
      councilRecord,
      members: councilRoster,
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

    if (!councilRoster.length) {
      toast.error("Thêm ít nhất một thành viên Hội đồng trước khi gửi đánh giá.");
      return;
    }

    const memberScores = buildMemberScoresDraft();
    const payloadError = validateMemberScoresPayload(memberScores, councilRoster.length);
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

  async function handleSaveAssessment() {
    if (!activeChapter?.id) {
      toast.error("Chưa có chapter trong hàng chờ để chấm điểm.");
      return;
    }
    if (!activeMemberId) {
      toast.error("Thêm và chọn thành viên Hội đồng trước khi lưu điểm.");
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
    const aggregate = buildCouncilAggregate(updatedRecord, keys, councilRoster);
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
      councilMemberCount: councilRoster.length,
      summaryNotes,
      source: "eb-council",
      assessedAt: new Date().toISOString(),
      enteredBy: user?.name ?? "Đại diện EB",
    });

    refresh();
    toast.success(
      `Đã lưu điểm ${activeMember?.name ?? "thành viên"} · DTB HĐ ${aggregate.councilAverage.toFixed(1)} (${aggregate.scoredCount}/${councilRoster.length || 0})`,
    );
  }

  return (
    <div className="ws-page--eb flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      {!isChapterDetail ? (
        <WorkspaceHero
          label={LABEL_EDITOR_BOARD}
          title={`Xin chào${user?.name ? `, ${user.name}` : ""}`}
          description="Chọn series trong hàng chờ để xem nội dung và chấm điểm."
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

              <div className="space-y-3">
                <Label htmlFor="eb-council-member-name">Thêm thành viên Hội đồng</Label>
                <div className="flex gap-2">
                  <Input
                    id="eb-council-member-name"
                    value={newCouncilMemberName}
                    onChange={(event) => setNewCouncilMemberName(event.target.value)}
                    placeholder="Nhập tên thành viên..."
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddCouncilMember();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={handleAddCouncilMember}
                  >
                    <Plus className="size-4" />
                    Thêm
                  </Button>
                </div>
                {councilRoster.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {councilRoster.map((member) => {
                      const scored = councilAggregate.memberRows.find(
                        (row) => row.id === member.id,
                      )?.scored;
                      return (
                        <Button
                          key={member.id}
                          type="button"
                          size="sm"
                          variant={activeMemberId === member.id ? "default" : "outline"}
                          onClick={() => setActiveMemberId(member.id)}
                        >
                          {member.name}
                          {scored ? " · đã chấm" : ""}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Chưa có thành viên — nhập tên và bấm Thêm để bắt đầu chấm điểm.
                  </p>
                )}
                {activeMember ? (
                  <p className="text-xs text-muted-foreground">
                    Đang nhập điểm cho{" "}
                    <strong className="text-foreground">{activeMember.name}</strong>
                    {" "}— DTB cá nhân tạm tính:{" "}
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
                  {councilAggregate.scoredCount}/{councilRoster.length || 0} thành
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

                {activeChapter?.id ? (
                  <Button className="mt-4 w-full" variant="outline" asChild>
                    <Link
                      to={`/eb/chapter/${encodeURIComponent(activeChapter.id)}/publish`}
                    >
                      <Calendar className="size-4" />
                      Sang trang xác nhận publish
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Preview chapter</CardTitle>
              <CardDescription>
                Tất cả pages từ{" "}
                <code className="text-[10px]">
                  GET /eb-scores/chapter/:id/preview
                </code>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">pending_EB</Badge>
                {activeChapter?.classification ? (
                  <Badge variant="outline">{activeChapter.classification}</Badge>
                ) : null}
                {activeChapter?.chapterNumber != null ? (
                  <Badge variant="outline">Ch. {activeChapter.chapterNumber}</Badge>
                ) : null}
                {chapterPages.length > 0 ? (
                  <Badge variant="outline">{chapterPages.length} trang</Badge>
                ) : null}
              </div>
              <p className="text-sm font-medium text-foreground">
                {activeChapter
                  ? `${activeChapter.seriesName}${activeChapter.title ? ` — ${activeChapter.title}` : ""}`
                  : "Chưa có chapter trong hàng chờ"}
              </p>
              {pagesLoading && chapterPages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Đang tải pages...</p>
              ) : chapterPages.length > 0 ? (
                <div className="eb-chapter-pages-scroll">
                  {chapterPages.map((page) => (
                    <figure key={page.id ?? page.pageNumber} className="eb-page-item">
                      <img
                        src={page.imageUrl}
                        alt={`Trang ${page.pageNumber}`}
                        loading="lazy"
                        className="eb-page-item__img"
                      />
                      <figcaption className="eb-page-item__caption">
                        Trang {page.pageNumber}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border bg-muted/30">
                  <img
                    src={activeSeriesImage}
                    alt={
                      activeChapter
                        ? `${activeChapter.seriesName} Ch.${activeChapter.chapterNumber}`
                        : "Ảnh chapter đang chấm"
                    }
                    className="h-[320px] w-full object-cover"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {activeChapter?.classificationText ||
                  activeChapter?.mangakaName ||
                  "Xem đủ pages trước khi chấm điểm."}
              </p>
              {activeChapter?.seriesId ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/eb/series/${encodeURIComponent(activeChapter.seriesId)}`}>
                    Xem toàn bộ series & chapters
                  </Link>
                </Button>
              ) : null}
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
          ) : pendingSeries.length === 0 && queueChapters.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Không có series nào đang chờ EB duyệt.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(pendingSeries.length ? pendingSeries : queueChapters.map((ch) => ({
                id: ch.seriesId ?? ch.id,
                seriesId: ch.seriesId ?? ch.id,
                name: ch.seriesName,
                seriesName: ch.seriesName,
                coverUrl: ch.previewImageUrl,
                status: ch.status,
                mangakaName: ch.mangakaName,
                classification: ch.classification,
                classificationText: ch.classificationText,
                firstChapter: {
                  id: ch.id,
                  chapterNumber: ch.chapterNumber,
                  title: ch.title,
                },
              }))).map((series) => (
                <Card
                  key={series.id ?? series.seriesId}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-4">
                      {series.coverUrl ? (
                        <img
                          src={series.coverUrl}
                          alt=""
                          className="size-16 shrink-0 rounded-lg border object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{series.name ?? series.seriesName}</h3>
                          <Badge variant="secondary">{series.status ?? "pending_EB"}</Badge>
                          {series.classification ? (
                            <Badge variant="outline">{series.classification}</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {[
                            series.firstChapter
                              ? `Ch.${series.firstChapter.chapterNumber}${series.firstChapter.title ? ` — ${series.firstChapter.title}` : ""}`
                              : null,
                            series.mangakaName,
                            series.classificationText,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {series.synopsis ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {series.synopsis}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => openSeriesReview(series.seriesId ?? series.id)}
                      >
                        <BookOpen className="size-4" />
                        Xem pages
                      </Button>
                      {series.firstChapter?.id ? (
                        <Button onClick={() => openChapterEvaluate(series.firstChapter.id)}>
                          <CheckCircle2 className="size-4" />
                          Chấm điểm
                        </Button>
                      ) : null}
                    </div>
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
