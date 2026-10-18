// Scene 1 — a wooden riverboat poled upstream through a cherry-blossom valley.
import {
  THREE, mulberry32, noise3, fbm2, smooth, sunDirFrom,
  makeUniforms, makeSky, makeTerrainMaterial, makeFoliageMaterial, toon, woodTexture,
  makePeakGeometry, makeRoofGeometry, makeCherryGeometries, makeCedarGeometry, foliageCardTexture,
  makeWater, makeMist, makePetals, makeStoneLantern,
} from './common.js';

export const riverX = (z) => 28 * Math.sin(z * 0.0055) + 12 * Math.sin(z * 0.017 + 1.3);
export const riverW = (z) => 22 + 6 * Math.sin(z * 0.009 + 0.5);

export function valleyHeight(x, z) {
  const d = Math.abs(x - riverX(z)) - riverW(z);
  const n = fbm2(x * 0.004, z * 0.004, 4);
  const n2 = fbm2(x * 0.02 + 7, z * 0.02, 3);
  if (d < 0) return -0.6 - 3.5 * smooth(0, 12, -d) + (n2 - 0.5) * 0.8;
  let h = d * 0.09;
  h += 24 * smooth(18, 75, d) * (0.6 + 0.8 * n);
  h += 170 * Math.pow(smooth(55, 380, d), 1.4) * (0.45 + n);
  h += (n2 - 0.5) * 4 * smooth(2, 20, d);
  h -= 0.7 * (1 - smooth(0, 4, d));
  return h;
}

export const VALLEY_TOD = {
  morning: {
    elev: 0.3, azim: -0.5,
    top: '#6aa4e2', mid: '#c4d9ec', horizon: '#f1e2d6', sun: '#fff0da', fog: '#c6d4e0',
    ambient: '#7a8ba2', sunI: 2.4, hemi: 1.0, lantern: 1.4, water: '#2a7668',
  },
  afternoon: {
    elev: 0.3, azim: 0.75,
    top: '#4f86d0', mid: '#e4bfae', horizon: '#ffd7ae', sun: '#ffd49c', fog: '#d9c0b2',
    ambient: '#6e6a82', sunI: 2.6, hemi: 0.9, lantern: 1.8, water: '#1f6a5c',
  },
  dusk: {
    elev: 0.045, azim: 0.12,
    top: '#2f3c78', mid: '#d68a8e', horizon: '#ffb27a', sun: '#ff9550', fog: '#d39d8e',
    ambient: '#5a4a6c', sunI: 2.0, hemi: 0.7, lantern: 4.0, water: '#164a4a',
  },
};

const BOAT_START = 110;
const BOAT_END = -1020;

// ─── boat ───────────────────────────────────────────────────

function strawTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c4a165'; g.fillRect(0, 0, 256, 256);
  const rng = mulberry32(7);
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = `rgba(${90 + rng() * 60},${70 + rng() * 40},${30 + rng() * 20},${0.15 + rng() * 0.25})`;
    g.lineWidth = 1 + rng();
    const x = rng() * 256;
    g.beginPath(); g.moveTo(x, rng() * 256); g.lineTo(x + (rng() - 0.5) * 6, rng() * 256); g.stroke();
  }
  g.fillStyle = 'rgba(70,50,25,0.35)';
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 256, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function parasolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c3352b'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(60,10,10,0.45)'; g.lineWidth = 2;
  for (let i = 0; i < 24; i++) { const x = (i / 24) * 256; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.fillStyle = 'rgba(255,240,230,0.85)'; g.fillRect(0, 200, 256, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function setLimb(mesh, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
}

function makeBoat(U) {
  const boat = new THREE.Group();
  boat.rotation.order = 'YXZ';
  const L = 13, N = 32;
  const wood = toon(0xffffff, { map: woodTexture('#8a5c3a', '#4a2e1c', 7), side: THREE.DoubleSide });
  const darkWood = toon(0x4b3122);
  const station = (s) => {
    const bowT = smooth(0.6, 1, s), sternT = smooth(0.15, 0, s);
    const w = 1.35 * (1 - 0.8 * Math.pow(bowT, 1.4) - 0.28 * sternT);
    const lift = 1.5 * bowT * bowT + 0.3 * sternT;
    return { w, bottom: lift * 0.92, top: 0.95 + lift, z: L / 2 - s * L };
  };

  // hull loft
  const pos = [], uv = [], idx = [];
  const leftTop = [], rightTop = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const { w, bottom, top, z } = station(s);
    const P = [[-w, top], [-w * 0.97, top * 0.55 + bottom * 0.45], [-w * 0.82, bottom + 0.05], [0, bottom], [w * 0.82, bottom + 0.05], [w * 0.97, top * 0.55 + bottom * 0.45], [w, top]];
    P.forEach(([x, y], k) => { pos.push(x, y, z); uv.push(s * 2.5, k / 6); });
    leftTop.push(new THREE.Vector3(-w, top, z));
    rightTop.push(new THREE.Vector3(w, top, z));
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < 6; k++) {
    const a = i * 7 + k, b = a + 7;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // end caps (transom + bow plate)
  for (const i of [0, N]) {
    const base = pos.length / 3;
    for (let k = 0; k < 7; k++) { pos.push(pos[(i * 7 + k) * 3], pos[(i * 7 + k) * 3 + 1], pos[(i * 7 + k) * 3 + 2]); uv.push(0.5, k / 6); }
    for (const [a, b] of [[0, 1], [1, 2], [4, 5], [5, 6], [6, 0]]) idx.push(base + 3, base + a, base + b);
  }
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  hullGeo.setIndex(idx);
  hullGeo.computeVertexNormals();
  boat.add(new THREE.Mesh(hullGeo, wood));

  // gunwales
  for (const pts of [leftTop, rightTop]) {
    const curve = new THREE.CatmullRomCurve3(pts);
    boat.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.08, 6), darkWood));
  }
  // floorboards and thwarts
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 9.6), toon(0xffffff, { map: woodTexture('#9a6d48', '#5a3a24', 9) }));
  floor.position.set(0, 0.22, 0.6);
  boat.add(floor);
  for (const s of [0.12, 0.38, 0.62]) {
    const st = station(s);
    const th = new THREE.Mesh(new THREE.BoxGeometry(st.w * 2, 0.12, 0.28), darkWood);
    th.position.set(0, st.top - 0.12, st.z);
    boat.add(th);
  }

  // straw-mat canopy (toma)
  const straw = strawTexture();
  const canopyGeo = new THREE.CylinderGeometry(1.28, 1.28, 3.4, 16, 1, true, 0, Math.PI);
  canopyGeo.rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  const canopy = new THREE.Mesh(canopyGeo, toon(0xffffff, { map: straw, side: THREE.DoubleSide }));
  canopy.position.set(0, 1.0, 1.4);
  boat.add(canopy);
  for (const z of [-0.3, 3.1]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.05, 6, 16, Math.PI), darkWood);
    rib.position.set(0, 1.0, z);
    boat.add(rib);
  }

  // cargo: rice bales and a crate
  const baleMat = toon(0xffffff, { map: straw });
  const rope = toon(0x5a4630);
  const bales = [[-0.45, 0.65, -2.6], [0.45, 0.65, -2.6], [0, 1.4, -2.6], [-0.4, 0.65, -3.7]];
  for (const [x, y, z] of bales) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 12), baleMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(x, y, z);
    boat.add(b);
    for (const off of [-0.3, 0.3]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.04, 5, 16), rope);
      r.rotation.y = Math.PI / 2;
      r.position.set(x + off, y, z);
      boat.add(r);
    }
  }
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), toon(0xffffff, { map: woodTexture('#a27a50', '#6a4a2a', 4) }));
  crate.position.set(0.45, 0.6, -3.7);
  boat.add(crate);

  // bow lantern
  const bowSt = station(0.9);
  const lPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.8, 6), darkWood);
  lPole.position.set(0, bowSt.top + 0.6, bowSt.z);
  lPole.rotation.x = -0.35;
  boat.add(lPole);
  const lanternMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.45, 0.15) });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), lanternMat);
  lantern.scale.y = 1.35;
  lantern.position.set(0, bowSt.top + 0.95, bowSt.z - 0.75);
  boat.add(lantern);
  for (const dy of [-0.38, 0.38]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 10), darkWood);
    cap.position.set(0, lantern.position.y + dy, lantern.position.z);
    boat.add(cap);
  }

  // passenger with a red wagasa
  const passenger = new THREE.Group();
  const robe = toon(0xd9708f);
  const skin = toon(0xf0c9a5);
  const hair = toon(0x1e1a22);
  const pBody = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 12), robe);
  pBody.position.y = 0.75;
  const pObi = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.18, 12), toon(0xf2d27a));
  pObi.position.y = 0.95;
  const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin);
  pHead.position.y = 1.5;
  const pHair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), hair);
  pHair.position.set(0, 1.53, 0.02);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), hair);
  bun.position.set(0, 1.72, 0.08);
  const umbrella = new THREE.Group();
  const shade = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.5, 24, 1, true), toon(0xffffff, { map: parasolTexture(), side: THREE.DoubleSide }));
  shade.position.y = 1.25;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 5), darkWood);
  shaft.position.y = 0.6;
  umbrella.add(shade, shaft);
  umbrella.position.set(0.2, 1.0, 0.1);
  umbrella.rotation.set(0.35, 0, -0.25);
  passenger.add(pBody, pObi, pHead, pHair, bun, umbrella);
  passenger.position.set(0, 0.2, -1.2);
  passenger.rotation.y = 0.3;
  boat.add(passenger);

  // boatman
  const indigo = toon(0x2c3d66);
  const man = new THREE.Group();
  man.position.set(0, 0.26, 4.4);
  boat.add(man);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.85, 10), toon(0x26304a));
  legs.position.y = 0.42;
  man.add(legs);
  const torso = new THREE.Group();
  torso.position.y = 0.85;
  man.add(torso);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.95, 10), indigo);
  chest.position.y = 0.47;
  const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.14, 10), toon(0xe8dcc2));
  obi.position.y = 0.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin);
  head.position.y = 1.15;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.32, 20), toon(0xffffff, { map: straw }));
  hat.position.y = 1.36;
  torso.add(chest, obi, head, hat);
  const armMat = indigo;
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1, 6), armMat);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1, 6), armMat);
  boat.add(armR, armL);

  // bamboo pole
  const poleLen = 8.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, poleLen, 6), toon(0xa79158));
  boat.add(pole);

  // poling animation state
  const shoulderR = new THREE.Vector3(0.3, 0.92, 0);
  const shoulderL = new THREE.Vector3(-0.3, 0.92, 0);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const tip = new THREE.Vector3();
  let lastPhase = 0;

  function animate(t, period) {
    const ph = (t / period) % 1;
    let alpha, hand, slide, lean;
    if (ph < 0.55) {
      const u = ph / 0.55;
      const e = u * u * (3 - 2 * u);
      alpha = -0.08 + e * 0.75;
      hand = new THREE.Vector3(0.62, 2.05 - e * 0.65, 3.4 + e * 1.5);
      slide = 0;
      lean = 0.18 + e * 0.32;
    } else {
      const u = (ph - 0.55) / 0.45;
      const e = u * u * (3 - 2 * u);
      alpha = 0.67 - e * 0.75;
      hand = new THREE.Vector3(0.62, 1.4 + e * 0.65 + Math.sin(u * Math.PI) * 0.35, 4.9 - e * 1.5);
      slide = Math.sin(u * Math.PI) * 2.2;
      lean = 0.5 - e * 0.32;
    }
    torso.rotation.x = -lean;
    torso.rotation.y = -0.25;
    const dir = new THREE.Vector3(0, -Math.cos(alpha), Math.sin(alpha)); // hand → tip
    const below = 5.4 - slide;
    tip.copy(hand).addScaledVector(dir, below);
    const top = hand.clone().addScaledVector(dir, below - poleLen);
    setLimb(pole, top, tip);
    pole.scale.y = 1; // geometry already full length; setLimb scales to the span
    pole.scale.y = top.distanceTo(tip) / poleLen;

    man.updateMatrixWorld(true);
    boat.updateMatrixWorld(true);
    const toBoat = (v, obj) => boat.worldToLocal(obj.localToWorld(v.clone()));
    setLimb(armR, toBoat(shoulderR, torso), hand);
    setLimb(armL, toBoat(shoulderL, torso), tmpB.copy(hand).addScaledVector(dir, 0.6));

    const planted = lastPhase > 0.9 && ph < 0.1;
    lastPhase = ph;
    const surge = ph < 0.55 ? Math.sin((ph / 0.55) * Math.PI) : 0;
    return { planted, surge, tipWorld: boat.localToWorld(tmpA.copy(tip)) };
  }

  return { group: boat, animate, lanternMat, eye: new THREE.Vector3(-0.35, 4.7, 9.2) };
}

