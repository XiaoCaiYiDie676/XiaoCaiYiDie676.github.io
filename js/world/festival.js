// Scene 2 — a night-time lantern festival on the lake beneath a snow mountain.
import {
  THREE, mulberry32, noise3, fbm2, smooth, sunDirFrom, GLSL_NOISE,
  makeUniforms, makeSky, makeTerrainMaterial, makeFoliageMaterial, toon, woodTexture,
  makePeakGeometry, makeRoofGeometry, makeCherryGeometries, makeWater, makeMist, makePetals, foliageCardTexture,
} from './common.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const shoreZ = (x) => -10 + 12 * Math.sin(x * 0.012) + 6 * Math.sin(x * 0.031 + 1);
const HILL = { x: -140, z: 78 };

export function festivalHeight(x, z) {
  const dz = z - shoreZ(x);
  const n = fbm2(x * 0.01, z * 0.01, 3);
  let h = dz < 0 ? Math.max(dz * 0.25, -5) : Math.min(dz * 0.09, 1.6) + (n - 0.5) * 0.6 * smooth(0, 10, dz);
  h += smooth(240, 420, dz) * 60 * (0.6 + n);
  h += 40 * Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / (2 * 46 * 46));
  h += 26 * Math.exp(-((x - 250) ** 2 + (z - 60) ** 2) / (2 * 60 * 60));
  return h;
}

// ─── the snow mountain ──────────────────────────────────────

function makeSnowMountain(U, R, H) {
  const RINGS = 110, SEG = 220;
  const pos = [], idx = [];
  for (let ri = 0; ri <= RINGS; ri++) {
    const u = ri / RINGS;
    for (let si = 0; si <= SEG; si++) {
      const a = (si / SEG) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const uu = Math.max(u, 0.035);
      // a rugged massif: steep, gullied flanks with secondary peaks on the shoulders
      let y = H * Math.pow(1 - uu, 1.3);
      const n = noise3(ca * 9, sa * 9, u * 6);
      const ridged = 1 - Math.abs(2 * n - 1);
      y -= H * 0.09 * ridged * smooth(0.02, 0.25, u) * (1 - u);
      const shoulder = Math.max(0, noise3(ca * 2.2, sa * 2.2, 7.1) - 0.45);
      y += H * 0.32 * shoulder * smooth(0.04, 0.25, u) * (1 - smooth(0.3, 0.7, u));
      y += H * 0.02 * (noise3(ca * 3, sa * 3, u * 3) - 0.5) * smooth(0.4, 1, u);
      const r = u * R * (1 + 0.04 * (noise3(ca * 2, sa * 2, 1.7) - 0.5));
      pos.push(ca * r, y, sa * r);
    }
  }
  for (let ri = 0; ri < RINGS; ri++) for (let si = 0; si < SEG; si++) {
    const a = ri * (SEG + 1) + si, b = a + SEG + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uH: { value: H } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal;
      void main(){
        vLocal = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSunColor, uFogColor, uAmbient, uFlash, uSkyHorizon;
      uniform float uFogDensity, uNight, uH;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal;
      ${GLSL_NOISE}
      void main(){
        vec3 n = normalize(vNormal);
        float h = vLocal.y / uH;
        vec2 dir = normalize(vLocal.xz + 1e-4);
        float streak = vnoise(dir * 42.0 + h * 1.5);
        float broad = vnoise(dir * 8.0 + 3.0);
        float snowLine = 0.5 + (streak - 0.5) * 0.4 + (broad - 0.5) * 0.18;
        float snow = smoothstep(snowLine - 0.015, snowLine + 0.015, h);
        float ndl = dot(n, uSunDir);
        float lit = smoothstep(-0.15, 0.35, ndl);
        vec3 rock = mix(vec3(0.16, 0.17, 0.27), vec3(0.24, 0.22, 0.34), streak);
        vec3 forest = vec3(0.07, 0.1, 0.14);
        vec3 base = mix(forest, rock, smoothstep(0.12, 0.3, h));
        vec3 snowLit = vec3(0.93, 0.95, 1.0);
        vec3 snowShade = vec3(0.42, 0.5, 0.78);
        vec3 sc = mix(snowShade, snowLit, lit);
        vec3 col = mix(base * (uSunColor * lit * 0.9 + uAmbient), sc * (uSunColor * 0.75 + uAmbient * 0.6), snow);
        col += uFlash * (0.08 + snow * 0.2);
        float dist = length(cameraPosition - vWorld);
        float f = 1.0 - exp(-pow(dist * uFogDensity, 1.3));
        f *= mix(1.0, 0.45, smoothstep(0.0, 1.0, h));
        col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

// ─── architecture ───────────────────────────────────────────

function makePagoda() {
  const g = new THREE.Group();
  const red = toon(0xc23a2a);
  const white = toon(0xf1eadc);
  const roofMat = toon(0x2f2c2e, { side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b04c, metalness: 0.85, roughness: 0.3, emissive: 0x3a2808 });
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.3, 0.5) });
  const base = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 12), toon(0x8f897e));
  base.position.y = 0.8;
  g.add(base);
  let y = 1.6;
  for (let k = 0; k < 5; k++) {
    const s = 1 - k * 0.11;
    const bw = 7.4 * s;
    const bh = k === 0 ? 3.8 : 2.6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), white);
    body.position.y = y + bh / 2;
    g.add(body);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, bh, 0.4), red);
      p.position.set((sx * bw) / 2, y + bh / 2, (sz * bw) / 2);
      g.add(p);
    }
    const band = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.2, 0.45, bw + 0.2), red);
    band.position.y = y + bh - 0.2;
    g.add(band);
    for (let f = 0; f < 4; f++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.32, bh * 0.45), windowMat);
      const a = (f / 4) * Math.PI * 2;
      w.position.set(Math.sin(a) * (bw / 2 + 0.02), y + bh * 0.45, Math.cos(a) * (bw / 2 + 0.02));
      w.rotation.y = a;
      g.add(w);
    }
    y += bh;
    const R = (bw / 2 + 2.3) * Math.SQRT2;
    const roof = new THREE.Mesh(makeRoofGeometry(R, 1.9, 1.0, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = y + 0.75;
    g.add(roof);
    y += 0.9;
  }
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 8, 8), gold);
  spire.position.y = y + 4;
  g.add(spire);
  for (let i = 0; i < 9; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.55 - i * 0.025, 0.07, 6, 16), gold);
    r.rotation.x = Math.PI / 2;
    r.position.y = y + 1.4 + i * 0.6;
    g.add(r);
  }
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), gold);
  jewel.position.y = y + 8.2;
  g.add(jewel);
  return g;
}

