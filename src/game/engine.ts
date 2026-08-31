import { SoundEngine } from "./audio";
import { loadBest, saveBest } from "./storage";

export type Phase = "menu" | "playing" | "paused" | "dying" | "gameover";
export type DeathCause = "wall" | "self";

export interface EngineEvents {
  onPhase: (phase: Phase) => void;
  onScore: (score: number, best: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (score: number, isBest: boolean, cause: DeathCause) => void;
}

interface V {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string; // "r,g,b"
  drag: number;
  grav: number;
  ring: boolean;
}

interface FloatText {
  x: number;
  y: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
  display: boolean;
}

interface Mote {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

const COLS = 21;
const ROWS = 21;
const START_STEP = 150;
const MIN_STEP = 78;
const STEP_DROP = 7;
const EATS_PER_LEVEL = 5;
const GROW_PER_EAT = 2;
const STREAK_WINDOW = 4000;
const MAX_PARTICLES = 420;

const PRAISE = ["NOM!", "YUM!", "TASTY!", "MORE!", "CRUNCH!", "DELICIOUS!", "SNACK!", "GULP!"];
const PANIC = ["HELP!", "NO NO NO!", "KINZA?!", "NOT ME!", "I TASTE BAD!", "MAMA!", "WHY ME?!", "RUN AWAY!"];
const LAST_WORDS = ["OW!", "NOOO!", "WHY?!", "MY LEG!", "AGH!", "TELL MY STORY...", "I BLAME YOU", "NOT THE FACE!"];

const COL = {
  lime: "190,242,100",
  emerald: "74,222,128",
  amber: "252,211,77",
  gold: "251,191,36",
  white: "235,255,245",
  red: "248,113,113",
  rose: "251,113,133",
  cyan: "103,232,249",
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function mixRGB(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}

export class SnakeEngine {
  readonly sound = new SoundEngine();
  phase: Phase = "menu";
  score = 0;
  best = loadBest();
  level = 1;

  private events: EngineEvents;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private lastNow = 0;

  // layout
  private size = 300;
  private dpr = 1;
  private cell = 300 / COLS;
  private bg: HTMLCanvasElement | null = null;
  private glowCache = new Map<string, HTMLCanvasElement>();

  // world
  private seg: V[] = [];
  private prev: V[] = [];
  private dir: V = { x: 1, y: 0 };
  private queue: V[] = [];
  private food: V = { x: 15, y: 10 };
  private golden: V | null = null;
  private goldenT = 0;
  private growing = 0;

  // timing
  private acc = 0;
  private stepMs = START_STEP;
  private alpha = 1;
  private eats = 0;
  private streak = 0;
  private lastEatAt = 0;
  private deathT = 0;
  private deathCause: DeathCause = "wall";
  private sparkleT = 0;

  // fx
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private motes: Mote[] = [];
  private trauma = 0;
  private flashR = 0;
  private flashW = 0;
  private eatPulse = 0;

  constructor(events: EngineEvents) {
    this.events = events;
    this.resetSnake();
    this.spawnMotes();
  }

  /* ------------------------------ lifecycle ----------------------------- */

  attach(canvas: HTMLCanvasElement): void {
    if (this.canvas === canvas) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.lastNow = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  detach(): void {
    cancelAnimationFrame(this.raf);
    this.canvas = null;
    this.ctx = null;
  }

  resize(px: number): void {
    if (px <= 0) return;
    this.size = px;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas) {
      this.canvas.width = Math.round(px * this.dpr);
      this.canvas.height = Math.round(px * this.dpr);
    }
    this.cell = px / COLS;
    this.buildBg();
  }

  /* ------------------------------ public API ---------------------------- */

  setPhase(p: Phase): void {
    this.phase = p;
    this.events.onPhase(p);
  }

  startGame(): void {
    this.sound.resume();
    this.sound.start();
    this.resetSnake();
    this.score = 0;
    this.eats = 0;
    this.streak = 0;
    this.level = 1;
    this.stepMs = START_STEP;
    this.particles = [];
    this.texts = [];
    this.golden = null;
    this.acc = 0;
    this.flashW = 0.5;
    this.trauma = 0;
    this.food = this.spawnFoodCell([null]);
    this.events.onScore(0, this.best);
    this.events.onLevel(1);
    this.setPhase("playing");
    this.addText(this.size / 2, this.size * 0.42, "GO!", "#bef264", this.size * 0.09, true);
  }

  toMenu(): void {
    this.sound.ui();
    this.resetSnake();
    this.particles = [];
    this.texts = [];
    this.setPhase("menu");
  }

  togglePause(): void {
    if (this.phase === "playing") {
      this.sound.ui();
      this.setPhase("paused");
    } else if (this.phase === "paused") {
      this.sound.ui();
      // discard accumulated time so the snake doesn't lurch
      this.acc = 0;
      this.setPhase("playing");
    }
  }

  queueDir(d: V): void {
    if (this.phase !== "playing") return;
    const last = this.queue.length > 0 ? this.queue[this.queue.length - 1] : this.dir;
    const opposite = d.x === -last.x && d.y === -last.y;
    const same = d.x === last.x && d.y === last.y;
    if (opposite || same) return;
    if (this.queue.length < 3) this.queue.push(d);
  }

  /* -------------------------------- setup ------------------------------- */

  private resetSnake(): void {
    const cy = Math.floor(ROWS / 2);
    this.seg = [
      { x: 7, y: cy },
      { x: 6, y: cy },
      { x: 5, y: cy },
      { x: 4, y: cy },
    ];
    this.prev = this.seg.map((s) => ({ ...s }));
    this.dir = { x: 1, y: 0 };
    this.queue = [];
    this.growing = 0;
    this.alpha = 1;
    this.alphaReset();
  }

  private alphaReset(): void {
    this.acc = 0;
  }

  private spawnMotes(): void {
    this.motes = [];
    for (let i = 0; i < 22; i++) {
      this.motes.push({
        x: Math.random(),
        y: Math.random(),
        r: rand(0.6, 2.2),
        speed: rand(0.008, 0.03),
        phase: rand(0, Math.PI * 2),
      });
    }
  }

  private cellsFree(exclude: (V | null)[]): V[] {
    const taken = new Set<string>();
    for (const s of this.seg) taken.add(`${s.x},${s.y}`);
    for (const e of exclude) if (e) taken.add(`${e.x},${e.y}`);
    const free: V[] = [];
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!taken.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    return free;
  }

  private spawnFoodCell(exclude: (V | null)[]): V {
    const free = this.cellsFree(exclude);
    if (free.length === 0) return { x: 0, y: 0 };
    const head = this.seg[0];
    const far = free.filter((c) => Math.abs(c.x - head.x) + Math.abs(c.y - head.y) >= 5);
    return pick(far.length > 0 ? far : free);
  }

  /* -------------------------------- loop -------------------------------- */

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = clamp(now - this.lastNow, 0, 50);
    this.lastNow = now;
    this.update(dt, now);
    this.render(now);
  };

  private update(dt: number, now: number): void {
    const active = this.phase === "playing" || this.phase === "menu";
    if (active) {
      this.acc += dt;
      let guard = 0;
      while (this.acc >= this.stepMs && guard < 6) {
        this.step(now);
        this.acc -= this.stepMs;
        guard++;
      }
      if (guard >= 6) this.acc = 0;
      this.alpha = clamp(this.acc / this.stepMs, 0, 1);
    }

    if (this.phase === "dying") {
      this.deathT += dt;
      if (this.deathT > 950) this.finishDeath();
    }

    // golden despawn
    if (this.golden) {
      this.goldenT -= dt;
      this.sparkleT -= dt;
      if (this.sparkleT <= 0) {
        this.sparkleT = 110;
        const p = this.cellCenter(this.golden);
        this.spawnParticles(p.x, p.y, 2, COL.gold, 40, 0.35, { grav: -40, drag: 0.92 });
      }
      if (this.goldenT <= 0) {
        const p = this.cellCenter(this.golden);
        this.spawnParticles(p.x, p.y, 10, COL.amber, 90, 0.5, {});
        this.golden = null;
      }
    }

    // particles
    const dtf = dt / 16.667;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const dragF = Math.pow(p.drag, dtf);
      p.vx *= dragF;
      p.vy *= dragF;
      p.vy += p.grav * (dt / 1000);
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
    }

    // texts
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= dt * 0.035;
      if (t.life <= 0) this.texts.splice(i, 1);
    }

