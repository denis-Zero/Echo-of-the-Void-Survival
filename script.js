// ======================
// Canvas + UI
// ======================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hpFill = document.getElementById('hp-fill');
const xpFill = document.getElementById('xp-fill');
const levelText = document.getElementById('level-text');
const timerDisplay = document.getElementById('timer');

const deathScreen = document.getElementById('death-screen');
const upgradeScreen = document.getElementById('upgrade-screen');
const upgradeCardsEl = document.getElementById('upgrade-cards');

const menuScreen = document.getElementById('menu-screen');
const pauseScreen = document.getElementById('pause-screen');
const hudContent = document.getElementById('hud-content');
const hudUpgrades = document.getElementById('hud-upgrades');
const hudToggle = document.getElementById('hud-toggle');
const btnPauseMobile = document.getElementById('btn-pause-mobile');

const btnPlay = document.getElementById('btn-play');
const btnHow = document.getElementById('btn-how');
const btnSettings = document.getElementById('btn-settings');
const btnResume = document.getElementById('btn-resume');
const btnBackMenu = document.getElementById('btn-back-menu');
const menuHow = document.getElementById('menu-how');
const menuSettings = document.getElementById('menu-settings');

const chkAutofire = document.getElementById('chk-autofire');
const volMaster = document.getElementById('vol-master');
const volMusic = document.getElementById('vol-music');
const volSfx = document.getElementById('vol-sfx');


// ======================
// Configurações persistentes (localStorage)
// ======================
const SETTINGS_KEY = 'eco_do_vazio_settings_v1';
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveSettings(partial) {
  try {
    const cur = loadSettings() || {};
    const next = { ...cur, ...partial };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {}
}

// aplica valores iniciais (antes de iniciar o jogo)
const saved = loadSettings();
if (saved) {
  if (typeof saved.hudCollapsed === 'boolean' && hudUpgrades) {
    hudUpgrades.classList.toggle('collapsed', saved.hudCollapsed);
  }
  if (typeof saved.autofire === 'boolean') chkAutofire.checked = saved.autofire;
  if (typeof saved.volMaster === 'number') volMaster.value = String(saved.volMaster);
  if (typeof saved.volMusic === 'number') volMusic.value = String(saved.volMusic);
  if (typeof saved.volSfx === 'number') volSfx.value = String(saved.volSfx);
}

let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
function resizeCanvas() {
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * DPR);
  canvas.height = Math.floor(window.innerHeight * DPR);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resizeCanvas();

// Debug: mostra erro na tela (evita "tela preta misteriosa")
let fatalErr = null;
window.addEventListener('error', (e) => { fatalErr = String(e.message || e.error || e); });

// ======================
// Áudio (WebAudio simples)
// ======================
const Audio = (() => {
  let ctxA = null;
  let master = null, music = null, sfx = null;
  let musicNodes = [];
  let enabled = true;

  function ensure() {
    if (ctxA) return;
    ctxA = new (window.AudioContext || window.webkitAudioContext)();
    master = ctxA.createGain();
    music = ctxA.createGain();
    sfx = ctxA.createGain();
    music.connect(master);
    sfx.connect(master);
    master.connect(ctxA.destination);

    master.gain.value = parseFloat(volMaster.value);
    music.gain.value = parseFloat(volMusic.value);
    sfx.gain.value = parseFloat(volSfx.value);
  }

  function setMaster(v){ if (!master) return; master.gain.value = v; }
  function setMusic(v){ if (!music) return; music.gain.value = v; }
  function setSfx(v){ if (!sfx) return; sfx.gain.value = v; }

  function beep(freq, dur=0.08, gain=0.12, type='sine') {
    if (!enabled) return;
    ensure();
    const t = ctxA.currentTime;
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(sfx);
    o.start(t);
    o.stop(t + dur);
  }

  function noiseBurst(dur=0.12, gain=0.12) {
    if (!enabled) return;
    ensure();
    const bufferSize = Math.floor(ctxA.sampleRate * dur);
    const buffer = ctxA.createBuffer(1, bufferSize, ctxA.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    const src = ctxA.createBufferSource();
    src.buffer = buffer;
    const g = ctxA.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(sfx);
    src.start();
  }

  function startMusic() {
    if (!enabled) return;
    ensure();
    stopMusic();

    // loop simples: drone + pulso
    const t = ctxA.currentTime;

    const drone = ctxA.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(55, t);

    const droneG = ctxA.createGain();
    droneG.gain.value = 0.04;

    const lfo = ctxA.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.18, t);

    const lfoG = ctxA.createGain();
    lfoG.gain.value = 0.02;

    lfo.connect(lfoG);
    lfoG.connect(droneG.gain);

    drone.connect(droneG);
    droneG.connect(music);

    drone.start();
    lfo.start();

    musicNodes.push(drone, lfo, droneG, lfoG);
  }

  function stopMusic() {
    if (!ctxA) return;
    for (const n of musicNodes) { try { if (n.stop) n.stop(); } catch {} }
    musicNodes = [];
  }

  return {
    enable(v){ enabled = v; },
    ensure,
    setMaster, setMusic, setSfx,
    startMusic, stopMusic,
    sfxShoot(){ beep(540, 0.03, 0.06, 'square'); },
    sfxHit(){ noiseBurst(0.06, 0.08); },
    sfxPickup(){ beep(880, 0.05, 0.08, 'triangle'); },
    sfxLevel(){ beep(660, 0.08, 0.12, 'sine'); beep(990, 0.10, 0.10, 'sine'); },
    sfxExplode(){ noiseBurst(0.14, 0.16); },
    sfxZap(){ beep(1200, 0.05, 0.08, 'sawtooth'); },
    sfxPulse(){ noiseBurst(0.10, 0.14); beep(220, 0.08, 0.06, 'sine'); },
    sfxClick(){ beep(520, 0.04, 0.06, 'triangle'); },
  };
})();

volMaster.addEventListener('input', () => { Audio.setMaster(parseFloat(volMaster.value)); saveSettings({ volMaster: parseFloat(volMaster.value) }); });
volMusic.addEventListener('input', () => { Audio.setMusic(parseFloat(volMusic.value)); saveSettings({ volMusic: parseFloat(volMusic.value) }); });
volSfx.addEventListener('input', () => { Audio.setSfx(parseFloat(volSfx.value)); saveSettings({ volSfx: parseFloat(volSfx.value) }); });

chkAutofire.addEventListener('change', () => saveSettings({ autofire: chkAutofire.checked }));

// HUD discreta: aba clicável
if (hudToggle && hudUpgrades) {
  hudToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const collapsed = !hudUpgrades.classList.contains('collapsed');
    hudUpgrades.classList.toggle('collapsed', collapsed);
    saveSettings({ hudCollapsed: collapsed });
  });
}


