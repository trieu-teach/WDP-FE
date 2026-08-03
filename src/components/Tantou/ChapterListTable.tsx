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
        className="h-5 border-sky-200 bg-sky-50 px-1.5 text-[10px] font-medium text-sky-800"
      >
        Đã lên lịch
      </Badge>
    );
  }
  if (status === "awaiting_publish") {
    return (
      <Badge
        variant="outline"
        className="h-5 border-violet-200 bg-violet-50 px-1.5 text-[10px] font-medium text-violet-800"
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
        "h-5 px-1.5 text-[10px] font-medium",
        approved
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-800",
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
    <div className="rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <BookOpen className="size-3.5 text-sky-600" />
          <h3 className="text-xs font-semibold text-gray-900">Danh sách chương</h3>
        </div>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {rows.length}
        </Badge>
      </div>

      <div className="max-h-[120px] overflow-auto rounded-lg border border-gray-100 scrollbar-thin">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="sticky top-0 z-[1] bg-gray-50 text-left text-[10px] text-gray-500">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">#</th>
              <th className="px-2.5 py-1.5 font-medium">Chương</th>
              <th className="hidden px-2.5 py-1.5 font-medium sm:table-cell">
                Ngày gửi
              </th>
              <th className="px-2.5 py-1.5 font-medium">Trạng thái</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-2.5 py-4 text-center text-xs text-gray-500"
                >
                  Đang tải chapter của truyện…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-2.5 py-4 text-center text-xs text-gray-500"
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
                        "border-l-4 border-blue-600 bg-blue-50/70 font-medium text-blue-900",
                      !isViewing && isReviewTarget && "bg-gray-50",
                      !isViewing && "hover:bg-gray-50",
                    )}
                  >
                    <td className="px-2.5 py-1.5 text-xs">{row.index}</td>
                    <td className="max-w-[140px] truncate px-2.5 py-1.5 text-xs sm:max-w-none">
                      {row.name}
                    </td>
                    <td className="hidden px-2.5 py-1.5 text-xs text-gray-500 sm:table-cell">
                      {row.releaseDate}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <ChapterStatusBadge status={row.status} />
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      {isViewing ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                          <Eye className="size-3" />
                          Đang chọn
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
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