    // motes drift
    for (const m of this.motes) {
      m.y -= m.speed * (dt / 1000);
      if (m.y < -0.02) {
        m.y = 1.02;
        m.x = Math.random();
      }
    }

    // fx decay
    this.trauma = Math.max(0, this.trauma - dt / 550);
    this.flashR = Math.max(0, this.flashR - dt / 500);
    this.flashW = Math.max(0, this.flashW - dt / 350);
    this.eatPulse = Math.max(0, this.eatPulse - dt / 300);
  }

  private step(now: number): void {
    const playing = this.phase === "playing";
    if (!playing && this.phase !== "menu") return;

    if (this.queue.length > 0) this.dir = this.queue.shift()!;
    if (!playing) this.autopilot();

    const head = this.seg[0];
    const nh: V = { x: head.x + this.dir.x, y: head.y + this.dir.y };

    this.prev = this.seg.map((s) => ({ ...s }));

    const hitWall = nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS;
    const body = this.growing > 0 ? this.seg : this.seg.slice(0, -1);
    const hitSelf = body.some((s) => s.x === nh.x && s.y === nh.y);

    if (hitWall || hitSelf) {
      if (playing) this.die(hitWall ? "wall" : "self");
      else this.resetSnake();
      return;
    }

    this.seg.unshift(nh);
    if (this.growing > 0) this.growing--;
    else this.seg.pop();

    if (nh.x === this.food.x && nh.y === this.food.y) this.onEat(false, now, playing);
    if (this.golden && nh.x === this.golden.x && nh.y === this.golden.y) this.onEat(true, now, playing);
  }

