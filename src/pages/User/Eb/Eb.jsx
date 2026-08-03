import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gavel,
  History,
  Maximize2,
  Plus,
  Star,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSession, logout } from "@/lib/auth.js";
import { cn } from "@/lib/utils";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { ebScoresService } from "@/api/ebScores.service.js";
import { mangakaProfileService } from "@/api/mangakaProfile.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { updateSeriesEbAssessmentInWorkspace } from "@/utils/mangakaWorkspaceReader.js";
import { placeholderPageDataUrl } from "@/utils/placeholderPageDataUrl.js";
import { EB_NAV_LINKS } from "@/constants/ebNav.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_SCORE_CRITERIA,
  EB_SCORE_MAX,
  EB_COUNCIL_MIN_FOR_PUBLISH,
  EB_COUNCIL_MAX_FOR_EVALUATE,
  EB_EVALUATION_RESULTS,
  EB_PUBLICATION_SCHEDULES,
  buildEmptyEbComments,
  buildEmptyEbScores,
  buildMemberScoresPayload,
  clampEbScore,
  formatEbClassification,
  getEbAgeSafetyFailFromError,
  getEbClassificationStyle,
  getEbDebutGateLockFromError,
  isEbFirstReviewSeriesStatus,
  mapEbChapterDetailResponse,
  mapEbChapterPendingItem,
  mapEbChapterPreviewResponse,
  mapEbPreviewCouncilAverageResponse,
  mapEbSeriesPendingItem,
  normalizeEbEvaluateResponse,
  normalizeMemberCommentsMap,
  normalizeMemberScoreMap,
  validateEbScore,
  validateMemberScoresPayload,
} from "@/utils/ebEvaluationMappers.js";
import {
  EB_CONTENT_LEVEL_FIELDS,
  EB_CONTENT_LEVEL_LABELS,
  EB_CONTENT_LEVEL_MAX,
  buildEmptyContentLevels,
  buildEmptyExtensionScores,
  computeWeightedAverage,
  defaultRubricFromCore,
  mapAgeSafetyResponse,
  mapEbRubricList,
  mapExtensionScoresToApi,
  mapSuggestedRubricResponse,
  normalizeContentLevels,
  normalizeExtensionScoreMap,
} from "@/utils/ebScoringRubric.js";
import {
  addCouncilMember,
  buildCouncilAggregate,
  isEbChapterFullyScored,
  readCouncilRoster,
  readCouncilSeriesScores,
  saveCouncilMemberAssessment,
} from "@/utils/ebCouncilStorage.js";
import "./Eb.css";

const NAV_LINKS = EB_NAV_LINKS;

const HERO_IMAGES = [
  "/images/eb1.png",
  "/images/eb2.png",
  "/images/eb3.png",
  "/images/eb4.png",
];
const HERO_SLIDE_MS = 5000;

const SCORE_MAX = EB_SCORE_MAX;
const SCORE_STEP = 0.5;
const DEFAULT_RUBRIC = defaultRubricFromCore();

function clampScore(value) {
  return clampEbScore(value);
}

function validateScore(value) {
  return validateEbScore(value);
}

function buildInitialNotes(scoreKeys) {
  return buildEmptyEbComments(scoreKeys);
}

function buildInitialScores(scoreKeys) {
  return buildEmptyEbScores(scoreKeys);
}

function buildEmptyScoreErrors(scoreKeys = EB_SCORE_CRITERIA.map((c) => c.key)) {
  return Object.fromEntries(scoreKeys.map((key) => [key, ""]));
}

function formatScoreOrEmpty(value, { scored = true } = {}) {
  if (!scored || value == null || Number.isNaN(Number(value))) {
    return { text: "—", muted: true };
  }
  return { text: Number(value).toFixed(1), muted: false };
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
    mangakaUserId: seriesItem.mangakaUserId ?? null,
    mangakaAvatarUrl: seriesItem.mangakaAvatarUrl ?? null,
    classification: seriesItem.classification ?? null,
    classificationText: seriesItem.classificationText ?? "",
    councilAverage: seriesItem.councilAverage ?? null,
    ageRating: seriesItem.ageRating ?? null,
    genre: seriesItem.genre ?? [],
    pages: [],
    raw: seriesItem.raw,
  };
}

function resolveSeriesIdFromRaw(seriesRaw, mapped) {
  return (
    String(mapped?.seriesId ?? "").trim()
    || String(seriesRaw?._id ?? seriesRaw?.id ?? "").trim()
    || ""
  );
}

function ebMangakaGroupKey(item) {
  const authorId = String(item?.mangakaUserId ?? "").trim();
  if (authorId) return `id:${authorId}`;
  const name = String(item?.mangakaName || "Mangaka").trim();
  return `name:${name.toLowerCase() || "mangaka"}`;
}

function ebMangakaGroupName(item) {
  return String(item?.mangakaName || "Mangaka").trim() || "Mangaka";
}

async function hydrateEbMangakaAvatars(items) {
  const list = Array.isArray(items) ? items : [];
  const ids = [
    ...new Set(
      list
        .map((s) => String(s?.mangakaUserId ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (!ids.length) return list;

  const avatarById = new Map();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const profile = await mangakaProfileService.getPublicProfile(id);
        const url = String(profile?.user?.avatarUrl ?? "").trim();
        if (url) avatarById.set(id, url);
      } catch {
        // giữ fallback initials
      }
    }),
  );
  if (!avatarById.size) return list;

  return list.map((s) => {
    const id = String(s?.mangakaUserId ?? "").trim();
    const avatar = id ? avatarById.get(id) : null;
    if (!avatar) return s;
    return { ...s, mangakaAvatarUrl: avatar };
  });
}

function EbMangakaSelectCard({ group, onSelect }) {
  const initials = (
    group.name.length >= 2 ? group.name : `${group.name}●`
  )
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(group.key)}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t-2xl bg-gradient-to-br from-sky-500/15 via-muted to-violet-500/10">
        {group.coverUrl ? (
          <img
            src={group.coverUrl}
            alt=""
            className="aspect-[3/4] size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-sky-600 text-2xl font-bold text-white shadow-lg shadow-sky-900/20">
              {initials}
            </div>
          </div>
        )}
        <span className="absolute top-3 right-3 rounded-full bg-amber-500/90 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm backdrop-blur-md">
          {group.count}
        </span>
      </div>
      <div className="rounded-b-2xl border-t border-gray-100 bg-white p-3.5">
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-gray-900">
          <span className="group/avatar inline-flex shrink-0">
            <Avatar
              size="sm"
              className={cn(
                "size-6 ring-1 ring-border",
                "transition-all duration-200 ease-out",
                "group-hover/avatar:scale-110 group-hover/avatar:ring-2 group-hover/avatar:ring-sky-400",
                "group-hover/avatar:shadow-sm group-hover/avatar:shadow-sky-500/30",
              )}
            >
              {group.avatarUrl ? (
                <AvatarImage
                  src={group.avatarUrl}
                  alt=""
                  className="transition-transform duration-300 group-hover/avatar:scale-110"
                />
              ) : null}
              <AvatarFallback className="bg-sky-600 text-[10px] font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
          </span>
          <span className="truncate">{group.name}</span>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {group.count} series chờ duyệt
        </p>
      </div>
    </button>
  );
}

