import React, { useEffect, useState } from "react";
import { getHistory } from "../api";

const BG      = "#F5F0E8";
const SURFACE = "#FFFFFF";
const BORDER  = "#E8E2D8";
const AMBER   = "#C9862A";
const TEXT    = "#1C1A17";
const TEXT_DIM  = "#7A7268";
const TEXT_MUTED = "#9A9080";
const GREEN   = "#22C55E";

type Log = {
  date: string; skill: string; did_practice: boolean;
  minutes: number; confidence: number; quiz_score: number | null; pace_status: string;
};

type Props = { learnerId: string; onBack: () => void };

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ConfidenceDots({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= value ? AMBER : BORDER }} />
      ))}
    </div>
  );
}

function ActivityCalendar({ activity, days = 28 }: { activity: string[]; days?: number }) {
  const actSet = new Set(activity);
  const today  = new Date();
  const cells: { date: string; iso: string }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), iso });
  }

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div>
      <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
        {dayLabels.map((l, i) => (
          <div key={i} style={{ width: 28, textAlign: "center", fontSize: 10, color: TEXT_MUTED, fontWeight: 600 }}>{l}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "flex", gap: 2, marginBottom: 2 }}>
          {week.map(cell => (
            <div
              key={cell.iso}
              title={cell.date}
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: actSet.has(cell.iso) ? AMBER : BORDER,
                opacity: actSet.has(cell.iso) ? 1 : 0.5,
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function HistoryPage({ learnerId, onBack }: Props) {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory(learnerId).then(d => { setData(d); setLoading(false); });
  }, [learnerId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "Playfair Display, serif", fontSize: 48, color: AMBER }}>♪</div>
      </div>
    );
  }

  const logs: Log[]          = data?.logs || [];
  const activity: string[]   = data?.week_activity || [];
  const streak: number       = data?.streak || 0;
  const readiness: number    = Math.round((data?.readiness || 0) * 100);
  const completed: number    = data?.completed || 0;
  const total: number        = data?.total || 0;
  const daysLeft: number     = data?.days_left || 0;

  return (
    <div style={{ minHeight: "100vh", background: BG }}>

      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 32px", background: SURFACE, display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={onBack}
          style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer", color: TEXT_DIM, fontSize: 13, padding: "6px 12px", fontFamily: "DM Sans, sans-serif" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.color = AMBER; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; }}
        >← Back</button>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 20, color: TEXT, margin: 0 }}>
          Practice History
        </h1>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px", display: "grid", gridTemplateColumns: "1fr 280px", gap: 28, alignItems: "start" }}>

        {/* Left: logs */}
        <div>
          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
            {[
              { label: "Readiness", value: `${readiness}%`, sub: `${daysLeft} days left`, color: AMBER },
              { label: "Skills done", value: `${completed}/${total}`, sub: "segments complete", color: TEXT },
              { label: "Streak", value: `${streak}🔥`, sub: "days in a row", color: TEXT },
            ].map(s => (
              <div key={s.label} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontFamily: "Playfair Display, serif", fontSize: 26, fontWeight: 900, color: s.color, marginBottom: 2 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: TEXT_MUTED }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Session log */}
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Session log</div>
          {logs.length === 0 ? (
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "32px", textAlign: "center", color: TEXT_MUTED, fontSize: 13 }}>
              No practice sessions yet. Complete your first lesson to see your history here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {logs.map((log, i) => {
                const quizPct  = log.quiz_score !== null ? Math.round(log.quiz_score * 100) : null;
                const isGood   = (log.confidence || 0) >= 4;
                return (
                  <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 16 }}>

                    {/* Date column */}
                    <div style={{ flexShrink: 0, width: 52, textAlign: "center", paddingTop: 2 }}>
                      <div style={{ fontFamily: "Playfair Display, serif", fontSize: 18, fontWeight: 700, color: AMBER, lineHeight: 1 }}>
                        {new Date(log.date + "T00:00:00").getDate()}
                      </div>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {new Date(log.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                      </div>
                    </div>

                    <div style={{ width: 1, alignSelf: "stretch", background: BORDER, flexShrink: 0 }} />

                    {/* Main content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6, lineHeight: 1.4 }}>
                        {log.skill.length > 80 ? log.skill.slice(0, 80) + "…" : log.skill}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        <ConfidenceDots value={log.confidence || 0} />
                        {quizPct !== null && (
                          <span style={{ fontSize: 11, background: quizPct === 100 ? "#F0FDF4" : quizPct >= 67 ? "rgba(201,134,42,0.1)" : "#FEF2F2", color: quizPct === 100 ? GREEN : quizPct >= 67 ? AMBER : "#EF4444", border: `1px solid ${quizPct === 100 ? "#86EFAC" : quizPct >= 67 ? AMBER : "#FECACA"}`, borderRadius: 5, padding: "2px 8px", fontWeight: 600 }}>
                            Quiz {quizPct}%
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: TEXT_MUTED }}>{log.minutes} min</span>
                        {log.pace_status && (
                          <span style={{ fontSize: 11, color: log.pace_status === "on_track" ? GREEN : log.pace_status === "behind" ? "#EF4444" : AMBER }}>
                            {log.pace_status === "on_track" ? "✦ On track" : log.pace_status === "behind" ? "◈ Behind" : "✸ Ahead"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: activity calendar */}
        <div style={{ position: "sticky", top: 24 }}>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>Activity — last 28 days</div>
            <ActivityCalendar activity={activity} />
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: AMBER }} />
              <span style={{ fontSize: 11, color: TEXT_DIM }}>Practice day</span>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: BORDER, marginLeft: 10 }} />
              <span style={{ fontSize: 11, color: TEXT_DIM }}>No practice</span>
            </div>
          </div>

          {/* Goal */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px", marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Goal</div>
            <div style={{ fontFamily: "Playfair Display, serif", fontSize: 15, color: TEXT, lineHeight: 1.4, marginBottom: 4 }}>{data?.goal_song}</div>
            <div style={{ fontSize: 12, color: TEXT_DIM }}>{data?.goal_event} · {daysLeft} days away</div>
            <div style={{ marginTop: 14, background: BORDER, borderRadius: 2, height: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${total ? (completed / total) * 100 : 0}%`, background: AMBER, transition: "width 0.6s ease", borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 6 }}>{readiness}% ready</div>
          </div>
        </div>
      </div>
    </div>
  );
}
