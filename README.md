# Yichen Cai · Portfolio

**Live site: https://xiaocaiyidie676.github.io/**

I'm Yichen Cai, a master's student in Information Networking (MSIN) at Carnegie Mellon University and a UC Berkeley Computer Science graduate. I love prototyping, hackathons like Cal Hacks, and databases. Off the clock I play bridge.

This repo is my personal website: an interactive, painterly 3D portfolio built with Three.js and hand-written GLSL, with no build step.

- **Valley (溪):** a wooden riverboat is poled upstream through a blossom valley. Each stone lantern on the bank is a project.
- **Boat (舟):** ride on board and drag to look around.
- **Festival (火):** a lantern festival on a lake beneath a snow mountain. Click the sky to launch fireworks, or press *Grand finale*.

Switch views with the buttons at the bottom or the keys `V`, `1`, `2`, `3`. `Esc` closes panels.

### The voyage is the résumé

| Landmark | Where | Opens |
| --- | --- | --- |
| Notice board | river mouth | About |
| Stone lantern, one per project | along both banks | the project |
| Wish-plaque rack at the temple | left bank | Skills |
| Paifang archway standing in the water | upstream | Journey |
| Festival gate | end of the river | the festival scene |
| Works street (one stall per project, with crowds) | festival | the project |

## Work portfolio (plain page)

[`work.html`](https://xiaocaiyidie676.github.io/work.html) is a fast, scrollable, printable version of the portfolio for recruiters: featured case studies, all projects with category filters, skills, journey and contact. It renders from the same `js/data.js`, so it never drifts from the 3D site. Linked from the 3D site's top nav (册 Portfolio).

## CS 180 projects

[`cs180/`](https://xiaocaiyidie676.github.io/cs180/) collects all five of my CS 180 (Computer Vision and Computational Photography, UC Berkeley) write-ups in one site:

1. [Colorizing the Prokudin-Gorskii collection](https://xiaocaiyidie676.github.io/cs180/project1.html)
2. [Fun with filters and frequencies](https://xiaocaiyidie676.github.io/cs180/project2.html)
3. [Image warping and mosaicing](https://xiaocaiyidie676.github.io/cs180/project3.html)
4. [Neural radiance fields](https://xiaocaiyidie676.github.io/cs180/project4.html)
5. [Fun with diffusion models](https://xiaocaiyidie676.github.io/cs180/project5.html)

## Run locally

ES modules need a web server (opening the file directly won't work):

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Edit your content

Everything personal lives in `js/data.js`: profile, about-me paragraphs, links, projects (with repo/demo links), skills and journey.
Add a project there and it appears in the Works panel, as a lantern in the valley and as a stall at the festival.

## Structure

```
work.html             plain work portfolio page (css/work.css, js/work.js)
index.html            HUD + panels markup, SEO tags, import map (three@0.160.0 from jsDelivr)
css/style.css         rice-paper / ink UI
js/main.js            UI, panels, settings presets, synthesized audio
js/data.js            your content
js/world/common.js    shared shaders: sky, painterly terrain, foliage, water, mist, petals, lanterns
js/world/valley.js    river valley, boat + poling boatman, bridge, paifang, mill, temple
js/world/festival.js  snow mountain, pagoda, stalls, red lanterns, floating lanterns, GPU fireworks
js/world/world.js     renderer, Kuwahara brush + ink pass, bloom, grading, ink-wash transitions, cameras
demos/green-agent/    bundled Green-Agent Benchmark slideshow (from the cs194 repo)
cs180/                CS 180 project site (hub + five project pages)
```
