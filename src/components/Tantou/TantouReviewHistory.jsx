import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { teReviewsService } from "@/api/teReviews.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTeScheduledPublishDisplay } from "@/utils/teReviewPhase.js";
import {
  mapTeReviewHistoryResponse,
  teHistoryChapterStatusBadgeClass,
  teHistoryChapterStatusLabel,
  teHistoryDecisionBadgeClass,
  teHistoryDecisionLabel,
} from "@/utils/teReviewHistoryMappers.js";
import { cn } from "@/lib/utils";

const DECISION_FILTERS = [
  { value: "all", label: "Tất cả quyết định" },
  { value: "draft", label: "Nháp" },
  { value: "approved", label: "Đã duyệt" },
  { value: "approved_publish", label: "Đã duyệt phát hành" },
  { value: "revision", label: "Yêu cầu chỉnh" },
  { value: "rejected", label: "Từ chối" },
];

function formatReviewedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

/** Hiển thị chapter không lặp `Ch. X · Chapter X`. */
function formatChapterRef(chapterNumber, chapterTitle) {
  const title = String(chapterTitle ?? "").trim();
  if (chapterNumber == null || chapterNumber === "") {
    return title || null;
  }
  const shortRef = `Ch. ${chapterNumber}`;
  if (!title) return shortRef;

  const normalized = title.replace(/\s+/g, " ");
  const looksLikeChapterRef =
    /^(ch\.?|chapter)\s*\d+/i.test(normalized)
    || normalized === String(chapterNumber);

  if (looksLikeChapterRef) {
    return /^chapter\s+/i.test(normalized) ? normalized : shortRef;
  }
  return `${shortRef} · ${title}`;
}

/** Lịch sử duyệt TE — GET /te-reviews/history */
export function TantouReviewHistory() {
  const [decision, setDecision] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await teReviewsService.getHistory({
        page,
        limit: 20,
        ...(decision !== "all" ? { decision } : {}),
        ...(fromDate ? { from_date: fromDate } : {}),
        ...(toDate ? { to_date: toDate } : {}),
      });
      const mapped = mapTeReviewHistoryResponse(raw);
      setItems(mapped.items);
      setPagination(mapped.pagination);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được lịch sử duyệt."));
      setItems([]);
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, decision, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const searchLower = searchText.trim().toLowerCase();
  const visibleItems = searchLower
    ? items.filter((item) => {
        const hay = [
          item.seriesName,
          item.chapterTitle,
          item.authorName,
          item.feedback,
          String(item.chapterNumber ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(searchLower);
      })
    : items;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Lịch sử duyệt</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Các lần bạn lưu hoặc gửi nhận xét gần đây.
        </p>
      </div>

      <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card/60 p-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 w-full lg:max-w-xs lg:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Tìm trong trang hiện tại (series, chapter, tác giả)…"
            className="h-9 pl-9"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="Tìm kiếm lịch sử"
          />
        </div>
        <Select
          value={decision}
          onValueChange={(value) => {
            setDecision(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full lg:w-44">
            <SelectValue placeholder="Quyết định TE" />
          </SelectTrigger>
          <SelectContent>
            {DECISION_FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="h-9 w-full lg:w-44"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPage(1);
          }}
          aria-label="Từ ngày"
        />
        <Input
          type="date"
          className="h-9 w-full lg:w-44"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPage(1);
          }}
          aria-label="Đến ngày"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 lg:ml-auto"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Làm mới
        </Button>
      </div>

      {!loading && pagination.total > 0 ? (
        <p className="text-xs text-muted-foreground">
          {pagination.total} bản ghi · trang {pagination.page}/{pagination.totalPages}
        </p>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
            <Loader2 className="size-7 animate-spin" />
            Đang tải lịch sử...
          </CardContent>
        </Card>
      ) : visibleItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {items.length === 0
              ? "Chưa có lịch sử duyệt."
              : "Không có kết quả khớp tìm kiếm trên trang này."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const note = item.feedback || item.revisionFeedback || item.quickNotes;
            const scheduleLabel = item.isPublished
              ? item.publishedAt
                ? `Publish: ${formatTeScheduledPublishDisplay(item.publishedAt)}`
                : null
              : item.scheduledPublishAt
                ? `Lịch: ${formatTeScheduledPublishDisplay(item.scheduledPublishAt)}`
                : null;
            const chapterRef = formatChapterRef(
              item.chapterNumber,
              item.chapterTitle,
            );

            return (
              <Card
                key={item.id}
                className="border-border/70 shadow-none transition-colors hover:bg-muted/20"
              >
                <CardContent className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className="relative h-16 w-auto shrink-0 overflow-hidden bg-muted sm:h-[72px]"
                      style={{ aspectRatio: "3 / 4", borderRadius: 6 }}
                    >
                      {item.coverImageUrl ? (
                        <img
                          src={item.coverImageUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-muted text-muted-foreground/70">
                          <ImageIcon className="size-4" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-[15px] font-semibold leading-snug tracking-tight sm:text-base">
                        {item.seriesName}
                      </p>
                      <p className="truncate text-[13px] text-muted-foreground sm:text-sm">
                        {[
                          chapterRef,
                          item.authorName || null,
                          formatReviewedAt(item.createdAt),
                          item.annotationsCount > 0
                            ? `${item.annotationsCount} annotation`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                            teHistoryDecisionBadgeClass(item.decision),
                          )}
                        >
                          TE: {teHistoryDecisionLabel(item.decision)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                            teHistoryChapterStatusBadgeClass(item.chapterStatus),
                          )}
                        >
                          HT: {teHistoryChapterStatusLabel(item.chapterStatus)}
                        </Badge>
                        {item.publicationSchedule ? (
                          <Badge
                            variant="outline"
                            className="rounded-full border-transparent bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600"
                          >
                            {item.publicationSchedule}
                          </Badge>
                        ) : null}
                      </div>
                      {note ? (
                        <p className="line-clamp-1 text-[13px] text-foreground/80 sm:text-sm">
                          {note}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {scheduleLabel ? (
                      <p className="flex max-w-[9.5rem] items-center gap-1 text-right text-[11px] leading-snug text-muted-foreground sm:max-w-[12rem] sm:text-[12px]">
                        <Clock className="size-3 shrink-0" />
                        <span className="truncate">{scheduleLabel}</span>
                      </p>
                    ) : null}
                    <ChevronRight className="size-4 text-muted-foreground/70" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
            Trước
          </Button>
          <span className="text-xs text-muted-foreground">
            {pagination.page}/{pagination.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page >= pagination.totalPages}
            onClick={() =>
              setPage((p) => Math.min(pagination.totalPages, p + 1))
            }
          >
            Sau
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
