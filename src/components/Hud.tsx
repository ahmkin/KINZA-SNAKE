import { Pause, Play, Trophy, Volume2, VolumeX, Worm, Zap } from "lucide-react";
import { IconButton } from "./ui";
import type { Phase } from "../game/engine";

interface HudProps {
  score: number;
  best: number;
  level: number;
  muted: boolean;
  phase: Phase;
  onToggleMute: () => void;
  onTogglePause: () => void;
}

export function Hud({ score, best, level, muted, phase, onToggleMute, onTogglePause }: HudProps) {
  const newBest = score > 0 && score > best;
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-3xl items-center gap-2 px-3 pt-3 sm:gap-4 sm:px-4">
      {/* logo */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="board-glow grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-lime-400 to-emerald-600 text-emerald-950">
          <Worm className="h-6 w-6" strokeWidth={2.4} />
        </div>
        <span className="hidden font-display text-sm tracking-wider text-lime-200/90 md:block">
          KINZA
          <span className="text-emerald-400/80"> SNAKE</span>
        </span>
      </div>

      {/* score */}
      <div className="flex-1 text-center">
        <div className="text-[10px] font-semibold tracking-[0.35em] text-emerald-300/60">
          SCORE
        </div>
        <div
          key={score}
          className="animate-score-pop font-display text-3xl leading-none text-lime-300 drop-shadow-[0_0_14px_rgba(163,230,53,0.45)] sm:text-4xl"
        >
          {score}
        </div>
      </div>

      {/* stats + actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div
          className="panel-glass hidden items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold text-amber-200 sm:flex"
          title="Best score"
        >
          <Trophy className="h-3.5 w-3.5" />
          <span className="tabular-nums">{Math.max(best, score)}</span>
          {newBest && (
            <span className="animate-best-pulse rounded bg-amber-300/20 px-1 text-[9px] tracking-wider text-amber-300">
              NEW!
            </span>
          )}
        </div>
        <div
          className="panel-glass hidden items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold text-cyan-200 sm:flex"
          title="Speed level"
        >
          <Zap className="h-3.5 w-3.5" />
          <span className="tabular-nums">LV{level}</span>
        </div>
        <IconButton onClick={onToggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
        </IconButton>
        {(phase === "playing" || phase === "paused") && (
          <IconButton onClick={onTogglePause} aria-label={phase === "paused" ? "Resume" : "Pause"}>
            {phase === "paused" ? <Play className="h-4.5 w-4.5" /> : <Pause className="h-4.5 w-4.5" />}
          </IconButton>
        )}
      </div>
    </header>
  );
}
