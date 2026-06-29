import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";
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
import { getSession, logout } from "@/lib/auth.js";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { ebScoresService } from "@/api/ebScores.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { placeholderPageDataUrl } from "@/utils/placeholderPageDataUrl.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  mapEbChapterPreviewResponse,
  mapEbSeriesDetailResponse,
} from "@/utils/ebEvaluationMappers.js";
import "./Eb.css";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
  { to: "/tantou", label: "Tantou Editor" },
];

export default function EbSeriesDetail() {
  const navigate = useNavigate();
  const { seriesId } = useParams();
  const user = getSession();

  const [detail, setDetail] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [chapterPages, setChapterPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagesLoading, setPagesLoading] = useState(false);

  const loadSeriesDetail = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const data = await ebEvaluationsService.getSeriesDetail(seriesId);
      const mapped = mapEbSeriesDetailResponse(data);
      if (!mapped) {
        toast.error("Không đọc được dữ liệu series.");
        setDetail(null);
        return;
      }
      setDetail(mapped);
      const defaultChapterId = mapped.firstChapter?.id ?? "";
      setSelectedChapterId(defaultChapterId);
      setChapterPages(mapped.firstChapter?.pages ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được chi tiết series."));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    void loadSeriesDetail();
  }, [loadSeriesDetail]);

  const loadChapterPreview = useCallback(
    async (chapterId) => {
      if (!chapterId) return;
      const firstId = detail?.firstChapter?.id;
      if (chapterId === firstId && detail?.firstChapter?.pages?.length) {
        setChapterPages(detail.firstChapter.pages);
        return;
      }
      setPagesLoading(true);
      try {
        const data = await ebScoresService.getChapterPreview(chapterId);
        const mapped = mapEbChapterPreviewResponse(data);
        setChapterPages(mapped?.pages ?? []);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Không tải được pages chapter."));
        setChapterPages([]);
      } finally {
        setPagesLoading(false);
      }
    },
    [detail],
  );

  useEffect(() => {
    if (!selectedChapterId || !detail) return;
    void loadChapterPreview(selectedChapterId);
  }, [selectedChapterId, detail, loadChapterPreview]);

  const chapterTabs = useMemo(() => {
    if (!detail) return [];
    const seen = new Set();
    const tabs = [];
    for (const ch of detail.pendingChapters ?? []) {
      if (!ch.id || seen.has(ch.id)) continue;
      seen.add(ch.id);
      tabs.push(ch);
    }
    if (detail.firstChapter?.id && !seen.has(detail.firstChapter.id)) {
      tabs.unshift({
        id: detail.firstChapter.id,
        chapterNumber: detail.firstChapter.chapterNumber,
        title: detail.firstChapter.title,
        status: detail.firstChapter.status,
      });
    }
    return tabs.sort(
      (a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0),
    );
  }, [detail]);

  const activeChapter = useMemo(
    () => chapterTabs.find((ch) => ch.id === selectedChapterId) ?? null,
    [chapterTabs, selectedChapterId],
  );

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function openEvaluate(chapterId) {
    if (!chapterId) return;
    navigate(`/eb/chapter/${encodeURIComponent(chapterId)}`);
  }

  const series = detail?.series;
  const coverUrl =
    series?.coverUrl ||
    placeholderPageDataUrl(series?.name ?? "Series");

  return (
    <div className="ws-page--eb flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <main className="page-container flex-1 space-y-6 py-8">
        <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link to="/eb">
              <ArrowLeft className="size-4" />
              Quay lại hàng chờ
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">
              {LABEL_EDITOR_BOARD} · Xem nội dung
            </p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {series?.name ?? "Series"}
            </h1>
            {series?.mangakaName ? (
              <p className="text-sm text-muted-foreground">
                Tác giả: {series.mangakaName}
              </p>
            ) : null}
          </div>
          {activeChapter?.id ? (
            <Button onClick={() => openEvaluate(activeChapter.id)}>
              <CheckCircle2 className="size-4" />
              Chấm điểm chapter này
            </Button>
          ) : null}
        </header>

        {loading ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Đang tải chi tiết series...
            </CardContent>
          </Card>
        ) : !detail ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-muted-foreground">
                Không tìm thấy series trong hàng chờ EB.
              </p>
              <Button asChild variant="outline">
                <Link to="/eb">Về hàng chờ</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src={coverUrl}
                    alt={series?.name ?? "Cover"}
                    className="aspect-[3/4] w-full object-cover"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin series</CardTitle>
                  <CardDescription>
                    Tóm tắt từ{" "}
                    <code className="text-[10px]">
                      GET /eb-evaluations/series/:id/detail
                    </code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {series?.synopsis ? (
                    <p className="text-muted-foreground">{series.synopsis}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{series?.status ?? "pending_EB"}</Badge>
                    {series?.genre?.map((g) => (
                      <Badge key={g} variant="outline">
                        {g}
                      </Badge>
                    ))}
                  </div>
                  {series?.tags?.length ? (
                    <p className="text-muted-foreground">
                      Tags: {series.tags.join(", ")}
                    </p>
                  ) : null}
                  {series?.classificationText ? (
                    <p className="text-muted-foreground">
                      Phân loại: {series.classificationText}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <BookOpen className="size-5 text-primary" />
                  Chapters chờ duyệt
                </h2>
                <p className="text-sm text-muted-foreground">
                  Chapter 1 tải cùng detail; chapter khác gọi{" "}
                  <code className="text-[10px]">
                    GET /eb-scores/chapter/:id/preview
                  </code>
                  .
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {chapterTabs.map((ch) => (
                  <Button
                    key={ch.id}
                    type="button"
                    size="sm"
                    variant={selectedChapterId === ch.id ? "default" : "outline"}
                    onClick={() => setSelectedChapterId(ch.id)}
                  >
                    Ch.{ch.chapterNumber}
                    {ch.title ? ` — ${ch.title}` : ""}
                  </Button>
                ))}
              </div>

              {activeChapter ? (
                <p className="text-sm text-muted-foreground">
                  Đang xem:{" "}
                  <strong className="text-foreground">
                    Chapter {activeChapter.chapterNumber}
                    {activeChapter.title ? ` — ${activeChapter.title}` : ""}
                  </strong>
                  {pagesLoading ? " · Đang tải pages..." : ` · ${chapterPages.length} trang`}
                </p>
              ) : null}

              <div className="eb-pages-grid">
                {pagesLoading && chapterPages.length === 0 ? (
                  <Card className="col-span-full">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Đang tải pages...
                    </CardContent>
                  </Card>
                ) : chapterPages.length === 0 ? (
                  <Card className="col-span-full">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Không có pages để hiển thị.
                    </CardContent>
                  </Card>
                ) : (
                  chapterPages.map((page) => (
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
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
