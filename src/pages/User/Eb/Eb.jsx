import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Gavel, Star } from "lucide-react";
import Header from "@/components/User/Header/Header.jsx";
import Footer from "@/components/User/Footer/Footer.jsx";
import { WorkspaceHero } from "@/components/layout/WorkspaceHero.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSession, logout } from "@/lib/auth.js";
import {
  approveEbDebutSeries,
  readEbDebutApproved,
  readEbDebutPending,
} from "@/utils/ebDebutStorage.js";
import { updateSeriesEbAssessmentInWorkspace } from "@/utils/mangakaWorkspaceReader.js";
import { listTantouSubmissions } from "@/utils/tantouWorkspaceStorage.js";
import { placeholderPageDataUrl } from "@/utils/assistantWorkspaceStorage.js";
import { LABEL_EDITOR_BOARD } from "@/constants/roleTerminology.js";
import {
  EB_COUNCIL_MEMBERS,
  buildCouncilAggregate,
  readCouncilSeriesScores,
  saveCouncilMemberAssessment,
  seedCouncilDemoScores,
} from "@/utils/ebCouncilStorage.js";
import "./Eb.css";

const NAV_LINKS = [
  { to: "/", label: "Trang chủ" },
  { to: "/mangaka", label: "Mangaka" },
  { to: "/tantou", label: "Tantou Editor" },
];

const COMMON_CRITERIA = [
  {
    key: "plotDialogue",
    label: "Cốt truyện & Lời thoại",
    hint: "Plot & Dialogue",
  },
  {
    key: "artDesign",
    label: "Nét vẽ & Tạo hình nhân vật",
    hint: "Art Style & Character Design",
  },
  {
    key: "panelingCamera",
    label: "Phân khung & Góc máy",
    hint: "Paneling & Camera Angles",
  },
  { key: "pacingHook", label: "Nhịp độ & Cao trào", hint: "Pacing & Hook" },
];

const TYPE_CRITERIA = {
  color: { key: "coloring", label: "Đổ màu & Phối màu", hint: "Coloring" },
  mono: {
    key: "toneShading",
    label: "Sử dụng Tone/Đánh bóng",
    hint: "Screentone & Shading",
  },
};

const SCORE_MAX = 5;

function clampScore(value) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(SCORE_MAX, Math.max(0, parsed));
}

function validateScore(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Vui lòng nhập điểm.";
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed)) return "Điểm phải là số.";
  if (parsed < 0 || parsed > SCORE_MAX) {
    return `Điểm phải trong khoảng 0 - ${SCORE_MAX}.`;
  }
  const stepped = Math.round(parsed * 2) / 2;
  if (Math.abs(stepped - parsed) > 0.001) {
    return "Điểm chỉ nhận bước 0.5 (ví dụ: 3.5, 4.0, 4.5).";
  }
  return "";
}

