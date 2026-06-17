import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Maximize2,
  MousePointer2,
  Square,
  X,
} from "lucide-react";
import {
  MANGA_PAGE_HEIGHT,
  MANGA_PAGE_WIDTH,
} from "@/constants/mangaPageDimensions.js";
import { noteTaskLabel } from "@/constants/workspaceTasks.js";
import {
  TANTOU_REVIEW_NOTE_TYPES,
  tantouReviewNoteLabel,
} from "@/constants/tantouReviewNotes.js";
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
import { cn } from "@/lib/utils";
import type { PageNote, StoryPage, TantouSubmission } from "./reviewTypes";
import "@/styles/mangaPage.css";
import "@/pages/User/Tantou/TantouEditor.css";
import "@/pages/User/Mangaka/Mangaka.css";

function uid() {
  return `ten-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type Tool = "draw" | "select" | "delete";

type TantouPageAnnotatorProps = {
  submission: TantouSubmission;
  storyPages?: StoryPage[];
  currentPageIndex?: number;
  onPageIndexChange?: (pageIndex: number) => void;
  pageLabel?: string;
  pageImageUrl?: string;
  mangakaNotes?: PageNote[];
  editorialNotes: PageNote[];
  onEditorialNotesChange?: (notes: PageNote[]) => void;
  readOnly?: boolean;
  onClose?: () => void;
};

export const TantouPageAnnotator = forwardRef<
  HTMLDivElement,
  TantouPageAnnotatorProps
>(function TantouPageAnnotator(
  {
    submission,
    storyPages = [],
    currentPageIndex = 0,
    onPageIndexChange,
    pageLabel,
    pageImageUrl,
    mangakaNotes = [],
    editorialNotes,
    onEditorialNotesChange,
    readOnly = false,
    onClose,
  },
  ref,
) {
  const boardRef = useRef<HTMLDivElement>(null);
  const fsBoardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tool, setTool] = useState<Tool>("draw");
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [drawCurrent, setDrawCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [highlightMangakaId, setHighlightMangakaId] = useState<string | null>(
    null,
  );

  const pageUrl = pageImageUrl ?? submission.mangakaImageUrl;
  const activePageLabel =
    pageLabel ?? storyPages[currentPageIndex]?.pageLabel ?? submission.pageLabel;
  const pageCount = storyPages.length;
  const canGoPrev = currentPageIndex > 0;
  const canGoNext = currentPageIndex < pageCount - 1;
  const showPageNav = pageCount > 0 && !!onPageIndexChange;

  function goToPage(delta: number) {
    if (!onPageIndexChange) return;
    const next = currentPageIndex + delta;
    if (next >= 0 && next < pageCount) onPageIndexChange(next);
  }

  useEffect(() => {
    setSelectedNoteId(null);
    setHighlightMangakaId(null);
    setTool(readOnly ? "select" : "draw");
    setDrawStart(null);
    setDrawCurrent(null);
  }, [submission.id, currentPageIndex, readOnly]);

  useEffect(() => {
    setIsFullscreen(false);
  }, [submission.id]);

  useEffect(() => {
    if (!showPageNav || !onPageIndexChange) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft" && canGoPrev) {
        e.preventDefault();
        onPageIndexChange(currentPageIndex - 1);
      }
      if (e.key === "ArrowRight" && canGoNext) {
        e.preventDefault();
        onPageIndexChange(currentPageIndex + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPageNav, canGoPrev, canGoNext, currentPageIndex, onPageIndexChange]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  const getPercent = useCallback(
    (e: React.MouseEvent, refEl: React.RefObject<HTMLDivElement | null>) => {
      const el = refEl.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      };
    },
    [],
  );

  const deleteNote = useCallback(
    (id: string) => {
      onEditorialNotesChange?.(editorialNotes.filter((n) => n.id !== id));
      setSelectedNoteId((prev) => (prev === id ? null : prev));
    },
    [editorialNotes, onEditorialNotesChange],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNoteId) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        deleteNote(selectedNoteId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNoteId, deleteNote]);

  function updateNoteField(
    id: string,
    field: keyof PageNote,
    value: string | number,
  ) {
    onEditorialNotesChange?.(
      editorialNotes.map((n) =>
        n.id === id ? { ...n, [field]: value } : n,
      ),
    );
  }

  function onBoardMouseDown(
    e: React.MouseEvent,
    refEl: React.RefObject<HTMLDivElement | null>,
  ) {
    if (readOnly) return;
    if (tool === "delete") {
      setSelectedNoteId(null);
      return;
    }
    if (tool !== "draw") return;
    const pt = getPercent(e, refEl);
    setDrawStart(pt);
    setDrawCurrent(pt);
    setSelectedNoteId(null);
    setHighlightMangakaId(null);
  }

  function onBoardMouseMove(
    e: React.MouseEvent,
    refEl: React.RefObject<HTMLDivElement | null>,
  ) {
    if (!drawStart) return;
    setDrawCurrent(getPercent(e, refEl));
  }

  function onBoardMouseUp() {
    if (readOnly) return;
    if (!drawStart || !drawCurrent) return;
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawCurrent.x - drawStart.x);
    const h = Math.abs(drawCurrent.y - drawStart.y);
    setDrawStart(null);
    setDrawCurrent(null);
    if (w < 2 || h < 2) return;

    const newNote: PageNote = {
      id: uid(),
      x,
      y,
      w,
      h,
      text: "",
      taskType: "layout",
    };
    onEditorialNotesChange?.([...editorialNotes, newNote]);
    setSelectedNoteId(newNote.id);
    setTool("select");
  }

  function onTantouNoteClick(e: React.MouseEvent, noteId: string) {
    e.stopPropagation();
    if (tool === "delete") {
      deleteNote(noteId);
      return;
    }
    setSelectedNoteId(noteId);
    setHighlightMangakaId(null);
    setTool("select");
  }

  const draftRect =
    drawStart && drawCurrent
      ? {
          x: Math.min(drawStart.x, drawCurrent.x),
          y: Math.min(drawStart.y, drawCurrent.y),
          w: Math.abs(drawCurrent.x - drawStart.x),
          h: Math.abs(drawCurrent.y - drawStart.y),
        }
      : null;

  const selectedNote = editorialNotes.find((n) => n.id === selectedNoteId);

  function renderPageNavBottom(darkToolbar = false) {
    if (!showPageNav) return null;

    const outlineOnDark =
      "border-white/25 bg-white/5 text-white hover:bg-white/12 hover:text-white disabled:opacity-35";

    return (
      <div
        className={cn(
          "te-page-nav shrink-0 flex items-center justify-center gap-4 border-t px-4 py-3",
          darkToolbar
            ? "border-white/10 bg-zinc-900/95"
            : "border-border/50 bg-muted/20",
        )}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("min-w-[7.5rem]", darkToolbar && outlineOnDark)}
          disabled={!canGoPrev}
          onClick={() => goToPage(-1)}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4" />
          Trang trước
        </Button>
        <span
          className={cn(
            "min-w-[6.5rem] text-center text-sm tabular-nums",
            darkToolbar ? "text-zinc-300" : "text-muted-foreground",
          )}
        >
          Trang{" "}
          <strong className={darkToolbar ? "text-white" : "text-foreground"}>
            {currentPageIndex + 1}
          </strong>
          {" / "}
          {pageCount}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("min-w-[7.5rem]", darkToolbar && outlineOnDark)}
          disabled={!canGoNext}
          onClick={() => goToPage(1)}
          aria-label="Trang sau"
        >
          Trang sau
          <ChevronRight className="size-4" />
        </Button>
      </div>
    );
  }

  function renderStageColumn(
    boardRefEl: React.RefObject<HTMLDivElement | null>,
    fullscreen = false,
    darkToolbar = false,
  ) {
    return (
      <div className="te-editor__stage-wrap flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="te-editor__stage flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-6">
          {renderPageBoard(boardRefEl, fullscreen)}
        </div>
        {renderPageNavBottom(darkToolbar)}
      </div>
    );
  }

  function renderToolButtons({
    darkToolbar = false,
    showZoom = true,
  }: { darkToolbar?: boolean; showZoom?: boolean } = {}) {
    const outlineOnDark =
      "border-white/25 bg-white/5 text-white shadow-none hover:bg-white/12 hover:text-white";
    const destructiveOnDark =
      "border-red-400/50 bg-red-500/15 text-red-50 hover:bg-red-500/25 hover:text-white";

    return (
      <>
        {!readOnly ? (
          <>
            <Button
              type="button"
              size="sm"
              variant={tool === "draw" ? "default" : "outline"}
              className={cn(tool !== "draw" && darkToolbar && outlineOnDark)}
              onClick={() => setTool("draw")}
            >
              <Square className="size-3.5" />
              Tạo ô
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tool === "select" ? "default" : "outline"}
              className={cn(tool !== "select" && darkToolbar && outlineOnDark)}
              onClick={() => setTool("select")}
            >
              <MousePointer2 className="size-3.5" />
              Chọn
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tool === "delete" ? "destructive" : "outline"}
              className={cn(
                tool !== "delete" && darkToolbar && outlineOnDark,
                tool === "delete" && darkToolbar && destructiveOnDark,
              )}
              onClick={() => setTool("delete")}
            >
              <Eraser className="size-3.5" />
              Gỡ ô
            </Button>
          </>
        ) : null}
        {showZoom ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(darkToolbar && outlineOnDark)}
            onClick={() => setIsFullscreen(true)}
          >
            <Maximize2 className="size-3.5" />
            Phóng to
          </Button>
        ) : null}
      </>
    );
  }

  function renderPageBoard(
    refEl: React.RefObject<HTMLDivElement | null>,
    fullscreen = false,
  ) {
    return (
      <div
        ref={refEl}
        className={cn(
          "mk-board manga-page manga-page--canvas te-board relative mx-auto",
          tool === "draw" && "mk-board--draw",
          tool === "delete" && "mk-board--delete",
          fullscreen && "mk-board--fullscreen",
        )}
        onMouseDown={(e) => onBoardMouseDown(e, refEl)}
        onMouseMove={(e) => onBoardMouseMove(e, refEl)}
        onMouseUp={onBoardMouseUp}
        onMouseLeave={onBoardMouseUp}
      >
        {pageUrl ? (
          <img
            src={pageUrl}
            alt={`${submission.seriesTitle} · ${activePageLabel}`}
            className="mk-board__img manga-page__media"
            width={MANGA_PAGE_WIDTH}
            height={MANGA_PAGE_HEIGHT}
            draggable={false}
          />
        ) : (
          <div className="mk-board__placeholder manga-page__empty">
            <p>Chưa có ảnh trang</p>
          </div>
        )}

        {mangakaNotes.map((n, idx) => (
          <div
            key={n.id ?? `m-${idx}`}
            className={cn(
              "mk-note-box te-note-box--mangaka pointer-events-auto",
              highlightMangakaId === (n.id ?? `m-${idx}`) && "selected",
            )}
            style={{
              left: `${n.x ?? 0}%`,
              top: `${n.y ?? 0}%`,
              width: `${n.w ?? 10}%`,
              height: `${n.h ?? 10}%`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setHighlightMangakaId(n.id ?? `m-${idx}`);
              setSelectedNoteId(null);
              setTool("select");
            }}
          >
            <span className="mk-note-box__num te-note-box__num--m">
              M{idx + 1}
            </span>
            {n.taskType ? (
              <span className="mk-note-box__task">
                {noteTaskLabel(n.taskType)}
              </span>
            ) : null}
          </div>
        ))}

        {editorialNotes.map((n, idx) => (
          <div
            key={n.id}
            className={cn(
              "mk-note-box te-note-box--tantou",
              selectedNoteId === n.id && "selected",
              tool === "delete" && "mk-note-box--target",
            )}
            style={{
              left: `${n.x}%`,
              top: `${n.y}%`,
              width: `${n.w}%`,
              height: `${n.h}%`,
            }}
            onClick={(e) => onTantouNoteClick(e, n.id)}
          >
            <span className="mk-note-box__num te-note-box__num--t">
              {idx + 1}
            </span>
            {n.taskType ? (
              <span className="mk-note-box__task">
                {tantouReviewNoteLabel(n.taskType)}
              </span>
            ) : null}
                {!readOnly && (selectedNoteId === n.id || tool === "delete") ? (
                  <button
                    type="button"
                    className="mk-note-box__delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(n.id);
                    }}
                    aria-label={`Gỡ ô ${idx + 1}`}
                  >
                    ×
                  </button>
                ) : null}
          </div>
        ))}

        {draftRect ? (
          <div
            className="mk-note-box mk-note-box--draft te-note-box--tantou"
            style={{
              left: `${draftRect.x}%`,
              top: `${draftRect.y}%`,
              width: `${draftRect.w}%`,
              height: `${draftRect.h}%`,
            }}
          />
        ) : null}
      </div>
    );
  }

  function renderNotesPanel(extraClassName?: string) {
    return (
      <aside
        className={cn(
          "te-notes-panel te-notes-panel--simple min-h-0 border-l border-border/60",
          extraClassName,
        )}
      >
        <div className="te-notes-panel__scroll">
          {mangakaNotes.length > 0 ? (
            <section className="te-notes-section">
              <h3 className="te-notes-section__title">
                <span className="te-legend te-legend--mangaka">Mangaka</span>
              </h3>
              <ul className="te-mangaka-pick-list">
                {mangakaNotes.map((n, idx) => {
                  const key = n.id ?? `m-${idx}`;
                  const active = highlightMangakaId === key;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        className={cn("te-mangaka-pick", active && "active")}
                        onClick={() => {
                          setHighlightMangakaId(key);
                          setSelectedNoteId(null);
                        }}
                      >
                        <span className="te-mangaka-pick__num">M{idx + 1}</span>
                        <span className="te-mangaka-pick__text">
                          {n.text?.trim() ||
                            noteTaskLabel(n.taskType) ||
                            "Chưa có mô tả"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="te-notes-section">
            <h3 className="te-notes-section__title">
              <span className="te-legend te-legend--tantou">
                Ô nhận xét Tantou
              </span>
            </h3>

            {editorialNotes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Chọn <strong>Tạo ô</strong>, kéo vùng trên trang, rồi ghi nhận
                xét chỉnh sửa.
              </p>
            ) : (
              <ul className="te-tantou-pick-list">
                {editorialNotes.map((n, idx) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        "te-tantou-pick",
                        selectedNoteId === n.id && "border-sky-500",
                      )}
                      onClick={() => {
                        setSelectedNoteId(n.id);
                        setHighlightMangakaId(null);
                        setTool("select");
                      }}
                    >
                      <span>#{idx + 1}</span>
                      <span>
                        {n.text?.trim() ||
                          tantouReviewNoteLabel(n.taskType) ||
                          "Chưa có nhận xét"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="te-tantou-pick__delete"
                      onClick={() => deleteNote(n.id)}
                      aria-label={`Xóa ô ${idx + 1}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {selectedNote ? (
              <div className="te-selected-note-editor mt-3">
                <Label className="te-selected-note-editor__label">
                  Loại nhận xét
                  <Select
                    value={selectedNote.taskType}
                    onValueChange={(v) =>
                      updateNoteField(selectedNote.id, "taskType", v)
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TANTOU_REVIEW_NOTE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                <Textarea
                  value={selectedNote.text}
                  onChange={(e) =>
                    updateNoteField(selectedNote.id, "text", e.target.value)
                  }
                  placeholder="Mô tả chi tiết vùng cần chỉnh (VD: font thoại quá nhỏ, cần chỉnh khung 3)..."
                  rows={4}
                  className="text-sm"
                />
              </div>
            ) : null}
          </section>
        </div>
      </aside>
    );
  }

  return (
    <div
      ref={ref}
      className="te-editor flex h-full min-h-0 flex-col scroll-mt-24 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg"
    >
      <div className="te-editor__toolbar shrink-0 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Khoanh vùng & nhận xét
            </p>
            <p className="text-xs text-muted-foreground">
              {submission.seriesTitle} · Ch. {submission.chapterNum} ·{" "}
              {activePageLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">728×1030</Badge>
            {onClose ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onClose}
                aria-label="Đóng"
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">{renderToolButtons()}</div>
        <p className="te-editor__legend mt-2 text-xs text-muted-foreground">
          <span className="te-legend te-legend--mangaka">■ Mangaka</span>
          <span className="te-editor__legend-sep">·</span>
          <span className="te-legend te-legend--tantou">■ Tantou (bạn)</span>
          <span className="te-editor__legend-sep">·</span>
          <span className="te-editor__count">
            {editorialNotes.length} ô nhận xét
          </span>
        </p>
      </div>

      <div className="te-editor__workspace te-editor__workspace--simple min-h-0 flex-1">
        {renderStageColumn(boardRef)}
        {renderNotesPanel()}
      </div>

      {isFullscreen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-zinc-950"
          role="dialog"
          aria-modal="true"
          aria-label="Phóng to trang truyện"
        >
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900 px-4 py-3 text-white sm:px-5">
            <div>
              <p className="text-sm font-semibold">
                {submission.seriesTitle} · Ch. {submission.chapterNum}
              </p>
              <p className="text-xs text-zinc-400">{activePageLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {renderToolButtons({ darkToolbar: true, showZoom: false })}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/25 bg-white/5 text-white shadow-none hover:bg-white/12 hover:text-white"
                onClick={() => setIsFullscreen(false)}
              >
                <X className="size-4" />
                Thu nhỏ
              </Button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_minmax(300px,360px)]">
            {renderStageColumn(fsBoardRef, true, true)}
            {renderNotesPanel("h-full max-h-none border-l border-white/10 bg-card")}
          </div>
        </div>
      ) : null}
    </div>
  );
});