// ======================
// Estado do jogo
// ======================
let gameActive = false;           // começa no menu
let pausedForUpgrade = false;
let paused = false;

let score = 0;
let level = 1;
let xp = 0;
let xpNextLevel = 100;

let seconds = 0;
let screenShake = 0;

let bossTimer = 0;
let bossActive = false;

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

// ======================
// Player
// ======================
const player = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  radius: 15,
  color: '#1e00fec5',
  speed: 4.2,
  hp: 100,
  maxHp: 100,

  weaponLevel: 1,
  damage: 1,
  bulletSpeed: 8,
  bulletRadius: 4,
  fireRate: 4.5,
  piercing: 0,

  xpMagnet: 100,
  regen: 0,

  autoAim: false,
  autoFire: false,

  skills: {
    nebulizer: { level: 0, t: 0 },          // passiva C
    scattergun: { level: 0, t: 0 },         // passiva C
    grenade: { level: 0, cd: 6.0, timer: 0 }, // Q
    emp: { level: 0, cd: 10.0, timer: 0 },    // E
    laser: { level: 0, cd: 12.0, timer: 0, beam: 0 }, // R
    zap: { level: 0, t: 0 },                // passiva A
    omega: { level: 0, t: 0, jets: [] }      // passiva S
  }
};

// ======================
// Input
// ======================
const keys = {};
const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let mouseDown = false;

window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) { e.preventDefault(); if (gameActive && !paused && !pausedForUpgrade) tryPulse(); }
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;

  if (k === 'escape') {
    if (!gameActive) return;
    if (pausedForUpgrade) return;
    togglePause();
  }

  if (!gameActive || paused || pausedForUpgrade) return;
  if (k === 'q') castGrenade();
  if (k === 'e') castEMP();
  if (k === 'r') castLaser();
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// Mobile: joystick + auto aim/fire
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
if (isTouch) { player.autoAim = true; player.autoFire = true; }

const touchMove = { active:false, id:null, startX:0, startY:0, x:0, y:0 };
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  if (!gameActive) return;
  if (e.clientX < window.innerWidth * 0.55) {
    touchMove.active = true;
    touchMove.id = e.pointerId;
    touchMove.startX = e.clientX;
    touchMove.startY = e.clientY;
    touchMove.x = e.clientX;
    touchMove.y = e.clientY;
  }
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch') return;
  if (!touchMove.active || e.pointerId !== touchMove.id) return;
  touchMove.x = e.clientX;
  touchMove.y = e.clientY;
});
window.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'touch') return;
  if (e.pointerId === touchMove.id) { touchMove.active=false; touchMove.id=null; }
});

// ======================
// Entidades
// ======================
const enemies = [];
const bullets = [];
const enemyBullets = [];
const particles = [];
const gems = [];

// ======================
// Habilidade: Pulso (clique direito)
// ======================
const pulse = { cooldown: 8.0, timer: 0.0, radius: 200, damage: 10, knockback: 15, flash: 0.0 };

function tryPulse() {
  if (pulse.timer > 0) return;
  pulse.timer = pulse.cooldown;
  pulse.flash = 1.0;
  screenShake = Math.max(screenShake, 14);
  Audio.sfxPulse();

  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    const dx = en.x - player.x;
    const dy = en.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= pulse.radius + en.radius) {
      const t = 1 - (dist / (pulse.radius + en.radius));
      const dmg = Math.max(1, Math.floor((pulse.damage + level * 0.6) * (0.55 + 0.45 * t)));
      en.hp -= dmg;
      createParticle(en.x, en.y, en.color);

      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      en.x += nx * pulse.knockback * 22;
      en.y += ny * pulse.knockback * 22;

      if (en.hp <= 0) killEnemy(i, en);
    }
  }
}

// ======================
// Helpers (efeitos, kills)
// ======================
function createParticle(x, y, color) {
  for (let i = 0; i < 8; i++) {
    particles.push({ x, y, color, vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6, alpha:1, size:Math.random()*4 });
  }
}
function killEnemy(index, en){
  const drop = (en.type === 'boss') ? 40 : 20;
  gems.push({ x: en.x, y: en.y, value: drop });
  if (typeof en.onDeath === 'function') en.onDeath();
  enemies.splice(index, 1);
  score += en.score;
}

