import { TantouChapterReviewDashboard } from "@/components/Tantou/TantouChapterReviewDashboard";

/**
 * @file Eb/TantouPageReview.jsx
 * @description Trang wrapper cho dashboard review chapter của Tantou trong ngữ cảnh EB (編集).
 * Chỉ chuyển tiếp props xuống component dashboard, không thêm logic riêng.
 *
 * @param {Object} props
 * @param {import('@/components/Tantou/reviewTypes').TantouSubmission | null} props.submission - Submission chapter đang review
 * @param {import('@/components/Tantou/reviewTypes').TantouSubmission[]} [props.relatedSubmissions] - Danh sách submission liên quan
 * @param {import('@/components/Tantou/reviewTypes').TantouSubmission[]} [props.allSubmissions] - Tất cả submission để tham chiếu
 * @param {() => void} [props.onCancel] - Callback khi hủy review
 * @param {(payload: any) => void} [props.onSaveReview] - Callback khi lưu kết quả review
 * @param {(chapterId: string) => void} [props.onSelectChapter] - Callback chọn chapter khác
 * @param {boolean} [props.saving] - Cờ đang lưu để disable nút
 */
export default function TantouPageReview({
  submission,
  relatedSubmissions = [],
  allSubmissions = [],
  onCancel,
  onSaveReview,
  onSelectChapter,
  saving = false,
}) {
  // Không có submission thì không render gì cả
  if (!submission) return null;

  // Ủy quyền render hoàn toàn cho component dashboard Tantou
  return (
    <TantouChapterReviewDashboard
      submission={submission}
      relatedSubmissions={relatedSubmissions}
      allSubmissions={allSubmissions}
      onCancel={onCancel}
      onSaveReview={onSaveReview}
      onSelectChapter={onSelectChapter}
      saving={saving}
    />
  );
}