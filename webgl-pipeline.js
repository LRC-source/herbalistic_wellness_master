/**
 * ═══════════════════════════════════════════════════════════════════════
 * HERBALISTIC WELLNESS — WebGL RENDERING PIPELINE (webgl-pipeline.js)
 *
 * ARCHITECTURAL MATHEMATICS:
 * ─────────────────────────────────────────────────────────────────────
 * This module manages a persistent Three.js rendering context that
 * lives on Layer 1 (z-index: 1) of the SPA's three-layer stack.
 *
 * PARTICLE GEOMETRY SYSTEM:
 *   N = 8,000 particles distributed across two pre-computed position
 *   buffers — "lattice" and "stream" — stored as Float32Array triplets.
 *
 *   LATTICE (concentric molecular matrix):
 *     Ring k (k = 0..K) has radius r_k = BASE_RADIUS * k.
 *     Particle count per ring: n_k = floor(2π * r_k / SPACING).
 *     Angle step: θ_step = 2π / n_k
 *     Position: x = r_k * cos(θ), y = r_k * sin(θ) + vertical_offset
 *     Vertical layers are stacked with z = k * LAYER_DEPTH.
 *     This creates a toroidal molecular lattice in 3D space.
 *
 *   STREAM (kinetic wind field):
 *     Each particle i draws from Simplex-like noise at (i/N, t):
 *       x_stream = random_gaussian() * SPREAD_X
 *       y_stream = sin(i * PHI) * SPREAD_Y   (PHI = golden ratio angle)
 *       z_stream = cos(i * PHI) * SPREAD_Z
 *     This produces the flowing botanical wind silhouette.
 *
 * VERTEX SHADER INTERPOLATION:
 *   gl_Position interpolates linearly between lattice and stream coords:
 *     pos = mix(aLatticePos, aStreamPos, uMorphProgress)
 *   uMorphProgress ∈ [0.0, 1.0] driven by GSAP Tween.
 *   Rapid scroll → uMorphProgress → 1.0 (stream/chaos)
 *   Scroll stops  → uMorphProgress → 0.0 (lattice/order)
 *
 * BOKEH DEPTH-OF-FIELD (fragment shader):
 *   Each particle samples its depth (gl_FragCoord.z) and computes:
 *     blur_radius = abs(depth - FOCAL_PLANE) * BOKEH_INTENSITY
 *   The fragment alpha is modulated by a circular soft mask and the
 *   blur_radius — distant particles appear larger, softer, dimmer.
 *
 * SCROLL VELOCITY COUPLING:
 *   scrollVelocity = (currentY - lastY) / frameDeltaMs
 *   targetMorph    = clamp(abs(scrollVelocity) * VELOCITY_SCALE, 0, 1)
 *   GSAP tweens uMorphProgress to targetMorph in ~120ms,
 *   then returns to 0.0 after SETTLE_DELAY with elastic ease.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Constants ──────────────────────────────────────────────────────────
const PARTICLE_COUNT   = 8000;
const BASE_RADIUS      = 1.8;    // lattice ring base radius (world units)
const RING_COUNT       = 18;     // concentric ring layers in lattice
const LAYER_DEPTH      = 0.35;   // z separation between lattice layers
const SPREAD_X         = 14.0;   // wind stream horizontal spread
const SPREAD_Y         = 8.0;    // wind stream vertical spread
const SPREAD_Z         = 6.0;    // wind stream depth spread
const PHI              = 2.39996; // golden angle in radians ≈ 137.5°
const VELOCITY_SCALE   = 0.028;  // scroll velocity → morph progress scalar
const SETTLE_DELAY     = 480;    // ms of stillness before lattice re-forms
const FOCAL_PLANE      = 0.5;    // normalised depth focal point [0..1]

// Palette mapped to CSS tokens as vec3 RGB (0-1 range)
const PALETTE = [
  [0.282, 0.173, 0.416], // #482C6A Deep Purple
  [0.514, 0.576, 0.600], // #829399 Sage Slate
  [0.847, 0.549, 0.263], // #D88C43 Amber
  [0.980, 0.976, 0.965], // #FAF9F6 Cream (rare sparkle particles)
  [0.102, 0.188, 0.129], // #1A3021 Dark Spruce
];

// ─── GLSL Vertex Shader ─────────────────────────────────────────────────
/**
 * Attributes fed per-particle from CPU Float32Arrays:
 *   aLatticePos  — target concentric molecular lattice position
 *   aStreamPos   — target kinetic wind stream position
 *   aColor       — pre-computed RGBA color vector per particle
 *   aSize        — base point size for this particle
 *   aPhase       — random phase offset [0..2π] for time oscillation
 *
 * Uniforms updated every frame:
 *   uMorphProgress — [0.0 lattice .. 1.0 stream], driven by GSAP
 *   uTime          — elapsed seconds for oscillation
 *   uMouse         — normalised NDC mouse position for subtle magnetic pull
 *   uResolution    — viewport vec2 for size scaling
 */
