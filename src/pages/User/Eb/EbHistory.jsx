import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { getSession, logout } from "@/lib/auth.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  ebHistoryResultLabel,
  ebHistoryStatusLabel,
  mapEbHistoryListResponse,
} from "@/utils/ebEvaluationMappers.js";
import { cn } from "@/lib/utils";
import "./Eb.css";

const NAV_LINKS = [{ to: "/", label: "Trang chủ" }];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function HistoryCard({ item }) {
  const isSeries = item.evaluationType === "series";
  const cover = item.series?.coverImageUrl;

  return (
    <Card className="border-border/70 shadow-none transition-colors hover:bg-muted/20">
      <CardContent className="flex gap-4 p-4">
        <div className="relative h-[72px] w-[54px] shrink-0 overflow-hidden rounded-md bg-muted">
          {cover ? (
            <img src={cover} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <BookOpen className="size-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold">
                  {item.series?.name ?? "Series"}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {isSeries ? "Series" : "Chapter"}
                </Badge>
                {item.series?.publicationSchedule ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {item.series.publicationSchedule}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Author: {item.series?.author?.name ?? "—"}
                {!isSeries && item.chapter?.chapterNumber != null
                  ? ` · Ch. ${item.chapter.chapterNumber}`
                  : ""}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={`/eb/history/${encodeURIComponent(item.evaluationId)}`}>
                Xem chi tiết
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
              <Star className="size-3.5 fill-amber-500 text-amber-500" />
              {item.councilAverage != null
                ? Number(item.councilAverage).toFixed(2)
                : "—"}
            </span>
            {item.classificationText ? (
              <Badge className="bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">
                {item.classificationText}
              </Badge>
            ) : null}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                item.result === "approved" &&
                  "border-green-200 bg-green-50 text-green-700",
                item.result === "rejected" &&
                  "border-red-200 bg-red-50 text-red-700",
                item.result === "revision" &&
                  "border-amber-200 bg-amber-50 text-amber-700",
              )}
            >
              {ebHistoryResultLabel(item.result)}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {ebHistoryStatusLabel(item.status)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Members: {item.memberCount}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {item.firstReview ? "First review · " : ""}
            Evaluated {formatDate(item.createdAt)}
            {item.lastSavedBy?.name
              ? ` · Last saved ${formatDate(item.lastSavedAt)} by ${item.lastSavedBy.name}`
              : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EbHistory() {
  const navigate = useNavigate();
  const user = getSession();
  const [scope, setScope] = useState("series");
  const [result, setResult] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    totalSeriesReviewed: 0,
    totalChapterReviewed: 0,
    totalCouncilAverage: null,
  });
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await ebEvaluationsService.getHistory({
        scope,
        page,
        limit: 20,
        ...(result !== "all" ? { result } : {}),
        ...(status !== "all" ? { status } : {}),
        ...(query.trim() ? { q: query.trim() } : {}),
      });
      const mapped = mapEbHistoryListResponse(raw);
      setItems(mapped.items);
      setStats(mapped.stats);
      setMeta({
        page: mapped.page,
        limit: mapped.limit,
        total: mapped.total,
        hasMore: mapped.hasMore,
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được lịch sử chấm điểm."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [scope, result, status, query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit) || 1);

  return (
    <div className="eb-page flex min-h-screen flex-col bg-background">
      <Header
        navLinks={NAV_LINKS}
        userName={user?.name}
        userAvatar={user?.avatar}
        onLogout={handleLogout}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to="/eb">
                <ArrowLeft className="size-4" />
                Về hàng chờ
              </Link>
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
                <History className="size-5 text-amber-600" />
                Lịch sử chấm điểm
              </h1>
              <p className="text-sm text-muted-foreground">
                {LABEL_EDITOR_BOARD} — các lượt đánh giá đã lưu / khóa
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Làm mới
          </Button>
        </div>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Bộ lọc</CardTitle>
            <CardDescription>
              Mặc định xem series review (chapter_id = null)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <Select
              value={scope}
              onValueChange={(v) => {
                setScope(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full lg:w-44">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="series">Series review</SelectItem>
                <SelectItem value="chapter">Chapter review</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={result}
              onValueChange={(v) => {
                setResult(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full lg:w-40">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="revision">Revision</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full lg:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="scoring">Scoring</SelectItem>
                <SelectItem value="saved">Saved</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                placeholder="Tìm series..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setQuery(searchInput);
                    setPage(1);
                  }
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9"
              onClick={() => {
                setQuery(searchInput);
                setPage(1);
              }}
            >
              Tìm
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/70 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Series reviewed</p>
              <p className="text-2xl font-bold">{stats.totalSeriesReviewed}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Chapters reviewed</p>
              <p className="text-2xl font-bold">{stats.totalChapterReviewed}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Council average</p>
              <p className="text-2xl font-bold">
                {stats.totalCouncilAverage != null
                  ? `${Number(stats.totalCouncilAverage).toFixed(2)} / 5`
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
              <Loader2 className="size-7 animate-spin" />
              Đang tải lịch sử...
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Chưa có bản ghi lịch sử khớp bộ lọc.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <HistoryCard key={item.evaluationId} item={item} />
            ))}
          </div>
        )}

        {meta.total > meta.limit ? (
          <div className="flex items-center justify-end gap-2">
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
              {meta.page}/{totalPages} · {meta.total} bản ghi
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || (!meta.hasMore && page >= totalPages)}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
