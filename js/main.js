import { PROFILE, ACCENTS, PROJECTS, CATEGORIES, SKILLS, SKILL_LINKS, JOURNEY } from './data.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const accentOf = (p) => ACCENTS[p.accent]?.color || '#c8372d';

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// ─── profile text ───────────────────────────────────────────
$('#intro-name').textContent = PROFILE.name;
$('#intro-title').textContent = PROFILE.title;
$('#intro-text').textContent = PROFILE.intro;
$('#brand-name').textContent = PROFILE.name;
$('#brand-seal').textContent = PROFILE.seal || PROFILE.name[0];
document.title = `${PROFILE.name} · Portfolio`;
$('#brand-sub').textContent = PROFILE.subtitle;
$('#nav-github').href = PROFILE.github;

// ─── loader ─────────────────────────────────────────────────
const ensoPath = $('#enso-path');
const steps = ['Grinding ink', 'Carving the valley', 'Planting cherry trees', 'Building the boat', 'Raising the pagoda', 'Hanging lanterns', 'Unrolling paper'];
function progress(p, label) {
  ensoPath.style.strokeDashoffset = String(1 - p);
  $('#loader-pct').textContent = Math.round(p * 100);
  if (label) $('#loader-text').textContent = label;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

let world = null;

async function boot() {
  progress(0.05, steps[0]);
  await nextFrame();
  let createWorld;
  try {
    ({ createWorld } = await import('./world/world.js'));
  } catch (err) {
    fail(err);
    return;
  }
  progress(0.25, steps[1]);
  await nextFrame();
  // fake a few steps so the brush stroke animates while the GPU warms up
  for (let i = 2; i < 5; i++) { progress(0.25 + i * 0.1, steps[i]); await nextFrame(); }
  // the notice board, wish plaques and stall banners are painted with these fonts
  try {
    await Promise.race([
      Promise.all(['600 100px "Cormorant Garamond"', '700 40px "Noto Serif SC"', '400 30px "Noto Sans SC"', '700 30px "Noto Sans SC"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fall back to system fonts */ }
  try {
    world = createWorld($('#scene'), {
      projects: PROJECTS,
      accents: ACCENTS,
      profile: PROFILE,
      skills: SKILLS,
      onHover: showTooltip,
      onSelect: selectMarker,
      onFrame: updateLabels,
      onPass: passToast,
      onViewChange: syncView,
      onBurst: (p, dist) => audio.boom(dist, p.type),
      onLoop: arrivalToast,
    });
  } catch (err) {
    fail(err);
    return;
  }
  buildLabels(world.markers());
  buildTour(world.markers());
  progress(0.85, steps[5]);
  await nextFrame();
  world.start();
  applySettings(settings);
  progress(1, steps[6]);
  await new Promise((r) => setTimeout(r, 650));
  $('#loader').classList.add('ready');
  $('#intro').hidden = false;
}

function fail(err) {
  console.error(err);
  $('#loader-text').textContent = 'WebGL could not start in this browser';
  $('#loader-pct').parentElement.innerHTML = `WebGL could not start in this browser. Browse my code on <a href="${PROFILE.github}">GitHub</a>.`;
}

$('#enter-btn').addEventListener('click', () => {
  $('#loader').classList.add('gone');
  $('#hud-top').hidden = false;
  $('#hud-bottom').hidden = false;
  world?.enter();
  audio.init();
  syncView('valley');
  $('#rail').hidden = false;
  $('#zoom').hidden = false;
  setTimeout(() => { if (!tour.active) $('#welcome').hidden = false; }, 2600);
});
$('#w-tour').addEventListener('click', () => { $('#welcome').hidden = true; startTour(0); });
$('#w-free').addEventListener('click', () => {
  $('#welcome').hidden = true;
  showHint('Click glowing lanterns and labelled landmarks · drag to look · scroll to zoom');
});
$('#act-tour').addEventListener('click', () => { $('#welcome').hidden = true; startTour(tour.active ? tour.i : 0); });

// ─── hint & toast ───────────────────────────────────────────
let hintTimer;
function showHint(text) {
  const h = $('#hint');
  h.textContent = text;
  h.hidden = false;
  h.classList.remove('fade');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.add('fade'), 6500);
}
let toastTimer;
function passToast(p) {
  if (!$('#scroll').hidden || tour.active || world?.view === 'festival') return;
  const t = $('#toast');
  t.style.setProperty('--accent', accentOf(p));
  t.innerHTML = `<div><small>Drifting past</small><strong>${esc(p.name)}</strong></div><span class="go">Open →</span>`;
  t.hidden = false;
  t.onclick = () => { t.hidden = true; openProject(p.id, { fly: true }); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 6000);
}
function arrivalToast() {
  if (tour.active || world?.view === 'festival') return;
  const t = $('#toast');
  t.style.setProperty('--accent', '#ff8a3d');
  t.innerHTML = '<div><small>The river ends</small><strong>A lantern festival beneath the snow mountain</strong></div><span class="go">Go →</span>';
  t.hidden = false;
  t.onclick = () => { t.hidden = true; world.setView('festival'); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 9000);
}

// ─── world labels & tooltip ─────────────────────────────────
const labelsEl = $('#labels');
const labelEls = new Map();
const markerById = new Map();
function buildLabels(list) {
  for (const m of list) {
    if (labelEls.has(m.id)) continue;
    markerById.set(m.id, m);
    const el = document.createElement('div');
    const special = m.kind !== 'project';
    el.className = 'wlabel hide' + (special ? ' special' : '');
    el.style.setProperty('--accent', m.accent || '#f2c14e');
    el.innerHTML = special ? `<b>${esc(m.jp || '')}</b>${esc(m.label)}` : `<i></i>${esc(m.label)}`;
    el.addEventListener('click', () => selectMarker(m));
    labelsEl.appendChild(el);
    labelEls.set(m.id, el);
  }
}
const KIND_HINT = {
  about: 'Who I am · click to read',
  skills: 'Each wish plaque is a skill · click',
  journey: 'Milestones so far · click',
  festival: 'Sail on to the lantern festival',
  shot: 'Click to fly there',
};
function selectMarker(m) {
  if (!m) return;
  if (m.kind === 'project') return openProject(m.project.id, { fly: true });
  if (m.kind === 'shot') { world.goShot(m.shot); return; }
  if (m.kind === 'festival') { world.setView('festival'); showHint('Welcome to the festival · scroll to zoom toward anything · click the sky for fireworks'); return; }
  world.focusMarker(m.id);
  PANELS[m.kind]?.();
}
const seen = new Set();
function updateLabels(list) {
  const panelOpen = !$('#scroll').hidden;
  seen.clear();
  for (const l of list) seen.add(l.id);
  for (const [id, el] of labelEls) if (!seen.has(id)) el.classList.add('hide');
  for (const l of list) {
    const el = labelEls.get(l.id);
    if (!el) continue;
    const show = l.visible && !panelOpen;
    el.classList.toggle('hide', !show);
    el.classList.toggle('on', l.hover);
    if (show) {
      const s = Math.max(0.7, Math.min(1, 120 / l.dist + 0.45));
      el.style.transform = `translate(${l.x}px, ${l.y}px) translate(-50%, -100%) scale(${s})`;
    }
  }
}
const tooltip = $('#tooltip');
let mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse = { x: e.clientX, y: e.clientY };
  if (tooltip.classList.contains('show')) { tooltip.style.left = mouse.x + 'px'; tooltip.style.top = mouse.y + 'px'; }
});
function showTooltip(m) {
  if (!m) { tooltip.classList.remove('show'); return; }
  tooltip.style.setProperty('--accent', m.accent || '#c8372d');
  tooltip.innerHTML = m.kind === 'project'
    ? `<h4>${esc(m.project.name)}</h4><p>${esc(m.project.tagline)} · click to open</p>`
    : `<h4>${esc(m.label)}</h4><p>${esc(KIND_HINT[m.kind] || '')}</p>`;
  tooltip.style.left = mouse.x + 'px';
  tooltip.style.top = mouse.y + 'px';
  tooltip.classList.add('show');
}

// ─── views ──────────────────────────────────────────────────
const CAPTIONS = {
  valley: ['春溪', 'Upstream through the blossom valley'],
  boat: ['舟中', 'Aboard the riverboat · drag to look around'],
  festival: ['灯会 · 烟花', 'Fireworks over the lantern festival · click the sky'],
};
function syncView(v) {
  $$('.pov button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  $('#caption-jp').textContent = CAPTIONS[v][0];
  $('#caption-en').textContent = CAPTIONS[v][1];
  $('#voyage').style.display = 'none';
  $('#shots').hidden = v !== 'festival';
  $$('.actions [data-for]').forEach((b) => (b.hidden = (b.dataset.for === 'festival') !== (v === 'festival')));
  audio.setScene(v === 'festival' ? 'festival' : 'valley');
}
$$('.pov button').forEach((b) => b.addEventListener('click', () => {
  world?.setView(b.dataset.view);
  if (b.dataset.view === 'festival') showHint('Scroll to zoom toward anything · right-drag to pan · click the sky to launch a firework');
  if (b.dataset.view === 'boat') showHint('You are aboard · drag to look around');
}));

let boatPaused = false;
$('#act-pause').addEventListener('click', (e) => {
  boatPaused = !boatPaused;
  world?.setBoatPaused(boatPaused);
  e.currentTarget.textContent = boatPaused ? '▶ Resume boat' : '❚❚ Pause boat';
});
$('#act-finale').addEventListener('click', () => world?.finale());
$('#act-sound').addEventListener('click', (e) => {
  const on = audio.toggle();
  e.currentTarget.setAttribute('aria-pressed', String(on));
  e.currentTarget.textContent = on ? '♪ Sound on' : '♪ Sound off';
});

// voyage progress (river z from 110 to −1020)
setInterval(() => {
  const z = world?.valleyBoatZ?.();
  if (z === undefined) return;
  let ahead = null;
  for (const st of tour.stops) if (st.scene === 'valley' && st.z < z && (!ahead || st.z > ahead.z)) ahead = st;
  $$('#rail-valley button').forEach((b) => b.classList.toggle('ahead', !!ahead && b.dataset.id === ahead.id));
}, 500);

// ─── zoom & festival shots ──────────────────────────────────
$('#zoom-in').addEventListener('click', () => world?.zoom(0.7));
$('#zoom-out').addEventListener('click', () => world?.zoom(1.4));
$('#zoom-home').addEventListener('click', () => {
  if (world?.view === 'festival') world.goShot('overview');
  else world?.setView(world.view === 'boat' ? 'boat' : 'valley');
  world?.clearFocus();
});
$$('#shots button').forEach((b) => b.addEventListener('click', () => {
  $$('#shots button').forEach((x) => x.classList.toggle('active', x === b));
  world?.goShot(b.dataset.shot);
}));

// ─── guided tour & river map ────────────────────────────────
const tour = { active: false, i: 0, stops: [] };
const firstSentences = (t, max = 230) => {
  const parts = t.match(/[^.!?]+[.!?]+/g) || [t];
  let out = '';
  for (const p of parts) { if ((out + p).length > max && out) break; out += p; }
  return out.trim();
};
function buildTour(list) {
  const valleyStops = list.filter((m) => m.scene === 'valley').sort((a, b) => b.z - a.z);
  const festStops = ['shot-street', 'shot-lake', 'shot-pagoda', 'shot-mountain'].map((id) => list.find((m) => m.id === id)).filter(Boolean);
  tour.stops = [...valleyStops, ...festStops, { id: 'finale', kind: 'finale', label: 'Fireworks finale', jp: '火', accent: '#ff8a3d', scene: 'festival' }];
  const item = (st, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.dataset.id = st.id;
    b.className = st.kind === 'project' ? '' : 'special';
    b.style.setProperty('--accent', st.accent || '#f2c14e');
    b.innerHTML = `<i></i><span>${esc(st.kind === 'project' ? st.label : `${st.jp} ${st.label}`)}</span>`;
    b.title = st.label;
    b.addEventListener('click', () => { $('#welcome').hidden = true; startTour(i); });
    li.appendChild(b);
    return li;
  };
  tour.stops.forEach((st, i) => $(st.scene === 'valley' ? '#rail-valley' : '#rail-fest').appendChild(item(st, i)));
}
function stopContent(st) {
  const shotText = {
    'shot-street': ['作 · Works street', 'My projects, for sale', 'Every stall on this street carries one of my projects on its banner, and the crowd is browsing them. Scroll to zoom in, then click any stall to open it.', () => PANELS.works(), 'All works'],
    'shot-lake': ['灯 · Lantern lake', 'River lanterns', 'Floating river lanterns, painted pleasure boats and little rowboats drift across the lake. Scroll toward anything to zoom in, and right-drag to pan.'],
    'shot-pagoda': ['塔 · Pagoda hill', 'The five-story pagoda', 'It watches over the festival from the hill above the lake. Drag to orbit around it.'],
    'shot-mountain': ['雪 · Snow mountain', 'The snow mountain', 'Snow-capped and moonlit. Zoom out with the scroll wheel to see the whole lake beneath it.'],
  };
  switch (st.kind) {
    case 'about': return ['己 · Who I am', PROFILE.name, firstSentences(PROFILE.intro, 260), () => PANELS.about(), 'Read my story'];
    case 'project': return [`作 · ${st.project.tagline}`, st.project.name, firstSentences(st.project.description), () => openProject(st.project.id), 'Open project'];
    case 'skills': return ['技 · Skills', 'Temple of skills', `Visitors hang red wish plaques here; mine carry my skills: ${SKILLS.filter((x) => x.level >= 4).map((x) => x.name).join(', ')}.`, () => PANELS.skills(), 'All skills'];
    case 'journey': return ['道 · Journey', 'The archway of my journey', JOURNEY.slice(0, 3).map((j) => `${j.when}: ${j.title}`).join(' · '), () => PANELS.journey(), 'Full timeline'];
    case 'festival': return ['火 · Onward', 'To the festival', 'The river ends at a lantern festival beneath the snow mountain, where my work is on display along the street. Press Next to cross over.'];
    case 'shot': return shotText[st.id];
    case 'finale': return ['火 · Finale', 'Thanks for visiting!', 'Enjoy the fireworks. Click anywhere in the sky to launch your own fireworks, or browse the menu at the top for everything in one place.', () => PANELS.about(), 'Get in touch'];
  }
  return ['', st.label, ''];
}
let finaleTimer;
function goStop(i) {
  tour.i = Math.max(0, Math.min(tour.stops.length - 1, i));
  const st = tour.stops[tour.i];
  clearTimeout(finaleTimer);
  if (st.kind === 'finale') { world.goShot('overview'); finaleTimer = setTimeout(() => world.finale(), 2600); }
  else world.focusMarker(st.id);
  const [kicker, title, text, more, moreLabel] = stopContent(st);
  const card = $('#tour');
  card.style.setProperty('--accent', st.accent || '#c8372d');
  $('#tour-step').textContent = `STOP ${tour.i + 1} OF ${tour.stops.length}`;
  $('#tour-kicker').textContent = kicker;
  $('#tour-title').textContent = title;
  $('#tour-text').textContent = text;
  const moreBtn = $('#tour-more');
  moreBtn.hidden = !more;
  moreBtn.textContent = moreLabel || 'Read more';
  moreBtn.onclick = more || null;
  $('#tour-prev').disabled = tour.i === 0;
  $('#tour-next').textContent = tour.i === tour.stops.length - 1 ? 'Finish ✓' : 'Next →';
  $('#tour-fill').style.width = `${((tour.i + 1) / tour.stops.length) * 100}%`;
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  $$('.rail li button').forEach((b) => b.classList.toggle('current', b.dataset.id === st.id));
  $(`.rail button[data-id="${st.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function startTour(i = 0) {
  tour.active = true;
  document.body.classList.add('touring');
  $('#tour').hidden = false;
  $('#hint').hidden = true;
  if (!$('#scroll').hidden) { scroll.hidden = true; scrim.hidden = true; }
  goStop(i);
}
function endTour() {
  tour.active = false;
  document.body.classList.remove('touring');
  $('#tour').hidden = true;
  clearTimeout(finaleTimer);
  $$('.rail li button').forEach((b) => b.classList.remove('current'));
  world?.clearFocus();
}
$('#tour-prev').addEventListener('click', () => goStop(tour.i - 1));
$('#tour-next').addEventListener('click', () => (tour.i === tour.stops.length - 1 ? endTour() : goStop(tour.i + 1)));
$('#tour-end').addEventListener('click', endTour);

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (e.key === 'Escape') { if (!scroll.hidden) closePanel(); else if (tour.active) endTour(); }
  if (tour.active && scroll.hidden && e.key === 'ArrowRight') $('#tour-next').click();
  if (tour.active && scroll.hidden && e.key === 'ArrowLeft') goStop(tour.i - 1);
  if (!world || !$('#loader').classList.contains('gone')) return;
  if (e.key === 'v' || e.key === 'V') world.cycleView();
  if (e.key === '1') world.setView('valley');
  if (e.key === '2') world.setView('boat');
  if (e.key === '3') world.setView('festival');
});

// ─── panel (hanging scroll) ─────────────────────────────────
const scroll = $('#scroll'), scrim = $('#scrim'), body = $('#scroll-body');
let current = null;
function openPanel(name, html) {
  current = name;
  body.innerHTML = html;
  body.scrollTop = 0;
  scroll.hidden = false;
  scrim.hidden = false;
  const paper = $('.scroll-paper');
  paper.style.animation = 'none';
  void paper.offsetWidth;
  paper.style.animation = '';
  $$('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.panel === name));
  tooltip.classList.remove('show');
}
function closePanel() {
  if (scroll.hidden) return;
  scroll.hidden = true;
  scrim.hidden = true;
  current = null;
  $$('.nav button').forEach((b) => b.classList.remove('active'));
  if (!tour.active) world?.clearFocus();
}
$('#scroll-close').addEventListener('click', closePanel);
scrim.addEventListener('click', closePanel);
$$('.nav button').forEach((b) => b.addEventListener('click', () => PANELS[b.dataset.panel]()));
$('#brand-btn').addEventListener('click', () => PANELS.about());

const PANELS = {
  about() {
    openPanel('about', `
      <p class="p-kicker">关于我 · ABOUT</p>
      <div class="about-grid" style="margin-top:1rem">
        <img class="avatar" src="https://avatars.githubusercontent.com/u/143157126?v=4" alt="${esc(PROFILE.name)}'s avatar" />
        <div>
          <h2 class="p-title">${esc(PROFILE.name)}</h2>
          <p style="margin:0;font-family:var(--serif);letter-spacing:.08em">${esc(PROFILE.subtitle)}</p>
          ${(PROFILE.about || [PROFILE.intro]).map((t) => `<p class="p-lead">${esc(t)}</p>`).join('')}
          ${PROFILE.facts ? `<dl class="facts">${PROFILE.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
          <div class="stats" id="gh-stats">
            <div class="stat"><b>${PROJECTS.length}</b><span>FEATURED WORKS</span></div>
            <div class="stat"><b id="gh-repos">–</b><span>PUBLIC REPOS</span></div>
            <div class="stat"><b>${SKILLS.length}</b><span>SKILLS</span></div>
          </div>
          <div class="links">
            ${PROFILE.links.map((l, i) => `<a class="btn ${i === 0 ? 'primary' : ''}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}
            <button class="btn" data-go="works">See my works</button>
          </div>
        </div>
      </div>
      <div class="brush-rule"></div>
      <p class="p-kicker">关于本站 · ABOUT THIS SITE</p>
      <p class="p-lead">Everything here is drawn in real time with Three.js and hand-written GLSL: a procedurally carved river valley, planar water reflections with a boat wake and drifting petals, cel-lit cherry and cedar forests, a Kuwahara brush-stroke filter with ink edges, bloom, colour grading on rice paper, and GPU fireworks over a snow mountain. Settings let you tune all of it.</p>
    `);
    $('[data-go="works"]').addEventListener('click', () => PANELS.works());
    github.profile().then((u) => { if (u && $('#gh-repos')) $('#gh-repos').textContent = u.public_repos; });
  },

  works(filter = 'all') {
    const list = PROJECTS.filter((p) => filter === 'all' || p.category === filter);
    const catLabel = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
    const count = (id) => (id === 'all' ? PROJECTS.length : PROJECTS.filter((p) => p.category === id).length);
    const actions = (p) => `
      <div class="card-actions">
        <button class="mini primary" data-open="${p.id}">Details</button>
        ${p.repo ? `<a class="mini" href="${esc(p.repo)}" target="_blank" rel="noopener">Code ↗</a>` : ''}
        ${p.demo ? `<a class="mini" href="${esc(p.demo)}" target="_blank" rel="noopener">${p.demo.startsWith('http') ? 'Live demo' : 'Open'} ↗</a>` : ''}
      </div>`;
    const card = (p) => `
      <article class="card" data-id="${p.id}" style="--accent:${accentOf(p)}">
        <p class="card-meta">${esc(catLabel[p.category] || '')}${p.when ? ` · ${esc(p.when)}` : ''}</p>
        <h3>${esc(p.name)}</h3>
        <p class="tagline">${esc(p.tagline)}</p>
        <p class="desc">${esc(p.summary || p.description)}</p>
        <div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        ${actions(p)}
      </article>`;
    const row = (p) => `
      <article class="work-row" data-id="${p.id}" style="--accent:${accentOf(p)}">
        <span class="work-dot"></span>
        <div class="work-main">
          <h3>${esc(p.name)} <small>${esc(p.tagline)}</small></h3>
          <p>${esc(p.summary || p.description)}</p>
        </div>
        <span class="work-when">${esc(p.when || '')}</span>
        ${actions(p)}
      </article>`;
    const featured = list.filter((p) => p.featured);
    const rest = list.filter((p) => !p.featured);
    openPanel('works', `
      <p class="p-kicker">作品 · WORKS</p>
      <h2 class="p-title">Things I've made</h2>
      <p class="p-lead">Each project is also a stone lantern on the riverbank and a stall at the festival. Click <b>Details</b> for the full story, or jump straight to the code or live demo.</p>
      <div class="filters">${CATEGORIES.map((c) => `<button data-f="${c.id}" class="${c.id === filter ? 'active' : ''}">${esc(c.label)} <span>${count(c.id)}</span></button>`).join('')}</div>
      ${filter === 'all' ? `
        <h3 class="works-sec">Featured</h3>
        <div class="cards">${featured.map(card).join('')}</div>
        <h3 class="works-sec">More projects</h3>
        <div class="work-list">${rest.map(row).join('')}</div>` : `
        <div class="cards">${list.map(card).join('')}</div>`}
      <div class="more-repos">
        <p class="p-kicker">GITHUB · LIVE</p>
        <div id="repo-list"><p class="p-lead">Fetching repositories…</p></div>
        <p style="margin-top:1rem"><a class="btn primary" href="${esc(PROFILE.github)}" target="_blank" rel="noopener">Visit my GitHub ↗</a></p>
      </div>
    `);
    $$('.filters button').forEach((b) => b.addEventListener('click', () => PANELS.works(b.dataset.f)));
    $$('.card, .work-row').forEach((c) => c.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; // Code / demo links open in a new tab
      openProject(c.dataset.id, { fly: true });
    }));
    github.repos().then((repos) => {
      const el = $('#repo-list');
      if (!el) return;
      if (!repos) { el.innerHTML = `<p class="p-lead">Couldn't reach GitHub right now. Everything is on <a href="${esc(PROFILE.github)}">my profile</a>.</p>`; return; }
      el.innerHTML = repos.map((r) => `
        <a class="repo-row" href="${esc(r.html_url)}" target="_blank" rel="noopener">
          <strong>${esc(r.name)}</strong><span>${esc(r.description || (r.fork ? 'Fork' : ''))}</span>
          <em>${esc(r.language || '')}${r.stargazers_count ? ` · ★ ${r.stargazers_count}` : ''} · ${new Date(r.pushed_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</em>
        </a>`).join('');
    });
  },

  skills() {
    const byId = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
    const petal = (s) => {
      const r = 2.2 + s.level * 0.45;
      const petals = Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return `<ellipse cx="${(Math.cos(a) * r * 0.55).toFixed(2)}" cy="${(Math.sin(a) * r * 0.55).toFixed(2)}" rx="${(r * 0.5).toFixed(2)}" ry="${(r * 0.36).toFixed(2)}" transform="rotate(${(a * 180) / Math.PI + 90} ${(Math.cos(a) * r * 0.55).toFixed(2)} ${(Math.sin(a) * r * 0.55).toFixed(2)})" fill="${s.level >= 5 ? '#f08aa8' : s.level >= 4 ? '#f6b2c6' : '#fbd3df'}" stroke="#c76a88" stroke-width=".25"/>`;
      }).join('');
      return `<g class="blossom" data-id="${s.id}" transform="translate(${s.x} ${s.y * 0.62})">${petals}<circle r="${(r * 0.22).toFixed(2)}" fill="#e3a63a"/><text y="${(r + 3.2).toFixed(2)}" text-anchor="middle">${esc(s.name)}</text></g>`;
    };
    openPanel('skills', `
      <p class="p-kicker">技 · SKILLS</p>
      <h2 class="p-title">A branch in bloom</h2>
      <p class="p-lead">Bigger, deeper-pink blossoms are the tools I reach for most. Hover or tap one for details.</p>
      <svg class="branch" viewBox="0 -6 100 70" role="img" aria-label="Skills drawn as blossoms on a branch">
        ${SKILL_LINKS.map(([a, b], i) => {
          const A = byId[a], B = byId[b];
          const mx = (A.x + B.x) / 2 + (i % 2 ? 3 : -3), my = ((A.y + B.y) / 2) * 0.62 + (i % 2 ? -2 : 2);
          return `<path class="stroke" d="M${A.x} ${A.y * 0.62} Q${mx} ${my} ${B.x} ${B.y * 0.62}" stroke-width="${(0.9 - (i % 4) * 0.12).toFixed(2)}" opacity=".8"/>`;
        }).join('')}
        ${SKILLS.map(petal).join('')}
      </svg>
      <div class="skill-note" id="skill-note"><h4>Hover a blossom</h4><p>Each one is a skill, and the branches show how they connect.</p></div>
    `);
    $$('.blossom').forEach((g) => {
      const show = () => {
        const s = byId[g.dataset.id];
        $$('.blossom').forEach((x) => x.classList.toggle('on', x === g));
        $('#skill-note').innerHTML = `<h4>${esc(s.name)} <span class="pips">${'●'.repeat(s.level)}${'○'.repeat(5 - s.level)}</span></h4><p>${esc(s.note)}</p>`;
      };
      g.addEventListener('mouseenter', show);
      g.addEventListener('click', show);
    });
  },

  journey() {
    openPanel('journey', `
      <p class="p-kicker">道 · JOURNEY</p>
      <h2 class="p-title">The road so far</h2>
      <div class="timeline">
        ${JOURNEY.map((j) => `<div class="tl-item"><time>${esc(j.when)}</time><h4>${esc(j.title)}</h4><p>${esc(j.text)}</p></div>`).join('')}
      </div>
    `);
  },

  settings() {
    openPanel('settings', settingsHTML());
    bindSettings();
  },
};

function openProject(id, { fly = false } = {}) {
  const p = PROJECTS.find((x) => x.id === id);
  if (!p) return;
  if (fly) world?.focusProject(id);
  const canEmbed = p.demo && p.embeddable !== false;
  openPanel('project', `
    <button class="back" id="back">← All works</button>
    <div class="detail-head" style="--accent:${accentOf(p)}">
      <div class="detail-seal">${esc(p.name[0])}</div>
      <div>
        <p class="p-kicker" style="color:${accentOf(p)}">${esc(ACCENTS[p.accent]?.name || '')}</p>
        <h2 class="p-title" style="margin:0">${esc(p.name)}</h2>
        <p style="margin:.2rem 0 0;color:var(--ink-soft)">${esc(p.tagline)}</p>
      </div>
    </div>
    <div class="brush-rule"></div>
    <p class="p-lead">${esc(p.description)}</p>
    <div class="tags" style="margin-top:1rem">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="detail-actions">
      ${p.repo ? `<a class="btn primary" href="${esc(p.repo)}" target="_blank" rel="noopener">View code ↗</a>` : '<span class="btn" aria-disabled="true">Code is private (coursework)</span>'}
      ${p.demo ? `<a class="btn" href="${esc(p.demo)}" target="_blank" rel="noopener">Live demo ↗</a>` : ''}
      ${(p.links || []).map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}
      <button class="btn" id="show-in-world">Show in the world</button>
    </div>
    ${canEmbed ? `<div class="demo-frame" id="demo-frame"><button class="demo-load" id="demo-load"><span>▶ Load live preview</span><small style="font-family:var(--sans);font-size:.75rem;color:var(--ink-soft)">${esc(p.demo)}</small></button></div>` : ''}
  `);
  $('#back').addEventListener('click', () => { world?.clearFocus(); PANELS.works(); });
  $('#show-in-world').addEventListener('click', () => {
    scroll.hidden = true; scrim.hidden = true; current = null;
    if (!world?.focusProject(id)) showHint('This lantern lives in the other scene. Switch views to find it.');
  });
  $('#demo-load')?.addEventListener('click', () => {
    $('#demo-frame').innerHTML = `<iframe src="${esc(p.demo)}" title="${esc(p.name)} live demo" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
  });
}

// ─── GitHub (cached) ────────────────────────────────────────
const github = (() => {
  let prof, rep;
  const get = async (url) => {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  };
  return {
    profile: () => (prof ??= get(`https://api.github.com/users/${PROFILE.handle}`)),
    repos: () => (rep ??= get(`https://api.github.com/users/${PROFILE.handle}/repos?per_page=100&sort=pushed`)),
  };
})();

// ─── settings ───────────────────────────────────────────────
const DEFAULTS = {
  preset: 'painterly',
  tod: 'afternoon',
  bloomStrength: 0.7, bloomRadius: 0.6, bloomThreshold: 0.85,
  brush: 0, ink: 0.22,
  exposure: 1.0, saturation: 1.1, contrast: 1.1,
  shadowTint: '#3a5f8f', highlightTint: '#ffd2a1', tintAmount: 0.25,
  vignette: 0.38, paper: 0.25,
  petals: true, mist: true, fireworks: true, autoRotate: true,
  renderScale: Math.min(window.devicePixelRatio || 1, 2), reflection: 0.75,
};
const PRESETS = {
  painterly: {},
  ukiyoe: { brush: 2, ink: 0.7, saturation: 0.85, contrast: 1.18, paper: 0.9, tintAmount: 0.35, shadowTint: '#2c3e66', highlightTint: '#f6dcae', bloomStrength: 0.45, vignette: 0.5 },
  cinematic: { brush: 0, ink: 0.1, saturation: 1.12, contrast: 1.1, paper: 0.15, tintAmount: 0.38, shadowTint: '#1f6f86', highlightTint: '#ffbf7a', bloomStrength: 0.95, bloomRadius: 0.75, vignette: 0.55 },
  dreamy: { brush: 1, ink: 0.15, saturation: 0.95, contrast: 0.94, paper: 0.4, tintAmount: 0.3, shadowTint: '#7a5fa8', highlightTint: '#ffd0e0', bloomStrength: 1.3, bloomRadius: 0.9, bloomThreshold: 0.7, exposure: 1.1 },
};
let settings = { ...DEFAULTS, ...store.get('upstream.settings.v2', {}) };

function applySettings(s) {
  if (!world) return;
  world.setTimeOfDay(s.tod);
  world.setBloom({ strength: s.bloomStrength, radius: s.bloomRadius, threshold: s.bloomThreshold });
  world.setPainterly({ radius: s.brush, ink: s.ink });
  world.setGrade({ exposure: s.exposure, saturation: s.saturation, contrast: s.contrast, shadowTint: s.shadowTint, highlightTint: s.highlightTint, tintAmount: s.tintAmount, vignette: s.vignette, paper: s.paper });
  world.setLayer('petals', s.petals);
  world.setLayer('mist', s.mist);
  world.setFireworks(s.fireworks);
  world.setAutoRotate(s.autoRotate);
  world.setRenderScale(s.renderScale);
  world.setReflectionQuality(s.reflection);
}
function saveSettings() { store.set('upstream.settings.v2', settings); }

const SLIDERS = [
  ['Bloom', '光', [
    ['bloomStrength', 'Strength', 0, 3, 0.01], ['bloomRadius', 'Radius', 0, 1, 0.01], ['bloomThreshold', 'Threshold', 0, 2, 0.01],
  ]],
  ['Brushwork', '筆', [
    ['brush', 'Brush strokes', 0, 5, 1], ['ink', 'Ink outlines', 0, 1, 0.01], ['paper', 'Rice paper', 0, 1, 0.01],
  ]],
  ['Colour', '色', [
    ['exposure', 'Exposure', 0.3, 2.5, 0.01], ['saturation', 'Saturation', 0, 2, 0.01], ['contrast', 'Contrast', 0.6, 1.6, 0.01],
    ['tintAmount', 'Tint strength', 0, 1, 0.01], ['vignette', 'Vignette', 0, 1, 0.01],
  ]],
  ['Performance', '速', [
    ['renderScale', 'Max resolution', 0.5, 2, 0.05], ['reflection', 'Reflections', 0.2, 1, 0.05],
  ]],
];

function settingsHTML() {
  const s = settings;
  return `
    <p class="p-kicker">设置 · SETTINGS</p>
    <h2 class="p-title">Tune the painting</h2>
    <p class="p-lead">Change the look live. Your choices are remembered in this browser.</p>
    <div class="set-group" style="margin-top:1rem">
      <h4>Style <span>风格</span></h4>
      <div class="seg" id="presets">
        ${Object.keys(PRESETS).map((k) => `<button data-p="${k}" class="${s.preset === k ? 'active' : ''}">${{ painterly: 'Painterly', ukiyoe: 'Woodblock', cinematic: 'Cinematic', dreamy: 'Dreamy' }[k]}</button>`).join('')}
      </div>
    </div>
    <div class="set-group" style="margin-top:1.2rem">
      <h4>Valley light <span>時</span></h4>
      <div class="seg" id="tod">
        ${['morning', 'afternoon', 'dusk'].map((k) => `<button data-t="${k}" class="${s.tod === k ? 'active' : ''}">${{ morning: 'Morning 朝', afternoon: 'Afternoon 昼', dusk: 'Dusk 夕' }[k]}</button>`).join('')}
      </div>
    </div>
    <div class="set-grid">
      ${SLIDERS.map(([title, jp, rows]) => `
        <div class="set-group">
          <h4>${title} <span>${jp}</span></h4>
          ${rows.map(([key, label, min, max, step]) => `
            <label class="row"><span>${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}" /><output>${(+s[key]).toFixed(step < 1 ? 2 : 0)}</output></label>`).join('')}
          ${title === 'Colour' ? `
            <label class="row"><span>Shadow tint</span><input type="color" data-k="shadowTint" value="${s.shadowTint}" /><output></output></label>
            <label class="row"><span>Highlight tint</span><input type="color" data-k="highlightTint" value="${s.highlightTint}" /><output></output></label>` : ''}
        </div>`).join('')}
      <div class="set-group">
        <h4>World <span>境</span></h4>
        ${[['petals', 'Falling petals'], ['mist', 'Valley mist'], ['fireworks', 'Automatic fireworks'], ['autoRotate', 'Drift camera when idle']].map(([k, l]) => `
          <label class="toggle"><input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''} /> ${l}</label>`).join('')}
      </div>
    </div>
    <div class="set-foot"><button class="btn" id="reset-settings">Reset to defaults</button></div>
  `;
}

