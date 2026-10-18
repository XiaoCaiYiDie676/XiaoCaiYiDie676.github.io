// Shared helpers, shaders and builders used by both scenes.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ─── math / noise ────────────────────────────────────────────

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

export function fbm2(x, z, oct = 5) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * noise3(x * f, 0.5 + i * 7.1, z * f); f *= 2.03; a *= 0.5; }
  return v / (1 - Math.pow(0.5, oct));
}

export const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = m * p; a *= 0.5; }
  return v;
}
`;

// Fog used by every custom shader (soft exponential, tinted toward the sun).
const GLSL_FOG = /* glsl */ `
vec3 applyFog(vec3 col, vec3 world, float density){
  vec3 toP = world - cameraPosition;
  float dist = length(toP);
  float f = 1.0 - exp(-pow(dist * density, 1.35));
  f *= mix(1.0, 0.7, smoothstep(0.0, 260.0, world.y));
  vec3 V = toP / dist;
  vec3 fc = uFogColor + uSunColor * pow(max(dot(V, uSunDir), 0.0), 8.0) * 0.3 * (1.0 - uNight * 0.8);
  return mix(col, fc, clamp(f, 0.0, 1.0));
}
`;

// ─── shared uniforms ─────────────────────────────────────────

export function makeUniforms() {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uSunSize: { value: 0.99965 },
    uSkyTop: { value: new THREE.Color() },
    uSkyMid: { value: new THREE.Color() },
    uSkyHorizon: { value: new THREE.Color() },
    uFogColor: { value: new THREE.Color() },
    uFogDensity: { value: 0.0011 },
    uAmbient: { value: new THREE.Color() },
    uNight: { value: 0 },
    uWaterColor: { value: new THREE.Color() },
    uFlash: { value: new THREE.Color(0, 0, 0) },
  };
}

export function sunDirFrom(elev, azim, out = new THREE.Vector3()) {
  return out.set(Math.sin(azim) * Math.cos(elev), Math.sin(elev), -Math.cos(azim) * Math.cos(elev)).normalize();
}

// ─── sky ─────────────────────────────────────────────────────

export function makeSky(U, radius = 2600) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: U,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSkyTop, uSkyMid, uSkyHorizon, uSunDir, uSunColor, uFlash;
        uniform float uTime, uNight, uSunSize;
        varying vec3 vDir;
        ${GLSL_NOISE}
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.22, h));
          col = mix(col, uSkyTop, smoothstep(0.15, 0.75, h));
          if (h < 0.0) col = mix(uSkyHorizon, uSkyHorizon * 0.75, smoothstep(0.0, -0.3, h));
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunColor * (pow(sd, 5.0) * 0.32 + pow(sd, 60.0) * 0.7) * (1.0 - uNight * 0.85);

          // painterly clouds: soft fbm masses with brushy edges
          if (h > 0.0) {
            vec2 cp = d.xz / (h + 0.12) * 0.8 + vec2(uTime * 0.005, uTime * 0.002);
            float c = fbm(cp * 1.15 + fbm(cp * 2.3) * 0.35);
            c = smoothstep(0.5, 0.8, c);
            float fade = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.6, 0.98, h));
            float edge = fbm(cp * 1.15 - uSunDir.xz * 0.05);
            vec3 lit = mix(uSkyHorizon * 1.08, uSunColor * 1.25 + 0.08, pow(sd, 3.0) * (1.0 - uNight));
            vec3 shade = mix(uSkyMid, uSkyTop, 0.5) * 0.92;
            vec3 cc = mix(lit, shade, smoothstep(0.45, 0.85, edge) * 0.6);
            cc += uSunColor * pow(sd, 18.0) * (1.0 - c) * 1.4;
            cc += uFlash * 0.12;
            col = mix(col, cc, c * fade * mix(0.85, 0.45, uNight));
          }

          float disc = smoothstep(uSunSize, uSunSize + 0.0003, dot(d, uSunDir));
          col += uSunColor * disc * mix(20.0, 5.0, uNight);
          // faint moon halo at night
          col += uSunColor * pow(sd, 400.0) * uNight * 1.5;

          if (uNight > 0.01 && h > 0.0) {
            vec3 sp = d * 280.0;
            vec3 cell = floor(sp);
            float r = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
            float star = step(0.972, r) * smoothstep(0.3, 0.0, length(fract(sp) - 0.5));
            star *= 0.55 + 0.45 * sin(uTime * 2.0 + r * 120.0);
            col += vec3(0.85, 0.92, 1.25) * star * uNight * 2.6 * smoothstep(0.03, 0.3, h);
          }
          col += uFlash * 0.08 * smoothstep(-0.05, 0.5, h);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

// ─── terrain (painterly, cel-lit, atmospheric) ───────────────

export function makeTerrainMaterial(U, { blossoms = 1, palette = 'spring' } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uBlossoms: { value: blossoms } },
    defines: palette === 'night' ? { NIGHT_PALETTE: 1 } : {},
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec3 vNormal;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSunColor, uFogColor, uSkyTop, uSkyMid, uAmbient, uFlash;
      uniform float uFogDensity, uNight, uBlossoms;
      varying vec3 vWorld; varying vec3 vNormal;
      ${GLSL_NOISE}
      ${GLSL_FOG}
      void main(){
        vec3 n = normalize(vNormal);
        float ndl = dot(n, uSunDir);
        vec2 sp = vWorld.xz;
        // anisotropic "brush stroke" noise
        float stroke = vnoise(vec2(sp.x * 0.32 + sp.y * 0.11, sp.y * 0.06 - sp.x * 0.025 + vWorld.y * 0.05));
        float big = fbm(sp * 0.007);
        float mid = fbm(sp * 0.035 + 3.0);
        float slope = 1.0 - n.y;
        float h = vWorld.y;

        #ifdef NIGHT_PALETTE
        vec3 grass = mix(vec3(0.20, 0.30, 0.22), vec3(0.30, 0.36, 0.26), mid);
        vec3 forest = mix(vec3(0.08, 0.14, 0.14), vec3(0.14, 0.2, 0.18), mid);
        #else
        vec3 grass = mix(vec3(0.44, 0.58, 0.25), vec3(0.66, 0.68, 0.32), mid);
        vec3 forest = mix(vec3(0.11, 0.26, 0.2), vec3(0.22, 0.38, 0.23), mid);
        #endif
        vec3 rock = mix(vec3(0.40, 0.40, 0.40), vec3(0.58, 0.55, 0.50), stroke);
        #ifdef NIGHT_PALETTE
        vec3 sand = mix(vec3(0.3, 0.27, 0.26), vec3(0.38, 0.34, 0.3), stroke);
        #else
        vec3 sand = mix(vec3(0.62, 0.56, 0.46), vec3(0.72, 0.66, 0.55), stroke);
        #endif
        vec3 blossom = mix(vec3(0.86, 0.5, 0.64), vec3(0.97, 0.72, 0.8), stroke);

        vec3 base = mix(grass, forest, smoothstep(6.0, 30.0, h + (big - 0.5) * 36.0));
        float pink = smoothstep(0.6, 0.68, fbm(sp * 0.017 + 11.0) + (stroke - 0.5) * 0.08)
                   * smoothstep(2.0, 9.0, h) * (1.0 - smoothstep(150.0, 240.0, h)) * uBlossoms;
        base = mix(base, blossom, pink);
        base = mix(base, rock, smoothstep(0.38, 0.62, slope + (stroke - 0.5) * 0.3));
        base = mix(base, sand, smoothstep(0.95, 0.2, h));
        base *= 0.86 + 0.28 * stroke;

        float lit = smoothstep(-0.12, 0.3, ndl) * 0.8 + smoothstep(0.5, 0.65, ndl) * 0.2;
        vec3 shadowCol = mix(uSkyTop, vec3(0.32, 0.26, 0.48), 0.5) * 0.55;
        vec3 col = base * (uSunColor * lit * 1.15 + uAmbient + shadowCol * (1.0 - lit) + uFlash * 0.35);

        vec3 V = normalize(cameraPosition - vWorld);
        float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * smoothstep(-0.1, 0.7, dot(-V, uSunDir));
        col += uSunColor * rim * 0.45 * (1.0 - uNight * 0.8);
        gl_FragColor = vec4(applyFog(col, vWorld, uFogDensity), 1.0);
      }
    `,
  });
}

