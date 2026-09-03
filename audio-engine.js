/**
 * ═══════════════════════════════════════════════════════════════════════
 * HERBALISTIC WELLNESS — WEB AUDIO SYNTHESIS ENGINE (audio-engine.js)
 *
 * ARCHITECTURAL MATHEMATICS:
 * ─────────────────────────────────────────────────────────────────────
 * This module synthesizes a multi-layered organic ambient soundscape
 * entirely through the Web Audio API — no audio files required.
 * All synthesis is procedural, parameterised, and event-driven.
 *
 * SYNTHESIS SUBSYSTEMS:
 *
 * 1. DECOCTION SUBSTRATE (Bubbling Background):
 *    Base: Triangle oscillator at C2 (65.41 Hz)
 *    Modulated through a Bandpass BiquadFilter with drifting cutoff.
 *    Cutoff drift: f_cut(t) = 280 + 160 * sin(t * ω_drift)
 *    ω_drift randomly resampled every 1.2–4.5s from LFO with range [0.4, 1.8] Hz.
 *    Bubble pops: short sine bursts (120–320 Hz, 30ms decay) scheduled
 *    via Poisson process: inter-arrival time ~ Exponential(λ=0.4 pops/sec).
 *
 * 2. AIRY FRICTION NOISE (Mouse Velocity):
 *    White noise (AudioBufferSourceNode with random Float32 samples).
 *    Bandpass filter: center freq ∈ [800Hz, 2500Hz], Q = 5.
 *    Mouse velocity: v = sqrt(Δx² + Δy²) / Δt
 *    Gain envelope: g = clamp(v * NOISE_GAIN_SCALE, 0, 0.3)
 *    Filter sweep: f_bp = 800 + v * 340  (faster mouse → brighter noise)
 *    Update rate: throttled to 60fps via requestAnimationFrame.
 *
 * 3. MORTAR GRINDING FM SYNTH (Blog Row Hover):
 *    FM synthesis: carrier @ 100Hz, modulator @ 60Hz.
 *    Modulation index MI = 8 (rich harmonic spectrum → rough texture).
 *    Output → WaveShaper (soft-clip) → LowPass sweep 800→200Hz / 400ms.
 *    Envelope: 0ms attack, 50ms hold, 400ms decay. Triggered on mouseenter.
 *
 * 4. BOTANICAL RUSTLE BURST (E-Commerce Hover):
 *    Bandpass filtered noise: center ∈ [2kHz, 6kHz], Q = 4.
 *    Duration: 15ms. Gaussian amplitude envelope (σ = 5ms).
 *    Pitch randomisation: center ± 800Hz per trigger for variation.
 *
 * 5. TINCTURE CLINK & PANNER (Scroll Thresholds):
 *    Three simultaneous sine oscillators: 1200Hz, 1800Hz, 2400Hz.
 *    Each with exponential gain decay: g(t) = A * exp(-t / τ), τ = 0.6s.
 *    PannerNode: panning.value maps current scroll fraction [0..1]
 *    to stereo position [-1 (left) .. +1 (right)].
 *    Triggered when scroll crosses integer multiples of (viewport_height / 4).
 *
 * AUDIO GRAPH TOPOLOGY:
 *   [OscillatorNodes]  ──► [GainNode] ──► [BiquadFilterNode] ──► [MasterGain]
 *   [NoiseBuffer]      ──► [GainNode] ──► [BiquadFilterNode] ──► [MasterGain]
 *   [FMCarrier]        ──► [WaveShaper] ──► [LowPassFilter] ──► [MasterGain]
 *   [GlassOscillators] ──► [GainNode] ──► [PannerNode] ──► [MasterGain]
 *                                                               │
 *                                              [AudioContext.destination]
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Constants ──────────────────────────────────────────────────────────
const MASTER_GAIN        = 0.72;   // global output ceiling
const C2_FREQ            = 65.41;  // base decoction oscillator (Hz)
const NOISE_BUFFER_SIZE  = 2;      // white noise buffer duration (seconds)
const NOISE_GAIN_SCALE   = 0.0014; // mouse pixel/s → gain scalar
const POP_RATE           = 0.38;   // avg bubble pops per second (Poisson λ)
const FM_CARRIER         = 100;    // FM carrier frequency (Hz)
const FM_MODULATOR       = 60;     // FM modulator frequency (Hz)
const FM_INDEX           = 8;      // FM modulation index
const CLINK_FREQS        = [1200, 1800, 2400]; // tincture glass harmonics (Hz)
const CLINK_DECAY        = 0.60;   // exponential decay constant τ (seconds)
const SCROLL_CLINK_DIV   = 4;      // trigger a clink every 1/4 viewport height

export class AudioEngine {
  constructor() {
    this.ctx         = null;   // AudioContext — null until gate is unlocked
    this.master      = null;   // MasterGainNode — final output stage
    this.isUnlocked  = false;

    // Subsystem nodes
    this._decoction  = {};     // { osc, filter, gain, driftTimer, popTimer }
    this._noise      = {};     // { source, filter, gain }
    this._mortar     = null;   // ephemeral per-hover
    this._panner     = null;   // shared PannerNode for clinks

    // Mouse velocity tracking
    this._lastMouseX  = 0;
    this._lastMouseY  = 0;
    this._lastMouseT  = 0;
    this._mouseVel    = 0;
    this._noiseRaf    = null;

    // Scroll clink threshold tracking
    this._lastClinkSection = -1;

    // Volume control (0–1)
    this.volume = 0.8;
  }

  // ── UNLOCK: instantiate AudioContext on user gesture ─────────────────
  /**
   * Called by the audio gate modal "Enter with Sound" button.
   * Browser security requires AudioContext creation inside a user
   * gesture handler (click/tap). This is the sole unlock point.
   * After unlock, all subsystems are chained and started.
   */
  unlock(withSound = true) {
    if (this.isUnlocked) return;

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (err) {
      console.warn('[AudioEngine] AudioContext unavailable:', err);
      return;
    }

    this.isUnlocked = true;

    // Master gain node — all synthesis routes here before destination
    this.master = this.ctx.createGain();
    this.master.gain.setValueAtTime(withSound ? MASTER_GAIN : 0, this.ctx.currentTime);
    this.master.connect(this.ctx.destination);

    if (withSound) {
      this._initDecoction();
      this._initNoiseLayer();
      this._initPanner();
      this._startMouseTracking();
      this._startScrollTracking();
    }

    console.log('[AudioEngine] Unlocked. AudioContext state:', this.ctx.state);
  }

  // ── SET VOLUME (0–1 range) ───────────────────────────────────────────
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) {
      this.master.gain.setTargetAtTime(
        this.volume * MASTER_GAIN,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SUBSYSTEM 1: DECOCTION SUBSTRATE
  // Bubbling, low-frequency ambient foundation
  // ══════════════════════════════════════════════════════════════════════
  _initDecoction() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Base oscillator: triangle wave at C2 (65.41 Hz)
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(C2_FREQ, now);

    // Resonant bandpass filter — gives it that warm, bubbling decoction character
    const filter = ctx.createBiquadFilter();
    filter.type            = 'bandpass';
    filter.frequency.value = 280;    // center frequency (Hz)
    filter.Q.value         = 3.5;   // moderate resonance for organic texture

    // Output gain — quietly sits under everything at -22dB equivalent
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);

    this._decoction = { osc, filter, gain };

    // Start the random filter drift (simulates temperature variation in decoction)
    this._scheduleDriftCycle();
    // Start the Poisson-process bubble pop scheduler
    this._scheduleNextPop();
  }

  /**
   * FILTER DRIFT MATHEMATICS:
   * ω_drift is sampled uniformly from [0.4, 1.8] Hz.
   * f_cut(t) = BASE_CUT + RANGE * sin(2π * ω_drift * t_local)
   * BASE_CUT = 280 Hz,  RANGE = 160 Hz
   * Each drift cycle has a random duration: τ_cycle ∈ [1.2s, 4.5s]
   * After each cycle, new ω_drift and τ_cycle are drawn → organic variation.
   */
  _scheduleDriftCycle() {
    if (!this._decoction.filter) return;

    const ctx       = this.ctx;
    const filter    = this._decoction.filter;
    const now       = ctx.currentTime;
    const targetCut = 200 + Math.random() * 240; // 200–440 Hz
    const duration  = 1.2 + Math.random() * 3.3; // 1.2–4.5 seconds

    // Smooth AudioParam automation — no clicks, no zipper noise
    filter.frequency.setTargetAtTime(targetCut, now, duration * 0.35);

    this._decoction.driftTimer = setTimeout(
      () => this._scheduleDriftCycle(),
      duration * 1000
    );
  }

  /**
   * BUBBLE POP MATHEMATICS (Poisson Process):
   * Inter-arrival time T ~ Exponential(λ = POP_RATE)
   * T = -ln(U) / λ  where U ~ Uniform(0,1)
   * Each pop: short sine at f_pop ∈ [120Hz, 320Hz], gain envelope peak 0.12,
   * exponential decay with τ = 0.03s (30ms — mimics bubble burst physics).
   */
  _scheduleNextPop() {
    // Poisson inter-arrival time
    const T = -Math.log(1 - Math.random()) / POP_RATE;

    this._decoction.popTimer = setTimeout(() => {
      this._triggerBubblePop();
      this._scheduleNextPop();
    }, T * 1000);
  }

  _triggerBubblePop() {
    if (!this.ctx || !this.isUnlocked) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const freq = 120 + Math.random() * 200; // 120–320 Hz per pop
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Amplitude envelope: instant attack, exponential decay (τ = 30ms)
    gain.gain.setValueAtTime(0.10, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    // Slight pitch fall — liquid surface tension physics
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.06);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.09); // auto-cleanup after 90ms
  }

  // ══════════════════════════════════════════════════════════════════════
  // SUBSYSTEM 2: AIRY FRICTION NOISE LAYER
  // Bandpass-filtered white noise, modulated by mouse velocity
  // ══════════════════════════════════════════════════════════════════════
  _initNoiseLayer() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Create a noise buffer: 2 seconds of white noise sampled at ctx.sampleRate
    // Looped continuously — no clicks at loop boundary due to stereo independence
    const bufLen = NOISE_BUFFER_SIZE * ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(2, bufLen, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = noiseBuf.getChannelData(ch);
      for (let i = 0; i < bufLen; i++) {
        data[i] = Math.random() * 2 - 1; // uniform white noise [-1, +1]
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuf;
    source.loop   = true;

    // Bandpass filter: center starts at 1200Hz, Q=5 (narrow band = airy/breezy)
    const filter = ctx.createBiquadFilter();
    filter.type            = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value         = 5;

    // Gain: starts silent, rises with mouse velocity
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, now);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);

    this._noise = { source, filter, gain };
  }

  // ── MOUSE VELOCITY TRACKING ──────────────────────────────────────────
  _startMouseTracking() {
    document.addEventListener('mousemove', (e) => {
      const now = performance.now();
      const dt  = now - this._lastMouseT;
      if (dt < 8) return; // throttle to ~120fps max

      const dx = e.clientX - this._lastMouseX;
      const dy = e.clientY - this._lastMouseY;

      // Velocity in px/ms → smoothed with exponential moving average (α=0.25)
      const rawVel = Math.sqrt(dx * dx + dy * dy) / Math.max(dt, 1);
      this._mouseVel = this._mouseVel * 0.75 + rawVel * 0.25;

      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
      this._lastMouseT = now;

      this._updateNoiseSynth();
    }, { passive: true });
  }

  /**
   * NOISE SYNTH PARAMETER UPDATE:
   * gainVal   = clamp(mouseVel * NOISE_GAIN_SCALE, 0, 0.28)
   * filterCut = 800 + mouseVel * 340  → [800Hz .. ~2500Hz]
   * Both parameters use setTargetAtTime(val, now, 0.05) for
   * smooth interpolation (τ = 50ms → settles in ~150ms).
   * This prevents clicking artifacts from discrete value jumps.
   */
  _updateNoiseSynth() {
    if (!this._noise.gain || !this.isUnlocked) return;

    const ctx  = this.ctx;
    const now  = ctx.currentTime;
    const vel  = this._mouseVel;

    const gainVal   = Math.min(0.28, vel * NOISE_GAIN_SCALE);
    const filterCut = Math.min(2500, 800 + vel * 340);

    this._noise.gain.gain.setTargetAtTime(gainVal, now, 0.05);
    this._noise.filter.frequency.setTargetAtTime(filterCut, now, 0.05);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SUBSYSTEM 3: MORTAR GRINDING FM SYNTH (Blog hover)
  // ══════════════════════════════════════════════════════════════════════
  /**
   * FM SYNTHESIS MATHEMATICS:
   * y(t) = A * sin(2π * fc * t + MI * sin(2π * fm * t))
   * fc = FM_CARRIER (100 Hz), fm = FM_MODULATOR (60 Hz), MI = 8
   * High MI → dense sideband spectrum → rough, gritty texture (stone-on-stone)
   *
   * Output passes through:
   *   WaveShaperNode (soft-clip distortion): enhances harmonic density
   *   BiquadFilter (LowPass): swept 800→200 Hz over 400ms for the
   *   characteristic "grinding press" frequency decay.
   */
  triggerMortarGrind() {
    if (!this.ctx || !this.isUnlocked) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // FM Modulator
    const modOsc  = ctx.createOscillator();
    const modGain = ctx.createGain();
    modOsc.type = 'sine';
    modOsc.frequency.setValueAtTime(FM_MODULATOR, now);
    modGain.gain.setValueAtTime(FM_INDEX * FM_CARRIER, now); // modulation depth

    // FM Carrier
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(FM_CARRIER, now);

    // WaveShaper — soft clip for stone texture
    const shaper = ctx.createWaveShaper();
    shaper.curve   = this._makeSoftClipCurve(220);
    shaper.oversample = '4x';

    // Lowpass filter swept from 800 → 200 Hz over 0.4s (grinding decay)
    const lp = ctx.createBiquadFilter();
    lp.type            = 'lowpass';
    lp.frequency.setValueAtTime(800, now);
    lp.frequency.exponentialRampToValueAtTime(200, now + 0.40);
    lp.Q.value = 2;

    // Output gain envelope: 0ms attack, 50ms hold, 400ms decay
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0, now);
    envGain.gain.linearRampToValueAtTime(0.15, now + 0.01);
    envGain.gain.setValueAtTime(0.15, now + 0.06);
    envGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);

    // Wire: modulator → carrier frequency param → shaper → lp → env → master
    modOsc.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(shaper);
    shaper.connect(lp);
    lp.connect(envGain);
    envGain.connect(this.master);

    modOsc.start(now);
    carrier.start(now);
    modOsc.stop(now + 0.5);
    carrier.stop(now + 0.5);
  }

  /** WaveShaper curve factory — piecewise soft-clip approximation */
  _makeSoftClipCurve(samples) {
    const curve = new Float32Array(samples);
    const k = 2;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SUBSYSTEM 4: BOTANICAL RUSTLE BURST (E-Commerce hover/click)
  // ══════════════════════════════════════════════════════════════════════
  /**
   * RUSTLE SYNTHESIS MATHEMATICS:
   * Generates 15ms of bandpass noise simulating crisp dried leaf contact.
   * Center frequency randomised: fc = 2000 + rand() * 4000 Hz
   * Q = 4 (focused band — leaf vs. paper differentiation)
   *
   * Amplitude: Gaussian window  w(t) = exp(-(t-μ)² / (2σ²))
   * μ = 7.5ms (peak at midpoint), σ = 4ms
   * Implemented as: attack 2ms linear + decay 13ms exponential.
   */
  triggerBotanicalRustle() {
    if (!this.ctx || !this.isUnlocked) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Short noise buffer — 20ms is sufficient
    const bufLen = Math.ceil(ctx.sampleRate * 0.02);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    src.buffer   = buf;

    // Bandpass filter: high-frequency leaf rustle territory
    const filter = ctx.createBiquadFilter();
    filter.type            = 'bandpass';
    filter.frequency.value = 2000 + Math.random() * 4000; // random each trigger
    filter.Q.value         = 4;

    // Gain envelope: fast attack, exponential decay → crisp hit
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.002);     // 2ms attack
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018); // 16ms decay

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    // No stop needed — buffer finishes in 20ms and node auto-disconnects
  }

  // ══════════════════════════════════════════════════════════════════════
  // SUBSYSTEM 5: TINCTURE CLINKS + PANNERNODE (Scroll-driven spatial)
  // ══════════════════════════════════════════════════════════════════════
  _initPanner() {
    const ctx    = this.ctx;
    this._panner = ctx.createStereoPanner();
    this._panner.pan.value = 0;
    this._panner.connect(this.master);
  }

  /**
   * GLASS CLINK MATHEMATICS:
   * Three sine oscillators at f1=1200Hz, f2=1800Hz, f3=2400Hz (partial series)
   * approximate the overtone structure of a small glass tincture bottle.
   * Each starts at amplitude A_i then decays:
   *   g_i(t) = A_i * exp(-t / τ)   τ = CLINK_DECAY (0.6s)
   * Implemented as exponentialRampToValueAtTime over 1.8s (3τ).
   *
   * SPATIAL PANNING:
   * pan = scrollFraction * 2 - 1   → [-1 (left top) .. +1 (right bottom)]
   * PannerNode interpolates with setTargetAtTime τ = 0.1s.
   */
  triggerTinctureClink(scrollFraction = 0.5) {
    if (!this.ctx || !this.isUnlocked || !this._panner) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Set stereo pan position based on scroll location
    const pan = scrollFraction * 2 - 1; // [-1 .. +1]
    this._panner.pan.setTargetAtTime(pan, now, 0.1);

    // Create each partial of the glass harmonic series
    const amplitudes = [0.14, 0.09, 0.06]; // decreasing amplitudes per harmonic

    CLINK_FREQS.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      // Slight detuning per partial — real glass isn't perfectly harmonic
      osc.detune.setValueAtTime((Math.random() - 0.5) * 18, now);

      // Amplitude: immediate onset, exponential tail (glass resonance physics)
      gain.gain.setValueAtTime(amplitudes[i], now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + CLINK_DECAY * 3);

      osc.connect(gain);
      gain.connect(this._panner); // routes through spatial panner
      osc.start(now);
      osc.stop(now + CLINK_DECAY * 3.2);
    });
  }

  // ── SCROLL CLINK THRESHOLD TRACKING ─────────────────────────────────
  /**
   * Divides the document into sections of height = viewport/SCROLL_CLINK_DIV.
   * When scrollY crosses into a new section, a clink is triggered.
   * The pan position is calculated as scrollY / documentScrollRange → [0, 1].
   */
  _startScrollTracking() {
    window.addEventListener('scroll', () => {
      if (!this.isUnlocked) return;

      const vh        = window.innerHeight;
      const docH      = document.documentElement.scrollHeight - vh;
      const scrollY   = window.scrollY;
      const section   = Math.floor(scrollY / (vh / SCROLL_CLINK_DIV));

      if (section !== this._lastClinkSection) {
        this._lastClinkSection = section;
        const scrollFraction   = docH > 0 ? scrollY / docH : 0;
        this.triggerTinctureClink(scrollFraction);
      }
    }, { passive: true });
  }

  // ── SUSPEND / RESUME (page visibility API) ───────────────────────────
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ── CLEANUP ──────────────────────────────────────────────────────────
  dispose() {
    clearTimeout(this._decoction.driftTimer);
    clearTimeout(this._decoction.popTimer);
    cancelAnimationFrame(this._noiseRaf);
    if (this.ctx) this.ctx.close();
    console.log('[AudioEngine] Disposed.');
  }
}