// ======================
// Inimigos
// ======================
function makeEnemy(type='chaser') {
  const w = window.innerWidth, h = window.innerHeight;
  const side = Math.floor(Math.random()*4);
  let x,y;
  if (side===0){x=-60; y=Math.random()*h;}
  else if (side===1){x=w+60; y=Math.random()*h;}
  else if (side===2){x=Math.random()*w; y=-60;}
  else {x=Math.random()*w; y=h+60;}

  const baseSpeed = 1.35 + (level * 0.12);
  const baseHp = 2 + Math.floor(level/2);

  const e = {
    type, x, y,
    radius: 14,
    color: '#ff416c',
    speed: baseSpeed,
    hp: baseHp,
    maxHp: baseHp,
    score: 10,
    onDeath: null,
    shootCooldown: 0,
    slowT: 0
  };

  if (type === 'runner') {
    e.radius=12; e.speed=baseSpeed*1.75;
    e.hp=Math.max(1, Math.floor(baseHp*0.7)); e.maxHp=e.hp;
    e.color='#ff8a00'; e.score=12;
  } else if (type==='tank') {
    e.radius=24; e.speed=baseSpeed*0.65;
    e.hp=Math.floor(baseHp*2.6); e.maxHp=e.hp;
    e.color='#8a2be2'; e.score=20;
  } else if (type==='shooter') {
    e.radius=16; e.speed=baseSpeed*0.9;
    e.hp=Math.floor(baseHp*1.2); e.maxHp=e.hp;
    e.color='#00e676'; e.score=18;
    e.shootCooldown = 0.6 + Math.random()*0.5;
  } else if (type==='splitter') {
    e.radius=18; e.speed=baseSpeed*0.85;
    e.hp=Math.floor(baseHp*1.5); e.maxHp=e.hp;
    e.color='#00bcd4'; e.score=22;
    e.onDeath = () => {
      for (let i=0;i<3;i++){
        const mini = makeEnemy('runner');
        mini.x = e.x + (Math.random()-0.5)*20;
        mini.y = e.y + (Math.random()-0.5)*20;
        mini.radius = 10;
        mini.hp = Math.max(1, Math.floor(level/2));
        mini.maxHp = mini.hp;
        mini.speed *= 1.1;
        enemies.push(mini);
      }
    };
  }

  e.update = function(dt) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const slowMul = (this.slowT && this.slowT > 0) ? 0.55 : 1.0;
    if (this.slowT && this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);

    this.x += Math.cos(angle) * this.speed * slowMul * 60 * dt;
    this.y += Math.sin(angle) * this.speed * slowMul * 60 * dt;

    if (this.type==='shooter') {
      this.shootCooldown -= dt;
      if (this.shootCooldown <= 0) {
        this.shootCooldown = 0.9 + Math.random()*0.6;
        shootEnemyBullet(this.x, this.y, angle, 5.4 + level*0.05);
      }
    }
  };

  e.draw = function() {
    ctx.shadowBlur = 14;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (this.type==='tank' || this.type==='boss') {
      const barW = this.radius*2.2, barH = 4;
      const px = this.x - barW/2, py = this.y - this.radius - 10;
      ctx.fillStyle='rgba(255,255,255,0.15)';
      ctx.fillRect(px, py, barW, barH);
      ctx.fillStyle='rgba(255,65,108,0.9)';
      ctx.fillRect(px, py, barW*(this.hp/this.maxHp), barH);
    }
  };

  return e;
}

function spawnBoss() {
  if (bossActive) return;
  bossActive = true;

  const w=window.innerWidth, h=window.innerHeight;
  const b = makeEnemy('boss');
  b.x = Math.random()<0.5 ? -80 : w+80;
  b.y = Math.random()*h;

  b.radius=46;
  b.speed=1.0 + level*0.04;
  b.hp=Math.floor(120 + level*35);
  b.maxHp=b.hp;
  b.color='#ff1744';
  b.score=250;
  b.shootCooldown=1.2;

  b.update = function(dt) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    this.x += Math.cos(angle) * this.speed * 60 * dt;
    this.y += Math.sin(angle) * this.speed * 60 * dt;

    this.shootCooldown -= dt;
    if (this.shootCooldown <= 0) {
      this.shootCooldown = Math.max(0.7, 1.25 - level*0.01);
      const bulletsCount = 10 + Math.min(10, Math.floor(level/2));
      for (let i=0;i<bulletsCount;i++){
        const a = (Math.PI*2) * (i/bulletsCount);
        shootEnemyBullet(this.x, this.y, a, 4.2);
      }
      screenShake = Math.max(screenShake, 10);
      Audio.sfxExplode();
    }
  };

  b.onDeath = () => {
    bossActive = false;
    for (let i=0;i<18;i++) gems.push({ x: b.x+(Math.random()-0.5)*40, y: b.y+(Math.random()-0.5)*40, value: 35 });
    levelText.innerText = 'BOSS DERROTADO!';
    setTimeout(()=> levelText.innerText = `NÍVEL ${level}`, 1600);
  };

  enemies.push(b);
  levelText.innerText = 'ALERTA: BOSS DETECTADO!';
  setTimeout(()=> levelText.innerText = `NÍVEL ${level}`, 1600);
}

// ======================
// Tiros
// ======================
let fireCooldown = 0;

function shootAt(angle) {
  if (!gameActive || paused || pausedForUpgrade) return;

  for (let i=0;i<player.weaponLevel;i++){
    const spread = (i - (player.weaponLevel-1)/2) * 0.12;
    bullets.push({
      x: player.x, y: player.y,
      vx: Math.cos(angle+spread) * player.bulletSpeed,
      vy: Math.sin(angle+spread) * player.bulletSpeed,
      radius: player.bulletRadius,
      color: '#fff',
      damage: player.damage,
      pierce: player.piercing
    });
  }
  screenShake = Math.max(screenShake, 2.5);
  Audio.sfxShoot();
}

function nearestEnemyAngle(){
  if (enemies.length===0) return null;
  let best=null, bestD=Infinity;
  for (const en of enemies){
    const d=(en.x-player.x)**2 + (en.y-player.y)**2;
    if (d<bestD){bestD=d; best=en;}
  }
  return best ? Math.atan2(best.y-player.y, best.x-player.x) : null;
}

function aimAngle() {
  const a = player.autoAim ? nearestEnemyAngle() : null;
  return (a !== null) ? a : Math.atan2(mouse.y - player.y, mouse.x - player.x);
}

function shootEnemyBullet(x,y,angle,speed){
  enemyBullets.push({
    x,y,
    vx: Math.cos(angle)*speed,
    vy: Math.sin(angle)*speed,
    radius: 4,
    color: 'rgba(255,255,255,0.85)',
    damage: 6 + Math.min(10, level*0.25)
  });
}

// ======================
// Habilidades (C/B/A/S)
// ======================
const laserDraw = { active:false, x1:0,y1:0,x2:0,y2:0,w:10 };

function tickNebulizer(dt){
  const sk = player.skills.nebulizer;
  if (sk.level<=0) return;
  const rate = 0.9 + sk.level*0.25;
  sk.t -= dt;
  if (sk.t<=0){
    sk.t = 1/rate;
    const a = Math.random()*Math.PI*2;
    const spd = player.bulletSpeed*(0.65 + Math.random()*0.25);
    bullets.push({ x:player.x,y:player.y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, radius:Math.max(2.8, player.bulletRadius*0.75),
      color:'rgba(255,255,255,0.8)', damage:Math.max(1, Math.floor(1+sk.level*0.4)), pierce:0 });
  }
}

