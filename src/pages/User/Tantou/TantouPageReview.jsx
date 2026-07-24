import { TantouChapterReviewDashboard } from "@/components/Tantou/TantouChapterReviewDashboard";

/**
 * @param {import('@/components/Tantou/reviewTypes').TantouSubmission | null} props.submission
 * @param {import('@/components/Tantou/reviewTypes').TantouSubmission[]} [props.relatedSubmissions]
 * @param {import('@/components/Tantou/reviewTypes').TantouSubmission[]} [props.allSubmissions]
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
  if (!submission) return null;

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
