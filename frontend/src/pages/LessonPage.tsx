import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { getSession, getQuiz, logProgress, getAudioFeedback } from "../api";
import FingeringChart, { extractNotes, DEFAULT_NOTES } from "../components/FingeringChart";
import AudioRecorder from "../components/AudioRecorder";
import BreathBar from "../components/BreathBar";
import MelodyGuide from "../components/MelodyGuide";

const BG      = "#F5F0E8";
const SURFACE = "#FFFFFF";
const BORDER  = "#E8E2D8";
const AMBER   = "#C9862A";
const AMBER_DIM = "rgba(201,134,42,0.10)";
const TEXT    = "#1C1A17";
const TEXT_DIM  = "#7A7268";
const RED       = "#EF4444";

type QuizQuestion = { question: string; options: string[]; answer: string };
type Step =
  | { type: "intro" }
  | { type: "coaching"; content: string; resourceLink: string | null }
  | { type: "play"; coachingContent: string }
  | { type: "quiz"; question: QuizQuestion; index: number }
  | { type: "complete" };
type Feedback = null | "correct" | "wrong";

type Props = {
  learnerId: string; segmentId: string; segmentSkill: string;
  onComplete: () => void; onExit: () => void;
};


function MicCalibration({ onCalibrated, calibrating, setCalibrating, seconds, setSeconds, level, setLevel }: {
  onCalibrated: (threshold: number) => void;
  calibrating: boolean; setCalibrating: (v: boolean) => void;
  seconds: number; setSeconds: (v: number) => void;
  level: number; setLevel: (v: number) => void;
}) {
  const streamRef   = useRef<MediaStream | null>(null);
  const ctxRef      = useRef<AudioContext | null>(null);
  const procRef     = useRef<ScriptProcessorNode | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const peaksRef    = useRef<number[]>([]);
  const DURATION    = 3;

  useEffect(() => () => {
    procRef.current?.disconnect(); ctxRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const start = async () => {
    setCalibrating(true);
    setSeconds(0);
    peaksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const src  = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    procRef.current = proc;
    proc.onaudioprocess = (e) => {
      const buf = e.inputBuffer.getChannelData(0);
      let rms = 0;
      for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
      rms = Math.sqrt(rms / buf.length);
      peaksRef.current.push(rms);
      setLevel(rms);
    };
    src.connect(proc); proc.connect(ctx.destination);
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed++;
      setSeconds(elapsed);
      if (elapsed >= DURATION) {
        clearInterval(timerRef.current!);
        proc.disconnect(); ctx.close();
        stream.getTracks().forEach(t => t.stop());
        const peaks = peaksRef.current.filter(v => v > 0);
        const maxPeak = peaks.length > 0 ? Math.max(...peaks) : 0.015;
        // threshold = 25% of their peak — picks up intentional playing, ignores room noise
        const threshold = Math.max(0.008, Math.min(0.05, maxPeak * 0.25));
        onCalibrated(threshold);
      }
    }, 1000);
  };

  const BAR_COUNT = 16;

  if (!calibrating) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(201,134,42,0.1)", border: `2px solid ${AMBER}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>
          🎷
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Set up your mic first</div>
        <div style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 24, lineHeight: 1.6 }}>
          Play any note for 3 seconds.<br />Cadence will tune itself to your room.
        </div>
        <button onClick={start}
          style={{ padding: "12px 32px", borderRadius: 8, border: "none", background: AMBER, color: "#fff", fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }}>
          Calibrate mic →
        </button>
      </div>
    );
  }

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const center = Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2);
    return Math.max(4, Math.round((1 - center * 0.5) * level * 120 + 6));
  });

  return (
    <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 48, marginBottom: 20 }}>
        {bars.map((h, i) => <div key={i} style={{ width: 4, height: h, background: level > 0.02 ? AMBER : BORDER, borderRadius: 2, transition: "height 0.08s ease" }} />)}
      </div>
      <div style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 8 }}>
        {level > 0.02 ? "Hearing you — keep playing…" : "Play any note on your saxophone…"}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 4 }}>
        {Array.from({ length: DURATION }, (_, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < seconds ? AMBER : BORDER, transition: "background 0.3s" }} />
        ))}
      </div>
      <div style={{ fontSize: 12, color: TEXT_DIM }}>{DURATION - seconds}s remaining</div>
    </div>
  );
}