const VERTEX_SHADER = /* glsl */`
  attribute vec3  aLatticePos;
  attribute vec3  aStreamPos;
  attribute vec4  aColor;
  attribute float aSize;
  attribute float aPhase;

  uniform float uMorphProgress;
  uniform float uTime;
  uniform vec2  uMouse;
  uniform vec2  uResolution;

  varying vec4  vColor;
  varying float vDepth;

  // ── Hash / pseudo-random helper (GPU Gems 3) ──
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    // 1. Core interpolation: mix lattice ↔ stream by uMorphProgress
    vec3 pos = mix(aLatticePos, aStreamPos, uMorphProgress);

    // 2. Breathing oscillation — lattice breathes slowly, stream churns fast.
    //    Amplitude is proportional to morph progress so still particles
    //    have a subtle life-pulse while scattered particles swirl chaotically.
    float breathAmp   = mix(0.04, 0.28, uMorphProgress);
    float breathSpeed = mix(0.6,  3.2,  uMorphProgress);
    pos.x += sin(uTime * breathSpeed + aPhase)        * breathAmp;
    pos.y += cos(uTime * breathSpeed + aPhase * 1.37) * breathAmp;
    pos.z += sin(uTime * breathSpeed * 0.7 + aPhase)  * breathAmp * 0.5;

    // 3. Subtle mouse magnetic attraction toward cursor (dampened at edges)
    //    Only active in lattice state (low morph) to avoid visual conflict.
    float mouseInfluence = (1.0 - uMorphProgress) * 0.18;
    vec2  toMouse = uMouse - pos.xy * 0.1;
    float mouseDist = length(toMouse);
    pos.xy += normalize(toMouse) * mouseInfluence * smoothstep(2.0, 0.0, mouseDist);

    // 4. Project to clip space
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // 5. Point size: larger when closer (perspective), smaller in stream chaos
    float sizeScale = mix(1.0, 0.55, uMorphProgress);
    gl_PointSize = aSize * sizeScale * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.8, 14.0);

    // 6. Pass color and depth to fragment shader
    //    Alpha is boosted in lattice (clarity) and reduced in stream (haze)
    float alphaScale = mix(1.0, 0.45, uMorphProgress);
    vColor = vec4(aColor.rgb, aColor.a * alphaScale);
    vDepth = (-mvPosition.z - 0.1) / 20.0; // normalised depth [0..1]
  }
`;

// ─── GLSL Fragment Shader ───────────────────────────────────────────────
/**
 * BOKEH DEPTH-OF-FIELD MATHEMATICS:
 *   Each gl_PointCoord maps [0..1]×[0..1] across the point sprite.
 *   dist from centre = length(gl_PointCoord - 0.5)
 *
 *   Soft circle mask (clean particle):
 *     alpha_circle = 1.0 - smoothstep(0.35, 0.5, dist)
 *
 *   Bokeh defocus expansion (out-of-focus particles bloom larger & dimmer):
 *     coc = abs(vDepth - FOCAL_PLANE) * BOKEH_STRENGTH
 *     expanded_radius = 0.5 + coc
 *     alpha_bokeh = 1.0 - smoothstep(expanded_radius * 0.7, expanded_radius, dist)
 *     brightness  = 1.0 - coc * 0.6   (dimmer = further from focal plane)
 *
 *   The final fragment mixes both masks weighted by uMorphProgress so
 *   the stream state has heavier bokeh defocus blur.
 */
