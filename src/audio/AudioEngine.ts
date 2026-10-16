// Web Audio synthesis for every sound in the game: no audio files are downloaded.
// The context is created on the first user gesture (iOS requires it) via unlock().

export type SfxName =
  | 'shot'
  | 'hit'
  | 'kill'
  | 'barrierHit'
  | 'barrierBreak'
  | 'gateGood'
  | 'gateBad'
  | 'soldierLost'
  | 'bossRoar'
  | 'bossHit'
  | 'bossDeath'
  | 'pickup'
  | 'grenadeThrow'
  | 'explosion'
  | 'tap'
  | 'skill'
  | 'stageClear'
  | 'stageLost'
  | 'tutorial';

export type MusicMode = 'calm' | 'combat';

/** Minimum gap between two plays of the same sound, so rapid fire does not become a wall of noise. */
const THROTTLE_MS: Partial<Record<SfxName, number>> = {
  shot: 70,
  hit: 60,
  kill: 50,
  barrierHit: 60,
  bossHit: 120,
};

const BPM = 112;
const SIXTEENTH = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
const LOOKAHEAD_S = 0.14;
const SCHEDULER_MS = 30;

// A minor progression: Am, F, C, G (roots as MIDI notes), chord tones as semitone offsets.
const PROGRESSION = [
  { root: 57, tones: [0, 3, 7, 12] },
  { root: 53, tones: [0, 4, 7, 12] },
  { root: 60, tones: [0, 4, 7, 12] },
  { root: 55, tones: [0, 4, 7, 12] },
];
const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 0, 2];
const BASS_STEPS = new Set([0, 6, 8, 14]);
const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sfxMuted = false;
  private musicMuted = false;
  private readonly lastPlayed = new Map<SfxName, number>();

  private musicMode: MusicMode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Creates and resumes the context. Must be called from a user gesture at least once. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxMuted ? 0 : 1;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicMuted ? 0 : 0.32;
      this.musicBus.connect(this.master);
      this.noiseBuffer = this.makeNoise(this.ctx);
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.visibilityState === 'visible') void this.ctx.resume();
        else void this.ctx.suspend();
      });
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
    if (this.musicMode && !this.musicTimer) this.startScheduler();
  }

  setSfxMuted(muted: boolean): void {
    this.sfxMuted = muted;
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(muted ? 0 : 0.32, this.ctx.currentTime, 0.05);
    if (muted) this.stopScheduler();
    else if (this.musicMode && this.ctx) this.startScheduler();
  }

  /** Starts (or switches) the looping track. Safe to call before unlock; it begins once unlocked. */
  playMusic(mode: MusicMode): void {
    if (this.musicMode === mode && this.musicTimer) return;
    this.musicMode = mode;
    if (!this.ctx || this.musicMuted) return;
    this.startScheduler();
  }

  stopMusic(): void {
    this.musicMode = null;
    this.stopScheduler();
  }

  play(name: SfxName, pitch = 1): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || this.sfxMuted || ctx.state !== 'running') return;
    const now = performance.now();
    const gap = THROTTLE_MS[name];
    if (gap !== undefined) {
      const last = this.lastPlayed.get(name) ?? -Infinity;
      if (now - last < gap) return;
      this.lastPlayed.set(name, now);
    }
    const t = ctx.currentTime;
    switch (name) {
      case 'shot':
        this.noise(bus, t, 0.06, 'bandpass', 2200 * pitch, 900, 0.35);
        this.tone(bus, t, 0.07, 'square', 420 * pitch, 110, 0.12);
        break;
      case 'hit':
        this.noise(bus, t, 0.04, 'highpass', 1800, 1800, 0.22);
        break;
      case 'kill':
        this.noise(bus, t, 0.12, 'lowpass', 1200, 200, 0.45);
        this.tone(bus, t, 0.14, 'sine', 260 * pitch, 60, 0.25);
        break;
      case 'barrierHit':
        this.tone(bus, t, 0.05, 'square', 900, 500, 0.1);
        this.noise(bus, t, 0.04, 'bandpass', 3000, 3000, 0.18);
        break;
      case 'barrierBreak':
        this.noise(bus, t, 0.35, 'lowpass', 2400, 150, 0.6);
        this.tone(bus, t, 0.2, 'triangle', 180, 50, 0.3);
        break;
      case 'gateGood':
        this.tone(bus, t, 0.12, 'triangle', 523, 523, 0.3);
        this.tone(bus, t + 0.1, 0.12, 'triangle', 659, 659, 0.3);
        this.tone(bus, t + 0.2, 0.22, 'triangle', 784, 784, 0.32);
        break;
      case 'gateBad':
        this.tone(bus, t, 0.3, 'sawtooth', 300, 120, 0.22, 0.01, 900);
        this.tone(bus, t + 0.05, 0.3, 'square', 150, 70, 0.14, 0.01, 600);
        break;
      case 'soldierLost':
        this.tone(bus, t, 0.22, 'sine', 170, 45, 0.5);
        this.noise(bus, t, 0.18, 'lowpass', 900, 200, 0.4);
        break;
      case 'bossRoar':
        this.tone(bus, t, 0.8, 'sawtooth', 95, 48, 0.5, 0.05, 700);
        this.tone(bus, t, 0.8, 'square', 48, 30, 0.3, 0.05, 400);
        this.noise(bus, t, 0.6, 'lowpass', 600, 120, 0.5);
        break;
      case 'bossHit':
        this.tone(bus, t, 0.08, 'triangle', 220, 140, 0.22);
        break;
      case 'bossDeath':
        this.noise(bus, t, 1.1, 'lowpass', 3000, 80, 0.8);
        this.tone(bus, t, 0.9, 'sawtooth', 140, 30, 0.45, 0.02, 500);
        this.tone(bus, t + 0.3, 0.6, 'sine', 70, 35, 0.4);
        break;
      case 'pickup':
        this.tone(bus, t, 0.08, 'triangle', 660, 660, 0.25);
        this.tone(bus, t + 0.07, 0.08, 'triangle', 880, 880, 0.25);
        this.tone(bus, t + 0.14, 0.16, 'triangle', 1320, 1320, 0.28);
        break;
      case 'grenadeThrow':
        this.noise(bus, t, 0.25, 'bandpass', 400, 1600, 0.2);
        break;
      case 'explosion':
        this.noise(bus, t, 0.6, 'lowpass', 2600, 90, 0.9);
        this.tone(bus, t, 0.45, 'sine', 90, 30, 0.6);
        this.noise(bus, t + 0.05, 0.1, 'highpass', 3000, 3000, 0.2);
        break;
      case 'tap':
        this.tone(bus, t, 0.05, 'square', 880, 880, 0.12, 0.002, 2400);
        break;
      case 'skill':
        this.tone(bus, t, 0.35, 'sawtooth', 220, 880, 0.2, 0.02, 1800);
        this.tone(bus, t + 0.1, 0.3, 'triangle', 440, 1320, 0.2);
        break;
      case 'stageClear':
        for (const [i, midi] of [60, 64, 67, 72].entries()) this.tone(bus, t + i * 0.12, 0.3, 'triangle', midiToHz(midi), midiToHz(midi), 0.3);
        this.tone(bus, t + 0.48, 0.6, 'triangle', midiToHz(76), midiToHz(76), 0.32);
        break;
      case 'stageLost':
        for (const [i, midi] of [64, 60, 55].entries()) this.tone(bus, t + i * 0.22, 0.4, 'sawtooth', midiToHz(midi), midiToHz(midi) * 0.97, 0.22, 0.02, 900);
        break;
      case 'tutorial':
        this.tone(bus, t, 0.09, 'sine', 740, 740, 0.18);
        this.tone(bus, t + 0.08, 0.14, 'sine', 988, 988, 0.18);
        break;
    }
  }

  // ---- Synth helpers -----------------------------------------------------------

  private tone(
    out: AudioNode,
    at: number,
    duration: number,
    type: OscillatorType,
    fromHz: number,
    toHz: number,
    gain: number,
    attack = 0.005,
    lowpassHz?: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, at);
    if (toHz !== fromHz) osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), at + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + attack);
    env.gain.exponentialRampToValueAtTime(0.001, at + duration);
    let tail: AudioNode = env;
    if (lowpassHz !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpassHz;
      env.connect(filter);
      tail = filter;
    }
    osc.connect(env);
    tail.connect(out);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  private noise(out: AudioNode, at: number, duration: number, filterType: BiquadFilterType, fromHz: number, toHz: number, gain: number): void {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(fromHz, at);
    if (toHz !== fromHz) filter.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), at + duration);
    filter.Q.value = filterType === 'bandpass' ? 0.8 : 0.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(out);
    src.start(at);
    src.stop(at + duration + 0.02);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // ---- Music -------------------------------------------------------------------

  private startScheduler(): void {
    if (!this.ctx || this.musicTimer) return;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.musicTimer = setInterval(() => this.schedule(), SCHEDULER_MS);
  }

  private stopScheduler(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  /** Schedules every step due within the lookahead window ("a tale of two clocks"). */
  private schedule(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus || !this.musicMode || ctx.state !== 'running') return;
    while (this.nextStepTime < ctx.currentTime + LOOKAHEAD_S) {
      this.scheduleStep(this.step, this.nextStepTime, this.musicMode, bus);
      this.nextStepTime += SIXTEENTH;
      this.step = (this.step + 1) % (STEPS_PER_BAR * PROGRESSION.length);
    }
  }

  private scheduleStep(step: number, at: number, mode: MusicMode, bus: GainNode): void {
    const bar = Math.floor(step / STEPS_PER_BAR) % PROGRESSION.length;
    const inBar = step % STEPS_PER_BAR;
    const chord = PROGRESSION[bar] ?? PROGRESSION[0]!;
    const combat = mode === 'combat';

    // Kick: every beat in combat, beats 1 and 3 when calm.
    if (inBar % 4 === 0 && (combat || inBar % 8 === 0)) this.tone(bus, at, 0.18, 'sine', 150, 42, 0.9);
    // Hi-hat on the off-beats, snare-ish noise on beats 2 and 4 in combat.
    if (combat && inBar % 4 === 2) this.noise(bus, at, 0.04, 'highpass', 6000, 6000, 0.25);
    if (combat && (inBar === 4 || inBar === 12)) this.noise(bus, at, 0.12, 'bandpass', 1800, 900, 0.35);
    // Bass: syncopated root notes.
    if (BASS_STEPS.has(inBar)) {
      const hz = midiToHz(chord.root - 24);
      this.tone(bus, at, combat ? 0.3 : 0.6, 'triangle', hz, hz, 0.7, 0.01);
      if (combat) this.tone(bus, at, 0.3, 'sawtooth', hz, hz, 0.12, 0.01, 500);
    }
    // Arpeggio: eighth notes in combat, quarter notes when calm.
    const arpEvery = combat ? 2 : 4;
    if (inBar % arpEvery === 0) {
      const index = ARP_PATTERN[(inBar / arpEvery) % ARP_PATTERN.length] ?? 0;
      const hz = midiToHz(chord.root + (chord.tones[index] ?? 0) + (combat ? 12 : 0));
      this.tone(bus, at, combat ? 0.16 : 0.5, combat ? 'square' : 'sine', hz, hz, combat ? 0.16 : 0.22, 0.01, combat ? 2200 : undefined);
    }
    // Pad: a soft fifth that swells over each bar.
    if (inBar === 0) {
      for (const offset of [0, 7]) {
        const hz = midiToHz(chord.root + offset - 12);
        this.tone(bus, at, SIXTEENTH * STEPS_PER_BAR, 'sine', hz, hz * 1.002, combat ? 0.12 : 0.2, 0.4);
      }
    }
  }
}

export const audio = new AudioEngine();

export function applyAudioSettings(settings: { sfx: boolean; music: boolean }): void {
  audio.setSfxMuted(!settings.sfx);
  audio.setMusicMuted(!settings.music);
}