  private autopilot(): void {
    const head = this.seg[0];
    const target = this.golden ?? this.food;
    const dirs: V[] = [
      this.dir,
      { x: this.dir.y, y: -this.dir.x },
      { x: -this.dir.y, y: this.dir.x },
    ];
    const cost = (d: V) => Math.abs(head.x + d.x - target.x) + Math.abs(head.y + d.y - target.y);
    dirs.sort((a, b) => cost(a) - cost(b));
    for (const d of dirs) {
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (this.seg.some((s) => s.x === nx && s.y === ny)) continue;
      this.dir = d;
      return;
    }
  }

  /* -------------------------------- eating ------------------------------ */

  private onEat(goldenHit: boolean, now: number, playing: boolean): void {
    const cellRef = goldenHit ? this.golden! : this.food;
    const p = this.cellCenter(cellRef);

    // streak & scoring
    let gained = 0;
    if (playing) {
      if (now - this.lastEatAt < STREAK_WINDOW) this.streak++;
      else this.streak = 1;
      this.lastEatAt = now;
      const bonus = Math.min(50, (this.streak - 1) * 5);
      gained = goldenHit ? 50 + bonus : 10 + bonus;
      this.score += gained;
      this.events.onScore(this.score, this.best);
    }

    // growth (capped in menu attract mode)
    const cap = playing ? Infinity : 14;
    if (this.seg.length < cap) this.growing += GROW_PER_EAT;

    // fx
    this.eatPulse = 1;
    this.trauma = Math.min(1, this.trauma + (goldenHit ? 0.45 : 0.28));
    this.spawnBurst(p.x, p.y, goldenHit);

    if (playing) {
      this.addText(p.x, p.y - this.cell, `+${gained}`, goldenHit ? "#fde68a" : "#d9f99d", this.cell * 1.05, true);
      this.addText(p.x + this.cell * 0.4, p.y - this.cell * 1.9, pick(PRAISE), "#a7f3d0", this.cell * 0.6, true);
      this.addText(p.x - this.cell * 0.3, p.y + this.cell * 1.2, pick(LAST_WORDS), "#fda4af", this.cell * 0.5, true);
      if (goldenHit) {
        this.flashW = 0.55;
        this.sound.golden();
      } else {
        this.sound.eat(this.streak);
      }
      if (this.streak >= 3) {
        this.addText(p.x, p.y + this.cell * 2.1, `STREAK x${this.streak}`, "#67e8f9", this.cell * 0.55, true);
      }
    }

    // respawn / golden scheduling
    if (goldenHit) {
      this.golden = null;
    } else {
      if (playing) {
        this.eats++;
        const nl = Math.floor(this.eats / EATS_PER_LEVEL) + 1;
        if (nl > this.level) {
          this.level = nl;
          this.stepMs = Math.max(MIN_STEP, START_STEP - (nl - 1) * STEP_DROP);
          this.events.onLevel(nl);
          this.sound.levelUp();
          this.addText(this.size / 2, this.size * 0.34, `LEVEL ${nl}`, "#7dd3fc", this.size * 0.075, true);
          this.addText(this.size / 2, this.size * 0.34 + this.size * 0.06, "KINZA GOES FASTER", "#bae6fd", this.size * 0.03, true);
        }
        if (this.eats % 4 === 0) {
          this.golden = this.spawnFoodCell([this.food]);
          this.goldenT = 6500;
        }
      }
      this.food = this.spawnFoodCell([this.golden]);
    }
  }

