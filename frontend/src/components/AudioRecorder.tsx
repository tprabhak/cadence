import React, { useRef, useState, useCallback, useEffect } from "react";

const AMBER     = "#C9862A";
const AMBER_DIM = "rgba(201,134,42,0.10)";
const BORDER    = "#E8E2D8";
const TEXT_DIM  = "#7A7268";
const RED       = "#EF4444";
const RED_DIM   = "#FEF2F2";

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function frequencyToNote(freq: number): string | null {
  if (freq < 55 || freq > 1600) return null; // saxophone range
  const midi = Math.round(12 * Math.log2(freq / 440)) + 69;
  if (midi < 0 || midi > 127) return null;
  return NOTE_NAMES[midi % 12];
}

// Autocorrelation pitch detection — optimised for saxophone frequency range
function detectPitch(buffer: Float32Array, sampleRate: number, rmsThreshold: number): number {
  const SIZE = buffer.length;

  // RMS check — ignore silence
  let sum = 0;
  for (let i = 0; i < SIZE; i++) sum += buffer[i] * buffer[i];
  if (Math.sqrt(sum / SIZE) < rmsThreshold) return -1;

  // Only search periods in sax range: ~55 Hz–1600 Hz
  const minPeriod = Math.floor(sampleRate / 1600);
  const maxPeriod = Math.min(Math.ceil(sampleRate / 55), Math.floor(SIZE / 2));

  let bestCorr = 0;
  let bestPeriod = -1;

  for (let p = minPeriod; p <= maxPeriod; p++) {
    let corr = 0;
    const n = SIZE - p;
    for (let i = 0; i < n; i++) corr += buffer[i] * buffer[i + p];
    corr /= n;
    if (corr > bestCorr) { bestCorr = corr; bestPeriod = p; }
  }

  if (bestCorr < rmsThreshold || bestPeriod <= 0) return -1;
  return sampleRate / bestPeriod;
}

interface Props {
  onDone: (notes: string[]) => void;
  onAudioUrl?: (url: string) => void;
  disabled?: boolean;
  maxSeconds?: number;
  rmsThreshold?: number;
}

type RecordState = "idle" | "requesting" | "recording" | "done" | "denied";

