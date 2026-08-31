import { loadMuted, saveMuted } from "./storage";

type AC = typeof AudioContext;

/**
 * Tiny synthesized sound engine — zero assets, pure WebAudio.
 * Context is created lazily on the first user gesture.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = loadMuted();

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    saveMuted(m);
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.32, this.ctx.currentTime, 0.02);
    }
  }

  /** Must be called from a user gesture at least once. */
  resume(): void {
    if (!this.ctx) {
      const w = window as unknown as { AudioContext?: AC; webkitAudioContext?: AC };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.32;
      this.master.connect(this.ctx.destination);
      // pre-render white noise buffer
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private ready(): boolean {
    return !!this.ctx && this.ctx.state === "running" && !!this.master;
  }

  private blip(
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    delay = 0
  ): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, delay = 0): void {
    if (!this.ready() || !this.noiseBuf) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.15), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /** Juicy rising chomp — pitch climbs with the eat streak. */
  eat(streak: number): void {
    const s = Math.min(streak, 12);
    const base = 260 + s * 34;
    this.blip(base, base * 2.1, 0.11, "square", 0.22);
    this.blip(base * 2, base * 2.6, 0.07, "sine", 0.14, 0.015);
    this.noise(0.06, 0.1, 3600);
  }

  golden(): void {
    this.blip(880, 880, 0.09, "triangle", 0.2);
    this.blip(1174, 1174, 0.09, "triangle", 0.2, 0.07);
    this.blip(1568, 1760, 0.14, "triangle", 0.22, 0.14);
  }

  levelUp(): void {
    this.blip(523, 523, 0.08, "square", 0.16);
    this.blip(659, 659, 0.08, "square", 0.16, 0.08);
    this.blip(784, 1046, 0.16, "square", 0.18, 0.16);
  }

  turn(): void {
    this.blip(1400, 1100, 0.03, "sine", 0.05);
  }

  death(): void {
    this.blip(220, 36, 0.55, "sawtooth", 0.3);
    this.blip(160, 30, 0.6, "square", 0.16, 0.05);
    this.noise(0.5, 0.28, 1400);
  }

  gameOver(): void {
    this.blip(392, 392, 0.14, "triangle", 0.18, 0);
    this.blip(311, 311, 0.14, "triangle", 0.18, 0.15);
    this.blip(262, 262, 0.14, "triangle", 0.18, 0.3);
    this.blip(196, 180, 0.34, "triangle", 0.2, 0.45);
  }

  ui(): void {
    this.blip(740, 920, 0.05, "triangle", 0.12);
  }

  start(): void {
    this.blip(440, 660, 0.09, "square", 0.16);
    this.blip(660, 990, 0.12, "square", 0.16, 0.09);
  }
}
