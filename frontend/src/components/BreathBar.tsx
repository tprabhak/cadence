import React from "react";

const AMBER  = "#C9862A";
const BORDER = "#E8E2D8";

export default function BreathBar({ breath }: { breath: number }) {
  const heights = [14, 18, 22, 18, 14];
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 5, height: h,
          background: i < breath ? AMBER : BORDER,
          borderRadius: 3,
          transition: "background 0.4s ease",
        }} />
      ))}
    </div>
  );
}
