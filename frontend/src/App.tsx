import React, { useState } from "react";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import PlanOverview from "./pages/PlanOverview";
import MapPage from "./pages/MapPage";
import LessonPage from "./pages/LessonPage";
import AdminPage from "./pages/AdminPage";
import HistoryPage from "./pages/HistoryPage";

type View = "landing" | "onboarding" | "plan" | "map" | "admin" | "history" | { type: "lesson"; segmentId: string; segmentSkill: string };

export default function App() {
  const stored = localStorage.getItem("cadence_learner_id");
  const [learnerId, setLearnerId] = useState<string | null>(stored);
  const [view, setView] = useState<View>(stored ? "map" : "landing");
  const [mapKey, setMapKey] = useState(0);

  const handleOnboarded = (id: string) => {
    localStorage.setItem("cadence_learner_id", id);
    setLearnerId(id);
    setView("plan");
  };

  const handleDemo = (id: string) => {
    localStorage.setItem("cadence_learner_id", id);
    setLearnerId(id);
    setView("map");
  };

  const handleLessonComplete = () => {
    setMapKey((k) => k + 1);
    setView("map");
  };

  if (view === "admin") return <AdminPage onBack={() => setView("map")} />;

  if (view === "landing") return <Landing onDemo={handleDemo} onGetStarted={() => setView("onboarding")} />;

  if (view === "onboarding" || !learnerId) return <Onboarding onOnboarded={handleOnboarded} />;

  if (view === "plan") {
    return <PlanOverview learnerId={learnerId} onStart={() => setView("map")} />;
  }

  if (view === "history") {
    return <HistoryPage learnerId={learnerId} onBack={() => setView("map")} />;
  }

  if (typeof view === "object" && view.type === "lesson") {
    return (
      <LessonPage
        learnerId={learnerId}
        segmentId={view.segmentId}
        segmentSkill={view.segmentSkill}
        onComplete={handleLessonComplete}
        onExit={() => setView("map")}
      />
    );
  }

  return (
    <>
      <MapPage
        key={mapKey}
        learnerId={learnerId}
        onStartLesson={(segmentId: string, segmentSkill: string) =>
          setView({ type: "lesson", segmentId, segmentSkill })
        }
        onAdmin={() => setView("admin")}
        onHistory={() => setView("history")}
      />
      <div className="mobile-notice">
        Cadence works best on a larger screen — open on desktop for the full experience.
      </div>
    </>
  );
}
