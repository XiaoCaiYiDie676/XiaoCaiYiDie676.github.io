// ─────────────────────────────────────────────────────────────
//  Everything you'd want to edit about the site lives here.
// ─────────────────────────────────────────────────────────────

export const PROFILE = {
  name: 'Yichen Cai',
  seal: 'YC',
  handle: 'XiaoCaiYiDie676',
  title: 'Builder · Prototyper · Bridge player',
  subtitle: 'MSIN @ Carnegie Mellon · CS @ UC Berkeley',
  // Short version: the intro screen and the notice board in the valley.
  intro:
    "I'm a master's student in Information Networking at Carnegie Mellon and a UC Berkeley Computer Science graduate. I love turning ideas into working prototypes, from Cal Hacks weekends to database engines. Ride the boat upstream: every lantern on the bank is one of my projects.",
  // Long version: the About panel. One string per paragraph.
  about: [
    "Hi, I'm Yichen! I'm currently a master's student at Carnegie Mellon University in the MS in Information Networking (MSIN) program. Before CMU, I graduated from UC Berkeley with a degree in Computer Science.",
    "I'm happiest when I'm building. I love prototyping: taking a rough idea and getting it to something people can actually click on, fast. Hackathons like Cal Hacks are my favourite place to do that. At Cal Hacks I built Bridge, a platform that pairs older adults with students for companionship, mentorship and affordable housing.",
    "Databases and systems are where I'm strongest. I built RookieDB, a relational database engine with B+ tree indices, join algorithms, a query optimizer, multigranularity locking and ARIES-style crash recovery, and I enjoy thinking about how data is stored, queried and kept consistent. Along the way I've also explored computer vision and diffusion models, benchmarks for AI agents, LLM post-training and algorithmic trading.",
    "Outside of code, I'm Chinese and I love playing bridge. It's a game of logic, probability, memory and partnership, which is a lot like building software with a good team. I'm always happy to chat about projects, internships and collaborations, or to make up a table for a game of bridge.",
  ],
  facts: [
    ['Now', 'MS in Information Networking, Carnegie Mellon University'],
    ['Before', 'Computer Science, UC Berkeley'],
    ['Strengths', 'Databases & systems · fast prototyping · full-stack web'],
    ['Off the clock', 'Bridge (the card game)'],
  ],
  github: 'https://github.com/XiaoCaiYiDie676',
  links: [
    { label: 'GitHub', url: 'https://github.com/XiaoCaiYiDie676' },
    { label: 'CS 180 projects', url: 'cs180/' },
    { label: 'Bridge (Cal Hacks)', url: 'https://bridge-connect.tech/' },
  ],
};

// Traditional Chinese colours. Each project picks one for its lantern, banner and card.
export const ACCENTS = {
  zhu:  { name: '朱 Zhū · vermilion', color: '#e8452c' },
  tao:  { name: '桃 Táo · peach blossom', color: '#ff8fb4' },
  jin:  { name: '金 Jīn · gold', color: '#f2b84b' },
  dian: { name: '靛 Diàn · indigo', color: '#4a78d8' },
  zhuq: { name: '竹 Zhú · bamboo green', color: '#8cbf4f' },
  zi:   { name: '紫 Zǐ · wisteria', color: '#a98bea' },
  qing: { name: '青 Qīng · jade water', color: '#4fc6d8' },
};

