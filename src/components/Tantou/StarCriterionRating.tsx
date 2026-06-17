import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RATING_MAX, clampRating } from "./reviewUtils";
import { cn } from "@/lib/utils";

const STAR_COUNT = 5;

type StarCriterionRatingProps = {
  label: string;
  labelVi: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
};

function ratingTone(value: number) {
  if (value >= 4.5) return "text-amber-400";
  if (value >= 3.5) return "text-orange-400";
  return "text-muted-foreground";
}

function StarGlyph({ score, value }: { score: number; value: number }) {
  const isFull = value >= score;
  const isHalf = !isFull && value >= score - 0.5;
  const tone = ratingTone(value);

  if (isFull) {
    return <Star className={cn("size-5 fill-current", tone)} />;
  }
  if (isHalf) {
    return (
      <span className="relative inline-block size-5 shrink-0">
        <Star className="size-5 text-muted-foreground/35" />
        <span className="absolute inset-0 w-1/2 overflow-hidden">
          <Star className={cn("size-5 fill-current", tone)} />
        </span>
      </span>
    );
  }
  return <Star className="size-5 text-muted-foreground/35" />;
}

export function StarCriterionRating({
  label,
  labelVi,
  hint,
  value,
  onChange,
}: StarCriterionRatingProps) {
  const displayValue = clampRating(value);
  const [scoreInput, setScoreInput] = useState(() =>
    displayValue > 0 ? String(displayValue) : "",
  );

  useEffect(() => {
    setScoreInput(displayValue > 0 ? String(displayValue) : "");
  }, [displayValue]);

  function commitScoreInput() {
    const raw = scoreInput.trim();
    if (raw === "") {
      onChange(0);
      setScoreInput("");
      return;
    }
    const next = clampRating(raw);
    onChange(next);
    setScoreInput(next > 0 ? String(next) : "");
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-border/80 bg-card/60 p-3 shadow-sm dark:bg-zinc-900/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-foreground">
            {label}
          </p>
          <p className="text-xs font-medium text-primary/90">{labelVi}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {hint}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={RATING_MAX}
            step={0.5}
            value={scoreInput}
            onChange={(e) => setScoreInput(e.target.value)}
            onBlur={commitScoreInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitScoreInput();
              }
            }}
            placeholder="0"
            className="h-8 w-14 border-border/80 bg-background/80 px-2 text-center text-sm font-semibold tabular-nums dark:bg-zinc-950"
            aria-label={`${labelVi} (0–${RATING_MAX})`}
          />
          <span className="text-xs text-muted-foreground">/ {RATING_MAX}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-0.5">
        {Array.from({ length: STAR_COUNT }, (_, index) => {
          const score = index + 1;
          const halfScore = score - 0.5;
          return (
            <div key={score} className="relative inline-flex shrink-0">
              <div className="pointer-events-none p-0.5">
                <StarGlyph score={score} value={displayValue} />
              </div>
              <button
                type="button"
                onClick={() => onChange(halfScore)}
                className="absolute inset-y-0 left-0 z-10 w-1/2 rounded-l-md"
                aria-label={`${labelVi} ${halfScore} sao`}
              />
              <button
                type="button"
                onClick={() => onChange(score)}
                className="absolute inset-y-0 right-0 z-10 w-1/2 rounded-r-md"
                aria-label={`${labelVi} ${score} sao`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
