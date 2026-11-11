/* ============================================================
   LumeKids — Jardim de Luz
   A cozy little night-garden game for small explorers.
   Vanilla canvas 2D, no dependencies.
   ============================================================ */
(function () {
  'use strict';

  const W = 1280;
  const H = 720;
  const TAU = Math.PI * 2;

  const LEVELS = [
    {
      name: 'O primeiro brilho',
      seeds: 8,
      fog: 0,
      fogSpeed: 0,
      drain: 1.9,
      spawnEvery: 1.15,
      tip: 'Arraste com o dedo, mova o mouse ou use as setas para guiar a Lumi.'
    },
    {
      name: 'A clareira',
      seeds: 10,
      fog: 1,
      fogSpeed: 34,
      drain: 2.4,
      spawnEvery: 1.05,
      tip: 'Cada semente enche um pouco da lanterna. Não deixe a luz acabar!'
    },
    {
      name: 'Bruminhas curiosas',
      seeds: 12,
      fog: 2,
      fogSpeed: 42,
      drain: 2.8,
      spawnEvery: 0.95,
      tip: 'As bruminhas tiram luz quando encostam. Desvie com carinho.'
    },
    {
      name: 'Vale das flores',
      seeds: 14,
      fog: 3,
      fogSpeed: 48,
      drain: 3.2,
      spawnEvery: 0.9,
      tip: 'Estrelas douradas enchem a lanterna e espantam a névoa por um instante.'
    },
    {
      name: 'Noite estrelada',
      seeds: 16,
      fog: 4,
      fogSpeed: 54,
      drain: 3.6,
      spawnEvery: 0.85,
      tip: 'Colete rápido para fazer combos: cada sequência vale mais pontos!'
    },
    {
      name: 'O grande festival',
      seeds: 20,
      fog: 5,
      fogSpeed: 60,
      drain: 4.0,
      spawnEvery: 0.8,
      tip: 'Última fase! Mostre todo o seu brilho e faça o jardim florescer.'
    }
  ];

  const FLOWER_COLORS = ['#ffb3d9', '#ffd86b', '#8ef2c6', '#b49bff', '#7fd8ff', '#ff9f7a'];
  const MUSHROOMS = [
    { x: 154, y: 0, s: 1 },
    { x: 402, y: 0, s: 0.72 },
    { x: 874, y: 0, s: 0.88 },
    { x: 1146, y: 0, s: 0.68 }
  ];

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function mulberry32(seed) {
    let a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const nearY = (x) => 600 - 24 * Math.sin(x * 0.0055 + 1.1) - 12 * Math.sin(x * 0.016 + 0.3);
  const midY = (x) => 522 - 28 * Math.sin(x * 0.006 + 2.1) - 11 * Math.sin(x * 0.019);
  const farY = (x) => 462 - 30 * Math.sin(x * 0.0045 + 0.6) - 13 * Math.sin(x * 0.012 + 2);

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // ---------- DOM ----------
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const overlay = document.getElementById('overlay');
  const hud = document.getElementById('hud');
  const comboEl = document.getElementById('combo');
  const lightChip = document.getElementById('lightChip');
  const lightFill = document.getElementById('lightFill');
  const lightMeter = document.getElementById('lightMeter');
  const levelTagEl = document.getElementById('levelTag');
  const seedCountEl = document.getElementById('seedCount');
  const seedTotalEl = document.getElementById('seedTotal');
  const scoreEl = document.getElementById('scoreVal');
  const muteBtn = document.getElementById('muteBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const helpBtn = document.getElementById('helpBtn');

  const sound = new window.LumeAudio();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- view ----------
  const view = { dpr: 1, scale: 1, ox: 0, oy: 0, w: 0, h: 0 };

  // ---------- game state ----------
  let state = 'title';
  let levelIndex = 0;
  let level = LEVELS[0];
  let goal = LEVELS[0].seeds;
  let light = 100;
  let score = 0;
  let shownScore = 0;
  let best = 0;
  let collected = 0;
  let combo = 0;
  let comboTimer = 0;
  let mult = 1;
  let invuln = 0;
  let shake = 0;
  let time = 0;
  let spawnTimer = 0;
  let starsGiven = 0;
  let runStars = [];
  let helpBack = null;

  try {
    best = Number(localStorage.getItem('lumekids.best')) || 0;
  } catch (_) { best = 0; }

  const lumi = {
    x: W / 2,
    y: H * 0.6,
    vx: 0,
    vy: 0,
    r: 29,
    tilt: 0,
    stun: 0,
    blink: 0,
    nextBlink: 2.4,
    trail: []
  };

  const seeds = [];
  const fogs = [];
  const particles = [];
  const rings = [];
  const floaters = [];
  const flowers = [];
  const decoSeeds = [];

  const pointer = { x: W / 2, y: H * 0.58, inside: false, active: false, touch: false, type: 'mouse' };

  // ---------- background data ----------
  const rng = mulberry32(20261111);

  const bgStars = Array.from({ length: 130 }, () => ({
    x: rng() * W,
    y: rng() * 440,
    r: 0.4 + rng() * 1.5,
    phase: rng() * TAU,
    speed: 0.5 + rng() * 1.4,
    warm: rng() < 0.22
  }));

  const fireflies = Array.from({ length: 46 }, () => ({
    x: rng() * W,
    y: 180 + rng() * 440,
    r: 1.1 + rng() * 1.7,
    phase: rng() * TAU,
    sp: 0.35 + rng() * 0.7,
    amp: 6 + rng() * 16,
    drift: -6 + rng() * 12,
    hue: rng() < 0.75 ? '255, 220, 120' : '170, 240, 210'
  }));

  const grass = Array.from({ length: 62 }, () => {
    const x = rng() * W;
    return {
      x,
      y: nearY(x) + 3,
      h: 5 + rng() * 11,
      phase: rng() * TAU,
      lean: -9 + rng() * 18,
      alpha: 0.1 + rng() * 0.14
    };
  });

  const bushes = Array.from({ length: 13 }, () => {
    const x = 20 + rng() * (W - 40);
    return {
      x,
      y: midY(x) + 4,
      r: 11 + rng() * 20,
      s: 0.55 + rng() * 0.5
    };
  });

  for (let i = 0; i < 16; i++) {
    const x = 58 + i * ((W - 116) / 15) + (rng() - 0.5) * 58;
    flowers.push({
      x,
      y: nearY(x) + 5,
      s: 0.82 + rng() * 0.5,
      stem: 28 + rng() * 17,
      color: FLOWER_COLORS[i % FLOWER_COLORS.length],
      phase: rng() * TAU,
      bloomed: false,
      bloom: 0
    });
  }

  MUSHROOMS.forEach((m) => { m.y = nearY(m.x) + 6; });

  for (let i = 0; i < 4; i++) {
    decoSeeds.push({
      x: 700 + rng() * 240,
      y: 210 + rng() * 300,
      r: 6 + rng() * 4,
      phase: rng() * TAU,
      vy: -4 - rng() * 7
    });
  }

  // ---------- cached gradients ----------
  let skyGrad = null;
  let horizonGlow = null;
  let groundGrad = null;
  let vignette = null;

  function buildStaticGradients() {
    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#0e0a28');
    skyGrad.addColorStop(0.28, '#1e1446');
    skyGrad.addColorStop(0.52, '#2b2158');
    skyGrad.addColorStop(0.74, '#173b4e');
    skyGrad.addColorStop(0.9, '#0d2c38');
    skyGrad.addColorStop(1, '#08202a');

    horizonGlow = ctx.createRadialGradient(W * 0.52, 540, 40, W * 0.52, 540, 660);
    horizonGlow.addColorStop(0, 'rgba(96, 190, 180, 0.22)');
    horizonGlow.addColorStop(0.45, 'rgba(70, 130, 170, 0.09)');
    horizonGlow.addColorStop(1, 'rgba(40, 60, 120, 0)');

    groundGrad = ctx.createLinearGradient(0, 560, 0, H);
    groundGrad.addColorStop(0, 'rgba(5, 22, 28, 0)');
    groundGrad.addColorStop(0.6, 'rgba(4, 18, 24, 0.9)');
    groundGrad.addColorStop(1, '#04121a');

    vignette = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.3, W / 2, H * 0.52, H * 0.92);
    vignette.addColorStop(0, 'rgba(2, 3, 12, 0)');
    vignette.addColorStop(0.7, 'rgba(2, 3, 12, 0.22)');
    vignette.addColorStop(1, 'rgba(1, 2, 9, 0.68)');
  }

  // ---------- view / resize ----------
  function resize() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(rect.width * dpr));
    const ch = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    view.w = rect.width;
    view.h = rect.height;
    view.dpr = dpr;
    view.scale = Math.min(rect.width / W, rect.height / H);
    view.ox = (rect.width - W * view.scale) / 2;
    view.oy = (rect.height - H * view.scale) / 2;
    document.documentElement.style.setProperty('--stage-w', Math.round(rect.width) + 'px');
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(stage);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  // ---------- HUD ----------
  let lastLightPct = -1;

  function updateHud() {
    const pct = Math.round(light);
    if (pct !== lastLightPct) {
      lastLightPct = pct;
      lightFill.style.transform = 'scaleX(' + Math.max(0, pct) / 100 + ')';
      lightMeter.setAttribute('aria-valuenow', String(pct));
      lightChip.classList.toggle('is-low', pct < 28);
      lightChip.classList.toggle('is-warn', pct >= 28 && pct < 52);
    }

    if (Math.abs(score - shownScore) > 0.6) {
      shownScore = lerp(shownScore, score, 0.18);
    } else if (shownScore !== score) {
      shownScore = score;
    }
    const displayScore = Math.round(shownScore);
    if (scoreEl.textContent !== String(displayScore)) scoreEl.textContent = String(displayScore);
  }

  function setLevelUI() {
    levelTagEl.textContent = 'Fase ' + (levelIndex + 1) + ' · ' + level.name;
    seedTotalEl.textContent = '/ ' + goal;
    seedCountEl.textContent = String(collected);
  }

  function setSeedCount() {
    seedCountEl.textContent = String(collected);
  }

  function syncMuteUI() {
    muteBtn.setAttribute('aria-pressed', sound.muted ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', sound.muted ? 'Ligar som' : 'Desligar som');
  }

  function setPauseEnabled(on) {
    pauseBtn.disabled = !on;
    pauseBtn.style.opacity = on ? '' : '0.4';
  }

  function toggleMute() {
    sound.setMuted(!sound.muted, true);
    syncMuteUI();
    if (!sound.muted) sound.click();
  }

  // ---------- combo ----------
  function updateComboUI() {
    if (mult > 1) {
      comboEl.textContent = 'x' + mult;
      comboEl.classList.add('is-on');
    } else {
      comboEl.classList.remove('is-on');
    }
  }

  function popCombo() {
    comboEl.classList.remove('is-pop');
    // restart CSS animation
    void comboEl.offsetWidth;
    comboEl.classList.add('is-pop');
  }

  // ---------- overlays ----------
  function bestMarkup() {
    return best > 0
      ? '<span class="best">Recorde: ' + best + '</span>'
      : '<span>Seu primeiro brilho</span>';
  }

  function levelCard() {
    return (
      '<div class="card card--intro">' +
      '<div class="level-badge">' + (levelIndex + 1) + '</div>' +
      '<span class="eyebrow">Fase ' + (levelIndex + 1) + ' de ' + LEVELS.length + '</span>' +
      '<h2>' + level.name + '</h2>' +
      '<p>Colete <strong>' + goal + ' sementes de luz</strong> e mantenha a lanterna acesa.</p>' +
      '<div class="tip"><span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.2 18h5.6M10.2 21h3.6"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.4 1 1.1 1 1.9v.3h5.2v-.3c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z"/></svg></span><span>' + level.tip + '</span></div>' +
      '<div class="card-actions"><button class="btn btn-primary" data-action="begin">Vamos lá</button></div>' +
      '</div>'
    );
  }

  function starsMarkup(n) {
    let html = '<div class="stars-row">';
    for (let i = 0; i < 3; i++) {
      html += '<span class="star' + (i < n ? ' is-on' : '') + '">★</span>';
    }
    return html + '</div>';
  }

  function screens(name) {
    if (name === 'title') {
      return (
        '<div class="card card--title">' +
        '<span class="eyebrow">Um jardim de luz para pequenos exploradores</span>' +
        '<h1 class="logo">Lume<span>Kids</span></h1>' +
        '<p class="tagline">Guie a <strong>Lumi</strong> pela noite, colete sementes de luz e faça o jardim florescer.</p>' +
        '<button class="btn btn-primary btn-lg" data-action="play"><span class="btn-spark">✦</span> Começar a brincar</button>' +
        '<div class="title-meta"><span>' + LEVELS.length + ' fases</span><span>·</span><span>~5 min</span><span>·</span>' + bestMarkup() + '</div>' +
        '<button class="link-btn" data-action="help">Como jogar</button>' +
        '</div>'
      );
    }

    if (name === 'intro') return levelCard();

    if (name === 'paused') {
      return (
        '<div class="card">' +
        '<span class="eyebrow">Um respiro</span>' +
        '<h2>Pausa</h2>' +
        '<p>Respire fundo. O jardim espera por você.</p>' +
        '<div class="card-actions">' +
        '<button class="btn btn-primary" data-action="resume">Continuar</button>' +
        '<button class="btn btn-ghost" data-action="restart">Recomeçar fase</button>' +
        '</div>' +
        '<button class="link-btn" data-action="menu">Voltar ao início</button>' +
        '</div>'
      );
    }

    if (name === 'levelComplete') {
      const stars = runStars[levelIndex] || 1;
      const bonus = Math.round(light) * 2;
      const last = levelIndex >= LEVELS.length - 1;
      const titles = ['Brilho suave', 'Que brilho!', 'Incrível!'];
      return (
        '<div class="card">' +
        '<span class="eyebrow">Fase ' + (levelIndex + 1) + ' concluída</span>' +
        '<h2>' + titles[stars - 1] + '</h2>' +
        starsMarkup(stars) +
        '<p>As flores agradecem. A noite ficou um pouquinho mais quente.</p>' +
        '<div class="result-grid">' +
        '<div class="result-item"><span>Pontos</span><b>' + score + '</b></div>' +
        '<div class="result-item"><span>Bônus de luz</span><b>+' + bonus + '</b></div>' +
        '<div class="result-item"><span>Sementes</span><b>' + goal + '</b></div>' +
        '</div>' +
        '<div class="card-actions">' +
        '<button class="btn btn-primary" data-action="' + (last ? 'victory' : 'next') + '">' + (last ? 'Ver o jardim' : 'Próxima fase') + '</button>' +
        '<button class="btn btn-ghost" data-action="menu">Menu</button>' +
        '</div>' +
        '</div>'
      );
    }

    if (name === 'lightOut') {
      return (
        '<div class="card">' +
        '<span class="eyebrow">Quase lá</span>' +
        '<h2>A luz apagou…</h2>' +
        '<p>As bruminhas são curiosas e adoram um brilho. Desvie delas e colete sementes para manter a lanterna cheia.</p>' +
        '<div class="result-grid">' +
        '<div class="result-item"><span>Pontos</span><b>' + score + '</b></div>' +
        '<div class="result-item"><span>Sementes</span><b>' + collected + ' / ' + goal + '</b></div>' +
        '</div>' +
        '<div class="card-actions">' +
        '<button class="btn btn-primary" data-action="retry">Tentar de novo</button>' +
        '<button class="btn btn-ghost" data-action="menu">Menu</button>' +
        '</div>' +
        '</div>'
      );
    }

    if (name === 'victory') {
      const totalStars = runStars.reduce((a, b) => a + (b || 0), 0);
      const bloomed = flowers.filter((f) => f.bloomed).length;
      return (
        '<div class="card">' +
        '<span class="eyebrow">Fim da jornada</span>' +
        '<h2>O jardim floresceu!</h2>' +
        '<p>Você acendeu <strong>' + bloomed + ' flores</strong> e encheu a noite de luz. A Lumi está muito orgulhosa de você.</p>' +
        '<div class="result-grid">' +
        '<div class="result-item"><span>Pontuação</span><b>' + score + '</b></div>' +
        '<div class="result-item"><span>Estrelas</span><b>' + totalStars + ' / ' + LEVELS.length * 3 + '</b></div>' +
        '<div class="result-item"><span>Flores</span><b>' + bloomed + '</b></div>' +
        '</div>' +
        '<div class="card-actions">' +
        '<button class="btn btn-primary" data-action="replay">Jogar de novo</button>' +
        '<button class="btn btn-ghost" data-action="menu">Menu</button>' +
        '</div>' +
        '</div>'
      );
    }

    if (name === 'help') {
      return (
        '<div class="card card--help">' +
        '<span class="eyebrow">Bem-vindo ao jardim</span>' +
        '<h2>Como jogar</h2>' +
        '<div class="help-grid">' +
        '<div class="help-item"><span class="help-icon icon-move"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/><path d="M12 3.4v3.4M12 17.2v3.4M3.4 12h3.4M17.2 12h3.4M9.6 6.1L12 3.7l2.4 2.4M9.6 17.9l2.4 2.4 2.4-2.4M6.1 9.6l-2.4 2.4 2.4 2.4M17.9 9.6l2.4 2.4-2.4 2.4"/></svg></span><div><b>Mova a Lumi</b><span>Arraste com o dedo, mova o mouse ou use as setas.</span></div></div>' +
        '<div class="help-item"><span class="help-icon icon-seed"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5.3" fill="currentColor"/><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 2.8v2.7M12 18.5v2.7M2.8 12h2.7M18.5 12h2.7"/></g></svg></span><div><b>Colete sementes</b><span>Cada semente enche a lanterna e acende uma flor.</span></div></div>' +
        '<div class="help-item"><span class="help-icon icon-fog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.4 16.6a3.6 3.6 0 0 1-.3-7.2 4.8 4.8 0 0 1 9.1-1.2 3.5 3.5 0 0 1 .5 6.9"/><path d="M8.2 19.4h7.6M9.8 21.6h4.4"/><circle cx="10" cy="13.2" r=".65" fill="currentColor" stroke="none"/><circle cx="14" cy="13.2" r=".65" fill="currentColor" stroke="none"/></svg></span><div><b>Desvie das bruminhas</b><span>Elas são curiosas e roubam um pouco da sua luz.</span></div></div>' +
        '</div>' +
        '<p class="help-note">Dica: as estrelas douradas enchem a lanterna e espantam a névoa. Faça combos coletando rápido!</p>' +
        '<div class="card-actions"><button class="btn btn-primary" data-action="close-help">Entendi</button></div>' +
        '</div>'
      );
    }

    return '';
  }

  function showScreen(name) {
    overlay.innerHTML = screens(name);
    overlay.dataset.screen = name;
    overlay.classList.add('is-open');
    document.body.classList.add('overlay-open');
    const primary = overlay.querySelector('.btn-primary');
    if (primary) {
      setTimeout(() => {
        try { primary.focus({ preventScroll: true }); } catch (_) { primary.focus(); }
      }, 60);
    }
    if (name === 'levelComplete') {
      setTimeout(() => {
        const row = overlay.querySelector('.stars-row');
        if (row) row.classList.add('is-on');
      }, 120);
    }
  }

  function hideScreen() {
    overlay.classList.remove('is-open');
    overlay.dataset.screen = '';
    document.body.classList.remove('overlay-open');
  }

  // ---------- level flow ----------
  function spawnSeed(initial) {
    const r = rand(9.5, 12.5);
    seeds.push({
      kind: 'seed',
      x: rand(92, W - 92),
      y: initial ? rand(170, H - 180) : rand(-90, -30),
      vy: initial ? rand(8, 20) : rand(52, 86),
      r,
      phase: rand(0, TAU),
      spin: rand(1.2, 2.4)
    });
  }

  function spawnStar() {
    seeds.push({
      kind: 'star',
      x: rand(200, W - 200),
      y: rand(160, H - 230),
      r: 23,
      phase: rand(0, TAU),
      spin: 0.6,
      vy: 0,
      life: 14,
      maxLife: 14
    });
  }

  function spawnFog() {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = rand(120, W - 120);
      y = rand(170, H - 150);
      const d = Math.hypot(x - lumi.x, y - lumi.y);
      if (d > 260) break;
    }
    fogs.push({
      x,
      y,
      r: rand(46, 62),
      vx: 0,
      vy: 0,
      phase: rand(0, TAU),
      flee: 0,
      dirx: 0,
      diry: 0,
      blink: 0,
      nextBlink: rand(2, 5)
    });
  }

  function resetLevel(index) {
    levelIndex = index;
    level = LEVELS[index];
    goal = level.seeds;
    collected = 0;
    light = 100;
    combo = 0;
    mult = 1;
    comboTimer = 0;
    invuln = 1.2;
    shake = 0;
    starsGiven = 0;
    spawnTimer = 0.6;
    seeds.length = 0;
    fogs.length = 0;
    particles.length = 0;
    rings.length = 0;
    floaters.length = 0;

    lumi.x = W * 0.5;
    lumi.y = H * 0.62;
    lumi.vx = 0;
    lumi.vy = 0;
    lumi.stun = 0;
    lumi.trail.length = 0;

    pointer.active = false;
    pointer.inside = false;
    pointer.x = W / 2;
    pointer.y = H * 0.58;

    for (let i = 0; i < 3; i++) spawnSeed(true);
    for (let i = 0; i < level.fog; i++) spawnFog();

    lastLightPct = -1;
    updateComboUI();
    comboEl.classList.remove('is-on');
    setLevelUI();
    updateHud();
    setPauseEnabled(false);
    hud.classList.remove('is-hidden');
    state = 'intro';
    showScreen('intro');
  }

  function beginLevel() {
    sound.init();
    state = 'playing';
    hideScreen();
    setPauseEnabled(true);
    lastFrame = performance.now();
    rings.push({ x: lumi.x, y: lumi.y, r: 20, vr: 220, life: 0.5, maxLife: 0.5, color: '255, 230, 150', width: 3 });
  }

  function startGame() {
    sound.init();
    score = 0;
    shownScore = 0;
    runStars = [];
    flowers.forEach((f) => {
      f.bloomed = false;
      f.bloom = 0;
    });
    resetLevel(0);
  }

  function nextLevel() {
    if (levelIndex >= LEVELS.length - 1) {
      showVictory();
      return;
    }
    resetLevel(levelIndex + 1);
  }

  function completeLevel() {
    if (state !== 'playing') return;
    state = 'levelComplete';
    const bonus = Math.round(light) * 2;
    score += bonus;
    const earned = light > 58 ? 3 : light > 28 ? 2 : 1;
    runStars[levelIndex] = earned;
    if (score > best) best = score;
    try { localStorage.setItem('lumekids.best', String(best)); } catch (_) {}

    sound.levelUp();
    setPauseEnabled(false);
    bloomFlower(2);
    shake = Math.min(1, shake + 0.35);

    for (let i = 0; i < 34; i++) {
      const a = rand(0, TAU);
      const sp = rand(60, 340);
      spawnParticle(lumi.x, lumi.y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: rand(2.5, 6),
        life: rand(0.5, 1.2),
        color: pick(['255, 224, 120', '255, 250, 220', '142, 242, 198', '255, 179, 217'])
      });
    }
    rings.push({ x: lumi.x, y: lumi.y, r: 30, vr: 420, life: 0.9, maxLife: 0.9, color: '255, 230, 150', width: 5 });

    setTimeout(() => showScreen('levelComplete'), 480);
  }

  function showVictory() {
    state = 'victory';
    if (score > best) best = score;
    try { localStorage.setItem('lumekids.best', String(best)); } catch (_) {}
    sound.victory();
    flowers.forEach((f, i) => {
      if (!f.bloomed) setTimeout(() => { f.bloomed = true; }, 180 + i * 55);
    });
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        rings.push({
          x: rand(120, W - 120),
          y: rand(120, H - 200),
          r: 10,
          vr: 300,
          life: 1,
          maxLife: 1,
          color: pick(['255, 224, 120', '180, 155, 255', '142, 242, 198']),
          width: 4
        });
      }, i * 220);
    }
    hud.classList.add('is-hidden');
    setPauseEnabled(false);
    showScreen('victory');
  }

  function lightOut() {
    if (state !== 'playing') return;
    state = 'lightOut';
    sound.lightOut();
    setPauseEnabled(false);
    hud.classList.add('is-hidden');
    showScreen('lightOut');
  }

  function goMenu() {
    state = 'title';
    seeds.length = 0;
    fogs.length = 0;
    particles.length = 0;
    rings.length = 0;
    floaters.length = 0;
    lumi.trail.length = 0;
    lumi.x = 1012;
    lumi.y = 322;
    lumi.vx = 0;
    lumi.vy = 0;
    if (score > best) best = score;
    try { localStorage.setItem('lumekids.best', String(best)); } catch (_) {}
    hud.classList.add('is-hidden');
    setPauseEnabled(false);
    sound.setMuted(sound.muted);
    showScreen('title');
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    setPauseEnabled(true);
    showScreen('paused');
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    hideScreen();
    setPauseEnabled(true);
    lastFrame = performance.now();
  }

  function openHelp() {
    if (overlay.dataset.screen === 'help') return;
    helpBack = state;
    if (state === 'playing') state = 'paused';
    showScreen('help');
  }

  function closeHelp() {
    const back = helpBack;
    helpBack = null;
    if (back === 'playing') {
      resumeGame();
      return;
    }
    if (back === 'paused') {
      state = 'paused';
      showScreen('paused');
      return;
    }
    if (back === 'intro' || back === 'levelComplete' || back === 'lightOut' || back === 'victory') {
      state = back;
      showScreen(back);
      return;
    }
    goMenu();
  }

  function bloomFlower(count) {
    for (let i = 0; i < count; i++) {
      const f = flowers.find((fl) => !fl.bloomed);
      if (!f) break;
      f.bloomed = true;
      rings.push({
        x: f.x,
        y: f.y - (f.stem || 34) * f.s,
        r: 4,
        vr: 46,
        life: 0.7,
        maxLife: 0.7,
        color: f.color,
        width: 2
      });
    }
  }

  // ---------- fx ----------
  function spawnParticle(x, y, o) {
    if (particles.length > 280) return;
    particles.push({
      x,
      y,
      vx: o.vx || 0,
      vy: o.vy || 0,
      size: o.size || 3,
      life: o.life || 0.6,
      maxLife: o.life || 0.6,
      color: o.color || '255, 224, 120',
      drag: o.drag == null ? 1.4 : o.drag,
      gravity: o.gravity || 0,
      glow: o.glow !== false
    });
  }

  function seedBurst(x, y, color) {
    const n = reduceMotion ? 8 : 16;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(30, 190);
      spawnParticle(x, y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: rand(2, 4.6),
        life: rand(0.35, 0.8),
        color: color || pick(['255, 233, 150', '255, 250, 225', '255, 201, 77']),
        gravity: 40
      });
    }
    rings.push({ x, y, r: 6, vr: 120, life: 0.4, maxLife: 0.4, color: '255, 233, 150', width: 2.5 });
  }

  function floater(x, y, text, color, size) {
    floaters.push({
      x,
      y,
      text,
      color: color || '255, 236, 170',
      life: 0.9,
      maxLife: 0.9,
      size: size || 26
    });
  }

  function collectSeed(s) {
    if (state !== 'playing') return;
    const now = comboTimer > 0;
    combo = now ? combo + 1 : 1;
    comboTimer = 2.3;
    mult = clamp(1 + Math.floor(combo / 3), 1, 5);
    const gain = 10 * mult;
    score += gain;
    collected++;
    light = Math.min(100, light + 13);

    bloomFlower(1);
    seedBurst(s.x, s.y);
    floater(s.x, s.y - 24, '+' + gain, '255, 240, 190', 24);
    sound.collect(collected + mult);
    setSeedCount();
    popCombo();
    updateComboUI();

    if (collected >= goal) {
      completeLevel();
    } else if (starsGiven < 2 && collected >= Math.ceil(goal * (starsGiven === 0 ? 0.34 : 0.7))) {
      starsGiven++;
      setTimeout(() => {
        if (state === 'playing' || state === 'paused') spawnStar();
      }, 420);
    }
  }

  function collectStar(s) {
    if (state !== 'playing') return;
    score += 50;
    light = 100;
    combo = 0;
    mult = 1;
    comboTimer = 0;
    updateComboUI();
    setSeedCount();

    for (let i = 0; i < 30; i++) {
      const a = rand(0, TAU);
      const sp = rand(40, 300);
      spawnParticle(s.x, s.y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: rand(2, 5),
        life: rand(0.5, 1.1),
        color: pick(['255, 233, 150', '255, 250, 225', '180, 155, 255'])
      });
    }
    rings.push({ x: s.x, y: s.y, r: 12, vr: 460, life: 0.8, maxLife: 0.8, color: '255, 233, 150', width: 5 });
    rings.push({ x: lumi.x, y: lumi.y, r: 20, vr: 520, life: 0.7, maxLife: 0.7, color: '255, 250, 220', width: 4 });
    floater(s.x, s.y - 34, 'SUPER BRILHO!', '255, 245, 200', 30);
    shake = Math.min(1, shake + 0.18);
    sound.star();

    for (const f of fogs) {
      const a = Math.atan2(f.y - lumi.y, f.x - lumi.x);
      f.flee = 2.6;
      f.dirx = Math.cos(a);
      f.diry = Math.sin(a);
    }
  }

  function hitFog(f) {
    if (invuln > 0 || state !== 'playing') return;
    light = Math.max(0, light - 20);
    combo = 0;
    mult = 1;
    comboTimer = 0;
    updateComboUI();
    invuln = 1.5;
    lumi.stun = 0.34;

    const a = Math.atan2(lumi.y - f.y, lumi.x - f.x);
    lumi.vx = Math.cos(a) * 520;
    lumi.vy = Math.sin(a) * 520;

    shake = 1;
    sound.hit();
    floater(lumi.x, lumi.y - 34, '-20 luz', '255, 140, 150', 24);

    for (let i = 0; i < 18; i++) {
      const ang = rand(0, TAU);
      const sp = rand(40, 240);
      spawnParticle(lumi.x, lumi.y, {
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        size: rand(2.4, 5),
        life: rand(0.3, 0.7),
        color: pick(['190, 150, 255', '255, 150, 170', '255, 225, 160'])
      });
    }

    if (light <= 0) {
      setTimeout(lightOut, 220);
    }
  }

  // ---------- input ----------
  const keys = new Set();
  const KEYMAP = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down'
  };

  function keyVector() {
    let x = 0;
    let y = 0;
    if (keys.has('left')) x -= 1;
    if (keys.has('right')) x += 1;
    if (keys.has('up')) y -= 1;
    if (keys.has('down')) y += 1;
    return { x, y };
  }

  window.addEventListener('keydown', (e) => {
    const mapped = KEYMAP[e.key];
    if (mapped) {
      keys.add(mapped);
      e.preventDefault();
      pointer.active = false;
    }

    if (e.key === 'Escape') {
      if (overlay.classList.contains('is-open')) {
        if (state === 'paused') resumeGame();
        else if (overlay.dataset.screen === 'help') closeHelp();
      } else {
        pauseGame();
      }
    }

    if (e.key === 'm' || e.key === 'M') toggleMute();

    if ((e.key === ' ' || e.key === 'Enter') && overlay.classList.contains('is-open')) {
      if (overlay.dataset.screen === 'help') {
        e.preventDefault();
        closeHelp();
        return;
      }
      const el = document.activeElement;
      const isButton = el && el.tagName === 'BUTTON';
      if (!isButton) {
        const primary = overlay.querySelector('.btn-primary');
        if (primary) {
          e.preventDefault();
          primary.click();
        }
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const mapped = KEYMAP[e.key];
    if (mapped) keys.delete(mapped);
  });

  window.addEventListener('blur', () => keys.clear());

  function worldFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    const ox = (rect.width - W * scale) / 2;
    const oy = (rect.height - H * scale) / 2;
    return {
      x: clamp((e.clientX - rect.left - ox) / scale, 0, W),
      y: clamp((e.clientY - rect.top - oy) / scale, 0, H)
    };
  }

  function onPointerMove(e) {
    const p = worldFromEvent(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.inside = true;
    pointer.type = e.pointerType || 'mouse';
    if (e.pointerType === 'touch') {
      stage.classList.add('is-touch');
      pointer.active = true;
    } else if (e.pointerType === 'pen' || (e.buttons & 1) || !pointer.touch) {
      pointer.active = true;
    }
    if (pointer.type === 'mouse') pointer.active = true;
  }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') pointer.touch = true;
    onPointerMove(e);
    if (state === 'title') sound.init();
  });
  canvas.addEventListener('pointerenter', (e) => {
    pointer.inside = true;
    if (e.pointerType === 'mouse') pointer.active = true;
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- update ----------
  function updateLumi(dt, mode) {
    let tx;
    let ty;

    if (mode === 'idle') {
      tx = 1012 + Math.cos(time * 0.6) * 16;
      ty = 322 + Math.sin(time * 0.85) * 12;
    } else if (mode === 'hold') {
      tx = W * 0.5 + Math.cos(time * 0.5) * 10;
      ty = H * 0.62 + Math.sin(time * 0.8) * 8;
    } else if (lumi.stun > 0) {
      tx = lumi.x;
      ty = lumi.y;
    } else {
      const k = keyVector();
      if (k.x || k.y) {
        const len = Math.hypot(k.x, k.y) || 1;
        const speed = 470;
        lumi.vx = lerp(lumi.vx, (k.x / len) * speed, Math.min(1, dt * 9));
        lumi.vy = lerp(lumi.vy, (k.y / len) * speed, Math.min(1, dt * 9));
        integrateLumi(dt);
        return;
      }
      tx = pointer.active ? pointer.x : W / 2;
      ty = pointer.active ? pointer.y : H * 0.58;
    }

    if (lumi.stun > 0) {
      lumi.stun -= dt;
      lumi.vx *= Math.pow(0.02, dt);
      lumi.vy *= Math.pow(0.02, dt);
    } else {
      const omega = 9.2;
      const dx = tx - lumi.x;
      const dy = ty - lumi.y;
      lumi.vx += (dx * omega * omega - 2 * omega * lumi.vx) * dt;
      lumi.vy += (dy * omega * omega - 2 * omega * lumi.vy) * dt;
      if (Math.hypot(dx, dy) < 4) {
        lumi.vx *= Math.pow(0.001, dt);
        lumi.vy *= Math.pow(0.001, dt);
      }
    }

    integrateLumi(dt);
  }

  function integrateLumi(dt) {
    const sp = Math.hypot(lumi.vx, lumi.vy);
    const maxSp = 720;
    if (sp > maxSp) {
      lumi.vx = (lumi.vx / sp) * maxSp;
      lumi.vy = (lumi.vy / sp) * maxSp;
    }
    lumi.x += lumi.vx * dt;
    lumi.y += lumi.vy * dt;

    const padX = 34;
    const padTop = 64;
    const padBottom = 40;
    if (lumi.x < padX) { lumi.x = padX; lumi.vx = Math.abs(lumi.vx) * 0.25; }
    if (lumi.x > W - padX) { lumi.x = W - padX; lumi.vx = -Math.abs(lumi.vx) * 0.25; }
    if (lumi.y < padTop) { lumi.y = padTop; lumi.vy = Math.abs(lumi.vy) * 0.25; }
    if (lumi.y > H - padBottom) { lumi.y = H - padBottom; lumi.vy = -Math.abs(lumi.vy) * 0.25; }

    lumi.tilt = clamp(lumi.vx / 2600, -0.2, 0.2);

    const speed = Math.hypot(lumi.vx, lumi.vy);
    if (speed > 130) {
      lumi.trail.push({ x: lumi.x, y: lumi.y, life: 0.32, r: lumi.r * rand(0.5, 0.85) });
      if (lumi.trail.length > 20) lumi.trail.shift();
    }

    lumi.nextBlink -= dt;
    if (lumi.nextBlink <= 0 && lumi.blink <= 0) {
      lumi.blink = 0.16;
      lumi.nextBlink = rand(2.4, 5.4);
    }
    if (lumi.blink > 0) lumi.blink -= dt;
  }

  function updateSeeds(dt) {
    for (let i = seeds.length - 1; i >= 0; i--) {
      const s = seeds[i];
      s.phase += dt * (s.spin || 1);

      if (s.kind === 'star') {
        s.life -= dt;
        s.x += Math.cos(time * 0.9 + s.phase) * 9 * dt;
        s.y += Math.sin(time * 1.2 + s.phase) * 9 * dt;
        if (s.life <= 0) { seeds.splice(i, 1); continue; }
      } else {
        s.y += s.vy * dt;
        s.x += Math.sin(time * 1.5 + s.phase) * 16 * dt;
        if (s.y > H + 70) { seeds.splice(i, 1); continue; }
        const dx = lumi.x - s.x;
        const dy = lumi.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 120) {
          s.x += (dx / d) * 90 * dt;
          s.y += (dy / d) * 90 * dt;
        }
      }

      const dx = lumi.x - s.x;
      const dy = lumi.y - s.y;
      const rr = lumi.r + s.r + 4;
      if (dx * dx + dy * dy < rr * rr) {
        seeds.splice(i, 1);
        if (s.kind === 'star') collectStar(s);
        else collectSeed(s);
      }
    }
  }

  function updateFogs(dt) {
    for (let i = 0; i < fogs.length; i++) {
      const f = fogs[i];
      f.phase += dt;

      if (f.flee > 0) {
        f.flee -= dt;
        const k = Math.max(0, f.flee / 2.6);
        f.x += f.dirx * (90 + 270 * k) * dt;
        f.y += f.diry * (90 + 270 * k) * dt;
      } else {
        for (let j = 0; j < fogs.length; j++) {
          if (j === i) continue;
          const o = fogs[j];
          const dx = f.x - o.x;
          const dy = f.y - o.y;
          const d = Math.hypot(dx, dy) || 1;
          const min = f.r + o.r;
          if (d < min) {
            f.x += (dx / d) * (min - d) * 0.5;
            f.y += (dy / d) * (min - d) * 0.5;
          }
        }

        const desired = Math.atan2(lumi.y - f.y, lumi.x - f.x) + Math.sin(time * 1.3 + f.phase) * 0.6;
        const speed = level.fogSpeed;
        f.vx = lerp(f.vx, Math.cos(desired) * speed, Math.min(1, dt * 1.7));
        f.vy = lerp(f.vy, Math.sin(desired) * speed, Math.min(1, dt * 1.7));
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }

      if (f.x < 66) { f.x = 66; f.vx = Math.abs(f.vx) * 0.5; }
      if (f.x > W - 66) { f.x = W - 66; f.vx = -Math.abs(f.vx) * 0.5; }
      if (f.y < 120) { f.y = 120; f.vy = Math.abs(f.vy) * 0.5; }
      if (f.y > H - 80) { f.y = H - 80; f.vy = -Math.abs(f.vy) * 0.5; }

      f.nextBlink -= dt;
      if (f.nextBlink <= 0) {
        f.blink = 0.18;
        f.nextBlink = rand(2.5, 6);
      }
      if (f.blink > 0) f.blink -= dt;

      const dx = lumi.x - f.x;
      const dy = lumi.y - f.y;
      const rr = lumi.r + f.r * 0.74;
      if (dx * dx + dy * dy < rr * rr) hitFog(f);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(0.4, dt * p.drag);
      p.vy *= Math.pow(0.4, dt * p.drag);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt;
      r.r += r.vr * dt;
      if (r.life <= 0) rings.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
    for (let i = lumi.trail.length - 1; i >= 0; i--) {
      lumi.trail[i].life -= dt;
      if (lumi.trail[i].life <= 0) lumi.trail.splice(i, 1);
    }
  }

  function update(dt) {
    // world ambience runs in every state
    for (const f of fireflies) {
      f.x += Math.cos(time * f.sp + f.phase) * f.amp * dt * 0.6 + f.drift * dt;
      f.y += Math.sin(time * f.sp * 1.3 + f.phase * 2) * f.amp * 0.45 * dt;
      if (f.x < -30) f.x = W + 30;
      if (f.x > W + 30) f.x = -30;
      if (f.y < 130) f.y = 130;
      if (f.y > H - 60) f.y = H - 60;
    }
    for (const f of flowers) {
      if (f.bloomed && f.bloom < 1) f.bloom = Math.min(1, f.bloom + dt * 1.5);
    }
    for (const d of decoSeeds) {
      d.y += d.vy * dt;
      d.phase += dt;
      if (d.y < 90) { d.y = 560; d.x = 700 + Math.random() * 240; }
    }

    updateParticles(dt);
    if (shake > 0) shake = Math.max(0, shake - dt * 3.4);
    if (invuln > 0) invuln = Math.max(0, invuln - dt);

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        combo = 0;
        mult = 1;
        updateComboUI();
      }
    }

    if (state === 'playing') {
      updateLumi(dt, 'play');

      light -= level.drain * dt;
      if (light <= 0) {
        light = 0;
        updateHud();
        if (state === 'playing') lightOut();
      }

      spawnTimer -= dt;
      const alive = seeds.filter((s) => s.kind === 'seed').length;
      if (spawnTimer <= 0 && alive < 4 + (levelIndex > 2 ? 1 : 0)) {
        spawnSeed(false);
        spawnTimer = level.spawnEvery * rand(0.78, 1.2);
      }

      updateSeeds(dt);
      updateFogs(dt);
    } else if (state === 'title') {
      updateLumi(dt, 'idle');
    } else if (state === 'intro') {
      updateLumi(dt, 'hold');
    } else {
      updateLumi(dt, 'hold');
    }

    updateHud();
  }

  // ---------- render ----------
  function drawSky() {
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // soft aurora ribbons
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ax = W * 0.32 + Math.sin(time * 0.07) * 70;
    const g1 = ctx.createRadialGradient(ax, 300, 20, ax, 300, 460);
    g1.addColorStop(0, 'rgba(112, 82, 190, 0.16)');
    g1.addColorStop(1, 'rgba(60, 40, 140, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    const bx = W * 0.74 + Math.cos(time * 0.05) * 90;
    const g2 = ctx.createRadialGradient(bx, 380, 20, bx, 380, 420);
    g2.addColorStop(0, 'rgba(70, 180, 170, 0.1)');
    g2.addColorStop(1, 'rgba(40, 120, 140, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, 0, W, H);

    // twinkling stars
    for (const s of bgStars) {
      const tw = 0.5 + 0.5 * Math.sin(time * s.speed + s.phase);
      ctx.globalAlpha = 0.2 + tw * 0.65;
      ctx.fillStyle = s.warm ? '#ffe6b0' : '#dfe9ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.7 + tw * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMoon() {
    const mx = 936;
    const my = 122;
    const r = 48;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(mx, my, r * 0.4, mx, my, r * 4.4);
    halo.addColorStop(0, 'rgba(255, 240, 190, 0.3)');
    halo.addColorStop(0.4, 'rgba(255, 226, 150, 0.09)');
    halo.addColorStop(1, 'rgba(255, 210, 130, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, r * 4.4, 0, TAU);
    ctx.fill();
    ctx.restore();

    const body = ctx.createRadialGradient(mx - 14, my - 16, 4, mx, my, r);
    body.addColorStop(0, '#fffdf2');
    body.addColorStop(0.55, '#fff3cd');
    body.addColorStop(1, '#f2d493');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(214, 178, 116, 0.16)';
    ctx.beginPath(); ctx.arc(mx - 13, my - 6, 10, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 15, my - 16, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 6, my + 20, 7.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(mx - 22, my + 22, 4.5, 0, TAU); ctx.fill();
  }

  function drawHills() {
    // far
    ctx.fillStyle = '#143441';
    ctx.beginPath();
    ctx.moveTo(0, farY(0));
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, farY(x));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // mid
    ctx.fillStyle = '#0f2c3a';
    ctx.beginPath();
    ctx.moveTo(0, midY(0));
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, midY(x));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // bushes on the mid ridge
    for (const b of bushes) {
      ctx.fillStyle = '#0b2734';
      ctx.beginPath();
      ctx.moveTo(b.x - b.r, b.y + 4);
      ctx.arc(b.x, b.y + 4, b.r, Math.PI, 0);
      ctx.arc(b.x + b.r * 0.7, b.y + 4, b.r * b.s, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(126, 220, 196, 0.1)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(b.x, b.y + 4, b.r - 1, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }

    // near
    ctx.fillStyle = '#0a2330';
    ctx.beginPath();
    ctx.moveTo(0, nearY(0));
    for (let x = 0; x <= W; x += 14) ctx.lineTo(x, nearY(x));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 520, W, H - 520);

    // low mist settling in the valley
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const mist = ctx.createRadialGradient(W * 0.5, 592, 40, W * 0.5, 592, 560);
    mist.addColorStop(0, 'rgba(96, 178, 170, 0.055)');
    mist.addColorStop(1, 'rgba(70, 140, 150, 0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 470, W, H - 470);
    ctx.restore();

    // grass blades
    for (const g of grass) {
      const sway = Math.sin(time * 1.1 + g.phase) * 3.2;
      ctx.strokeStyle = 'rgba(128, 214, 184, ' + g.alpha.toFixed(3) + ')';
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.quadraticCurveTo(g.x + g.lean * 0.5, g.y - g.h * 0.55, g.x + g.lean + sway, g.y - g.h);
      ctx.stroke();
    }
  }

  function drawMushroom(m) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.scale(m.s, m.s);
    const glow = Math.sin(time * 1.4 + m.x) * 0.15 + 0.85;

    ctx.fillStyle = 'rgba(230, 245, 210, 0.82)';
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(-6, -12, -3.4, -19);
    ctx.lineTo(3.4, -19);
    ctx.quadraticCurveTo(6, -12, 4, 0);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(0, -22, 2, 0, -22, 30);
    hg.addColorStop(0, 'rgba(255, 170, 180, ' + 0.25 * glow + ')');
    hg.addColorStop(1, 'rgba(255, 120, 140, 0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(0, -22, 30, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#e8738c';
    ctx.beginPath();
    ctx.ellipse(0, -21, 14, 10, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 240, 235, 0.85)';
    [[-7, -25, 2], [3, -27, 2.6], [8, -22, 1.7]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawFlower(f) {
    const sway = Math.sin(time * 1.05 + f.phase) * 3.2;
    const stemTop = -(f.stem || 34);

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.s, f.s);

    ctx.strokeStyle = 'rgba(106, 178, 150, 0.3)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.35, stemTop * 0.55, sway, stemTop);
    ctx.stroke();

    // a single low leaf, leaning with the breeze
    const leafDir = Math.sin(f.phase * 1.7) > 0 ? 1 : -1;
    ctx.fillStyle = 'rgba(94, 168, 138, 0.24)';
    ctx.beginPath();
    ctx.ellipse(leafDir * 5.5, stemTop * 0.58, 6.4, 2.2, leafDir * 0.45, 0, TAU);
    ctx.fill();

    const t = clamp(f.bloom, 0, 1);

    if (t <= 0.01) {
      const tilt = Math.sin(f.phase) * 0.14;
      ctx.save();
      ctx.translate(sway, stemTop);
      ctx.rotate(tilt);
      const bud = ctx.createLinearGradient(0, -7, 0, 5);
      bud.addColorStop(0, 'rgba(132, 182, 156, 0.5)');
      bud.addColorStop(1, 'rgba(82, 132, 110, 0.62)');
      ctx.fillStyle = bud;
      ctx.beginPath();
      ctx.moveTo(0, -7.6);
      ctx.quadraticCurveTo(3.8, -2, 0, 5);
      ctx.quadraticCurveTo(-3.8, -2, 0, -7.6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 221, 150, 0.32)';
      ctx.beginPath();
      ctx.arc(0, -5.8, 1.2, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.restore();
      return;
    }

    const e = easeOutBack(t);
    ctx.translate(sway, stemTop);
    ctx.scale(e, e);
    ctx.globalAlpha = clamp(t * 2, 0, 1);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    gl.addColorStop(0, hexToRgba(f.color, 0.42));
    gl.addColorStop(1, hexToRgba(f.color, 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (t < 0.55) {
      ctx.fillStyle = hexToRgba(f.color, 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.5 * t, 6.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }

    // five petals + heart
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      const px = Math.cos(a) * 8.6;
      const py = Math.sin(a) * 8.6;
      const g = ctx.createRadialGradient(px - 1.5, py - 1.5, 0.5, px, py, 6.4);
      g.addColorStop(0, '#fffdf6');
      g.addColorStop(0.45, f.color);
      g.addColorStop(1, hexToRgba(f.color, 0.75));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 6.2, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe9a2';
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(190, 120, 30, 0.5)';
    ctx.beginPath();
    ctx.arc(1.1, 1.1, 1.5, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawFireflies() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fireflies) {
      const a = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(time * 1.6 + f.phase));
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 6);
      g.addColorStop(0, 'rgba(' + f.hue + ',' + (0.5 * a).toFixed(3) + ')');
      g.addColorStop(0.35, 'rgba(' + f.hue + ',' + (0.18 * a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + f.hue + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 252, 225, ' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSeed(s) {
    const bob = Math.sin(time * 2 + s.phase) * 2;
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.rotate(Math.sin(time * 1.2 + s.phase) * 0.18);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, s.r * 4.2);
    g.addColorStop(0, 'rgba(255, 232, 140, 0.52)');
    g.addColorStop(0.4, 'rgba(255, 205, 90, 0.16)');
    g.addColorStop(1, 'rgba(255, 190, 70, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 4.2, 0, TAU);
    ctx.fill();
    ctx.restore();

    const body = ctx.createRadialGradient(-s.r * 0.3, -s.r * 0.4, 1, 0, 0, s.r);
    body.addColorStop(0, '#fffdf0');
    body.addColorStop(0.55, '#ffe289');
    body.addColorStop(1, '#ffbc4d');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, s.r + 2.4, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(-s.r * 0.3, -s.r * 0.34, s.r * 0.22, 0, TAU);
    ctx.fill();

    // sparkle
    const tw = 0.5 + 0.5 * Math.sin(time * 3 + s.phase);
    ctx.strokeStyle = 'rgba(255, 250, 220, ' + (0.35 + tw * 0.5) + ')';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(s.r + 3, 0);
    ctx.lineTo(s.r + 3 + 4 + tw * 3, 0);
    ctx.moveTo(0, s.r + 3);
    ctx.lineTo(0, s.r + 3 + 4 + tw * 3);
    ctx.stroke();

    ctx.restore();
  }

  function drawStarSeed(s) {
    const pulse = 0.75 + 0.25 * Math.sin(time * 3 + s.phase);
    const lifeFade = clamp(s.life / 1.6, 0, 1);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.sin(time * 0.8 + s.phase) * 0.2);
    ctx.globalAlpha = lifeFade;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 3, 0, 0, 90 * pulse);
    g.addColorStop(0, 'rgba(255, 240, 170, 0.5)');
    g.addColorStop(0.4, 'rgba(255, 215, 110, 0.2)');
    g.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 90 * pulse, 0, TAU);
    ctx.fill();
    ctx.restore();

    const fill = ctx.createRadialGradient(-6, -8, 2, 0, 0, 26);
    fill.addColorStop(0, '#fffce8');
    fill.addColorStop(0.5, '#ffdf7a');
    fill.addColorStop(1, '#ffb03e');
    ctx.fillStyle = fill;
    ctx.beginPath();
    starPath(0, 0, 24, 11, 5, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  function starPath(cx, cy, outer, inner, points, rotation) {
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = rotation + (i * Math.PI) / points;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  function drawFog(f) {
    const wob = Math.sin(time * 1.5 + f.phase);
    ctx.save();
    ctx.translate(f.x + wob * 4, f.y + Math.cos(time * 1.2 + f.phase) * 3);

    // soft dark aura
    const aura = ctx.createRadialGradient(0, 0, f.r * 0.3, 0, 0, f.r * 2);
    aura.addColorStop(0, 'rgba(56, 32, 90, 0.42)');
    aura.addColorStop(0.6, 'rgba(36, 20, 62, 0.24)');
    aura.addColorStop(1, 'rgba(26, 14, 48, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, f.r * 2, 0, TAU);
    ctx.fill();

    // puffy body
    const body = ctx.createRadialGradient(-f.r * 0.28, -f.r * 0.34, f.r * 0.15, 0, 0, f.r * 1.12);
    body.addColorStop(0, 'rgba(104, 80, 150, 0.96)');
    body.addColorStop(0.55, 'rgba(74, 54, 118, 0.96)');
    body.addColorStop(1, 'rgba(44, 30, 78, 0.92)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, TAU);
    ctx.fill();

    const puff = f.r * 0.52;
    [[-0.62, -0.36, 0.72], [0.58, -0.42, 0.6], [0, -0.7, 0.62], [-0.25, 0.55, 0.56], [0.42, 0.48, 0.5]].forEach(([px, py, ps]) => {
      ctx.save();
      ctx.translate(px * f.r + wob * 2, py * f.r);
      ctx.beginPath();
      ctx.arc(0, 0, puff * ps, 0, TAU);
      ctx.fillStyle = 'rgba(84, 62, 130, 0.88)';
      ctx.fill();
      ctx.restore();
    });

    // rim highlight
    ctx.strokeStyle = 'rgba(170, 140, 230, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, f.r * 0.98, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();

    // sleepy-cute face
    const blinking = f.blink > 0;
    ctx.strokeStyle = '#e7d6ff';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    const eyeY = -2;
    const eyeX = f.r * 0.28;
    if (blinking) {
      ctx.beginPath();
      ctx.moveTo(-eyeX - 4, eyeY);
      ctx.lineTo(-eyeX + 4, eyeY);
      ctx.moveTo(eyeX - 4, eyeY);
      ctx.lineTo(eyeX + 4, eyeY);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#f2e6ff';
      [-eyeX, eyeX].forEach((x) => {
        ctx.beginPath();
        ctx.ellipse(x, eyeY, 4.4, 5.2, 0, 0, TAU);
        ctx.fill();
      });
      ctx.fillStyle = '#3b2a5c';
      [-eyeX, eyeX].forEach((x) => {
        ctx.beginPath();
        ctx.arc(x + wob * 0.8, eyeY + 0.8, 2.2, 0, TAU);
        ctx.fill();
      });
    }

    ctx.strokeStyle = 'rgba(231, 214, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, f.r * 0.14, f.r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  function drawLumi() {
    const sp = Math.hypot(lumi.vx, lumi.vy);
    const glowScale = 0.7 + clamp(light / 100, 0, 1) * 0.3;

    // trail
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const t of lumi.trail) {
      const a = clamp(t.life / 0.32, 0, 1) * 0.16;
      const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.r * 1.6);
      g.addColorStop(0, 'rgba(255, 235, 170, ' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255, 215, 120, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(lumi.x, lumi.y);
    if (reduceMotion) ctx.rotate(0);
    else ctx.rotate(lumi.tilt);

    // halo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const haloR = (76 + Math.sin(time * 2.1) * 6) * glowScale + 22;
    const halo = ctx.createRadialGradient(0, 0, 6, 0, 0, haloR);
    halo.addColorStop(0, 'rgba(255, 238, 180, ' + (0.38 * glowScale).toFixed(3) + ')');
    halo.addColorStop(0.36, 'rgba(255, 213, 120, ' + (0.19 * glowScale).toFixed(3) + ')');
    halo.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (invuln > 0) {
      const a = 0.25 + 0.25 * Math.sin(time * 22);
      ctx.strokeStyle = 'rgba(185, 165, 255, ' + a.toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, lumi.r + 12, 0, TAU);
      ctx.stroke();
    }

    // body
    const breathe = reduceMotion ? 0 : Math.sin(time * 2.4) * 0.015;
    ctx.scale(1 + breathe + clamp(sp / 9000, 0, 0.04), 1 - breathe);

    const body = ctx.createRadialGradient(-9, -11, 3, 0, 0, lumi.r * 1.15);
    body.addColorStop(0, '#fff9e4');
    body.addColorStop(0.4, '#ffe491');
    body.addColorStop(0.76, '#ffcb5e');
    body.addColorStop(1, '#ffab3f');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, lumi.r, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, lumi.r - 0.8, 0, TAU);
    ctx.stroke();

    // little sprout
    const sway = Math.sin(time * 1.7) * 0.12;
    ctx.save();
    ctx.translate(0, -lumi.r + 2);
    ctx.rotate(sway);
    ctx.strokeStyle = 'rgba(96, 190, 140, 0.95)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(1, -7, 0, -12);
    ctx.stroke();
    ctx.fillStyle = '#8ef2c6';
    ctx.beginPath();
    ctx.ellipse(-5, -12, 5.4, 2.9, -0.45, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5fd6a5';
    ctx.beginPath();
    ctx.ellipse(4.6, -15, 5, 2.7, 0.45, 0, TAU);
    ctx.fill();
    ctx.restore();

    // eyes look toward motion / pointer
    let lookX = 0;
    let lookY = 0;
    if (pointer.active && state !== 'title') {
      const dx = pointer.x - lumi.x;
      const dy = pointer.y - lumi.y;
      const d = Math.hypot(dx, dy) || 1;
      lookX = (dx / d) * 2.1;
      lookY = (dy / d) * 1.7;
    } else {
      lookX = clamp(lumi.vx / 260, -2, 2);
      lookY = clamp(lumi.vy / 260, -1.6, 1.6);
    }

    const blinking = lumi.blink > 0;
    if (blinking) {
      ctx.strokeStyle = '#3b2a52';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, -3);
      ctx.lineTo(-6, -3);
      ctx.moveTo(7, -3);
      ctx.lineTo(15, -3);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#3b2a52';
      [-10, 9].forEach((x) => {
        ctx.beginPath();
        ctx.ellipse(x + lookX, -4 + lookY, 4.4, 5.4, 0, 0, TAU);
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      [-11.5, 7.5].forEach((x) => {
        ctx.beginPath();
        ctx.arc(x + lookX, -6.2 + lookY, 1.5, 0, TAU);
        ctx.fill();
      });
    }

    // cheeks
    ctx.fillStyle = 'rgba(255, 140, 150, 0.28)';
    ctx.beginPath();
    ctx.ellipse(-15.5, 5, 4.6, 3, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15.5, 5, 4.6, 3, 0, 0, TAU);
    ctx.fill();

    // smile
    ctx.strokeStyle = '#7a4a2a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 5.5, 5.2, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  function drawForeground() {
    const clusters = [
      { x: 18, y: H + 26, dir: 1, s: 1.15 },
      { x: W - 26, y: H + 34, dir: -1, s: 0.95 },
      { x: 208, y: H + 42, dir: 1, s: 0.6 }
    ];
    for (const c of clusters) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.dir * c.s, c.s);
      const blades = [
        { a: -1.68, len: 150, w: 13 },
        { a: -1.36, len: 195, w: 16 },
        { a: -1.9, len: 128, w: 11 },
        { a: -1.12, len: 165, w: 13 }
      ];
      for (const b of blades) {
        const tipX = Math.cos(b.a) * b.len;
        const tipY = Math.sin(b.a) * b.len;
        const nx = Math.cos(b.a + Math.PI / 2) * b.w;
        const ny = Math.sin(b.a + Math.PI / 2) * b.w;
        const g = ctx.createLinearGradient(0, 0, tipX, tipY);
        g.addColorStop(0, 'rgba(4, 20, 27, 0.98)');
        g.addColorStop(1, 'rgba(9, 46, 50, 0.92)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-nx, -ny);
        ctx.quadraticCurveTo(tipX * 0.45 - nx * 1.6, tipY * 0.7 - ny * 1.6, tipX, tipY);
        ctx.quadraticCurveTo(tipX * 0.45 + nx * 1.6, tipY * 0.7 + ny * 1.6, nx, ny);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(110, 205, 185, 0.12)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawRings() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      const a = clamp(r.life / r.maxLife, 0, 1);
      ctx.strokeStyle = 'rgba(' + r.color + ',' + (a * 0.65).toFixed(3) + ')';
      ctx.lineWidth = r.width * (0.4 + a * 0.9);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.4);
      g.addColorStop(0, 'rgba(' + p.color + ',' + (a * 0.9).toFixed(3) + ')');
      g.addColorStop(0.45, 'rgba(' + p.color + ',' + (a * 0.35).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + p.color + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 250, ' + (a * 0.75).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFloaters() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of floaters) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      const pop = 1 + (1 - a) * 0.15;
      ctx.font = '600 ' + Math.round(f.size * pop) + 'px Fredoka, Trebuchet MS, sans-serif';
      ctx.fillStyle = 'rgba(' + f.color + ',' + Math.min(1, a * 1.6).toFixed(3) + ')';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function drawVignette() {
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    if (light < 34 && (state === 'playing' || state === 'paused')) {
      const a = (1 - light / 34) * (0.22 + 0.1 * Math.sin(time * 6));
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.24, W / 2, H / 2, H * 0.82);
      g.addColorStop(0, 'rgba(40, 8, 40, 0)');
      g.addColorStop(1, 'rgba(50, 8, 34, ' + clamp(a, 0, 0.4).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawPointer() {
    if (!pointer.inside || pointer.touch || pointer.type !== 'mouse') return;
    if (state !== 'playing' && state !== 'title') return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = 13 + Math.sin(time * 4) * 1.5;
    ctx.strokeStyle = 'rgba(255, 236, 170, 0.35)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 250, 220, 0.7)';
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawDecoSeeds() {
    if (state !== 'title' && state !== 'victory') return;
    for (const d of decoSeeds) drawSeed({ x: d.x, y: d.y, r: d.r, phase: d.phase });
  }

  function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + a + ')';
  }

  function render() {
    if (!skyGrad) buildStaticGradients();

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#05040f';
    ctx.fillRect(0, 0, view.w, view.h);

    const sx = reduceMotion ? 0 : (Math.random() - 0.5) * shake * 14;
    const sy = reduceMotion ? 0 : (Math.random() - 0.5) * shake * 14;

    ctx.save();
    ctx.translate(view.ox + sx, view.oy + sy);
    ctx.scale(view.scale, view.scale);

    drawSky();
    drawMoon();
    drawHills();
    for (const m of MUSHROOMS) drawMushroom(m);
    for (const f of flowers) drawFlower(f);
    drawFireflies();
    drawDecoSeeds();

    for (const s of seeds) {
      if (s.kind === 'star') drawStarSeed(s);
      else drawSeed(s);
    }

    if (state === 'title') {
      drawLumi();
    } else {
      for (const f of fogs) drawFog(f);
      drawLumi();
    }

    drawRings();
    drawParticles();
    drawFloaters();
    drawForeground();
    drawVignette();
    drawPointer();

    ctx.restore();
  }

  // ---------- loop ----------
  let lastFrame = performance.now();

  function frame(now) {
    const raw = (now - lastFrame) / 1000;
    const dt = clamp(raw, 0.0001, 0.034);
    lastFrame = now;
    time += dt;

    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---------- events ----------
  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    sound.init();
    sound.click();

    switch (action) {
      case 'play':
        startGame();
        break;
      case 'begin':
        beginLevel();
        break;
      case 'next':
        nextLevel();
        break;
      case 'victory':
        showVictory();
        break;
      case 'retry':
        resetLevel(levelIndex);
        beginLevel();
        break;
      case 'restart':
        resetLevel(levelIndex);
        beginLevel();
        break;
      case 'resume':
        resumeGame();
        break;
      case 'menu':
        goMenu();
        break;
      case 'replay':
        startGame();
        break;
      case 'help':
        openHelp();
        break;
      case 'close-help':
        closeHelp();
        break;
      default:
        break;
    }
  });

  pauseBtn.addEventListener('click', () => {
    sound.init();
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  });

  muteBtn.addEventListener('click', () => {
    toggleMute();
  });

  helpBtn.addEventListener('click', () => {
    sound.init();
    openHelp();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') pauseGame();
  });

  // ---------- boot ----------
  function boot() {
    resize();
    buildStaticGradients();
    syncMuteUI();
    setPauseEnabled(false);
    goMenu();
    requestAnimationFrame(frame);
  }

  // Tiny QA hook (not linked in the UI).
  window.__lume = {
    get state() { return state; },
    get light() { return light; },
    get score() { return score; },
    get level() { return levelIndex + 1; },
    get collected() { return collected; },
    get goal() { return goal; },
    get seeds() { return seeds.length; },
    seedPositions: () => seeds.map((s) => ({ x: s.x, y: s.y, kind: s.kind })),
    fogPositions: () => fogs.map((f) => ({ x: f.x, y: f.y, r: f.r })),
    lumiPosition: () => ({ x: lumi.x, y: lumi.y }),
    teleport: (x, y) => { lumi.x = x; lumi.y = y; },
    addLight: (v) => { light = clamp(light + v, 0, 100); },
    spawnSeedAt: (x, y) => { seeds.push({ kind: 'seed', x, y, vy: 0, r: 10, phase: 0, spin: 1 }); },
    start: () => startGame(),
    begin: () => beginLevel(),
    skipTo: (n) => { resetLevel(clamp(n - 1, 0, LEVELS.length - 1)); beginLevel(); }
  };

  boot();
})();