function stallBannerTexture(color, mark, title) {
  const c = document.createElement('canvas');
  c.width = title ? 1024 : 256; c.height = title ? 208 : 128;
  const W = c.width, H = c.height;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (const x of [W / 3, (2 * W) / 3]) g.fillRect(x - 1, 0, 2, H);
  g.fillStyle = '#fff6e8';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (title) {
    g.font = '800 120px "Noto Serif SC", serif';
    g.globalAlpha = 0.22;
    g.fillText(mark, W - 90, H / 2 + 6);
    g.globalAlpha = 1;
    let fs = 78;
    g.font = `700 ${fs}px "Cormorant Garamond", serif`;
    while (g.measureText(title).width > W - 120 && fs > 34) { fs -= 2; g.font = `700 ${fs}px "Cormorant Garamond", serif`; }
    g.fillText(title, W / 2, H / 2 + 4);
  } else {
    g.font = '700 56px "Noto Serif SC", serif';
    g.fillText(mark, W / 2, H / 2 + 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeStall(rng, color, mark, title) {
  const g = new THREE.Group();
  const wood = toon(0xffffff, { map: woodTexture('#7d5a3c', '#4a3322', 4) });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.6), wood);
  counter.position.set(0, 0.55, 0.4);
  g.add(counter);
  for (const x of [-2, 2]) for (const z of [-0.8, 1.1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.9, 0.14), wood);
    p.position.set(x, 1.45, z);
    g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.14, 2.8), toon(0x6b4a35));
  roof.position.set(0, 3.0, 0.2);
  roof.rotation.x = -0.16;
  g.add(roof);
  const stallBanner = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.85), title
    ? new THREE.MeshBasicMaterial({ map: stallBannerTexture(color, mark, title), color: new THREE.Color(0.8, 0.78, 0.75), side: THREE.DoubleSide })
    : toon(0xffffff, { map: stallBannerTexture(color, mark, title), side: THREE.DoubleSide }));
  stallBanner.position.set(0, 2.45, 1.16);
  g.add(stallBanner);
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.6) });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), glowMat);
  bulb.scale.y = 1.3;
  bulb.position.set(1.7, 2.0, 1.2);
  g.add(bulb);
  // goods on the counter
  const goodsColors = [0xd9342b, 0xf2c14e, 0x5fb3d9, 0xf4a6c0, 0xffffff];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.18 + rng() * 0.1, 10, 8), toon(goodsColors[Math.floor(rng() * goodsColors.length)]));
    m.position.set(-1.6 + i * 0.62, 1.25, 0.5 + (rng() - 0.5) * 0.4);
    g.add(m);
  }
  g.userData.bulb = bulb;
  return g;
}

// ─── festival-goers & boats ────────────────────────────────