// Works. `repo` → "Code", `demo` → "Live demo" (+ embedded preview), `links` → extra buttons.
// `summary` is the one-liner shown on cards; `description` is the full text.
export const PROJECTS = [
  {
    id: 'bridge',
    name: 'Bridge',
    tagline: 'Cal Hacks prototype · Connecting generations',
    when: 'Fall 2025',
    accent: 'zhuq',
    featured: true,
    category: 'hackathon',
    tags: ['Cal Hacks', 'TypeScript', 'Next.js', 'Supabase', 'Speech / TTS'],
    summary: 'A platform pairing older adults with students for companionship, mentorship and affordable housing.',
    description:
      'The prototype I delivered at Cal Hacks: a platform that pairs older adults with students for companionship, mentorship and affordable housing, like a non-romantic Tinder for community. It has a 6-step onboarding wizard, a weighted matching algorithm (interests 40%, personality 30%, motivation 20%, location 10%) with compatibility breakdowns, real-time chat with conversation starters, an impact dashboard, a safety centre with report and block, and speech input plus text-to-speech for accessibility.',
    repo: 'https://github.com/XiaoCaiYiDie676/bridge',
    demo: 'https://bridge-connect.tech/',
  },
  {
    id: 'rookiedb',
    name: 'RookieDB',
    tagline: 'CS 186 · A relational database engine',
    when: 'Spring 2026',
    accent: 'dian',
    featured: true,
    category: 'systems',
    tags: ['Java', 'B+ Trees', 'Joins', 'Query Optimization', 'Locking', 'ARIES Recovery'],
    summary: 'A database engine with B+ tree indices, joins, a query optimizer, concurrency control and crash recovery.',
    description:
      'A relational database engine built over the semester: B+ tree indices, efficient join algorithms (block nested loop, sort-merge, grace hash), a System R style query optimizer, multigranularity locking for concurrent transactions, and ARIES-style write-ahead logging and crash recovery.',
    // Course code stays private, so there's no repo link.
  },
  {
    id: 'cs180',
    name: 'CS 180: Computer Vision',
    tagline: 'Five projects · UC Berkeley',
    when: 'Fall 2025',
    accent: 'zhu',
    featured: true,
    category: 'vision',
    tags: ['Python', 'PyTorch', 'NeRF', 'Diffusion', 'Homographies'],
    summary: 'Five write-ups, from colorizing century-old photos to training diffusion models from scratch.',
    description:
      'All five projects from CS 180 (Computer Vision and Computational Photography), collected in one site. 1: colorizing the Prokudin-Gorskii glass plates with pyramid alignment. 2: filters, frequencies, hybrid images and multi-resolution blending. 3: homographies and fully automatic panorama stitching with Harris corners, ANMS and RANSAC. 4: camera calibration and a Neural Radiance Field trained on Lego and on an object I scanned. 5: diffusion sampling, guidance, inpainting and visual anagrams, then my own denoising UNet and flow-matching models.',
    demo: 'cs180/',
    links: [
      { label: '1 · Colorization', url: 'cs180/project1.html' },
      { label: '2 · Filters', url: 'cs180/project2.html' },
      { label: '3 · Mosaics', url: 'cs180/project3.html' },
      { label: '4 · NeRF', url: 'cs180/project4.html' },
      { label: '5 · Diffusion', url: 'cs180/project5.html' },
    ],
  },
  {
    id: 'greenagent',
    name: 'Green-Agent Benchmark',
    tagline: 'Evaluating self-driving AI agents',
    when: 'Fall 2025',
    accent: 'zi',
    category: 'ai',
    tags: ['Agents', 'Autonomous Driving', 'KITTI', 'Remotion'],
    summary: 'An evaluator that scores self-driving agents on perception, prediction and planning.',
    description:
      'A "green agent" evaluator that scores self-driving "white agents" on perception, prediction and planning across scenarios such as pedestrian crossings, yellow lights, highway merges, adverse weather and emergency vehicles, with a leaderboard and automated reports. I also made its 3-minute demo video entirely in code with Remotion and React.',
    repo: 'https://github.com/XiaoCaiYiDie676/cs194',
    // bundled copy of the interactive slideshow from the cs194 repo (use ← → to navigate)
    demo: 'demos/green-agent/index.html',
    links: [{ label: 'Demo video source', url: 'https://github.com/XiaoCaiYiDie676/demo' }],
  },
  {
    id: 'slime',
    name: 'slime',
    tagline: 'LLM post-training · RL scaling',
    when: '2026',
    accent: 'qing',
    category: 'ai',
    tags: ['LLM', 'RL', 'Megatron', 'SGLang'],
    summary: 'Experiments with an LLM post-training framework for scaling reinforcement learning.',
    description:
      'Studying and experimenting with slime, an LLM post-training framework for scaling reinforcement learning (forked from THUDM).',
    repo: 'https://github.com/XiaoCaiYiDie676/slime',
    demo: 'https://thudm.github.io/slime',
    embeddable: false,
  },
  {
    id: 'imc',
    name: 'IMC Prosperity 2025',
    tagline: 'Algorithmic trading challenge',
    when: 'Spring 2025',
    accent: 'jin',
    category: 'quant',
    tags: ['Python', 'Market Making', 'Backtesting'],
    summary: 'Market-making and statistical-arbitrage strategies for a global trading competition.',
    description:
      'Trading algorithms and analysis for IMC Prosperity 2025, a global algorithmic trading competition: market-making, statistical arbitrage and strategy research across rounds.',
    repo: 'https://github.com/XiaoCaiYiDie676/imc-prosperity-2025',
  },
  {
    id: 'animetrade',
    name: 'AnimeKpop Trade',
    tagline: 'Community marketplace site',
    when: '2025',
    accent: 'tao',
    category: 'web',
    tags: ['HTML/CSS', 'JavaScript', 'REST API design'],
    summary: 'A marketplace concept where anime and K-pop fans trade merchandise.',
    description:
      'A landing page and marketplace concept where anime and K-pop fans trade merchandise and connect, plus a backend guide covering the server architecture, setup and API endpoints.',
    repo: 'https://github.com/XiaoCaiYiDie676/cyc.github.io',
  },
  {
    id: 'cubstart',
    name: 'Cubstart Web',
    tagline: 'CS 198 · Full-stack web development',
    when: 'Spring 2025',
    accent: 'tao',
    category: 'web',
    tags: ['JavaScript', 'HTML/CSS', 'Node'],
    summary: "Projects from Berkeley's full-stack web development DeCal.",
    description:
      "Assignments and projects from Cubstart, Berkeley's full-stack web development DeCal, built with HTML, CSS, JavaScript and Node/Express.",
    repo: 'https://github.com/XiaoCaiYiDie676/cs198-',
    demo: 'https://spring25.vercel.app',
  },
];

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'hackathon', label: 'Hackathons' },
  { id: 'systems', label: 'Databases & Systems' },
  { id: 'vision', label: 'Computer Vision' },
  { id: 'ai', label: 'AI / ML' },
  { id: 'web', label: 'Web' },
  { id: 'quant', label: 'Quant' },
];

