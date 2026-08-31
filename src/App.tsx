import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Hand } from "lucide-react";
import { SnakeEngine, type Phase } from "./game/engine";
import {
  insertScore,
  loadBest,
  loadScores,
  qualifies,
  type ScoreEntry,
} from "./game/storage";
import { GameBoard } from "./components/GameBoard";
import { Hud } from "./components/Hud";
import {
  GameOverScreen,
  PauseScreen,
  StartScreen,
  type GameOverResult,
} from "./components/Overlays";

const DIRS: Record<string, { x: number; y: number }> = {
  arrowup: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

export default function App() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => loadBest());
  const [level, setLevel] = useState(1);
  const [result, setResult] = useState<GameOverResult | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [savedId, setSavedId] = useState<string | null>(null);

  const [engine] = useState(
    () =>
      new SnakeEngine({
        onPhase: setPhase,
        onScore: (s, b) => {
          setScore(s);
          setBest(b);
        },
        onLevel: setLevel,
        onGameOver: (s, isBest, cause) => {
          setResult({ score: s, isBest, cause });
        },
      })
  );
  const [muted, setMuted] = useState(engine.sound.isMuted);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /* ------------------------------ actions ------------------------------ */
  const blurActive = () => (document.activeElement as HTMLElement | null)?.blur?.();

  const play = () => {
    blurActive();
    setSavedId(null);
    setResult(null);
    engine.startGame();
  };
  const togglePause = () => {
    blurActive();
    engine.togglePause();
  };
  const toMenu = () => {
    blurActive();
    engine.toMenu();
  };
  const toggleMute = () => {
    blurActive();
    engine.sound.resume();
    const m = !engine.sound.isMuted;
    engine.sound.setMuted(m);
    setMuted(m);
  };
  const saveName = (name: string) => {
    if (!result) return;
    const { entries, entry } = insertScore(loadScores(), name, result.score);
    setScores(entries);
    setSavedId(entry.id);
    engine.sound.ui();
  };

  /* ----------------------------- keyboard ------------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const k = e.key.toLowerCase();
      if (k.startsWith("arrow") || k === " ") e.preventDefault();

      const dir = DIRS[k];
      if (dir) {
        engine.queueDir(dir);
        return;
      }

      const p = phaseRef.current;
      if (k === " " || k === "p" || k === "escape") {
        if (p === "playing" || p === "paused") engine.togglePause();
        else if (p === "menu" && k === " ") play();
        return;
      }
      if (k === "enter") {
        if (p === "menu") play();
        else if (p === "gameover") play();
        else if (p === "paused") engine.togglePause();
        return;
      }
      if (k === "r") {
        if (p === "gameover" || p === "paused") play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const canSave =
    phase === "gameover" && result !== null && savedId === null && qualifies(scores, result.score);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-jungle-950">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="aurora aurora-a left-[-15%] top-[-20%] h-[60vmax] w-[60vmax] bg-emerald-500/14" />
        <div className="aurora aurora-b bottom-[-25%] right-[-15%] h-[55vmax] w-[55vmax] bg-lime-400/10" />
        <div className="grid-floor absolute inset-0" />
        <div className="noise-overlay" />
      </div>

      <Hud
        score={score}
        best={best}
        level={level}
        muted={muted}
        phase={phase}
        onToggleMute={toggleMute}
        onTogglePause={togglePause}
      />

      {/* game stage */}
      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-3">
        <div
          className="board-glow relative aspect-square overflow-hidden rounded-3xl ring-1 ring-lime-300/25"
          style={{ width: "min(94vw, calc(100dvh - 185px))", maxWidth: 640 }}
        >
          <GameBoard engine={engine} />

          {phase === "menu" && <StartScreen scores={scores} onPlay={play} />}
          {phase === "paused" && (
            <PauseScreen onResume={togglePause} onRestart={play} onMenu={toMenu} />
          )}
          {phase === "gameover" && result && (
            <GameOverScreen
              result={result}
              scores={scores}
              highlightId={savedId}
              canSave={canSave}
              onSave={saveName}
              onRestart={play}
              onMenu={toMenu}
            />
          )}
        </div>
      </main>

      {/* footer hints */}
      <footer className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-center gap-5 px-4 pb-3 pt-1 text-[10px] font-semibold tracking-[0.25em] text-emerald-200/45">
        <span className="hidden items-center gap-2 sm:flex">
          <span className="flex gap-0.5">
            <ArrowUp className="h-3.5 w-3.5 rounded border border-emerald-300/25 p-0.5" />
          </span>
          <span className="flex gap-0.5">
            <ArrowLeft className="h-3.5 w-3.5 rounded border border-emerald-300/25 p-0.5" />
            <ArrowDown className="h-3.5 w-3.5 rounded border border-emerald-300/25 p-0.5" />
            <ArrowRight className="h-3.5 w-3.5 rounded border border-emerald-300/25 p-0.5" />
          </span>
          STEER&nbsp;&nbsp;·&nbsp;&nbsp;SPACE PAUSE&nbsp;&nbsp;·&nbsp;&nbsp;R RESTART
        </span>
        <span className="flex items-center gap-2 sm:hidden">
          <Hand className="h-3.5 w-3.5" />
          SWIPE TO STEER KINZA
        </span>
        <span className="hidden text-emerald-200/30 md:block">
          NO AHMADS WERE HARMED<span className="text-lime-300/50">*</span>
          <span className="ml-1 normal-case tracking-normal text-emerald-200/25">*that&apos;s a lie</span>
        </span>
      </footer>
    </div>
  );
}
