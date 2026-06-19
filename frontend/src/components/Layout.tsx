import React from "react";
import BreathBar from "./BreathBar";

// Sidebar stays dark — content area is light
const SIDEBAR    = "#1C1A17";
const SIDEBAR_B  = "#2A2520";
const AMBER      = "#C9862A";
const AMBER_DIM  = "rgba(201,134,42,0.14)";
const S_TEXT     = "#EDE8DC";   // cream on dark sidebar
const S_DIM      = "#7A6E60";   // muted on dark sidebar

// Right panel / content
const WHITE      = "#FFFFFF";
const BG         = "#F5F0E8";
const BORDER     = "#E8E2D8";
const TEXT_DIM   = "#7A7268";

const NAV = [
  { emoji: "♫", label: "Learn", active: true },
];


type Props = {
  streak: number;
  hearts: number;
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  onAdmin?: () => void;
};

export default function Layout({ streak, hearts, children, rightPanel, onAdmin }: Props) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: BG }}>

      {/* Left sidebar — stays dark */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: `1px solid ${SIDEBAR_B}`,
        background: SIDEBAR,
        position: "sticky", top: 0, height: "100vh",
        display: "flex", flexDirection: "column", padding: "28px 16px",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 40, paddingLeft: 8 }}>
          <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 22, color: AMBER, letterSpacing: -0.5 }}>
            Cadence
          </div>
          <div style={{ fontSize: 11, color: S_DIM, marginTop: 2, letterSpacing: 1, textTransform: "uppercase" }}>
            Tenor Sax Studio
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((item) => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px", borderRadius: 8, cursor: "pointer",
              background: item.active ? AMBER_DIM : "transparent",
              borderLeft: item.active ? `2px solid ${AMBER}` : "2px solid transparent",
              transition: "all 0.2s ease",
            }}>
              <span style={{ fontSize: 16, color: item.active ? AMBER : S_DIM }}>{item.emoji}</span>
              <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 14, color: item.active ? AMBER : S_DIM }}>
                {item.label}
              </span>
            </div>
          ))}
        </nav>

        {/* Admin link */}
        {onAdmin && (
          <div style={{ marginTop: 16 }}>
            <div onClick={onAdmin} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer", opacity: 0.5, transition: "opacity 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
            >
              <span style={{ fontSize: 14, color: S_DIM }}>◈</span>
              <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: S_DIM }}>Admin</span>
            </div>
          </div>
        )}

        {/* Streak */}
        <div style={{ marginTop: "auto", borderTop: `1px solid ${SIDEBAR_B}`, paddingTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🔥</span>
            <div>
              <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 22, color: "#FF9600", lineHeight: 1 }}>{streak}</div>
              <div style={{ fontSize: 11, color: S_DIM, marginTop: 1 }}>day streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", background: BG }}>{children}</div>

      {/* Right panel — white */}
      <div style={{
        width: 260, flexShrink: 0,
        borderLeft: `1px solid ${BORDER}`,
        padding: "28px 20px",
        position: "sticky", top: 0, height: "100vh",
        overflowY: "auto", background: WHITE,
      }}>
        {/* Breath meter */}
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Breath</div>
          <BreathBar breath={hearts} />
          <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 8 }}>
            {hearts === 5 ? "Fully rested" : hearts >= 3 ? "Keep going" : "Take it slow"}
          </div>
        </div>

        {rightPanel}
      </div>
    </div>
  );
}