function bindSettings() {
  $$('#scroll-body input[type="range"]').forEach((inp) => inp.addEventListener('input', () => {
    const k = inp.dataset.k;
    settings[k] = parseFloat(inp.value);
    inp.nextElementSibling.textContent = (+inp.value).toFixed(parseFloat(inp.step) < 1 ? 2 : 0);
    settings.preset = 'custom';
    $$('#presets button').forEach((b) => b.classList.remove('active'));
    applyOne(k);
    saveSettings();
  }));
  $$('#scroll-body input[type="color"]').forEach((inp) => inp.addEventListener('input', () => {
    settings[inp.dataset.k] = inp.value;
    applyOne(inp.dataset.k);
    saveSettings();
  }));
  $$('#scroll-body input[type="checkbox"]').forEach((inp) => inp.addEventListener('change', () => {
    settings[inp.dataset.k] = inp.checked;
    applyOne(inp.dataset.k);
    saveSettings();
  }));
  $$('#presets button').forEach((b) => b.addEventListener('click', () => {
    const keep = { tod: settings.tod, petals: settings.petals, mist: settings.mist, fireworks: settings.fireworks, autoRotate: settings.autoRotate, renderScale: settings.renderScale, reflection: settings.reflection };
    settings = { ...DEFAULTS, ...PRESETS[b.dataset.p], ...keep, preset: b.dataset.p };
    applySettings(settings);
    saveSettings();
    PANELS.settings();
  }));
  $$('#tod button').forEach((b) => b.addEventListener('click', () => {
    settings.tod = b.dataset.t;
    world?.setTimeOfDay(settings.tod);
    $$('#tod button').forEach((x) => x.classList.toggle('active', x === b));
    saveSettings();
  }));
  $('#reset-settings').addEventListener('click', () => {
    settings = { ...DEFAULTS };
    applySettings(settings);
    saveSettings();
    PANELS.settings();
  });
}

