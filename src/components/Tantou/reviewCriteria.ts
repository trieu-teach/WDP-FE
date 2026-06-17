import type { RatingKey } from "./reviewTypes";
import { isColoredSeries } from "./reviewUtils";
import type { TantouSubmission } from "./reviewTypes";

export type CriterionConfig = {
  key: RatingKey;
  label: string;
  labelVi: string;
  hint: string;
};

const BASE_CRITERIA: CriterionConfig[] = [
  {
    key: "pacingContent",
    label: "Pacing & Content",
    labelVi: "Diễn Biến & Nhịp Độ",
    hint: "Plot progression, dialogue logic, cliffhangers.",
  },
  {
    key: "layoutStoryboard",
    label: "Layout & Storyboarding",
    labelVi: "Bố Cục & Trải Nghiệm Đọc",
    hint: "Panel layout, readability, vertical scroll flow.",
  },
  {
    key: "localizationTech",
    label: "Localization & Technical",
    labelVi: "Chất Lượng Biên Tập & Dịch Thuật",
    hint: "Translation, typesetting, fonts, typos.",
  },
];

export function getReviewCriteria(
  submission: TantouSubmission | null,
): CriterionConfig[] {
  const colored = isColoredSeries(submission);
  const visual: CriterionConfig = {
    key: "visualArt",
    label: "Visual & Art / Writing Style",
    labelVi: "Chất Lượng Hình Ảnh / Văn Phong",
    hint: colored
      ? "Drawing quality, character design, coloring & lighting."
      : "Drawing quality, character design, screentone & shading.",
  };

  return [BASE_CRITERIA[0], visual, BASE_CRITERIA[1], BASE_CRITERIA[2]];
}
