// Work portfolio page (work.html). All content comes from data.js.
import { PROFILE, ACCENTS, PROJECTS, CATEGORIES, SKILLS, JOURNEY } from './data.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ext = (url) => /^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '';
const accent = (p) => (ACCENTS[p.accent] || ACCENTS.zhu).color;

// ─── hero ────────────────────────────────────────────
$('#hero-name').textContent = PROFILE.name;
$('#hero-sub').textContent = PROFILE.subtitle;
$('#hero-lead').textContent = PROFILE.about[1] ? `${PROFILE.about[0]} ${PROFILE.about[1].split('. ')[0]}.` : PROFILE.intro;
$('#facts').innerHTML = PROFILE.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
$('#hero-github').href = PROFILE.github;
$('#year').textContent = new Date().getFullYear();

// ─── projects ────────────────────────────────────────
function links(p) {
  const out = [];
  if (p.demo) out.push(`<a class="btn small primary" href="${esc(p.demo)}"${ext(p.demo)}>${p.id === 'cs180' ? 'Read the write-ups' : 'Live demo'} ↗</a>`);
  if (p.repo) out.push(`<a class="btn small" href="${esc(p.repo)}"${ext(p.repo)}>Code ↗</a>`);
  for (const l of p.links || []) out.push(`<a class="btn small ghost" href="${esc(l.url)}"${ext(l.url)}>${esc(l.label)}</a>`);
  return out.join('');
}
const tags = (p) => `<ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || {}).label || id;

$('#featured').innerHTML = PROJECTS.filter((p) => p.featured).map((p, i) => `
  <article class="case" style="--accent:${accent(p)}">
    <div class="case-side">
      <span class="case-idx">${String(i + 1).padStart(2, '0')}</span>
      <span class="case-cat">${esc(catLabel(p.category))}</span>
      <span class="case-when">${esc(p.when)}</span>
    </div>
    <div class="case-body">
      <h3>${esc(p.name)}</h3>
      <p class="tagline">${esc(p.tagline)}</p>
      <p class="summary">${esc(p.summary)}</p>
      <p class="desc">${esc(p.description)}</p>
      ${tags(p)}
      <div class="actions">${links(p)}</div>
    </div>
  </article>`).join('');

const used = new Set(PROJECTS.map((p) => p.category));
const cats = CATEGORIES.filter((c) => c.id === 'all' || used.has(c.id));
$('#filters').innerHTML = cats.map((c) =>
  `<button data-cat="${c.id}" aria-pressed="${c.id === 'all'}">${esc(c.label)}</button>`).join('');

function renderGrid(cat) {
  const list = PROJECTS.filter((p) => cat === 'all' || p.category === cat);
  $('#grid').innerHTML = list.map((p) => `
    <article class="card" style="--accent:${accent(p)}">
      <div class="card-top">
        <span class="card-cat">${esc(catLabel(p.category))}</span>
        <span class="card-when">${esc(p.when)}</span>
      </div>
      <h4>${esc(p.name)}</h4>
      <p class="tagline">${esc(p.tagline)}</p>
      <p class="summary">${esc(p.summary)}</p>
      <details>
        <summary>More detail</summary>
        <p>${esc(p.description)}</p>
      </details>
      ${tags(p)}
      <div class="actions">${links(p)}</div>
    </article>`).join('');
}
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  for (const x of $('#filters').children) x.setAttribute('aria-pressed', x === b);
  renderGrid(b.dataset.cat);
});
renderGrid('all');

// ─── skills, strongest first ─────────────────────────
$('#skills-list').innerHTML = [...SKILLS].sort((a, b) => b.level - a.level).map((s) => `
  <li>
    <div class="skill-top">
      <strong>${esc(s.name)}</strong>
      <span class="pips" role="img" aria-label="${s.level} out of 5">${'<i class="on"></i>'.repeat(s.level)}${'<i></i>'.repeat(5 - s.level)}</span>
    </div>
    <p>${esc(s.note)}</p>
  </li>`).join('');

// ─── journey ─────────────────────────────────────────
$('#timeline').innerHTML = JOURNEY.map((j) => `
  <li>
    <span class="t-when">${esc(j.when)}</span>
    <div><h4>${esc(j.title)}</h4><p>${esc(j.text)}</p></div>
  </li>`).join('');

// ─── contact ─────────────────────────────────────────
$('#contact-links').innerHTML = PROFILE.links.map((l) =>
  `<a class="btn" href="${esc(l.url)}"${ext(l.url)}>${esc(l.label)} ↗</a>`).join('');