const FRAGMENT_SHADER = /* glsl */`
  uniform float uMorphProgress;
  uniform float uTime;

  varying vec4  vColor;
  varying float vDepth;

  const float FOCAL_PLANE    = ${FOCAL_PLANE};
  const float BOKEH_STRENGTH = 0.38;

  void main() {
    // Distance from sprite centre [0..0.5]
    vec2  coord = gl_PointCoord - 0.5;
    float dist  = length(coord);

    // ── Sharp circle mask (in-focus bokeh disc) ──
    float alphaClear = 1.0 - smoothstep(0.30, 0.50, dist);

    // ── Defocus CoC (Circle of Confusion) expansion ──
    float coc          = abs(vDepth - FOCAL_PLANE) * BOKEH_STRENGTH;
    float blurRadius   = 0.50 + coc * mix(0.2, 0.9, uMorphProgress);
    float alphaBokeh   = 1.0 - smoothstep(blurRadius * 0.6, blurRadius, dist);
    float brightness   = 1.0 - coc * 0.55;

    // ── Blend sharp vs bokeh by morph progress ──
    float mask = mix(alphaClear, alphaBokeh * brightness, uMorphProgress * 0.7);

    // ── Subtle inner glow ring at particle centre ──
    float glow = exp(-dist * 18.0) * 0.35 * (1.0 - uMorphProgress * 0.6);

    float finalAlpha = clamp((mask + glow) * vColor.a, 0.0, 1.0);
    gl_FragColor = vec4(vColor.rgb * (1.0 + glow), finalAlpha);
  }
`;

// ─── Main Pipeline Class ────────────────────────────────────────────────
export class WebGLPipeline {
  constructor() {
    this.canvas    = document.getElementById('webgl-canvas');
    this.renderer  = null;
    this.scene     = null;
    this.camera    = null;
    this.particles = null;
    this.material  = null;

    // Position buffers — pre-allocated once, reused every frame
    this.latticePositions = new Float32Array(PARTICLE_COUNT * 3);
    this.streamPositions  = new Float32Array(PARTICLE_COUNT * 3);
    this.colors           = new Float32Array(PARTICLE_COUNT * 4);
    this.sizes            = new Float32Array(PARTICLE_COUNT);
    this.phases           = new Float32Array(PARTICLE_COUNT);

    // Scroll velocity tracking
    this.scrollY       = 0;
    this.lastScrollY   = 0;
    this.scrollVel     = 0;
    this.morphProgress = 0;
    this.settleTimer   = null;
    this.isRunning     = false;
    this.frameId       = null;
    this.clock         = null;

    // Mouse NDC position (Normalised Device Coordinates)
    this.mouseNDC = { x: 0, y: 0 };
  }

  // ── Initialise Three.js renderer, scene, camera ─────────────────────
  init() {
    // Guard: require Three.js loaded via CDN
    if (typeof THREE === 'undefined') {
      console.warn('[WebGLPipeline] Three.js not loaded. Deferring init 800ms.');
      setTimeout(() => this.init(), 800);
      return;
    }

    // ── Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas:    this.canvas,
      antialias: false,       // disabled for performance — particles don't need MSAA
      alpha:     true,        // transparent background — spruce body-bg shows through
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0); // fully transparent