function applyOne(k) {
  const s = settings;
  if (!world) return;
  if (k.startsWith('bloom')) world.setBloom({ strength: s.bloomStrength, radius: s.bloomRadius, threshold: s.bloomThreshold });
  else if (k === 'brush' || k === 'ink') world.setPainterly({ radius: s.brush, ink: s.ink });
  else if (['exposure', 'saturation', 'contrast', 'shadowTint', 'highlightTint', 'tintAmount', 'vignette', 'paper'].includes(k)) world.setGrade({ [k]: s[k] });
  else if (k === 'petals' || k === 'mist') world.setLayer(k, s[k]);
  else if (k === 'fireworks') world.setFireworks(s.fireworks);
  else if (k === 'autoRotate') world.setAutoRotate(s.autoRotate);
  else if (k === 'renderScale') world.setRenderScale(s.renderScale);
  else if (k === 'reflection') world.setReflectionQuality(s.reflection);
}

// ─── audio (synthesised: river, night ambience, firework booms) ─
const audio = (() => {
  let ctx = null, master = null, river = null, night = null, on = false, sceneName = 'valley';
  function noiseBuffer(sec, brown = false) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function loop(buf, freq, type, q = 0.7) {
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start();
    return g;
  }
  function fade(g, v) { if (g) g.gain.setTargetAtTime(v, ctx.currentTime, 0.8); }
  return {
    init() { /* created lazily on first toggle so autoplay rules are respected */ },
    toggle() {
      if (!ctx) {
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch { return false; }
        master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
        river = loop(noiseBuffer(4, true), 900, 'lowpass');
        night = loop(noiseBuffer(4, true), 380, 'lowpass');
      }
      on = !on;
      if (on) ctx.resume();
      master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.2);
      this.setScene(sceneName);
      return on;
    },
    setScene(name) {
      sceneName = name;
      if (!ctx) return;
      fade(river, on && name === 'valley' ? 0.32 : 0);
      fade(night, on && name === 'festival' ? 0.18 : 0);
    },
    boom(dist = 600, type = 'kiku') {
      if (!ctx || !on) return;
      const delay = Math.min(dist / 343, 2.2);
      const t0 = ctx.currentTime + delay;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(2.5);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t0); f.frequency.exponentialRampToValueAtTime(90, t0 + 1.6);
      const g = ctx.createGain();
      const vol = Math.min(1, 380 / dist) * 0.9;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.2);
      src.connect(f).connect(g).connect(master);
      src.start(t0);
      if (type === 'shidare' || type === 'kamuro') {
        // glitter crackle
        for (let i = 0; i < 26; i++) {
          const tt = t0 + 0.6 + Math.random() * 2.4;
          const s2 = ctx.createBufferSource(); s2.buffer = noiseBuffer(0.03);
          const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
          const g2 = ctx.createGain(); g2.gain.value = vol * 0.25 * Math.random();
          s2.connect(hp).connect(g2).connect(master); s2.start(tt);
        }
      }
    },
  };
})();

boot();