function ScoreStars({ value }) {
  const safe = clampScore(value);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: SCORE_MAX }, (_, idx) => {
        const score = idx + 1;
        const isFull = safe >= score;
        const isHalf = !isFull && safe >= score - 0.5;
        return (
          <span key={score} className="relative inline-flex size-4">
            <Star className="size-4 text-muted-foreground/35" />
            {isFull ? (
              <Star className="absolute inset-0 size-4 fill-amber-400 text-amber-400" />
            ) : null}
            {isHalf ? (
              <span className="absolute inset-0 w-1/2 overflow-hidden">
                <Star className="size-4 fill-amber-400 text-amber-400" />
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function getClassification(average) {
  if (average < 2.5) {
    return {
      label: "KHÔNG ĐẠT",
      note: "Series chưa đạt chất lượng, cần chỉnh sửa lớn trước khi xét lại.",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (average < 3.5) {
    return {
      label: "ĐẠT",
      note: "Series có thể thông qua, nhưng cần cải thiện theo ghi chú.",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (average < 4.25) {
    return {
      label: "TỐT",
      note: "Chất lượng series ổn định, phù hợp duyệt nhanh.",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  return {
    label: "XUẤT SẮC",
    note: "Series chất lượng cao, phù hợp đẩy nổi bật/banner.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function buildScoreFields(scoreType) {
  const typeField = TYPE_CRITERIA[scoreType] ?? TYPE_CRITERIA.color;
  return [...COMMON_CRITERIA, typeField];
}

function buildInitialNotes() {
  return {
    plotDialogue: "",
    artDesign: "",
    panelingCamera: "",
    pacingHook: "",
    coloring: "",
    toneShading: "",
  };
}

function buildInitialScores() {
  return {
    plotDialogue: "0",
    artDesign: "0",
    panelingCamera: "0",
    pacingHook: "0",
    coloring: "0",
    toneShading: "0",
  };
}

function CouncilScoresTable({
  memberRows,
  scoreFields,
  criterionAverages,
  councilAverage,
  scoredCount,
  activeMemberId,
}) {
  return (
    <div className="eb-council-table-wrap overflow-x-auto rounded-xl border bg-card">
      <table className="eb-council-table w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">Thành viên HĐ</th>
            {scoreFields.map((field) => (
              <th key={field.key} className="px-2 py-2.5 font-medium">
                {field.hint}
              </th>
            ))}
            <th className="px-3 py-2.5 font-medium">DTB</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {memberRows.map((row) => {
            const isActive = row.id === activeMemberId;
            return (
              <tr
                key={row.id}
                className={isActive ? "bg-primary/5" : undefined}
              >
                <td className="px-3 py-2.5">
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.title}</p>
                  {isActive ? (
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      Đang nhập
                    </Badge>
                  ) : null}
                </td>
                {scoreFields.map((field) => (
                  <td
                    key={field.key}
                    className="px-2 py-2.5 text-center tabular-nums"
                  >
                    {row.scored ? (
                      <span className="inline-flex flex-col items-center gap-0.5">
                        <span className="font-medium">
                          {clampScore(row.scores?.[field.key]).toFixed(1)}
                        </span>
                        <ScoreStars value={row.scores?.[field.key]} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center font-semibold tabular-nums">
                  {row.scored ? row.average.toFixed(1) : "—"}
                </td>
              </tr>
            );
          })}
          <tr className="eb-council-table__avg border-t-2 bg-muted/25 font-medium">
            <td className="px-3 py-3">
              Trung bình Hội đồng
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {scoredCount}/{memberRows.length} thành viên đã chấm
              </span>
            </td>
            {scoreFields.map((field) => (
              <td
                key={field.key}
                className="px-2 py-3 text-center tabular-nums text-foreground"
              >
                {criterionAverages?.[field.key] != null
                  ? criterionAverages[field.key].toFixed(1)
                  : "—"}
              </td>
            ))}
            <td className="px-3 py-3 text-center text-base font-bold tabular-nums text-primary">
              {councilAverage.toFixed(1)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Eb() {
  const navigate = useNavigate();
  const user = getSession();
  const [councilTick, bumpCouncil] = useState(0);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [activeMemberId, setActiveMemberId] = useState(EB_COUNCIL_MEMBERS[0].id);
  const [scoreType, setScoreType] = useState("color");
  const [scores, setScores] = useState(buildInitialScores);
  const [criterionNotes, setCriterionNotes] = useState(buildInitialNotes);
  const [scoreErrors, setScoreErrors] = useState({
    plotDialogue: "",
    artDesign: "",
    panelingCamera: "",
    pacingHook: "",
    coloring: "",
    toneShading: "",
  });
  const refresh = useCallback(() => bumpCouncil((n) => n + 1), []);

  useEffect(() => {
    function onSync() {
      refresh();
    }
    window.addEventListener("mk-eb-pending-update", onSync);
    window.addEventListener("mk-eb-council-update", onSync);
    window.addEventListener("storage", onSync);
    window.addEventListener("mk-eb-approved-update", onSync);
    return () => {
      window.removeEventListener("mk-eb-pending-update", onSync);
      window.removeEventListener("mk-eb-council-update", onSync);
      window.removeEventListener("storage", onSync);
      window.removeEventListener("mk-eb-approved-update", onSync);
    };
  }, [refresh]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const approved = readEbDebutApproved();
  const pending = readEbDebutPending().filter(
    (p) => p?.title && !approved[p.title],
  );
  const approvedList = Object.keys(approved).filter((k) => approved[k]);
  const scoreFields = useMemo(() => buildScoreFields(scoreType), [scoreType]);
  const activeTitle = pending.some((item) => item.title === selectedTitle)
    ? selectedTitle
    : (pending[0]?.title ?? "");

  useEffect(() => {
    if (!activeTitle) return;
    if (!readCouncilSeriesScores(activeTitle)) {
      seedCouncilDemoScores(activeTitle, scoreType);
      refresh();
    }
  }, [activeTitle, scoreType, refresh]);

  const councilRecord = useMemo(
    () => (activeTitle ? readCouncilSeriesScores(activeTitle) : null),
    [activeTitle, councilTick],
  );

  useEffect(() => {
    if (!activeTitle) return;
    const record = readCouncilSeriesScores(activeTitle);
    if (record?.scoreType) setScoreType(record.scoreType);

    const memberEntry = record?.members?.[activeMemberId];
    if (memberEntry?.scores) {
      setScores((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(memberEntry.scores).map(([key, value]) => [
            key,
            Number(value).toFixed(1),
          ]),
        ),
      }));
      setCriterionNotes((current) => ({
        ...current,
        ...(memberEntry.criterionNotes ?? {}),
      }));
      setScoreErrors({
        plotDialogue: "",
        artDesign: "",
        panelingCamera: "",
        pacingHook: "",
        coloring: "",
        toneShading: "",
      });
      return;
    }

    setScores(buildInitialScores());
    setCriterionNotes(buildInitialNotes());
    setScoreErrors({
      plotDialogue: "",
      artDesign: "",
      panelingCamera: "",
      pacingHook: "",
      coloring: "",
      toneShading: "",
    });
  }, [activeTitle, activeMemberId, councilTick]);
  const activeTantouSubmission =
    listTantouSubmissions().find(
      (submission) => submission.seriesTitle === activeTitle,
    ) ?? null;
  const activeSeriesImage =
    activeTantouSubmission?.mangakaImageUrl ||
    placeholderPageDataUrl(
      activeTitle ? `${activeTitle} · Tantou` : "Chưa chọn series",
    );
  const average = useMemo(() => {
    const total = scoreFields.reduce(
      (sum, field) => sum + clampScore(scores[field.key]),
      0,
    );
    return scoreFields.length ? total / scoreFields.length : 0;
  }, [scoreFields, scores]);
  const classification = getClassification(average);
  const councilAggregate = useMemo(() => {
    const keys = scoreFields.map((field) => field.key);
    return buildCouncilAggregate(councilRecord, keys);
  }, [councilRecord, scoreFields]);
  const councilClassification = getClassification(councilAggregate.councilAverage);
  const activeMember = EB_COUNCIL_MEMBERS.find((m) => m.id === activeMemberId);

  function updateScore(key, value) {
    setScores((current) => ({ ...current, [key]: value }));
    setScoreErrors((current) => ({ ...current, [key]: validateScore(value) }));
  }

  function normalizeScoreField(key) {
    const nextValue = clampScore(scores[key]).toFixed(1);
    setScores((current) => ({ ...current, [key]: nextValue }));
    setScoreErrors((current) => ({ ...current, [key]: validateScore(nextValue) }));
  }

  function updateCriterionNote(key, value) {
    setCriterionNotes((current) => ({ ...current, [key]: value }));
  }

  function handleApprove(title) {
    approveEbDebutSeries(title);
    toast.success(`Đã chấp nhận "${title}".`);
    refresh();
  }

  function handleSaveAssessment() {
    if (!activeTitle) {
      toast.error("Chưa có chapter trong hàng chờ để chấm điểm.");
      return;
    }

    const nextErrors = Object.fromEntries(
      scoreFields.map((field) => [field.key, validateScore(scores[field.key])]),
    );
    setScoreErrors((current) => ({ ...current, ...nextErrors }));
    const hasInvalid = Object.values(nextErrors).some(Boolean);
    if (hasInvalid) {
      toast.error("Có tiêu chí chưa hợp lệ. Vui lòng kiểm tra lại điểm.");
      return;
    }

    const criterionDetails = scoreFields.map((field) => ({
      key: field.key,
      label: field.label,
      hint: field.hint,
      score: clampScore(scores[field.key]),
      note: criterionNotes[field.key] || "",
    }));
    const summaryNotes = criterionDetails
      .filter((criterion) => criterion.note.trim())
      .map((criterion) => `${criterion.label}: ${criterion.note.trim()}`);

    saveCouncilMemberAssessment(activeTitle, activeMemberId, {
      scoreType,
      scores: Object.fromEntries(
        criterionDetails.map((criterion) => [criterion.key, criterion.score]),
      ),
      criterionNotes: { ...criterionNotes },
      average: Number(average.toFixed(1)),
      assessedAt: new Date().toISOString(),
      enteredBy: user?.name ?? "Đại diện EB",
    });

    const updatedRecord = readCouncilSeriesScores(activeTitle);
    const keys = scoreFields.map((field) => field.key);
    const aggregate = buildCouncilAggregate(updatedRecord, keys);
    const councilClass = getClassification(aggregate.councilAverage);

    const memberAssessments = aggregate.memberRows
      .filter((row) => row.scored)
      .map((row) => ({
        memberId: row.id,
        memberName: row.name,
        memberTitle: row.title,
        average: row.average,
        scores: row.scores,
        assessedAt: row.assessedAt,
        enteredBy: row.enteredBy,
      }));

    updateSeriesEbAssessmentInWorkspace(activeTitle, {
      seriesTitle: activeTitle,
      chapterNum: activeTantouSubmission?.chapterNum ?? null,
      scoreType,
      average: aggregate.councilAverage,
      councilAverage: aggregate.councilAverage,
      memberAverage: Number(average.toFixed(1)),
      activeMemberId,
      activeMemberName: activeMember?.name ?? null,
      classification: councilClass.label,
      classificationNote: councilClass.note,
      scores: aggregate.criterionAverages,
      criteria: scoreFields.map((field) => ({
        key: field.key,
        label: field.label,
        hint: field.hint,
        score: aggregate.criterionAverages[field.key] ?? 0,
        note: "",
      })),
      memberAssessments,
      councilScoredCount: aggregate.scoredCount,
      councilMemberCount: EB_COUNCIL_MEMBERS.length,
      summaryNotes,
      source: "eb-council",
      assessedAt: new Date().toISOString(),
      enteredBy: user?.name ?? "Đại diện EB",
    });

    refresh();
    toast.success(
      `Đã lưu điểm ${activeMember?.name ?? "thành viên"} · DTB HĐ ${aggregate.councilAverage.toFixed(1)} (${aggregate.scoredCount}/${EB_COUNCIL_MEMBERS.length})`,
    );
  }

  return (
    <div className="ws-page--eb flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <WorkspaceHero
        label={`${LABEL_EDITOR_BOARD} · demo`}
        title={`Xin chào${user?.name ? `, ${user.name}` : ""}`}
        description="Một tài khoản đại diện nhập điểm từng thành viên — bảng tổng hợp hiển thị đầy đủ điểm Hội đồng."
        className="ws-hero--eb"
      />

      <main className="page-container flex-1 space-y-8 py-8">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>Nhập điểm (tài khoản đại diện)</CardTitle>
              <CardDescription>
                Đại diện Hội đồng nhập điểm cho từng thành viên. Bảng bên dưới
                luôn hiển thị đủ điểm của cả Hội đồng và DTB chung.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="eb-rep-banner rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">
                  Tài khoản đại diện:{" "}
                  <span className="text-primary">
                    {user?.name ?? "Thư ký Hội đồng"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chọn thành viên HĐ, nhập điểm thay họ, rồi lưu — có thể lần
                  lượt nhập cho từng người trong cùng series.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Series đang chấm</Label>
                  <Select
                    value={activeTitle || undefined}
                    onValueChange={setSelectedTitle}
                    disabled={pending.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          pending.length
                            ? "Chọn series trong hàng chờ"
                            : "Chưa có series chờ EB duyệt"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {pending.map((item) => (
                        <SelectItem key={item.title} value={item.title}>
                          {item.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pending.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Hàng chờ lấy từ localStorage (demo). Mangaka gửi series debut qua
                      Tantou → EB sẽ thấy ở đây. Chưa nối API{" "}
                      <code className="text-[10px]">/submissions/eb</code>.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Loại truyện</Label>
                  <Select value={scoreType} onValueChange={setScoreType}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn loại truyện" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="color">Truyện màu</SelectItem>
                      <SelectItem value="mono">Truyện không màu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Thành viên đang nhập điểm</Label>
                <Select value={activeMemberId} onValueChange={setActiveMemberId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn thành viên Hội đồng" />
                  </SelectTrigger>
                  <SelectContent>
                    {EB_COUNCIL_MEMBERS.map((member) => {
                      const scored = councilAggregate.memberRows.find(
                        (row) => row.id === member.id,
                      )?.scored;
                      return (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                          {scored ? " · đã chấm" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {activeMember ? (
                  <p className="text-xs text-muted-foreground">
                    {activeMember.title} — DTB cá nhân tạm tính:{" "}
                    <strong className="text-foreground">
                      {average.toFixed(1)}
                    </strong>
                  </p>
                ) : null}
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Điểm các thành viên Hội đồng
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Hiển thị đầy đủ điểm đã lưu của từng thành viên và trung
                    bình chung.
                  </p>
                </div>
                <CouncilScoresTable
                  memberRows={councilAggregate.memberRows}
                  scoreFields={scoreFields}
                  criterionAverages={councilAggregate.criterionAverages}
                  councilAverage={councilAggregate.councilAverage}
                  scoredCount={councilAggregate.scoredCount}
                  activeMemberId={activeMemberId}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {scoreFields.map((field) => (
                  <div
                    key={field.key}
                    className="space-y-3 rounded-xl border bg-card p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {clampScore(scores[field.key]).toFixed(1)} / {SCORE_MAX}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {field.hint}
                      </p>
                      <ScoreStars value={scores[field.key]} />
                    </div>
                    <Input
                      id={field.key}
                      type="number"
                      min="0"
                      max={String(SCORE_MAX)}
                      step="0.5"
                      value={scores[field.key]}
                      onChange={(event) =>
                        updateScore(field.key, event.target.value)
                      }
                      onBlur={() => normalizeScoreField(field.key)}
                      aria-invalid={Boolean(scoreErrors[field.key])}
                    />
                    {scoreErrors[field.key] ? (
                      <p className="text-xs text-red-600">{scoreErrors[field.key]}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Nhập điểm từ 0 đến {SCORE_MAX}, bước 0.5.
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label
                        htmlFor={`${field.key}-note`}
                        className="text-xs text-muted-foreground"
                      >
                        Ghi chú riêng cho tiêu chí này
                      </Label>
                      <Textarea
                        id={`${field.key}-note`}
                        value={criterionNotes[field.key]}
                        onChange={(event) =>
                          updateCriterionNote(field.key, event.target.value)
                        }
                        placeholder="Nhận xét ngắn cho tiêu chí này..."
                        className="min-h-20"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  DTB Hội đồng (tổng hợp)
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-4xl font-bold tracking-tight text-foreground">
                    {councilAggregate.councilAverage.toFixed(1)}
                  </div>
                  <Badge variant="outline">/ {SCORE_MAX}.0</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {councilAggregate.scoredCount}/{EB_COUNCIL_MEMBERS.length} thành
                  viên đã chấm
                  {activeMember ? (
                    <>
                      {" "}
                      · Đang nhập cho{" "}
                      <strong className="text-foreground">
                        {activeMember.name}
                      </strong>{" "}
                      (DTB {average.toFixed(1)})
                    </>
                  ) : null}
                </p>
                <Badge
                  variant="secondary"
                  className={`mt-3 border ${councilClassification.className}`}
                >
                  {councilClassification.label}
                </Badge>
                <p className="mt-3 text-sm text-muted-foreground">
                  {councilClassification.note}
                </p>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>Dưới 2.5 điểm</span>
                    <span className="font-medium text-red-700">KHÔNG ĐẠT</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Từ 2.5 đến dưới 3.5 điểm</span>
                    <span className="font-medium text-amber-700">ĐẠT</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Từ 3.5 đến dưới 4.25 điểm</span>
                    <span className="font-medium text-sky-700">TỐT</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Từ 4.25 đến 5.0 điểm</span>
                    <span className="font-medium text-emerald-700">
                      XUẤT SẮC
                    </span>
                  </div>
                </div>

                <Button className="mt-4 w-full" onClick={handleSaveAssessment}>
                  Lưu điểm thành viên đang chọn
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Ảnh series từ Tantou</CardTitle>
              <CardDescription>
                Hình preview của series đang được chấm, lấy trực tiếp từ
                submission Tantou.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-muted/30">
                <img
                  src={activeSeriesImage}
                  alt={
                    activeTitle
                      ? `Ảnh series ${activeTitle}`
                      : "Ảnh series đang chấm"
                  }
                  className="h-[520px] w-full object-cover"
                />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Tantou gửi sang EB</Badge>
                  {activeTantouSubmission?.chapterNum ? (
                    <Badge variant="outline">
                      Ch. {activeTantouSubmission.chapterNum}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {activeTitle || "Chưa có series trong hàng chờ"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeTantouSubmission?.pageLabel ??
                    "Ảnh đang hiển thị là bản gửi từ Tantou hoặc ảnh thay thế nếu chưa có submission tương ứng."}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Gavel className="size-5 text-primary" />
              Hàng chờ duyệt
            </h2>
            <p className="text-sm text-muted-foreground">
              Đồng bộ từ{" "}
              <Link
                to="/mangaka"
                className="font-medium text-primary hover:underline"
              >
                Mangaka
              </Link>
              {" / "}
              <Link
                to="/tantou"
                className="font-medium text-primary hover:underline"
              >
                Tantou
              </Link>
            </p>
          </div>

          {pending.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Không có series lần đầu trong hàng chờ.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pending.map((p) => (
                <Card
                  key={p.id ?? p.title}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{p.title}</h3>
                        <Badge variant="secondary">✦ Lần đầu</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[
                          p.genres?.slice(0, 2).join(" · "),
                          p.formatLabel?.replace(/\s*\(.*\)$/, ""),
                          p.authorName,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Button onClick={() => handleApprove(p.title)}>
                      <CheckCircle2 className="size-4" />
                      Chấp nhận
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {approvedList.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Đã chấp nhận</h2>
            <div className="flex flex-wrap gap-2">
              {approvedList.map((title) => (
                <Badge key={title} variant="outline" className="px-3 py-1">
                  {title}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