function robeGeometry() {
  // lathed silhouette (hem flare, waist, shoulders) plus hanging sleeves
  const prof = [[0.0, 0.0], [0.3, 0.0], [0.33, 0.06], [0.29, 0.45], [0.24, 0.85], [0.25, 1.05], [0.27, 1.2], [0.2, 1.3], [0.08, 1.36], [0.0, 1.37]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(prof, 22);
  const sleeves = [-1, 1].map((sd) => {
    const s = new THREE.CapsuleGeometry(0.1, 0.42, 4, 10);
    s.scale(1, 1, 1.5);
    s.rotateZ(sd * 0.22);
    s.translate(sd * 0.3, 1.0, 0.02);
    return s.toNonIndexed();
  });
  const geo = mergeGeometries([body.toNonIndexed(), ...sleeves].map((g) => { g.deleteAttribute('uv'); return g; }));
  geo.computeVertexNormals();
  return geo;
}

const ROBE_COLORS = [0x2b3f7a, 0xf2ece0, 0xd9708f, 0xb8322a, 0x5a3a7a, 0x2d6a6a, 0xe8b04a, 0x1f2a44, 0xf4b8c8, 0x3a5fa8];

function makeCrowd(rng, spots) {
  const parts = [
    [robeGeometry(), toon(0xffffff)],
    [new THREE.CylinderGeometry(0.205, 0.22, 0.17, 20).translate(0, 0.88, 0), toon(0xffffff)],
    [new THREE.SphereGeometry(0.16, 20, 14).translate(0, 1.5, 0), toon(0xf0c9a5)],
    [mergeGeometries([
      new THREE.SphereGeometry(0.172, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.58).translate(0, 1.52, 0).toNonIndexed(),
      new THREE.SphereGeometry(0.09, 12, 8).translate(0, 1.66, -0.1).toNonIndexed(),
    ]), toon(0x1b1618)],
  ];
  const meshes = parts.map(([g, m]) => new THREE.InstancedMesh(g, m, spots.length));
  const c = new THREE.Color();
  spots.forEach((sp, i) => {
    meshes[0].setColorAt(i, c.setHex(ROBE_COLORS[Math.floor(rng() * ROBE_COLORS.length)]));
    meshes[1].setColorAt(i, c.setHex([0xf2c14e, 0xb8322a, 0xf2ece0, 0x2b3f7a][Math.floor(rng() * 4)]));
    sp.ph = rng() * 6.28;
    sp.s = 0.9 + rng() * 0.2;
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  function update(t) {
    spots.forEach((sp, i) => {
      e.set(Math.sin(t * 1.3 + sp.ph) * 0.05, sp.rot + Math.sin(t * 0.4 + sp.ph) * 0.3, Math.cos(t * 1.1 + sp.ph) * 0.04);
      q.setFromEuler(e);
      m4.compose(v.set(sp.x, sp.y + Math.abs(Math.sin(t * 2 + sp.ph)) * 0.03, sp.z), q, sc.setScalar(sp.s));
      for (const m of meshes) m.setMatrixAt(i, m4);
    });
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { meshes, update };
}

function makeYakatabune(rng) {
  const g = new THREE.Group();
  const wood = toon(0xffffff, { map: woodTexture('#5a3a26', '#2e1e14', 5) });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 0.9, 2.8), wood);
  hull.position.y = 0.15;
  const bow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), wood);
  bow.position.set(-5.0, 0.55, 0);
  bow.rotation.z = -0.35;
  const shoji = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.45, 2.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.55, 0.7) }));
  shoji.position.y = 1.32;
  g.add(hull, bow, shoji);
  const frame = toon(0x2a1c14);
  for (let k = 0; k <= 8; k++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 2.34), frame);
    f.position.set(-3.2 + k * 0.8, 1.32, 0);
    g.add(f);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.24, 3.0), toon(0x2f2a28));
  roof.position.y = 2.18;
  g.add(roof);
  for (let k = 0; k < 7; k++) for (const zz of [-1.55, 1.55]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: k % 2 ? new THREE.Color(3.2, 2.6, 2.0) : new THREE.Color(3.0, 0.55, 0.3) }));
    l.scale.y = 1.3;
    l.position.set(-3.3 + k * 1.1, 1.85, zz);
    g.add(l);
  }
  return g;
}

function makeRowboat(rng) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.2), toon(0x6a4630));
  hull.position.y = 0.1;
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 8), toon(ROBE_COLORS[Math.floor(rng() * ROBE_COLORS.length)]));
  body.position.set(0.4, 0.8, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), toon(0xf0c9a5));
  head.position.set(0.4, 1.35, 0);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.7, 0.6) }));
  lantern.scale.y = 1.3;
  lantern.position.set(-1.3, 1.1, 0);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), toon(0x3a2a20));
  pole.position.set(-1.3, 0.55, 0);
  g.add(hull, body, head, lantern, pole);
  return g;
}

// paifang archway at the entrance to the works street
function makeFestivalPaifang() {
  const g = new THREE.Group();
  const red = toon(0xd23b26);
  const black = toon(0x1d1a1a);
  for (const x of [-4.5, 4.5]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 11, 14), red);
    p.position.set(x, 5.5, 0);
    g.add(p);
  }
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.55, 0.5), red);
  nuki.position.y = 8.6;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.7, 0.8), red);
  lintel.position.y = 10.8;
  const roofGeo = new THREE.BoxGeometry(15, 1.4, 2.8, 24, 1, 1);
  const rp = roofGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    if (rp.getY(i) > 0) rp.setZ(i, rp.getZ(i) * 0.18);
    rp.setY(i, rp.getY(i) + Math.pow(Math.abs(rp.getX(i) / 7.5), 3) * 1.2);
  }
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, toon(0x34403c));
  roof.position.y = 11.9;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.4, 0.5), black);
  ridge.position.y = 12.7;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 0.3), toon(0xd8b04a));
  frame.position.y = 9.7;
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.15, 0.38), toon(0x20335e));
  plaque.position.y = 9.7;
  g.add(nuki, lintel, roof, ridge, frame, plaque);
  return g;
}

