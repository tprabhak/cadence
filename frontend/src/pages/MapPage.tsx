import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { getStatus, seedDemoHistory } from "../api";

const BG       = "#F5F0E8";
const SURFACE  = "#FFFFFF";
const BORDER   = "#E8E2D8";
const AMBER    = "#C9862A";
const TEXT     = "#1C1A17";
const TEXT_DIM = "#7A7268";
const TEXT_MUTED = "#9A9080";

type Segment = { id: string; skill: string; target_date: string; status: string; confidence: number; };
type Props   = {
  learnerId: string;
  onStartLesson: (id: string, skill: string) => void;
  onAdmin?: () => void;
  onHistory?: () => void;
};

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MapPage({ learnerId, onStartLesson, onAdmin, onHistory }: Props) {
  const [status, setStatus]             = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [replanBanner, setReplanBanner] = useState<any>(null);
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [showCard, setShowCard]         = useState(false);
  const [seeding, setSeeding]           = useState(false);
  const [seeded, setSeeded]             = useState(false);
  const isDev = window.location.hostname === "localhost";

  useEffect(() => {
    getStatus(learnerId).then((s) => {
      setStatus(s);
      setLoading(false);
      if (s?.unseen_replan) setReplanBanner(s.unseen_replan);
      // Auto-open the section containing the current segment
      const segs: Segment[] = s?.segments || [];
      const idx = segs.findIndex((sg: Segment) => sg.status === "in_progress" || sg.status === "not_started");
      if (idx >= 0) setOpenSections(new Set([Math.floor(idx / 2)]));
    });
  }, [learnerId]);

  const toggleSection = (idx: number) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG }}>
        <style>{`@keyframes shimmer { 0%,100%{opacity:0.45} 50%{opacity:0.9} }`}</style>
        <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "20px 32px", background: SURFACE }}>
          <div style={{ width: 120, height: 12, borderRadius: 4, background: BORDER, marginBottom: 8, animation: "shimmer 1.4s ease-in-out infinite" }} />
          <div style={{ width: 280, height: 20, borderRadius: 4, background: BORDER, animation: "shimmer 1.4s ease-in-out infinite 0.1s" }} />
        </div>
        <div style={{ padding: "32px" }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 64, borderRadius: 10, background: BORDER, marginBottom: 10, animation: `shimmer 1.4s ease-in-out infinite ${i * 0.12}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const segments: Segment[]  = status?.segments || [];
  const learner              = status?.learner;
  const pace                 = status?.pace || {};
  const streak               = status?.streak || 0;
  const hearts               = status?.hearts ?? 5;
  const weekActivity: string[] = status?.week_activity || [];
  const units: Segment[][] = [];
  for (let i = 0; i < segments.length; i += 2) units.push(segments.slice(i, i + 2));

  const currentIdx  = segments.findIndex(s => s.status === "in_progress" || s.status === "not_started");
  const completed   = segments.filter(s => s.status === "complete").length;
  const readinessPct = Math.round((pace.readiness_estimate || 0) * 100);
  const planVersion  = status?.plan_version || 1;

  const SECTION_TITLES = [
    "Foundations", "Core Skills", "Melody & Tone", "Rhythm & Timing",
    "Expression", "Refinement", "Performance Prep", "Final Push",
  ];

  // Last 7 days streak dots
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const actSet = new Set(weekActivity);

  return (
    <Layout streak={streak} hearts={hearts} onAdmin={onAdmin} rightPanel={
      <div>
        {/* Goal */}
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Goal</div>
          <div style={{ fontFamily: "Playfair Display, serif", fontSize: 15, color: TEXT, marginBottom: 4, lineHeight: 1.4 }}>{learner?.goal_song}</div>
          <div style={{ fontSize: 12, color: TEXT_DIM }}>{learner?.goal_event} · {pace.days_left}d away</div>
        </div>

        {/* Readiness — clickable */}
        <button onClick={() => setShowCard(true)} style={{ width: "100%", textAlign: "left", background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12, cursor: "pointer", transition: "border-color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = AMBER}
          onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Readiness · tap to share ↗</div>
          <div style={{ fontFamily: "Playfair Display, serif", fontSize: 28, color: AMBER, marginBottom: 8 }}>{readinessPct}%</div>
          <div style={{ background: BORDER, borderRadius: 2, height: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${segments.length ? (completed / segments.length) * 100 : 0}%`, background: AMBER, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 6 }}>{completed}/{segments.length} skills complete</div>
        </button>

        {/* Streak dots — last 7 days */}
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>This week</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {last7.map((iso, i) => {
              const label = new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1);
              const practiced = actSet.has(iso);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", aspectRatio: "1", borderRadius: 6, background: practiced ? AMBER : BORDER, opacity: practiced ? 1 : 0.5 }} />
                  <span style={{ fontSize: 9, color: TEXT_MUTED, fontWeight: 600 }}>{label}</span>
                </div>
              );
            })}
          </div>
          {streak > 0 && <div style={{ fontSize: 11, color: AMBER, marginTop: 8, fontWeight: 600 }}>🔥 {streak}-day streak</div>}
        </div>

        {/* Plan Intelligence card */}
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Plan Intelligence
            {planVersion > 1 && (
              <span style={{ marginLeft: 8, background: AMBER, color: "#fff", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                v{planVersion} adapted
              </span>
            )}
          </div>
          {[
            { icon: "◈", label: "Watches confidence",  sub: "After every lesson" },
            { icon: "↑", label: "Adds challenge",       sub: "When you're ahead" },
            { icon: "↓", label: "Adds support",         sub: "When you fall behind" },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <span style={{ fontSize: 13, color: AMBER, width: 16, flexShrink: 0, textAlign: "center" }}>{row.icon}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontSize: 11, color: TEXT_DIM, marginLeft: 6 }}>{row.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* History button */}
        {onHistory && (
          <button onClick={onHistory}
            style={{ width: "100%", background: "none", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "border-color 0.2s", marginBottom: 8 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = AMBER}
            onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
          >
            <span style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>Practice History</span>
            <span style={{ fontSize: 16, color: AMBER }}>→</span>
          </button>
        )}

        {/* Demo seed button — dev only */}
        {isDev && (
          <button
            onClick={async () => {
              const key = process.env.REACT_APP_ADMIN_SECRET || "";
              setSeeding(true);
              try {
                await seedDemoHistory(learnerId, key);
                setSeeded(true);
              } finally {
                setSeeding(false);
              }
            }}
            disabled={seeding || seeded}
            style={{ width: "100%", background: seeded ? "#F0FDF4" : "none", border: `1px dashed ${seeded ? "#86EFAC" : BORDER}`, borderRadius: 10, padding: "11px 16px", cursor: seeded ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: seeding ? 0.6 : 1 }}
          >
            <span style={{ fontSize: 12, color: seeded ? "#16A34A" : TEXT_DIM, fontWeight: 600 }}>
              {seeded ? "✓ Demo history seeded" : seeding ? "Seeding…" : "⚡ Seed demo history"}
            </span>
            {!seeded && <span style={{ fontSize: 11, color: TEXT_MUTED }}>dev only</span>}
          </button>
        )}
      </div>
    }>
      {/* Replan banner */}
      {replanBanner && (
        <>
          <style>{`@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <div style={{ background: "#FFFBEB", border: `1px solid ${AMBER}`, borderLeft: `4px solid ${AMBER}`, padding: "14px 20px 14px 18px", display: "flex", alignItems: "flex-start", gap: 14, animation: "slideDown 0.3s ease" }}>
            <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1, color: AMBER }}>◈</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: TEXT, marginBottom: 3 }}>Your plan was updated</div>
              <div style={{ fontSize: 12, color: TEXT_DIM, lineHeight: 1.5 }}>
                {{
                  behind_pace:    "You were falling behind — the plan was compressed to keep your deadline in reach.",
                  ahead_of_pace:  "You're ahead of schedule — the plan was extended with more challenging material.",
                  low_confidence: "Your recent confidence scores were low — a remediation step was added before you move on.",
                }[replanBanner.reason as string] ?? `Reason: ${replanBanner.reason}`}
                {replanBanner.old_segment_count !== replanBanner.new_segment_count && (
                  <span style={{ marginLeft: 6, color: AMBER, fontWeight: 600 }}>
                    ({replanBanner.old_segment_count} → {replanBanner.new_segment_count} segments)
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => setReplanBanner(null)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: TEXT_DIM, padding: 4, lineHeight: 1 }}>✕</button>
          </div>
        </>
      )}

      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "24px 32px", background: SURFACE }}>
        <p style={{ margin: 0, fontSize: 14, color: TEXT_DIM, marginBottom: 6 }}>
          { ({on_track: "On track ✦", behind: "Behind pace ◈", ahead: "Ahead of schedule ✸"} as any)[pace.pace_status] || "" }
        </p>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 22, color: TEXT, margin: 0 }}>
          Here's your path to <span style={{ color: AMBER }}>{learner?.goal_song}</span> for {learner?.goal_event}.{" "}
          <span style={{ color: TEXT_DIM, fontWeight: 400, fontSize: 18 }}>{pace.days_left} days to go.</span>
        </h1>
      </div>

      {/* Accordion sections */}
      <div style={{ padding: "28px 32px 60px" }}>
        {units.map((unit, unitIdx) => {
          const globalStart = unitIdx * 2;
          const unitDone    = unit.every(s => s.status === "complete");
          const hasCurrentSeg = unit.some((_, li) => globalStart + li === currentIdx);
          const isOpen      = openSections.has(unitIdx);
          const dateStart   = unit[0]?.target_date ? fmtDate(unit[0].target_date) : "";
          const dateEnd     = unit[unit.length - 1]?.target_date ? fmtDate(unit[unit.length - 1].target_date) : "";
          const dateRange   = dateStart === dateEnd ? dateStart : `${dateStart} – ${dateEnd}`;

          return (
            <div key={unitIdx} style={{ marginBottom: 10, border: `1px solid ${unitDone ? AMBER : hasCurrentSeg ? AMBER : BORDER}`, borderRadius: 12, overflow: "hidden", transition: "border-color 0.3s ease" }}>

              {/* Section header — clickable */}
              <button
                onClick={() => toggleSection(unitIdx)}
                style={{ width: "100%", background: unitDone ? "rgba(201,134,42,0.06)" : SURFACE, border: "none", cursor: "pointer", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}
              >
                {/* Number badge */}
                <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: unitDone ? AMBER : hasCurrentSeg ? "#2C2820" : "#E8E2D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: unitDone ? "#fff" : hasCurrentSeg ? "#EDE8DC" : TEXT_MUTED }}>
                  {unitDone ? "✦" : unitIdx + 1}
                </div>

                {/* Title + date */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3 }}>
                    Section {unitIdx + 1} · {dateRange}
                    {unitDone && <span style={{ marginLeft: 8, color: AMBER }}>· Complete ✦</span>}
                    {hasCurrentSeg && !unitDone && <span style={{ marginLeft: 8, color: AMBER, fontWeight: 700 }}>· Up next</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: unitDone ? AMBER : TEXT }}>
                    {SECTION_TITLES[unitIdx] || `Section ${unitIdx + 1}`}
                  </div>
                </div>

                {/* Chevron */}
                <span style={{ fontSize: 18, color: TEXT_MUTED, transition: "transform 0.2s ease", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>›</span>
              </button>

              {/* Skill list — shown when open */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${BORDER}` }}>
                  {unit.map((seg, localIdx) => {
                    const gIdx      = globalStart + localIdx;
                    const isCurrent = gIdx === currentIdx;
                    const isDone    = seg.status === "complete";
                    const isLocked  = !isDone && !isCurrent && gIdx > currentIdx;

                    return (
                      <div
                        key={seg.id}
                        style={{
                          padding: "14px 20px",
                          borderBottom: localIdx < unit.length - 1 ? `1px solid ${BORDER}` : "none",
                          display: "flex", alignItems: "flex-start", gap: 14,
                          background: isCurrent ? "rgba(201,134,42,0.04)" : "transparent",
                        }}
                      >
                        {/* Note icon */}
                        <span style={{ fontSize: 16, color: isDone ? AMBER : isLocked ? TEXT_MUTED : AMBER, marginTop: 2, flexShrink: 0 }}>♪</span>

                        {/* Skill text */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, color: isLocked ? TEXT_MUTED : TEXT, lineHeight: 1.5 }}>{seg.skill}</div>
                        </div>

                        {/* Date + action */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                          <div style={{ fontSize: 11, color: TEXT_MUTED }}>{seg.target_date ? fmtDate(seg.target_date) : ""}</div>
                          {isDone && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                              <span style={{ fontSize: 11, color: AMBER, fontWeight: 600 }}>✦ Done</span>
                              <button
                                onClick={() => onStartLesson(seg.id, seg.skill)}
                                style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, color: TEXT_MUTED, cursor: "pointer" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.color = AMBER; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_MUTED; }}
                              >Review</button>
                            </div>
                          )}
                          {isCurrent && (
                            <button
                              onClick={() => onStartLesson(seg.id, seg.skill)}
                              style={{ background: AMBER, color: "#fff", border: "none", borderRadius: 7, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3 }}
                            >
                              Start →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Readiness card modal */}
      {showCard && (
        <div
          onClick={() => setShowCard(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(28,26,23,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: BG, borderRadius: 16, padding: "40px 44px", maxWidth: 400, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", position: "relative" }}>
            <button onClick={() => setShowCard(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", fontSize: 18, color: TEXT_MUTED }}>✕</button>

            <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Cadence · Practice Progress</div>
            <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 72, color: AMBER, lineHeight: 1, marginBottom: 4 }}>{readinessPct}%</div>
            <div style={{ fontFamily: "Playfair Display, serif", fontSize: 14, color: TEXT_DIM, marginBottom: 24 }}>ready</div>

            <div style={{ fontFamily: "Playfair Display, serif", fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 6, lineHeight: 1.3 }}>{learner?.goal_song}</div>
            <div style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 28 }}>{learner?.goal_event} · {pace.days_left} days away</div>

            <div style={{ background: BORDER, borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${segments.length ? (completed / segments.length) * 100 : 0}%`, background: AMBER, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 32 }}>{completed} of {segments.length} skills complete</div>

            <button
              onClick={() => {
                const text = `I'm ${readinessPct}% ready to play "${learner?.goal_song}" for ${learner?.goal_event} — ${pace.days_left} days to go. Practicing with Cadence.`;
                navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard!"));
              }}
              style={{ width: "100%", background: AMBER, color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif", letterSpacing: 0.5 }}
            >
              Copy to share
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