function tickScattergun(dt){
  const sk = player.skills.scattergun;
  if (sk.level<=0) return;
  const rate = 0.7 + sk.level*0.12;
  sk.t -= dt;
  if (sk.t<=0){
    sk.t = 1/rate;
    const base = aimAngle();
    const pellets = 6 + sk.level;
    const spread = 0.55;
    for (let i=0;i<pellets;i++){
      const off = (i/(pellets-1)-0.5)*spread;
      const spd = player.bulletSpeed*0.85;
      bullets.push({ x:player.x,y:player.y, vx:Math.cos(base+off)*spd, vy:Math.sin(base+off)*spd, radius:Math.max(3.2, player.bulletRadius*0.9),
        color:'rgba(255,255,255,0.9)', damage:Math.max(2, Math.floor(2+sk.level*0.8)), pierce:0 });
    }
    Audio.sfxShoot();
  }
}

function explodeAt(x,y,radius,damage,color){
  pulse.flash = Math.max(pulse.flash, 0.75);
  createParticle(x,y,color);
  screenShake = Math.max(screenShake, 10);
  Audio.sfxExplode();

  for (let i=enemies.length-1;i>=0;i--){
    const en = enemies[i];
    const d = Math.hypot(en.x-x, en.y-y);
    if (d <= radius + en.radius){
      const t = 1 - (d/(radius+en.radius));
      const dmg = Math.max(1, Math.floor(damage*(0.45+0.55*t)));
      en.hp -= dmg;
      createParticle(en.x,en.y,en.color);

      const nx=(en.x-x)/(d||1), ny=(en.y-y)/(d||1);
      en.x += nx*18*t;
      en.y += ny*18*t;

      if (en.hp<=0) killEnemy(i,en);
    }
  }
}

function castGrenade(){
  const sk = player.skills.grenade;
  if (sk.level<=0 || sk.timer>0) return;
  sk.timer = sk.cd;

  const base = aimAngle();
  const a = base + (Math.random()-0.5) * (0.9 - Math.min(0.6, sk.level*0.08));
  const dist = 220 + Math.random()*220;
  const tx = player.x + Math.cos(a)*dist;
  const ty = player.y + Math.sin(a)*dist;

  explodeAt(tx,ty, 170 + sk.level*12, 22 + sk.level*8, 'rgba(255,65,108,0.95)');
}

function castEMP(){
  const sk = player.skills.emp;
  if (sk.level<=0 || sk.timer>0) return;
  sk.timer = sk.cd;

  const r = 220 + sk.level*18;
  const dmg = 18 + sk.level*6;

  pulse.flash = Math.max(pulse.flash, 0.9);
  screenShake = Math.max(screenShake, 12);
  Audio.sfxPulse();

  for (let i=enemies.length-1;i>=0;i--){
    const en = enemies[i];
    const d = Math.hypot(en.x-player.x, en.y-player.y);
    if (d <= r + en.radius){
      let mult=1.0;
      if (en.type==='tank') mult=0.55;
      if (en.type==='boss') mult=0.35;
      en.hp -= Math.floor(dmg*mult);
      en.slowT = Math.max(en.slowT||0, 2.2 + sk.level*0.3);
      createParticle(en.x,en.y,'rgba(0,242,254,0.9)');

      if (en.hp<=0) killEnemy(i,en);
    }
  }
}

function castLaser(){
  const sk = player.skills.laser;
  if (sk.level<=0 || sk.timer>0) return;
  sk.timer = sk.cd;
  sk.beam = 0.55 + sk.level*0.1;
  screenShake = Math.max(screenShake, 8);
  Audio.sfxZap();
}

function pointSegmentDistance(px,py,x1,y1,x2,y2){
  const vx=x2-x1, vy=y2-y1;
  const wx=px-x1, wy=py-y1;
  const c1=vx*wx + vy*wy;
  if (c1<=0) return Math.hypot(px-x1, py-y1);
  const c2=vx*vx + vy*vy;
  if (c2<=c1) return Math.hypot(px-x2, py-y2);
  const t=c1/c2;
  const bx=x1+t*vx, by=y1+t*vy;
  return Math.hypot(px-bx, py-by);
}

function tickLaser(dt){
  const sk = player.skills.laser;
  if (sk.level<=0) return;
  if (sk.beam<=0) return;

  sk.beam = Math.max(0, sk.beam - dt);

  const a = aimAngle();
  const width = 10 + sk.level*3;
  const range = 900;
  const dps = 120 + sk.level*45;

  const x1=player.x, y1=player.y;
  const x2=x1 + Math.cos(a)*range;
  const y2=y1 + Math.sin(a)*range;

  for (let i=enemies.length-1;i>=0;i--){
    const en = enemies[i];
    const dist = pointSegmentDistance(en.x,en.y,x1,y1,x2,y2);
    if (dist <= en.radius + width){
      en.hp -= Math.max(1, Math.floor((dps*dt) * (0.85 + 0.15*sk.level)));
      createParticle(en.x,en.y,'rgba(0,242,254,0.85)');
      if (en.hp<=0) killEnemy(i,en);
    }
  }

  laserDraw.active=true; laserDraw.x1=x1; laserDraw.y1=y1; laserDraw.x2=x2; laserDraw.y2=y2; laserDraw.w=width;
}

function findNearestEnemy(x,y,range=Infinity,ignore=null){
  let best=null, bestD=Infinity;
  const r2=range*range;
  for (const en of enemies){
    if (ignore && ignore.has(en)) continue;
    const dx=en.x-x, dy=en.y-y;
    const d2=dx*dx+dy*dy;
    if (d2<bestD && d2<=r2){bestD=d2; best=en;}
  }
  return best;
}

function tickZap(dt){
  const sk=player.skills.zap;
  if (sk.level<=0) return;
  sk.t -= dt;
  const rate = 1.2 + sk.level*0.35;
  if (sk.t>0) return;
  sk.t = 1/rate;

  if (enemies.length===0) return;

  const maxJumps = 2 + Math.floor(sk.level/2);
  const jumpRange = 220 + sk.level*15;
  const baseDmg = 10 + sk.level*5;

  let current = findNearestEnemy(player.x, player.y);
  if (!current) return;

  const hit = new Set();
  for (let j=0;j<maxJumps;j++){
    if (!current || hit.has(current)) break;
    hit.add(current);

    current.hp -= baseDmg;
    createParticle(current.x,current.y,'rgba(0,242,254,0.95)');
    Audio.sfxZap();

    if (current.hp<=0){
      const idx = enemies.indexOf(current);
      if (idx>=0) killEnemy(idx, current);
    }

    current = findNearestEnemy(current.x, current.y, jumpRange, hit);
  }
}

