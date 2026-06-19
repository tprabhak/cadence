import React, { useEffect, useRef, useState } from "react";
import { onboard, searchSongs } from "../api";
import AudioRecorder from "../components/AudioRecorder";
import FingeringChart from "../components/FingeringChart";

const BG         = "#F5F0E8";
const SURFACE    = "#FFFFFF";
const SURFACE_2  = "#FAF7F3";
const BORDER     = "#E8E2D8";
const AMBER      = "#C9862A";
const AMBER_BRIGHT = "#E09030";
const AMBER_DIM  = "rgba(201,134,42,0.10)";
const TEXT       = "#1C1A17";
const TEXT_DIM   = "#7A7268";
const GREEN      = "#2A7A4B";
const GREEN_DIM  = "rgba(42,122,75,0.10)";
const RED_DIM    = "rgba(180,60,60,0.10)";

const TODAY = new Date().toISOString().split("T")[0];

type SpotifyTrack = { id: string; name: string; artist: string; album_art: string | null; reason?: string };

const POPULAR_BY_OCCASION: Record<string, string[]> = {
  "wedding":        ["Can't Help Falling in Love", "Fly Me to the Moon"],
  "open mic night": ["Careless Whisper", "Take Five"],
  "birthday party": ["Just the Way You Are", "Can't Help Falling in Love"],
  "just for fun":   ["Careless Whisper", "Baker Street"],
  "other":          ["Fly Me to the Moon", "What a Wonderful World"],
};

const BY_LEVEL: Record<string, string[]> = {
  beginner:     ["What a Wonderful World", "My Way"],
  intermediate: ["The Girl from Ipanema", "Autumn Leaves"],
  advanced:     ["Misty", "Blue Bossa"],
};

const OCCASION_LABEL: Record<string, string> = {
  "wedding":        "Great for weddings",
  "open mic night": "Popular at open mics",
  "birthday party": "Perfect for birthdays",
  "just for fun":   "Fan favourite",
  "other":          "Popular pick",
};

const LEVEL_LABEL: Record<string, string> = {
  beginner:     "Beginner-friendly",
  intermediate: "Good for intermediates",
  advanced:     "Suits advanced players",
};

function getSuggestedWithReasons(occasion: string, level: string): { name: string; reason: string }[] {
  const popular  = POPULAR_BY_OCCASION[occasion] || ["Careless Whisper", "Fly Me to the Moon"];
  const byLevel  = BY_LEVEL[level] || ["What a Wonderful World", "Autumn Leaves"];
  const occLabel = OCCASION_LABEL[occasion] || "Popular pick";
  const lvlLabel = LEVEL_LABEL[level]   || "Skill-matched";
  const result: { name: string; reason: string }[] = [];
  popular.slice(0, 2).forEach(name => {
    if (!result.find(r => r.name === name)) result.push({ name, reason: occLabel });
  });
  byLevel.slice(0, 2).forEach(name => {
    if (!result.find(r => r.name === name)) result.push({ name, reason: lvlLabel });
  });
  return result.slice(0, 4);
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_SHORT: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

type Form = {
  name: string; current_level: string; goal_event: string;
  goal_song: string; deadline_date: string;
  minutes_per_day: number; available_days: string[];
};

// 1=hook  2=value prop  3=name  4=level  5=occasion  6=song  7=deadline  8=schedule  9=summary
const TOTAL_STEPS = 9;

function getBadge(form: Form) {
  if (!form.deadline_date || !form.available_days.length) return null;
  const days = Math.floor((new Date(form.deadline_date).getTime() - Date.now()) / 86400000);
  const sessionsPerLesson = ((days / 7) * form.available_days.length) / 8;
  if (sessionsPerLesson >= 5) return { text: "Well-paced",  symbol: "✦", bg: GREEN_DIM, border: GREEN,     color: "#4ADE80", note: "Great timeline for consistent progress." };
  if (sessionsPerLesson >= 3) return { text: "Ambitious",   symbol: "◈", bg: AMBER_DIM, border: AMBER,     color: AMBER_BRIGHT, note: "Solid if you don't miss practice days." };
  if (sessionsPerLesson >= 1.5) return { text: "Challenging", symbol: "⚠", bg: "rgba(200,146,46,0.08)", border: "#A67520", color: "#E0A840", note: "Doable, but requires full commitment." };
  return { text: "Very tight", symbol: "⚠", bg: RED_DIM, border: "#7A2A2A", color: "#F87171", note: "Consider extending your deadline or adding more days." };
}

function TrackCard({ track, onClick }: { track: SpotifyTrack; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE_2, cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.background = AMBER_DIM; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.background = SURFACE_2; }}
    >
      {track.album_art ? (
        <img src={track.album_art} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{ width: 44, height: 44, borderRadius: 6, background: AMBER_DIM, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: AMBER, flexShrink: 0 }}>♪</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 14, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.name}</div>
        {track.artist && <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 2 }}>{track.artist}</div>}
        {track.reason && (
          <div style={{ marginTop: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: AMBER, background: AMBER_DIM, border: `1px solid ${AMBER}`, borderRadius: 4, padding: "2px 7px", letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {track.reason}
            </span>
          </div>
        )}
      </div>
      <span style={{ color: TEXT_DIM, fontSize: 12, flexShrink: 0 }}>→</span>
    </button>
  );
}

