const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const coinsEl = document.getElementById("coins");
const ammoEl = document.getElementById("ammo");
const flyEl = document.getElementById("fly");
const livesEl = document.getElementById("lives");
const worldEl = document.getElementById("world");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("startBtn");

const W = canvas.width;
const H = canvas.height;
const TILE = 48;
const GRAVITY = 0.82;
const FRICTION = 0.82;
const MAX_FALL = 18;

const keys = new Set();
let jumpRequests = 0;
let fireRequests = 0;
let state;
let lastTime = 0;
let running = false;

const level = {
  width: 4600,
  spawn: { x: 90, y: 250 },
  goalX: 4380,
  solids: [
    rect(0, 492, 4600, 48),
    rect(520, 420, 240, 32),
    rect(920, 360, 288, 32),
    rect(1390, 420, 240, 32),
    rect(1730, 316, 96, 32),
    rect(1910, 268, 144, 32),
    rect(2270, 420, 288, 32),
    rect(2700, 364, 192, 32),
    rect(3110, 420, 336, 32),
    rect(3680, 360, 288, 32),
    rect(4100, 420, 192, 32),
    rect(1160, 444, 96, 48),
    rect(1260, 396, 96, 96),
    rect(3330, 444, 96, 48),
    rect(3430, 396, 96, 96),
  ],
  bricks: [
    brick(820, 300),
    brick(862, 300),
    brick(904, 300),
    brick(1600, 300),
    brick(1642, 300),
    brick(1684, 300),
    brick(2140, 252),
    brick(2182, 252),
    brick(3520, 300),
    brick(3562, 300),
    brick(3604, 300),
  ],
  boxes: [
    box(680, 300, "coin"),
    box(1040, 236, "mushroom"),
    box(1778, 190, "coin"),
    box(1970, 145, "ammo"),
    box(2420, 300, "mushroom"),
    box(2800, 244, "wing"),
    box(3210, 300, "coin"),
    box(3780, 240, "mushroom"),
  ],
  coinMap: [
    coin(360, 390),
    coin(580, 360),
    coin(970, 300),
    coin(1110, 300),
    coin(1510, 360),
    coin(2330, 360),
    coin(2480, 360),
    coin(2760, 305),
    coin(2860, 305),
    coin(3190, 360),
    coin(3360, 340),
    coin(3840, 300),
    coin(4140, 360),
  ],
  coins: [],
  enemies: [
    enemy(780, 444, 660, 900, "goomba"),
    enemy(1510, 372, 1410, 1600, "turtle"),
    enemy(2360, 372, 2280, 2520, "spike"),
    enemy(3310, 372, 3140, 3440, "goomba"),
    enemy(3880, 312, 3700, 3950, "turtle"),
    enemy(3020, 255, 2920, 3200, "flyer"),
  ],
  powerups: [],
  projectiles: [],
  debris: [],
};

function rect(x, y, w, h) {
  return { x, y, w, h };
}

function brick(x, y) {
  return { x, y, w: 42, h: 42, breakable: true, broken: false, bump: 0 };
}

function box(x, y, item) {
  return { x, y, w: 42, h: 42, item, hit: false, bump: 0 };
}

function coin(x, y) {
  return { x, y, r: 13, taken: false, spin: Math.random() * 10 };
}

function enemy(x, y, min, max, type = "goomba") {
  const flying = type === "flyer";
  return {
    x,
    startX: x,
    y,
    baseY: y,
    w: type === "turtle" ? 44 : 38,
    h: flying ? 32 : 38,
    min,
    max,
    vx: type === "turtle" ? -0.95 : flying ? -1.45 : -1.15,
    alive: true,
    squish: 0,
    type,
    shell: false,
    phase: Math.random() * Math.PI * 2,
  };
}