function tickOmega(dt){
  const sk=player.skills.omega;
  if (sk.level<=0) return;

  const want = 1 + Math.floor((sk.level-1)/2);
  while (sk.jets.length < want) sk.jets.push({ a:Math.random()*Math.PI*2, r:190+Math.random()*40, fireT:0, _x:0, _y:0 });

  for (const jet of sk.jets){
    jet.a += (0.9 + sk.level*0.08)*dt;
    const jx = player.x + Math.cos(jet.a)*jet.r;
    const jy = player.y + Math.sin(jet.a)*jet.r;

    // aura dano
    const auraR = 42 + sk.level*6;
    const auraDps = 80 + sk.level*22;
    for (let i=enemies.length-1;i>=0;i--){
      const en=enemies[i];
      const d=Math.hypot(en.x-jx, en.y-jy);
      if (d <= auraR + en.radius){
        en.hp -= Math.max(1, Math.floor(auraDps*dt));
        if (en.hp<=0) killEnemy(i,en);
      }
    }

    // metralhadora
    jet.fireT -= dt;
    const fireRate = 2.2 + sk.level*0.35;
    if (jet.fireT<=0 && enemies.length>0){
      jet.fireT = 1/fireRate;
      const target = findNearestEnemy(player.x, player.y, 520);
      if (target){
        const a = Math.atan2(target.y-jy, target.x-jx) + (Math.random()-0.5)*0.25;
        bullets.push({ x:jx,y:jy, vx:Math.cos(a)*(player.bulletSpeed*0.95), vy:Math.sin(a)*(player.bulletSpeed*0.95),
          radius:3.2, color:'rgba(255,255,255,0.95)', damage:Math.max(1, Math.floor(2+sk.level*0.9)), pierce:0 });
      }
    }

    jet._x=jx; jet._y=jy;
  }
}

// ======================
// Upgrades por escolha
// ======================
const upgradePool = [
  { id:'more_projectiles', title:'Módulo de Dispersão', desc:'Dispara +1 projétil por tiro.', tag:'OFENSIVA', apply:()=> player.weaponLevel += 1 },
  { id:'fire_rate', title:'Condensador de Pulso', desc:'Aumenta a taxa de tiro em +18%.', tag:'OFENSIVA', apply:()=> player.fireRate *= 1.18 },
  { id:'damage', title:'Amplificador de Impacto', desc:'Aumenta o dano em +1.', tag:'OFENSIVA', apply:()=> player.damage += 1 },
  { id:'bullet_speed', title:'Canhão de Íons', desc:'Aumenta a velocidade dos projéteis em +15%.', tag:'OFENSIVA', apply:()=> player.bulletSpeed *= 1.15 },
  { id:'bullet_size', title:'Núcleo Expandido', desc:'Projéteis maiores (+25% de raio).', tag:'OFENSIVA', apply:()=> player.bulletRadius *= 1.25 },
  { id:'piercing', title:'Faseamento', desc:'Projéteis atravessam +1 inimigo.', tag:'TÁTICO', apply:()=> player.piercing += 1 },
  { id:'move_speed', title:'Propulsores Auxiliares', desc:'Aumenta a velocidade de movimento em +12%.', tag:'MOBILIDADE', apply:()=> player.speed *= 1.12 },
  { id:'max_hp', title:'Reforço de Traje', desc:'Aumenta HP máximo em +20 e cura 20.', tag:'DEFESA', apply:()=> { player.maxHp += 20; player.hp = Math.min(player.maxHp, player.hp + 20); } },
  { id:'regen', title:'Nanorregeneração', desc:'Regenera +1.2 HP por segundo.', tag:'DEFESA', apply:()=> player.regen += 1.2 },
  { id:'magnet', title:'Ímã de Éter', desc:'Aumenta o alcance de coleta de XP em +35%.', tag:'UTIL', apply:()=> player.xpMagnet *= 1.35 },

  // Habilidades
  { id:'skill_nebulizer', title:'Nebulizador Caótico', desc:'Passiva C: jatos aleatórios fracos em todas as direções.', tag:'HABILIDADE C', apply:()=> player.skills.nebulizer.level += 1 },
  { id:'skill_scattergun', title:'Canhão de Estilhaços', desc:'Passiva C: disparo em cone, bom dano, sem perfuração.', tag:'HABILIDADE C', apply:()=> player.skills.scattergun.level += 1 },
  { id:'skill_grenade', title:'Carga Volátil (Q)', desc:'Ativa B: explosão em área muito forte (arremesso levemente aleatório).', tag:'HABILIDADE B', apply:()=> player.skills.grenade.level += 1 },
  { id:'skill_emp', title:'Pulso Eletromagnético (E)', desc:'Ativa B: dano em área + lentidão (menos efetiva em tanques/boss).', tag:'HABILIDADE B', apply:()=> player.skills.emp.level += 1 },
  { id:'skill_laser', title:'Feixe Aniquilador (R)', desc:'Ativa A: feixe com DPS altíssimo atravessando tudo por curta duração.', tag:'HABILIDADE A', apply:()=> player.skills.laser.level += 1 },
  { id:'skill_zap', title:'Condutor Arcano', desc:'Passiva A: raio que salta entre inimigos automaticamente.', tag:'HABILIDADE A', apply:()=> player.skills.zap.level += 1 },
  { id:'skill_omega', title:'Esquadrão Ômega', desc:'Passiva S: caças orbitais com dano em área e metralhadora.', tag:'HABILIDADE S', apply:()=> player.skills.omega.level += 1 },
];

function pickUpgrades(count=3){
  const available = upgradePool.filter(u => {
    if (u.id==='skill_omega') return level >= 8;
    if (u.id==='skill_laser') return level >= 5;
    if (u.id==='skill_zap') return level >= 4;
    if (u.id==='skill_emp') return level >= 3;
    if (u.id==='skill_grenade') return level >= 3;
    return true;
  });

  const copy=[...available];
  const picks=[];
  while (picks.length<count && copy.length){
    const idx=Math.floor(Math.random()*copy.length);
    picks.push(copy.splice(idx,1)[0]);
  }
  return picks;
}