function AudioPlayback({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
      <audio ref={audioRef} src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => { const a = audioRef.current; if (a && a.duration) setProgress(a.currentTime / a.duration); }}
      />
      <button onClick={toggle}
        style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: AMBER, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        {playing
          ? <span style={{ display: "inline-block", width: 10, height: 10, borderLeft: "3px solid #fff", borderRight: "3px solid #fff" }} />
          : <span style={{ display: "inline-block", width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "10px solid #fff", marginLeft: 2 }} />
        }
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Your recording</div>
        <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", background: AMBER, width: `${progress * 100}%`, borderRadius: 2, transition: "width 0.1s linear" }} />
        </div>
      </div>
      {duration > 0 && (
        <span style={{ fontSize: 11, color: TEXT_DIM, flexShrink: 0 }}>
          {Math.floor(duration)}s
        </span>
      )}
    </div>
  );
}

function CoachingStep({ content, resourceLink, skill, goalSong }: { content: string; resourceLink: string | null; skill: string; goalSong: string }) {
  const [showVideo, setShowVideo] = React.useState(false);
  const detected    = extractNotes(content);
  const notesToShow = detected.length > 0 ? detected : DEFAULT_NOTES.slice(0, 4);

  return (
    <div>
      <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 20, color: TEXT, marginBottom: 8, lineHeight: 1.3 }}>{skill}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: AMBER_DIM, border: `1px solid ${AMBER}`, borderRadius: 6, padding: "4px 14px", fontSize: 11, fontWeight: 600, color: AMBER, marginBottom: 20, letterSpacing: 1, textTransform: "uppercase" }}>
        <span>♩</span> Today's drill
      </div>
      <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.8, background: SURFACE, borderRadius: 8, padding: "24px 28px", border: `1px solid ${BORDER}`, marginBottom: 28 }}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>

      {/* Key charts — shown first, always visible */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5 }}>
            Finger Charts
          </span>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <span style={{ fontSize: 10, color: TEXT_DIM, fontFamily: "DM Sans, sans-serif" }}>Tenor sax · written pitch</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {notesToShow.map(note => (
            <FingeringChart key={note} note={note} size="md" />
          ))}
        </div>
        <p style={{ fontSize: 10, color: TEXT_DIM, marginTop: 10, fontFamily: "DM Sans, sans-serif", lineHeight: 1.5 }}>
          ● = press &nbsp;·&nbsp; ○ = open &nbsp;·&nbsp; OCT = left thumb octave key
        </p>
      </div>

      {/* Melody guide — demo song only */}
      {goalSong.toLowerCase().includes("can't help") && <MelodyGuide />}

      {/* Resource video — collapsible, secondary */}
      {resourceLink && (
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => setShowVideo(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, cursor: "pointer", width: "100%", textAlign: "left", transition: "border-color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = AMBER}
            onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
          >
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#FEE2E2", border: "1px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>▶</div>
            <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 13, color: TEXT_DIM, flex: 1 }}>
              {showVideo ? "Hide tutorial video" : "Show tutorial video"}
            </span>
            <span style={{ fontSize: 12, color: TEXT_DIM }}>{showVideo ? "▲" : "▼"}</span>
          </button>
          {showVideo && (
            resourceLink.includes("youtube.com/embed") ? (
              <div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", border: `1px solid ${BORDER}`, aspectRatio: "16/9", background: "#000" }}>
                <iframe src={resourceLink} title="Tutorial video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
              </div>
            ) : (
              <a href={resourceLink} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginTop: 8, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, textDecoration: "none", transition: "border-color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = AMBER)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 13, color: TEXT }}>Watch on YouTube</div>
                  <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 2 }}>Opens in new tab</div>
                </div>
                <span style={{ fontSize: 14, color: AMBER }}>↗</span>
              </a>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function LessonPage({ learnerId, segmentId, segmentSkill, onComplete, onExit }: Props) {
  const [steps, setSteps]         = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<string | null>(null);
  const [feedback, setFeedback]   = useState<Feedback>(null);
  const [hearts, setHearts]       = useState(5);
  const [correctAnswers, setCorrectAnswers] = useState<Map<number, string>>(new Map());
  const [logging, setLogging]       = useState(false);
  const [audioFeedback, setAudioFeedback]     = useState<string | null>(null);
  const [audioQuality, setAudioQuality]       = useState<"good" | "needs_work" | null>(null);
  const [audioPlaybackUrl, setAudioPlaybackUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading]       = useState(false);
  const [calibrated, setCalibrated]           = useState(false);
  const [calibrating, setCalibrating]         = useState(false);
  const [calibrateSeconds, setCalibrateSeconds] = useState(0);
  const [rmsThreshold, setRmsThreshold]       = useState(0.015);
  const [calibrateLevel, setCalibrateLevel]   = useState(0);
  const [recordedNotes, setRecordedNotes]     = useState<string[]>([]);
  const [quizCorrect, setQuizCorrect]         = useState(0);
  const [audioDetected, setAudioDetected]     = useState<boolean | null>(null);
  const [goalSong, setGoalSong]               = useState("");
  const [error, setError]                     = useState<string | null>(null);
  const [difficultyRating, setDifficultyRating] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getSession(learnerId), getQuiz(learnerId, segmentId)])
      .then(([session, quiz]) => {
        const coaching     = session?.coaching || "";
        const resourceLink = session?.current_segment?.resource_link || null;
        setGoalSong(session?.goal_song || "");
        const built: Step[] = [
          { type: "intro" },
          { type: "coaching", content: coaching, resourceLink },
          { type: "play", coachingContent: coaching },
          ...(quiz as QuizQuestion[]).map((q, i) => ({ type: "quiz" as const, question: q, index: i })),
          { type: "complete" },
        ];
        const answers = new Map<number, string>();
        (quiz as QuizQuestion[]).forEach((q, i) => answers.set(i, q.answer));
        setCorrectAnswers(answers);
        setSteps(built);
        setLoading(false);
      })
      .catch(() => {
        setError("Couldn't load this lesson — make sure the backend is running.");
        setLoading(false);
      });
  }, [learnerId, segmentId]);

  const totalSteps  = steps.length;
  const progress    = totalSteps > 0 ? stepIndex / (totalSteps - 1) : 0;
  const currentStep = steps[stepIndex];

  const advance = () => {
    if (audioPlaybackUrl) { URL.revokeObjectURL(audioPlaybackUrl); setAudioPlaybackUrl(null); }
    setSelected(null); setFeedback(null); setStepIndex(i => Math.min(i + 1, steps.length - 1));
  };

  const handleCheck = () => {
    if (!selected || !currentStep || currentStep.type !== "quiz") return;
    const correct = correctAnswers.get(currentStep.index);
    if (selected === correct) { setFeedback("correct"); setQuizCorrect(n => n + 1); }
    else { setFeedback("wrong"); setHearts(h => Math.max(0, h - 1)); }
  };

  const computeConfidence = (difficulty: number): number => {
    const quizTotal = steps.filter(s => s.type === "quiz").length;
    const quizRatio = quizTotal > 0 ? quizCorrect / quizTotal : 0.6;
    const base      = 1 + quizRatio * 3;                                      // 1–4 from quiz
    const audioMod  = audioDetected === true ? 0.5 : audioDetected === false ? -0.5 : 0;
    const diffMod   = difficulty <= 3 ? 0.75 : difficulty >= 8 ? -0.75 : 0;  // easy ↑ hard ↓
    return Math.min(5, Math.max(1, Math.round(base + audioMod + diffMod)));
  };

  const handleComplete = async () => {
    if (difficultyRating === null) return;
    setLogging(true);
    await logProgress({
      learner_id: learnerId, segment_id: segmentId, did_practice: true,
      minutes: 20, confidence: computeConfidence(difficultyRating),
      difficulty_rating: difficultyRating,
    });
    onComplete();
  };

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 32 }}>
        <div style={{ fontFamily: "Playfair Display, serif", fontSize: 48, color: RED }}>◈</div>
        <p style={{ fontFamily: "Playfair Display, serif", fontSize: 18, color: TEXT, textAlign: "center" }}>{error}</p>
        <button onClick={onExit} style={{ marginTop: 8, padding: "10px 28px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "none", cursor: "pointer", fontSize: 13, color: TEXT_DIM }}>← Back to map</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "Playfair Display, serif", fontSize: 64, color: AMBER }}>♪</div>
        <p style={{ fontFamily: "Playfair Display, serif", fontSize: 18, color: TEXT }}>Loading lesson...</p>
        <style>{`@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: AMBER, animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ padding: "14px 28px", display: "flex", alignItems: "center", gap: 20, borderBottom: `1px solid ${BORDER}`, background: SURFACE, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {stepIndex > 0 && (
            <button onClick={() => { setSelected(null); setFeedback(null); setStepIndex(i => Math.max(0, i - 1)); }}
              style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer", color: TEXT_DIM, fontSize: 14, padding: "6px 10px", lineHeight: 1, transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.color = AMBER; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; }}
            >←</button>
          )}
          <button onClick={onExit}
            style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, cursor: "pointer", color: TEXT_DIM, fontSize: 14, padding: "6px 10px", lineHeight: 1, transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.color = AMBER; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; }}
          >✕</button>
        </div>

        <div style={{ flex: 1, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress * 100}%`, background: AMBER, borderRadius: 3, transition: "width 0.5s ease" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: TEXT_DIM, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Breath</span>
          <BreathBar breath={hearts} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 680, width: "100%", margin: "0 auto", padding: "48px 24px 120px" }}>

        {/* Intro */}
        {currentStep?.type === "intro" && (
          <div style={{ textAlign: "center", paddingTop: 24 }}>
            <div style={{ display: "inline-block", background: AMBER_DIM, border: `1px solid ${AMBER}`, borderRadius: 6, padding: "4px 14px", fontSize: 11, fontWeight: 600, color: AMBER, marginBottom: 20, letterSpacing: 1.5, textTransform: "uppercase" }}>
              New Lesson
            </div>
            <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: segmentSkill.length > 50 ? 22 : 28, color: TEXT, margin: "0 0 10px", lineHeight: 1.25, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
              {segmentSkill.length > 70 ? segmentSkill.slice(0, 70) + "…" : segmentSkill}
            </h1>
            <div style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 44 }}>~15 min</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", maxWidth: 320, margin: "0 auto" }}>
              {[{ label: "Drill", icon: "♩" }, { label: "Play", icon: "●" }, { label: "Quiz", icon: "♫" }].map((s, i) => (
                <React.Fragment key={s.label}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: AMBER_DIM, border: `1.5px solid ${AMBER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: AMBER, margin: "0 auto 8px" }}>
                      {s.icon}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
                  </div>
                  {i < 2 && <div style={{ width: 36, height: 1.5, background: BORDER, marginBottom: 22, flexShrink: 0 }} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Coaching */}
        {currentStep?.type === "coaching" && (
          <CoachingStep content={currentStep.content} resourceLink={currentStep.resourceLink} skill={segmentSkill} goalSong={goalSong} />
        )}

        {/* Play */}
        {currentStep?.type === "play" && (
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.08)", border: "1px solid #FECACA", borderRadius: 6, padding: "4px 14px", fontSize: 11, fontWeight: 600, color: RED, marginBottom: 20, letterSpacing: 1, textTransform: "uppercase" }}>
              <span>●</span> Play along
            </div>

            <h2 style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 22, color: TEXT, margin: "0 0 8px" }}>
              Now try it yourself
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 24, lineHeight: 1.6 }}>
              Record yourself playing the drill. Cadence will listen and give you specific feedback.
            </p>

            {/* Finger charts for notes to play */}
            {(() => {
              const notes = extractNotes(currentStep.coachingContent);
              const toShow = notes.length > 0 ? notes : DEFAULT_NOTES.slice(0, 4);
              return (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5 }}>Notes to play</span>
                    <div style={{ flex: 1, height: 1, background: BORDER }} />
                    <span style={{ fontSize: 10, color: TEXT_DIM }}>Tenor sax · written pitch</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {toShow.map(note => <FingeringChart key={note} note={note} size="sm" />)}
                  </div>
                </div>
              );
            })()}

            {/* Drill reminder */}
            {!audioFeedback && (
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px 20px", marginBottom: 28 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>What to play</div>
                <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.65, margin: "0 0 18px" }}>
                  {currentStep.coachingContent.replace(/[#*`]/g, "").split("\n").find(l => l.trim().length > 20) || currentStep.coachingContent.slice(0, 150)}
                </p>
                <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                  {[
                    { n: "1", label: "Place your mic", sub: "Hold your phone or mic 6–12 inches from the bell" },
                    { n: "2", label: "Breathe deeply", sub: "Support from the diaphragm before you play" },
                    { n: "3", label: "Play the drill", sub: "Go slowly — accuracy matters more than speed" },
                  ].map((s, i) => (
                    <div key={i} style={{ flex: 1, paddingRight: i < 2 ? 12 : 0, borderRight: i < 2 ? `1px solid ${BORDER}` : "none", paddingLeft: i > 0 ? 12 : 0 }}>
                      <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 13, color: AMBER, marginBottom: 2 }}>{s.n}. {s.label}</div>
                      <div style={{ fontSize: 11, color: TEXT_DIM, lineHeight: 1.5 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!audioFeedback ? (
              !calibrated ? (
                <MicCalibration
                  onCalibrated={(threshold) => { setRmsThreshold(threshold); setCalibrated(true); }}
                  calibrating={calibrating} setCalibrating={setCalibrating}
                  seconds={calibrateSeconds} setSeconds={setCalibrateSeconds}
                  level={calibrateLevel} setLevel={setCalibrateLevel}
                />
              ) : (
              <AudioRecorder
                disabled={audioLoading}
                rmsThreshold={rmsThreshold}
                onAudioUrl={(url) => setAudioPlaybackUrl(url)}
                onDone={async (notes) => {
                  setRecordedNotes(notes);
                  setAudioDetected(notes.length > 0);
                  setAudioLoading(true);
                  try {
                    const result = await getAudioFeedback({
                      learner_id: learnerId,
                      segment_skill: segmentSkill,
                      detected_notes: notes,
                      coaching_content: currentStep.coachingContent,
                    });
                    setAudioFeedback(result.feedback);
                    setAudioQuality(result.quality);
                  } catch {
                    setAudioFeedback("Couldn't analyse the recording — check the backend is running.");
                    setAudioQuality("needs_work");
                  }
                  setAudioLoading(false);
                }}
              />
              )
            ) : (
              <div>
                {/* Detected notes */}
                {recordedNotes.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Notes detected</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {recordedNotes.filter((n, i, arr) => arr.indexOf(n) === i).map(n => (
                        <span key={n} style={{ background: AMBER_DIM, border: `1px solid ${AMBER}`, borderRadius: 6, padding: "3px 12px", fontSize: 14, color: AMBER, fontWeight: 700, fontFamily: "Playfair Display, serif" }}>{n}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Playback */}
                {audioPlaybackUrl && <AudioPlayback url={audioPlaybackUrl} />}

                {/* Feedback — border tinted by quality */}
                <div style={{ background: SURFACE, border: `1.5px solid ${audioQuality === "good" ? "#86EFAC" : "#FECACA"}`, borderRadius: 10, padding: "20px 24px", marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: audioQuality === "good" ? "#16A34A" : "#DC2626", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                    {audioQuality === "good" ? "Cadence feedback · Sounding good" : "Cadence feedback · Needs work"}
                  </div>
                  <p style={{ fontSize: 14, color: TEXT, lineHeight: 1.75, margin: 0 }}>{audioFeedback}</p>
                </div>

                {audioQuality === "good" ? (
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => { setAudioFeedback(null); setAudioQuality(null); setAudioPlaybackUrl(null); setRecordedNotes([]); }}
                      style={{ flex: 1, padding: "13px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "none", color: TEXT_DIM, fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    >
                      Play again
                    </button>
                    <button
                      onClick={advance}
                      style={{ flex: 1, padding: "13px", borderRadius: 8, border: "none", background: AMBER, color: "#fff", fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }}
                    >
                      Continue →
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: TEXT_DIM, margin: "0 0 12px" }}>Want to try again?</p>
                    <button
                      onClick={() => { setAudioFeedback(null); setAudioQuality(null); setAudioPlaybackUrl(null); setRecordedNotes([]); }}
                      style={{ width: "100%", padding: "14px", borderRadius: 8, border: "none", background: AMBER, color: "#fff", fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}
                    >
                      Try again →
                    </button>
                    <div style={{ textAlign: "center" }}>
                      <button
                        onClick={advance}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: TEXT_DIM, textDecoration: "underline", fontFamily: "DM Sans, sans-serif" }}
                      >
                        Skip for now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {audioLoading && (
              <div style={{ textAlign: "center", padding: "32px 0", color: TEXT_DIM, fontSize: 13 }}>
                Analysing your playing…
              </div>
            )}
          </div>
        )}

        {/* Quiz */}
        {currentStep?.type === "quiz" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {steps.filter(s => s.type === "quiz").map((_, i) => (
                  <div key={i} style={{ width: 28, height: 4, borderRadius: 2, background: i <= currentStep.index ? AMBER : BORDER, opacity: i < currentStep.index ? 0.4 : 1, transition: "all 0.3s" }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: TEXT_DIM, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                {currentStep.index + 1} / {steps.filter(s => s.type === "quiz").length}
              </span>
            </div>
            <h2 style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 24, color: TEXT, margin: "0 0 28px", lineHeight: 1.35 }}>
              {currentStep.question.question}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {currentStep.question.options.map((opt) => {
                const letter     = opt[0];
                const isSelected = selected === letter;
                const showCorrect = feedback && letter === correctAnswers.get(currentStep.index);
                const showWrong   = feedback === "wrong" && isSelected;

                let borderColor = BORDER, bg = SURFACE, textColor = TEXT;
                if (showCorrect) { borderColor = "#22C55E"; bg = "#F0FDF4"; textColor = "#15803D"; }
                else if (showWrong) { borderColor = "#EF4444"; bg = "#FEF2F2"; textColor = "#B91C1C"; }
                else if (isSelected) { borderColor = AMBER; bg = AMBER_DIM; textColor = AMBER; }

                return (
                  <button key={opt}
                    onClick={() => !feedback && setSelected(letter)}
                    disabled={!!feedback}
                    style={{ padding: "18px 16px", borderRadius: 8, border: `1.5px solid ${borderColor}`, background: bg, cursor: feedback ? "default" : "pointer", textAlign: "left", transition: "all 0.15s", position: "relative" }}
                    onMouseEnter={e => { if (!feedback && !isSelected) { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.background = AMBER_DIM; } }}
                    onMouseLeave={e => { if (!feedback && !isSelected) { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.background = SURFACE; } }}
                  >
                    <div style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 500, fontSize: 14, color: textColor, lineHeight: 1.5 }}>{opt.slice(3)}</div>
                    <div style={{ position: "absolute", bottom: 8, right: 8, width: 20, height: 20, borderRadius: 4, border: `1px solid ${borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: isSelected ? AMBER : TEXT_DIM }}>{letter}</div>
                    {showCorrect && <div style={{ position: "absolute", top: -8, right: -8, width: 18, height: 18, background: "#22C55E", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✓</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Complete */}
        {currentStep?.type === "complete" && (
          <div style={{ paddingTop: 24, maxWidth: 480, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#F0FDF4", border: "3px solid #86EFAC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 36 }}>✓</div>
              <div style={{ display: "inline-block", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 6, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: "#15803D", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Lesson complete</div>
              <h2 style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 28, color: TEXT, margin: "0 0 8px" }}>How did that feel?</h2>
              <p style={{ color: TEXT_DIM, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                Three signals help Cadence tune your next session.
              </p>
            </div>

            {/* Three signals summary */}
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", marginBottom: 28 }}>
              {[
                {
                  icon: "♫",
                  label: "Quiz",
                  value: (() => {
                    const total = steps.filter(s => s.type === "quiz").length;
                    return total > 0 ? `${quizCorrect}/${total} correct` : "Skipped";
                  })(),
                  color: (() => {
                    const total = steps.filter(s => s.type === "quiz").length;
                    if (total === 0) return TEXT_DIM;
                    return quizCorrect / total >= 0.67 ? "#15803D" : "#B45309";
                  })(),
                },
                {
                  icon: "●",
                  label: "Sound quality",
                  value: audioDetected === true ? "Notes detected" : audioDetected === false ? "Nothing detected" : "Not recorded",
                  color: audioDetected === true ? "#15803D" : audioDetected === false ? "#B91C1C" : TEXT_DIM,
                },
              ].map((row, i) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ width: 28, fontFamily: "Playfair Display, serif", fontSize: 14, color: AMBER }}>{row.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, color: TEXT_DIM, fontWeight: 600 }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}

              {/* Difficulty rating row */}
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ width: 28, fontFamily: "Playfair Display, serif", fontSize: 14, color: AMBER }}>◈</span>
                  <span style={{ flex: 1, fontSize: 13, color: TEXT_DIM, fontWeight: 600 }}>How hard was this session?</span>
                  {difficultyRating !== null && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: difficultyRating <= 3 ? "#15803D" : difficultyRating >= 8 ? "#B91C1C" : AMBER }}>
                      {difficultyRating}/10
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => {
                    const selected = difficultyRating === n;
                    const hue = n <= 3 ? "#15803D" : n >= 8 ? "#B91C1C" : AMBER;
                    return (
                      <button key={n} onClick={() => setDifficultyRating(n)}
                        style={{ flex: 1, height: 36, borderRadius: 6, border: `1.5px solid ${selected ? hue : BORDER}`, background: selected ? hue : SURFACE, color: selected ? "#fff" : TEXT_DIM, fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.12s" }}>
                        {n}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: TEXT_DIM }}>Easy</span>
                  <span style={{ fontSize: 10, color: TEXT_DIM }}>Hard</span>
                </div>
              </div>
            </div>

            {!difficultyRating && (
              <p style={{ textAlign: "center", fontSize: 12, color: TEXT_DIM, margin: "0 0 16px" }}>Rate the difficulty to continue</p>
            )}
          </div>
        )}
      </div>

      {/* Feedback overlay */}
      {feedback && currentStep?.type === "quiz" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "18px 40px", background: feedback === "correct" ? "#F0FDF4" : "#FEF2F2", borderTop: `2px solid ${feedback === "correct" ? "#22C55E" : "#EF4444"}`, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 100 }}>
          <div>
            <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 20, color: feedback === "correct" ? "#15803D" : "#B91C1C" }}>
              {feedback === "correct" ? "Correct" : "Not quite"}
            </div>
            {feedback === "wrong" && currentStep.type === "quiz" && (
              <div style={{ fontSize: 13, color: TEXT_DIM, marginTop: 3 }}>
                Answer: <span style={{ color: TEXT, fontWeight: 600 }}>{currentStep.question.options.find(o => o[0] === correctAnswers.get(currentStep.index))?.slice(3)}</span>
              </div>
            )}
          </div>
          <button onClick={advance}
            style={{ padding: "11px 28px", borderRadius: 8, border: "none", background: feedback === "correct" ? "#22C55E" : "#EF4444", color: "#fff", fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Continue
          </button>
        </div>
      )}

      {/* Bottom bar — hidden when play step feedback is showing (inline buttons handle it) */}
      {!feedback && !(currentStep?.type === "play" && audioFeedback) && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, borderTop: `1px solid ${BORDER}`, padding: "14px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", background: SURFACE, zIndex: 10 }}>
          {currentStep?.type === "quiz" ? (
            <button onClick={advance}
              style={{ padding: "11px 22px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "transparent", fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1 }}>
              Skip
            </button>
          ) : <div />}

          {currentStep?.type === "complete" ? (
            <button onClick={handleComplete} disabled={logging || difficultyRating === null}
              style={{ marginLeft: "auto", padding: "12px 40px", borderRadius: 8, border: "none", background: difficultyRating !== null ? AMBER : BORDER, color: difficultyRating !== null ? "#fff" : TEXT_DIM, fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, cursor: difficultyRating !== null ? "pointer" : "not-allowed", textTransform: "uppercase", letterSpacing: 1, opacity: logging ? 0.6 : 1, transition: "all 0.2s" }}>
              {logging ? "Saving..." : "Continue"}
            </button>
          ) : currentStep?.type === "quiz" ? (
            <button onClick={handleCheck} disabled={!selected}
              style={{ marginLeft: "auto", padding: "12px 40px", borderRadius: 8, border: "none", background: selected ? AMBER : BORDER, color: selected ? "#fff" : TEXT_DIM, fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, cursor: selected ? "pointer" : "not-allowed", textTransform: "uppercase", letterSpacing: 1, transition: "all 0.2s" }}>
              Check
            </button>
          ) : currentStep?.type === "play" ? (
            <button onClick={advance} disabled={audioLoading}
              style={{ marginLeft: "auto", padding: "12px 40px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "transparent", color: TEXT_DIM, fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, cursor: audioLoading ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: 1, transition: "all 0.2s" }}>
              Skip
            </button>
          ) : (
            <button onClick={advance}
              style={{ marginLeft: "auto", padding: "12px 40px", borderRadius: 8, border: "none", background: AMBER, color: "#fff", fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }}>
              Continue
            </button>
          )}
        </div>
      )}
    </div>
  );
}
