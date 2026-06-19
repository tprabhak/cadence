import React, { useState } from "react";
import FingeringChart from "./FingeringChart";

const AMBER     = "#C9862A";
const AMBER_DIM = "rgba(201,134,42,0.10)";
const BORDER    = "#E8E2D8";
const TEXT      = "#1C1A17";
const TEXT_DIM  = "#7A7268";
const SURFACE   = "#FFFFFF";

// Simplified melody for "Can't Help Falling in Love" — tenor sax, beginner arrangement
const PHRASES = [
  { label: "Wise men say",           notes: ["Bb", "C",  "D",  "Eb"] },
  { label: "Only fools rush in",     notes: ["D",  "C",  "Bb", "G"]  },
  { label: "But I can't help",       notes: ["F",  "G",  "F",  "Eb"] },
  { label: "Falling in love with you", notes: ["D", "C",  "Bb"]      },
];


const UNIQUE_NOTES = ["Bb", "C", "D", "Eb", "F", "G"];

export default function MelodyGuide() {
  const [showCharts, setShowCharts] = useState(false);

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5 }}>
          Melody Map
        </span>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
        <span style={{ fontSize: 10, color: TEXT_DIM, fontFamily: "DM Sans, sans-serif" }}>Can't Help Falling in Love · Alto sax</span>
      </div>

      {/* Phrases */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        {PHRASES.map((phrase, pi) => (
          <div
            key={pi}
            style={{
              padding: "14px 18px",
              borderBottom: pi < PHRASES.length - 1 ? `1px solid ${BORDER}` : "none",
              display: "flex", alignItems: "center", gap: 14,
            }}
          >
            {/* Phrase label */}
            <div style={{ width: 150, flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontStyle: "italic", color: TEXT_DIM, lineHeight: 1.3 }}>"{phrase.label}"</div>
            </div>

            {/* Note bubbles */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
              {phrase.notes.map((note, ni) => (
                <React.Fragment key={ni}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: ni === 0 ? AMBER_DIM : "transparent",
                    border: `1.5px solid ${ni === 0 ? AMBER : BORDER}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <span style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 13, color: ni === 0 ? AMBER : TEXT }}>
                      {note}
                    </span>
                  </div>
                  {ni < phrase.notes.length - 1 && (
                    <div style={{ width: 12, height: 1, background: BORDER, flexShrink: 0 }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Phrase number */}
            <div style={{ fontFamily: "Playfair Display, serif", fontSize: 11, color: TEXT_DIM, flexShrink: 0 }}>
              {pi + 1}/{PHRASES.length}
            </div>
          </div>
        ))}
      </div>

      {/* Toggle finger charts */}
      <button
        onClick={() => setShowCharts(v => !v)}
        style={{ marginTop: 12, background: "none", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "7px 16px", fontSize: 12, color: TEXT_DIM, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.color = AMBER; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; }}
      >
        <span style={{ transition: "transform 0.2s", display: "inline-block", transform: showCharts ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
        {showCharts ? "Hide" : "Show"} fingering charts for all 6 notes
      </button>

      {showCharts && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {UNIQUE_NOTES.map(note => (
              <FingeringChart key={note} note={note} size="md" />
            ))}
          </div>
          <p style={{ fontSize: 10, color: TEXT_DIM, marginTop: 10, fontFamily: "DM Sans, sans-serif", lineHeight: 1.5 }}>
            ● = press &nbsp;·&nbsp; ○ = open &nbsp;·&nbsp; OCT = left thumb octave key
          </p>
        </div>
      )}
    </div>
  );
}
