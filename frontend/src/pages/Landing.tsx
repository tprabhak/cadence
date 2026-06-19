import React, { useState } from "react";
import { demoLogin } from "../api";

const BG      = "#F5F0E8";
const SURFACE = "#FFFFFF";
const BORDER  = "#E8E2D8";
const AMBER   = "#C9862A";
const TEXT    = "#1C1A17";
const TEXT_DIM = "#7A7268";

interface Props {
  onDemo: (learnerId: string) => void;
  onGetStarted: () => void;
}

export default function Landing({ onDemo, onGetStarted }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDemo = async () => {
    setLoading(true);
    try {
      const { learner_id } = await demoLogin();
      onDemo(learner_id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>

        {/* Logo */}
        <div style={{ fontFamily: "Playfair Display, serif", fontSize: 13, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: AMBER, marginBottom: 32 }}>
          ✦ Cadence
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: 42, fontWeight: 700, color: TEXT, lineHeight: 1.15, margin: "0 0 16px" }}>
          Your AI tenor sax<br />practice coach
        </h1>
        <p style={{ fontSize: 16, color: TEXT_DIM, lineHeight: 1.7, margin: "0 0 48px" }}>
          Tell Cadence your goal song and deadline.<br />
          It builds your plan, listens to you play, and adapts as you improve.
        </p>

        {/* CTA buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
          <button
            onClick={handleDemo}
            disabled={loading}
            style={{ padding: "16px 24px", borderRadius: 10, border: "none", background: AMBER, color: "#fff", fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 16, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, letterSpacing: 0.5 }}
          >
            {loading ? "Loading demo…" : "Try the demo →"}
          </button>

          <button
            onClick={onGetStarted}
            style={{ padding: "15px 24px", borderRadius: 10, border: `1.5px solid ${BORDER}`, background: SURFACE, color: TEXT, fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
          >
            Build my own plan
          </button>
        </div>

        {/* What the demo shows */}
        <div style={{ marginTop: 48, padding: "20px 24px", background: SURFACE, borderRadius: 12, border: `1px solid ${BORDER}`, textAlign: "left" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>What you'll see in the demo</div>
          {[
            { icon: "🧠", text: "AI that remembers your last 3 sessions and adjusts today's drill" },
            { icon: "🎷", text: "Real-time pitch detection — plays notes, sees them appear live" },
            { icon: "↻",  text: "Adaptive plan that replans itself when you struggle or excel" },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: i < 2 ? 10 : 0 }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{row.icon}</span>
              <span style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.55 }}>{row.text}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: TEXT_DIM, marginTop: 24, opacity: 0.7 }}>
          Demo account is pre-seeded with 7 days of practice history.
        </p>
      </div>
    </div>
  );
}