export default function Onboarding({ onOnboarded }: { onOnboarded: (id: string) => void }) {
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [assessOpen, setAssessOpen]           = useState(false);
  const [isOtherOccasion, setIsOtherOccasion] = useState(false);
  const [loadProgress, setLoadProgress]       = useState(0);

  useEffect(() => {
    if (!loading) { setLoadProgress(0); return; }
    const milestones = [12, 28, 44, 58, 70, 80, 87, 92, 93];
    let i = 0;
    const id = setInterval(() => {
      if (i < milestones.length) setLoadProgress(milestones[i++]);
      else clearInterval(id);
    }, 450);
    return () => clearInterval(id);
  }, [loading]);

  // Spotify state
  const [spotifyRecs, setSpotifyRecs]       = useState<SpotifyTrack[]>([]);
  const [spotifyResults, setSpotifyResults] = useState<SpotifyTrack[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [selectedTrack, setSelectedTrack]   = useState<SpotifyTrack | null>(null);
  const [songSearch, setSongSearch]         = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<Form>({
    name: "", current_level: "beginner", goal_event: "", goal_song: "",
    deadline_date: "", minutes_per_day: 20, available_days: [],
  });

  const set = (k: keyof Form, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleDay = (day: string) =>
    set("available_days", form.available_days.includes(day)
      ? form.available_days.filter(d => d !== day)
      : [...form.available_days, day]);

  // Load Spotify recommendations on reaching song step
  useEffect(() => {
    if (step !== 6) return;
    const suggestions = getSuggestedWithReasons(form.goal_event, form.current_level);
    Promise.all(
      suggestions.map(({ name, reason }) =>
        searchSongs(name)
          .then((r: any) => r.tracks?.[0] ? { ...r.tracks[0], reason } : null)
          .catch(() => null)
      )
    ).then(results => setSpotifyRecs(results.filter(Boolean) as SpotifyTrack[]));
  }, [step]); // eslint-disable-line

  const handleSongSearch = (query: string) => {
    setSongSearch(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) { setSpotifyResults([]); return; }
    setSpotifyLoading(true);
    searchTimerRef.current = setTimeout(() => {
      searchSongs(query)
        .then((r: any) => setSpotifyResults(r.tracks || []))
        .catch(() => setSpotifyResults([]))
        .finally(() => setSpotifyLoading(false));
    }, 350);
  };

  const selectTrack = (track: SpotifyTrack) => {
    setSelectedTrack(track);
    set("goal_song", track.name);
    setSongSearch("");
    setSpotifyResults([]);
  };

  const clearTrack = () => {
    setSelectedTrack(null);
    set("goal_song", "");
  };

  // Fallback text suggestions shown when Spotify returns nothing
  const fallbackRecs: SpotifyTrack[] = getSuggestedWithReasons(form.goal_event, form.current_level)
    .map(({ name, reason }) => ({ id: name, name, artist: "", album_art: null, reason }));

  const displayedResults: SpotifyTrack[] = songSearch.trim()
    ? spotifyResults
    : (spotifyRecs.length > 0 ? spotifyRecs : fallbackRecs);

  const validate = () => {
    if (step === 3 && !form.name.trim())        return "What's your name?";
    if (step === 5 && !form.goal_event)         return "Pick an occasion.";
    if (step === 6 && !form.goal_song.trim())   return "Pick a song or search for your own.";
    if (step === 7 && !form.deadline_date)      return "Set a target date.";
    if (step === 7 && new Date(form.deadline_date + "T00:00:00") <= new Date()) return "Deadline must be a future date.";
    if (step === 8 && !form.available_days.length) return "Pick at least one practice day.";
    return "";
  };

  const next = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setStep(s => s + 1);
  };

  const submit = async () => {
    setLoading(true);
    try {
      const result = await onboard({
        ...form,
        available_days: form.available_days.map(d => d.charAt(0).toUpperCase() + d.slice(1)),
      });
      onOnboarded(result.learner_id);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let msg = "Something went wrong — is the backend running?";
      if (Array.isArray(detail) && detail[0]?.msg) {
        msg = detail[0].msg.replace(/^Value error, /, "");
      } else if (typeof detail === "string") {
        msg = detail;
      }
      setError(msg);
      setLoading(false);
    }
  };

  const back = () => { setError(""); setStep(s => Math.max(1, s - 1)); };
  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;
  const badge    = getBadge(form);

  const ctaLabel = step === 1 ? "Get started"
    : step === 2 ? "Let's set your goal →"
    : step < TOTAL_STEPS ? "Continue"
    : "Build my plan →";

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 14 }}>
        {step > 1 && step < TOTAL_STEPS ? (
          <button onClick={back}
            style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer", color: TEXT_DIM, fontSize: 16, padding: "6px 10px", lineHeight: 1, transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.color = AMBER; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; }}
          >←</button>
        ) : (
          <div style={{ width: 36 }} />
        )}
        <div style={{ flex: 1, height: 4, background: BORDER, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.max(2, progress)}%`, background: AMBER, borderRadius: 2, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 18, color: AMBER }}>Cadence</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 580, width: "100%", margin: "0 auto", padding: "0 24px" }}>

        {/* Step 1 — Hook */}
        {step === 1 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingBottom: 48 }}>
            <div style={{ width: 100, height: 100, borderRadius: 28, background: AMBER_DIM, border: `1.5px solid ${AMBER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, marginBottom: 36 }}>
              🎷
            </div>
            <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 34, color: TEXT, margin: "0 0 16px", lineHeight: 1.2, maxWidth: 360 }}>
              Choose the song. We'll show you the way.
            </h1>
            <p style={{ fontSize: 15, color: TEXT_DIM, margin: 0, lineHeight: 1.75, maxWidth: 320 }}>
              Tell us your goal, level, and timeline.<br />We'll build your personalized practice plan.
            </p>
          </div>
        )}

        {/* Step 2 — Value prop */}
        {step === 2 && (
          <div style={{ flex: 1, paddingTop: 44 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 44 }}>
              <div style={{ width: 64, height: 64, borderRadius: 10, background: AMBER_DIM, border: `1px solid ${AMBER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>🎷</div>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "4px 12px 12px 12px", padding: "12px 18px", fontSize: 15, fontFamily: "DM Sans, sans-serif", fontWeight: 500, color: TEXT, maxWidth: 320, lineHeight: 1.5 }}>
                Here's how Cadence works.
              </div>
            </div>
            {[
              { symbol: "♪", title: "Learn the song you actually want", desc: "We build your curriculum around one goal" },
              { symbol: "♫", title: "A plan that moves with you",       desc: "Adjusts automatically based on your practice" },
              { symbol: "♩", title: "Show up daily, sound better fast", desc: "Short sessions, real progress" },
            ].map((f, i) => (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 0" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: AMBER_DIM, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Playfair Display, serif", fontSize: 24, color: AMBER, flexShrink: 0 }}>{f.symbol}</div>
                  <div>
                    <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 16, color: TEXT, marginBottom: 2 }}>{f.title}</div>
                    <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.4 }}>{f.desc}</div>
                  </div>
                </div>
                {i < 2 && <div style={{ height: 1, background: BORDER }} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 3 — Name */}
        {step === 3 && (
          <QScreen title="What's your name?" subtitle="We'll use it to personalize your coaching.">
            <DarkInput value={form.name} onChange={v => set("name", v)} placeholder="Your name" autoFocus />
          </QScreen>
        )}

        {/* Step 4 — Level */}
        {step === 4 && (
          <QScreen title="What's your experience level?" subtitle="Be honest — this shapes your entire plan.">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { value: "beginner",     label: "Beginner",     desc: "Brand new — I'm just getting started with tenor saxophone" },
                { value: "intermediate", label: "Intermediate", desc: "Played a bit — know some notes, working through songs" },
                { value: "advanced",     label: "Advanced",     desc: "Comfortable with scales, can learn songs independently" },
              ].map(l => (
                <DarkOption key={l.value} label={l.label} desc={l.desc} selected={form.current_level === l.value} onClick={() => set("current_level", l.value)} />
              ))}
            </div>

            {/* Level assessment */}
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => setAssessOpen(o => !o)}
                style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: assessOpen ? "8px 8px 0 0" : 8, padding: "10px 16px", width: "100%", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "DM Sans, sans-serif", fontSize: 13, color: TEXT_DIM, transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = AMBER}
                onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
              >
                <span>Not sure what level you are?</span>
                <span style={{ fontSize: 10 }}>{assessOpen ? "▲" : "▼"}</span>
              </button>

              {assessOpen && (
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "20px 16px" }}>
                  <p style={{ margin: "0 0 4px", fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 14, color: TEXT }}>
                    Play Hot Cross Buns for 20 seconds
                  </p>
                  <p style={{ margin: "0 0 18px", fontSize: 12, color: TEXT_DIM, lineHeight: 1.5 }}>
                    Three notes: B · A · G. We'll listen and pick your level.
                  </p>

                  <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 20 }}>
                    {["B", "A", "G"].map(note => (
                      <FingeringChart key={note} note={note} size="sm" />
                    ))}
                  </div>

                  <AudioRecorder
                    maxSeconds={20}
                    onDone={(notes) => {
                      const unique = new Set(notes);
                      const level = (["G", "A", "B"] as string[]).every(n => unique.has(n)) ? "intermediate" : "beginner";
                      set("current_level", level);
                      setAssessOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
          </QScreen>
        )}

        {/* Step 5 — Occasion */}
        {step === 5 && (
          <QScreen title="What's the occasion?" subtitle="We'll pick songs that fit the moment.">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { value: "wedding",        label: "Wedding",        desc: "Romantic, memorable, emotional" },
                { value: "open mic night", label: "Open mic night", desc: "Show-off material, crowd-pleasing" },
                { value: "birthday party", label: "Birthday party", desc: "Fun, upbeat, celebratory" },
                { value: "just for fun",   label: "Just for fun",   desc: "Personal milestone, no pressure" },
                { value: "other",          label: "Other",          desc: "Something else entirely" },
              ].map(opt => (
                <DarkOption
                  key={opt.value}
                  label={opt.label}
                  desc={opt.desc}
                  selected={opt.value === "other" ? isOtherOccasion : (!isOtherOccasion && form.goal_event === opt.value)}
                  onClick={() => {
                    if (opt.value === "other") {
                      setIsOtherOccasion(true);
                      set("goal_event", "");
                    } else {
                      setIsOtherOccasion(false);
                      set("goal_event", opt.value);
                    }
                  }}
                />
              ))}
              {isOtherOccasion && (
                <DarkInput
                  value={form.goal_event}
                  onChange={v => set("goal_event", v)}
                  placeholder="Describe your occasion..."
                  autoFocus
                />
              )}
            </div>
          </QScreen>
        )}

        {/* Step 6 — Song (Spotify) */}
        {step === 6 && (
          <QScreen title="What song do you want to play?" subtitle="Search any song — we'll arrange it for tenor saxophone.">

            {/* Search bar */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input
                value={songSearch}
                onChange={e => handleSongSearch(e.target.value)}
                placeholder="Search any song..."
                style={{ width: "100%", padding: "11px 16px 11px 38px", borderRadius: 8, border: `1px solid ${songSearch ? AMBER : BORDER}`, background: SURFACE, fontSize: 14, fontFamily: "DM Sans, sans-serif", color: TEXT, outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = AMBER}
                onBlur={e => { if (!songSearch) e.target.style.borderColor = BORDER; }}
              />
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM, fontSize: 14 }}>⌕</span>
              {spotifyLoading && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM, fontSize: 11 }}>…</span>}
            </div>

            {/* Selected song */}
            {selectedTrack && (
              <div style={{ background: AMBER_DIM, border: `1px solid ${AMBER}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                {selectedTrack.album_art && (
                  <img src={selectedTrack.album_art} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 14, color: AMBER_BRIGHT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedTrack.name}</div>
                  {selectedTrack.artist && <div style={{ fontSize: 12, color: TEXT_DIM }}>{selectedTrack.artist}</div>}
                </div>
                <button onClick={clearTrack} style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0, padding: "0 4px" }}>×</button>
              </div>
            )}

            {/* Song list */}
            {!selectedTrack && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {!songSearch.trim() && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>
                    Suggested for you
                  </div>
                )}
                {songSearch.trim() && !spotifyLoading && spotifyResults.length === 0 && (
                  <div style={{ fontSize: 13, color: TEXT_DIM, padding: "12px 0" }}>No results — try a different spelling.</div>
                )}
                {displayedResults.map(track => (
                  <TrackCard key={track.id} track={track} onClick={() => selectTrack(track)} />
                ))}
              </div>
            )}
          </QScreen>
        )}

        {/* Step 7 — Deadline */}
        {step === 7 && (
          <QScreen title="When do you need to be ready?" subtitle="Pick a date — we'll build your timeline around it.">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Quick-pick chips */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Popular timelines</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "4 weeks",  weeks: 4 },
                    { label: "6 weeks",  weeks: 6 },
                    { label: "8 weeks",  weeks: 8 },
                    { label: "3 months", weeks: 13 },
                  ].map(({ label, weeks }) => {
                    const d = new Date(); d.setDate(d.getDate() + weeks * 7);
                    const iso = d.toISOString().split("T")[0];
                    const active = form.deadline_date === iso;
                    return (
                      <button key={label} onClick={() => set("deadline_date", iso)}
                        style={{ padding: "9px 18px", borderRadius: 7, border: `1px solid ${active ? AMBER : BORDER}`, background: active ? AMBER_DIM : SURFACE_2, color: active ? AMBER_BRIGHT : TEXT_DIM, fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = TEXT_DIM; e.currentTarget.style.color = TEXT; } }}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; } }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom date picker */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Or pick a specific date</div>
                <input
                  type="date" value={form.deadline_date} min={TODAY}
                  onChange={e => set("deadline_date", e.target.value)}
                  style={{ width: "100%", padding: "13px 16px", borderRadius: 8, border: `1px solid ${form.deadline_date ? AMBER : BORDER}`, fontSize: 15, outline: "none", fontFamily: "DM Sans, sans-serif", fontWeight: 600, color: form.deadline_date ? TEXT : TEXT_DIM, background: SURFACE, boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = AMBER}
                  onBlur={e => { if (!form.deadline_date) e.target.style.borderColor = BORDER; }}
                />
              </div>

              {/* Countdown message */}
              {form.deadline_date && (() => {
                const ms       = new Date(form.deadline_date + "T00:00:00").getTime() - Date.now();
                const total    = Math.max(0, Math.ceil(ms / 86400000));
                const wks      = Math.floor(total / 7);
                const rem      = total % 7;
                const timeStr  = wks > 0
                  ? `${wks} week${wks !== 1 ? "s" : ""}${rem > 0 ? ` and ${rem} day${rem !== 1 ? "s" : ""}` : ""}`
                  : `${total} day${total !== 1 ? "s" : ""}`;
                return (
                  <div style={{ background: GREEN_DIM, border: `1px solid ${GREEN}`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: "Playfair Display, serif", fontSize: 20, color: GREEN }}>✦</span>
                    <div>
                      <div style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, color: GREEN }}>You have {timeStr}.</div>
                      <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 1 }}>Let's get going!</div>
                    </div>
                  </div>
                );
              })()}

              {/* Recommended minimums */}
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Recommended minimums</div>
                {[{ level: "beginner", weeks: 12 }, { level: "intermediate", weeks: 8 }, { level: "advanced", weeks: 4 }].map(row => (
                  <div key={row.level} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
                    <span style={{ color: row.level === form.current_level ? TEXT : TEXT_DIM, fontWeight: row.level === form.current_level ? 600 : 400 }}>{row.level.charAt(0).toUpperCase() + row.level.slice(1)}</span>
                    <span style={{ color: row.level === form.current_level ? AMBER : TEXT_DIM, fontWeight: row.level === form.current_level ? 600 : 400 }}>{row.weeks} weeks</span>
                  </div>
                ))}
              </div>
            </div>
          </QScreen>
        )}

        {/* Step 8 — Schedule */}
        {step === 8 && (
          <QScreen title="When can you practice?" subtitle="Consistency beats marathon sessions every time.">
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 14, color: TEXT }}>Minutes per day</span>
                  <span style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 18, color: form.minutes_per_day < 15 ? "#F87171" : AMBER }}>{form.minutes_per_day} min</span>
                </div>
                <input type="range" min={5} max={90} step={5} value={form.minutes_per_day}
                  onChange={e => set("minutes_per_day", Number(e.target.value))}
                  style={{ width: "100%", accentColor: AMBER }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: TEXT_DIM }}>5 min</span>
                  <span style={{ fontSize: 11, color: TEXT_DIM }}>90 min</span>
                </div>
                {form.minutes_per_day < 15 && (
                  <div style={{ background: RED_DIM, border: "1px solid #7A2A2A", borderRadius: 6, padding: "8px 12px", marginTop: 8, fontSize: 12, color: "#F87171" }}>
                    We recommend at least 15 min/day for real progress.
                  </div>
                )}
              </div>
              <div style={{ height: 1, background: BORDER }} />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5 }}>Practice days</p>
                  <button
                    onClick={() => set("available_days", ["monday", "wednesday", "friday"])}
                    style={{ background: "none", border: `1px solid ${AMBER}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: AMBER, cursor: "pointer", fontFamily: "DM Sans, sans-serif", letterSpacing: 0.3 }}
                  >
                    ✦ Recommended: Mon · Wed · Fri
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {DAYS.map(d => {
                    const active = form.available_days.includes(d);
                    return (
                      <button key={d} onClick={() => toggleDay(d)}
                        style={{ padding: "9px 14px", borderRadius: 6, border: `1px solid ${active ? AMBER : BORDER}`, background: active ? AMBER_DIM : SURFACE_2, color: active ? AMBER_BRIGHT : TEXT_DIM, fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
                        {DAY_SHORT[d]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </QScreen>
        )}

        {/* Step 9 — Summary */}
        {step === 9 && (
          <div style={{ flex: 1, paddingTop: 40 }}>
            {!loading ? (
              <>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: "Playfair Display, serif", fontSize: 52, color: AMBER, marginBottom: 16, lineHeight: 1 }}>✦</div>
                  <h2 style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 28, color: TEXT, margin: "0 0 8px" }}>Here's your plan</h2>
                  <p style={{ color: TEXT_DIM, fontSize: 14, margin: 0 }}>Review before we build your path.</p>
                </div>

                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                  {[
                    { label: "Name",     value: form.name, symbol: "♩" },
                    { label: "Level",    value: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }[form.current_level] || "", symbol: "◇" },
                    { label: "Occasion", value: form.goal_event, symbol: "♫" },
                    { label: "Song",     value: form.goal_song, symbol: "♪" },
                    { label: "Deadline", value: new Date(form.deadline_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), symbol: "◈" },
                    { label: "Practice", value: `${form.minutes_per_day} min · ${form.available_days.map(d => DAY_SHORT[d]).join(", ")}`, symbol: "✦" },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                      <span style={{ width: 26, fontFamily: "Playfair Display, serif", fontSize: 14, color: AMBER }}>{row.symbol}</span>
                      <span style={{ flex: 1, fontSize: 11, color: TEXT_DIM, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, minWidth: 70 }}>{row.label}</span>
                      <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 14, color: TEXT }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {badge && (
                  <div style={{ background: badge.bg, border: `1px solid ${badge.border}`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: "Playfair Display, serif", fontSize: 20, color: badge.color }}>{badge.symbol}</span>
                    <div>
                      <div style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 13, color: badge.color, marginBottom: 2 }}>{badge.text}</div>
                      <div style={{ fontSize: 12, color: TEXT_DIM }}>{badge.note}</div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 60, textAlign: "center" }}>
                <div style={{ fontFamily: "Playfair Display, serif", fontSize: 80, color: AMBER, marginBottom: 24, lineHeight: 1, animation: "sway 1.4s ease-in-out infinite" }}>♪</div>
                <h2 style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 28, color: TEXT, margin: "0 0 12px" }}>Building your plan...</h2>
                <p style={{ color: TEXT_DIM, fontSize: 15, margin: "0 0 32px", lineHeight: 1.7 }}>
                  Creating a personalized path<br />for <span style={{ color: AMBER }}>{form.goal_song}</span>.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: AMBER, animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>

                {/* Progress bar */}
                <div style={{ width: "100%", maxWidth: 280, margin: "28px auto 0", background: BORDER, borderRadius: 4, height: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${loadProgress}%`, background: AMBER, borderRadius: 4, transition: "width 0.5s ease" }} />
                </div>
                <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 8, fontFamily: "DM Sans, sans-serif" }}>
                  {loadProgress < 30 ? "Analysing your goal…"
                   : loadProgress < 58 ? "Building your path…"
                   : loadProgress < 80 ? "Generating practice drills…"
                   : "Almost there…"}
                </div>

                <style>{`
                  @keyframes sway  { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(6deg)} }
                  @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
                `}</style>
              </div>
            )}

            {error && (
              <div style={{ background: "rgba(122,42,42,0.2)", border: "1px solid #7A2A2A", borderRadius: 8, padding: "10px 16px", marginTop: 12, color: "#F87171", fontSize: 13 }}>{error}</div>
            )}
          </div>
        )}

        {error && step < TOTAL_STEPS && (
          <div style={{ background: "rgba(122,42,42,0.2)", border: "1px solid #7A2A2A", borderRadius: 8, padding: "10px 16px", marginTop: 12, color: "#F87171", fontSize: 13 }}>{error}</div>
        )}
      </div>

      {/* Bottom — CTA */}
      {!loading && (
        <div style={{ padding: "16px 24px 32px", maxWidth: 580, width: "100%", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={step < TOTAL_STEPS ? next : submit}
              style={{ padding: "13px 40px", borderRadius: 8, border: "none", background: AMBER, color: "white", fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase", minWidth: 150, transition: "opacity 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              {ctaLabel}
            </button>
          </div>
          {step === 2 && (
            <div style={{ textAlign: "right", marginTop: 12, fontSize: 12, color: TEXT_DIM }}>
              Start building your path today.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QScreen({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, paddingTop: 40, display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 28, color: TEXT, margin: "0 0 8px", lineHeight: 1.2 }}>{title}</h2>
        <p style={{ color: TEXT_DIM, fontSize: 14, margin: 0, lineHeight: 1.6 }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function DarkInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <input autoFocus={autoFocus} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", padding: "13px 16px", borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 18, fontFamily: "DM Sans, sans-serif", fontWeight: 600, color: TEXT, outline: "none", background: SURFACE, boxSizing: "border-box" }}
      onFocus={e => e.target.style.borderColor = AMBER}
      onBlur={e => e.target.style.borderColor = BORDER}
    />
  );
}

function DarkOption({ label, desc, selected, onClick }: { label: string; desc?: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1px solid ${selected ? AMBER : BORDER}`, background: selected ? AMBER_DIM : SURFACE_2, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s" }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = TEXT_DIM; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = BORDER; }}
    >
      <div>
        <div style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 14, color: selected ? AMBER : TEXT }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 2 }}>{desc}</div>}
      </div>
      {selected && <span style={{ color: AMBER, fontSize: 14, fontWeight: 700 }}>✓</span>}
    </button>
  );
}