export default function AudioRecorder({ onDone, onAudioUrl, disabled, maxSeconds, rmsThreshold = 0.015 }: Props) {
  const [state, setState]           = useState<RecordState>("idle");
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [detectedNotes, setDetectedNotes] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [seconds, setSeconds]       = useState(0);

  const audioCtxRef     = useRef<AudioContext | null>(null);
  const processorRef    = useRef<ScriptProcessorNode | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const noteBufferRef   = useRef<string[]>([]);
  const allNotesRef     = useRef<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);

  // Clean up on unmount
  useEffect(() => () => {
    processorRef.current?.disconnect();
    audioCtxRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []); // eslint-disable-line

  const stopRecording = useCallback(() => {
    processorRef.current?.disconnect();
    audioCtxRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);
    processorRef.current = null;
    audioCtxRef.current  = null;
    timerRef.current     = null;
  }, []);

  const startRecording = useCallback(async () => {
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // Capture raw audio for playback
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;

      const ctx       = new AudioContext();
      audioCtxRef.current = ctx;
      const source    = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const buffer = e.inputBuffer.getChannelData(0);

        // Audio level for visualiser
        let lvl = 0;
        for (let i = 0; i < buffer.length; i++) lvl = Math.max(lvl, Math.abs(buffer[i]));
        setAudioLevel(lvl);

        // Pitch detection
        const freq = detectPitch(buffer, ctx.sampleRate, rmsThreshold);
        const note = freq > 0 ? frequencyToNote(freq) : null;

        // Stability: require 3 consecutive same notes before recording
        noteBufferRef.current.push(note ?? "");
        if (noteBufferRef.current.length > 4) noteBufferRef.current.shift();

        const stable = noteBufferRef.current.every(n => n === note && n !== "");
        if (stable && note) {
          setCurrentNote(note);
          allNotesRef.current.push(note);
          setDetectedNotes(prev => {
            // Deduplicate consecutive
            if (prev[prev.length - 1] !== note) return [...prev, note];
            return prev;
          });
        } else if (!note) {
          setCurrentNote(null);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setState("recording");
      allNotesRef.current = [];
      noteBufferRef.current = [];
      setDetectedNotes([]);
      setCurrentNote(null);
      setSeconds(0);

      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      setState("denied");
    }
  }, [rmsThreshold]);

  const handleStop = useCallback(() => {
    stopRecording(); // disconnect pitch detection; stream stays alive for MediaRecorder
    setState("done");
    onDone(allNotesRef.current); // start AI feedback immediately

    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0].type || "audio/webm" });
          onAudioUrl?.(URL.createObjectURL(blob));
        }
      };
      mr.stop();
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [stopRecording, onDone, onAudioUrl]);

  // Auto-stop when maxSeconds reached
  useEffect(() => {
    if (state === "recording" && maxSeconds && seconds >= maxSeconds) {
      handleStop();
    }
  }, [seconds, state, maxSeconds, handleStop]);

  // Waveform bar heights — animate with audio level
  const BAR_COUNT = 20;
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const center = Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2);
    const base   = 1 - center * 0.6;
    const jitter = state === "recording" ? (Math.sin(i * 1.3 + Date.now() * 0.005) * 0.3 + 0.7) : 1;
    return Math.max(4, Math.round(base * jitter * audioLevel * 80 + 6));
  });

  // Animate bars while recording
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (state !== "recording") return;
    const id = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(id);
  }, [state]);
  void tick; // consumed for re-renders

  if (state === "denied") {
    return (
      <div style={{ textAlign: "center", padding: "32px 0", color: TEXT_DIM, fontSize: 14 }}>
        Microphone access denied. Enable it in your browser settings and reload.
      </div>
    );
  }

  if (state === "idle" || state === "requesting") {
    return (
      <div style={{ textAlign: "center", paddingTop: 8 }}>
        <button
          onClick={startRecording}
          disabled={disabled || state === "requesting"}
          style={{
            width: 100, height: 100, borderRadius: "50%",
            background: state === "requesting" ? BORDER : RED,
            border: "none", cursor: state === "requesting" ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: state === "requesting" ? "none" : "0 0 0 8px rgba(239,68,68,0.15)",
            transition: "all 0.2s",
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff" }} />
        </button>
        <div style={{ fontSize: 13, color: TEXT_DIM }}>
          {state === "requesting" ? "Requesting microphone…" : "Tap to start recording"}
        </div>
      </div>
    );
  }

  if (state === "recording") {
    return (
      <div style={{ textAlign: "center" }}>
        {/* Waveform */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 60, marginBottom: 24 }}>
          {bars.map((h, i) => (
            <div key={i} style={{ width: 4, height: h, background: AMBER, borderRadius: 2, transition: "height 0.08s ease" }} />
          ))}
        </div>

        {/* Current note */}
        <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 900, fontSize: 72, color: currentNote ? AMBER : BORDER, lineHeight: 1, marginBottom: 12, minHeight: 80, transition: "color 0.15s" }}>
          {currentNote || "—"}
        </div>

        {/* Detected log */}
        {detectedNotes.length > 0 && (
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
            {detectedNotes.slice(-12).map((n, i) => (
              <span key={i} style={{ background: AMBER_DIM, border: `1px solid ${AMBER}`, borderRadius: 6, padding: "2px 10px", fontSize: 13, color: AMBER, fontWeight: 700 }}>{n}</span>
            ))}
          </div>
        )}

        {/* Timer + stop */}
        <div style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 20 }}>
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
        </div>

        <button onClick={handleStop}
          style={{ padding: "12px 36px", borderRadius: 8, border: `1.5px solid ${RED}`, background: RED_DIM, color: RED, fontFamily: "DM Sans, sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Stop Recording
        </button>
      </div>
    );
  }

  // done state — handled by parent after onDone() callback
  return null;
}