function reset(full = true) {
  state = {
    player: {
      x: level.spawn.x,
      y: level.spawn.y,
      w: 34,
      h: 46,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      jumpsLeft: 2,
      big: false,
      invincible: 0,
      ammo: full ? 0 : state.player.ammo,
      fireCooldown: 0,
      flightTimer: 0,
    },
    camera: 0,
    score: full ? 0 : state.score,
    coins: full ? 0 : state.coins,
    lives: full ? 3 : Math.max(0, state.lives - 1),
    won: false,
    over: false,
    time: 0,
  };

  level.coins = level.coinMap.map((c) => ({ ...c, spin: Math.random() * 10, taken: false }));
  level.powerups = [];
  level.projectiles = [];
  level.debris = [];
  level.bricks.forEach((b) => {
    b.broken = false;
    b.bump = 0;
  });
  level.boxes.forEach((b) => {
    b.hit = false;
    b.bump = 0;
  });
  level.enemies.forEach((e) => {
    e.alive = true;
    e.squish = 0;
    e.shell = false;
    e.x = e.startX;
    e.y = e.baseY;
    e.vx = -Math.abs(e.vx || 1.15);
  });
  syncHud();
}

function start() {
  if (!state || state.over || state.won) reset(true);
  running = true;
  messageEl.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(32, now - lastTime) / 16.67;
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  state.time += dt;
  const p = state.player;

  if (keys.has("ArrowLeft") || keys.has("KeyA")) {
    p.vx -= 0.65 * dt;
    p.facing = -1;
  }
  if (keys.has("ArrowRight") || keys.has("KeyD")) {
    p.vx += 0.65 * dt;
    p.facing = 1;
  }
  while (jumpRequests > 0) {
    tryJump();
    jumpRequests -= 1;
  }

  while (fireRequests > 0) {
    shoot();
    fireRequests -= 1;
  }

  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.flightTimer > 0) {
    p.flightTimer -= dt;
    if (keys.has("Space") || keys.has("ArrowUp") || keys.has("KeyW")) {
      p.vy = clamp(p.vy - 1.45 * dt, -9.5, MAX_FALL);
      p.jumpsLeft = 1;
    }
  }

  if (p.onGround) p.jumpsLeft = 2;

  p.vx = clamp(p.vx * FRICTION, -7.2, 7.2);
  p.vy = clamp(p.vy + GRAVITY * dt, -22, MAX_FALL);

  move(p, p.vx * dt, 0);
  move(p, 0, p.vy * dt);

  if (p.y > H + 120) hurtPlayer(true);
  if (p.invincible > 0) p.invincible -= dt;

  updateCoins(dt);
  updatePowerups(dt);
  updateProjectiles(dt);
  updateBoxes(dt);
  updateDebris(dt);
  updateEnemies(dt);

  if (p.x >= level.goalX) win();
  state.camera = clamp(p.x - W * 0.36, 0, level.width - W);
  syncHud();
}

function move(actor, dx, dy) {
  actor.x += dx;
  const solids = getSolids();
  for (const s of solids) {
    if (!overlaps(actor, s)) continue;
    if (dx > 0) actor.x = s.x - actor.w;
    if (dx < 0) actor.x = s.x + s.w;
    actor.vx = 0;
  }

  actor.y += dy;
  actor.onGround = false;
  for (const s of solids) {
    if (!overlaps(actor, s)) continue;
    if (dy > 0) {
      actor.y = s.y - actor.h;
      actor.vy = 0;
      actor.onGround = true;
      if (actor === state.player) actor.jumpsLeft = 2;
    }
    if (dy < 0) {
      actor.y = s.y + s.h;
      actor.vy = 0;
      if (s.breakable) {
        hitBrick(s);
        continue;
      }
      if (s.item && !s.hit) hitBox(s);
    }
  }

  actor.x = clamp(actor.x, 0, level.width - actor.w);
}

function getSolids() {
  return level.solids.concat(level.boxes, level.bricks.filter((b) => !b.broken));
}

