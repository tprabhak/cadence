import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000",
});

export interface OnboardData {
  name: string;
  current_level: string;
  goal_song: string;
  goal_event: string;
  deadline_date: string;
  minutes_per_day: number;
  available_days: string[];
}

export const demoLogin = () =>
  api.get("/demo-login").then((r) => r.data as { learner_id: string });

export const onboard = (data: OnboardData) =>
  api.post("/onboard", data).then((r) => r.data);

export const getSession = (learner_id: string) =>
  api.get(`/session/${learner_id}`).then((r) => r.data);

export const getStatus = (learner_id: string) =>
  api.get(`/status/${learner_id}`).then((r) => r.data);

export const logProgress = (data: {
  learner_id: string;
  segment_id: string;
  did_practice: boolean;
  minutes: number;
  confidence: number;
  difficulty_rating?: number;
  stuck_on?: string;
}) => api.post("/progress", data).then((r) => r.data);

export const getQuiz = (learner_id: string, segment_id: string) =>
  api.get(`/quiz/${learner_id}/${segment_id}`).then((r) => r.data);

export const submitQuiz = (learner_id: string, segment_id: string, answers: string[]) =>
  api.post("/quiz/grade", { learner_id, segment_id, answers }).then((r) => r.data);

export const getAudioFeedback = (data: {
  learner_id: string;
  segment_skill: string;
  detected_notes: string[];
  coaching_content: string;
}): Promise<{ feedback: string; quality: "good" | "needs_work" }> =>
  api.post("/audio-feedback", data).then((r) => r.data);

export const searchSongs = (q: string) =>
  api.get(`/search-songs?q=${encodeURIComponent(q)}`).then((r) => r.data);

export const getHistory = (learner_id: string) =>
  api.get(`/history/${learner_id}`).then((r) => r.data);

export const seedDemoHistory = (learner_id: string, adminKey: string) =>
  api.post(`/admin/seed-demo-history/${learner_id}`, {}, { headers: { "X-Admin-Key": adminKey } }).then((r) => r.data);