  private spawnBurst(x: number, y: number, goldenBurst: boolean): void {
    const n = goldenBurst ? 34 : 20;
    const colors = goldenBurst ? [COL.gold, COL.amber, COL.white] : [COL.amber, COL.rose, COL.white, COL.lime];
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(60, goldenBurst ? 340 : 240);
      this.pushParticle({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0, max: rand(320, goldenBurst ? 800 : 600),
        size: rand(2, goldenBurst ? 6 : 5),
        color: pick(colors),
        drag: 0.9, grav: 60, ring: false,
      });
      this.particles[this.particles.length - 1].life = this.particles[this.particles.length - 1].max;
    }
    this.pushParticle({ x, y, vx: 0, vy: 0, life: 340, max: 340, size: this.cell * (goldenBurst ? 4.5 : 3), color: goldenBurst ? COL.gold : COL.amber, drag: 1, grav: 0, ring: true });
  }

  /* -------------------------------- death ------------------------------- */

  private die(cause: DeathCause): void {
    this.deathCause = cause;
    this.sound.death();
    this.trauma = 1;
    this.flashR = 0.9;
    this.deathT = 0;
    this.setPhase("dying");

    // explode the whole body
    const stride = Math.max(1, Math.floor(this.seg.length / 46));
    for (let i = 0; i < this.seg.length; i += stride) {
      const p = this.cellCenter(this.seg[i]);
      for (let k = 0; k < 5; k++) {
        const ang = rand(0, Math.PI * 2);
        const spd = rand(40, 260);
        const max = rand(400, 950);
        this.pushParticle({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 40,
          life: max, max, size: rand(2, 6),
          color: pick([COL.lime, COL.emerald, COL.red, COL.white]),
          drag: 0.92, grav: 220, ring: false,
        });
      }
    }
    const h = this.cellCenter(this.seg[0]);
    this.pushParticle({ x: h.x, y: h.y, vx: 0, vy: 0, life: 450, max: 450, size: this.cell * 5, color: COL.red, drag: 1, grav: 0, ring: true });
    this.addText(h.x, h.y - this.cell, cause === "wall" ? "BONK!" : "THAT'S... ME?", "#fca5a5", this.cell * 0.9, true);
  }

  private finishDeath(): void {
    const isBest = this.score > this.best;
    if (isBest) {
      this.best = this.score;
      saveBest(this.best);
    }
    this.setPhase("gameover");
    this.sound.gameOver();
    this.events.onGameOver(this.score, isBest, this.deathCause);
  }

  /* ------------------------------ particles ----------------------------- */

  private pushParticle(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(p);
  }

  private spawnParticles(
    x: number,
    y: number,
    n: number,
    color: string,
    speed: number,
    size: number,
    opts: { grav?: number; drag?: number }
  ): void {
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(speed * 0.3, speed);
      const max = rand(280, 700);
      this.pushParticle({
        x, y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: max, max, size: rand(1, Math.max(2, size * 6)),
        color, drag: opts.drag ?? 0.92, grav: opts.grav ?? 30, ring: false,
      });
    }
  }

  private addText(x: number, y: number, text: string, color: string, size: number, display: boolean): void {
    this.texts.push({
      x: clamp(x, size, this.size - size),
      y: clamp(y, size * 1.2, this.size - size),
      life: 950, max: 950, text, color, size, display,
    });
  }

  /* ------------------------------ rendering ----------------------------- */

  private cellCenter(c: V): V {
    return { x: (c.x + 0.5) * this.cell, y: (c.y + 0.5) * this.cell };
  }

  private buildBg(): void {
    const c = document.createElement("canvas");
    c.width = Math.round(this.size * this.dpr);
    c.height = Math.round(this.size * this.dpr);
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(this.dpr, this.dpr);
    const s = this.size;

    // base
    const base = g.createLinearGradient(0, 0, 0, s);
    base.addColorStop(0, "#061e12");
    base.addColorStop(0.5, "#04150d");
    base.addColorStop(1, "#02100a");
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);

    // checkered cells, very subtle
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if ((x + y) % 2 === 0) {
          g.fillStyle = "rgba(163,230,53,0.022)";
          g.fillRect(x * this.cell, y * this.cell, this.cell, this.cell);
        }
      }
    }

    // grid lines
    g.strokeStyle = "rgba(163,230,53,0.055)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < COLS; i++) {
      g.moveTo(i * this.cell, 0);
      g.lineTo(i * this.cell, s);
      g.moveTo(0, i * this.cell);
      g.lineTo(s, i * this.cell);
    }
    g.stroke();

    // vignette
    const vg = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.5)");
    g.fillStyle = vg;
    g.fillRect(0, 0, s, s);

    this.bg = c;
  }

  private glow(color: string): HTMLCanvasElement {
    const cached = this.glowCache.get(color);
    if (cached) return cached;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(${color},0.85)`);
    grad.addColorStop(0.35, `rgba(${color},0.28)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this.glowCache.set(color, c);
    return c;
  }

  private drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.glow(color), x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  private render(now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = this.size;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // background
    if (this.bg) ctx.drawImage(this.bg, 0, 0, s, s);
    else {
      ctx.fillStyle = "#04150d";
      ctx.fillRect(0, 0, s, s);
    }

    // ambient dust motes
    for (const m of this.motes) {
      const tw = 0.5 + 0.5 * Math.sin(now * 0.0012 + m.phase);
      ctx.fillStyle = `rgba(190,242,100,${0.05 + tw * 0.1})`;
      ctx.beginPath();
      ctx.arc(m.x * s, m.y * s, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // screen shake
    ctx.save();
    if (this.trauma > 0) {
      const sh = this.trauma * this.trauma * s * 0.035;
      ctx.translate(rand(-sh, sh), rand(-sh, sh));
    }

    this.drawDangerEdges(ctx, now);

    // food
    const fp = this.cellCenter(this.food);
    this.drawAhmad(ctx, fp.x, fp.y, this.cell * 0.46, now, false, this.food);
    if (this.golden) {
      const gp = this.cellCenter(this.golden);
      const blink = this.goldenT < 2000 ? 0.45 + 0.55 * Math.abs(Math.sin(now * 0.012)) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      this.drawAhmad(ctx, gp.x, gp.y, this.cell * 0.46, now, true, this.golden);
      ctx.restore();
    }

    // snake
    if (this.phase !== "dying") this.drawKinza(ctx, now);

    this.drawParticles(ctx);
    this.drawTexts(ctx);

    ctx.restore();

    // flashes
    if (this.flashR > 0) {
      ctx.fillStyle = `rgba(239,68,68,${this.flashR * 0.28})`;
      ctx.fillRect(0, 0, s, s);
    }
    if (this.flashW > 0) {
      ctx.fillStyle = `rgba(240,253,244,${this.flashW * 0.3})`;
      ctx.fillRect(0, 0, s, s);
    }
  }

  private drawDangerEdges(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.phase !== "playing" || this.seg.length === 0) return;
    const h = this.renderHead();
    const reach = this.cell * 1.8;
    const pulse = 0.55 + 0.45 * Math.sin(now * 0.02);
    const th = this.cell * 1.1;
    const s = this.size;
    const edges: [number, number, number, number, number][] = [
      [h.y, 0, 0, s, th], // top
      [s - h.y, 0, s - th, s, th], // bottom
      [h.x, 0, 0, th, s], // left
      [s - h.x, 0, s - th, th, s], // right
    ];
    for (const [gap, x, y, w, hh] of edges) {
      if (gap < reach) {
        const a = (1 - gap / reach) * 0.3 * pulse;
        ctx.fillStyle = `rgba(248,113,113,${a.toFixed(3)})`;
        ctx.fillRect(x, y, w, hh);
      }
    }
  }

  private renderHead(): V {
    const h = this.seg[0];
    const p = this.prev[0] ?? h;
    return {
      x: (lerp(p.x, h.x, this.alpha) + 0.5) * this.cell,
      y: (lerp(p.y, h.y, this.alpha) + 0.5) * this.cell,
    };
  }

  private renderPoints(): V[] {
    const pts: V[] = [];
    for (let i = 0; i < this.seg.length; i++) {
      const sgm = this.seg[i];
      const pv = this.prev[i] ?? sgm;
      // prevent wild stretch when wrapping interpolation at spawn
      let dx = sgm.x - pv.x;
      let dy = sgm.y - pv.y;
      if (Math.abs(dx) > 2) dx = 0;
      if (Math.abs(dy) > 2) dy = 0;
      pts.push({
        x: (pv.x + dx * this.alpha + 0.5) * this.cell,
        y: (pv.y + dy * this.alpha + 0.5) * this.cell,
      });
    }
    return pts;
  }

  private bodyColor(t: number): string {
    const head: [number, number, number] = [190, 242, 100];
    const mid: [number, number, number] = [52, 211, 153];
    const tail: [number, number, number] = [6, 95, 70];
    if (t < 0.45) return mixRGB(head, mid, t / 0.45);
    return mixRGB(mid, tail, (t - 0.45) / 0.55);
  }

  private drawKinza(ctx: CanvasRenderingContext2D, now: number): void {
    const pts = this.renderPoints();
    if (pts.length === 0) return;
    const n = pts.length;
    const cell = this.cell;
    const headW = cell * 0.86;
    const tailW = cell * 0.2;

    // soft glow trail
    for (let i = n - 1; i > 0; i -= 4) {
      const t = i / (n - 1);
      this.drawGlow(ctx, pts[i].x, pts[i].y, cell * (1.3 - t * 0.5), t < 0.4 ? COL.lime : COL.emerald, 0.1 * (1 - t));
    }

    // body
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const wobbleT = now * 0.008;
    for (let i = n - 1; i >= 1; i--) {
      const t = i / (n - 1);
      const pulse = 1 + this.eatPulse * 0.35 * Math.max(0, 1 - t * 8);
      const slither = 1 + Math.sin(wobbleT - i * 0.55) * 0.045;
      ctx.strokeStyle = this.bodyColor(t);
      ctx.lineWidth = lerp(headW, tailW, Math.pow(t, 0.8)) * pulse * slither;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
      ctx.stroke();
    }

    // ---- head ----
    const h = pts[0];
    const n1 = pts[1] ?? { x: h.x - this.dir.x * cell, y: h.y - this.dir.y * cell };
    const ang = Math.atan2(h.y - n1.y, h.x - n1.x);
    const R = cell * 0.5 * (1 + this.eatPulse * 0.3);

    this.drawGlow(ctx, h.x, h.y, R * 3.2, COL.lime, 0.25);

    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(ang);

    // head base
    const hg = ctx.createLinearGradient(0, -R, 0, R);
    hg.addColorStop(0, "#bef264");
    hg.addColorStop(1, "#65a30d");
    ctx.fillStyle = hg;
    ctx.strokeStyle = "#1a2e05";
    ctx.lineWidth = R * 0.1;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // open mouth when swallowing
    if (this.eatPulse > 0.15) {
      ctx.fillStyle = "#3f1207";
      ctx.beginPath();
      ctx.ellipse(R * 0.62, 0, R * 0.5 * this.eatPulse, R * 0.62 * this.eatPulse, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // tongue flick
    if (now % 1500 < 260 && this.eatPulse <= 0.15) {
      const wig = Math.sin(now * 0.09) * R * 0.08;
      const len = R * (0.5 + 0.4 * Math.abs(Math.sin(now * 0.045)));
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = R * 0.09;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(R * 0.85, 0);
      ctx.lineTo(R * 0.85 + len, wig);
      ctx.moveTo(R * 0.85 + len, wig);
      ctx.lineTo(R * 0.85 + len + R * 0.22, wig + R * 0.16);
      ctx.moveTo(R * 0.85 + len, wig);
      ctx.lineTo(R * 0.85 + len + R * 0.22, wig - R * 0.16);
      ctx.stroke();
    }

    // eyes (look toward the food!)
    const toFoodWorld = { x: (this.food.x + 0.5) * cell - h.x, y: (this.food.y + 0.5) * cell - h.y };
    const mag = Math.hypot(toFoodWorld.x, toFoodWorld.y) || 1;
    const la = -ang;
    const lookX = (Math.cos(la) * toFoodWorld.x - Math.sin(la) * toFoodWorld.y) / mag;
    const lookY = (Math.sin(la) * toFoodWorld.x + Math.cos(la) * toFoodWorld.y) / mag;
    const blink = now % 3200 > 3060 ? 0.12 : 1;

    for (const side of [-1, 1]) {
      const ex = R * 0.18;
      const ey = side * R * 0.52;
      // shadow "eyeshadow"
      ctx.fillStyle = "rgba(244,114,182,0.5)";
      ctx.beginPath();
      ctx.ellipse(ex - R * 0.04, ey, R * 0.34, R * 0.3 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      // white
      ctx.fillStyle = "#f0fdf4";
      ctx.beginPath();
      ctx.ellipse(ex, ey, R * 0.28, R * 0.26 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      if (blink > 0.5) {
        ctx.fillStyle = "#052e16";
        ctx.beginPath();
        ctx.arc(ex + lookX * R * 0.1, ey + lookY * R * 0.1, R * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ex + lookX * R * 0.1 + R * 0.04, ey + lookY * R * 0.1 - R * 0.04, R * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
      // lashes
      ctx.strokeStyle = "#052e16";
      ctx.lineWidth = R * 0.055;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const lx = ex - R * 0.1 + k * R * 0.12;
        const ly = ey + side * R * 0.24;
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - R * 0.06, ly + side * R * 0.18);
      }
      ctx.stroke();
      // blush
      ctx.fillStyle = "rgba(251,113,133,0.4)";
      ctx.beginPath();
      ctx.arc(R * 0.1, side * R * 0.34, R * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }

    // the pink bow — it's Kinza, after all
    ctx.save();
    ctx.translate(-R * 0.28, -R * 0.78);
    ctx.rotate(Math.sin(now * 0.004) * 0.12 - 0.35);
    ctx.fillStyle = "#f472b6";
    ctx.strokeStyle = "#9d174d";
    ctx.lineWidth = R * 0.06;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(sd * R * 0.42, -R * 0.34, sd * R * 0.52, R * 0.02);
      ctx.quadraticCurveTo(sd * R * 0.42, R * 0.34, 0, R * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#fbcfe8";
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  private drawAhmad(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    now: number,
    golden: boolean,
    cellPos: V
  ): void {
    const t = now / 1000;
    const h = this.renderHead();
    const distCells = Math.hypot(cx - h.x, cy - h.y) / this.cell;
    const panicDist = golden ? 6 : 4.5;
    const panic = (this.phase === "playing" || this.phase === "dying") && distCells < panicDist;
    const bob = Math.sin(t * 2.4 + cellPos.x * 1.7) * this.cell * 0.06;
    const tremble = panic ? Math.sin(now * 0.06) * r * 0.06 : 0;
    const R = r * (1 + Math.sin(t * 5 + cellPos.y) * 0.045) * (panic ? 0.94 : 1);
    const x = cx + tremble;
    const y = cy + bob;

    // glow
    const glowCol = golden ? COL.gold : panic ? "251,146,60" : COL.amber;
    const glowA = golden ? 0.5 + 0.2 * Math.sin(t * 6) : panic ? 0.42 + 0.18 * Math.sin(now * 0.05) : 0.3;
    this.drawGlow(ctx, x, y, R * 3.4, glowCol, glowA);

    // face
    ctx.fillStyle = golden ? "#ffdf9e" : "#ffd9ae";
    ctx.strokeStyle = golden ? "#b45309" : "#9a5b24";
    ctx.lineWidth = R * 0.09;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // hair cap
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, R * 0.97, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#4a3521";
    ctx.beginPath();
    ctx.ellipse(x, y - R * 0.72, R * 0.92, R * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // crown for golden Ahmad
    if (golden) {
      ctx.save();
      ctx.translate(x, y - R * 1.12);
      ctx.rotate(Math.sin(t * 3) * 0.08);
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#92600a";
      ctx.lineWidth = R * 0.06;
      ctx.beginPath();
      const cw = R * 0.66;
      const ch = R * 0.5;
      ctx.moveTo(-cw, 0);
      ctx.lineTo(-cw, -ch * 0.6);
      ctx.lineTo(-cw * 0.5, -ch * 0.15);
      ctx.lineTo(0, -ch);
      ctx.lineTo(cw * 0.5, -ch * 0.15);
      ctx.lineTo(cw, -ch * 0.6);
      ctx.lineTo(cw, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // eyes track the snake (in fear)
    const dirx = (h.x - x) / (distCells * this.cell || 1);
    const diry = (h.y - y) / (distCells * this.cell || 1);
    for (const side of [-1, 1]) {
      const ex = x + side * R * 0.34;
      const ey = y - R * 0.08 - R * 0.18;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(ex, ey, R * (panic ? 0.21 : 0.15), R * (panic ? 0.24 : 0.17), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1c1006";
      ctx.beginPath();
      ctx.arc(ex + dirx * R * 0.07, ey + diry * R * 0.07, R * (panic ? 0.075 : 0.065), 0, Math.PI * 2);
      ctx.fill();
    }
    // brows
    ctx.strokeStyle = "#4a3521";
    ctx.lineWidth = R * 0.06;
    ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      const bx = x + side * R * 0.34;
      const by = y - R * (panic ? 0.62 : 0.5) - R * 0.0;
      ctx.beginPath();
      if (panic) {
        ctx.moveTo(bx - side * R * 0.16, by - R * 0.06);
        ctx.lineTo(bx + side * R * 0.16, by + R * 0.08);
      } else {
        ctx.moveTo(bx - side * R * 0.14, by);
        ctx.lineTo(bx + side * R * 0.14, by - R * 0.03);
      }
      ctx.stroke();
    }

    // mouth
    if (panic) {
      ctx.fillStyle = "#5b2506";
      ctx.beginPath();
      ctx.ellipse(x, y + R * 0.42, R * 0.2, R * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      // sweat drop
      const sw = (now * 0.004) % 1;
      ctx.fillStyle = "rgba(125,211,252,0.9)";
      ctx.beginPath();
      ctx.arc(x + R * 0.78, y - R * 0.5 + sw * R * 0.4, R * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#5b2506";
      ctx.lineWidth = R * 0.07;
      ctx.beginPath();
      ctx.arc(x, y + R * 0.2, R * 0.3, 0.25, Math.PI - 0.25);
      ctx.stroke();
    }

    // name tag
    const labelY = y - R * (golden ? 1.95 : 1.52);
    ctx.font = `700 ${Math.max(9, this.cell * 0.3)}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = golden ? "GOLDEN AHMAD" : "AHMAD";
    const lw = ctx.measureText(label).width + this.cell * 0.36;
    ctx.fillStyle = golden ? "rgba(120,53,15,0.85)" : "rgba(4,20,12,0.75)";
    this.roundRect(ctx, x - lw / 2, labelY - this.cell * 0.24, lw, this.cell * 0.48, this.cell * 0.22);
    ctx.fill();
    ctx.fillStyle = golden ? "#fef08a" : "#fde68a";
    ctx.fillText(label, x, labelY + 0.5);

    // panic speech bubble
    if (panic && this.phase === "playing") {
      const phrase = PANIC[Math.floor(now / 900) % PANIC.length];
      const by = labelY - this.cell * (golden ? 1.15 : 1.0);
      ctx.font = `700 ${Math.max(10, this.cell * 0.34)}px "Space Grotesk", sans-serif`;
      const pw = ctx.measureText(phrase).width + this.cell * 0.5;
      const ph = Math.max(14, this.cell * 0.56);
      ctx.fillStyle = "#f0fdf4";
      this.roundRect(ctx, x - pw / 2, by - ph / 2, pw, ph, ph * 0.4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - this.cell * 0.12, by + ph / 2 - 1);
      ctx.lineTo(x + this.cell * 0.12, by + ph / 2 - 1);
      ctx.lineTo(x, by + ph / 2 + this.cell * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#052e16";
      ctx.fillText(phrase, x, by + 1);
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      const lifeT = p.life / p.max;
      const a = lifeT < 0.6 ? lifeT / 0.6 : 1;
      if (p.ring) {
        const prog = 1 - lifeT;
        ctx.strokeStyle = `rgba(${p.color},${(a * 0.8).toFixed(3)})`;
        ctx.lineWidth = 3 * lifeT + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * prog + 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${p.color},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + lifeT * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawTexts(ctx: CanvasRenderingContext2D): void {
    if (this.texts.length === 0) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const t of this.texts) {
      const lifeT = t.life / t.max;
      const a = clamp(lifeT * 2, 0, 1);
      const pop = 1 + (1 - Math.min(1, (t.max - t.life) / 150)) * 0.6;
      ctx.font = `400 ${t.size * pop}px ${t.display ? '"Bungee", ' : ""}"Space Grotesk", sans-serif`;
      ctx.globalAlpha = a;
      ctx.lineWidth = Math.max(2, t.size * 0.12);
      ctx.strokeStyle = "rgba(2,16,10,0.8)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}