function openUpgradeScreen(){
  pausedForUpgrade = true;
  upgradeScreen.style.display='flex';
  upgradeCardsEl.innerHTML='';

  const options = pickUpgrades(3);
  for (const up of options){
    const card = document.createElement('div');
    card.className='upgrade-card';
    card.innerHTML = `<div class="upgrade-title">${up.title}</div>
      <div class="upgrade-desc">${up.desc}</div>
      <div class="upgrade-tag">${up.tag}</div>`;
    card.addEventListener('click', () => {
      Audio.sfxClick();
      up.apply();
      closeUpgradeScreen();
    });
    upgradeCardsEl.appendChild(card);
  }
}
function closeUpgradeScreen(){
  upgradeScreen.style.display='none';
  pausedForUpgrade = false;
}

// ======================
// Loop principal
// ======================
let lastTime = performance.now();

function update(dt){
  if (!gameActive || paused || pausedForUpgrade) return;

  // regen
  if (player.regen>0) player.hp = Math.min(player.maxHp, player.hp + player.regen*dt);

  // cooldown pulse
  if (pulse.timer>0) pulse.timer = Math.max(0, pulse.timer - dt);
  if (pulse.flash>0) pulse.flash = Math.max(0, pulse.flash - 2.2*dt);

  // skills ticks
  tickNebulizer(dt);
  tickScattergun(dt);
  tickZap(dt);
  tickOmega(dt);
  tickLaser(dt);

  // cooldowns actives
  const sg=player.skills.grenade, se=player.skills.emp, sl=player.skills.laser;
  if (sg.timer>0) sg.timer = Math.max(0, sg.timer - dt);
  if (se.timer>0) se.timer = Math.max(0, se.timer - dt);
  if (sl.timer>0) sl.timer = Math.max(0, sl.timer - dt);

  // movimento
  let mvx=0, mvy=0;
  if (keys['w']) mvy -= 1;
  if (keys['s']) mvy += 1;
  if (keys['a']) mvx -= 1;
  if (keys['d']) mvx += 1;

  if (touchMove.active){
    const dx = touchMove.x - touchMove.startX;
    const dy = touchMove.y - touchMove.startY;
    const maxR=60;
    const len = Math.hypot(dx,dy) || 1;
    const nx = clamp(dx/len, -1, 1) * clamp(len/maxR, 0, 1);
    const ny = clamp(dy/len, -1, 1) * clamp(len/maxR, 0, 1);
    mvx = nx; mvy = ny;
  }

  const mlen = Math.hypot(mvx,mvy) || 1;
  if (mvx!==0 || mvy!==0){ mvx/=mlen; mvy/=mlen; }

  player.x += mvx * player.speed * 60 * dt;
  player.y += mvy * player.speed * 60 * dt;
  player.x = clamp(player.x, player.radius, window.innerWidth - player.radius);
  player.y = clamp(player.y, player.radius, window.innerHeight - player.radius);

  // tiro contínuo
  fireCooldown -= dt;
  const wantShootDesktopHold = (!player.autoFire) && mouseDown;
  const wantShoot = player.autoFire || wantShootDesktopHold;
  if (wantShoot && fireCooldown <= 0){
    fireCooldown = 1 / player.fireRate;
    shootAt(aimAngle());
  }

  // bullets player
  for (let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.x += b.vx * 60 * dt;
    b.y += b.vy * 60 * dt;
    if (b.x<-50 || b.x>window.innerWidth+50 || b.y<-50 || b.y>window.innerHeight+50) bullets.splice(i,1);
  }

  // bullets enemy
  for (let i=enemyBullets.length-1;i>=0;i--){
    const b=enemyBullets[i];
    b.x += b.vx * 60 * dt;
    b.y += b.vy * 60 * dt;

    if (b.x<-80 || b.x>window.innerWidth+80 || b.y<-80 || b.y>window.innerHeight+80){
      enemyBullets.splice(i,1);
      continue;
    }

    const d=Math.hypot(player.x-b.x, player.y-b.y);
    if (d < player.radius + b.radius){
      player.hp -= b.damage * 0.12;
      screenShake = Math.max(screenShake, 9);
      Audio.sfxHit();
      enemyBullets.splice(i,1);
      if (player.hp<=0) gameOver();
    }
  }

  // spawn inimigos
  const spawnBase = 0.028 + (level * 0.004);
  if (Math.random() < spawnBase){
    const r = Math.random();
    let type='chaser';
    if (level>=3 && r<0.20) type='runner';
    if (level>=5 && r>=0.20 && r<0.34) type='tank';
    if (level>=7 && r>=0.34 && r<0.50) type='shooter';
    if (level>=9 && r>=0.50 && r<0.62) type='splitter';
    enemies.push(makeEnemy(type));
  }

  if (bossTimer>=60 && !bossActive){ bossTimer=0; spawnBoss(); }

  // enemies update + colisões
  for (let i=enemies.length-1;i>=0;i--){
    const en=enemies[i];
    en.update(dt);

    const dist = Math.hypot(player.x-en.x, player.y-en.y);
    if (dist < player.radius + en.radius){
      player.hp -= 22 * dt;
      screenShake = Math.max(screenShake, 10);
      Audio.sfxHit();
      if (player.hp<=0) gameOver();
    }

    for (let bi=bullets.length-1; bi>=0; bi--){
      const b=bullets[bi];
      const bd = Math.hypot(en.x-b.x, en.y-b.y);
      if (bd < en.radius + b.radius){
        en.hp -= b.damage;
        createParticle(en.x,en.y,en.color);

        if (b.pierce>0) b.pierce -= 1;
        else bullets.splice(bi,1);

        if (en.hp<=0){ killEnemy(i,en); break; }
      }
    }
  }

  // gems
  for (let i=gems.length-1;i>=0;i--){
    const g=gems[i];
    const dist = Math.hypot(player.x-g.x, player.y-g.y);

    if (dist < player.xpMagnet){
      const a = Math.atan2(player.y-g.y, player.x-g.x);
      g.x += Math.cos(a) * 6.2 * 60 * dt;
      g.y += Math.sin(a) * 6.2 * 60 * dt;
    }

    if (dist < player.radius + 10){
      xp += g.value;
      gems.splice(i,1);
      Audio.sfxPickup();
      if (xp >= xpNextLevel) levelUp();
    }
  }

  // partículas
  for (let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x += p.vx * 60 * dt;
    p.y += p.vy * 60 * dt;
    p.alpha -= 0.9 * dt;
    if (p.alpha<=0) particles.splice(i,1);
  }

  // ui
  hpFill.style.width = `${(player.hp/player.maxHp)*100}%`;
  xpFill.style.width = `${Math.min(1, xp/xpNextLevel)*100}%`;

  // shake decay
  if (screenShake>0.3) screenShake *= (1 - 6*dt);
  else screenShake = 0;
}