function hitBrick(b) {
  b.bump = 10;
  if (!state.player.big) return;
  b.broken = true;
  state.score += 50;
  for (let i = 0; i < 8; i++) {
    level.debris.push({
      x: b.x + 12 + (i % 2) * 14,
      y: b.y + 10 + Math.floor(i / 2) * 8,
      w: 10,
      h: 8,
      vx: (i % 2 === 0 ? -1 : 1) * (2 + Math.floor(i / 2) * 0.5),
      vy: -5 - (i % 4),
      life: 42,
    });
  }
}

function hitBox(b) {
  b.hit = true;
  b.bump = 12;
  if (b.item === "coin") addCoin(b.x + b.w / 2, b.y - 18);
  if (b.item === "mushroom") addPowerup(b.x + 6, b.y - 28, "mushroom");
  if (b.item === "ammo") addPowerup(b.x + 6, b.y - 28, "ammo");
  if (b.item === "wing") addPowerup(b.x + 6, b.y - 28, "wing");
}

function addCoin(x, y) {
  level.coins.push({ x, y, r: 13, taken: false, spin: 0, popup: 26 });
}

function updateCoins(dt) {
  const p = state.player;
  for (const c of level.coins) {
    if (c.taken) continue;
    c.spin += dt * 0.18;
    if (c.popup) {
      c.y -= 2.7 * dt;
      c.popup -= dt;
      if (c.popup <= 0) collect(c);
      continue;
    }
    const pickup = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
    if (overlaps(p, pickup)) collect(c);
  }
}

function collect(c) {
  if (c.taken) return;
  c.taken = true;
  state.coins += 1;
  state.score += 100;
  if (state.coins > 0 && state.coins % 20 === 0) state.lives += 1;
}

function addPowerup(x, y, type) {
  level.powerups.push({
    x,
    y,
    w: type === "wing" ? 38 : type === "mushroom" ? 34 : 30,
    h: type === "wing" ? 30 : type === "mushroom" ? 34 : 26,
    vx: type === "mushroom" ? 1.15 : 0,
    vy: -4,
    type,
    taken: false,
  });
}

function updatePowerups(dt) {
  const p = state.player;
  for (const item of level.powerups) {
    if (item.taken) continue;
    item.vy = clamp(item.vy + GRAVITY * dt, -12, MAX_FALL);
    item.x += item.vx * dt;
    for (const s of getSolids()) {
      if (!overlaps(item, s)) continue;
      if (item.vx > 0) item.x = s.x - item.w;
      if (item.vx < 0) item.x = s.x + s.w;
      item.vx *= -1;
    }
    item.y += item.vy * dt;
    for (const s of getSolids()) {
      if (!overlaps(item, s)) continue;
      if (item.vy > 0) item.y = s.y - item.h;
      if (item.vy < 0) item.y = s.y + s.h;
      item.vy = 0;
    }
    if (overlaps(p, item)) collectPowerup(item);
  }
}

function collectPowerup(item) {
  item.taken = true;
  if (item.type === "mushroom") {
    state.player.big = true;
    state.player.h = 58;
    state.score += 500;
  }
  if (item.type === "ammo") {
    state.player.ammo += 5;
    state.score += 300;
  }
  if (item.type === "wing") {
    state.player.flightTimer = 300;
    state.score += 500;
  }
}

function shoot() {
  const p = state.player;
  if (!running || p.ammo <= 0 || p.fireCooldown > 0) return;
  p.ammo -= 1;
  p.fireCooldown = 16;
  level.projectiles.push({
    x: p.x + (p.facing > 0 ? p.w - 2 : -10),
    y: p.y + 18,
    w: 14,
    h: 9,
    vx: p.facing * 10.5,
    life: 90,
    hit: false,
  });
}