// ─── fireworks ──────────────────────────────────────────────

const PALETTE = ['#ffcf6b', '#ff5a3c', '#ff9fc6', '#b48cff', '#6dffc0', '#7fc8ff', '#fff4e0', '#ff8a3d'];
const TYPES = {
  kiku:    { n: 170, speed: 120, drag: 1.25, grav: 0.5, life: 2.6, delay: 0.035, size: 3.0, glitter: 0 },
  botan:   { n: 150, speed: 112, drag: 1.6,  grav: 0.4, life: 2.0, delay: 0.0,  size: 4.6, glitter: 0 },
  shidare: { n: 130, speed: 92,  drag: 0.9,  grav: 1.3, life: 5.2, delay: 0.09, size: 2.4, glitter: 1, gold: true },
  ring:    { n: 120, speed: 120, drag: 1.3,  grav: 0.4, life: 2.3, delay: 0.03, size: 3.2, glitter: 0, ring: true },
  kamuro:  { n: 170, speed: 100, drag: 1.0,  grav: 0.9, life: 3.8, delay: 0.06, size: 2.6, glitter: 1, gold: true },
};
const TYPE_KEYS = ['kiku', 'botan', 'shidare', 'ring', 'kamuro', 'double'];

function makeFireworks(U, renderScale) {
  const SLOTS = 7;
  const MAXP = 8000;
  const N = MAXP * SLOTS;
  const geo = new THREE.BufferGeometry();
  const A = {
    position: new THREE.BufferAttribute(new Float32Array(N * 3), 3),
    aVel: new THREE.BufferAttribute(new Float32Array(N * 3), 3),
    aBirth: new THREE.BufferAttribute(new Float32Array(N).fill(-1000), 1),
    aLife: new THREE.BufferAttribute(new Float32Array(N), 1),
    aColor: new THREE.BufferAttribute(new Float32Array(N * 3), 3),
    aParam: new THREE.BufferAttribute(new Float32Array(N * 4), 4),
    aSize: new THREE.BufferAttribute(new Float32Array(N * 2), 2),
  };
  for (const [k, v] of Object.entries(A)) { v.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, v); }
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.uTime, uPR: { value: renderScale }, uScale: { value: 2200 } },
    vertexShader: /* glsl */ `
      attribute vec3 aVel; attribute float aBirth; attribute float aLife; attribute vec3 aColor;
      attribute vec4 aParam; attribute vec2 aSize;
      uniform float uTime, uPR, uScale;
      varying vec3 vColor; varying float vFade;
      float h11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
      void main(){
        float slot = aParam.z;
        float t = uTime - aBirth - slot * aParam.w;
        if (t < 0.0 || t > aLife) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vFade = 0.0; return; }
        float k = max(aParam.x, 1e-3);
        vec3 p = position + aVel * (1.0 - exp(-k * t)) / k;
        p.y -= 4.9 * aParam.y * t * t;
        float lk = t / aLife;
        float fade = pow(1.0 - lk, 1.4) * (1.0 - slot / 7.0) * smoothstep(0.0, 0.1, t);
        if (aSize.y > 0.5) fade *= step(0.35, h11(float(gl_VertexID) * 0.37 + floor(uTime * 22.0))) * 1.4;
        vec3 hot = vec3(1.0, 0.95, 0.82);
        vColor = mix(hot, aColor, smoothstep(0.0, 0.25, t)) * mix(1.0, 0.6, slot / 7.0);
        vFade = fade;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize.x * (1.0 - slot * 0.1) * uPR * (uScale / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vFade;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.22, 0.0, d);
        float halo = pow(smoothstep(0.5, 0.0, d), 3.0);
        gl_FragColor = vec4(vColor * (core * 2.4 + halo * 0.8) * vFade, 1.0);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  let cursor = 0;
  const pending = [];
  const tmp = new THREE.Vector3();

  function write(p, v, life, color, drag, grav, delay, size, glitter) {
    const now = U.uTime.value;
    for (let s = 0; s < SLOTS; s++) {
      const i = cursor;
      cursor = (cursor + 1) % N;
      A.position.setXYZ(i, p.x, p.y, p.z);
      A.aVel.setXYZ(i, v.x, v.y, v.z);
      A.aBirth.setX(i, now);
      A.aLife.setX(i, delay === 0 && s > 0 ? 0 : life);
      A.aColor.setXYZ(i, color.r, color.g, color.b);
      A.aParam.setXYZW(i, drag, grav, s, delay);
      A.aSize.setXY(i, size, glitter);
    }
  }
  const dirty = () => { for (const v of Object.values(A)) v.needsUpdate = true; };

  function randDir(out) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    return out.set(r * Math.cos(th), u, r * Math.sin(th));
  }

  function burst(pos, typeName, c1, c2) {
    if (typeName === 'double') {
      burst(pos, 'kiku', c1);
      const inner = { ...TYPES.botan, speed: 60, n: 90 };
      spawnType(pos, inner, c2 || c1);
      return;
    }
    spawnType(pos, TYPES[typeName], c1);
  }
  function spawnType(pos, T, color) {
    const col = T.gold ? new THREE.Color(1.0, 0.72, 0.32) : color;
    const axis = randDir(new THREE.Vector3());
    const basisA = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0.3)).normalize();
    const basisB = new THREE.Vector3().crossVectors(axis, basisA);
    for (let i = 0; i < T.n; i++) {
      if (T.ring) {
        const a = (i / T.n) * Math.PI * 2;
        tmp.copy(basisA).multiplyScalar(Math.cos(a)).addScaledVector(basisB, Math.sin(a));
      } else randDir(tmp);
      tmp.multiplyScalar(T.speed * (0.92 + Math.random() * 0.16));
      write(pos, tmp, T.life * (0.85 + Math.random() * 0.3), col, T.drag, T.grav, T.delay, T.size, T.glitter);
    }
  }

  function launch(x, z, height, typeName, c1, c2) {
    const g = 9.8 * 4;
    const v = Math.sqrt(2 * g * height);
    const tFlight = v / g;
    const start = new THREE.Vector3(x, 0, z);
    write(start, new THREE.Vector3((Math.random() - 0.5) * 3, v, 0), tFlight, new THREE.Color(1, 0.7, 0.4), 0, 4, 0.02, 2.0, 1);
    pending.push({ at: U.uTime.value + tFlight, pos: new THREE.Vector3(x, height, z), type: typeName, c1, c2 });
    dirty();
  }

  function update(onBurst) {
    const now = U.uTime.value;
    let any = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (now >= p.at) {
        burst(p.pos, p.type, p.c1, p.c2);
        pending.splice(i, 1);
        any = true;
        onBurst?.(p);
      }
    }
    if (any) dirty();
  }

  return { points, launch, update, material: mat };
}

// ─── scene ──────────────────────────────────────────────────

export function buildFestival({ projects, accents, halo, renderScale }) {
  const U = makeUniforms();
  const scene = new THREE.Scene();
  const rng = mulberry32(1707);
  U.uSkyTop.value.set('#050a1e');
  U.uSkyMid.value.set('#121a44');
  U.uSkyHorizon.value.set('#3a2d5c');
  U.uSunColor.value.set('#4e5c8e');
  U.uFogColor.value.set('#211f4a');
  U.uAmbient.value.set('#262650');
  U.uWaterColor.value.set('#0a1a2e');
  U.uNight.value = 1;
  U.uSunSize.value = 0.99955;
  U.uFogDensity.value = 0.00042;
  sunDirFrom(0.42, -0.38, U.uSunDir.value);
  scene.fog = new THREE.FogExp2(0x211f4a, 0.0009);

  const moon = new THREE.DirectionalLight(0x8a9cdd, 0.45);
  moon.position.copy(U.uSunDir.value).multiplyScalar(400);
  const hemi = new THREE.HemisphereLight(0x3a3a7a, 0x1a1020, 0.6);
  scene.add(moon, hemi, makeSky(U));

  const flashLight = new THREE.PointLight(0xffffff, 0, 0, 0);
  scene.add(flashLight);
  const streetLights = [];
  for (const [x, z] of [[10, 46], [80, 46], [150, 46], [20, 70], [80, 70], [140, 70]]) {
    const l = new THREE.PointLight(0xffa24a, 90, 70, 2);
    l.position.set(x, 6, z);
    scene.add(l);
    streetLights.push(l);
  }

  // terrain
  {
    const geo = new THREE.PlaneGeometry(1800, 820, 480, 220);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 250);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, festivalHeight(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, makeTerrainMaterial(U, { blossoms: 0.12, palette: 'night' })));
  }
  // far shore hills
  const farMat = makeTerrainMaterial(U, { blossoms: 0, palette: 'night' });
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (200 + rng() * 1100);
    const z = -650 - rng() * 700;
    const h = 50 + rng() * 120;
    const m = new THREE.Mesh(makePeakGeometry(h, h * 2.2, rng() * 50, rng, 0.5), farMat);
    m.position.set(x, -6, z);
    scene.add(m);
  }
  const mountain = makeSnowMountain(U, 1500, 470);
  mountain.position.set(90, -14, -1750);
  scene.add(mountain);
  // lower peaks either side turn the lone cone into a snowy range
  for (const [x, z, R, H] of [[-560, -1640, 900, 330], [700, -1580, 1000, 370]]) {
    const peak = makeSnowMountain(U, R, H);
    peak.position.set(x, -14, z);
    peak.rotation.y = x * 0.01;
    scene.add(peak);
  }

  const water = makeWater(U, { size: [6000, 5000], center: [0, -1500], river: false, calm: 0.45, petals: 0.35, renderScale });
  water.uniforms.uRippleColor.value.set(1.0, 0.7, 0.4);
  scene.add(water.mesh);

  // pagoda on the hill
  {
    const pg = makePagoda();
    pg.position.set(HILL.x, festivalHeight(HILL.x, HILL.z) - 0.6, HILL.z);
    pg.rotation.y = 0.5;
    scene.add(pg);
  }
  // festival street
  const stallColors = [['#20335e', '灯'], ['#a8322a', '福'], ['#2d5a4a', '茶'], ['#5a2d5e', '糖'], ['#a8322a', '春'], ['#20335e', '面'], ['#7a4a1e', '酒'], ['#2d5a4a', '花']];
  for (let i = 0; i < 7; i++) {
    const [color, mark] = stallColors[i % stallColors.length];
    const x = 2 + i * 27, z = 32;
    const s = makeStall(rng, color, mark);
    s.position.set(x, festivalHeight(x, z) - 0.1, z);
    scene.add(s);
  }
  // "Works street": every stall in the back row shows one of my projects on its banner
  const STALL_X0 = -12, STALL_DX = 20;
  const markers = projects.map((proj, i) => {
    const accent = accents[proj.accent]?.color || '#c8372d';
    const mark = (accents[proj.accent]?.name || '作')[0];
    const x = STALL_X0 + i * STALL_DX, z = 60;
    const st = makeStall(rng, new THREE.Color(accent).multiplyScalar(0.62).getStyle(), mark, proj.name);
    st.scale.setScalar(1.25);
    st.position.set(x, festivalHeight(x, z) - 0.1, z);
    scene.add(st);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(5, 3.6, 3), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.8;
    st.add(hit);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: halo, color: new THREE.Color(accent).multiplyScalar(0.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35,
    }));
    glow.position.set(0, 3.6, 0.4);
    glow.scale.setScalar(5);
    st.add(glow);
    return {
      id: proj.id, kind: 'project', project: proj, label: proj.name, accent,
      group: st, hit, glow, light: st.userData.bulb, color: new THREE.Color(accent), labelY: 5.6, labelMax: 150,
      view: (p) => ({ pos: p.clone().add(new THREE.Vector3(0, 4.5, 15)), target: p.clone().add(new THREE.Vector3(0, 2.2, 0)) }),
    };
  });
  {
    const t = makeFestivalPaifang();
    const x = -24, z = 47;
    t.position.set(x, festivalHeight(x, z) - 0.2, z);
    t.rotation.y = Math.PI / 2;
    scene.add(t);
  }
  // strings of red lanterns
  {
    const spots = [];
    const poleMat = toon(0x3a2a20);
    for (const z of [40, 54]) {
      const xs = [];
      for (let x = -14; x <= 186; x += 25) xs.push(x);
      xs.forEach((x) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 7, 6), poleMat);
        pole.position.set(x, festivalHeight(x, z) + 3.5, z);
        scene.add(pole);
      });
      for (let k = 0; k < xs.length - 1; k++) {
        for (let j = 1; j < 8; j++) {
          const u = j / 8;
          const x = xs[k] + (xs[k + 1] - xs[k]) * u;
          const y = festivalHeight(x, z) + 6.6 - Math.sin(u * Math.PI) * 1.4;
          spots.push([x, y, z]);
        }
      }
    }
    const geo = new THREE.SphereGeometry(0.34, 12, 10);
    geo.scale(1, 1.35, 1);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), spots.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    const cols = [[3.0, 0.5, 0.25], [3.2, 2.6, 2.0], [3.0, 1.6, 0.4]];
    spots.forEach(([x, y, z], i) => {
      m4.makeTranslation(x, y, z);
      mesh.setMatrixAt(i, m4);
      const cc = cols[i % 3];
      mesh.setColorAt(i, c.setRGB(cc[0], cc[1], cc[2]));
    });
    scene.add(mesh);
  }
  // cherry trees on the hill and along the shore
  {
    const { wood, canopy } = makeCherryGeometries(rng);
    const spots = [];
    for (let i = 0; i < 3000 && spots.length < 260; i++) {
      const x = -420 + rng() * 860;
      const z = -10 + rng() * 260;
      if (x > -30 && x < 195 && z > 22 && z < 72) continue; // keep the street open
      if ((x - HILL.x) ** 2 + (z - HILL.z) ** 2 < 15 ** 2) continue; // pagoda footprint
      if (x > 0 && x < 90 && z > 150) continue; // camera foreground
      const y = festivalHeight(x, z);
      if (y < 0.6) continue;
      spots.push([x, y - 0.2, z, 0.9 + rng() * 0.8]);
    }
    const woodMesh = new THREE.InstancedMesh(wood, toon(0x2e2024), spots.length);
    const mat = makeFoliageMaterial(U, { shadow: '#5a3a6a', mid: '#d58fb0', high: '#ffd8e6', trans: '#ff8fb0', wind: 0.06, dabs: 0.35, map: foliageCardTexture('blossom') });
    const canopyMesh = new THREE.InstancedMesh(canopy, mat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3(), c = new THREE.Color();
    spots.forEach(([x, y, z, sc], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6.28);
      m4.compose(pv.set(x, y, z), q, s.set(sc, sc, sc));
      woodMesh.setMatrixAt(i, m4);
      canopyMesh.setMatrixAt(i, m4);
      // trees near the street catch warm lantern light
      const warm = smooth(70, 10, Math.abs(z - 47)) * smooth(-60, 0, x) * smooth(250, 190, x);
      canopyMesh.setColorAt(i, c.setRGB(1 + warm * 0.9, 1 + warm * 0.35, 1 + warm * 0.1));
    });
    scene.add(woodMesh, canopyMesh);
  }
  // river lanterns drifting on the lake
  const FLOAT = 150;
  const floatGeo = new THREE.BoxGeometry(0.9, 1.0, 0.9).translate(0, 0.5, 0);
  const floatMesh = new THREE.InstancedMesh(floatGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), FLOAT);
  const floatData = [];
  {
    const c = new THREE.Color();
    for (let i = 0; i < FLOAT; i++) {
      const x = -260 + rng() * 560;
      floatData.push({ x, z: shoreZ(x) - 10 - Math.pow(rng(), 1.5) * 320, ph: rng() * 6.28, sp: 0.2 + rng() * 0.4 });
      floatMesh.setColorAt(i, c.setRGB(3.0, 1.5 + rng() * 0.5, 0.5 + rng() * 0.2));
    }
  }
  floatMesh.frustumCulled = false;
  scene.add(floatMesh);

  // festival-goers: browsing the works stalls, strolling the street, watching from the shore
  const crowdSpots = [];
  const addPerson = (x, z, rot) => crowdSpots.push({ x, z, y: festivalHeight(x, z), rot });
  projects.forEach((_, i) => {
    const sx = STALL_X0 + i * STALL_DX;
    const n = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) addPerson(sx + (rng() - 0.5) * 5, 63.5 + rng() * 3.5, Math.PI + (rng() - 0.5) * 0.8);
  });
  for (let k = 0; k < 70; k++) addPerson(-18 + rng() * 200, 37 + rng() * 18, rng() * 6.28);
  for (let k = 0; k < 60; k++) {
    const x = -70 + rng() * 300;
    addPerson(x, shoreZ(x) + 3 + rng() * 9, Math.PI + (rng() - 0.5) * 0.6);
  }
  const crowd = makeCrowd(rng, crowdSpots);
  crowd.meshes.forEach((m) => scene.add(m));

  // painted pleasure boats and small lantern boats drifting on the lake
  const boats = [];
  for (let i = 0; i < 6; i++) {
    const b = makeYakatabune(rng);
    scene.add(b);
    boats.push({ obj: b, cx: -160 + i * 75 + rng() * 20, cz: -90 - rng() * 150, r: 25 + rng() * 35, w: (0.012 + rng() * 0.01) * (i % 2 ? 1 : -1), ph: rng() * 6.28 });
  }
  for (let i = 0; i < 9; i++) {
    const b = makeRowboat(rng);
    scene.add(b);
    boats.push({ obj: b, cx: -120 + rng() * 300, cz: -30 - rng() * 90, r: 8 + rng() * 14, w: (0.03 + rng() * 0.03) * (i % 2 ? 1 : -1), ph: rng() * 6.28 });
  }

  // camera shots + guide markers that point people to the interesting places
  const SHOTS = {
    overview: { pos: [40, 22, 215], target: [20, 30, -150] },
    street: { pos: [70, 7.5, 86], target: [70, 3, 60] },
    lake: { pos: [42, 5, -18], target: [40, 9, -200] },
    pagoda: { pos: [-94, 54, 142], target: [-140, 58, 78] },
    mountain: { pos: [-70, 48, -250], target: [90, 230, -1750] },
  };
  const shot = (name) => ({ pos: new THREE.Vector3(...SHOTS[name].pos), target: new THREE.Vector3(...SHOTS[name].target) });
  const guide = (id, shotName, label, jp, at, labelY, labelMin) => {
    const g = new THREE.Object3D();
    g.position.set(...at);
    scene.add(g);
    return { id, kind: 'shot', shot: shotName, label, jp, accent: '#f2c14e', group: g, hit: null, labelY, labelMin, view: () => shot(shotName) };
  };
  markers.push(
    guide('shot-street', 'street', 'Works street · my projects', '作', [78, festivalHeight(78, 60), 60], 12, 150),
    guide('shot-lake', 'lake', 'Lantern lake', '灯', [40, 0, -120], 8, 90),
    guide('shot-pagoda', 'pagoda', 'Pagoda hill', '塔', [HILL.x, festivalHeight(HILL.x, HILL.z), HILL.z], 36, 90),
    guide('shot-mountain', 'mountain', 'Snow mountain', '雪', [90, 470, -1750], 40, 400),
  );

  const mist = makeMist(U, [3, 9], { amount: 0.22, scale: 0.008 });
  mist.meshes.forEach((m) => scene.add(m));
  const petals = makePetals(U, 500, rng, { radius: 60, height: 40, renderScale });
  petals.material.uniforms.uWindX.value = 0.6;
  scene.add(petals);

  const fireworks = makeFireworks(U, renderScale);
  scene.add(fireworks.points);

  const homeView = () => shot('overview');

  let autoShow = true;
  let nextShot = 1.0;
  const m4 = new THREE.Matrix4();
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function randomShell(x, z, h, type) {
    const c1 = new THREE.Color(pick(PALETTE));
    const c2 = new THREE.Color(pick(PALETTE));
    fireworks.launch(
      x ?? -260 + Math.random() * 560,
      z ?? -380 - Math.random() * 260,
      h ?? 150 + Math.random() * 140,
      type ?? pick(TYPE_KEYS),
      c1, c2,
    );
  }

  function update(dt, t, { onBurst, camera }) {
    U.uTime.value = t;
    U.uFlash.value.multiplyScalar(Math.exp(-dt * 2.6));
    flashLight.intensity *= Math.exp(-dt * 3.0);

    if (autoShow) {
      nextShot -= dt;
      if (nextShot <= 0) {
        const salvo = Math.random() < 0.18 ? 3 + Math.floor(Math.random() * 3) : 1;
        for (let i = 0; i < salvo; i++) setTimeout(() => randomShell(), i * 160);
        nextShot = 0.8 + Math.random() * 2.0;
      }
    }
    fireworks.update((p) => {
      const c = p.type === 'shidare' || p.type === 'kamuro' ? new THREE.Color(1, 0.72, 0.32) : p.c1;
      U.uFlash.value.add(c.clone().multiplyScalar(0.18));
      const fl = Math.max(U.uFlash.value.r, U.uFlash.value.g, U.uFlash.value.b);
      if (fl > 0.5) U.uFlash.value.multiplyScalar(0.5 / fl);
      flashLight.position.copy(p.pos);
      flashLight.color.copy(c);
      flashLight.intensity = Math.min(flashLight.intensity + 3, 5);
      onBurst?.(p, camera ? camera.position.distanceTo(p.pos) : 600);
    });

    floatData.forEach((f, i) => {
      const x = f.x + Math.sin(t * 0.1 * f.sp + f.ph) * 4;
      const z = f.z - ((t * f.sp) % 60);
      m4.makeRotationY(t * 0.05 + f.ph);
      m4.setPosition(x, Math.sin(t * 1.2 + f.ph) * 0.06, z);
      floatMesh.setMatrixAt(i, m4);
    });
    floatMesh.instanceMatrix.needsUpdate = true;

    streetLights.forEach((l, i) => (l.intensity = 80 + Math.sin(t * 7 + i * 2) * 6));
    markers.forEach((m, i) => {
      if (m.light) m.light.material.color.copy(m.color).multiplyScalar(2.6 + Math.sin(t * 2 + i) * 0.4);
    });
    crowd.update(t);
    for (const b of boats) {
      const a = b.ph + t * b.w;
      b.obj.position.set(b.cx + Math.cos(a) * b.r, Math.sin(t * 1.3 + b.ph) * 0.06, b.cz + Math.sin(a) * b.r);
      b.obj.rotation.y = -a + (b.w > 0 ? -Math.PI / 2 : Math.PI / 2);
      b.obj.rotation.z = Math.sin(t * 1.1 + b.ph) * 0.02;
    }
    if (camera) petals.material.uniforms.uCenter.value.copy(camera.position).add(new THREE.Vector3(0, -6, -25));
  }

  // click in the sky → launch a shell toward that point
  function launchAtRay(ray) {
    const planeZ = -460;
    if (ray.direction.z >= -1e-3) return false;
    const t = (planeZ - ray.origin.z) / ray.direction.z;
    const p = ray.origin.clone().addScaledVector(ray.direction, t);
    if (p.y < 40) return false;
    randomShell(THREE.MathUtils.clamp(p.x, -500, 500), planeZ, THREE.MathUtils.clamp(p.y, 90, 320));
    return true;
  }

  function finale() {
    for (let i = 0; i < 28; i++) setTimeout(() => randomShell(undefined, undefined, undefined, i % 4 === 0 ? 'shidare' : undefined), i * 140 + Math.random() * 120);
  }

  return {
    scene, U, water, markers, homeView, shot, shots: Object.keys(SHOTS), update, launchAtRay, finale,
    setAutoShow(on) { autoShow = on; },
    layers: { petals: [petals], mist: mist.meshes },
    resize(w, h, rs, refl) { water.resize(w, h, rs, refl); petals.material.uniforms.uPR.value = rs; fireworks.material.uniforms.uPR.value = rs; },
  };
}
