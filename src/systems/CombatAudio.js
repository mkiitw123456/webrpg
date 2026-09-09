export default class CombatAudio {
  constructor() {
    this.volume = 0.35;
    try { const value = localStorage.getItem('little-leaf-volume'); if (value !== null && Number.isFinite(+value)) this.volume = Math.max(0, Math.min(1, +value)); } catch { /* Defaults. */ }
    this.abort = new AbortController();
    const unlock = () => {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.context ||= new Context();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { signal: this.abort.signal });
    window.addEventListener('keydown', unlock, { signal: this.abort.signal });
  }
  setVolume(value) { this.volume = Math.max(0, Math.min(1, value)); try { localStorage.setItem('little-leaf-volume', this.volume); } catch { /* Optional. */ } }
  hit(skill = 'attack') {
    const c = this.context;
    if (!c || c.state !== 'running' || !this.volume) return;
    const now = c.currentTime;
    const gain = c.createGain();
    gain.gain.setValueAtTime(this.volume * 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    gain.connect(c.destination);
    const osc = c.createOscillator();
    osc.type = skill === 'wave' ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(skill === 'spin' ? 240 : 440, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.1);
    osc.connect(gain); osc.start(now); osc.stop(now + 0.14);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  casino(event) {
    const c = this.context;
    if (!c || c.state !== 'running' || !this.volume) return;
    const notes = event === 'start' ? [220, 330, 440] : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, i) => {
      const t = c.currentTime + i * 0.09, osc = c.createOscillator(), gain = c.createGain();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(frequency, t);
      gain.gain.setValueAtTime(0.001, t); gain.gain.linearRampToValueAtTime(this.volume * 0.22, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain); gain.connect(c.destination); osc.start(t); osc.stop(t + 0.24);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  }
  destroy() { this.abort.abort(); this.context?.close().catch(() => {}); }
}
