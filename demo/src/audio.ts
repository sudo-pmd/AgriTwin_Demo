/**
 * Retours sonores minimalistes (Web Audio) : aucun fichier, aucun chargement.
 * Le contexte n'est créé qu'au premier geste de l'utilisateur.
 */
export default class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const at = ctx.currentTime + start;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.5 * gain, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env);
    env.connect(this.master);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }

  click() {
    this.tone(520, 0, 0.09, 'triangle', 0.5);
  }

  plant() {
    this.tone(330, 0, 0.16, 'sine');
    this.tone(494, 0.06, 0.2, 'sine', 0.8);
  }

  success() {
    [523, 659, 784].forEach((f, i) => this.tone(f, i * 0.09, 0.26, 'sine', 0.8));
  }

  alert() {
    [740, 560, 740].forEach((f, i) => this.tone(f, i * 0.16, 0.22, 'square', 0.45));
  }

  water() {
    for (let i = 0; i < 6; i += 1) this.tone(240 + i * 40, i * 0.07, 0.22, 'sine', 0.5);
  }

  lock() {
    this.tone(300, 0, 0.3, 'sawtooth', 0.35);
    this.tone(180, 0.14, 0.4, 'sawtooth', 0.3);
  }
}