function ScoreStars({ value, size = "size-4" }) {
  const safe = clampScore(value);
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: SCORE_MAX }, (_, idx) => {
        const score = idx + 1;
        const isFull = safe >= score;
        const isHalf = !isFull && safe >= score - 0.5;
        return (
          <span key={score} className={cn("relative inline-flex", size)}>
            <Star className={cn(size, "text-muted-foreground/35")} />
            {isFull ? (
              <Star
                className={cn(
                  "absolute inset-0 fill-amber-400 text-amber-400",
                  size,
                )}
              />
            ) : null}
            {isHalf ? (
              <span className="absolute inset-0 w-1/2 overflow-hidden">
                <Star className={cn("fill-amber-400 text-amber-400", size)} />
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function InteractiveScoreStars({ value, onChange, disabled = false }) {
  const safe = clampScore(value);
  return (
    <div
      className="flex items-center gap-0.5"
      role="radiogroup"
      aria-label="Chấm sao"
    >
      {Array.from({ length: SCORE_MAX }, (_, idx) => {
        const full = idx + 1;
        const half = idx + 0.5;
        const isFull = safe >= full;
        const isHalf = !isFull && safe >= half;
        return (
          <span key={full} className="relative inline-flex size-7 shrink-0">
            <Star className="size-7 text-muted-foreground/30" />
            {isFull ? (
              <Star className="pointer-events-none absolute inset-0 size-7 fill-amber-400 text-amber-400" />
            ) : null}
            {isHalf ? (
              <span className="pointer-events-none absolute inset-0 w-1/2 overflow-hidden">
                <Star className="size-7 fill-amber-400 text-amber-400" />
              </span>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              aria-label={`${half} điểm`}
              className="absolute inset-y-0 left-0 z-10 w-1/2 rounded-l-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
              onClick={() => onChange(half.toFixed(1))}
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={`${full} điểm`}
              className="absolute inset-y-0 right-0 z-10 w-1/2 rounded-r-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
              onClick={() => onChange(full.toFixed(1))}
            />
          </span>
        );
      })}
    </div>
  );
}

function CriterionScoreRow({
  field,
  value,
  error,
  note,
  onScoreChange,
  onScoreBlur,
  onNoteChange,
  disabled = false,
}) {
  const numeric = clampScore(value);
  const display = String(value ?? "").trim() === "" ? "" : numeric.toFixed(1);

  return (
    <div className="mb-3 space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 sm:w-40 sm:shrink-0">
          <Label
            htmlFor={field.key}
            className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-900"
          >
            {field.label}
            {field.weightPct != null ? (
              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-600">
                {field.weightPct}%
              </span>
            ) : null}
          </Label>
          <p className="text-xs text-gray-500">{field.hint}</p>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <InteractiveScoreStars
            value={value}
            disabled={disabled}
            onChange={(next) => onScoreChange(next)}
          />
          <input
            type="range"
            min={0}
            max={SCORE_MAX}
            step={SCORE_STEP}
            value={numeric}
            disabled={disabled}
            aria-label={`Slider ${field.label}`}
            className="eb-score-slider h-1.5 min-w-[7rem] flex-1 cursor-pointer rounded-lg bg-gray-200 accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) =>
              onScoreChange(clampScore(event.target.value).toFixed(1))
            }
          />
          <Input
            id={field.key}
            type="number"
            min="0"
            max={String(SCORE_MAX)}
            step={String(SCORE_STEP)}
            value={display}
            disabled={disabled}
            className="h-9 w-16 shrink-0 rounded-xl border border-gray-200 bg-gray-50 py-1 text-center font-bold tabular-nums text-gray-900 shadow-none"
            onChange={(event) => onScoreChange(event.target.value)}
            onBlur={onScoreBlur}
            aria-invalid={Boolean(error)}
          />
          <span className="shrink-0 text-xs text-gray-500">
            / {SCORE_MAX}
          </span>
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Textarea
        id={`${field.key}-note`}
        value={note}
        disabled={disabled}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Ghi chú tiêu chí (tuỳ chọn)..."
        className="min-h-16 border-gray-100 text-sm"
      />
    </div>
  );
}

function getClassification(average, { scored = true, classification = null } = {}) {
  return getEbClassificationStyle(classification, { scored, average });
}

function CouncilScoresTable({
  memberRows,
  scoreFields,
  criterionAverages,
  councilAverage,
  scoredCount,
  activeMemberId,
}) {
  const hasScored = scoredCount > 0;
  const councilAvgDisplay = formatScoreOrEmpty(councilAverage, {
    scored: hasScored,
  });

  return (
    <div className="eb-council-table-wrap scrollbar-hide overflow-x-auto rounded-xl border bg-card">
      <table className="eb-council-table w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">Thành viên HĐ</th>
            {scoreFields.map((field) => (
              <th key={field.key} className="px-2 py-2.5 font-medium">
                {field.shortLabel || field.hint || field.label}
              </th>
            ))}
            <th className="px-3 py-2.5 font-medium">ĐTB</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {memberRows.length === 0 ? (
            <tr>
              <td
                colSpan={scoreFields.length + 2}
                className="px-3 py-10 text-center text-sm text-muted-foreground"
              >
                Chưa có thành viên Hội đồng.
              </td>
            </tr>
          ) : (
            memberRows.map((row) => {
              const isActive = row.id === activeMemberId;
              return (
                <tr
                  key={row.id}
                  className={isActive ? "bg-sky-500/5" : undefined}
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
                        <span className="text-muted-foreground/70">N/A</span>
                      )}
                    </td>
                  ))}
                  <td
                    className={cn(
                      "px-3 py-2.5 text-center font-semibold tabular-nums",
                      !row.scored && "text-muted-foreground/70",
                    )}
                  >
                    {row.scored ? row.average.toFixed(1) : "N/A"}
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
            {scoreFields.map((field) => {
              const cell = formatScoreOrEmpty(criterionAverages?.[field.key], {
                scored: hasScored,
              });
              return (
                <td
                  key={field.key}
                  className={cn(
                    "px-2 py-3 text-center tabular-nums",
                    cell.muted
                      ? "text-muted-foreground/70"
                      : "text-foreground",
                  )}
                >
                  {cell.text}
                </td>
              );
            })}
            <td
              className={cn(
                "px-3 py-3 text-center text-base font-bold tabular-nums",
                councilAvgDisplay.muted
                  ? "text-muted-foreground/70"
                  : "text-primary",
              )}
            >
              {councilAvgDisplay.text}
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
  const [scores, setScores] = useState(() => buildInitialScores(DEFAULT_RUBRIC.coreKeys));
  const [criterionNotes, setCriterionNotes] = useState(() =>
    buildInitialNotes(DEFAULT_RUBRIC.coreKeys),
  );
  const [extensionScores, setExtensionScores] = useState(() =>
    buildEmptyExtensionScores(DEFAULT_RUBRIC.extensionKeys),
  );
  const [overallComment, setOverallComment] = useState("");
  const [memberNotes, setMemberNotes] = useState("");
  const [evaluationNotes, setEvaluationNotes] = useState("");
  const [lastEvaluation, setLastEvaluation] = useState(null);
  /** true chỉ sau Nộp kết quả chấm thành công (hoặc BE đã có evaluation history). */
  const [scoresSubmitted, setScoresSubmitted] = useState(false);
  const [scoreErrors, setScoreErrors] = useState(() =>
    buildEmptyScoreErrors(DEFAULT_RUBRIC.coreKeys),
  );
  const [pinnedChapter, setPinnedChapter] = useState(null);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);
  const [selectedMangakaKey, setSelectedMangakaKey] = useState(null);
  const [rubrics, setRubrics] = useState([DEFAULT_RUBRIC]);
  const [selectedRubricId, setSelectedRubricId] = useState(DEFAULT_RUBRIC.id);
  const [suggestedRubricId, setSuggestedRubricId] = useState("");
  /** null = dùng gợi ý BE (không gửi rubric_id); string = EB override từ alternatives */
  const [rubricOverrideId, setRubricOverrideId] = useState(null);
  const [rubricSuggestMeta, setRubricSuggestMeta] = useState({
    reason: "",
    isFallback: false,
    seriesInfo: null,
    alternatives: [],
  });
  const [contentLevels, setContentLevels] = useState(buildEmptyContentLevels);
  const [ageSafety, setAgeSafety] = useState(null);
  const [ageSafetyChecking, setAgeSafetyChecking] = useState(false);
  const [previewCouncilAvg, setPreviewCouncilAvg] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewClassification, setPreviewClassification] = useState(null);
  const [seriesContext, setSeriesContext] = useState(null);
  const [evaluationResult, setEvaluationResult] = useState("approved");
  const [publicationSchedule, setPublicationSchedule] = useState("weekly");
  const [quickNotes, setQuickNotes] = useState("");
  const [debutGateLock, setDebutGateLock] = useState(null);
  const refresh = useCallback(() => bumpCouncil((n) => n + 1), []);

  useEffect(() => {
    if (HERO_IMAGES.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setHeroSlide((index) => (index + 1) % HERO_IMAGES.length);
    }, HERO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, []);

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
      const seriesWithAvatars = await hydrateEbMangakaAvatars(seriesList);
      const chaptersWithAvatars = await hydrateEbMangakaAvatars(chapterList);
      setPendingSeries(seriesWithAvatars);
      setPendingChapters(chaptersWithAvatars);
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

  const queueItems = useMemo(() => {
    if (pendingSeries.length) return pendingSeries;
    return queueChapters.map((ch) => ({
      id: ch.seriesId ?? ch.id,
      seriesId: ch.seriesId ?? ch.id,
      name: ch.seriesName,
      seriesName: ch.seriesName,
      coverUrl: ch.previewImageUrl,
      status: ch.status,
      mangakaName: ch.mangakaName,
      mangakaUserId: ch.mangakaUserId ?? null,
      mangakaAvatarUrl: ch.mangakaAvatarUrl ?? null,
      classification: ch.classification,
      classificationText: ch.classificationText,
      firstChapter: {
        id: ch.id,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
      },
    }));
  }, [pendingSeries, queueChapters]);

  const queueByMangaka = useMemo(() => {
    const map = new Map();
    for (const item of queueItems) {
      const key = ebMangakaGroupKey(item);
      const name = ebMangakaGroupName(item);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          coverUrl: null,
          avatarUrl: null,
          items: [],
        });
      }
      const group = map.get(key);
      group.items.push(item);
      if (!group.avatarUrl) {
        group.avatarUrl = item.mangakaAvatarUrl || null;
      }
      if (!group.coverUrl) {
        group.coverUrl = item.coverUrl || item.previewImageUrl || null;
      }
    }
    return [...map.values()]
      .map((g) => ({ ...g, count: g.items.length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
  }, [queueItems]);

  const selectedMangakaGroup = useMemo(
    () => queueByMangaka.find((g) => g.key === selectedMangakaKey) ?? null,
    [queueByMangaka, selectedMangakaKey],
  );

  useEffect(() => {
    if (!selectedMangakaKey) return;
    if (!queueByMangaka.some((g) => g.key === selectedMangakaKey)) {
      setSelectedMangakaKey(null);
    }
  }, [queueByMangaka, selectedMangakaKey]);

  useEffect(() => {
    if (isChapterDetail) setSelectedMangakaKey(null);
  }, [isChapterDetail]);

  const loadChapterDetail = useCallback(async (chapterId) => {
    if (!chapterId) return null
    try {
      const data = await ebEvaluationsService.getChapterDetail(chapterId)
      const mapped = mapEbChapterDetailResponse(data)
      if (mapped) {
        setPinnedChapter(mapped)
        const seriesRaw = mapped.seriesDetail ?? data?.series ?? {}
        const latestEval = mapped.evaluationHistory?.at(-1)
        setSeriesContext({
          seriesId: mapped.seriesId ?? resolveSeriesIdFromRaw(seriesRaw, mapped),
          status: seriesRaw.status ?? mapped.status ?? null,
          ageRating:
            seriesRaw.age_rating
            ?? seriesRaw.ageRating
            ?? seriesRaw.content_rating
            ?? null,
          genre: Array.isArray(seriesRaw.genre) ? seriesRaw.genre : [],
          name: seriesRaw.name ?? mapped.seriesName ?? '',
          publicationSchedule: seriesRaw.publication_schedule ?? null,
          firstReview: latestEval
            ? Boolean(latestEval.first_review ?? latestEval.firstReview)
            : isEbFirstReviewSeriesStatus(seriesRaw.status),
        })
        setDebutGateLock(null)
        const normalized = normalizeEbEvaluateResponse({
          evaluation: latestEval,
          council_average: mapped.councilAverage,
          classification: mapped.classification,
          classification_text: mapped.classificationText,
        })
        if (seriesRaw.publication_schedule) {
          setPublicationSchedule(seriesRaw.publication_schedule)
        }
        if (latestEval?.content_levels) {
          setContentLevels(normalizeContentLevels(latestEval.content_levels))
        }
        if (latestEval?.applied_rubric_id) {
          setSelectedRubricId(String(latestEval.applied_rubric_id))
        }
        // Chỉ coi là đã nộp khi BE có bản evaluation — không unlock bằng councilAverage lẻ
        if (latestEval && normalized.councilAverage != null) {
          setLastEvaluation({
            ...(normalized.evaluation ?? {}),
            council_average: normalized.councilAverage,
            classification: normalized.classification,
            classification_text: normalized.classificationText,
            age_safety: normalized.ageSafety,
          })
          setScoresSubmitted(true)
          if (normalized.ageSafety) setAgeSafety(normalized.ageSafety)
        } else {
          setLastEvaluation(null)
          setScoresSubmitted(false)
        }
        return mapped
      }
    } catch {
      // fallback: dùng item từ pending list
    }
    return null
  }, []);

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const body = await ebEvaluationsService.getRubrics()
        if (cancelled) return
        const list = mapEbRubricList(body)
        if (list.length) {
          setRubrics(list)
          setSelectedRubricId((prev) =>
            list.some((r) => r.id === prev) ? prev : list[0].id,
          )
        }
      } catch {
        // giữ default rubric khi BE chưa sẵn sàng
      }
    })()
    return () => {
      cancelled = true
    }
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
        setPreviewPageIndex(0);
      } catch {
        if (!cancelled) {
          setChapterPages([]);
          setPreviewPageIndex(0);
        }
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
  const activeSeriesId = String(
    seriesContext?.seriesId
    ?? activeChapter?.seriesId
    ?? "",
  ).trim();

  const selectedRubric = useMemo(() => {
    return rubrics.find((r) => r.id === selectedRubricId) ?? rubrics[0] ?? DEFAULT_RUBRIC;
  }, [rubrics, selectedRubricId]);

  const scoreFields = useMemo(
    () => selectedRubric?.scoreFields ?? DEFAULT_RUBRIC.scoreFields,
    [selectedRubric],
  );
  const coreScoreKeys = useMemo(
    () => selectedRubric?.coreKeys ?? DEFAULT_RUBRIC.coreKeys,
    [selectedRubric],
  );
  const extensionKeys = useMemo(
    () => selectedRubric?.extensionKeys ?? [],
    [selectedRubric],
  );
  const hasExtension = Boolean(selectedRubric?.hasExtension && extensionKeys.length);

  useEffect(() => {
    if (!activeSeriesId) return;
    let cancelled = false;
    void (async () => {
      try {
        const body = await ebEvaluationsService.suggestRubric(activeSeriesId);
        if (cancelled) return;
        const suggested = mapSuggestedRubricResponse(body);
        if (!suggested.rubric) return;
        setSuggestedRubricId(suggested.rubric.id);
        setRubricOverrideId(null);
        setRubricSuggestMeta({
          reason: suggested.reason,
          isFallback: suggested.isFallback,
          seriesInfo: suggested.seriesInfo,
          alternatives: suggested.alternatives ?? [],
        });
        setRubrics(() => {
          const byId = new Map();
          byId.set(suggested.rubric.id, suggested.rubric);
          for (const alt of suggested.alternatives ?? []) {
            byId.set(alt.id, alt);
          }
          return [...byId.values()];
        });
        setSelectedRubricId(suggested.rubric.id);
        if (suggested.seriesInfo) {
          setSeriesContext((prev) => ({
            ...(prev ?? {}),
            seriesId: prev?.seriesId || activeSeriesId,
            ageRating: suggested.seriesInfo.ageRating ?? prev?.ageRating ?? null,
            genre: suggested.seriesInfo.genre?.length
              ? suggested.seriesInfo.genre
              : (prev?.genre ?? []),
            name: suggested.seriesInfo.name || prev?.name || "",
          }));
        }
      } catch {
        // giữ default khi suggest lỗi
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSeriesId]);

  useEffect(() => {
    setScores(buildInitialScores(coreScoreKeys));
    setCriterionNotes(buildInitialNotes(coreScoreKeys));
    setExtensionScores(buildEmptyExtensionScores(extensionKeys));
    setScoreErrors(buildEmptyScoreErrors([...coreScoreKeys, ...extensionKeys]));
    setAgeSafety(null);
    setPreviewCouncilAvg(null);
  }, [selectedRubricId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setScoresSubmitted(false);
      setLastEvaluation(null);
      return;
    }
    setScoresSubmitted(false);
    setLastEvaluation(null);
  }, [councilKey]);

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
      const normalizedScores = normalizeMemberScoreMap(
        memberEntry.scores,
        coreScoreKeys,
      );
      setScores((current) => ({
        ...buildInitialScores(coreScoreKeys),
        ...current,
        ...Object.fromEntries(
          Object.entries(normalizedScores).map(([key, value]) => [
            key,
            Number(value).toFixed(1),
          ]),
        ),
      }));
      setCriterionNotes((current) => ({
        ...buildInitialNotes(coreScoreKeys),
        ...current,
        ...normalizeMemberCommentsMap(memberEntry.criterionNotes, coreScoreKeys),
      }));
      setExtensionScores((current) => ({
        ...buildEmptyExtensionScores(extensionKeys),
        ...current,
        ...Object.fromEntries(
          Object.entries(
            normalizeExtensionScoreMap(
              memberEntry.extensionScores ?? {},
              extensionKeys,
            ),
          ).map(([key, value]) => [key, Number(value).toFixed(1)]),
        ),
      }));
      setOverallComment(memberEntry.overallComment ?? "");
      setMemberNotes(memberEntry.notes ?? "");
      setScoreErrors(buildEmptyScoreErrors([...coreScoreKeys, ...extensionKeys]));
      return;
    }

    setScores(buildInitialScores(coreScoreKeys));
    setCriterionNotes(buildInitialNotes(coreScoreKeys));
    setExtensionScores(buildEmptyExtensionScores(extensionKeys));
    setOverallComment("");
    setMemberNotes("");
    setScoreErrors(buildEmptyScoreErrors([...coreScoreKeys, ...extensionKeys]));
  }, [councilKey, activeMemberId, councilTick, selectedRubricId, coreScoreKeys, extensionKeys]);
  const activeSeriesImage =
    activeChapter?.previewImageUrl ||
    placeholderPageDataUrl(
      activeChapter
        ? `${activeChapter.seriesName} · Ch.${activeChapter.chapterNumber}`
        : "Chưa chọn chapter",
    );
  const average = useMemo(() => {
    const coreTotal = coreScoreKeys.reduce(
      (sum, key) => sum + clampScore(scores[key]),
      0,
    );
    const extTotal = extensionKeys.reduce(
      (sum, key) => sum + clampScore(extensionScores[key]),
      0,
    );
    const count = coreScoreKeys.length + extensionKeys.length;
    return count ? (coreTotal + extTotal) / count : 0;
  }, [coreScoreKeys, extensionKeys, scores, extensionScores]);
  const hasPersonalScores = useMemo(
    () =>
      coreScoreKeys.some((key) => String(scores[key] ?? "").trim() !== "")
      || extensionKeys.some(
        (key) => String(extensionScores[key] ?? "").trim() !== "",
      ),
    [coreScoreKeys, extensionKeys, scores, extensionScores],
  );
  const personalAvgDisplay = formatScoreOrEmpty(average, {
    scored: hasPersonalScores,
  });
  const localWeightedPreview = useMemo(() => {
    const combined = { ...scores, ...extensionScores };
    return computeWeightedAverage(combined, selectedRubric?.weights ?? {});
  }, [scores, extensionScores, selectedRubric]);
  const councilAggregate = useMemo(() => {
    const keys = scoreFields.map((field) => field.key);
    return buildCouncilAggregate(councilRecord, keys, councilRoster);
  }, [councilRecord, scoreFields, councilRoster]);
  const isFirstReview = useMemo(() => {
    if (seriesContext?.firstReview === false) return false;
    if (seriesContext?.status) {
      return isEbFirstReviewSeriesStatus(seriesContext.status);
    }
    return true;
  }, [seriesContext]);

  const councilClassification = getClassification(
    previewCouncilAvg ?? councilAggregate.councilAverage,
    {
      scored:
        previewCouncilAvg != null
        || councilAggregate.scoredCount > 0
        || lastEvaluation?.classification != null,
      classification:
        previewClassification
        ?? lastEvaluation?.classification
        ?? activeChapter?.classification
        ?? null,
    },
  );
  const activeMember = councilRoster.find((m) => m.id === activeMemberId) ?? null;
  const savedScoredCount = councilAggregate.scoredCount;
  const rosterCount = councilRoster.length;
  const allMembersDraftSaved =
    rosterCount > 0 && savedScoredCount >= rosterCount;
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
  // Lưu nháp đủ tất cả thành viên → Nộp được; Nộp xong → mới Xác nhận lịch
  const canConfirmPublish = Boolean(
    activeChapter?.id && canSubmitScores && scoresSubmitted,
  );

  // Live preview weighted average từ BE khi đã lưu đủ draft
  useEffect(() => {
    if (!isFirstReview || !canSubmitScores || !selectedRubric?.id) return undefined;
    const timer = window.setTimeout(() => {
      void runPreviewCouncilAverage({ silent: true });
    }, 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ refresh khi draft/rubric đổi
  }, [canSubmitScores, selectedRubricId, councilTick, isFirstReview]);

  // Age safety realtime khi chỉnh content_levels
  useEffect(() => {
    if (!isFirstReview) return undefined;
    const ageRating =
      seriesContext?.ageRating
      ?? activeChapter?.ageRating
      ?? selectedRubric?.ageRating;
    if (!ageRating) return undefined;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const body = await ebEvaluationsService.checkAgeSafety({
            age_rating: ageRating,
            content_levels: contentLevels,
          });
          setAgeSafety(mapAgeSafetyResponse(body));
        } catch {
          /* ignore realtime errors */
        }
      })();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    contentLevels,
    isFirstReview,
    seriesContext?.ageRating,
    activeChapter?.ageRating,
    selectedRubric?.ageRating,
  ]);

  const previewPageCount = chapterPages.length;
  const activePreviewPage =
    previewPageCount > 0
      ? chapterPages[
          Math.min(Math.max(previewPageIndex, 0), previewPageCount - 1)
        ]
      : null;
  const previewImageSrc =
    activePreviewPage?.imageUrl
    || activeSeriesImage;

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

  function updateExtensionScore(key, value) {
    setExtensionScores((current) => ({ ...current, [key]: value }));
    setScoreErrors((current) => ({ ...current, [key]: validateScore(value) }));
  }

  function normalizeScoreField(key) {
    const nextValue = clampScore(scores[key]).toFixed(1);
    setScores((current) => ({ ...current, [key]: nextValue }));
    setScoreErrors((current) => ({ ...current, [key]: validateScore(nextValue) }));
  }

  function normalizeExtensionField(key) {
    const nextValue = clampScore(extensionScores[key]).toFixed(1);
    setExtensionScores((current) => ({ ...current, [key]: nextValue }));
    setScoreErrors((current) => ({ ...current, [key]: validateScore(nextValue) }));
  }

  function updateContentLevel(key, value) {
    const next = Math.min(
      EB_CONTENT_LEVEL_MAX,
      Math.max(0, Number(value) || 0),
    );
    setContentLevels((current) => ({ ...current, [key]: next }));
    setAgeSafety(null);
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
    // Chỉ lấy điểm đã Lưu nháp — không gộp draft chưa lưu
    return buildMemberScoresPayload({
      councilRecord,
      members: councilRoster,
      activeMemberId: null,
      draft: null,
      scoreKeys: coreScoreKeys,
      extensionKeys: hasExtension ? extensionKeys : [],
      mapExtensionScoresToApi,
    });
  }

  async function runAgeSafetyCheck() {
    const ageRating =
      seriesContext?.ageRating
      ?? activeChapter?.ageRating
      ?? selectedRubric?.ageRating
      ?? "";
    setAgeSafetyChecking(true);
    try {
      const body = await ebEvaluationsService.checkAgeSafety({
        age_rating: ageRating,
        content_levels: contentLevels,
      });
      const mapped = mapAgeSafetyResponse(body);
      setAgeSafety(mapped);
      return mapped;
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không kiểm tra được age safety."));
      return null;
    } finally {
      setAgeSafetyChecking(false);
    }
  }

  async function runPreviewCouncilAverage({ silent = false } = {}) {
    const memberScores = buildMemberScoresDraft();
    if (!memberScores.length) {
      if (!silent) toast.error("Cần lưu nháp điểm trước khi xem preview ĐTB.");
      return null;
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
          `Preview ĐTB weighted: ${Number(mapped.weightedCouncilAverage).toFixed(2)}`
          + (mapped.classificationText ? ` · ${mapped.classificationText}` : ""),
        );
      }
      return mapped;
    } catch (err) {
      if (!silent) {
        toast.error(getApiErrorMessage(err, "Không preview được ĐTB."));
      }
      return null;
    } finally {
      if (!silent) setPreviewLoading(false);
    }
  }

  function warnMissingCouncilDrafts() {
    if (rosterCount < EB_COUNCIL_MIN_FOR_PUBLISH) {
      toast.error(
        `Hội đồng cần ít nhất ${EB_COUNCIL_MIN_FOR_PUBLISH} thành viên (hiện ${rosterCount}).`,
      );
      return;
    }
    const remaining = unscoredMemberNames.length
      ? unscoredMemberNames.join(", ")
      : "các thành viên còn lại";
    toast.error(
      `Bạn chưa lưu đủ điểm các thành viên trong hội đồng (${savedScoredCount}/${rosterCount}). Còn thiếu: ${remaining}.`,
    );
  }

  function handleConfirmPublishClick() {
    if (!allMembersDraftSaved || rosterCount < EB_COUNCIL_MIN_FOR_PUBLISH) {
      warnMissingCouncilDrafts();
      return;
    }
    if (!scoresSubmitted) {
      toast.error(
        "Bạn chưa nộp kết quả chấm. Hãy bấm Nộp kết quả chấm trước khi xác nhận lịch phát hành.",
      );
      return;
    }
    if (!activeChapter?.id) return;
    navigate(`/eb/chapter/${encodeURIComponent(activeChapter.id)}/publish`);
  }

  async function handleSubmitScores() {
    if (debutGateLock) {
      toast.error(debutGateLock.message);
      return;
    }

    if (!activeChapter?.id && !activeSeriesId) {
      toast.error("Chưa có series/chapter trong hàng chờ để chấm điểm.");
      return;
    }

    if (!evaluationResult) {
      toast.error("Chọn kết quả đánh giá (approved / revision / rejected).");
      return;
    }

    if (evaluationResult === "approved" && !String(publicationSchedule || "").trim()) {
      toast.error("Khi duyệt (approved) bắt buộc chọn tần suất phát hành.");
      return;
    }

    // Quick decision — series đã chấm trước đó
    if (!isFirstReview) {
      if (!activeSeriesId) {
        toast.error("Thiếu seriesId để gửi quick decision.");
        return;
      }
      setSubmitting(true);
      try {
        const payload = {
          quick_decision: evaluationResult,
          result: evaluationResult,
          ...(quickNotes.trim() ? { quick_notes: quickNotes.trim() } : {}),
          ...(evaluationNotes.trim() ? { notes: evaluationNotes.trim() } : {}),
          ...(evaluationResult === "approved"
            ? { publication_schedule: publicationSchedule }
            : {}),
        };
        const res = await ebEvaluationsService.evaluateSeries(activeSeriesId, payload);
        const normalized = normalizeEbEvaluateResponse(res);
        setLastEvaluation({
          ...(normalized.evaluation ?? {}),
          council_average: normalized.councilAverage,
          classification: normalized.classification,
          classification_text: normalized.classificationText,
        });
        setScoresSubmitted(true);
        toast.success(
          normalized.message
          || `Đã gửi quick decision: ${evaluationResult}.`,
        );
        void loadPending({ silent: true });
        refresh();
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Không gửi được quick decision."));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!councilRoster.length) {
      toast.error("Thêm ít nhất một thành viên Hội đồng trước khi gửi đánh giá.");
      return;
    }

    if (!canSubmitScores) {
      warnMissingCouncilDrafts();
      return;
    }

    if (rosterCount > EB_COUNCIL_MAX_FOR_EVALUATE) {
      toast.error(`Tối đa ${EB_COUNCIL_MAX_FOR_EVALUATE} thành viên Hội đồng mỗi lần chấm.`);
      return;
    }

    const memberScores = buildMemberScoresDraft();
    const payloadError = validateMemberScoresPayload(
      memberScores,
      rosterCount,
      {
        scoreKeys: coreScoreKeys,
        criteria: scoreFields,
        extensionKeys: hasExtension ? extensionKeys : [],
        minCount: EB_COUNCIL_MIN_FOR_PUBLISH,
        maxCount: EB_COUNCIL_MAX_FOR_EVALUATE,
      },
    );
    if (payloadError) {
      toast.error(payloadError);
      return;
    }

    setSubmitting(true);
    try {
      const safety = await runAgeSafetyCheck();
      if (safety && !safety.passed) {
        toast.error(
          safety.violations?.[0]?.message
          || "Age safety không đạt — không thể nộp đánh giá.",
        );
        return;
      }

      const payload = {
        result: evaluationResult,
        member_scores: memberScores,
        content_levels: contentLevels,
        // Chỉ gửi rubric_id khi EB override từ alternatives — mặc định BE tự derive
        ...(rubricOverrideId
          ? { rubric_id: rubricOverrideId }
          : {}),
        ...(evaluationNotes.trim() ? { notes: evaluationNotes.trim() } : {}),
        ...(evaluationResult === "approved"
          ? { publication_schedule: publicationSchedule }
          : {}),
      };

      // First review: ưu tiên series-level; chapter-level khi không có seriesId
      let res;
      try {
        if (activeSeriesId) {
          res = await ebEvaluationsService.evaluateSeries(activeSeriesId, payload);
        } else {
          res = await ebEvaluationsService.evaluateChapter(activeChapter.id, payload);
        }
      } catch (primaryErr) {
        const gate = getEbDebutGateLockFromError(primaryErr);
        if (gate) {
          setDebutGateLock(gate);
          toast.error(gate.message);
          return;
        }
        if (
          activeSeriesId
          && primaryErr?.response?.status === 404
          && activeChapter?.id
        ) {
          res = await ebEvaluationsService.evaluateChapter(
            activeChapter.id,
            payload,
          );
        } else {
          throw primaryErr;
        }
      }

      const normalized = normalizeEbEvaluateResponse(res);
      if (normalized.ageSafety && !normalized.ageSafety.passed) {
        setAgeSafety(normalized.ageSafety);
        toast.error("Age safety không đạt — BE từ chối lưu đánh giá.");
        return;
      }
      if (normalized.ageSafety) setAgeSafety(normalized.ageSafety);
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
        age_safety: normalized.ageSafety,
        result: evaluationResult,
      };
      setLastEvaluation(evaluation);
      setScoresSubmitted(true);
      setPinnedChapter((current) => {
        const base =
          current?.id === activeChapter?.id ? current : activeChapter;
        if (!base) return current;
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
        || `Đã gửi điểm Hội đồng · ${evaluationResult}${classificationLabel ? ` · ${classificationLabel}` : ""}${councilAvg != null ? ` · ĐTB ${Number(councilAvg).toFixed(1)}` : ""}.`,
      );
      if (evaluationResult === "approved") {
        toast.message(
          "Tiếp theo: Confirm-publish để mở debut gate. Series chưa published ngay — job sẽ publish khi tới lịch.",
        );
      }
      void loadPending({ silent: true });
      refresh();
    } catch (err) {
      const gate = getEbDebutGateLockFromError(err);
      if (gate) {
        setDebutGateLock(gate);
        toast.error(gate.message);
        return;
      }
      const apiSafety = getEbAgeSafetyFailFromError(err);
      if (apiSafety) {
        setAgeSafety(mapAgeSafetyResponse({ age_safety: apiSafety }));
        toast.error(
          err?.response?.data?.message
          || "AGE_SAFETY_FAIL — nội dung vượt mức cho phép theo age rating.",
        );
        return;
      }
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

    const nextErrors = Object.fromEntries([
      ...coreScoreKeys.map((key) => [key, validateScore(scores[key])]),
      ...extensionKeys.map((key) => [key, validateScore(extensionScores[key])]),
    ]);
    setScoreErrors((current) => ({ ...current, ...nextErrors }));
    const hasInvalid = Object.values(nextErrors).some(Boolean);
    if (hasInvalid) {
      toast.error("Có tiêu chí chưa hợp lệ. Vui lòng kiểm tra lại điểm.");
      return;
    }

    const criterionDetails = selectedRubric.coreCriteria.map((field) => ({
      key: field.key,
      label: field.label,
      hint: field.hint,
      score: clampScore(scores[field.key]),
      note: criterionNotes[field.key] || "",
    }));
    const extensionDetails = hasExtension
      ? selectedRubric.extensionCriteria.map((field) => ({
          key: field.key,
          label: field.label,
          hint: field.hint,
          score: clampScore(extensionScores[field.key]),
          note: "",
        }))
      : [];
    const summaryNotes = criterionDetails
      .filter((criterion) => criterion.note.trim())
      .map((criterion) => `${criterion.label}: ${criterion.note.trim()}`);

    saveCouncilMemberAssessment(councilKey, activeMemberId, {
      scores: Object.fromEntries(
        criterionDetails.map((criterion) => [criterion.key, criterion.score]),
      ),
      extensionScores: Object.fromEntries(
        extensionDetails.map((criterion) => [criterion.key, criterion.score]),
      ),
      criterionNotes: { ...criterionNotes },
      overallComment,
      notes: memberNotes,
      average: Number(average.toFixed(1)),
      assessedAt: new Date().toISOString(),
      enteredBy: user?.name ?? "Đại diện EB",
      rubricId: selectedRubric.id,
    });

    const updatedRecord = readCouncilSeriesScores(councilKey);
    const keys = scoreFields.map((field) => field.key);
    const aggregate = buildCouncilAggregate(updatedRecord, keys, councilRoster);
    const councilClass = getClassification(aggregate.councilAverage, {
      scored: aggregate.scoredCount > 0,
    });

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
      `Đã lưu nháp ${activeMember?.name ?? "thành viên"} (${aggregate.scoredCount}/${councilRoster.length || 0}). ĐTB chính thức lấy từ BE khi Preview/Nộp.`,
    );
    if (aggregate.scoredCount >= rosterCount && rosterCount >= EB_COUNCIL_MIN_FOR_PUBLISH) {
      void runPreviewCouncilAverage({ silent: true });
    }
  }

  return (
    <div className="ws-page--eb flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      {!isChapterDetail ? (
        <section className="ws-hero--eb eb-hero-slideshow relative overflow-hidden border-b border-white/5 text-white">
          <div className="eb-hero-slides" aria-hidden>
            {HERO_IMAGES.map((src, index) => (
              <img
                key={src}
                src={src}
                alt=""
                className={cn(
                  "eb-hero-slides__img",
                  index === heroSlide && "eb-hero-slides__img--active",
                )}
              />
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-black/75 via-black/40 to-transparent"
            aria-hidden
          />
          <div className="page-container relative z-[2] px-8 pt-10 pb-12">
            <div className="max-w-2xl space-y-3">
              <Badge
                variant="secondary"
                className="bg-white/10 text-white hover:bg-white/15"
              >
                {LABEL_EDITOR_BOARD}
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                {`Xin chào${user?.name ? `, ${user.name}` : ""}`}
              </h1>
              <p className="leading-relaxed text-zinc-200">
                Chọn series trong hàng chờ để xem nội dung và chấm điểm.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <main className={cn("page-container flex-1 space-y-8 py-8", isChapterDetail && "pb-28")}>
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
                <p className="text-xs font-medium uppercase tracking-widest text-sky-600 dark:text-sky-400">
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
        <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_420px]">
          <Card className="border-gray-100 shadow-sm">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle>Nhập điểm (tài khoản đại diện)</CardTitle>
              <CardDescription>
                Chọn thành viên Hội đồng rồi chấm từng tiêu chí bên dưới.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="eb-council-member-name">
                  Thêm thành viên Hội đồng
                </Label>
                <div className="flex overflow-hidden rounded-lg border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
                  <Input
                    id="eb-council-member-name"
                    value={newCouncilMemberName}
                    onChange={(event) => setNewCouncilMemberName(event.target.value)}
                    placeholder="Nhập tên thành viên…"
                    className="h-10 rounded-none border-0 shadow-none focus-visible:ring-0"
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
                    className="h-10 shrink-0 rounded-none border-0 border-l border-border px-4"
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
                          className={cn(
                            activeMemberId === member.id
                              && "bg-sky-600 text-white hover:bg-sky-700",
                          )}
                          onClick={() => setActiveMemberId(member.id)}
                        >
                          {member.name}
                          {scored ? " · đã chấm" : ""}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}
                {activeMember ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200/70 bg-sky-500/5 px-3 py-2.5 dark:border-sky-500/30">
                    <p className="text-sm text-muted-foreground">
                      Đang nhập điểm cho{" "}
                      <strong className="text-foreground">{activeMember.name}</strong>
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Điểm TB cá nhân: </span>
                      <strong
                        className={cn(
                          "tabular-nums",
                          personalAvgDisplay.muted
                            ? "text-muted-foreground/70"
                            : "text-foreground",
                        )}
                      >
                        {personalAvgDisplay.text}
                      </strong>
                      <span className="text-muted-foreground"> / {SCORE_MAX}</span>
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Rubric chấm điểm
                  </h3>
                  {rubricOverrideId ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100">
                      Đã chọn thủ công
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                      Gợi ý tự động
                    </span>
                  )}
                </div>

                <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xs">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Thể loại
                      </p>
                      <p className="mt-0.5 font-medium text-gray-900">
                        {(seriesContext?.genre ?? activeChapter?.genre ?? [])[0]
                          || (selectedRubric?.sourceGenre
                            && !String(selectedRubric.sourceGenre).startsWith("__")
                            ? selectedRubric.sourceGenre
                            : null)
                          || (selectedRubric?.genreFamily
                            && !String(selectedRubric.genreFamily).startsWith("__")
                            ? selectedRubric.genreFamily
                            : null)
                          || "Chưa xác định"}
                        {(seriesContext?.genre ?? []).length > 1
                          ? ` (+${seriesContext.genre.length - 1})`
                          : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Độ tuổi series
                      </p>
                      <p className="mt-0.5 font-medium text-gray-900">
                        {seriesContext?.ageRating
                          ?? selectedRubric?.ageRating
                          ?? "All ages"}
                      </p>
                    </div>
                    {hasExtension ? (
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                          Mở rộng
                        </p>
                        <p className="mt-0.5 font-medium text-gray-900">
                          Có tiêu chí theo thể loại
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {rubricSuggestMeta.isFallback || rubricSuggestMeta.reason ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900">
                      <p className="font-semibold">Cần chọn rubric phù hợp</p>
                      <p className="mt-0.5 leading-relaxed text-amber-800/90">
                        {rubricSuggestMeta.reason
                          || "Không khớp được rubric từ thể loại/độ tuổi — đang dùng mặc định."}
                      </p>
                    </div>
                  ) : null}

                  {rubricSuggestMeta.alternatives?.length > 0 ? (
                    <div className="space-y-1.5 border-t border-gray-100 pt-3">
                      <Label htmlFor="eb-rubric-alt" className="text-xs text-gray-600">
                        Đổi rubric (tuỳ chọn)
                      </Label>
                      <Select
                        value={rubricOverrideId ?? "__auto__"}
                        onValueChange={(value) => {
                          if (value === "__auto__") {
                            setRubricOverrideId(null);
                            if (suggestedRubricId) setSelectedRubricId(suggestedRubricId);
                          } else {
                            setRubricOverrideId(value);
                            setSelectedRubricId(value);
                          }
                          setScoresSubmitted(false);
                        }}
                      >
                        <SelectTrigger
                          id="eb-rubric-alt"
                          className="h-9 rounded-xl border-gray-200 bg-white text-sm shadow-none"
                        >
                          <SelectValue placeholder="Dùng gợi ý hệ thống" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__auto__">
                            Dùng gợi ý hệ thống
                            {suggestedRubricId
                              ? ` · ${
                                rubrics.find((r) => r.id === suggestedRubricId)?.ageRating
                                || ""
                              }`
                              : ""}
                          </SelectItem>
                          {rubricSuggestMeta.alternatives.map((alt) => (
                            <SelectItem key={alt.id} value={alt.id}>
                              {(alt.genreFamily
                                && !String(alt.genreFamily).startsWith("__")
                                ? alt.genreFamily
                                : alt.name)
                                || "Rubric"}
                              {alt.ageRating ? ` · ${alt.ageRating}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Mức nội dung</h4>
                      <p className="text-[11px] text-gray-500">
                        Chọn mức 0–3 cho từng hạng mục (đối chiếu độ tuổi series).
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-gray-200 text-xs shadow-none"
                      disabled={ageSafetyChecking}
                      onClick={() => void runAgeSafetyCheck()}
                    >
                      {ageSafetyChecking ? "Đang kiểm…" : "Kiểm tra an toàn"}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {EB_CONTENT_LEVEL_FIELDS.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <Label htmlFor={`eb-level-${field.key}`}>
                            {field.label}
                          </Label>
                          <span className="tabular-nums text-muted-foreground">
                            {EB_CONTENT_LEVEL_LABELS.find(
                              (l) => l.value === contentLevels[field.key],
                            )?.label
                              ?? contentLevels[field.key]}
                          </span>
                        </div>
                        <input
                          id={`eb-level-${field.key}`}
                          type="range"
                          min={0}
                          max={EB_CONTENT_LEVEL_MAX}
                          step={1}
                          value={contentLevels[field.key] ?? 0}
                          className="eb-score-slider h-1.5 w-full cursor-pointer rounded-lg bg-gray-200 accent-emerald-600"
                          onChange={(event) =>
                            updateContentLevel(field.key, event.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                  {ageSafety ? (
                    <div
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs",
                        ageSafety.passed
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
                      )}
                    >
                      {ageSafety.passed ? (
                        <p>An toàn nội dung: đạt{ageSafety.severity ? ` · ${ageSafety.severity}` : ""}.</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-semibold">
                            An toàn nội dung: không đạt
                            {ageSafety.severity ? ` (${ageSafety.severity})` : ""}
                          </p>
                          {ageSafety.violations?.map((v, index) => (
                            <p key={`${v.field}-${index}`}>
                              {v.message
                                || `${v.field}: mức ${v.level} vượt tối đa ${v.maxAllowed}`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Điểm các thành viên Hội đồng
                </h3>
                <CouncilScoresTable
                  memberRows={councilAggregate.memberRows}
                  scoreFields={scoreFields}
                  criterionAverages={councilAggregate.criterionAverages}
                  councilAverage={councilAggregate.councilAverage}
                  scoredCount={councilAggregate.scoredCount}
                  activeMemberId={activeMemberId}
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Tiêu chí chấm điểm
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Điểm TB:{" "}
                    <strong
                      className={cn(
                        "tabular-nums",
                        personalAvgDisplay.muted
                          ? "text-muted-foreground/70"
                          : "text-foreground",
                      )}
                    >
                      {personalAvgDisplay.text}
                    </strong>
                    {localWeightedPreview != null ? (
                      <>
                        {" "}
                        · Ước tính local ~{localWeightedPreview.toFixed(2)}
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="space-y-2">
                  {(selectedRubric?.coreCriteria ?? []).map((field) => (
                    <CriterionScoreRow
                      key={field.key}
                      field={field}
                      value={scores[field.key]}
                      error={scoreErrors[field.key]}
                      note={criterionNotes[field.key]}
                      disabled={!activeMemberId}
                      onScoreChange={(next) => updateScore(field.key, next)}
                      onScoreBlur={() => normalizeScoreField(field.key)}
                      onNoteChange={(next) =>
                        updateCriterionNote(field.key, next)
                      }
                    />
                  ))}
                </div>
              </div>

              {hasExtension ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Tiêu chí mở rộng
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Rubric này yêu cầu thêm điểm extension theo thể loại.
                  </p>
                  <div className="space-y-2">
                    {selectedRubric.extensionCriteria.map((field) => (
                      <CriterionScoreRow
                        key={field.key}
                        field={field}
                        value={extensionScores[field.key]}
                        error={scoreErrors[field.key]}
                        note=""
                        disabled={!activeMemberId}
                        onScoreChange={(next) =>
                          updateExtensionScore(field.key, next)
                        }
                        onScoreBlur={() => normalizeExtensionField(field.key)}
                        onNoteChange={() => {}}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eb-overall-comment">Nhận xét tổng thể</Label>
                  <Textarea
                    id="eb-overall-comment"
                    value={overallComment}
                    onChange={(event) => setOverallComment(event.target.value)}
                    placeholder="Nhận xét chung của thành viên này…"
                    className="min-h-20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eb-member-notes">Ghi chú thêm</Label>
                  <Textarea
                    id="eb-member-notes"
                    value={memberNotes}
                    onChange={(event) => setMemberNotes(event.target.value)}
                    placeholder="Ghi chú bổ sung (tuỳ chọn)…"
                    className="min-h-20"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
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
                        {previewCouncilAvg != null
                          ? Number(previewCouncilAvg).toFixed(2)
                          : (councilAggregate.scoredCount > 0
                            ? councilAggregate.councilAverage.toFixed(1)
                            : "—")}
                      </span>
                      <span className="mb-1 text-sm font-medium text-gray-400">
                        / {SCORE_MAX}.0
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Đã lưu nháp{" "}
                      <span className="font-medium text-gray-700">
                        {councilAggregate.scoredCount}/{councilRoster.length || 0}
                      </span>
                      {" "}thành viên
                      {activeMember ? (
                        <>
                          {" "}
                          · đang nhập:{" "}
                          <span className="font-medium text-gray-700">
                            {activeMember.name}
                          </span>
                        </>
                      ) : null}
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

                <div className="mt-5 space-y-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {isFirstReview ? "Quyết định đánh giá" : "Quyết định nhanh"}
                  </h4>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="eb-evaluation-result" className="text-xs text-gray-600">
                        Kết quả
                      </Label>
                      <Select
                        value={evaluationResult}
                        onValueChange={setEvaluationResult}
                      >
                        <SelectTrigger
                          id="eb-evaluation-result"
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
                        <Label htmlFor="eb-eval-schedule" className="text-xs text-gray-600">
                          Tần suất phát hành
                        </Label>
                        <Select
                          value={publicationSchedule}
                          onValueChange={setPublicationSchedule}
                        >
                          <SelectTrigger
                            id="eb-eval-schedule"
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
                      <Label htmlFor="eb-quick-notes" className="text-xs text-gray-600">
                        Ghi chú quyết định
                      </Label>
                      <Textarea
                        id="eb-quick-notes"
                        value={quickNotes}
                        onChange={(event) => setQuickNotes(event.target.value)}
                        placeholder="Lý do ngắn gọn…"
                        className="min-h-16 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-none focus-visible:border-emerald-500 focus-visible:ring-1 focus-visible:ring-emerald-500"
                      />
                    </div>
                  ) : null}
                </div>

                {debutGateLock ? (
                  <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                    <p className="font-semibold">Đang khóa debut</p>
                    <p className="mt-1">{debutGateLock.message}</p>
                    {activeSeriesId ? (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2"
                        onClick={() =>
                          navigate(
                            `/eb/chapter/${encodeURIComponent(activeChapter?.id ?? "")}/publish`,
                          )
                        }
                        disabled={!activeChapter?.id}
                      >
                        Tới trang xác nhận lịch
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 space-y-1.5">
                  <Label htmlFor="eb-evaluation-notes" className="text-xs text-gray-600">
                    Ghi chú đánh giá (tuỳ chọn)
                  </Label>
                  <Textarea
                    id="eb-evaluation-notes"
                    value={evaluationNotes}
                    onChange={(event) => setEvaluationNotes(event.target.value)}
                    placeholder="Ghi chú kèm theo khi nộp điểm…"
                    className="min-h-16 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-none focus-visible:border-emerald-500 focus-visible:ring-1 focus-visible:ring-emerald-500"
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

                {activeChapter?.id ? (
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={handleConfirmPublishClick}
                      title={
                        canConfirmPublish
                          ? undefined
                          : "Cần lưu nháp đủ tất cả thành viên và nộp kết quả chấm trước"
                      }
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-black",
                        !canConfirmPublish && "opacity-70",
                      )}
                    >
                      <Calendar className="size-3.5" />
                      Xác nhận lịch phát hành
                      <ArrowRight className="size-3.5" />
                    </button>
                    {!canConfirmPublish ? (
                      <p className="text-[11px] text-gray-400">
                        {!allMembersDraftSaved || rosterCount < EB_COUNCIL_MIN_FOR_PUBLISH
                          ? `Cần lưu nháp đủ hội đồng (${savedScoredCount}/${rosterCount || 0}${
                            unscoredMemberNames.length
                              ? ` · thiếu: ${unscoredMemberNames.join(", ")}`
                              : ""
                          }).`
                          : "Cần nộp kết quả chấm trước khi xác nhận lịch."}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <aside className="sticky top-20 flex max-h-[calc(100vh-120px)] flex-col self-start">
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-gray-100 shadow-sm">
            <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 space-y-0 border-b border-gray-100 pb-3">
              <CardTitle className="text-base">Xem trước chapter</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-gray-200"
                disabled={!previewImageSrc}
                onClick={() => setZoomOpen(true)}
              >
                <Maximize2 className="size-3.5" />
                Phóng to
              </Button>
            </CardHeader>
            <CardContent className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto pt-4">
              <p className="text-sm font-medium text-foreground">
                {activeChapter
                  ? `${activeChapter.seriesName}${activeChapter.title ? ` — ${activeChapter.title}` : ""}`
                  : "Chưa có chapter trong hàng chờ"}
              </p>
              {pagesLoading && chapterPages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Đang tải trang…</p>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    className="group relative block w-full overflow-hidden rounded-2xl border border-gray-100 bg-muted/30 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setZoomOpen(true)}
                    aria-label="Phóng to trang truyện"
                  >
                    <img
                      src={previewImageSrc}
                      alt={
                        activePreviewPage
                          ? `Trang ${activePreviewPage.pageNumber}`
                          : activeChapter
                            ? `${activeChapter.seriesName} Ch.${activeChapter.chapterNumber}`
                            : "Ảnh chapter đang chấm"
                      }
                      className="w-full object-contain"
                    />
                    <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                      Bấm để phóng to
                    </span>
                  </button>

                  {previewPageCount > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        disabled={previewPageIndex <= 0}
                        onClick={() =>
                          setPreviewPageIndex((idx) => Math.max(0, idx - 1))
                        }
                      >
                        <ChevronLeft className="size-3.5" />
                        Trang trước
                      </Button>
                      <Select
                        value={String(previewPageIndex)}
                        onValueChange={(value) =>
                          setPreviewPageIndex(Number(value))
                        }
                      >
                        <SelectTrigger className="h-8 w-[9.5rem]">
                          <SelectValue
                            placeholder={`Trang ${previewPageIndex + 1}/${previewPageCount}`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {chapterPages.map((page, index) => (
                            <SelectItem key={page.id ?? index} value={String(index)}>
                              Trang {page.pageNumber ?? index + 1}/{previewPageCount}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        disabled={previewPageIndex >= previewPageCount - 1}
                        onClick={() =>
                          setPreviewPageIndex((idx) =>
                            Math.min(previewPageCount - 1, idx + 1),
                          )
                        }
                      >
                        Trang sau
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
              {activeChapter?.seriesId ? (
                <Button variant="outline" size="sm" asChild className="border-gray-200">
                  <Link to={`/eb/series/${encodeURIComponent(activeChapter.seriesId)}`}>
                    Xem toàn bộ series & chapters
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
          </aside>
        </section>
            )}
          </>
        ) : null}

        {!isChapterDetail ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2.5 text-xl font-semibold tracking-tight text-gray-900">
                <Gavel className="size-5 text-amber-600" />
                Hàng chờ duyệt
                {!apiLoading && queueItems.length > 0 ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-50 px-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                    {queueItems.length}
                  </span>
                ) : null}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Đồng bộ từ{" "}
                <Link
                  to="/mangaka"
                  className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                >
                  Mangaka
                </Link>
                {" / "}
                <Link
                  to="/tantou"
                  className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                >
                  Tantou
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/eb/history"
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:bg-gray-50"
              >
                <History className="size-3.5" />
                Lịch sử chấm
              </Link>
              <Link
                to="/eb/schedule"
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:bg-gray-50"
              >
                <Calendar className="size-3.5" />
                Lịch publish
              </Link>
            </div>
          </div>

          {apiLoading ? (
            <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-500 shadow-sm">
              Đang tải hàng chờ EB...
            </div>
          ) : queueItems.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-500 shadow-sm">
              Không có series nào đang chờ EB duyệt.
            </div>
          ) : (
            selectedMangakaGroup ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="group/avatar inline-flex shrink-0">
                        <Avatar
                          className={cn(
                            "size-9 rounded-full shadow-sm shadow-sky-900/20 ring-1 ring-border",
                            "transition-all duration-200 ease-out",
                            "group-hover/avatar:scale-110 group-hover/avatar:ring-2 group-hover/avatar:ring-sky-400",
                            "group-hover/avatar:shadow-md group-hover/avatar:shadow-sky-500/25",
                          )}
                        >
                          {selectedMangakaGroup.avatarUrl ? (
                            <AvatarImage
                              src={selectedMangakaGroup.avatarUrl}
                              alt=""
                              className="transition-transform duration-300 group-hover/avatar:scale-110"
                            />
                          ) : null}
                          <AvatarFallback className="rounded-full bg-sky-600 text-sm font-bold text-white">
                            {(selectedMangakaGroup.name.length >= 2
                              ? selectedMangakaGroup.name
                              : `${selectedMangakaGroup.name}●`
                            )
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </span>
                      <h3 className="truncate text-lg font-semibold tracking-tight text-gray-900">
                        {selectedMangakaGroup.name}
                      </h3>
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-600 px-2 text-xs font-semibold text-white">
                        {selectedMangakaGroup.count}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedMangakaGroup.count} series chờ duyệt từ Mangaka này.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMangakaKey(null)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    <ArrowLeft className="size-3.5" />
                    Tất cả Mangaka
                  </button>
                </div>

                <div className="scrollbar-hide max-h-[min(640px,calc(100vh-260px))] overflow-y-auto">
                  {selectedMangakaGroup.items.map((series) => (
                    <div
                      key={series.id ?? series.seriesId}
                      className="mb-3 flex flex-col items-start justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all last:mb-0 hover:border-gray-200 hover:shadow-sm sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 gap-4">
                        {series.coverUrl ? (
                          <img
                            src={series.coverUrl}
                            alt=""
                            className="h-20 w-16 shrink-0 rounded-lg object-cover shadow-2xs"
                          />
                        ) : (
                          <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-400 shadow-2xs">
                            N/A
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="mb-0.5 flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-gray-900">
                              {series.name ?? series.seriesName}
                            </h3>
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                              {series.status ?? "pending_EB"}
                            </span>
                            {series.classification ? (
                              <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500">
                                {series.classification}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs font-normal text-gray-500">
                            {[
                              series.firstChapter
                                ? `Ch.${series.firstChapter.chapterNumber}${
                                    series.firstChapter.title
                                      ? ` — ${series.firstChapter.title}`
                                      : ""
                                  }`
                                : null,
                              series.classificationText,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {series.synopsis ? (
                            <p className="mt-1 line-clamp-2 text-xs font-normal text-gray-500">
                              {series.synopsis}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            openSeriesReview(series.seriesId ?? series.id)
                          }
                          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                        >
                          <BookOpen className="size-3.5" />
                          Xem pages
                        </button>
                        {series.firstChapter?.id ? (
                          <button
                            type="button"
                            onClick={() =>
                              openChapterEvaluate(series.firstChapter.id)
                            }
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="size-3.5" />
                            Chấm điểm
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {queueByMangaka.map((group) => (
                    <EbMangakaSelectCard
                      key={group.key}
                      group={group}
                      onSelect={setSelectedMangakaKey}
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </section>
        ) : null}
      </main>

      {isChapterDetail ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 flex w-[min(100%-1.5rem,720px)] min-w-0 -translate-x-1/2 justify-center sm:min-w-[500px]">
          <div className="pointer-events-auto flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-md sm:gap-6 sm:px-6">
            <p className="text-xs text-gray-600 sm:text-sm">
              Điểm TB cá nhân:{" "}
              <strong
                className={cn(
                  "tabular-nums",
                  personalAvgDisplay.muted
                    ? "text-gray-400"
                    : "text-gray-900",
                )}
              >
                {personalAvgDisplay.text}
              </strong>
              {activeMember ? (
                <>
                  {" "}
                  · {activeMember.name}
                </>
              ) : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-gray-200 bg-white shadow-none"
                onClick={() => void handleSaveAssessment()}
              >
                Lưu nháp
              </Button>
              <Button
                type="button"
                disabled={
                  submitting
                  || Boolean(debutGateLock)
                  || (!isFirstReview
                    ? !activeSeriesId
                    : !activeChapter?.id)
                }
                title={
                  debutGateLock
                    ? debutGateLock.message
                    : (!isFirstReview
                      ? "Gửi quick decision"
                      : (canSubmitScores
                        ? undefined
                        : "Cần lưu nháp đủ điểm tất cả thành viên hội đồng (3–5)"))
                }
                className="bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                onClick={() => {
                  if (isFirstReview && !canSubmitScores) {
                    warnMissingCouncilDrafts();
                    return;
                  }
                  void handleSubmitScores();
                }}
              >
                {submitting
                  ? "Đang nộp…"
                  : (isFirstReview ? "Nộp kết quả chấm" : "Gửi quick decision")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-h-[95vh] max-w-[min(96vw,56rem)] overflow-hidden border-none bg-zinc-950 p-2 text-white sm:p-3">
          <DialogTitle className="sr-only">
            Phóng to trang{" "}
            {activePreviewPage?.pageNumber ?? previewPageIndex + 1}
          </DialogTitle>
          <div className="flex max-h-[88vh] items-center justify-center overflow-auto">
            <img
              src={previewImageSrc}
              alt={
                activePreviewPage
                  ? `Trang ${activePreviewPage.pageNumber}`
                  : "Xem trước chapter"
              }
              className="max-h-[86vh] w-auto max-w-full object-contain"
            />
          </div>
          {previewPageCount > 1 ? (
            <div className="flex items-center justify-center gap-2 pb-1 pt-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={previewPageIndex <= 0}
                onClick={() =>
                  setPreviewPageIndex((idx) => Math.max(0, idx - 1))
                }
              >
                <ChevronLeft className="size-3.5" />
                Trước
              </Button>
              <span className="text-xs text-zinc-300">
                {previewPageIndex + 1} / {previewPageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={previewPageIndex >= previewPageCount - 1}
                onClick={() =>
                  setPreviewPageIndex((idx) =>
                    Math.min(previewPageCount - 1, idx + 1),
                  )
                }
              >
                Sau
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