// ─── foliage (instanced, wind, translucent) ──────────────────

export function makeFoliageMaterial(U, { shadow, mid, high, trans, wind = 0.12, dabs = 0.4, map = null }) {
  return new THREE.ShaderMaterial({
    defines: map ? { USE_CARDS: 1 } : {},
    side: map ? THREE.DoubleSide : THREE.FrontSide,
    alphaToCoverage: !!map,
    uniforms: {
      map: { value: map },
      ...U,
      uC0: { value: new THREE.Color(shadow) },
      uC1: { value: new THREE.Color(mid) },
      uC2: { value: new THREE.Color(high) },
      uTrans: { value: new THREE.Color(trans) },
      uWind: { value: wind },
      uDabs: { value: dabs },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uWind;
      attribute float aShade;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vTint; varying vec2 vUv; varying float vShade;
      void main(){
        vUv = uv;
        vShade = aShade;
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
        m = modelMatrix * instanceMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        float sway = sin(uTime * 1.3 + wp.x * 0.12 + wp.z * 0.09) + 0.5 * sin(uTime * 2.7 + wp.z * 0.3);
        float k = max(position.y - 2.0, 0.0) * uWind;
        wp.x += sway * k * 0.6;
        wp.z += sway * k * 0.35;
        vNormal = normalize(mat3(m) * normal);
        #ifdef USE_CARDS
        // individual blossom clusters flutter a little
        wp.xyz += vNormal * sin(uTime * 3.1 + wp.x * 1.7 + wp.z * 1.3 + wp.y * 2.1) * 0.035;
        #endif
        vWorld = wp.xyz;
        vTint = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
        vTint = instanceColor;
        #endif
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSunColor, uFogColor, uAmbient, uFlash, uC0, uC1, uC2, uTrans;
      uniform float uFogDensity, uNight, uDabs, uTime;
      uniform sampler2D map;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vTint; varying vec2 vUv; varying float vShade;
      ${GLSL_NOISE}
      ${GLSL_FOG}
      void main(){
        float alpha = 1.0;
        float detail = 1.0;
        #ifdef USE_CARDS
        vec4 tx = texture2D(map, vUv);
        if (tx.a < 0.2) discard;
        alpha = smoothstep(0.2, 0.55, tx.a);
        detail = mix(0.68, 1.12, tx.r);
        #endif
        vec3 n = normalize(vNormal);
        float dabs = vnoise(vWorld.xz * 2.2 + vWorld.y * 1.7);
        float l = smoothstep(-0.35, 0.65, dot(n, uSunDir) + (dabs - 0.5) * uDabs);
        vec3 c = mix(uC0, uC1, smoothstep(0.0, 0.55, l));
        c = mix(c, uC2, smoothstep(0.6, 0.95, l));
        c *= vTint * detail;
        vec3 col = c * (uSunColor * (0.35 + l * 0.75) + uAmbient * 0.9 + uFlash * 0.5);
        col *= 1.0 - vShade * 0.5;
        vec3 V = normalize(cameraPosition - vWorld);
        float trans = pow(max(dot(-V, uSunDir), 0.0), 4.0) * (1.0 - l * 0.6);
        col += uTrans * uSunColor * trans * 0.55 * (1.0 - uNight * 0.6);
        gl_FragColor = vec4(applyFog(col, vWorld, uFogDensity), alpha);
      }
    `,
  });
}

// ─── toon materials for built structures ─────────────────────

let _grad;
function toonGradient() {
  if (_grad) return _grad;
  // five soft steps, linearly filtered: cel-shaded but without hard facets
  _grad = new THREE.DataTexture(new Uint8Array([80, 125, 172, 218, 255]), 5, 1, THREE.RedFormat);
  _grad.minFilter = _grad.magFilter = THREE.LinearFilter;
  _grad.generateMipmaps = false;
  _grad.needsUpdate = true;
  return _grad;
}
export const toon = (color, extra = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });

export function woodTexture(base = '#7a5236', line = '#4c3020', planks = 6) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 128);
  const rng = mulberry32(42);
  for (let i = 0; i < 400; i++) {
    g.strokeStyle = `rgba(40,20,10,${0.05 + rng() * 0.08})`;
    g.lineWidth = 1 + rng() * 2;
    const y = rng() * 128;
    g.beginPath(); g.moveTo(0, y);
    g.bezierCurveTo(170, y + (rng() - 0.5) * 6, 340, y + (rng() - 0.5) * 6, 512, y + (rng() - 0.5) * 4);
    g.stroke();
  }
  g.strokeStyle = line; g.lineWidth = 3;
  for (let i = 1; i < planks; i++) { const y = (i / planks) * 128; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── geometry builders ───────────────────────────────────────

export function makePeakGeometry(h, r, seed, rng, rough = 1) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 48, 30, true);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const leanA = rng() * Math.PI * 2;
  const leanR = rng() * 0.35 * r;
  const lx = Math.cos(leanA) * leanR, lz = Math.sin(leanA) * leanR;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = v.y + 0.5;
    const a = Math.atan2(v.z, v.x);
    const ca = Math.cos(a), sa = Math.sin(a);
    const prof = Math.pow(Math.max(1 - Math.pow(t, 2.2), 0), 0.8) * (1 + 0.8 * Math.pow(1 - t, 4));
    const n = noise3(ca * 1.2 + seed, sa * 1.2, t * 2.5);
    const n2 = noise3(ca * 5 + seed * 2, sa * 5, t * 9);
    const rad = r * prof * (0.8 + (0.4 * n + 0.12 * n2) * rough);
    pos.setXYZ(i, ca * rad + lx * t * t, t * h, sa * rad + lz * t * t);
  }
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g);
  m.computeVertexNormals();
  return m;
}

export function makeRoofGeometry(R, H, lift, sides = 4) {
  const g = new THREE.ConeGeometry(R, H, sides, 10, true);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = Math.hypot(v.x, v.z) / R;
    v.y += Math.pow(t, 3.2) * lift;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Blossom / needle "cards": small alpha-tested quads with spherical normals give
// trees a soft, detailed silhouette instead of faceted blobs.
const _cardTex = {};
export function foliageCardTexture(kind = 'blossom') {
  if (_cardTex[kind]) return _cardTex[kind];
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rng = mulberry32(kind === 'blossom' ? 11 : 23);
  // dense core used by the inner canopy volume (sampled at uv 0.5, 0.5)
  const core = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, 26);
  core.addColorStop(0, 'rgba(235,235,235,1)'); core.addColorStop(1, 'rgba(235,235,235,1)');
  g.fillStyle = core; g.beginPath(); g.arc(S / 2, S / 2, 24, 0, Math.PI * 2); g.fill();
  if (kind === 'blossom') {
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 104;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
      const r = 7 + rng() * 7;
      const rot = rng() * Math.PI;
      const shade = 210 + Math.floor(rng() * 45);
      for (let k = 0; k < 5; k++) {
        const pa = rot + (k / 5) * Math.PI * 2;
        g.fillStyle = `rgb(${shade},${shade},${shade})`;
        g.beginPath();
        g.ellipse(x + Math.cos(pa) * r * 0.55, y + Math.sin(pa) * r * 0.55, r * 0.55, r * 0.38, pa, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgb(90,90,90)';
      g.beginPath(); g.arc(x, y, r * 0.2, 0, Math.PI * 2); g.fill();
    }
  } else {
    // needle sprays
    g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 96;
      const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
      const ang = rng() * Math.PI * 2, len = 16 + rng() * 18;
      const v = 140 + Math.floor(rng() * 110);
      g.strokeStyle = `rgb(${v},${v},${v})`;
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
      g.lineWidth = 2;
      for (let k = 1; k < 6; k++) {
        const t = k / 6, bx = x + Math.cos(ang) * len * t, by = y + Math.sin(ang) * len * t;
        for (const sgn of [-1, 1]) {
          g.beginPath(); g.moveTo(bx, by);
          g.lineTo(bx + Math.cos(ang + sgn * 0.9) * 7, by + Math.sin(ang + sgn * 0.9) * 7); g.stroke();
        }
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  _cardTex[kind] = t;
  return t;
}

function makeCardCanopy(rng, blobs, center, { cards = 22, size = 1.3, filler = 0.78 } = {}) {
  const pos = [], nor = [], uvs = [], shade = [];
  const v = new THREE.Vector3(), d = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
  const pushV = (p, nn, u, w, sh) => { pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z); uvs.push(u, w); shade.push(sh); };
  for (const bl of blobs) {
    // inner volume so the crown never looks hollow
    const ico = new THREE.IcosahedronGeometry(bl.r * filler, 1).toNonIndexed();
    ico.scale(1, 0.8, 1);
    const ip = ico.attributes.position;
    for (let i = 0; i < ip.count; i++) {
      v.set(ip.getX(i) + bl.c.x, ip.getY(i) + bl.c.y, ip.getZ(i) + bl.c.z);
      n.copy(v).sub(center).normalize();
      pushV(v, n, 0.5, 0.5, 0.45);
    }
    for (let k = 0; k < cards; k++) {
      d.set(rng() * 2 - 1, rng() * 1.6 - 0.5, rng() * 2 - 1).normalize();
      const p = bl.c.clone().addScaledVector(d, bl.r * (0.7 + rng() * 0.38));
      // card faces roughly outward, randomly rolled
      const outward = p.clone().sub(center).normalize().lerp(d, 0.5).normalize();
      const face = outward.clone().add(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.9)).normalize();
      t.set(0, 1, 0).cross(face);
      if (t.lengthSq() < 1e-4) t.set(1, 0, 0);
      t.normalize().applyAxisAngle(face, rng() * Math.PI * 2);
      b.crossVectors(face, t).normalize();
      const s = size * (0.75 + rng() * 0.5) * 0.5;
      n.copy(p).sub(center).normalize().lerp(outward, 0.35).normalize();
      const sh = THREE.MathUtils.clamp((center.y - p.y) / 3, 0, 1) * 0.5;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => p.clone().addScaledVector(t, x * s).addScaledVector(b, y * s));
      const uvc = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (const idx of [0, 1, 2, 0, 2, 3]) pushV(corners[idx], n, uvc[idx][0], uvc[idx][1], sh);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aShade', new THREE.Float32BufferAttribute(shade, 1));
  return geo;
}

export function makeCherryGeometries(rng) {
  // canopy clumps first, so the branches can grow into them
  const blobs = [];
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + rng() * 0.6, d = k === 0 ? 0 : 1.0 + rng() * 1.9;
    const r = 1.0 + rng() * 0.75;
    blobs.push({ c: new THREE.Vector3(Math.cos(a) * d, 4.0 + rng() * 1.5 - d * 0.22, Math.sin(a) * d), r });
  }
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.2, 0.44, 3.4, 12, 8).translate(0, 1.7, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    tp.setX(i, tp.getX(i) + Math.sin(y * 0.9) * 0.14);
    tp.setZ(i, tp.getZ(i) + Math.cos(y * 0.7) * 0.08);
  }
  trunk.computeVertexNormals();
  parts.push(trunk);
  for (const bl of blobs) {
    const start = new THREE.Vector3(Math.sin(3.0 * 0.9) * 0.14, 2.9 + rng() * 0.4, 0);
    const end = bl.c.clone().multiplyScalar(0.9);
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3((rng() - 0.5) * 0.6, 0.5, (rng() - 0.5) * 0.6));
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start, mid, end]), 10, 0.07 + rng() * 0.05, 6));
  }
  const wood = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => { p.deleteAttribute('uv'); return p; }));
  const canopy = makeCardCanopy(rng, blobs, new THREE.Vector3(0, 4.3, 0), { cards: 24, size: 1.35 });
  return { wood, canopy };
}

export function makeCedarGeometry() {
  // five drooping, star-edged tiers: reads as a sugi silhouette rather than stacked cones
  const tiers = [];
  const spec = [[1.75, 2.6, 1.6], [1.5, 2.4, 2.8], [1.22, 2.2, 3.9], [0.95, 2.0, 4.9], [0.62, 1.8, 5.9]];
  spec.forEach(([r, h, y], ti) => {
    const g = new THREE.ConeGeometry(r, h, 16, 4);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), yy = p.getY(i), z = p.getZ(i);
      const rad = Math.hypot(x, z);
      if (rad < 1e-4) continue;
      const a = Math.atan2(z, x);
      const tr = rad / r;
      const star = 1 + 0.16 * Math.cos(a * 9 + ti) * tr;
      p.setXYZ(i, x * star, yy - tr * tr * 0.35, z * star);
    }
    g.translate(0, y, 0);
    tiers.push(g);
  });
  tiers.push(new THREE.CylinderGeometry(0.13, 0.22, 1.8, 8).translate(0, 0.9, 0));
  const geo = mergeGeometries(tiers.map((g) => g.toNonIndexed()));
  geo.computeVertexNormals();
  return geo;
}

// ─── water ───────────────────────────────────────────────────

export function makeWater(U, { size = [4000, 4000], center = [0, 0], river = false, calm = 1, petals = 1, reflScale = 0.5, renderScale = 1 }) {
  const MAX_RIPPLES = 10;
  const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0));
  let rippleIdx = 0;
  const water = new Reflector(new THREE.PlaneGeometry(size[0], size[1]), {
    textureWidth: window.innerWidth * renderScale * reflScale,
    textureHeight: window.innerHeight * renderScale * reflScale,
    clipBias: 0.003,
    multisample: 0,
    shader: {
      name: 'PainterlyWater',
      uniforms: { tDiffuse: { value: null }, textureMatrix: { value: null }, color: { value: null } },
      defines: {},
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vUv; varying vec3 vWorld;
        void main(){
          vUv = textureMatrix * vec4(position, 1.0);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        #define RIVER ${river ? 1 : 0}
        uniform sampler2D tDiffuse;
        uniform vec3 uSunDir, uSunColor, uFogColor, uAmbient, uWaterColor, uRippleColor, uFlash;
        uniform float uTime, uFogDensity, uNight, uFlow, uCalm, uPetals, uBoatSpeed;
        uniform vec4 uBoat;
        uniform vec4 uRipples[${MAX_RIPPLES}];
        varying vec4 vUv; varying vec3 vWorld;
        ${GLSL_NOISE}
        ${GLSL_FOG}

        float riverX(float z){ return 28.0 * sin(z * 0.0055) + 12.0 * sin(z * 0.017 + 1.3); }
        float riverW(float z){ return 22.0 + 6.0 * sin(z * 0.009 + 0.5); }

        vec2 waveGrad(vec2 p, float t){
          vec2 g = vec2(0.0);
          vec2 d1 = normalize(vec2(0.3, 1.0));  g += d1 * cos(dot(d1, p) * 0.5 + t * 1.1) * 0.5 * 0.05;
          vec2 d2 = normalize(vec2(-0.6, 0.8)); g += d2 * cos(dot(d2, p) * 0.9 + t * 1.6) * 0.9 * 0.025;
          vec2 d3 = normalize(vec2(0.9, 0.4));  g += d3 * cos(dot(d3, p) * 1.9 + t * 2.3) * 1.9 * 0.009;
          float e = 0.12;
          vec2 q = p * 0.5;
          float n0 = vnoise(q), nx = vnoise(q + vec2(e, 0.0)), nz = vnoise(q + vec2(0.0, e));
          g += vec2(nx - n0, nz - n0) / e * 0.07;
          return g;
        }

        void main(){
          vec3 toCam = cameraPosition - vWorld;
          float dist = length(toCam);
          vec3 V = toCam / dist;
          // the river flows toward +z
          vec2 fp = vec2(vWorld.x, vWorld.z - uTime * uFlow);
          vec2 g = waveGrad(fp, uTime) * uCalm / (1.0 + dist * 0.01);

          float foam = 0.0;
          float shore = 0.0;
          #if RIVER
          float dEdge = abs(vWorld.x - riverX(vWorld.z)) - riverW(vWorld.z);
          shore = smoothstep(-7.0, 1.0, dEdge);
          float fn = vnoise(vec2(vWorld.x * 0.7, fp.y * 0.5));
          foam += shore * smoothstep(0.55, 0.9, fn + shore * 0.2) * 0.32;

          // boat wake (Kelvin-ish wedge + churned centre trail + bow wave)
          vec2 rel = vWorld.xz - uBoat.xy;
          vec2 F = uBoat.zw; vec2 S = vec2(-F.y, F.x);
          float along = dot(rel, F), side = dot(rel, S);
          float back = -along;
          if (back > -10.0 && back < 120.0) {
            float b = max(back, 0.0);
            float chop = vnoise(vec2(side * 1.4, back * 0.7 - uTime * 3.0));
            float spread = b * 0.34 + 1.4;
            float arm = smoothstep(1.8, 0.0, abs(abs(side) - spread)) * exp(-b * 0.03) * step(-1.0, back);
            float trail = smoothstep(1.6, 0.0, abs(side)) * exp(-b * 0.06) * step(0.0, back);
            float bow = smoothstep(1.6, 0.0, length(vec2(side * 0.9, along - 7.0)));
            float wake = (arm * (0.5 + 0.8 * chop) + trail * (0.4 + chop) * 0.7 + bow * 0.7) * uBoatSpeed;
            g += vec2(sin(side * 3.0 - uTime * 4.0), cos(back * 2.0 - uTime * 5.0)) * wake * 0.22;
            foam += wake * smoothstep(0.3, 0.75, fn) * 1.1;
          }
          #endif

          float glow = 0.0;
          for (int i = 0; i < ${MAX_RIPPLES}; i++) {
            vec4 r = uRipples[i];
            float age = uTime - r.z;
            if (age < 0.0 || age > 5.0) continue;
            vec2 dv = vWorld.xz - r.xy;
            float d = length(dv) + 1e-4;
            float front = age * 5.0;
            float env = exp(-abs(d - front) * 0.6) * exp(-age * 0.9) * r.w;
            g += (dv / d) * cos(d * 2.4 - age * 13.0) * env * 0.8;
            glow += smoothstep(1.2, 0.0, abs(d - front)) * exp(-age * 1.2) * r.w;
          }

          vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
          vec2 ruv = vUv.xy / vUv.w + N.xz * 0.05;
          vec3 refl = texture2D(tDiffuse, ruv).rgb;
          float ndv = max(dot(N, V), 0.0);
          float fres = clamp((0.04 + 0.96 * pow(1.0 - ndv, 5.0)) * 1.05 + 0.07, 0.0, 1.0);

          float var = fbm(vWorld.xz * 0.025);
          vec3 shallow = uWaterColor * 1.8 + vec3(0.06, 0.1, 0.05);
          vec3 body = mix(uWaterColor * (0.8 + var * 0.5), shallow, shore * 0.7);
          body *= (uSunColor * 0.45 + uAmbient * 1.1 + uFlash * 0.4);
          float scatter = pow(max(dot(-V, uSunDir), 0.0), 3.0) * max(g.x + g.y + 0.3, 0.0);
          body += vec3(0.12, 0.5, 0.4) * uSunColor * scatter * 0.3;
          vec3 col = mix(body, refl, fres);

          vec3 R = reflect(-V, N);
          float rs = max(dot(R, uSunDir), 0.0);
          float spec = pow(rs, 900.0) * 9.0 + pow(rs, 160.0) * 0.3;
          float sparkle = step(0.86, vnoise(vWorld.xz * 3.2 + uTime * 1.4)) * pow(rs, 60.0) * 3.0;
          col += uSunColor * (spec + sparkle) * mix(1.0, 0.5, uNight);

          vec3 foamCol = vec3(0.95, 0.96, 0.98) * (uSunColor * 0.6 + uAmbient + 0.15);
          col = mix(col, foamCol, clamp(foam, 0.0, 0.85));

          // fallen petals drifting with the current
          if (uPetals > 0.0) {
            vec2 pp = vec2(vWorld.x, vWorld.z - uTime * uFlow * 0.9) * 1.5;
            vec2 cell = floor(pp); vec2 f = fract(pp);
            float rnd = hash12(cell);
            vec2 c = vec2(hash12(cell + 1.7), hash12(cell + 5.3)) * 0.6 + 0.2;
            float dens = smoothstep(0.42, 0.8, fbm(pp * 0.05 + 4.0)) * (0.35 + shore) * uPetals;
            vec2 q = f - c;
            float ang = rnd * 6.28;
            q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q;
            float petal = step(1.0 - dens * 0.85, rnd) * smoothstep(0.13, 0.08, length(q * vec2(1.0, 1.8)));
            vec3 pc = mix(vec3(1.0, 0.72, 0.82), vec3(1.0, 0.9, 0.93), rnd) * (uSunColor * 0.7 + uAmbient + uFlash * 0.3);
            col = mix(col, pc, petal * (1.0 - smoothstep(60.0, 220.0, dist)));
          }

          col += uRippleColor * glow * 1.3;
          gl_FragColor = vec4(applyFog(col, vWorld, uFogDensity * 0.9), 1.0);
        }
      `,
    },
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(center[0], 0, center[1]);
  Object.assign(water.material.uniforms, U, {
    uRipples: { value: ripples },
    uRippleColor: { value: new THREE.Color(1.0, 0.85, 0.55) },
    uFlow: { value: river ? 1.6 : 0.15 },
    uCalm: { value: calm },
    uPetals: { value: petals },
    uBoat: { value: new THREE.Vector4(0, 0, 0, -1) },
    uBoatSpeed: { value: 0 },
  });
  let refl = reflScale;
  return {
    mesh: water,
    uniforms: water.material.uniforms,
    addRipple(x, z, strength = 1) {
      ripples[rippleIdx].set(x, z, U.uTime.value, strength);
      rippleIdx = (rippleIdx + 1) % MAX_RIPPLES;
    },
    resize(w, h, renderScale, reflScale = refl) {
      refl = reflScale;
      water.getRenderTarget().setSize(Math.max(1, Math.round(w * renderScale * refl)), Math.max(1, Math.round(h * renderScale * refl)));
    },
  };
}

// ─── atmosphere: mist layers & falling petals ───────────────

export function makeMist(U, heights, { amount = 0.38, scale = 0.012 } = {}) {
  const shared = { amount: { value: amount } };
  const meshes = heights.map((y, i) => {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { ...U, uLayer: { value: i }, uAmount: shared.amount, uScale: { value: scale } },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uFogColor, uSunColor, uSunDir, uFlash; uniform float uTime, uLayer, uAmount, uNight, uScale;
        varying vec3 vWorld;
        ${GLSL_NOISE}
        void main(){
          float n = fbm(vWorld.xz * uScale + vec2(uTime * 0.008, uLayer * 3.7 + uTime * 0.004));
          float a = smoothstep(0.42, 0.85, n);
          float dist = length(cameraPosition - vWorld);
          a *= smoothstep(60.0, 260.0, dist) * (1.0 - smoothstep(1400.0, 2200.0, dist));
          vec3 V = normalize(vWorld - cameraPosition);
          vec3 col = uFogColor * 1.04 + uSunColor * pow(max(dot(V, uSunDir), 0.0), 4.0) * 0.5 * (1.0 - uNight) + uFlash * 0.15;
          gl_FragColor = vec4(col, a * uAmount);
        }
      `,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = 2;
    return m;
  });
  return { meshes, uniforms: shared };
}

export function makePetals(U, count, rng, { radius = 60, height = 40, renderScale = 1 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count), col = new Float32Array(count * 3);
  const c = new THREE.Color();
  const palette = ['#ffc4d6', '#ffe4ec', '#ffb0c8', '#fff2f5'];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rng() - 0.5) * 2 * radius;
    pos[i * 3 + 1] = rng() * height;
    pos[i * 3 + 2] = (rng() - 0.5) * 2 * radius;
    seed[i] = rng();
    c.set(palette[i % palette.length]);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTime: U.uTime, uSunColor: U.uSunColor, uAmbient: U.uAmbient, uFlash: U.uFlash,
      uPR: { value: renderScale }, uCenter: { value: new THREE.Vector3() }, uR: { value: radius }, uH: { value: height },
      uWindX: { value: 1.2 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed; attribute vec3 aColor;
      uniform float uTime, uPR, uR, uH, uWindX; uniform vec3 uCenter;
      varying vec3 vColor; varying float vRot; varying float vA;
      void main(){
        vec3 p = position;
        float fall = uTime * (1.0 + aSeed * 1.3);
        p.y = mod(position.y - fall, uH);
        p.x += sin(uTime * 0.6 + aSeed * 30.0) * 2.5 + uTime * uWindX;
        p.z += cos(uTime * 0.4 + aSeed * 11.0) * 2.0 + uTime * 0.4;
        // wrap the volume around the camera focus so petals are always nearby
        p.xz = mod(p.xz - uCenter.xz + uR, 2.0 * uR) - uR + uCenter.xz;
        p.y += uCenter.y - 6.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.8 + aSeed * 1.6) * uPR * (110.0 / -mv.z);
        vRot = uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0;
        vA = smoothstep(0.0, 4.0, p.y - uCenter.y + 6.0) * smoothstep(uH, uH - 6.0, p.y - uCenter.y + 6.0) * smoothstep(2.5, 9.0, -mv.z);
        gl_PointSize = min(gl_PointSize, 22.0 * uPR);
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunColor, uAmbient, uFlash;
      varying vec3 vColor; varying float vRot; varying float vA;
      void main(){
        vec2 p = gl_PointCoord - 0.5;
        float c = cos(vRot), s = sin(vRot);
        p = mat2(c, -s, s, c) * p;
        p.x *= 1.9 + 0.8 * sin(vRot * 0.7);
        float a = smoothstep(0.5, 0.36, length(p));
        if (a < 0.02) discard;
        gl_FragColor = vec4(vColor * (uSunColor * 0.75 + uAmbient + uFlash * 0.4 + 0.1), a * 0.92 * vA);
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// ─── project marker: stone lantern + nobori banner ──────────

function bannerTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 128, 512);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 128, 44);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 468, 128, 44);
  g.save();
  g.translate(64, 256);
  g.rotate(Math.PI / 2);
  g.fillStyle = '#fffaf0';
  g.font = '600 46px "Noto Serif SC", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let fs = 46;
  while (g.measureText(text).width > 390 && fs > 20) { fs -= 2; g.font = `600 ${fs}px "Noto Serif SC", serif`; }
  g.fillText(text, 0, 0);
  g.restore();
  g.fillStyle = '#b8261c';
  g.beginPath(); g.arc(64, 470, 18, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeStoneLantern(U, project, accent, halo) {
  const stone = toon(0xb9b3a6);
  const stoneDark = toon(0x8d877b);
  const color = new THREE.Color(accent);
  const g = new THREE.Group();
  const add = (geo, mat, y, rotY = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.rotation.y = rotY; g.add(m); return m; };
  add(new THREE.CylinderGeometry(1.1, 1.3, 0.5, 6), stoneDark, 0.25);
  add(new THREE.CylinderGeometry(0.32, 0.4, 2.2, 8), stone, 1.6);
  add(new THREE.CylinderGeometry(0.95, 0.75, 0.4, 6), stone, 2.9);
  const box = add(new THREE.CylinderGeometry(0.62, 0.62, 1.1, 6), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(3.2) }), 3.65);
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), stone);
    const a = (i / 6) * Math.PI * 2;
    post.position.set(Math.cos(a) * 0.66, 3.65, Math.sin(a) * 0.66);
    g.add(post);
  }
  add(makeRoofGeometry(1.5, 0.8, 0.35, 6), stone, 4.55);
  add(new THREE.SphereGeometry(0.22, 12, 8), stone, 5.05);
  add(new THREE.ConeGeometry(0.16, 0.4, 8), stone, 5.35);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: halo, color: color.clone().multiplyScalar(1.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55,
  }));
  glow.position.y = 3.65;
  glow.scale.setScalar(6);
  g.add(glow);

  // nobori banner on a bamboo pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 9, 6), toon(0x8a7a4a));
  pole.position.set(2.0, 4.5, 0);
  g.add(pole);
  const bannerMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...U, map: { value: bannerTexture(project.name, accent) }, uPhase: { value: Math.random() * 6 } },
    vertexShader: /* glsl */ `
      uniform float uTime, uPhase; varying vec2 vUv; varying vec3 vWorld; varying float vShade;
      void main(){
        vUv = uv;
        vec3 p = position;
        float k = (1.0 - uv.x);
        float w = sin(uTime * 2.2 + uPhase + p.y * 0.9) * 0.22 * k + sin(uTime * 3.7 + p.y * 1.7) * 0.06 * k;
        p.z += w;
        vShade = 0.85 + w * 1.2;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 uSunColor, uAmbient, uFogColor, uSunDir, uFlash; uniform float uFogDensity, uNight;
      varying vec2 vUv; varying vec3 vWorld; varying float vShade;
      ${GLSL_FOG}
      void main(){
        vec3 c = texture2D(map, vUv).rgb;
        c = pow(c, vec3(2.2));
        vec3 col = c * (uSunColor * 0.8 + uAmbient + uFlash * 0.3) * vShade;
        gl_FragColor = vec4(applyFog(col, vWorld, uFogDensity), 1.0);
      }
    `,
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 4.6, 6, 12), bannerMat);
  banner.position.set(2.0 + 0.62, 6.0, 0);
  g.add(banner);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), toon(0x8a7a4a));
  bar.rotation.z = Math.PI / 2;
  bar.position.set(2.65, 8.35, 0);
  g.add(bar);

  const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 9, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(1, 4.5, 0);
  g.add(hit);

  return { group: g, hit, glow, light: box, color, labelY: 9.6 };
}

export { THREE };
