import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChapterRow } from "./reviewTypes";
import { cn } from "@/lib/utils";

type ChapterListTableProps = {
  rows: ChapterRow[];
  activeId: string;
  viewingId: string | null;
  onOpen: (id: string) => void;
};

function ChapterStatusBadge({ status }: { status: string }) {
  const approved = status === "approved_publish" || status === "forwarded_eb";
  return (
    <Badge
      variant={approved ? "secondary" : "outline"}
      className={cn(
        approved &&
          "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
      )}
    >
      {approved ? "Approved" : "Pending"}
    </Badge>
  );
}

export function ChapterListTable({
  rows,
  activeId,
  viewingId,
  onOpen,
}: ChapterListTableProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-card/40 p-4 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Danh sách chương</h3>
            <p className="text-xs text-muted-foreground">
              Bấm <strong className="font-medium">Mở</strong> chương — lật trang
              bằng mũi tên phía dưới ảnh
            </p>
          </div>
        </div>
        <Badge variant="outline">{rows.length}</Badge>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Chương</th>
              <th className="hidden px-3 py-2.5 font-medium sm:table-cell">
                Sent
              </th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/60">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Chưa có chapter trong series này.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isViewing = row.id === viewingId;
                const isReviewTarget = row.id === activeId;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "transition-colors",
                      isViewing && "bg-sky-500/10",
                      !isViewing && isReviewTarget && "bg-muted/30",
                      !isViewing && "hover:bg-muted/40",
                    )}
                  >
                    <td className="px-3 py-2.5 font-medium">{row.index}</td>
                    <td className="max-w-[140px] truncate px-3 py-2.5 sm:max-w-none">
                      {row.name}
                    </td>
                    <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
                      {row.releaseDate}
                    </td>
                    <td className="px-3 py-2.5">
                      <ChapterStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant={isViewing ? "default" : "outline"}
                        onClick={() => onOpen(row.id)}
                      >
                        {isViewing ? "Đang xem" : "Mở"}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