function updateProjectiles(dt) {
  for (const shot of level.projectiles) {
    if (shot.hit) continue;
    shot.x += shot.vx * dt;
    shot.life -= dt;
    if (shot.life <= 0 || shot.x < 0 || shot.x > level.width) shot.hit = true;
    for (const s of level.solids.concat(level.boxes)) {
      if (overlaps(shot, s)) shot.hit = true;
    }
    for (const e of level.enemies) {
      if (!e.alive || shot.hit || !overlaps(shot, e)) continue;
      e.alive = false;
      e.squish = 14;
      shot.hit = true;
      state.score += e.type === "turtle" ? 350 : 250;
    }
  }
  level.projectiles = level.projectiles.filter((shot) => !shot.hit);
}

function updateBoxes(dt) {
  for (const b of level.boxes) b.bump = Math.max(0, b.bump - dt);
  for (const b of level.bricks) b.bump = Math.max(0, b.bump - dt);
}

function updateDebris(dt) {
  for (const d of level.debris) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += GRAVITY * dt;
    d.life -= dt;
  }
  level.debris = level.debris.filter((d) => d.life > 0);
}

function updateEnemies(dt) {
  const p = state.player;
  for (const e of level.enemies) {
    if (!e.alive) {
      e.squish -= dt;
      continue;
    }
    if (e.type === "flyer") e.y = e.baseY + Math.sin(state.time * 0.06 + e.phase) * 34;
    e.x += e.vx * dt;
    if (e.x < e.min || e.x + e.w > e.max) e.vx *= -1;
    if (!overlaps(p, e) || p.invincible > 0) continue;

    const stomp = p.vy > 1 && p.y + p.h - e.y < 24;
    if (stomp) {
      if (e.type === "spike") {
        hurtPlayer(false);
        continue;
      }
      if (e.type === "turtle" && !e.shell) {
        e.shell = true;
        e.vx = 0;
        e.h = 26;
        e.y += 12;
      } else {
        e.alive = false;
        e.squish = 18;
      }
      p.vy = -10;
      state.score += e.type === "turtle" ? 350 : 250;
    } else {
      hurtPlayer(false);
    }
  }
}

function hurtPlayer(fell) {
  const p = state.player;
  if (!fell && p.invincible > 0) return;
  if (p.big && !fell) {
    p.big = false;
    p.h = 46;
    p.invincible = 90;
    p.flightTimer = 0;
    return;
  }

  if (state.lives <= 1) {
    state.lives = 0;
    gameOver();
    return;
  }

  reset(false);
}

function win() {
  state.won = true;
  running = false;
  showMessage("Clear!", "멋지게 도착했습니다 · R 다시 시작", "Again");
}

function gameOver() {
  state.over = true;
  running = false;
  showMessage("Game Over", "R 키나 버튼으로 다시 도전", "Restart");
}

function showMessage(title, text, button) {
  messageEl.querySelector("h1").textContent = title;
  messageEl.querySelector("p").textContent = text;
  startBtn.textContent = button;
  messageEl.classList.remove("hidden");
  syncHud();
}

function syncHud() {
  scoreEl.textContent = String(state.score).padStart(5, "0");
  coinsEl.textContent = state.coins;
  ammoEl.textContent = state.player.ammo;
  flyEl.textContent = Math.max(0, Math.ceil(state.player.flightTimer / 60));
  livesEl.textContent = state.lives;
  worldEl.textContent = "1-1";
}

function draw() {
  const cam = state.camera;
  ctx.clearRect(0, 0, W, H);
  drawSky(cam);
  drawLevel(cam);
  drawBricks(cam);
  drawGoal(cam);
  drawCoins(cam);
  drawPowerups(cam);
  drawBoxes(cam);
  drawProjectiles(cam);
  drawDebris(cam);
  drawEnemies(cam);
  drawPlayer(cam);
}

function drawSky(cam) {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "#63c6ff");
  grd.addColorStop(0.62, "#a8e5ff");
  grd.addColorStop(0.62, "#f3cc7a");
  grd.addColorStop(1, "#d78245");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,.9)";
  for (let i = 0; i < 8; i++) {
    const x = ((i * 390 - cam * 0.22) % 1300) - 160;
    cloud(x, 76 + (i % 3) * 54, 1 + (i % 2) * 0.3);
  }

  ctx.fillStyle = "#2e8c55";
  for (let i = 0; i < 12; i++) {
    const x = ((i * 310 - cam * 0.42) % 1600) - 220;
    hill(x, 492, 120 + (i % 4) * 24);
  }
}

