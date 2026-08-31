export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  date: string;
}

const SCORES_KEY = "kinza-snake:scores:v1";
const BEST_KEY = "kinza-snake:best:v1";
const MUTE_KEY = "kinza-snake:muted:v1";

export const MAX_SCORES = 10;

const SEED_SCORES: ScoreEntry[] = [
  { id: "seed-kinza", name: "KINZA", score: 250, date: "—" },
  { id: "seed-ahmad", name: "AHMAD", score: 180, date: "—" },
  { id: "seed-sly", name: "SLYTHERIN", score: 120, date: "—" },
  { id: "seed-noodle", name: "NOODLE", score: 60, date: "—" },
  { id: "seed-rookie", name: "ROOKIE", score: 25, date: "—" },
];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function saveBest(v: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* storage unavailable */
  }
}

/** Loads persisted scores; falls back to built-in legend scores when empty. */
export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    const parsed = safeParse<ScoreEntry[]>(raw, []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, MAX_SCORES);
    }
  } catch {
    /* ignore */
  }
  return [...SEED_SCORES];
}

export function qualifies(scores: ScoreEntry[], score: number): boolean {
  if (score <= 0) return false;
  if (scores.length < MAX_SCORES) return true;
  return score > scores[scores.length - 1].score;
}

export function insertScore(
  scores: ScoreEntry[],
  name: string,
  score: number
): { entries: ScoreEntry[]; entry: ScoreEntry } {
  const entry: ScoreEntry = {
    id: `s-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    name: name.trim().toUpperCase().slice(0, 10) || "ANON",
    score,
    date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  };
  const entries = [...scores, entry].sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
  return { entries, entry };
}

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMuted(m: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* ignore */
  }
}