// ─── structures ─────────────────────────────────────────────

function makeHouse(rng, { w = 7, d = 5, h = 3 } = {}) {
  const g = new THREE.Group();
  const plaster = toon(0xeee6d6);
  const timber = toon(0x4a3426);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plaster);
  walls.position.y = h / 2;
  g.add(walls);
  for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, 0.22), timber);
    p.position.set(x, h / 2, z);
    g.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.25, d + 0.1), timber);
  beam.position.y = h;
  g.add(beam);
  // thatched hip roof
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), toon(0x9b7a4a));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set((w + 2.2) * 0.72, 3.4, (d + 2.2) * 0.72);
  roof.position.y = h + 1.7;
  g.add(roof);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.45, 0.6), toon(0x3e3a34));
  ridge.position.y = h + 3.3;
  g.add(ridge);
  return g;
}

// paifang: a Chinese memorial archway with a tiled, upturned roof and a name plaque
function makePaifang(scale = 1) {
  const g = new THREE.Group();
  const red = toon(0xd23b26);
  const black = toon(0x1d1a1a);
  const tile = toon(0x34403c);
  const gold = toon(0xd8b04a);
  const H = 12 * scale, span = 9 * scale;
  for (const x of [-span / 2, span / 2]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.5 * scale, H, 14), red);
    p.position.set(x, H / 2, 0);
    g.add(p);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5 * scale, 1.2 * scale, 1.5 * scale), toon(0x9c958a));
    base.position.set(x, 0.6 * scale, 0);
    g.add(base);
  }
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(span + 1.4 * scale, 0.6 * scale, 0.5 * scale), red);
  nuki.position.y = H * 0.78;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(span + 2.4 * scale, 0.7 * scale, 0.8 * scale), red);
  lintel.position.y = H - 0.2 * scale;
  g.add(nuki, lintel);
  // roof: tapers to a ridge, eaves sweep up at both ends
  const RW = span + 5.5 * scale;
  const roofGeo = new THREE.BoxGeometry(RW, 1.5 * scale, 3 * scale, 24, 1, 1);
  const rp = roofGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const u = rp.getX(i) / (RW / 2);
    if (rp.getY(i) > 0) rp.setZ(i, rp.getZ(i) * 0.18);
    rp.setY(i, rp.getY(i) + Math.pow(Math.abs(u), 3) * 1.3 * scale);
  }
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, tile);
  roof.position.y = H + 1.1 * scale;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(span + 1.6 * scale, 0.4 * scale, 0.5 * scale), black);
  ridge.position.y = H + 1.95 * scale;
  g.add(roof, ridge);
  // name plaque between the beams
  const frame = new THREE.Mesh(new THREE.BoxGeometry(span * 0.46, H * 0.15, 0.32 * scale), gold);
  frame.position.y = H * 0.885;
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(span * 0.4, H * 0.11, 0.4 * scale), toon(0x20335e));
  plaque.position.y = H * 0.885;
  g.add(frame, plaque);
  return g;
}