function cloud(x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 24 * s, 0, Math.PI * 2);
  ctx.arc(x + 28 * s, y - 10 * s, 30 * s, 0, Math.PI * 2);
  ctx.arc(x + 62 * s, y, 24 * s, 0, Math.PI * 2);
  ctx.rect(x - 8 * s, y, 82 * s, 24 * s);
  ctx.fill();
}

function hill(x, base, h) {
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.quadraticCurveTo(x + 115, base - h, x + 230, base);
  ctx.closePath();
  ctx.fill();
}

function drawLevel(cam) {
  for (const s of level.solids) {
    if (s.x + s.w < cam || s.x > cam + W) continue;
    const x = Math.floor(s.x - cam);
    if (s.h <= 36) {
      ctx.fillStyle = "#9a6244";
      ctx.fillRect(x, s.y, s.w, s.h);
      ctx.fillStyle = "#d08a59";
      for (let tx = 0; tx < s.w; tx += 24) ctx.fillRect(x + tx + 2, s.y + 4, 18, 5);
      ctx.fillStyle = "#69402f";
      ctx.fillRect(x, s.y + s.h - 8, s.w, 8);
    } else {
      ctx.fillStyle = "#763c2e";
      ctx.fillRect(x, s.y, s.w, s.h);
      ctx.fillStyle = "#b55338";
      for (let yy = s.y + 4; yy < s.y + s.h; yy += 16) {
        for (let xx = 0; xx < s.w; xx += 32) ctx.fillRect(x + xx + ((yy / 16) % 2) * 16, yy, 26, 5);
      }
    }
  }
}

function drawBricks(cam) {
  for (const b of level.bricks) {
    if (b.broken || b.x + b.w < cam || b.x > cam + W) continue;
    const y = b.y - Math.sin(b.bump / 10 * Math.PI) * 8;
    const x = b.x - cam;
    ctx.fillStyle = "#b55338";
    ctx.fillRect(x, y, b.w, b.h);
    ctx.strokeStyle = "#63351f";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, b.w - 3, b.h - 3);
    ctx.fillStyle = "#e1845b";
    for (let row = 0; row < 3; row++) {
      const yy = y + 8 + row * 12;
      ctx.fillRect(x + 5 + (row % 2) * 10, yy, 14, 4);
      ctx.fillRect(x + 25 - (row % 2) * 7, yy, 12, 4);
    }
  }
}

function drawBoxes(cam) {
  for (const b of level.boxes) {
    if (b.x + b.w < cam || b.x > cam + W) continue;
    const y = b.y - Math.sin(b.bump / 12 * Math.PI) * 10;
    ctx.fillStyle = b.hit ? "#8c6751" : "#f2bd37";
    ctx.fillRect(b.x - cam, y, b.w, b.h);
    ctx.strokeStyle = "#63351f";
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x - cam + 2, y + 2, b.w - 4, b.h - 4);
    ctx.fillStyle = b.hit ? "#6b4b3d" : "#fff1a8";
    ctx.font = "900 28px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(b.hit ? "•" : "?", b.x - cam + b.w / 2, y + 30);
  }
}

