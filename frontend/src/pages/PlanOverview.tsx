import React, { useEffect, useState } from "react";
import { getStatus } from "../api";

const BG      = "#F5F0E8";
const SURFACE = "#FFFFFF";
const BORDER  = "#E8E2D8";
const AMBER   = "#C9862A";
const AMBER_DIM = "rgba(201,134,42,0.10)";
const TEXT    = "#1C1A17";
const TEXT_DIM  = "#7A7268";

type Segment = { id: string; skill: string; target_date: string; status: string };
type Props   = { learnerId: string; onStart: () => void };

export default function PlanOverview({ learnerId, onStart }: Props) {
  const [status, setStatus]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStatus(learnerId).then((s) => { setStatus(s); setLoading(false); });
  }, [learnerId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "Playfair Display, serif", fontSize: 64, color: AMBER, animation: "sway 1.4s ease-in-out infinite" }}>♪</div>
        <p style={{ fontFamily: "Playfair Display, serif", fontSize: 18, color: TEXT }}>Preparing your plan...</p>
        <style>{`@keyframes sway { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(6deg)} }`}</style>
      </div>
    );
  }

  const segments: Segment[] = status?.segments || [];
  const learner  = status?.learner;
  const pace     = status?.pace || {};

  const sections: Segment[][] = [];
  for (let i = 0; i < segments.length; i += 2) sections.push(segments.slice(i, i + 2));

  const formatDate = (d: string) => d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "20px 40px", background: SURFACE, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 22, color: AMBER }}>Cadence</div>
        <div style={{ fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5 }}>Plan Overview</div>
      </div>

      <div style={{ flex: 1, maxWidth: 760, width: "100%", margin: "0 auto", padding: "48px 32px 80px" }}>

        {/* Welcome */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ fontFamily: "Playfair Display, serif", fontSize: 56, color: AMBER, lineHeight: 1, marginBottom: 20 }}>✦</div>
          <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 34, color: TEXT, margin: "0 0 12px", lineHeight: 1.15 }}>
            Welcome, {learner?.name}.<br />Your plan is ready.
          </h1>
          <p style={{ fontSize: 15, color: TEXT_DIM, lineHeight: 1.7, maxWidth: 480 }}>
            Here's your path to <span style={{ color: TEXT, fontWeight: 600 }}>{learner?.goal_song}</span> for{" "}
            <span style={{ color: TEXT }}>{learner?.goal_event}</span>.{" "}
            {pace.days_left > 0 ? `${pace.days_left} days to go.` : ""}
          </p>
        </div>

        {/* Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {sections.map((section, sIdx) => {
            const sectionStart = formatDate(section[0]?.target_date);
            const sectionEnd   = formatDate(section[section.length - 1]?.target_date);

            return (
              <div key={sIdx} style={{ display: "flex", gap: 0, marginBottom: 0 }}>
                {/* Timeline spine */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 52, flexShrink: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 6, background: sIdx === 0 ? AMBER : SURFACE, border: `1.5px solid ${sIdx === 0 ? AMBER : BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Playfair Display, serif", fontSize: 13, color: sIdx === 0 ? "#fff" : TEXT_DIM, flexShrink: 0 }}>
                    {sIdx + 1}
                  </div>
                  {sIdx < sections.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: BORDER, minHeight: 36 }} />
                  )}
                </div>

                {/* Section content */}
                <div style={{ flex: 1, paddingLeft: 14, paddingBottom: sIdx < sections.length - 1 ? 28 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4 }}>
                    <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5 }}>
                      Section {sIdx + 1}
                    </span>
                    {sectionStart && (
                      <span style={{ fontSize: 11, color: TEXT_DIM }}>
                        · {sectionStart}{sectionEnd !== sectionStart ? ` – ${sectionEnd}` : ""}
                      </span>
                    )}
                  </div>
                  {section.map((seg, i) => (
                    <div key={seg.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "11px 14px", marginBottom: i < section.length - 1 ? 6 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "Playfair Display, serif", fontSize: 14, color: AMBER }}>
                          {["♩", "♪", "♫", "♬"][(sIdx * 2 + i) % 4]}
                        </span>
                        <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 500, fontSize: 14, color: TEXT, flex: 1 }}>{seg.skill}</span>
                        {seg.target_date && (
                          <span style={{ fontSize: 11, color: TEXT_DIM, flexShrink: 0 }}>{formatDate(seg.target_date)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Final milestone */}
        <div style={{ marginTop: 28, background: AMBER_DIM, border: `1.5px solid ${AMBER}`, borderRadius: 10, padding: "16px 22px", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 28 }}>🎷</span>
          <div>
            <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 16, color: TEXT, marginBottom: 2 }}>{learner?.goal_song}</div>
            <div style={{ fontSize: 12, color: TEXT_DIM }}>Final goal · {pace.days_left} days away</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ position: "sticky", bottom: 0, borderTop: `1px solid ${BORDER}`, padding: "18px 40px", background: SURFACE, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onStart}
          style={{ padding: "13px 44px", borderRadius: 8, border: "none", background: AMBER, color: "#fff", fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1, transition: "opacity 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          Start Learning →
        </button>
      </div>
    </div>
  );
}
