import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Maximize2,
  MessageSquareText,
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
  viewerMode?: "tantou" | "mangaka";
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
          "te-page-nav flex shrink-0 items-center justify-center gap-3 border-t px-4 py-2.5",
          darkToolbar
            ? "border-white/10 bg-zinc-900/95"
            : "border-slate-100 bg-slate-50/80",
        )}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            "h-9 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
            "disabled:pointer-events-none disabled:opacity-40",
            darkToolbar
              ? outlineOnDark
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          )}
          disabled={!canGoPrev}
          onClick={() => goToPage(-1)}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4" />
          Trang trước
        </Button>
        <span
          className={cn(
            "min-w-[6.5rem] text-center text-xs tabular-nums",
            darkToolbar ? "text-zinc-300" : "text-slate-500",
          )}
        >
          Trang{" "}
          <strong className={darkToolbar ? "text-white" : "text-slate-800"}>
            {currentPageIndex + 1}
          </strong>
          {" / "}
          {pageCount}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            "h-9 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
            "disabled:pointer-events-none disabled:opacity-40",
            darkToolbar
              ? outlineOnDark
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          )}
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
        <div
          className={cn(
            "te-editor__stage te-canvas-viewport relative z-0 flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4",
            !fullscreen &&
              "min-h-[min(52vh,460px)] max-h-[min(70vh,760px)] rounded-xl border border-slate-200 bg-gray-900 shadow-inner",
            fullscreen && "bg-zinc-950",
          )}
        >
          <div
            className={cn(
              "te-canvas-fit w-full",
              !fullscreen && "flex max-h-full items-center justify-center",
            )}
          >
            {renderPageBoard(boardRefEl, fullscreen)}
          </div>
        </div>
        {renderPageNavBottom(darkToolbar)}
      </div>
    );
  }

  function toolButtonClass(
    active: boolean,
    tone: "neutral" | "danger" = "neutral",
    darkToolbar = false,
  ) {
    const base =
      "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-150";
    if (darkToolbar) {
      if (active && tone === "danger") {
        return cn(base, "border border-rose-400/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25");
      }
      if (active) {
        return cn(base, "border border-slate-400/40 bg-white/15 text-white hover:bg-white/20");
      }
      return cn(base, "border border-white/20 bg-transparent text-zinc-200 hover:bg-white/10");
    }
    if (active && tone === "danger") {
      return cn(base, "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100");
    }
    if (active) {
      return cn(
        base,
        "border border-slate-300 bg-slate-100 text-slate-900 shadow-none hover:bg-slate-200/80",
      );
    }
    return cn(
      base,
      "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    );
  }

  function renderToolButtons({
    darkToolbar = false,
    showZoom = true,
  }: { darkToolbar?: boolean; showZoom?: boolean } = {}) {
    return (
      <>
        {!readOnly ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(toolButtonClass(tool === "draw", "neutral", darkToolbar))}
              onClick={() => setTool("draw")}
            >
              <Square className="size-3.5" />
              Tạo ô
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(toolButtonClass(tool === "select", "neutral", darkToolbar))}
              onClick={() => setTool("select")}
            >
              <MousePointer2 className="size-3.5" />
              Chọn
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(toolButtonClass(tool === "delete", "danger", darkToolbar))}
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
            className={cn(
              toolButtonClass(false, "neutral", darkToolbar),
            )}
            onClick={() => setIsFullscreen(true)}
            title="Phóng to vừa màn hình"
          >
            <Maximize2 className="size-3.5" />
            Vừa khung
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
          "te-notes-panel te-notes-panel--simple min-h-0 border-l border-slate-100 bg-slate-50/40",
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
              <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-5 text-center">
                <MessageSquareText className="size-5 text-slate-300" />
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {readOnly
                    ? "TE chưa để lại ô nhận xét trên trang này."
                    : (
                      <>
                        Chưa có nhận xét. Chọn{" "}
                        <strong className="font-medium text-slate-500">Tạo ô</strong> rồi kéo vùng trên ảnh.
                      </>
                    )}
                </p>
              </div>
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
                    {!readOnly ? (
                      <button
                        type="button"
                        className="te-tantou-pick__delete"
                        onClick={() => deleteNote(n.id)}
                        aria-label={`Xóa ô ${idx + 1}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {selectedNote ? (
              readOnly ? (
                <div className="te-selected-note-editor mt-3 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Loại nhận xét
                  </p>
                  <p className="text-sm font-medium">
                    {tantouReviewNoteLabel(selectedNote.taskType)}
                  </p>
                  {selectedNote.text?.trim() ? (
                    <p className="text-sm leading-relaxed text-foreground">
                      {selectedNote.text}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="te-selected-note-editor mt-3">
                  <Label className="te-selected-note-editor__label text-slate-600">
                    Loại nhận xét
                    <Select
                      value={selectedNote.taskType}
                      onValueChange={(v) =>
                        updateNoteField(selectedNote.id, "taskType", v)
                      }
                    >
                      <SelectTrigger className="h-8 bg-white text-slate-800">
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
                    className="bg-white text-sm text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              )
            ) : null}
          </section>
        </div>
      </aside>
    );
  }

  return (
    <div
      ref={ref}
      className="te-editor relative z-0 flex h-full min-h-0 max-h-[min(82vh,900px)] flex-col scroll-mt-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="te-editor__toolbar shrink-0 border-b border-slate-100 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 space-y-0">
            <p className="text-xs font-semibold text-slate-900 sm:text-sm">
              Khoanh vùng & nhận xét
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {submission.seriesTitle} · Ch. {submission.chapterNum} ·{" "}
              {activePageLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="h-6 rounded-md border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-500"
            >
              728×1030
            </Badge>
            {onClose ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                onClick={onClose}
                aria-label="Đóng"
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">{renderToolButtons()}</div>
      </div>

      <div className="te-editor__workspace te-editor__workspace--simple min-h-0 flex-1">
        {renderStageColumn(boardRef)}
        {renderNotesPanel()}
      </div>

      {isFullscreen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex flex-col bg-zinc-950"
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

              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                {renderStageColumn(fsBoardRef, true, true)}
                {renderNotesPanel(
                  "h-full max-h-none border-l border-slate-200 bg-white text-slate-800",
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
});
