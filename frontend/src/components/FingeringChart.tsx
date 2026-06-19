import React from "react";

const AMBER   = "#C9862A";
const CREAM   = "#F5F0E8";
const BORDER  = "#E8E2D8";
const TEXT    = "#1C1A17";
const TEXT_DIM = "#7A7268";

interface Fingering {
  oct: boolean; // left thumb octave key
  L1:  boolean; // left index
  L2:  boolean; // left middle
  L3:  boolean; // left ring
  R1:  boolean; // right index
  R2:  boolean; // right middle
  R3:  boolean; // right ring
  extra?: string; // side key note
}

// Standard tenor saxophone fingerings — written pitch (same key layout as alto)
// More keys pressed = lower pitch. Mirror image of flute/recorder.
export const FINGERINGS: Record<string, Fingering> = {
  "D":   { oct:false, L1:true,  L2:true,  L3:true,  R1:true,  R2:true,  R3:true  },
  "Eb":  { oct:false, L1:true,  L2:true,  L3:true,  R1:true,  R2:true,  R3:true,  extra:"+ pinky" },
  "E":   { oct:false, L1:true,  L2:true,  L3:true,  R1:true,  R2:true,  R3:false },
  "F":   { oct:false, L1:true,  L2:true,  L3:true,  R1:true,  R2:false, R3:false },
  "F#":  { oct:false, L1:true,  L2:true,  L3:true,  R1:true,  R2:false, R3:false, extra:"+ side" },
  "G":   { oct:false, L1:true,  L2:true,  L3:true,  R1:false, R2:false, R3:false },
  "Ab":  { oct:false, L1:true,  L2:true,  L3:true,  R1:false, R2:false, R3:false, extra:"+ pinky" },
  "A":   { oct:false, L1:true,  L2:true,  L3:false, R1:false, R2:false, R3:false },
  "Bb":  { oct:false, L1:true,  L2:true,  L3:false, R1:false, R2:false, R3:false, extra:"+ bis" },
  "B":   { oct:false, L1:true,  L2:false, L3:false, R1:false, R2:false, R3:false },
  "C":   { oct:false, L1:false, L2:false, L3:false, R1:false, R2:false, R3:false },
  "C#":  { oct:false, L1:false, L2:false, L3:false, R1:false, R2:false, R3:false, extra:"+ side" },
  // High register — same fingering but add octave key
  "D5":  { oct:true,  L1:true,  L2:true,  L3:true,  R1:true,  R2:true,  R3:true  },
  "E5":  { oct:true,  L1:true,  L2:true,  L3:true,  R1:true,  R2:true,  R3:false },
  "F5":  { oct:true,  L1:true,  L2:true,  L3:true,  R1:true,  R2:false, R3:false },
  "G5":  { oct:true,  L1:true,  L2:true,  L3:true,  R1:false, R2:false, R3:false },
  "A5":  { oct:true,  L1:true,  L2:true,  L3:false, R1:false, R2:false, R3:false },
  "Bb5": { oct:true,  L1:true,  L2:true,  L3:false, R1:false, R2:false, R3:false, extra:"+ bis" },
};

function KeyDot({ pressed, size = 16 }: { pressed: boolean; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: pressed ? AMBER : CREAM,
      border: `2px solid ${pressed ? AMBER : BORDER}`,
      boxShadow: pressed ? `0 0 0 2px rgba(201,134,42,0.2)` : "none",
      transition: "all 0.2s",
      flexShrink: 0,
    }} />
  );
}

function OctaveKey({ pressed }: { pressed: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: pressed ? AMBER : CREAM,
        border: `1.5px solid ${pressed ? AMBER : BORDER}`,
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 9, color: TEXT_DIM, fontFamily: "DM Sans, sans-serif", letterSpacing: 0.3 }}>OCT</span>
    </div>
  );
}

interface Props {
  note: string;
  size?: "sm" | "md";
}

export default function FingeringChart({ note, size = "md" }: Props) {
  const fingering = FINGERINGS[note];
  if (!fingering) return null;

  const dotSize = size === "sm" ? 14 : 18;
  const gap     = size === "sm" ? 6  : 8;
  const cardW   = size === "sm" ? 68 : 84;

  const keys: { key: keyof Fingering; label: string }[] = [
    { key: "L1", label: "1" },
    { key: "L2", label: "2" },
    { key: "L3", label: "3" },
  ];
  const rKeys: { key: keyof Fingering; label: string }[] = [
    { key: "R1", label: "1" },
    { key: "R2", label: "2" },
    { key: "R3", label: "3" },
  ];

  return (
    <div style={{
      width: cardW,
      background: "#FFFFFF",
      border: `1.5px solid ${BORDER}`,
      borderRadius: 10,
      padding: "10px 10px 8px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
    }}>
      {/* Note name */}
      <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: size === "sm" ? 14 : 17, color: TEXT, marginBottom: 2 }}>
        {note}
      </div>

      {/* Octave key */}
      <OctaveKey pressed={fingering.oct} />

      {/* Left hand label */}
      <div style={{ fontSize: 8, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontFamily: "DM Sans, sans-serif" }}>L hand</div>

      {/* Left keys */}
      <div style={{ display: "flex", flexDirection: "column", gap, alignItems: "center" }}>
        {keys.map(({ key }) => (
          <KeyDot key={key} pressed={fingering[key] as boolean} size={dotSize} />
        ))}
      </div>

      {/* Bridge separator */}
      <div style={{ width: 1, height: 10, background: BORDER, margin: "3px 0" }} />

      {/* Right hand label */}
      <div style={{ fontSize: 8, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontFamily: "DM Sans, sans-serif" }}>R hand</div>

      {/* Right keys */}
      <div style={{ display: "flex", flexDirection: "column", gap, alignItems: "center" }}>
        {rKeys.map(({ key }) => (
          <KeyDot key={key} pressed={fingering[key] as boolean} size={dotSize} />
        ))}
      </div>

      {/* Extra key note */}
      {fingering.extra && (
        <div style={{ fontSize: 8, color: AMBER, fontFamily: "DM Sans, sans-serif", marginTop: 4, fontWeight: 600 }}>
          {fingering.extra}
        </div>
      )}
    </div>
  );
}

// Extract note names from coaching text
export function extractNotes(text: string): string[] {
  const pattern = /\b([A-G][b#]?5?)\b/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const raw = m[1];
    // Normalize: "Bb" stays "Bb", "F#" stays "F#", plain letter like "A" stays "A"
    if (FINGERINGS[raw]) found.add(raw);
  }
  return Array.from(found).slice(0, 5);
}

// Default notes shown when none are detected
export const DEFAULT_NOTES = ["G", "A", "B", "C", "D"];
