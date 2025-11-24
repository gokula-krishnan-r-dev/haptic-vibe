/**
 * HapticAudioEngine - Simulates haptic feedback using Web Audio API
 * 
 * Provides audio simulation of haptic effects by mapping:
 * - Intensity → Volume (gain)
 * - Sharpness → Frequency (pitch) and Filter Cutoff (timbre)
 */
export class HapticAudioEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the Audio Context (must be called after user interaction)
   * @returns true if initialization successful, false otherwise
   */
  init(): boolean {
    if (this.isInitialized && this.ctx) return true;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.error('Web Audio API is not supported in this browser');
        return false;
      }

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
      this.isInitialized = true;

      return true;
    } catch (error) {
      console.error('Failed to initialize HapticAudioEngine:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Update haptic audio parameters
   * @param intensity - Haptic intensity (0-1)
   * @param sharpness - Haptic sharpness (0-1)
   */
  update(intensity: number, sharpness: number): void {
    // Ensure context exists and is running
    if (!this.isInitialized) {
      const initialized = this.init();
      if (!initialized) return;
    }

    try {
      if (this.ctx?.state === 'suspended') {
        this.ctx.resume().catch(err => console.error('Failed to resume AudioContext:', err));
      }

      if (!this.gain || !this.osc || !this.filter || !this.ctx) {
        console.warn('Audio engine not fully initialized');
        return;
      }

      const time = this.ctx.currentTime;
      const rampTime = 0.02; // 20ms smooth transition to prevent clicking

      // Intensity -> Volume
      // Map 0-1 linear to a curve for natural volume perception, maxing at 0.4 gain
      const volume = Math.pow(Math.min(Math.max(intensity, 0), 1), 1.5) * 0.4;
      this.gain.gain.setTargetAtTime(volume, time, rampTime);

      // Sharpness -> Frequency (Pitch/Motor Speed)
      // Logarithmic mapping for more natural frequency perception
      // 0 -> ~40Hz (Deep Rumble)
      // 1 -> ~500Hz (High Mechanical Buzz)
      const minFreq = 40;
      const maxFreq = 500;
      const clampedSharpness = Math.min(Math.max(sharpness, 0), 1);
      const freq = minFreq * Math.pow(maxFreq / minFreq, clampedSharpness);
      this.osc.frequency.setTargetAtTime(freq, time, rampTime);

      // Sharpness -> Filter Cutoff (Timbre)
      // 0 -> ~150Hz (Muffled)
      // 1 -> ~5000Hz (Crisp/Metallic)
      const minCutoff = 150;
      const maxCutoff = 5000;
      const cutoff = minCutoff * Math.pow(maxCutoff / minCutoff, clampedSharpness);
      this.filter.frequency.setTargetAtTime(cutoff, time, rampTime);
    } catch (error) {
      console.error('Error updating audio engine:', error);
    }
  }

  /**
   * Stop audio playback with smooth fade out
   */
  stop(): void {
    try {
      if (this.gain && this.ctx) {
        // Quick fade out
        this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
    } catch (error) {
      console.error('Error stopping audio engine:', error);
    }
  }

  /**
   * Close and cleanup audio context
   */
  close(): void {
    try {
      this.stop();
      if (this.ctx) {
        const ctx = this.ctx; // Capture ref
        setTimeout(() => {
          ctx.close().catch(err => console.error('Error closing AudioContext:', err));
        }, 200);
        this.ctx = null;
        this.osc = null;
        this.gain = null;
        this.filter = null;
        this.isInitialized = false;
      }
    } catch (error) {
      console.error('Error closing audio engine:', error);
    }
  }
}