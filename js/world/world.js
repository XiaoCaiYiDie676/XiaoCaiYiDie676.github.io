// Renderer, post-processing, camera modes and interaction for both scenes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GLSL_NOISE, easeInOutCubic, radialTexture } from './common.js';
import { buildValley, valleyHeight } from './valley.js';
import { buildFestival, festivalHeight } from './festival.js';

const PainterlyShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uRadius: { value: 0 },
    uInk: { value: 0.22 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uRadius, uInk;
    varying vec2 vUv;
    vec3 comp(vec3 c){ return c / (1.0 + c); }
    void main(){
      vec2 px = 1.0 / uRes;
      vec3 src = texture2D(tDiffuse, vUv).rgb;
      vec3 outc = src;
      int R = int(uRadius + 0.5);
      if (R > 0) {
        // Kuwahara filter: pick the quadrant with the lowest variance → flat brushy patches
        vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
        vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
        float n0 = 0.0, n1 = 0.0, n2 = 0.0, n3 = 0.0;
        for (int j = -5; j <= 5; j++) {
          for (int i = -5; i <= 5; i++) {
            if (abs(i) > R || abs(j) > R || float(i * i + j * j) > uRadius * uRadius + 0.5) continue;
            vec3 c = comp(texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * px).rgb);
            vec3 c2 = c * c;
            if (i <= 0 && j <= 0) { m0 += c; s0 += c2; n0 += 1.0; }
            if (i >= 0 && j <= 0) { m1 += c; s1 += c2; n1 += 1.0; }
            if (i <= 0 && j >= 0) { m2 += c; s2 += c2; n2 += 1.0; }
            if (i >= 0 && j >= 0) { m3 += c; s3 += c2; n3 += 1.0; }
          }
        }
        m0 /= n0; m1 /= n1; m2 /= n2; m3 /= n3;
        float v0 = dot(s0 / n0 - m0 * m0, vec3(1.0));
        float v1 = dot(s1 / n1 - m1 * m1, vec3(1.0));
        float v2 = dot(s2 / n2 - m2 * m2, vec3(1.0));
        float v3 = dot(s3 / n3 - m3 * m3, vec3(1.0));
        vec3 m = m0; float v = v0;
        if (v1 < v) { m = m1; v = v1; }
        if (v2 < v) { m = m2; v = v2; }
        if (v3 < v) { m = m3; v = v3; }
        m = min(m, vec3(0.995));
        outc = m / (1.0 - m);
      }
      // sumi ink edges from luminance gradient
      float lc = dot(comp(src), vec3(0.299, 0.587, 0.114));
      float lx = dot(comp(texture2D(tDiffuse, vUv + vec2(px.x * 1.5, 0.0)).rgb), vec3(0.299, 0.587, 0.114));
      float ly = dot(comp(texture2D(tDiffuse, vUv + vec2(0.0, px.y * 1.5)).rgb), vec3(0.299, 0.587, 0.114));
      float edge = smoothstep(0.05, 0.2, length(vec2(lx - lc, ly - lc)));
      outc *= 1.0 - edge * uInk;
      gl_FragColor = vec4(outc, 1.0);
    }
  `,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.0 },
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.1 },
    uShadowTint: { value: new THREE.Color('#3a5f8f') },
    uHighlightTint: { value: new THREE.Color('#ffd2a1') },
    uTintAmount: { value: 0.25 },
    uVignette: { value: 0.4 },
    uPaper: { value: 0.25 },
    uWipe: { value: 0 },
    uAspect: { value: 1 },
    uTime: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uExposure, uSaturation, uContrast, uTintAmount, uVignette, uPaper, uWipe, uAspect, uTime;
    uniform vec3 uShadowTint, uHighlightTint;
    varying vec2 vUv;
    const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
    ${GLSL_NOISE}
    vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c){
      const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      c = IN * c; c = RRTAndODTFit(c); c = OUT * c; return clamp(c, 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure / 0.6;
      float L = dot(c, LW);
      vec3 st = uShadowTint / max(dot(uShadowTint, LW), 1e-3);
      vec3 ht = uHighlightTint / max(dot(uHighlightTint, LW), 1e-3);
      c *= mix(vec3(1.0), mix(st, ht, smoothstep(0.05, 0.9, L / (1.0 + L))), uTintAmount);
      L = dot(c, LW);
      c = max(mix(vec3(L), c, uSaturation), 0.0);
      c = toSRGB(aces(c));
      c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);

      // washi paper: fibres + mottling
      vec2 uv = vUv * vec2(uAspect, 1.0);
      float fib = vnoise(uv * vec2(900.0, 90.0)) * 0.5 + vnoise(uv * vec2(80.0, 700.0)) * 0.5;
      float mott = fbm(uv * 6.0);
      c *= 1.0 - uPaper * (0.06 * (1.0 - fib) + 0.07 * (1.0 - mott));
      c = mix(c, c * vec3(1.02, 1.0, 0.95), uPaper * 0.5);

      vec2 q = vUv - 0.5;
      c *= clamp(1.0 - uVignette * dot(q, q) * 2.4, 0.0, 1.0);

      // ink-wash transition: paper bleeds in through a noise front, edged with ink
      if (uWipe > 0.0) {
        float n = fbm(uv * 3.0 + 7.0) * 0.75 + (1.0 - vUv.y) * 0.25;
        float front = uWipe * 1.35 - 0.15;
        float m = smoothstep(n - 0.04, n + 0.04, front);
        float ink = smoothstep(0.06, 0.0, abs(front - n)) * (1.0 - m) * step(0.001, uWipe);
        vec3 paper = vec3(0.95, 0.92, 0.85) * (0.94 + 0.06 * fib);
        c = mix(c, vec3(0.08, 0.07, 0.09), ink * 0.85);
        c = mix(c, paper, m);
      }
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export function createWorld(canvas, { projects, accents, profile, skills, onHover, onSelect, onFrame, onPass, onViewChange, onBurst, onLoop }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  // render at full device resolution by default; adaptive scaling below steps down only if needed
  let maxScale = Math.min(window.devicePixelRatio || 1, 2);
  let renderScale = maxScale;
  let reflScale = 0.75;
  renderer.setPixelRatio(renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NoToneMapping;

  const halo = radialTexture();
  const valley = buildValley({ projects, accents, halo, renderScale, profile, skills });
  const festival = buildFestival({ projects, accents, halo, renderScale });
  const worlds = { valley, festival };

  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.3, 9000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.7;
  controls.autoRotateSpeed = 0.2;

  // post
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(valley.scene, camera);
  composer.addPass(renderPass);
  // tame extreme HDR (stacked additive fireworks) so bloom stays round instead of blocky
  const clampPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uMax: { value: 14 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uMax; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float m = max(max(c.r, c.g), c.b);
        gl_FragColor = vec4(m > uMax ? c * (uMax / m) : c, 1.0); }`,
  });
  composer.addPass(clampPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.6, 0.85);
  composer.addPass(bloom);
  const painterly = new ShaderPass(PainterlyShader);
  composer.addPass(painterly);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  // ── view modes: 'valley' (orbit, follows the boat), 'boat' (on board), 'festival'
  let view = 'valley';
  let active = valley;
  let tween = null;
  let wipe = null;
  let focused = null;
  const lastBoat = new THREE.Vector3().copy(valley.boatState.pos);
  const look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };
  let lastInteract = performance.now();
  let autoRotate = true;
  let boatPaused = false;
  let brushRadius = 0;

  const DEFAULT_FOV = 48;
  function applyControlLimits() {
    if (view === 'festival') {
      // free exploration: zoom toward the cursor, right-drag / two-finger drag to pan
      controls.minDistance = 3; controls.maxDistance = 1700;
      controls.minPolarAngle = 0.15; controls.maxPolarAngle = 1.53;
      controls.enablePan = true; controls.zoomToCursor = true; controls.screenSpacePanning = false;
      controls.panSpeed = 1.2;
    } else {
      controls.minDistance = 6; controls.maxDistance = 170;
      controls.minPolarAngle = 0.15; controls.maxPolarAngle = 1.5;
      controls.enablePan = false; controls.zoomToCursor = false;
    }
    if (view !== 'boat' && camera.fov !== DEFAULT_FOV) { camera.fov = DEFAULT_FOV; camera.updateProjectionMatrix(); }
  }

  function setCamera(v) {
    camera.position.copy(v.pos);
    controls.target.copy(v.target);
    camera.lookAt(v.target);
  }

  function flyTo(pos, target, dur = 2.0, done, arc = true) {
    controls.enabled = false;
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), start: performance.now(), dur: dur * 1000, done, arc };
  }

  function runWipe(mid, done) {
    wipe = { start: performance.now(), mid, done, swapped: false };
  }

  function setView(next, after) {
    if (next === view) {
      if (after) after();
      else if (focused || next === 'festival') {
        focused = null;
        lastBoat.copy(valley.boatState.pos);
        const h = active.homeView();
        if (next !== 'boat') flyTo(h.pos, h.target, 1.8);
      }
      return;
    }
    const prevWorld = view === 'festival' ? 'festival' : 'valley';
    const nextWorld = next === 'festival' ? 'festival' : 'valley';
    focused = null;
    if (prevWorld !== nextWorld) {
      runWipe(() => {
        view = next;
        active = worlds[nextWorld];
        renderPass.scene = active.scene;
        applyControlLimits();
        tween = null;
        if (next === 'boat') { controls.enabled = false; }
        else { setCamera(active.homeView()); controls.enabled = true; }
        lastBoat.copy(valley.boatState.pos);
        after?.();
      });
    } else {
      view = next;
      applyControlLimits();
      if (next === 'valley') { const h = valley.homeView(); flyTo(h.pos, h.target, 1.6); }
      else if (next === 'boat') { tween = null; controls.enabled = false; look.tYaw = look.tPitch = 0; }
      after?.();
    }
    onViewChange?.(next);
  }

  // ── landmarks (projects, profile places, festival shots)
  const hits = () => active.markers.filter((m) => m.hit).map((m) => m.hit);
  const byHit = (obj) => active.markers.find((m) => m.hit === obj);
  function findMarker(id) {
    const other = active === valley ? festival : valley;
    return active.markers.find((m) => m.id === id) || other.markers.find((m) => m.id === id);
  }
  function viewFor(m) {
    const p = m.group.getWorldPosition(new THREE.Vector3());
    if (m.view) return m.view(p);
    const toRiver = new THREE.Vector3(Math.sign(valley.boatState.pos.x - p.x) || 1, 0, 0);
    return { pos: p.clone().addScaledVector(toRiver, 13).add(new THREE.Vector3(0, 5, 9)), target: p.clone().add(new THREE.Vector3(0, 4, 0)) };
  }
  function focusMarker(id, instant = false) {
    const m = findMarker(id);
    if (!m) return false;
    const home = valley.markers.includes(m) ? valley : festival;
    if (home !== active) {
      setView(home === valley ? 'valley' : 'festival', () => focusMarker(id, true));
      return true;
    }
    if (view === 'boat') { view = 'valley'; applyControlLimits(); onViewChange?.('valley'); }
    focused = m;
    const v = viewFor(m);
    if (instant) { tween = null; setCamera(v); controls.enabled = true; }
    else flyTo(v.pos, v.target, 2.2);
    if (m.kind !== 'shot') {
      const p = m.group.getWorldPosition(new THREE.Vector3());
      active.water.addRipple(p.x, p.z, 1.2);
    }
    return true;
  }
  function goShot(name) {
    if (name !== 'overview') return focusMarker('shot-' + name);
    if (active !== festival) { setView('festival'); return true; }
    focused = null;
    const h = festival.homeView();
    flyTo(h.pos, h.target, 2.2);
    return true;
  }
  function zoom(factor) {
    lastInteract = performance.now();
    if (view === 'boat') {
      camera.fov = THREE.MathUtils.clamp(camera.fov * factor, 20, 75);
      camera.updateProjectionMatrix();
      return;
    }
    if (tween || wipe) return;
    const off = camera.position.clone().sub(controls.target);
    const d = THREE.MathUtils.clamp(off.length() * factor, controls.minDistance, controls.maxDistance);
    flyTo(controls.target.clone().add(off.setLength(d)), controls.target.clone(), 0.45, null, false);
  }
  canvas.addEventListener('wheel', (e) => {
    if (view !== 'boat') return;
    e.preventDefault();
    zoom(e.deltaY > 0 ? 1.08 : 0.93);
  }, { passive: false });
  const groundAt = (x, z) => Math.max(active === valley ? valleyHeight(x, z) : festivalHeight(x, z), 0);

  // ── pointer interaction
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  let pointerDirty = false;
  let hovered = null;
  let down = null;

  const ndc = (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  canvas.addEventListener('pointermove', (e) => {
    ndc(e);
    pointerDirty = true;
    lastInteract = performance.now();
    if (down && view === 'boat') {
      look.tYaw -= (e.clientX - down.lx) * 0.004;
      look.tPitch -= (e.clientY - down.ly) * 0.003;
      look.tYaw = THREE.MathUtils.clamp(look.tYaw, -2.2, 2.2);
      look.tPitch = THREE.MathUtils.clamp(look.tPitch, -0.5, 0.6);
      down.lx = e.clientX; down.ly = e.clientY;
    }
  });
  canvas.addEventListener('pointerleave', () => { pointer.set(2, 2); pointerDirty = true; });
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY };
    lastInteract = performance.now();
  });
  window.addEventListener('pointerup', (e) => {
    const d = down;
    down = null;
    if (!d || e.target !== canvas || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    ndc(e);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hits(), false)[0];
    if (hit) {
      onSelect?.(byHit(hit.object));
      return;
    }
    if (view === 'festival' && active.launchAtRay(raycaster.ray)) return;
    const ray = raycaster.ray;
    if (ray.direction.y < -1e-3) {
      const t = -ray.origin.y / ray.direction.y;
      active.water.addRipple(ray.origin.x + ray.direction.x * t, ray.origin.z + ray.direction.z * t, 1);
    }
  });

  // ── resize
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(renderScale);
    renderer.setSize(w, h);
    composer.setPixelRatio(renderScale);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    painterly.uniforms.uRes.value.set(w * renderScale, h * renderScale);
    grade.uniforms.uAspect.value = w / h;
    valley.resize(w, h, renderScale, reflScale);
    festival.resize(w, h, renderScale, reflScale);
  }
  window.addEventListener('resize', resize);
  resize();

  applyControlLimits();
  setCamera({ pos: new THREE.Vector3(60, 120, 330), target: new THREE.Vector3(0, 20, -120) });
  controls.enabled = false;

  // ── loop
  const clock = new THREE.Clock();
  let time = 0;
  const proj = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let started = false;

  const perf = { frames: 0, time: 0, good: 0, warm: 0 };
  function adaptResolution(rawDt) {
    if (!started || document.hidden) return;
    perf.warm += rawDt;
    if (perf.warm < 4) return; // let shaders compile first
    perf.frames++; perf.time += rawDt;
    if (perf.time < 2) return;
    const fps = perf.frames / perf.time;
    perf.frames = perf.time = 0;
    if (fps < 38 && renderScale > 0.6) { renderScale = Math.max(0.6, +(renderScale - 0.2).toFixed(2)); perf.good = 0; resize(); }
    else if (fps > 56 && renderScale < maxScale) { if (++perf.good >= 3) { renderScale = Math.min(maxScale, +(renderScale + 0.15).toFixed(2)); perf.good = 0; resize(); } }
    else perf.good = 0;
  }

  function frame() {
    requestAnimationFrame(frame);
    const rawDt = clock.getDelta();
    adaptResolution(rawDt);
    const dt = Math.min(rawDt, 0.05);
    time += dt;
    grade.uniforms.uTime.value = time;
    // soften the brush filter while looking closely at a landmark so its lettering stays legible
    painterly.uniforms.uRadius.value = focused && focused.kind !== 'shot' && !tween ? Math.min(brushRadius, 1) : brushRadius;

    // wipe transition
    if (wipe) {
      const k = (performance.now() - wipe.start) / 1700;
      if (k < 0.5) grade.uniforms.uWipe.value = easeInOutCubic(k * 2);
      else {
        if (!wipe.swapped) { wipe.swapped = true; wipe.mid?.(); }
        grade.uniforms.uWipe.value = 1 - easeInOutCubic(Math.min((k - 0.5) * 2, 1));
      }
      if (k >= 1) { grade.uniforms.uWipe.value = 0; const d = wipe.done; wipe = null; d?.(); }
    }

    // update the active world (the valley keeps sailing even while hidden so the loop feels alive)
    valley.update(dt, time, {
      paused: boatPaused,
      onPass: (p) => onPass?.(p),
      onLoop: () => {
        onLoop?.();
        if (view !== 'festival') runWipe(() => {
          if (view === 'valley') setCamera(valley.homeView());
          lastBoat.copy(valley.boatState.pos);
        });
      },
    });
    if (active === festival) festival.update(dt, time, { camera, onBurst });

    // camera
    if (view === 'boat' && active === valley) {
      look.yaw += (look.tYaw - look.yaw) * Math.min(dt * 5, 1);
      look.pitch += (look.tPitch - look.pitch) * Math.min(dt * 5, 1);
      if (!down && performance.now() - lastInteract > 4000) { look.tYaw *= 0.98; look.tPitch *= 0.98; }
      const b = valley.boat.group;
      b.updateMatrixWorld(true);
      const eye = b.localToWorld(valley.boat.eye.clone());
      const dir = new THREE.Vector3(Math.sin(look.yaw) * -1, Math.sin(look.pitch) - 0.1, -Math.cos(look.yaw));
      dir.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rotation.y));
      camera.position.lerp(eye, Math.min(dt * 8, 1));
      camera.lookAt(tmp.copy(camera.position).add(dir));
      controls.target.copy(camera.position).addScaledVector(dir, 20);
    } else {
      if (view === 'valley' && !focused) {
        // carry the orbit rig along with the boat
        const delta = tmp.subVectors(valley.boatState.pos, lastBoat);
        if (delta.lengthSq() < 100) {
          camera.position.add(delta);
          controls.target.add(delta);
          if (tween) { tween.p1.add(delta); tween.t1.add(delta); tween.p0.add(delta); tween.t0.add(delta); }
        }
      }
      if (tween) {
        const k = Math.min((performance.now() - tween.start) / tween.dur, 1);
        const e = easeInOutCubic(k);
        camera.position.lerpVectors(tween.p0, tween.p1, e);
        if (tween.arc) camera.position.y += Math.sin(e * Math.PI) * Math.min(3, tween.p0.distanceTo(tween.p1) * 0.05);
        controls.target.lerpVectors(tween.t0, tween.t1, e);
        camera.lookAt(controls.target);
        if (k >= 1) { const d = tween.done; tween = null; controls.enabled = true; d?.(); }
      } else if (started) {
        controls.autoRotate = autoRotate && view !== 'festival' && performance.now() - lastInteract > 20000;
        controls.update();
        if (view === 'festival') {
          const t = controls.target;
          t.set(THREE.MathUtils.clamp(t.x, -650, 650), THREE.MathUtils.clamp(t.y, 0, 420), THREE.MathUtils.clamp(t.z, -1800, 330));
        }
      }
      // keep the camera above ground/water
      const floor = groundAt(camera.position.x, camera.position.z) + 1.2;
      if (camera.position.y < floor) camera.position.y = floor;
    }
    lastBoat.copy(valley.boatState.pos);

    // hover
    if (pointerDirty && !tween && !wipe) {
      pointerDirty = false;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hits(), false)[0];
      const m = hit ? byHit(hit.object) : null;
      if (m !== hovered) {
        hovered = m;
        canvas.style.cursor = m ? 'pointer' : view === 'festival' ? 'crosshair' : 'grab';
        onHover?.(m);
      }
    }

    // marker highlight + labels
    const labels = [];
    for (const m of active.markers) {
      const on = m === hovered || focused === m;
      if (m.glow) {
        m.glow.material.opacity += ((on ? 1.0 : 0.5) - m.glow.material.opacity) * Math.min(dt * 8, 1);
        m.glow.scale.setScalar(on ? 9 : 6.5);
      }
      m.group.getWorldPosition(proj);
      const dist = camera.position.distanceTo(proj);
      proj.y += m.labelY;
      proj.project(camera);
      labels.push({
        id: m.id,
        x: (proj.x * 0.5 + 0.5) * window.innerWidth,
        y: (-proj.y * 0.5 + 0.5) * window.innerHeight,
        visible: proj.z < 1 && proj.z > -1 && dist < (m.labelMax ?? 340) && dist > (m.labelMin ?? 0) && !wipe,
        dist,
        hover: on,
      });
    }
    onFrame?.(labels);

    composer.render();
  }

  return {
    start() { frame(); },
    enter() {
      started = true;
      const h = valley.homeView();
      flyTo(h.pos, h.target, 4.8);
    },
    get view() { return view; },
    setView,
    cycleView() {
      const order = ['valley', 'boat', 'festival'];
      setView(order[(order.indexOf(view) + 1) % order.length]);
    },
    focusProject: (id) => focusMarker(id),
    focusMarker: (id) => focusMarker(id),
    goShot,
    zoom,
    markers() {
      const desc = (scene) => (m) => ({
        id: m.id, kind: m.kind, label: m.label, jp: m.jp, accent: m.accent, project: m.project, shot: m.shot,
        scene, z: m.group.getWorldPosition(new THREE.Vector3()).z,
      });
      return [...valley.markers.map(desc('valley')), ...festival.markers.map(desc('festival'))];
    },
    clearFocus() {
      if (!focused) return;
      focused = null;
      // in the valley the camera rejoins the boat; at the festival it stays where you are
      if (view === 'valley') { lastBoat.copy(valley.boatState.pos); const h = valley.homeView(); flyTo(h.pos, h.target, 2.0); }
    },
    resetView() {
      focused = null;
      const h = active.homeView();
      if (view === 'boat') return;
      flyTo(h.pos, h.target, 2.0);
    },
    setTimeOfDay(name) { valley.setTOD(name); },
    setBloom({ strength, radius, threshold }) {
      if (strength !== undefined) bloom.strength = strength;
      if (radius !== undefined) bloom.radius = radius;
      if (threshold !== undefined) bloom.threshold = threshold;
    },
    setPainterly({ radius, ink }) {
      if (radius !== undefined) brushRadius = radius;
      painterly.uniforms.uRadius.value = brushRadius;
      if (ink !== undefined) painterly.uniforms.uInk.value = ink;
      painterly.enabled = painterly.uniforms.uRadius.value > 0 || painterly.uniforms.uInk.value > 0;
    },
    setGrade(o) {
      const u = grade.uniforms;
      if (o.exposure !== undefined) u.uExposure.value = o.exposure;
      if (o.saturation !== undefined) u.uSaturation.value = o.saturation;
      if (o.contrast !== undefined) u.uContrast.value = o.contrast;
      if (o.shadowTint !== undefined) u.uShadowTint.value.set(o.shadowTint);
      if (o.highlightTint !== undefined) u.uHighlightTint.value.set(o.highlightTint);
      if (o.tintAmount !== undefined) u.uTintAmount.value = o.tintAmount;
      if (o.vignette !== undefined) u.uVignette.value = o.vignette;
      if (o.paper !== undefined) u.uPaper.value = o.paper;
    },
    setLayer(name, on) {
      for (const w of [valley, festival]) (w.layers[name] || []).forEach((m) => (m.visible = on));
    },
    setFireworks(on) { festival.setAutoShow(on); },
    finale() { if (view === 'festival') festival.finale(); },
    setBoatPaused(p) { boatPaused = p; },
    valleyBoatZ() { return valley.boatState.z; },
    setAutoRotate(on) { autoRotate = on; },
    setRenderScale(s) { maxScale = s; renderScale = s; perf.good = 0; resize(); },
    get renderScale() { return renderScale; },
    setReflectionQuality(s) { reflScale = s; resize(); },
  };
}
