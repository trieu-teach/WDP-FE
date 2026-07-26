import { BookOpen, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChapterRow } from "./reviewTypes";
import { cn } from "@/lib/utils";

type ChapterListTableProps = {
  rows: ChapterRow[];
  activeId: string;
  viewingId: string | null;
  loading?: boolean;
  onOpen: (id: string) => void;
};

function ChapterStatusBadge({ status }: { status: string }) {
  if (status === "scheduled") {
    return (
      <Badge
        variant="outline"
        className="border-sky-200 bg-sky-500/10 font-medium text-sky-800 dark:border-sky-500/30 dark:text-sky-200"
      >
        Đã lên lịch
      </Badge>
    );
  }
  if (status === "awaiting_publish") {
    return (
      <Badge
        variant="outline"
        className="border-violet-200 bg-violet-500/10 font-medium text-violet-800 dark:border-violet-500/30 dark:text-violet-200"
      >
        Chờ phát hành
      </Badge>
    );
  }
  const approved = status === "approved_publish" || status === "forwarded_eb";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        approved
          ? "border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300"
          : "border-amber-200 bg-amber-500/10 text-amber-800 dark:border-amber-500/30 dark:text-amber-200",
      )}
    >
      {approved ? "Đã duyệt" : "Chờ duyệt"}
    </Badge>
  );
}

export function ChapterListTable({
  rows,
  activeId,
  viewingId,
  loading = false,
  onOpen,
}: ChapterListTableProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-card/40 p-4 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-sky-600 dark:text-sky-400" />
          <h3 className="font-semibold text-foreground">Danh sách chương</h3>
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
                Ngày gửi
              </th>
              <th className="px-3 py-2.5 font-medium">Trạng thái</th>
              <th className="px-3 py-2.5 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/60">
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Đang tải chapter của truyện…
                </td>
              </tr>
            ) : rows.length === 0 ? (
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
                      isViewing &&
                        "bg-sky-500/10 ring-1 ring-inset ring-sky-400/30",
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
                      {isViewing ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/70 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-800 dark:border-sky-500/40 dark:text-sky-200">
                          <Eye className="size-3.5" />
                          Đang chọn
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => onOpen(row.id)}
                        >
                          Mở
                        </Button>
                      )}
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