function draw(){
  // fallback se erro fatal
  if (fatalErr){
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
    ctx.fillStyle='#000';
    ctx.fillRect(0,0,window.innerWidth,window.innerHeight);
    ctx.fillStyle='#ff416c';
    ctx.font='18px Segoe UI, Tahoma, sans-serif';
    ctx.fillText('ERRO NO JOGO:', 20, 40);
    ctx.fillStyle='#fff';
    ctx.fillText(fatalErr, 20, 70);
    return;
  }

  ctx.fillStyle = 'rgba(5, 5, 5, 0.22)';
  ctx.fillRect(0,0,window.innerWidth,window.innerHeight);

  ctx.save();
  if (screenShake>1) ctx.translate(Math.random()*screenShake - screenShake/2, Math.random()*screenShake - screenShake/2);

  // gems
  for (const g of gems){
    ctx.fillStyle='#00f2fe';
    ctx.beginPath();
    ctx.arc(g.x,g.y,4.2,0,Math.PI*2);
    ctx.fill();
  }

  // player
  ctx.shadowBlur=20;
  ctx.shadowColor=player.color;
  ctx.fillStyle=player.color;
  ctx.beginPath();
  ctx.arc(player.x,player.y,player.radius,0,Math.PI*2);
  ctx.fill();
  ctx.shadowBlur=0;

  
  // Barras de cooldown (discretas) abaixo do player
  const bars = [];
  // Pulso (botão direito) sempre
  bars.push({ name:'PULSO', timer:pulse.timer, cd:pulse.cooldown, readyColor:'rgba(0,242,254,0.85)', cdColor:'rgba(255,65,108,0.85)' });

  // Q/E/R apenas se tiver habilidade
  const g = player.skills.grenade;
  const e = player.skills.emp;
  const l = player.skills.laser;

  if (g.level > 0) bars.push({ name:'Q', timer:g.timer, cd:g.cd, readyColor:'rgba(148, 0, 254, 1)', cdColor:'rgba(255,65,108,0.85)' });
  if (e.level > 0) bars.push({ name:'E', timer:e.timer, cd:e.cd, readyColor:'rgba(254, 0, 152, 0.85)', cdColor:'rgba(255,65,108,0.85)' });
  if (l.level > 0) bars.push({ name:'R', timer:l.timer, cd:l.cd, readyColor:'rgba(144, 254, 0, 0.85)', cdColor:'rgba(255,65,108,0.85)' });

  const barW = 72;
  const barH = 7;
  const gap = 5;
  const bx = player.x - barW / 2;
  let by = player.y + player.radius + 16;

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.font = '10px Segoe UI, Tahoma, sans-serif';

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const pct = (b.timer <= 0) ? 1 : (1 - (b.timer / b.cd));

    // fundo
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx, by, barW, barH);

    // preenchimento
    ctx.fillStyle = (b.timer <= 0) ? b.readyColor : b.cdColor;
    ctx.fillRect(bx, by, barW * pct, barH);

    // label pequeno
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(b.name, bx - 18, by + barH);

    by += barH + gap;
  }
  ctx.restore();

// pulse ring
  if (pulse.flash>0){
    const r = pulse.radius * (1 - pulse.flash*0.15);
    ctx.globalAlpha = 0.28 * pulse.flash;
    ctx.strokeStyle = 'rgba(0, 242, 254, 1)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI*2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // laser draw
  if (laserDraw.active){
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = 'rgba(0, 242, 254, 1)';
    ctx.lineWidth = laserDraw.w;
    ctx.beginPath();
    ctx.moveTo(laserDraw.x1, laserDraw.y1);
    ctx.lineTo(laserDraw.x2, laserDraw.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    laserDraw.active = false;
  }

  // mira (desktop)
  if (!isTouch){
    ctx.strokeStyle='rgba(0,242,254,0.25)';
    ctx.beginPath();
    ctx.moveTo(player.x,player.y);
    ctx.lineTo(mouse.x,mouse.y);
    ctx.stroke();
  }

  // bullets player
  for (const b of bullets){
    ctx.fillStyle=b.color;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);
    ctx.fill();
  }

  // bullets enemy
  for (const b of enemyBullets){
    ctx.fillStyle=b.color;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);
    ctx.fill();
  }

  // omega jets
  if (player.skills.omega.level>0){
    for (const jet of player.skills.omega.jets){
      ctx.globalAlpha=0.9;
      ctx.fillStyle='rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(jet._x, jet._y, 6 + player.skills.omega.level*0.6, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha=1;
    }
  }

  // enemies
  for (const en of enemies) en.draw();

  // particles
  for (const p of particles){
    ctx.globalAlpha=Math.max(0,p.alpha);
    ctx.fillStyle=p.color;
    ctx.fillRect(p.x,p.y,p.size,p.size);
  }
  ctx.globalAlpha=1;

  // joystick visual
  if (touchMove.active){
    const dx=touchMove.x-touchMove.startX;
    const dy=touchMove.y-touchMove.startY;
    const maxR=60;
    const len=Math.hypot(dx,dy)||1;
    const nx=dx/len*Math.min(maxR,len);
    const ny=dy/len*Math.min(maxR,len);

    ctx.globalAlpha=0.35;
    ctx.strokeStyle='rgba(0,242,254,0.8)';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(touchMove.startX,touchMove.startY,maxR,0,Math.PI*2);
    ctx.stroke();

    ctx.fillStyle='rgba(0,242,254,0.6)';
    ctx.beginPath();
    ctx.arc(touchMove.startX+nx, touchMove.startY+ny, 14, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=1;
  }

  ctx.restore();
}