// Skills drawn as blossoms on a branch. x/y are 0..100 in the chart; links connect them.
export const SKILLS = [
  { id: 'py',    name: 'Python',        x: 18, y: 30, level: 5, note: 'PyTorch, NumPy, data analysis, trading research' },
  { id: 'torch', name: 'PyTorch',       x: 34, y: 14, level: 4, note: 'UNets, diffusion, flow matching, NeRF' },
  { id: 'ml',    name: 'Generative AI', x: 52, y: 24, level: 4, note: 'Diffusion models, CFG, SDEdit, LLM post-training' },
  { id: 'ts',    name: 'TypeScript',    x: 70, y: 16, level: 4, note: 'Next.js, React, Remotion' },
  { id: 'react', name: 'React',         x: 84, y: 34, level: 4, note: 'Components, hooks, programmatic video' },
  { id: 'web',   name: 'HTML / CSS',    x: 72, y: 50, level: 5, note: 'Responsive layouts, this very site' },
  { id: 'three', name: 'Three.js',      x: 86, y: 66, level: 3, note: 'Shaders, post-processing, 3D scenes' },
  { id: 'java',  name: 'Java',          x: 22, y: 62, level: 4, note: 'RookieDB: indices, joins, concurrency, recovery' },
  { id: 'db',    name: 'Databases',     x: 38, y: 76, level: 5, note: 'SQL, B+ trees, query optimization, transactions, recovery, Supabase' },
  { id: 'quant', name: 'Quant',         x: 12, y: 84, level: 3, note: 'Market making, backtesting (IMC Prosperity)' },
  { id: 'node',  name: 'Node.js',       x: 58, y: 66, level: 3, note: 'Express, REST APIs' },
  { id: 'git',   name: 'Git',           x: 52, y: 90, level: 4, note: 'Branching, collaboration, CI' },
];
export const SKILL_LINKS = [
  ['py', 'torch'], ['torch', 'ml'], ['ml', 'ts'], ['ts', 'react'], ['react', 'web'],
  ['web', 'three'], ['py', 'java'], ['java', 'db'], ['db', 'quant'], ['py', 'quant'],
  ['db', 'node'], ['node', 'web'], ['db', 'git'], ['ml', 'web'],
];

// Newest first.
export const JOURNEY = [
  { when: 'Fall 2026', title: 'Carnegie Mellon: MS in Information Networking', text: 'Started my master\'s at CMU in the MSIN program.' },
  { when: 'Spring 2026', title: 'Graduated from UC Berkeley', text: 'Finished my Computer Science degree at Berkeley.' },
  { when: 'Spring 2026', title: 'CS 186: RookieDB', text: 'Built a database engine with indices, joins, an optimizer, locking and recovery.' },
  { when: 'Fall 2025', title: 'Cal Hacks: Bridge', text: 'Designed and shipped the Bridge prototype over a hackathon weekend: matching, chat, a dashboard, safety features and voice accessibility.' },
  { when: 'Fall 2025', title: 'CS 180: Computer Vision', text: 'Five projects, from colorization and panoramas to NeRF and diffusion models, each written up as a web report.' },
  { when: 'Fall 2025', title: 'Green-Agent Benchmark', text: 'Built an evaluator for self-driving agents and a code-generated demo video.' },
  { when: 'Spring 2025', title: 'IMC Prosperity 2025', text: 'Competed in a global algorithmic trading challenge and wrote market-making strategies in Python.' },
  { when: 'Spring 2025', title: 'Cubstart Web', text: 'Learned full-stack web development with HTML, CSS, JS and Node.' },
];