function drawCoins(cam) {
  for (const c of level.coins) {
    if (c.taken || c.x + c.r < cam || c.x - c.r > cam + W) continue;
    const w = Math.max(5, Math.abs(Math.cos(c.spin)) * 18);
    ctx.fillStyle = "#f8cd3d";
    ctx.beginPath();
    ctx.ellipse(c.x - cam, c.y, w, c.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9c651e";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawPowerups(cam) {
  for (const item of level.powerups) {
    if (item.taken || item.x + item.w < cam || item.x > cam + W) continue;
    const x = item.x - cam;
    if (item.type === "mushroom") {
      ctx.fillStyle = "#e84635";
      ctx.fillRect(x, item.y + 4, item.w, 17);
      ctx.fillStyle = "#fff2cf";
      ctx.fillRect(x + 5, item.y + 14, item.w - 10, 20);
      ctx.fillStyle = "#fff2cf";
      ctx.fillRect(x + 7, item.y + 7, 7, 7);
      ctx.fillRect(x + 21, item.y + 7, 7, 7);
      ctx.fillStyle = "#2b1e18";
      ctx.fillRect(x + 11, item.y + 23, 4, 4);
      ctx.fillRect(x + 21, item.y + 23, 4, 4);
    } else if (item.type === "wing") {
      ctx.fillStyle = "#f8cd3d";
      ctx.fillRect(x + 14, item.y + 9, 10, 16);
      ctx.fillStyle = "#fff8de";
      ctx.beginPath();
      ctx.ellipse(x + 10, item.y + 11, 15, 9, -0.35, 0, Math.PI * 2);
      ctx.ellipse(x + 28, item.y + 11, 15, 9, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#84a7be";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = "#263848";
      ctx.fillRect(x, item.y + 8, item.w, 13);
      ctx.fillStyle = "#f8cd3d";
      ctx.fillRect(x + item.w - 8, item.y + 5, 8, 19);
      ctx.fillStyle = "#d94c38";
      ctx.fillRect(x + 3, item.y + 10, 12, 9);
    }
  }
}

function drawProjectiles(cam) {
  for (const shot of level.projectiles) {
    ctx.fillStyle = "#f8cd3d";
    ctx.fillRect(shot.x - cam, shot.y, shot.w, shot.h);
    ctx.fillStyle = "#fff7b0";
    ctx.fillRect(shot.x - cam + 3, shot.y + 2, 5, 3);
  }
}

function drawDebris(cam) {
  ctx.fillStyle = "#b55338";
  for (const d of level.debris) {
    ctx.fillRect(d.x - cam, d.y, d.w, d.h);
  }
}

function drawEnemies(cam) {
  for (const e of level.enemies) {
    if ((!e.alive && e.squish <= 0) || e.x + e.w < cam || e.x > cam + W) continue;
    const h = e.alive ? e.h : 14;
    const x = e.x - cam;
    const y = e.y + (e.h - h);
    if (e.type === "turtle") {
      ctx.fillStyle = e.shell ? "#2e8c55" : "#5aa957";
      ctx.fillRect(x + 4, y + 9, e.w - 8, h - 4);
      ctx.fillStyle = "#f5d08b";
      ctx.fillRect(x, y + 16, 10, 10);
      ctx.fillRect(x + e.w - 10, y + 16, 10, 10);
      ctx.fillStyle = "#28402f";
      ctx.fillRect(x + 10, y + 14, e.w - 20, 5);
      continue;
    }
    if (e.type === "spike") {
      ctx.fillStyle = "#343842";
      ctx.fillRect(x, y + 10, e.w, h - 10);
      ctx.fillStyle = "#f2f0d0";
      for (let i = 4; i < e.w; i += 11) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + 10);
        ctx.lineTo(x + i + 5, y);
        ctx.lineTo(x + i + 10, y + 10);
        ctx.fill();
      }
      continue;
    }
    if (e.type === "flyer") {
      ctx.fillStyle = "#c24a8b";
      ctx.fillRect(x + 6, y + 8, e.w - 12, h - 8);
      ctx.fillStyle = "#fff8de";
      ctx.fillRect(x - 8, y + 5, 16, 9);
      ctx.fillRect(x + e.w - 8, y + 5, 16, 9);
      ctx.fillStyle = "#201713";
      ctx.fillRect(x + 14, y + 16, 4, 4);
      ctx.fillRect(x + 24, y + 16, 4, 4);
      continue;
    }
    ctx.fillStyle = "#7b4b37";
    ctx.fillRect(x, y, e.w, h);
    ctx.fillStyle = "#ffe7c0";
    ctx.fillRect(x + 7, y + 9, 7, 7);
    ctx.fillRect(x + 24, y + 9, 7, 7);
    ctx.fillStyle = "#201713";
    ctx.fillRect(x + 9, y + 11, 3, 3);
    ctx.fillRect(x + 26, y + 11, 3, 3);
  }
}

function drawGoal(cam) {
  const x = level.goalX - cam + 34;
  ctx.fillStyle = "#1d3040";
  ctx.fillRect(x, 150, 8, 342);
  ctx.fillStyle = "#fff8de";
  ctx.fillRect(x + 8, 166, 90, 46);
  ctx.fillStyle = "#d94c38";
  ctx.font = "900 22px Trebuchet MS";
  ctx.fillText("GOAL", x + 18, 197);
}

function drawPlayer(cam) {
  const p = state.player;
  if (p.invincible > 0 && Math.floor(state.time / 5) % 2 === 0) return;
  const x = Math.floor(p.x - cam);
  const y = Math.floor(p.y);
  const cap = p.big ? "#db3b2f" : "#2b65c9";
  const suit = p.big ? "#2b65c9" : "#db3b2f";

  if (p.flightTimer > 0) {
    const flap = Math.sin(state.time * 0.35) * 4;
    ctx.fillStyle = "#fff8de";
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 22 + flap, 18, 9, -0.5, 0, Math.PI * 2);
    ctx.ellipse(x + p.w - 2, y + 22 - flap, 18, 9, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#84a7be";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = "#5f372d";
  ctx.fillRect(x + 4, y + p.h - 7, 11, 7);
  ctx.fillRect(x + p.w - 15, y + p.h - 7, 11, 7);
  ctx.fillStyle = suit;
  ctx.fillRect(x + 6, y + 20, p.w - 12, p.h - 24);
  ctx.fillStyle = "#ffd0a3";
  ctx.fillRect(x + 7, y + 8, p.w - 12, 18);
  ctx.fillStyle = cap;
  ctx.fillRect(x + 4, y + 2, p.w - 6, 9);
  ctx.fillRect(x + (p.facing > 0 ? 19 : 0), y + 9, 15, 5);
  ctx.fillStyle = "#211816";
  ctx.fillRect(x + (p.facing > 0 ? 23 : 8), y + 14, 4, 4);
  ctx.fillStyle = "#f9c64e";
  ctx.fillRect(x + 10, y + 29, 5, 5);
  ctx.fillRect(x + p.w - 15, y + 29, 5, 5);
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function tryJump() {
  const p = state.player;
  if (!running) return;
  if (p.onGround) {
    p.jumpsLeft = 1;
  } else if (p.jumpsLeft <= 0) {
    return;
  } else {
    p.jumpsLeft -= 1;
  }
  p.vy = p.jumpsLeft === 0 ? -14.2 : -16.2;
  p.onGround = false;
}

function onKeyDown(e) {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) {
    if (["Space", "ArrowUp", "KeyW"].includes(e.code)) jumpRequests += 1;
    if (e.code === "KeyF") fireRequests += 1;
  }
  keys.add(e.code);
  if (e.code === "KeyR") {
    reset(true);
    start();
  }
}

function onKeyUp(e) {
  keys.delete(e.code);
}

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
startBtn.addEventListener("click", start);

document.querySelectorAll("[data-key]").forEach((button) => {
  const code = button.dataset.key;
  const press = (e) => {
    e.preventDefault();
    if (!keys.has(code)) {
      if (code === "Space") jumpRequests += 1;
      if (code === "KeyF") fireRequests += 1;
    }
    keys.add(code);
    button.classList.add("pressed");
    if (code === "Space" && !running) start();
  };
  const release = (e) => {
    e.preventDefault();
    keys.delete(code);
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

reset(true);
draw();
