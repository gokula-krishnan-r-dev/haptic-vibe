export class HapticAudioEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  // Initialize the Audio Context (must be called after user interaction)
  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContext();

    this.osc = this.ctx.createOscillator();
    this.osc.type = 'sawtooth'; // Sawtooth gives a "buzzy" mechanical feel

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0; // Flat resonance for broader sound

    // Signal Chain: Oscillator -> Filter -> Gain -> Out
    this.osc.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.ctx.destination);

    this.osc.start();
  }

  update(intensity: number, sharpness: number) {
    // Ensure context exists and is running
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    if (!this.gain || !this.osc || !this.filter || !this.ctx) return;

    const time = this.ctx.currentTime;
    const rampTime = 0.02; // 20ms smooth transition to prevent clicking

    // Intensity -> Volume
    // Map 0-1 linear to a curve for natural volume perception, maxing at 0.4 gain
    const volume = Math.pow(Math.min(intensity, 1), 1.5) * 0.4; 
    this.gain.gain.setTargetAtTime(volume, time, rampTime);

    // Sharpness -> Frequency (Pitch/Motor Speed)
    // Logarithmic mapping for more natural frequency perception
    // 0 -> ~40Hz (Deep Rumble)
    // 1 -> ~500Hz (High Mechanical Buzz)
    const minFreq = 40;
    const maxFreq = 500;
    // Exponential interpolation: min * (max/min)^t
    const freq = minFreq * Math.pow(maxFreq / minFreq, sharpness);
    this.osc.frequency.setTargetAtTime(freq, time, rampTime);

    // Sharpness -> Filter Cutoff (Timbre)
    // 0 -> ~150Hz (Muffled)
    // 1 -> ~5000Hz (Crisp/Metallic)
    const minCutoff = 150;
    const maxCutoff = 5000;
    const cutoff = minCutoff * Math.pow(maxCutoff / minCutoff, sharpness);
    this.filter.frequency.setTargetAtTime(cutoff, time, rampTime);
  }

  stop() {
    if (this.gain && this.ctx) {
      // Quick fade out
      this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }
  
  close() {
      this.stop();
      if (this.ctx) {
          const ctx = this.ctx; // Capture ref
          setTimeout(() => {
              ctx.close();
          }, 200);
          this.ctx = null;
      }
  }
}