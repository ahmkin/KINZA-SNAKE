import { useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crown,
  Hand,
  Home,
  Keyboard,
  Play,
  RotateCcw,
  Skull,
  Sparkles,
  Trophy,
} from "lucide-react";
import { ChunkyButton, StaggerText } from "./ui";
import type { ScoreEntry } from "../game/storage";
import type { DeathCause } from "../game/engine";

/* ------------------------------ score table ----------------------------- */

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return <Crown className="h-4 w-4 text-amber-300" />;
  return (
    <span
      className={
        "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold " +
        (rank === 1
          ? "bg-slate-300/25 text-slate-200"
          : rank === 2
            ? "bg-orange-400/25 text-orange-300"
            : "bg-white/5 text-emerald-200/50")
      }
    >
      {rank + 1}
    </span>
  );
}

export function ScoreTable({
  scores,
  highlightId,
  limit = 5,
}: {
  scores: ScoreEntry[];
  highlightId?: string | null;
  limit?: number;
}) {
  return (
    <div className="w-full">
      {scores.slice(0, limit).map((s, i) => (
        <div
          key={s.id}
          className={
            "score-row-in flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm " +
            (s.id === highlightId
              ? "animate-best-pulse bg-lime-400/15 text-lime-200 ring-1 ring-lime-300/40"
              : i % 2 === 0
                ? "bg-white/[0.03]"
                : "")
          }
          style={{ animationDelay: s.id === highlightId ? "0ms" : `${i * 60}ms` }}
        >
          <RankBadge rank={i} />
          <span className="flex-1 truncate font-bold tracking-wider">{s.name}</span>
          <span className="text-[10px] font-medium text-emerald-200/40">{s.date}</span>
          <span className="min-w-12 text-right font-display text-xs text-lime-300 tabular-nums">
            {s.score}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- helpers -------------------------------- */

function OverlayShell({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div
      className={
        "absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 overflow-y-auto p-4 animate-overlay-in " +
        (light ? "bg-emerald-950/45 backdrop-blur-[4px]" : "bg-emerald-950/60 backdrop-blur-md")
      }
    >
      {children}
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="panel-glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-wider text-emerald-100/80">
      {icon}
      {label}
    </div>
  );
}

/* ------------------------------ start screen ---------------------------- */

const WALL_QUIPS = [
  "The wall sends its regards.",
  "Walls: Ahmad's loyal bodyguards.",
  "Kinza took a shortcut. Through concrete.",
];
const SELF_QUIPS = [
  "Kinza bit Kinza. Awkward.",
  "She tasted herself. Verdict: chewy.",
  "Note to self: you are not an Ahmad.",
];

export function StartScreen({ scores, onPlay }: { scores: ScoreEntry[]; onPlay: () => void }) {
  return (
    <OverlayShell light>
      <div className="flex flex-col items-center text-center">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.45em] text-lime-300/70">
          <Sparkles className="h-3.5 w-3.5" />
          SHE'S HUNGRY. HE'S CRUNCHY.
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <StaggerText
          text="KINZA"
          className="title-gradient font-display text-5xl leading-[0.95] drop-shadow-[0_6px_24px_rgba(163,230,53,0.35)] sm:text-7xl"
        />
        <StaggerText
          text="SNAKE"
          className="text-ghost font-display text-5xl leading-[0.95] sm:text-7xl"
          baseDelay={320}
        />
        <p
          className="mt-3 max-w-64 text-xs leading-relaxed text-emerald-100/70 animate-overlay-in sm:max-w-xs sm:text-sm"
          style={{ animationDelay: "650ms" }}
        >
          Kinza is starving and only <span className="font-bold text-amber-300">Ahmad</span> is on
          the menu. Hunt him down. He will panic. He should.
        </p>
      </div>

      {/* play button with orbiting text */}
      <div className="relative h-36 w-36 animate-overlay-in" style={{ animationDelay: "750ms" }}>
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full animate-spin-slow">
          <defs>
            <path
              id="orbit-path"
              d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0"
              fill="none"
            />
          </defs>
          <text
            fontSize="13"
            letterSpacing="4"
            fill="rgba(190,242,100,0.5)"
            fontFamily="'Space Grotesk', sans-serif"
            fontWeight="600"
          >
            <textPath href="#orbit-path">AHMAD IS ON THE MENU • NOM NOM NOM •</textPath>
          </text>
        </svg>
        <button
          onClick={onPlay}
          aria-label="Play"
          className="board-glow group absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-b from-lime-300 to-emerald-500 text-emerald-950 transition-transform duration-200 hover:scale-110 active:scale-95"
        >
          <Play className="h-9 w-9 translate-x-0.5 transition-transform group-hover:scale-110" fill="currentColor" />
        </button>
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-2 animate-overlay-in"
        style={{ animationDelay: "850ms" }}
      >
        <Chip icon={<Keyboard className="h-3.5 w-3.5 text-lime-300" />} label="ARROWS / WASD" />
        <Chip icon={<Hand className="h-3.5 w-3.5 text-cyan-300" />} label="SWIPE TO STEER" />
        <Chip icon={<Sparkles className="h-3.5 w-3.5 text-amber-300" />} label="GOLDEN AHMAD = +50" />
      </div>

      <div
        className="panel-glass hidden w-full max-w-72 rounded-2xl p-3 animate-overlay-in sm:block"
        style={{ animationDelay: "950ms" }}
      >
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] text-amber-200/80">
          <Trophy className="h-3.5 w-3.5" />
          HALL OF FAME
        </div>
        <ScoreTable scores={scores} limit={5} />
      </div>
    </OverlayShell>
  );
}

/* ------------------------------ pause screen ---------------------------- */

export function PauseScreen({
  onResume,
  onRestart,
  onMenu,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <OverlayShell>
      <StaggerText text="PAUSED" className="font-display text-4xl text-lime-200 sm:text-5xl" />
      <p className="text-xs text-emerald-100/60">Kinza is catching her breath. Ahmad is not.</p>
      <div className="flex flex-col items-center gap-2.5">
        <ChunkyButton onClick={onResume} className="w-56">
          <Play className="h-5 w-5" fill="currentColor" />
          RESUME
        </ChunkyButton>
        <div className="flex gap-2.5">
          <ChunkyButton variant="ghost" onClick={onRestart}>
            <RotateCcw className="h-4 w-4" />
            RESTART
          </ChunkyButton>
          <ChunkyButton variant="ghost" onClick={onMenu}>
            <Home className="h-4 w-4" />
            MENU
          </ChunkyButton>
        </div>
      </div>
      <div className="panel-glass flex items-center gap-4 rounded-2xl px-5 py-3 text-emerald-100/70">
        <span className="flex flex-col items-center gap-1 text-[10px] font-semibold tracking-wider">
          <span className="flex gap-0.5">
            <KeyCap><ArrowUp className="h-3 w-3" /></KeyCap>
          </span>
          <span className="flex gap-0.5">
            <KeyCap><ArrowLeft className="h-3 w-3" /></KeyCap>
            <KeyCap><ArrowDown className="h-3 w-3" /></KeyCap>
            <KeyCap><ArrowRight className="h-3 w-3" /></KeyCap>
          </span>
          STEER
        </span>
        <span className="h-8 w-px bg-emerald-300/15" />
        <span className="flex flex-col items-center gap-1 text-[10px] font-semibold tracking-wider">
          <KeyCap wide>SPACE</KeyCap>
          PAUSE
        </span>
        <span className="h-8 w-px bg-emerald-300/15" />
        <span className="flex flex-col items-center gap-1 text-[10px] font-semibold tracking-wider">
          <KeyCap wide>R</KeyCap>
          RESTART
        </span>
      </div>
    </OverlayShell>
  );
}

function KeyCap({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <span
      className={
        "grid h-6 place-items-center rounded-md border border-emerald-300/25 bg-emerald-900/60 text-[9px] font-bold text-lime-200 shadow-[0_2px_0_rgba(163,230,53,0.2)] " +
        (wide ? "px-2" : "w-6")
      }
    >
      {children}
    </span>
  );
}

/* ---------------------------- game over screen -------------------------- */

export interface GameOverResult {
  score: number;
  isBest: boolean;
  cause: DeathCause;
}

export function GameOverScreen({
  result,
  scores,
  highlightId,
  canSave,
  onSave,
  onRestart,
  onMenu,
}: {
  result: GameOverResult;
  scores: ScoreEntry[];
  highlightId: string | null;
  canSave: boolean;
  onSave: (name: string) => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const quip = useRef(
    (result.cause === "wall" ? WALL_QUIPS : SELF_QUIPS)[
      Math.floor(Math.random() * 3)
    ]
  );
  const [name, setName] = useState("");
  const saved = highlightId !== null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(name);
  };

  return (
    <OverlayShell>
      <div className="flex flex-col items-center text-center">
        <div className="mb-1 flex items-center gap-2 text-[10px] font-bold tracking-[0.45em] text-rose-300/80">
          <Skull className="h-3.5 w-3.5" />
          AHMAD LIVES... THIS TIME
        </div>
        <StaggerText
          text="GAME OVER"
          className="danger-gradient font-display text-4xl leading-tight sm:text-6xl"
          step={45}
        />
        <p className="mt-1.5 text-xs italic text-emerald-100/60 animate-overlay-in" style={{ animationDelay: "450ms" }}>
          "{quip.current}"
        </p>
      </div>

      <div className="panel-glass flex items-center gap-6 rounded-2xl px-8 py-4 animate-overlay-in" style={{ animationDelay: "550ms" }}>
        <div className="text-center">
          <div className="text-[9px] font-bold tracking-[0.3em] text-emerald-300/60">SCORE</div>
          <div className="font-display text-4xl text-lime-300 drop-shadow-[0_0_16px_rgba(163,230,53,0.4)]">
            {result.score}
          </div>
        </div>
        {result.isBest && (
          <div className="animate-best-pulse flex flex-col items-center gap-1 rounded-xl bg-amber-400/15 px-4 py-2 ring-1 ring-amber-300/50">
            <Crown className="h-5 w-5 text-amber-300" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-amber-200">NEW BEST!</span>
          </div>
        )}
      </div>

      {canSave && !saved && (
        <form
          onSubmit={submit}
          className="panel-glass flex w-full max-w-72 items-center gap-2 rounded-2xl p-2.5 animate-overlay-in"
          style={{ animationDelay: "650ms" }}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9 ?!.]/g, ""))}
            placeholder="YOUR NAME"
            maxLength={10}
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-emerald-300/20 bg-emerald-950/70 px-3 py-2 font-display text-xs tracking-widest text-lime-200 placeholder:text-emerald-300/30 focus:border-lime-300/60"
          />
          <ChunkyButton type="submit" className="px-4 py-2 text-xs">
            SAVE
          </ChunkyButton>
        </form>
      )}

      <div
        className="panel-glass w-full max-w-72 rounded-2xl p-3 animate-overlay-in"
        style={{ animationDelay: "720ms" }}
      >
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] text-amber-200/80">
          <Trophy className="h-3.5 w-3.5" />
          HALL OF FAME
        </div>
        <ScoreTable scores={scores} highlightId={highlightId} limit={6} />
      </div>

      <div className="flex flex-col items-center gap-2.5 animate-overlay-in" style={{ animationDelay: "820ms" }}>
        <ChunkyButton onClick={onRestart} className="w-56">
          <RotateCcw className="h-5 w-5" />
          GO AGAIN
        </ChunkyButton>
        <ChunkyButton variant="ghost" onClick={onMenu}>
          <Home className="h-4 w-4" />
          MENU
        </ChunkyButton>
        <span className="text-[10px] font-semibold tracking-[0.25em] text-emerald-200/40">
          PRESS <span className="text-lime-300">R</span> FOR INSTANT RESTART
        </span>
      </div>
    </OverlayShell>
  );
}
