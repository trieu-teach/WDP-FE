import { forwardRef } from "react";
import { ImageIcon, StickyNote, X } from "lucide-react";
import {
  MANGA_PAGE_HEIGHT,
  MANGA_PAGE_WIDTH,
} from "@/constants/mangaPageDimensions.js";
import { noteTaskLabel } from "@/constants/workspaceTasks.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TantouSubmission } from "./reviewTypes";
import "@/styles/mangaPage.css";

type ChapterReaderPanelProps = {
  submission: TantouSubmission;
  onClose?: () => void;
};

export const ChapterReaderPanel = forwardRef<
  HTMLDivElement,
  ChapterReaderPanelProps
>(function ChapterReaderPanel({ submission, onClose }, ref) {
  const pageUrl = submission.mangakaImageUrl;
  const notes = Array.isArray(submission.mangakaNotes)
    ? submission.mangakaNotes
    : [];

  return (
    <Card
      ref={ref}
      className="overflow-hidden border-sky-500/25 bg-zinc-950/40 shadow-lg dark:border-sky-400/20"
    >
      <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <ImageIcon className="size-4 text-sky-400" />
              Trang cần nhận xét
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {submission.seriesTitle} · Ch. {submission.chapterNum} ·{" "}
              {submission.pageLabel}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              728×1030
            </Badge>
            {onClose ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={onClose}
                aria-label="Đóng xem trang"
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="mx-auto max-w-[min(100%,var(--manga-page-width))]">
          <div className="manga-page manga-page--reader mx-auto overflow-hidden rounded-xl border border-border/60 bg-zinc-900/80 shadow-2xl">
            {pageUrl ? (
              <img
                src={pageUrl}
                alt={`${submission.seriesTitle} · ${submission.pageLabel}`}
                className="manga-page__media"
                width={MANGA_PAGE_WIDTH}
                height={MANGA_PAGE_HEIGHT}
                draggable={false}
              />
            ) : (
              <div className="manga-page__empty text-muted-foreground">
                <ImageIcon className="size-8 opacity-60" />
                <p>Chưa có ảnh trang</p>
              </div>
            )}
          </div>
        </div>

        {notes.length > 0 ? (
          <div className="rounded-xl border border-border/60 bg-background/50 p-3 dark:bg-zinc-900/60">
            <div className="mb-2 flex items-center gap-2">
              <StickyNote className="size-4 text-amber-500" />
              <p className="text-sm font-medium">Ghi chú Mangaka</p>
            </div>
            <ul className="space-y-2">
              {notes.map((note) => (
                <li
                  key={note.id ?? note.text}
                  className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm"
                >
                  <Badge variant="secondary" className="mb-1 text-xs">
                    {noteTaskLabel(note.taskType)}
                  </Badge>
                  <p>{note.text}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});