function makeArchBridge(x0, z0, halfSpan, baseY) {
  const g = new THREE.Group();
  const red = toon(0xc73a28);
  const deckMat = toon(0xffffff, { map: woodTexture('#8d6a4a', '#5a3e2a', 3) });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.8, roughness: 0.35 });
  const rise = 8.5;
  const N = 28;
  const pt = (u) => new THREE.Vector3(x0 + u * halfSpan, baseY + rise * (1 - u * u), z0);
  for (let i = 0; i < N; i++) {
    const a = pt(-1 + (2 * i) / N), b = pt(-1 + (2 * (i + 1)) / N);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len + 0.05, 0.35, 3.6), deckMat);
    deck.position.copy(mid);
    deck.rotation.z = ang;
    g.add(deck);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len + 0.05, 0.5, 0.3), red);
    for (const side of [-1.85, 1.85]) {
      const r = beam.clone();
      r.position.set(mid.x, mid.y + 1.15, z0 + side);
      r.rotation.z = ang;
      g.add(r);
      const s = new THREE.Mesh(new THREE.BoxGeometry(len + 0.05, 0.6, 0.18), red);
      s.position.set(mid.x, mid.y - 0.35, z0 + side);
      s.rotation.z = ang;
      g.add(s);
    }
    if (i % 3 === 0) for (const side of [-1.85, 1.85]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.3, 0.22), red);
      post.position.set(a.x, a.y + 0.6, z0 + side);
      g.add(post);
    }
  }
  for (const u of [-1, 1]) for (const side of [-1.85, 1.85]) {
    const p = pt(u);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 10), red);
    post.position.set(p.x, p.y + 0.8, z0 + side);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), gold);
    cap.position.set(p.x, p.y + 1.75, z0 + side);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 10), gold);
    spire.position.set(p.x, p.y + 2.1, z0 + side);
    g.add(post, cap, spire);
  }
  for (const u of [-0.72, -0.4, 0.4, 0.72]) {
    const p = pt(u);
    for (const side of [-1.4, 1.4]) {
      const h = p.y + 4;
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, h, 10), red);
      pier.position.set(p.x, p.y - h / 2, z0 + side);
      g.add(pier);
    }
  }
  return g;
}

function makeWaterwheel(radius = 3.2) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  wheel.add(spin);
  const wood = toon(0x6a4a32);
  for (const z of [-0.55, 0.55]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.12, 6, 32), wood);
    rim.position.z = z;
    spin.add(rim);
  }
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, radius * 2, 0.14), wood);
    s.rotation.z = (i / 8) * Math.PI;
    spin.add(s);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.3), wood);
    p.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    p.rotation.z = a;
    spin.add(p);
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.8, 10), wood);
  axle.rotation.x = Math.PI / 2;
  spin.add(axle);
  wheel.rotation.y = Math.PI / 2;
  return { wheel, spin };
}

function makeTempleHall() {
  const g = new THREE.Group();
  const red = toon(0xc73a28);
  const wall = toon(0xe0b860);
  const base = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 8), toon(0x9c958a));
  base.position.y = 0.6;
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 5.5), wall);
  body.position.y = 3.2;
  g.add(base, body);
  for (const x of [-3.5, -1.2, 1.2, 3.5]) for (const z of [-2.75, 2.75]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4, 8), red);
    p.position.set(x, 3.2, z);
    g.add(p);
  }
  const roof = new THREE.Mesh(makeRoofGeometry(7.6, 3.4, 1.2, 4), toon(0x355a5a, { side: THREE.DoubleSide }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1, 0.9);
  roof.position.y = 6.9;
  g.add(roof);
  return g;
}

// ─── profile landmarks ──────────────────────────────────────

function wrapLines(g, text, maxW, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = lines[maxLines - 1].replace(/[,.;:]?\s*\S*$/, '…');
  return lines;
}

function canvasTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function signTexture(profile) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 600;
  const g = c.getContext('2d');
  g.fillStyle = '#eadcc0'; g.fillRect(0, 0, 1024, 600);
  const rng = mulberry32(3);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(110,80,50,${0.04 + rng() * 0.06})`;
    g.beginPath(); const y = rng() * 600; g.moveTo(0, y); g.lineTo(1024, y + (rng() - 0.5) * 8); g.stroke();
  }
  g.strokeStyle = '#3a2a20'; g.lineWidth = 16; g.strokeRect(8, 8, 1008, 584);
  g.strokeStyle = '#b8322a'; g.lineWidth = 3; g.strokeRect(34, 34, 956, 532);
  g.fillStyle = '#1f1b1f'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '600 104px "Cormorant Garamond", serif';
  g.fillText(profile.name, 70, 160);
  g.font = '500 32px "Noto Serif SC", serif'; g.fillStyle = '#6a4a3a';
  g.fillText(profile.subtitle, 74, 214);
  g.strokeStyle = 'rgba(31,27,31,.6)'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(74, 246); g.bezierCurveTo(300, 236, 600, 254, 950, 242); g.stroke();
  g.font = '400 31px "Noto Sans SC", sans-serif'; g.fillStyle = '#2e2629';
  wrapLines(g, profile.board || profile.intro, 870, 6).forEach((l, i) => g.fillText(l, 74, 300 + i * 42));
  g.font = '700 28px "Noto Sans SC", sans-serif'; g.fillStyle = '#b8322a';
  g.fillText('Click the board to read more  ·  己', 74, 566 - 6);
  g.fillStyle = '#b8322a'; g.fillRect(860, 64, 100, 100);
  g.fillStyle = '#fff4ea'; g.font = '600 52px "Cormorant Garamond", serif'; g.textAlign = 'center';
  g.fillText(profile.seal || profile.name[0], 910, 132);
  return canvasTex(c);
}

function makeNoticeBoard(profile) {
  const g = new THREE.Group();
  const wood = toon(0x5a3e2c);
  for (const x of [-3.6, 3.6]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 6.2, 8), wood);
    p.position.set(x, 3.1, 0);
    g.add(p);
  }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.87), toon(0xffffff, { map: signTexture(profile) }));
  board.position.set(0, 3.6, 0.05);
  const back = new THREE.Mesh(new THREE.BoxGeometry(7.0, 4.2, 0.18), wood);
  back.position.set(0, 3.6, -0.06);
  g.add(back, board);
  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.14, 1.3), toon(0x2f2a28));
    r.position.set(0, 6.05, side * 0.42);
    r.rotation.x = side * 0.5;
    g.add(r);
  }
  return g;
}

function wishPlaqueTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 200;
  const g = c.getContext('2d');
  g.beginPath(); g.moveTo(6, 52); g.lineTo(128, 6); g.lineTo(250, 52); g.lineTo(250, 194); g.lineTo(6, 194); g.closePath();
  g.fillStyle = '#d8b07a'; g.fill();
  g.lineWidth = 6; g.strokeStyle = '#7a5232'; g.stroke();
  g.fillStyle = '#b8322a'; g.beginPath(); g.arc(128, 38, 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1f1b1f'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 44;
  g.font = `700 ${fs}px "Noto Sans SC", sans-serif`;
  while (g.measureText(text).width > 220 && fs > 18) { fs -= 2; g.font = `700 ${fs}px "Noto Sans SC", sans-serif`; }
  g.fillText(text, 128, 120);
  return canvasTex(c);
}

function makeWishRack(skills, rng) {
  const g = new THREE.Group();
  const wood = toon(0x6a4630);
  for (const x of [-4.4, 4.4]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.28), wood);
    p.position.set(x, 1.8, 0);
    g.add(p);
  }
  for (const y of [3.3, 2.0]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.16, 0.16), wood);
    b.position.set(0, y, 0);
    g.add(b);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10, 0.18, 1.2), toon(0x2f2a28));
  roof.position.y = 3.75;
  g.add(roof);
  const geo = new THREE.PlaneGeometry(1.15, 0.9);
  skills.slice(0, 14).forEach((sk, i) => {
    const row = i < 7 ? 0 : 1;
    const col = row === 0 ? i : i - 7;
    const m = new THREE.Mesh(geo, toon(0xffffff, { map: wishPlaqueTexture(sk.name), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    m.position.set(-3.75 + col * 1.25, (row === 0 ? 3.3 : 2.0) - 0.55, 0.12);
    m.rotation.z = (rng() - 0.5) * 0.18;
    g.add(m);
  });
  return g;
}

function bannerTex(lines, bg, fg = '#fff6ea', w = 256, h = 768) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = h / (lines.length + 1);
  lines.forEach((l, i) => {
    g.font = l.length === 1 ? `800 ${Math.min(w * 0.62, step * 0.9)}px "Noto Serif SC", serif` : `700 ${Math.min(w * 0.12, 64)}px "Noto Sans SC", sans-serif`;
    g.fillText(l, w / 2, step * (i + 1));
  });
  return canvasTex(c);
}

function makeFestivalGate() {
  const g = new THREE.Group();
  const wood = toon(0x4a3426);
  for (const x of [-5, 5]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 10, 8), wood);
    p.position.set(x, 5, 0);
    g.add(p);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 4.6), new THREE.MeshBasicMaterial({ map: bannerTex(x < 0 ? ['灯', '会'] : ['烟', '火'], x < 0 ? '#20335e' : '#a8322a'), side: THREE.DoubleSide }));
    ban.position.set(x + (x < 0 ? 0.85 : -0.85), 6.2, 0.1);
    g.add(ban);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.4, 0.4), wood);
  beam.position.y = 9.4;
  g.add(beam);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.6), new THREE.MeshBasicMaterial({ map: bannerTex(['TO THE FESTIVAL  →'], '#1f1b1f', '#ffd9a0', 1024, 300) }));
  sign.position.set(0, 8.2, 0.25);
  g.add(sign);
  const lanterns = [];
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), new THREE.MeshBasicMaterial({ color: i % 2 ? new THREE.Color(3.2, 2.6, 2.0) : new THREE.Color(3.0, 0.6, 0.3) }));
    m.scale.y = 1.3;
    m.position.set(-4.4 + u * 8.8, 9.0 - Math.sin(u * Math.PI) * 0.6 - 0.5, 0.3);
    g.add(m);
    lanterns.push(m);
  }
  return g;
}

function hitBox(w, h, d, y = h / 2) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.y = y;
  return m;
}

// ─── scene ──────────────────────────────────────────────────

export function buildValley({ projects, accents, halo, renderScale, profile, skills }) {
  const U = makeUniforms();
  U.uFogDensity.value = 0.0007;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xe6d0c0, 0.0012);
  const rng = mulberry32(1868);

  // time of day
  const tod = { elev: 0, azim: 0, sunI: 0, hemi: 0, lantern: 0 };
  let todTarget = VALLEY_TOD.afternoon;
  const tmpC = new THREE.Color();
  function applyTOD(p, k) {
    for (const key of ['elev', 'azim', 'sunI', 'hemi', 'lantern']) tod[key] += (p[key] - tod[key]) * k;
    U.uSkyTop.value.lerp(tmpC.set(p.top), k);
    U.uSkyMid.value.lerp(tmpC.set(p.mid), k);
    U.uSkyHorizon.value.lerp(tmpC.set(p.horizon), k);
    U.uSunColor.value.lerp(tmpC.set(p.sun), k);
    U.uFogColor.value.lerp(tmpC.set(p.fog), k);
    U.uAmbient.value.lerp(tmpC.set(p.ambient), k);
    U.uWaterColor.value.lerp(tmpC.set(p.water), k);
    sunDirFrom(tod.elev, tod.azim, U.uSunDir.value);
    scene.fog.color.copy(U.uFogColor.value);
  }
  applyTOD(todTarget, 1);

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a4a3a, 0.9);
  scene.add(sun, sun.target, hemi);

  scene.add(makeSky(U));

  // terrain heightfield
  const terrainMat = makeTerrainMaterial(U);
  {
    const geo = new THREE.PlaneGeometry(1700, 2700, 400, 640);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -780);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, valleyHeight(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, terrainMat));
  }
  // distant ranges, layered into the haze
  const farMat = makeTerrainMaterial(U, { blossoms: 0.3 });
  const addPeak = (x, z, h, r, rough = 0.7) => {
    const m = new THREE.Mesh(makePeakGeometry(h, r, rng() * 100, rng, rough), farMat);
    m.position.set(x, -10, z);
    scene.add(m);
  };
  for (let i = 0; i < 26; i++) addPeak((rng() - 0.5) * 2600, -2150 - rng() * 900, 260 + rng() * 420, 260 + rng() * 260);
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1;
    addPeak(side * (900 + rng() * 500), -1900 + rng() * 2300, 220 + rng() * 300, 200 + rng() * 180);
  }
  for (let i = 0; i < 8; i++) addPeak((rng() - 0.5) * 2200, 700 + rng() * 500, 200 + rng() * 200, 220);

  // water
  const water = makeWater(U, { size: [1800, 3000], center: [0, -800], river: true, calm: 1, petals: 1, renderScale });
  scene.add(water.mesh);

  // structures
  const keepOut = [];
  const bankX = (z, side, off) => riverX(z) + side * (riverW(z) + off);

  const mill = makeHouse(rng, { w: 7, d: 5.5, h: 3.2 });
  {
    const z = -96, x = bankX(z, 1, 9);
    mill.position.set(x, valleyHeight(x, z) - 0.3, z);
    mill.rotation.y = Math.PI / 2;
    scene.add(mill);
    keepOut.push([x, z, 12]);
  }
  const wheel = makeWaterwheel(3.2);
  {
    const z = -96, x = bankX(z, 1, 1.2);
    wheel.wheel.position.set(x, 1.6, z);
    scene.add(wheel.wheel);
  }
  for (const [z, side, off] of [[-150, 1, 18], [-60, 1, 24], [-180, -1, 22]]) {
    const hs = makeHouse(rng, { w: 6 + rng() * 2, d: 5, h: 3 });
    const x = bankX(z, side, off);
    hs.position.set(x, valleyHeight(x, z) - 0.3, z);
    hs.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(hs);
    keepOut.push([x, z, 11]);
  }
  {
    const z = -262;
    const x0 = riverX(z);
    const half = riverW(z) + 9;
    const baseY = Math.max(valleyHeight(x0 - half, z), valleyHeight(x0 + half, z), 0.8) + 0.2;
    scene.add(makeArchBridge(x0, z, half, baseY));
    keepOut.push([x0 - half, z, 9], [x0 + half, z, 9]);
  }
  const landmarks = [];
  {
    // notice board at the river mouth: who I am
    const z = 66, x = bankX(z, 1, 7);
    const b = makeNoticeBoard(profile);
    b.position.set(x, valleyHeight(x, z) - 0.2, z);
    b.rotation.y = -Math.PI / 2 + 0.35;
    scene.add(b);
    const hit = hitBox(7.5, 6.5, 2);
    b.add(hit);
    keepOut.push([x, z, 9]);
    landmarks.push({ id: 'about', kind: 'about', label: 'About me', jp: '己', accent: '#c8372d', group: b, hit, labelY: 7.4,
      view: (p) => ({ pos: p.clone().add(new THREE.Vector3(-13, 3.5, 4)), target: p.clone().add(new THREE.Vector3(0, 3.4, 0)) }) });
  }
  {
    // festival gate at the end of the voyage
    const z = -988, x = bankX(z, 1, 6);
    const gte = makeFestivalGate();
    gte.position.set(x, valleyHeight(x, z) - 0.2, z);
    gte.rotation.y = -Math.PI / 2 + 0.3;
    scene.add(gte);
    const hit = hitBox(12, 10, 2);
    gte.add(hit);
    keepOut.push([x, z, 10]);
    landmarks.push({ id: 'festival', kind: 'festival', label: 'To the festival', jp: '火', accent: '#ff8a3d', group: gte, hit, labelY: 11.5 });
  }
  {
    const z = -722, x = riverX(z) + riverW(z) * 0.52;
    const t = makePaifang(1.15);
    t.position.set(x, -0.8, z);
    scene.add(t);
    const hit = hitBox(13, 16, 3, 7);
    t.add(hit);
    landmarks.push({ id: 'journey', kind: 'journey', label: 'My journey', jp: '道', accent: '#d23b26', group: t, hit, labelY: 17,
      view: (p) => ({ pos: p.clone().add(new THREE.Vector3(-24, 7, 22)), target: p.clone().add(new THREE.Vector3(0, 7, 0)) }) });
  }
  {
    const z = -478, x = bankX(z, -1, 34);
    const y = valleyHeight(x, z);
    const hall = makeTempleHall();
    hall.position.set(x - 4, y - 0.4, z);
    hall.rotation.y = Math.PI / 2;
    scene.add(hall);
    const t = makePaifang(0.75);
    const tx = bankX(z, -1, 8);
    t.position.set(tx, valleyHeight(tx, z) - 0.2, z);
    t.rotation.y = Math.PI / 2;
    scene.add(t);
    const stone = toon(0xaaa395);
    for (let i = 0; i < 12; i++) {
      const sx = tx - 2 - i * ((tx - x - 6) / 12);
      const sy = valleyHeight(sx, z);
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 4), stone);
      s.position.set(sx, sy, z);
      scene.add(s);
    }
    keepOut.push([x, z, 16], [tx, z, 8]);
    const rz = z - 12, rx = bankX(rz, -1, 5);
    const rack = makeWishRack(skills, rng);
    rack.position.set(rx, valleyHeight(rx, rz) - 0.1, rz);
    rack.rotation.y = Math.PI / 2 - 0.3;
    scene.add(rack);
    const hit = hitBox(10, 4.5, 2);
    rack.add(hit);
    keepOut.push([rx, rz, 7]);
    landmarks.push({ id: 'skills', kind: 'skills', label: 'Temple of skills', jp: '技', accent: '#e3a63a', group: rack, hit, labelY: 5.2,
      view: (p) => ({ pos: p.clone().add(new THREE.Vector3(12, 4, 5)), target: p.clone().add(new THREE.Vector3(0, 2.6, 0)) }) });
  }

  // project markers along the banks
  const markers = projects.map((proj, i) => {
    const z = -14 - i * 104;
    const side = i % 2 === 0 ? 1 : -1;
    const x = bankX(z, side, 5.5);
    const m = makeStoneLantern(U, proj, accents[proj.accent]?.color || '#ffffff', halo);
    m.group.position.set(x, valleyHeight(x, z) - 0.15, z);
    m.group.rotation.y = side > 0 ? Math.PI : 0;
    scene.add(m.group);
    keepOut.push([x, z, 7]);
    return { ...m, id: proj.id, kind: 'project', label: proj.name, accent: accents[proj.accent]?.color, project: proj, passed: false };
  });
  const projectMarkers = [...markers];
  markers.push(...landmarks);

  // forests: cherry trees on the banks, cedars on the slopes
  const isFree = (x, z) => keepOut.every(([kx, kz, r]) => (x - kx) ** 2 + (z - kz) ** 2 > r * r);
  {
    const { wood, canopy } = makeCherryGeometries(rng);
    const spots = [];
    for (let i = 0; i < 2600 && spots.length < 520; i++) {
      const z = 360 - rng() * 1650;
      const side = rng() < 0.5 ? -1 : 1;
      const off = 3 + Math.pow(rng(), 1.6) * 70;
      const x = bankX(z, side, off);
      if (!isFree(x, z)) continue;
      const y = valleyHeight(x, z);
      if (y < 0.4 || y > 70) continue;
      spots.push([x, y - 0.2, z, 0.85 + rng() * 0.75]);
    }
    const woodMesh = new THREE.InstancedMesh(wood, toon(0x4a3328), spots.length);
    const canopyMat = makeFoliageMaterial(U, { shadow: '#b0688f', mid: '#f4b3c6', high: '#fff1f4', trans: '#ff9cb8', wind: 0.08, dabs: 0.35, map: foliageCardTexture('blossom') });
    const canopyMesh = new THREE.InstancedMesh(canopy, canopyMat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3(), c = new THREE.Color();
    spots.forEach(([x, y, z, sc], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6.28);
      m4.compose(pv.set(x, y, z), q, s.set(sc, sc * (0.9 + rng() * 0.25), sc));
      woodMesh.setMatrixAt(i, m4);
      canopyMesh.setMatrixAt(i, m4);
      const w = rng();
      canopyMesh.setColorAt(i, c.setRGB(1, 0.93 + w * 0.07, 0.95 + w * 0.05).lerp(new THREE.Color(1, 1, 1), rng() * 0.4));
    });
    scene.add(woodMesh, canopyMesh);
  }
  {
    const geo = makeCedarGeometry();
    const spots = [];
    for (let i = 0; i < 6000 && spots.length < 1700; i++) {
      const z = 420 - rng() * 1900;
      const side = rng() < 0.5 ? -1 : 1;
      const off = 35 + rng() * 260;
      const x = bankX(z, side, off);
      if (!isFree(x, z)) continue;
      const y = valleyHeight(x, z);
      if (y > 210 || y < 2) continue;
      if (noise3(x * 0.012, 3.3, z * 0.012) < 0.42) continue; // clumped stands
      spots.push([x, y - 0.4, z, 1.4 + rng() * 1.6]);
    }
    const mat = makeFoliageMaterial(U, { shadow: '#14302a', mid: '#2f5a3a', high: '#6f8f4a', trans: '#4a6a30', wind: 0.03, dabs: 0.6 });
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3(), c = new THREE.Color();
    spots.forEach(([x, y, z, sc], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6.28);
      m4.compose(pv.set(x, y, z), q, s.set(sc, sc * (1 + rng() * 0.6), sc));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.setScalar(0.8 + rng() * 0.4));
    });
    scene.add(mesh);
  }
  // river boulders
  {
    const rockMat = toon(0x8f8a80);
    for (let i = 0; i < 70; i++) {
      const z = 200 - rng() * 1300;
      const side = rng() < 0.5 ? -1 : 1;
      const x = bankX(z, side, -rng() * 6);
      const r = 0.6 + rng() * 1.8;
      const geo = new THREE.IcosahedronGeometry(r, 1);
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const f = 0.8 + noise3(p.getX(k) * 2 + i, p.getY(k) * 2, p.getZ(k) * 2) * 0.4;
        p.setXYZ(k, p.getX(k) * f, p.getY(k) * f * 0.7, p.getZ(k) * f);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, rockMat);
      m.position.set(x, -0.2, z);
      scene.add(m);
    }
  }

  const mist = makeMist(U, [4, 11, 24], { amount: 0.16 });
  mist.meshes.forEach((m) => scene.add(m));
  const petals = makePetals(U, 900, rng, { radius: 70, height: 45, renderScale });
  scene.add(petals);

  // boat
  const boat = makeBoat(U);
  scene.add(boat.group);
  const boatState = { z: BOAT_START, speed: 2.4, pos: new THREE.Vector3(), fwd: new THREE.Vector3(0, 0, -1), side: new THREE.Vector3(1, 0, 0) };
  function placeBoat(z) {
    const x = riverX(z);
    const nx = riverX(z - 2);
    boatState.fwd.set(nx - x, 0, -2).normalize();
    boatState.side.set(-boatState.fwd.z, 0, boatState.fwd.x);
    boatState.pos.set(x, 0, z);
    boat.group.position.set(x, -0.35, z);
    boat.group.rotation.y = Math.atan2(-boatState.fwd.x, -boatState.fwd.z);
  }
  placeBoat(BOAT_START);

  const homeView = () => {
    const p = boatState.pos, f = boatState.fwd, s = boatState.side;
    return {
      pos: p.clone().addScaledVector(f, -24).addScaledVector(s, 11).add(new THREE.Vector3(0, 9.5, 0)),
      target: p.clone().addScaledVector(f, 9).add(new THREE.Vector3(0, 3, 0)),
    };
  };

  let poleTime = 0;
  function update(dt, t, { onPass, onLoop, paused }) {
    U.uTime.value = t;
    applyTOD(todTarget, 1 - Math.exp(-dt * 1.5));
    sun.position.copy(U.uSunDir.value).multiplyScalar(300).add(boatState.pos);
    sun.target.position.copy(boatState.pos);
    sun.color.copy(U.uSunColor.value);
    sun.intensity = tod.sunI;
    hemi.color.copy(U.uSkyMid.value);
    hemi.intensity = tod.hemi;

    if (!paused) {
      poleTime += dt;
      const a = boat.animate(poleTime, 3.6);
      boatState.speed = 2.2 + a.surge * 1.8;
      boatState.z -= boatState.speed * dt;
      if (a.planted) water.addRipple(a.tipWorld.x, a.tipWorld.z, 0.9);
      if (boatState.z < BOAT_END) {
        boatState.z = BOAT_START;
        markers.forEach((m) => (m.passed = false));
        onLoop?.();
      }
    }
    placeBoat(boatState.z);
    boat.group.position.y = -0.35 + Math.sin(t * 1.7) * 0.05;
    boat.group.rotation.x = Math.sin(t * 1.3) * 0.012 - boatState.speed * 0.004;
    boat.group.rotation.z = Math.sin(t * 1.1) * 0.02;
    boat.lanternMat.color.setRGB(1, 0.45, 0.15).multiplyScalar(tod.lantern * 1.4);

    water.uniforms.uBoat.value.set(boatState.pos.x, boatState.pos.z, boatState.fwd.x, boatState.fwd.z);
    water.uniforms.uBoatSpeed.value = paused ? 0.2 : boatState.speed / 4;

    wheel.spin.rotation.z -= dt * 0.5;
    petals.material.uniforms.uCenter.value.copy(boatState.pos);

    for (const m of projectMarkers) {
      m.light.material.color.copy(m.color).multiplyScalar(1.5 + tod.lantern * 0.9 + Math.sin(t * 2.3 + m.group.position.z) * 0.2);
      if (!m.passed && boatState.z < m.group.position.z + 6) {
        m.passed = true;
        if (boatState.z > m.group.position.z - 30) onPass?.(m.project);
      }
    }
  }

  return {
    scene, U, water, markers, boat, boatState, homeView,
    update,
    setTOD(name) { if (VALLEY_TOD[name]) todTarget = VALLEY_TOD[name]; },
    layers: { petals: [petals], mist: mist.meshes },
    resize(w, h, rs, refl) { water.resize(w, h, rs, refl); petals.material.uniforms.uPR.value = rs; },
  };
}