function gameLoop(now){
  const dt = Math.min(0.033, (now-lastTime)/1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// ======================
// Progressão
// ======================
function levelUp(){
  level++;
  xp = 0;
  xpNextLevel = Math.floor(xpNextLevel * 1.2);

  player.maxHp += 8;
  player.hp = Math.min(player.maxHp, player.hp + 12);

  levelText.innerText = `NÍVEL ${level}`;
  Audio.sfxLevel();
  openUpgradeScreen();
}

function gameOver(){
  gameActive = false;
  deathScreen.style.display='flex';
  Audio.stopMusic();
  if (btnPauseMobile) btnPauseMobile.classList.add('hidden');
  document.getElementById('final-stats').innerText =
    `Você sobreviveu por ${timerDisplay.innerText} e coletou ${score} de Éter.`;
}

// timer
setInterval(() => {
  if (gameActive && !paused && !pausedForUpgrade){
    seconds++;
    bossTimer++;
    const m=Math.floor(seconds/60);
    const s=seconds%60;
    timerDisplay.innerText = `${m<10?'0'+m:m}:${s<10?'0'+s:s}`;
  }
}, 1000);

// ======================
// HUD upgrades (texto)
// ======================
let hudAcc = 0;
function updateHud(dt){
  if (!gameActive) return;
  hudAcc += dt;
  if (hudAcc < 0.2) return;
  hudAcc = 0;

  const sk = player.skills;
  const lines = [];

  lines.push(`<b>Dano</b>: ${player.damage}  <b>Tiro/s</b>: ${player.fireRate.toFixed(1)}  <b>Proj</b>: ${player.weaponLevel}  <b>Pierce</b>: ${player.piercing}`);
  lines.push(`<b>Vel</b>: ${player.speed.toFixed(2)}  <b>Magnet</b>: ${Math.floor(player.xpMagnet)}  <b>Regen</b>: ${player.regen.toFixed(1)}/s`);
  lines.push(`<hr style="border:0;border-top:1px solid rgba(255,255,255,0.12);margin:8px 0;">`);

  const s = (name, lvl) => `${lvl>0 ? `✅ ${name} <b>Lv</b> ${lvl}` : `— ${name}`}`;

  lines.push(s('Nebulizador Caótico', sk.nebulizer.level));
  lines.push(s('Canhão de Estilhaços', sk.scattergun.level));
  lines.push(s('Condutor Arcano', sk.zap.level));
  lines.push(s('Esquadrão Ômega', sk.omega.level));

  const cd = (timer, cd) => timer>0 ? `${timer.toFixed(1)}s` : 'PRONTO';
  lines.push(`<hr style="border:0;border-top:1px solid rgba(255,255,255,0.12);margin:8px 0;">`);
  lines.push(`${sk.grenade.level>0 ? `Q Carga Volátil <b>Lv</b> ${sk.grenade.level} — <b>${cd(sk.grenade.timer, sk.grenade.cd)}</b>` : '— Q Carga Volátil'}`);
  lines.push(`${sk.emp.level>0 ? `E EMP <b>Lv</b> ${sk.emp.level} — <b>${cd(sk.emp.timer, sk.emp.cd)}</b>` : '— E EMP'}`);
  lines.push(`${sk.laser.level>0 ? `R Laser <b>Lv</b> ${sk.laser.level} — <b>${cd(sk.laser.timer, sk.laser.cd)}</b>` : '— R Laser'}`);

  lines.push(`<div style="margin-top:6px;opacity:.75">Pulso (botão direito): <b>${pulse.timer>0 ? pulse.timer.toFixed(1)+'s' : 'PRONTO'}</b></div>`);

  hudContent.innerHTML = lines.join('<br>');
}

// hook into game loop by wrapping update
const _update = update;
update = function(dt){
  _update(dt);
  updateHud(dt);
};

// ======================
// Menu / Pause
// ======================
function startGame(){
  // reset state
  gameActive = true;
  paused = false;
  pausedForUpgrade = false;

  score=0; level=1; xp=0; xpNextLevel=100;
  seconds=0; bossTimer=0; bossActive=false;
  screenShake=0; pulse.timer=0; pulse.flash=0;

  enemies.length=0; bullets.length=0; enemyBullets.length=0; particles.length=0; gems.length=0;

  player.x = window.innerWidth/2;
  player.y = window.innerHeight/2;
  player.hp = 100; player.maxHp=100;
  player.speed=4.2; player.weaponLevel=1; player.damage=1; player.bulletSpeed=8; player.bulletRadius=4; player.fireRate=4.5; player.piercing=0;
  player.xpMagnet=100; player.regen=0;

  // reset skills
  for (const k in player.skills){
    const s = player.skills[k];
    if (s.level !== undefined) s.level = 0;
    if (s.t !== undefined) s.t = 0;
    if (s.timer !== undefined) s.timer = 0;
    if (s.beam !== undefined) s.beam = 0;
    if (s.jets) s.jets.length = 0;
  }

  // settings
  if (!isTouch) player.autoFire = chkAutofire.checked;

  deathScreen.style.display='none';
  menuScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  // mostra botão de pause apenas no mobile
  if (btnPauseMobile) btnPauseMobile.classList.toggle('hidden', !isTouch);

  Audio.ensure();
  Audio.startMusic();
  levelText.innerText = 'NÍVEL 1';
  timerDisplay.innerText = '00:00';
}

function togglePause(){
  paused = !paused;
  pauseScreen.classList.toggle('hidden', !paused);
  if (paused) Audio.sfxClick();
}

// Botão de pause na tela (mobile)
if (btnPauseMobile) {
  btnPauseMobile.addEventListener('click', (e) => {
    e.preventDefault();
    if (!gameActive) return;
    if (pausedForUpgrade) return;
    togglePause();
  });
}


btnPlay.addEventListener('click', () => { Audio.sfxClick(); startGame(); });
btnResume.addEventListener('click', () => { Audio.sfxClick(); togglePause(); });
btnBackMenu.addEventListener('click', () => { Audio.sfxClick(); location.reload(); });

btnHow.addEventListener('click', () => { Audio.sfxClick(); menuHow.classList.toggle('hidden'); menuSettings.classList.add('hidden'); });
btnSettings.addEventListener('click', () => { Audio.sfxClick(); menuSettings.classList.toggle('hidden'); menuHow.classList.add('hidden'); });

// ======================
// Start loop
// ======================
window.addEventListener('resize', resizeCanvas);
requestAnimationFrame((t) => { lastTime = t; requestAnimationFrame(gameLoop); });