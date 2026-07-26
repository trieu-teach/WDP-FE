import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  History,
  Loader2,
  Users,
} from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ebEvaluationsService } from "@/api/ebEvaluations.service.js";
import { getApiErrorMessage } from "@/api/http.js";
import { getSession, logout } from "@/lib/auth.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_SCORE_CRITERIA,
  ebHistoryResultLabel,
  ebHistoryStatusLabel,
  mapEbHistoryDetailResponse,
} from "@/utils/ebEvaluationMappers.js";
import { cn } from "@/lib/utils";
import "./Eb.css";

const NAV_LINKS = [{ to: "/", label: "Trang chủ" }];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function ScoreBar({ label, value }) {
  const score = value != null ? Number(value) : null;
  const pct = score != null ? Math.min(100, Math.max(0, (score / 5) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {score != null ? score.toFixed(1) : "—"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-amber-500/80"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function EbHistoryDetail() {
  const { evaluationId } = useParams();
  const navigate = useNavigate();
  const user = getSession();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    ;(async () => {
      setLoading(true);
      try {
        const raw = await ebEvaluationsService.getHistoryDetail(evaluationId);
        if (cancelled) return;
        setDetail(mapEbHistoryDetailResponse(raw));
      } catch (err) {
        if (!cancelled) {
          toast.error(getApiErrorMessage(err, "Không tải được chi tiết evaluation."));
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [evaluationId]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const series = detail?.series;
  const cover = series?.coverImageUrl;

  return (
    <div className="eb-page flex min-h-screen flex-col bg-background">
      <Header
        navLinks={NAV_LINKS}
        userName={user?.name}
        userAvatar={user?.avatar}
        onLogout={handleLogout}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/eb/history">
              <ArrowLeft className="size-4" />
              Lịch sử
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <History className="size-5 text-amber-600" />
              Chi tiết lượt chấm
            </h1>
            <p className="text-sm text-muted-foreground">
              {LABEL_EDITOR_BOARD} evaluation detail
            </p>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="size-7 animate-spin" />
              Đang tải chi tiết...
            </CardContent>
          </Card>
        ) : !detail ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Không tìm thấy evaluation.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <Card className="border-border/70 shadow-none">
                <CardContent className="space-y-3 p-4">
                  <div className="aspect-[3/4] overflow-hidden rounded-lg bg-muted">
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <BookOpen className="size-8" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold leading-snug">
                      {series?.name ?? "Series"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Author: {series?.author?.name ?? "—"}
                    </p>
                  </div>
                  {series?.tags?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {series.tags.slice(0, 6).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Status: {series?.status ?? "—"}
                      {series?.isPublic ? ", Public" : ""}
                    </p>
                    <p>
                      Avg reader:{" "}
                      {series?.averageScore != null
                        ? `${Number(series.averageScore).toFixed(1)} / 5`
                        : "—"}
                      {series?.totalVotes != null
                        ? ` (${series.totalVotes} votes)`
                        : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-border/70 shadow-none">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">Điểm hội đồng</CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        {detail.evaluationType === "series" ? "Series" : "Chapter"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          detail.result === "approved" &&
                            "border-green-200 bg-green-50 text-green-700",
                        )}
                      >
                        {ebHistoryResultLabel(detail.result)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {ebHistoryStatusLabel(detail.status)}
                      </Badge>
                      {detail.firstReview ? (
                        <Badge className="bg-sky-600 text-[10px] text-white hover:bg-sky-600">
                          First review
                        </Badge>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <p className="text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
                        {detail.councilAverage != null
                          ? Number(detail.councilAverage).toFixed(2)
                          : "—"}
                      </p>
                      <div className="pb-1">
                        <p className="text-sm font-medium">
                          {detail.classificationText ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          / 5 · {detail.memberCount} members
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {EB_SCORE_CRITERIA.map((c) => (
                        <ScoreBar
                          key={c.key}
                          label={c.shortLabel}
                          value={detail.councilBreakdown?.[c.key]}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Evaluated {formatDate(detail.createdAt)}
                      {detail.evaluatedBy?.name
                        ? ` by ${detail.evaluatedBy.name}`
                        : ""}
                      {detail.lastSavedAt
                        ? ` · Last saved ${formatDate(detail.lastSavedAt)}`
                        : ""}
                      {detail.lastSavedBy?.name
                        ? ` by ${detail.lastSavedBy.name}`
                        : ""}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="size-4" />
                      Điểm từng thành viên
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {detail.memberScores.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Không có member_scores.
                      </p>
                    ) : (
                      detail.memberScores.map((member) => (
                        <div
                          key={`${member.memberId}-${member.memberName}`}
                          className="rounded-xl border border-border/60 bg-muted/10 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="size-9">
                              {member.memberAvatarUrl ? (
                                <AvatarImage src={member.memberAvatarUrl} alt="" />
                              ) : null}
                              <AvatarFallback className="bg-violet-600 text-xs text-white">
                                {String(member.memberName).slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold">
                                  {member.memberName}
                                </p>
                                {member.isEbRepresentative ? (
                                  <Badge className="bg-rose-600 text-[10px] text-white hover:bg-rose-600">
                                    Rep
                                  </Badge>
                                ) : null}
                                <Badge variant="secondary" className="text-[10px]">
                                  Avg{" "}
                                  {member.average != null
                                    ? Number(member.average).toFixed(1)
                                    : "—"}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {EB_SCORE_CRITERIA.map((c) => {
                                  const score = member.scores?.[c.key];
                                  if (score == null) return null;
                                  return (
                                    <Badge
                                      key={c.key}
                                      variant="outline"
                                      className="text-[11px] font-normal"
                                    >
                                      {c.shortLabel} {Number(score).toFixed(1)}
                                    </Badge>
                                  );
                                })}
                              </div>
                              {member.overallComment ? (
                                <p className="text-xs italic text-muted-foreground">
                                  “{member.overallComment}”
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {detail.relatedEvaluations.length > 0 ? (
              <Card className="border-border/70 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Evaluation khác cùng series
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {detail.relatedEvaluations.map((rel) => (
                    <Link
                      key={rel.evaluationId}
                      to={`/eb/history/${encodeURIComponent(rel.evaluationId)}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {rel.evaluationType === "chapter"
                            ? "Chapter review"
                            : "Series review"}
                          {" · "}
                          {ebHistoryResultLabel(rel.result)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(rel.lastSavedAt || rel.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {ebHistoryStatusLabel(rel.status)}
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