    // ── Scene & Camera ──
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 12);

    this.clock = new THREE.Clock();

    // ── Build geometry buffers ──
    this._buildLatticePositions();
    this._buildStreamPositions();
    this._buildColorAndSizeArrays();

    // ── Geometry & Material ──
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',    new THREE.BufferAttribute(this.latticePositions.slice(), 3));
    geo.setAttribute('aLatticePos', new THREE.BufferAttribute(this.latticePositions,         3));
    geo.setAttribute('aStreamPos',  new THREE.BufferAttribute(this.streamPositions,          3));
    geo.setAttribute('aColor',      new THREE.BufferAttribute(this.colors,  4));
    geo.setAttribute('aSize',       new THREE.BufferAttribute(this.sizes,   1));
    geo.setAttribute('aPhase',      new THREE.BufferAttribute(this.phases,  1));

    this.material = new THREE.ShaderMaterial({
      vertexShader:   VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uMorphProgress: { value: 0.0 },
        uTime:          { value: 0.0 },
        uMouse:         { value: new THREE.Vector2(0, 0) },
        uResolution:    { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
      },
      transparent:  true,
      depthWrite:   false,     // critical: prevents z-fighting in transparent particle cloud
      blending:     THREE.AdditiveBlending, // particles add luminosity — botanical glow
      vertexColors: false
    });

    this.particles = new THREE.Points(geo, this.material);
    this.scene.add(this.particles);

    // ── Event listeners ──
    window.addEventListener('resize',    () => this._onResize(),       { passive: true });
    window.addEventListener('scroll',    () => this._onScroll(),       { passive: true });
    document.addEventListener('mousemove', (e) => this._onMouse(e),   { passive: true });

    // ── Start render loop ──
    this.isRunning = true;
    this._animate();

    console.log('[WebGLPipeline] Initialised. Particles:', PARTICLE_COUNT);
  }

  // ── LATTICE POSITION BUILDER ─────────────────────────────────────────
  /**
   * Distributes N particles across RING_COUNT concentric rings.
   * Ring k has radius r_k = BASE_RADIUS * (k + 1).
   * Circumference / SPACING determines how many particles fit per ring.
   * Remaining slots fill rings uniformly using a carry-over counter.
   *
   *   r_k = BASE_RADIUS * (k + 1)
   *   n_k = max(6, round(2π * r_k / 0.6))
   *   θ_i = (2π / n_k) * i   for i in [0, n_k)
   *   x   = r_k * cos(θ_i)
   *   y   = r_k * sin(θ_i)
   *   z   = (k - RING_COUNT/2) * LAYER_DEPTH  + small_jitter
   */
  _buildLatticePositions() {
    const buf = this.latticePositions;
    let ptr = 0;
    const SPACING = 0.58;

    for (let ring = 0; ring < RING_COUNT && ptr < PARTICLE_COUNT * 3; ring++) {
      const r    = BASE_RADIUS * (ring + 1);
      const circ = 2 * Math.PI * r;
      const n    = Math.max(6, Math.round(circ / SPACING));
      const zBase = (ring - RING_COUNT / 2) * LAYER_DEPTH;

      for (let i = 0; i < n && ptr < PARTICLE_COUNT * 3; i++) {
        const theta = (2 * Math.PI / n) * i;
        buf[ptr++] = r * Math.cos(theta);
        buf[ptr++] = r * Math.sin(theta);
        buf[ptr++] = zBase + (Math.random() - 0.5) * 0.18; // micro z-jitter
      }
    }

    // Fill remaining slots with inner core cluster (molecular nucleus)
    while (ptr < PARTICLE_COUNT * 3) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = Math.random() * BASE_RADIUS * 0.7;
      buf[ptr++] = dist * Math.cos(angle);
      buf[ptr++] = dist * Math.sin(angle);
      buf[ptr++] = (Math.random() - 0.5) * 1.5;
    }
  }

  // ── STREAM POSITION BUILDER ──────────────────────────────────────────
  /**
   * Generates the kinetic wind stream layout.
   * Uses golden angle (PHI) to spiral particles into a flowing ribbon:
   *   i normalised: t = i / N   ∈ [0, 1]
   *   angle = i * PHI           (golden angle stepping prevents clumping)
   *   radius_band = SPREAD_Y * (0.3 + t * 0.7) * random_scatter
   *   x = gaussian_x * SPREAD_X  (wide horizontal scatter for wind feel)
   *   y = sin(angle) * radius_band
   *   z = cos(angle) * SPREAD_Z * t
   */
  _buildStreamPositions() {
    const buf = this.streamPositions;

    // Box-Muller transform — Gaussian random for natural scatter
    const gauss = () => {
      const u = 1 - Math.random();
      const v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t     = i / PARTICLE_COUNT;
      const angle = i * PHI;
      const rb    = SPREAD_Y * (0.3 + t * 0.7) * (0.6 + Math.random() * 0.8);

      buf[i * 3 + 0] = gauss() * SPREAD_X;
      buf[i * 3 + 1] = Math.sin(angle) * rb;
      buf[i * 3 + 2] = Math.cos(angle) * SPREAD_Z * t * 1.5;
    }
  }

  // ── COLOR & SIZE ARRAY BUILDER ───────────────────────────────────────
  /**
   * Each particle is assigned a color from PALETTE based on its ring index.
   * Inner rings (molecular nucleus) → Deep Purple (meditative depth)
   * Middle rings                    → Sage Slate (herbal neutral)
   * Outer rings                     → Amber (botanical warmth)
   * Rare scatter (5%)               → Cream (sparkle highlights)
   * Size: range [1.5, 4.5] with inner core particles slightly larger.
   */
  _buildColorAndSizeArrays() {
    const lattice = this.latticePositions;
    const latticeCenter = [0, 0, 0];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = lattice[i * 3];
      const y = lattice[i * 3 + 1];
      const dist = Math.sqrt(x * x + y * y);
      const normDist = dist / (BASE_RADIUS * RING_COUNT);

      // Color assignment by radial normalised distance
      let color;
      const rand = Math.random();
      if (rand < 0.04) {
        color = PALETTE[3]; // cream sparkle
      } else if (normDist < 0.15) {
        color = PALETTE[0]; // deep purple — core
      } else if (normDist < 0.45) {
        color = PALETTE[1]; // sage slate — middle
      } else if (normDist < 0.72) {
        color = PALETTE[2]; // amber — outer
      } else {
        color = PALETTE[4]; // dark spruce — far edge
      }

      this.colors[i * 4 + 0] = color[0];
      this.colors[i * 4 + 1] = color[1];
      this.colors[i * 4 + 2] = color[2];
      this.colors[i * 4 + 3] = 0.55 + Math.random() * 0.45; // alpha jitter

      // Size: inner particles larger, outer smaller
      const sizeFactor = 1.0 - normDist * 0.5;
      this.sizes[i] = (1.5 + Math.random() * 3.0) * sizeFactor;

      // Phase: random offset for oscillation desync (avoids wave synchrony)
      this.phases[i] = Math.random() * Math.PI * 2;
    }
  }

  // ── SCROLL VELOCITY → MORPH PROGRESS COUPLING ───────────────────────
  /**
   * Called on every window scroll event.
   * Computes instantaneous velocity using position delta / time.
   * Clamps velocity and maps it to morphProgress [0.0, 1.0].
   *
   * Critically: uses GSAP to animate the uniform so the shader
   * interpolates smoothly — avoiding frame-rate-dependent jumps.
   *
   * After SETTLE_DELAY ms of zero velocity, GSAP animates morph back
   * to 0.0 with an elastic ease — particles spring back to lattice.
   */
  _onScroll() {
    this.lastScrollY = this.scrollY;
    this.scrollY = window.scrollY;
    const delta = Math.abs(this.scrollY - this.lastScrollY);
    this.scrollVel = delta;

    const targetMorph = Math.min(1.0, delta * VELOCITY_SCALE);

    if (typeof gsap !== 'undefined') {
      // Scatter: fast tween to target morph
      gsap.to(this.material.uniforms.uMorphProgress, {
        value:    targetMorph,
        duration: 0.12,
        ease:     'power2.out',
        overwrite: true
      });

      // Settle: after stillness, pull back to lattice with spring
      clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => {
        gsap.to(this.material.uniforms.uMorphProgress, {
          value:    0.0,
          duration: 2.2,
          ease:     'elastic.out(1, 0.5)',
          overwrite: true
        });
      }, SETTLE_DELAY);
    } else {
      // Fallback without GSAP: direct uniform update
      this.material.uniforms.uMorphProgress.value = targetMorph;
    }
  }

  // ── MOUSE TRACKING → SHADER UNIFORM ─────────────────────────────────
  /**
   * Maps screen-space mouse coordinates to NDC for the vertex shader's
   * magnetic attraction pull.
   * NDC: x ∈ [-1, 1], y ∈ [-1, 1] (y flipped: screen-up = NDC-up)
   */
  _onMouse(e) {
    const ndx = (e.clientX / window.innerWidth)  * 2 - 1;
    const ndy = -(e.clientY / window.innerHeight) * 2 + 1;

    // Scale to world-space approximate (camera at z=12, FOV 60°)
    this.mouseNDC.x = ndx * 8;
    this.mouseNDC.y = ndy * 5;

    if (this.material) {
      this.material.uniforms.uMouse.value.set(this.mouseNDC.x, this.mouseNDC.y);
    }
  }

  // ── RESIZE HANDLER ───────────────────────────────────────────────────
  _onResize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H);
    this.material.uniforms.uResolution.value.set(W, H);
  }

  // ── RENDER LOOP ──────────────────────────────────────────────────────
  /**
   * RAF-based animation loop. Three.js recommends storing the request
   * ID so the loop can be cleanly cancelled (e.g., on page hide) to
   * prevent memory accumulation and phantom GPU thread blocks.
   *
   * Camera slow orbit: x-tilt = sin(t * 0.04) * 0.8 degrees
   *                    y-orbit = sin(t * 0.025) * 1.2 degrees
   * This creates the feeling that the particle cloud breathes and
   * drifts — reinforcing the living botanical character.
   */
  _animate() {
    if (!this.isRunning) return;
    this.frameId = requestAnimationFrame(() => this._animate());

    const t = this.clock.getElapsedTime();
    this.material.uniforms.uTime.value = t;

    // Subtle autonomous camera drift — creates perceivable spatial depth
    this.camera.position.x = Math.sin(t * 0.025) * 1.2;
    this.camera.position.y = Math.sin(t * 0.018) * 0.7;
    this.camera.lookAt(0, 0, 0);

    // Rotate particle cloud very slowly for continuous ambient motion
    this.particles.rotation.z = t * 0.008;

    this.renderer.render(this.scene, this.camera);
  }

  // ── PUBLIC API: set morph from external trigger ──────────────────────
  /**
   * Allows app.js to force morph state for non-scroll events
   * (e.g., navigation transitions or hover states).
   * @param {number} progress — target morph [0.0, 1.0]
   * @param {number} duration — animation duration in seconds
   */
  setMorph(progress, duration = 0.4) {
    if (typeof gsap !== 'undefined' && this.material) {
      gsap.to(this.material.uniforms.uMorphProgress, {
        value:    Math.max(0, Math.min(1, progress)),
        duration,
        ease:     'power3.out',
        overwrite: true
      });
    }
  }

  // ── CLEANUP: dispose all GPU resources ──────────────────────────────
  /**
   * Critical for SPA usage: all Three.js resources must be explicitly
   * disposed to prevent WebGL context accumulation and memory leaks.
   * Called if pipeline needs to be reconstructed (e.g., context lost).
   */
  dispose() {
    this.isRunning = false;
    cancelAnimationFrame(this.frameId);
    if (this.particles) {
      this.particles.geometry.dispose();
      this.material.dispose();
      this.scene.remove(this.particles);
    }
    this.renderer.dispose();
    clearTimeout(this.settleTimer);
    console.log('[WebGLPipeline] Disposed cleanly.');
  }
}
