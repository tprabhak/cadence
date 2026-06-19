import React, { useEffect, useState } from "react";

const BG      = "#F5F0E8";
const SURFACE = "#FFFFFF";
const BORDER  = "#E8E2D8";
const AMBER   = "#C9862A";
const AMBER_DIM = "rgba(201,134,42,0.10)";
const TEXT    = "#1C1A17";
const TEXT_DIM  = "#7A7268";
const GREEN   = "#16A34A";

const API          = "http://localhost:8000";
const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET || "";

async function fetchMetrics() {
  const r = await fetch(`${API}/admin/metrics`, {
    headers: { "X-Admin-Key": ADMIN_SECRET },
  });
  if (r.status === 403) throw new Error("forbidden");
  return r.json();
}

function StatCard({ label, value, sub, color = TEXT }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px 22px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "Playfair Display, serif", fontSize: 28, fontWeight: 900, color, lineHeight: 1, marginBottom: sub ? 6 : 0 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: TEXT_DIM }}>{sub}</div>}
    </div>
  );
}

function Bar({ pct, color = AMBER }: { pct: number; color?: string }) {
  return (
    <div style={{ background: BORDER, borderRadius: 3, height: 6, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
    </div>
  );
}

export default function AdminPage({ onBack }: { onBack?: () => void }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics().then(m => { setMetrics(m); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "Playfair Display, serif", fontSize: 18, color: TEXT }}>Loading metrics...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: TEXT_DIM }}>Could not reach backend. Is the server running?</div>
      </div>
    );
  }

  const maxEndpointCost = Math.max(...(metrics.by_endpoint || []).map((e: any) => e.cost), 0.0001);
  const maxDailyCost    = Math.max(...(metrics.daily || []).map((d: any) => d.cost), 0.0001);

  return (
    <div style={{ minHeight: "100vh", background: BG }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 40px", background: SURFACE, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {onBack && (
            <button onClick={onBack}
              style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer", color: TEXT_DIM, fontSize: 14, padding: "6px 10px", lineHeight: 1, transition: "all 0.2s", fontFamily: "DM Sans, sans-serif" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.color = AMBER; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; }}
            >← Back</button>
          )}
          <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 20, color: AMBER }}>Cadence</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 2 }}>Admin · Metrics</div>
          <button
            onClick={() => {
              if (window.confirm("Reset demo? This clears your learner ID and restarts from onboarding.")) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", color: "#B91C1C", fontSize: 12, fontWeight: 600, padding: "6px 12px", fontFamily: "DM Sans, sans-serif" }}
          >
            Reset demo
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 32px 80px" }}>

        {/* Title */}
        <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 30, color: TEXT, margin: "0 0 32px" }}>
          Cost &amp; Quality Dashboard
        </h1>

        {/* Top stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 36 }}>
          <StatCard
            label="Total API Calls"
            value={metrics.total_calls.toLocaleString()}
            sub="across all learners"
          />
          <StatCard
            label="Total Cost"
            value={`$${metrics.total_cost_usd.toFixed(4)}`}
            sub={`${(metrics.total_input_tokens / 1000).toFixed(1)}k in · ${(metrics.total_output_tokens / 1000).toFixed(1)}k out tokens`}
            color={AMBER}
          />
          <StatCard
            label="Avg Quiz Score"
            value={`${metrics.quiz_avg_score}%`}
            sub={`over ${metrics.quiz_sessions} sessions`}
            color={metrics.quiz_avg_score >= 70 ? GREEN : "#DC2626"}
          />
          <StatCard
            label="Cost per Call"
            value={metrics.total_calls > 0 ? `$${(metrics.total_cost_usd / metrics.total_calls).toFixed(5)}` : "—"}
            sub="average"
          />
        </div>

        {/* Cost by endpoint */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 36 }}>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "22px 24px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 18 }}>Cost by Endpoint</div>
            {metrics.by_endpoint.length === 0 && (
              <div style={{ fontSize: 13, color: TEXT_DIM }}>No data yet — run a lesson to see costs.</div>
            )}
            {metrics.by_endpoint.map((e: any) => (
              <div key={e.endpoint} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: TEXT, fontFamily: "DM Sans, sans-serif" }}>{e.endpoint}</span>
                  <span style={{ fontSize: 12, color: AMBER, fontWeight: 700 }}>${e.cost.toFixed(5)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Bar pct={(e.cost / maxEndpointCost) * 100} />
                  <span style={{ fontSize: 11, color: TEXT_DIM, flexShrink: 0 }}>{e.calls} calls</span>
                </div>
              </div>
            ))}
          </div>

          {/* Cost by model */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "22px 24px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 18 }}>Cost by Model</div>
            {metrics.by_model.length === 0 && (
              <div style={{ fontSize: 13, color: TEXT_DIM }}>No data yet.</div>
            )}
            {metrics.by_model.map((m: any) => (
              <div key={m.model} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, fontFamily: "DM Sans, sans-serif" }}>
                      {m.model.includes("haiku") ? "Haiku" : "Sonnet"}
                    </div>
                    <div style={{ fontSize: 10, color: TEXT_DIM }}>{m.model}</div>
                  </div>
                  <span style={{ fontSize: 13, color: AMBER, fontWeight: 700 }}>${m.cost.toFixed(5)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Bar pct={100} color={m.model.includes("haiku") ? "#86EFAC" : AMBER} />
                  <span style={{ fontSize: 11, color: TEXT_DIM, flexShrink: 0 }}>{m.calls} calls</span>
                </div>
              </div>
            ))}

            {/* Cost split insight */}
            {metrics.by_model.length >= 2 && (() => {
              const haikuEntry  = metrics.by_model.find((m: any) => m.model.includes("haiku"));
              const sonnetEntry = metrics.by_model.find((m: any) => !m.model.includes("haiku"));
              const haikuCost   = haikuEntry?.cost || 0;
              const totalCost   = haikuCost + (sonnetEntry?.cost || 0);
              const totalCalls  = (haikuEntry?.calls || 0) + (sonnetEntry?.calls || 0);
              const haikuCalls  = haikuEntry?.calls || 0;
              return totalCost > 0 ? (
                <div style={{ marginTop: 16, padding: "10px 14px", background: AMBER_DIM, borderRadius: 8, fontSize: 12, color: TEXT_DIM }}>
                  Haiku handles <strong style={{ color: TEXT }}>{totalCalls > 0 ? Math.round((haikuCalls / totalCalls) * 100) : 0}%</strong> of calls at{" "}
                  <strong style={{ color: TEXT }}>{Math.round((haikuCost / totalCost) * 100)}%</strong> of the cost.
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Daily spend */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "22px 24px", marginBottom: 36 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 18 }}>Daily API Spend (last 14 days)</div>
          {metrics.daily.length === 0 && (
            <div style={{ fontSize: 13, color: TEXT_DIM }}>No data yet.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...metrics.daily].reverse().map((d: any) => (
              <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 11, color: TEXT_DIM, width: 72, flexShrink: 0, fontFamily: "DM Sans, sans-serif" }}>{d.day}</span>
                <Bar pct={(d.cost / maxDailyCost) * 100} />
                <span style={{ fontSize: 11, color: AMBER, fontWeight: 700, width: 64, textAlign: "right", flexShrink: 0 }}>${d.cost.toFixed(5)}</span>
                <span style={{ fontSize: 11, color: TEXT_DIM, width: 48, flexShrink: 0 }}>{d.calls} calls</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost footnote */}
        <div style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "DM Sans, sans-serif", lineHeight: 1.7, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 18px" }}>
          <strong style={{ color: TEXT }}>Pricing reference:</strong>{" "}
          Sonnet 4.6: $3/M input · $15/M output &nbsp;|&nbsp;
          Haiku 4.5: $0.80/M input · $4/M output.{" "}
          Token counts from the Anthropic API <code>usage</code> field — no estimation.
        </div>
      </div>
    </div>
  );
}
