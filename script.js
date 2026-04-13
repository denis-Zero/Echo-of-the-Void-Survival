const characterScreen = document.getElementById('character-screen');
const characterCards = document.querySelectorAll('.character-card');
const selectCharacterBtns = document.querySelectorAll('.select-character');

// Elementos de UI base
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hpFill = document.getElementById('hp-fill');
const xpFill = document.getElementById('xp-fill');
const levelText = document.getElementById('level-text');
const timerDisplay = document.getElementById('timer');
const weaponNameEl = document.getElementById('weapon-name');
const goldText = document.getElementById('gold-text');
const deathScreen = document.getElementById('death-screen');
const upgradeScreen = document.getElementById('upgrade-screen');
const upgradeCardsEl = document.getElementById('upgrade-cards');
const menuScreen = document.getElementById('menu-screen');
const pauseScreen = document.getElementById('pause-screen');
const hudContent = document.getElementById('hud-content');
const hudUpgrades = document.getElementById('hud-upgrades');
const hudToggle = document.getElementById('hud-toggle');
const btnPauseMobile = document.getElementById('btn-pause-mobile');
const btnWeaponSwap = document.getElementById('btn-weapon-swap');
const btnPlayNova = document.getElementById('btn-play'); // Unificado
const btnResume = document.getElementById('btn-resume');
const btnBackMenu = document.getElementById('btn-back-menu');
const btnHow = document.getElementById('btn-how');
const btnSettings = document.getElementById('btn-settings');
const menuHow = document.getElementById('menu-how');
const menuSettings = document.getElementById('menu-settings');
const chkAutofire = document.getElementById('chk-autofire');
const volMaster = document.getElementById('vol-master');
const volMusic = document.getElementById('vol-music');
const volSfx = document.getElementById('vol-sfx');

// ======================
// Áudio (WebAudio simples)
// ======================
const Audio = (() => {
  let ctxA = null;
  let master = null, music = null, sfx = null;
  let musicNodes = [];
  let enabled = true;
  const buffers = {};

  async function load(key, path) {
    if (window.location.protocol === 'file:') {
      console.warn(`Aviso: Sons externos [${key}] não podem ser carregados via protocolo 'file://'. Use um servidor local (como Live Server). Usando som alternativo.`);
      return false;
    }
    try {
      ensure();
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await ctxA.decodeAudioData(arrayBuffer);
      buffers[key] = audioBuffer;
      return true;
    } catch (e) {
      console.warn(`Falha ao carregar áudio [${key}]:`, path);
      return false;
    }
  }

  function play(key, vol = 1, pitch = 1) {
    if (!enabled || !ctxA || !buffers[key]) return;
    const src = ctxA.createBufferSource();
    src.buffer = buffers[key];
    src.playbackRate.value = pitch;
    const g = ctxA.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(sfx);
    src.start();
  }

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

  function setMaster(v) { if (!master) return; master.gain.value = v; }
  function setMusic(v) { if (!music) return; music.gain.value = v; }
  function setSfx(v) { if (!sfx) return; sfx.gain.value = v; }

  function beep(freq, dur = 0.08, gain = 0.12, type = 'sine') {
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

  function noiseBurst(dur = 0.12, gain = 0.12) {
    if (!enabled) return;
    ensure();
    const bufferSize = Math.floor(ctxA.sampleRate * dur);
    const buffer = ctxA.createBuffer(1, bufferSize, ctxA.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctxA.createBufferSource();
    src.buffer = buffer;
    const g = ctxA.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(sfx);
    src.start();
  }

  function startMusic() {
    // Música de fundo removida a pedido
    if (!enabled) return;
    ensure();
    stopMusic();
  }

  function stopMusic() {
    if (!ctxA) return;
    for (const n of musicNodes) { try { if (n.stop) n.stop(); } catch { } }
    musicNodes = [];
  }

  return {
    enable(v) { enabled = v; },
    ensure,
    load,
    play,
    setMaster, setMusic, setSfx,
    startMusic, stopMusic,
    sfxShoot() { if (buffers.laser) play('laser', 0.6); else beep(540, 0.03, 0.06, 'square'); },
    sfxHit() { noiseBurst(0.06, 0.08); },
    sfxPickup() { beep(880, 0.05, 0.08, 'triangle'); },
    sfxLevel() { beep(660, 0.08, 0.12, 'sine'); beep(990, 0.10, 0.10, 'sine'); },
    sfxExplode() { noiseBurst(0.14, 0.16); },
    sfxZap() { if (buffers.laser) play('laser', 0.8, 0.8); else beep(1200, 0.05, 0.08, 'sawtooth'); },
    sfxPulse() { noiseBurst(0.10, 0.14); beep(220, 0.08, 0.06, 'sine'); },
    sfxClick() { beep(520, 0.04, 0.06, 'triangle'); },
  };
})();

// Variável para armazenar a arma selecionada
let selectedWeapon = 'plasma'; // Valor padrão

// Sistema de modos de jogo e dificuldades
let gameMode = '10min'; // '10min', 'infinito', '5min'
let difficulty = 'facil'; // 'facil', 'medio', 'dificil'
let gameTimeLimit = 600; // 10 minutos em segundos
let gameTimeElapsed = 0;
let gameTimerActive = false;

// Configurações de balanceamento por dificuldade
const difficultySettings = {
  facil: {
    enemyHpMultiplier: 1.2,
    enemySpeedMultiplier: 1.1,
    enemySpawnRate: 0.9,
    playerDamageMultiplier: 1.0,
    xpGainMultiplier: 1.0,
    enemyDamageMultiplier: 1.2
  },
  medio: {
    enemyHpMultiplier: 1.5,
    enemySpeedMultiplier: 1.3,
    enemySpawnRate: 1.2,
    playerDamageMultiplier: 0.9,
    xpGainMultiplier: 1.0,
    enemyDamageMultiplier: 1.5
  },
  dificil: {
    enemyHpMultiplier: 2.5,
    enemySpeedMultiplier: 1.6,
    enemySpawnRate: 1.5,
    playerDamageMultiplier: 0.7,
    xpGainMultiplier: 0.8,
    enemyDamageMultiplier: 2.5
  }
};

// Configurações de tempo por modo de jogo
const gameModeSettings = {
  '5min': { timeLimit: 300, label: '5 Minutos' },
  '10min': { timeLimit: 600, label: '10 Minutos' },
  'infinito': { timeLimit: null, label: 'Infinito' },
  'aventura': { timeLimit: 60, label: 'Modo Aventura' } // 1 min por fase normal
};

// Cores para cada tipo de arma
const weaponColors = {
  plasma: '#1e00fefa',     // Azul (padrão)
  shotgun: '#ffe600ff',    // Amarelo
  laser: '#fe0000ff',      // vermenho
  railgun: '#8400ffff',    // Roxo
  flamethrower: '#ff7700ff' // Laranja
};

// Sistema de imagens para cartas
const cardImages = {};
const imageLoadPromises = [];

// Função para carregar imagens das cartas
function loadCardImage(id, imagePath) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      cardImages[id] = img;
      resolve(true);
    };
    img.onerror = () => {
      console.log(`Imagem não encontrada: ${imagePath}`);
      resolve(false); // Não falha, apenas não carrega a imagem
    };
    img.src = imagePath;
  });
}

// Carregar imagens para todas as habilidades e armas
const cardImageConfigs = [
  // Habilidades
  { id: 'skill_nebulizer', path: 'imagens/card_nebulizer.png' },
  { id: 'skill_scattergun', path: 'imagens/card_scattergun.png' },
  { id: 'skill_grenade', path: 'imagens/card_grenade.png' },
  { id: 'skill_emp', path: 'imagens/card_emp.png' },
  { id: 'skill_laser', path: 'imagens/card_laser.png' },
  { id: 'skill_zap', path: 'imagens/card_zap.png' },
  { id: 'skill_orbital', path: 'imagens/card_orbital.png' },
  { id: 'skill_omega', path: 'imagens/card_omega.png' },
  { id: 'skill_vampirism', path: 'imagens/card_vampirism.png' },

  // Armas
  { id: 'plasma', path: 'imagens/plasma_padrão.png' },
  { id: 'unlock_shotgun', path: 'imagens/card_shotgun.png' },
  { id: 'unlock_laser', path: 'imagens/card_laser_weapon.png' },
  { id: 'unlock_railgun', path: 'imagens/card_railgun.png' },
  { id: 'unlock_flamethrower', path: 'imagens/card_flamethrower.png' },

  // Upgrades básicos - OFENSIVA
  { id: 'damage', path: 'imagens/card_damage.png' },
  { id: 'fire_rate', path: 'imagens/card_fire_rate.png' },
  { id: 'more_projectiles', path: 'imagens/card_projectiles.png' },
  { id: 'bullet_speed', path: 'imagens/card_bullet_speed.png' },
  { id: 'bullet_size', path: 'imagens/card_bullet_size.png' },

  // Upgrades básicos - DEFESA
  { id: 'health', path: 'imagens/card_health.png' },
  { id: 'regen', path: 'imagens/card_regen.png' },
  { id: 'max_hp', path: 'imagens/max_hp.png' },

  // Upgrades básicos - TÁTICO/MOBILIDADE/UTIL 
  { id: 'piercing', path: 'imagens/card_piercing.png' },
  { id: 'move_speed', path: 'imagens/card_move_speed.png' },
  { id: 'magnet', path: 'imagens/card_magnet.png' }
];

// Iniciar carregamento das imagens de card
cardImageConfigs.forEach(config => {
  imageLoadPromises.push(loadCardImage(config.id, config.path));
});

// ======================
// Sistema de Sprites do Jogo (Inimigos, Player, Background)
// ======================
const sprites = {};
const spritePaths = {
  // Cenário
  bg_space: 'assets/bg_space_nebula_1775437941445.png',

  // Players
  player_plasma: 'assets/player_plasma_1775437852308.png',
  player_shotgun: 'assets/player_shotgun_1775437865578.png',
  player_laser: 'assets/player_laser_1775437877276.png',
  player_railgun: 'assets/player_railgun_1775437903025.png',
  player_flamethrower: 'assets/player_flame_1775437916224.png',

  // Inimigos
  enemy_basic: 'assets/enemy_basic_1775437928731.png',
  enemy_shooter: 'assets/enemy_shooter_1775437960860.png',
  enemy_tank: 'assets/enemy_tank_1775437972173.png',
  enemy_elite: 'assets/enemy_elite_1775437985362.png',
  enemy_boss: 'assets/enemy_boss_1775437996795.png',

  // Coletáveis
  item_xp: 'assets/item_xp_1775438015893.png',
  item_coin: 'assets/item_coin_1775438028791.png',
  item_rare: 'assets/item_rare_1775438040897.png',
  item_heart: 'assets/item_heart_1775438054391.png'
};

function loadSprite(key, path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      sprites[key] = img;
      resolve();
    };
    img.onerror = () => {
      console.warn('Falha ao carregar sprite:', path);
      resolve(); // Continua para não travar o jogo 
    };
    img.src = path;
  });
}

// Inicia o fetch das sprites do game
for (const [key, path] of Object.entries(spritePaths)) {
  imageLoadPromises.push(loadSprite(key, path));
}

// Inicia o fetch dos sons externos do game
const soundPaths = {
  laser: 'sons/laser.mp3'
};
for (const [key, path] of Object.entries(soundPaths)) {
  imageLoadPromises.push(Audio.load(key, path));
}

// Função para gerar ícone padrão baseado na categoria
function getDefaultIconHtml(upgrade) {
  const tag = upgrade.tag || '';
  const iconMap = {
    'OFENSIVA': '⚔️',
    'DEFESA': '🛡️',
    'TÁTICO': '🎯',
    'MOBILIDADE': '🏃',
    'UTIL': '🔧',
    'HABILIDADE': '✨',
    'ARMA': '🔫'
  };

  // Encontrar a melhor correspondência
  let icon = '⭐';
  for (const [key, value] of Object.entries(iconMap)) {
    if (tag.includes(key)) {
      icon = value;
      break;
    }
  }

  return `<div class="upgrade-icon-placeholder">${icon}</div>`;
}

// ======================
// Funções para modos e dificuldades
// ======================

function setGameMode(mode) {
  gameMode = mode;
  const modeSettings = gameModeSettings[mode];
  gameTimeLimit = modeSettings.timeLimit;

  // Atualizar botões da UI
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
    }
  });

  console.log(`Modo de jogo alterado para: ${modeSettings.label}`);
}

function setDifficulty(level) {
  difficulty = level;

  // Atualizar botões da UI
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.difficulty === level) {
      btn.classList.add('active');
    }
  });

  console.log(`Dificuldade alterada para: ${level}`);
}

function applyDifficultySettings() {
  const settings = difficultySettings[difficulty];

  // Aplicar multiplicadores globais
  window.difficultyMultipliers = {
    enemyHp: settings.enemyHpMultiplier,
    enemySpeed: settings.enemySpeedMultiplier,
    enemySpawnRate: settings.enemySpawnRate,
    playerDamage: settings.playerDamageMultiplier,
    xpGain: settings.xpGainMultiplier,
    enemyDamageMultiplier: settings.enemyDamageMultiplier
  };

  console.log(`Configurações de dificuldade aplicadas: ${difficulty}`);
}

function updateGameTimer(deltaTime) {
  if (gameActive && !paused && !pausedForUpgrade) {
    gameTimeElapsed += deltaTime;
    bossTimer += deltaTime; // Boss baseado em tempo real agora
    seconds = Math.floor(gameTimeElapsed); // Manter compatibilidade com variável global

    // Modo Infinito: Contagem Progressiva
    if (gameTimeLimit === null) {
      const minutes = Math.floor(gameTimeElapsed / 60);
      const secs = Math.floor(gameTimeElapsed % 60);
      if (timerDisplay) {
        timerDisplay.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
      }
    }
    // Modos com Tempo: Contagem Regressiva
    else {
      const timeLeft = Math.max(0, gameTimeLimit - gameTimeElapsed);
      const minutes = Math.floor(timeLeft / 60);
      const secs = Math.floor(timeLeft % 60);

      if (timerDisplay) {
        timerDisplay.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
      }

      // Verificar vitória
      if (timeLeft <= 0) {
        endGameWithVictory();
      }
    }
  }
}

function startGameTimer() {
  gameTimeElapsed = 0;
  gameTimerActive = true;
  if (timerDisplay) {
    timerDisplay.style.display = 'block';
  }
}

function stopGameTimer() {
  gameTimerActive = false;
  if (timerDisplay) {
    timerDisplay.style.display = 'none';
  }
}

function endGameWithVictory() {
  // Evitar chamadas múltiplas ou se o jogo já acabou
  if (!gameActive) return;

  if (gameMode === 'aventura') {
    endGameWithPhaseClear();
    return;
  }

  try {
    stopGameTimer();
    gameActive = false;

    // Salvar ouro e pedras raras
    totalGold += gold;
    totalRareStones += rareStones;
    saveSettings({ totalGold, totalRareStones });

    // Reutilizar tela de morte mas com estilo de vitória
    if (deathScreen) {
      const title = deathScreen.querySelector('h1');
      if (title) {
        title.innerText = 'MISSÃO CUMPRIDA';
        title.style.color = '#00e676'; // Verde
      }

      const stats = document.getElementById('final-stats');
      if (stats) {
        const modeLabel = (gameModeSettings[gameMode] && gameModeSettings[gameMode].label) ? gameModeSettings[gameMode].label : gameMode;
        stats.innerHTML = `Sobreviveu por: ${modeLabel}<br>Nível alcançado: ${level}<br>Inimigos derrotados: ${score}<br>🪙 Ouro: ${gold} &nbsp;&nbsp; 💎 Diamantes: ${rareStones}`;
      }


      // Forçar exibição e z-index alto para garantir visibilidade
      deathScreen.style.display = 'flex';
      deathScreen.style.zIndex = '10000';
      deathScreen.style.visibility = 'visible';
      deathScreen.style.opacity = '1';
    }

    // Esconder controles mobile e parar música
    if (btnPauseMobile) btnPauseMobile.classList.add('hidden');
    if (btnWeaponSwap) btnWeaponSwap.classList.add('hidden');

    try {
      if (typeof Audio !== 'undefined') {
        Audio.stopMusic();
        if (Audio.sfxLevel) Audio.sfxLevel();
      }
    } catch (e) {
      console.error("Audio error:", e);
    }
  } catch (err) {
    console.error("Erro em endGameWithVictory:", err);
    // Tentar mostrar a tela de qualquer jeito em caso de erro
    if (deathScreen) {
      deathScreen.style.display = 'flex';
      deathScreen.style.zIndex = '10000';
    }
  }
}

// ======================
// Canvas + UI
// ======================


// ======================
// Configurações persistentes (localStorage)
// ======================
const SETTINGS_KEY = 'eco_do_vazio_settings_v1';

// Dados dos Mundos e Fases do Modo Aventura
const adventureWorldData = [
  {
    name: "Cinturão de Asteroides",
    bg: "assets/bg_space_nebula_1775437941445.png",
    bossWeapon: "shotgun",
    bossName: "CENTINELA ESPINGARDA",
    enemyMult: 1.0
  },
  {
    name: "Nebulosa Proibida",
    bg: "assets/bg_nebula_green.png", // placeholders que buscaremos ou geraremos
    bossWeapon: "laser",
    bossName: "EX-MACHINE LASER",
    enemyMult: 1.2
  },
  {
    name: "Vazio Profundo",
    bg: "assets/bg_nebula_blue.png",
    bossWeapon: "railgun",
    bossName: "CARRASCO RAILGUN",
    enemyMult: 1.5
  },
  {
    name: "Zona de Expulsão",
    bg: "assets/bg_nebula_red.png",
    bossWeapon: "flamethrower",
    bossName: "INCINERADOR FLAMETHROWER",
    enemyMult: 1.8
  },
  {
    name: "Núcleo da Fenda",
    bg: "assets/bg_void_core.png",
    bossWeapon: "plasma", // Versão elite da inicial
    bossName: "REFLEXO DE PLASMA",
    enemyMult: 2.2
  },
  {
    name: "O Limiar do Nada",
    bg: "assets/bg_space_nebula_1775437941445.png",
    bossWeapon: "default_boss",
    bossName: "O DEVORADOR DO VAZIO",
    enemyMult: 2.8
  }
];

let totalGold = 0;       // Ouro total acumulado (banco)
let totalRareStones = 0; // Pedras raras acumuladas (banco)
let permanentUpgrades = {
  maxHp: 0, damage: 0, goldGain: 0, regen: 0,
  masteredUpgrades: [],
  unlockedShips: ['plasma'] // Começa só com Plasma
};

// Progresso do Modo Aventura
let adventureState = {
  active: false,
  currentWorld: 0, // 0 a 5
  currentPhase: 0, // 0 a 4 (fase 4 é o boss)
  maxWorldReached: 0, // Maior mundo desbloqueado
  killsThisPhase: 0,
  killGoalForUpgrade: 50,
  driftTimer: 20 // Segundos para a próxima caixa de suprimentos
};

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
    // Garantir que variáveis globais sejam capturadas se não passadas no partial
    if (typeof totalGold !== 'undefined' && partial.totalGold === undefined) partial.totalGold = totalGold;
    if (typeof totalRareStones !== 'undefined' && partial.totalRareStones === undefined) partial.totalRareStones = totalRareStones;
    if (typeof permanentUpgrades !== 'undefined' && partial.permanentUpgrades === undefined) partial.permanentUpgrades = permanentUpgrades;
    if (typeof adventureState !== 'undefined' && partial.adventureState === undefined) partial.adventureState = adventureState;

    const next = { ...cur, ...partial };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));

    // Sincronização em Nuvem (Firebase)
    if (typeof window.fbSaveSettingsToCloud === 'function') {
      window.fbSaveSettingsToCloud(next);
    }
  } catch (e) { console.error("Erro salvando", e) }
}

// Global Hooks providenciados para o firebase-db.js
window.mergeCloudSave = (cloudData) => {
  if (cloudData) {
    if (typeof cloudData.totalGold === 'number') totalGold = cloudData.totalGold;
    if (typeof cloudData.totalRareStones === 'number') totalRareStones = cloudData.totalRareStones;
    if (cloudData.permanentUpgrades) {
      permanentUpgrades = { ...permanentUpgrades, ...cloudData.permanentUpgrades };
      // Garantir que a lista de naves não se perca ou reset
      if (!permanentUpgrades.unlockedShips) permanentUpgrades.unlockedShips = ['plasma'];
    }
    if (cloudData.adventureState) adventureState = { ...adventureState, ...cloudData.adventureState };

    if (typeof renderShop === 'function') renderShop();
    if (typeof renderHangar === 'function') renderHangar();

    if (typeof showFloatingText === 'function') {
      showFloatingText('NUVEM SINCRONIZADA ☁️', window.innerWidth / 2 - 80, 80, '#00f2fe');
    }
  }
};

window.forcePushLocalToCloud = () => {
  saveSettings({});
};

// Aplica valores iniciais
const saved = loadSettings();
if (saved) {
  if (typeof saved.hudCollapsed === 'boolean' && hudUpgrades) {
    hudUpgrades.classList.toggle('collapsed', saved.hudCollapsed);
  }
  if (typeof saved.autofire === 'boolean') chkAutofire.checked = saved.autofire;
  if (typeof saved.volMaster === 'number') volMaster.value = String(saved.volMaster);
  if (typeof saved.volMusic === 'number') volMusic.value = String(saved.volMusic);
  if (typeof saved.volSfx === 'number') volSfx.value = String(saved.volSfx);

  if (typeof saved.totalGold === 'number') totalGold = saved.totalGold;
  if (typeof saved.totalRareStones === 'number') totalRareStones = saved.totalRareStones;
  if (saved.permanentUpgrades) {
    permanentUpgrades = { ...permanentUpgrades, ...saved.permanentUpgrades };
    if (!permanentUpgrades.unlockedShips) permanentUpgrades.unlockedShips = ['plasma'];
  }
  if (saved.adventureState) adventureState = { ...adventureState, ...saved.adventureState };
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
let gold = 0;        // Ouro da partida atual
let rareStones = 0;  // Pedras raras da partida atual

const shopConfig = [
  { id: 'maxHp', name: 'Blindagem Reforçada', desc: '+10 Vida Inicial', cost: 100, costScale: 1.5, max: 10, icon: '🛡️' },
  { id: 'damage', name: 'Núcleo de Plasma', desc: '+10% Dano Base', cost: 150, costScale: 1.5, max: 10, icon: '⚔️' },
  { id: 'goldGain', name: 'Scanner de Minérios', desc: '+10% Ouro Encontrado', cost: 200, costScale: 1.6, max: 5, icon: '💰' },
  { id: 'regen', name: 'Nanobots de Reparo', desc: '+0.5 Regen/s', cost: 300, costScale: 1.5, max: 5, icon: '❤️' }
];
let rerollCost = 20;
let upgradeCost = 15;  // Custo de ouro para selecionar um upgrade (aumenta após cada compra)
let freeRerolls = 2; // Rerolls grátis no início da partida
let freeUpgrades = 1; // Primeiro upgrade grátis
let goldRushTimer = 0; // Temporizador estado febre do ouro
let powerups = []; // Coletáveis especiais
let nextLevelLockedIds = []; // IDs travados para o próximo nível
let upgradePickCount = {}; // Conta quantas vezes cada upgrade foi pego na run atual

// ======================
// Configuração da loja de upgrades (desbloqueados por maestía)
// ======================
const upgradeShopItems = [
  // Stats ofensivos
  { id: 'perm_damage', unlockId: 'damage', icon: '⚔️', name: 'Amplificador Permanente', desc: '+0.5 dano base por rank', cost: 350, costScale: 1.6, max: 10 },
  { id: 'perm_fire_rate', unlockId: 'fire_rate', icon: '🔥', name: 'Condensador Overclock', desc: '+8% taxa de tiro por rank', cost: 300, costScale: 1.5, max: 10 },
  { id: 'perm_more_proj', unlockId: 'more_projectiles', icon: '💎', name: 'Dispersor Permanente', desc: '+1 projétil por rank', cost: 500, costScale: 2.0, max: 5 },
  { id: 'perm_bullet_speed', unlockId: 'bullet_speed', icon: '💨', name: 'Cânhao de Íons Mk.II', desc: '+10% vel. projétil por rank', cost: 220, costScale: 1.4, max: 8 },
  { id: 'perm_bullet_size', unlockId: 'bullet_size', icon: '🔵', name: 'Núcleo Expandido Mk.II', desc: '+15% tamanho do proj by rank', cost: 220, costScale: 1.4, max: 6 },
  { id: 'perm_piercing', unlockId: 'piercing', icon: '🔷', name: 'Perfuração Permanente', desc: '+1 perfuração por rank', cost: 600, costScale: 2.0, max: 5 },
  // Stats defensivos/util
  { id: 'perm_move_speed', unlockId: 'move_speed', icon: '🏃', name: 'Propulsores Permanentes', desc: '+8% veloc. movimento por rank', cost: 25, costScale: 1.5, max: 8 },
  { id: 'perm_max_hp', unlockId: 'max_hp', icon: '🛡️', name: 'Blindagem Avançada', desc: '+15 HP máximo por rank', cost: 18, costScale: 1.4, max: 10 },
  { id: 'perm_regen', unlockId: 'regen', icon: '❤️', name: 'Nanobots Avançados', desc: '+0.8 HP/s por rank', cost: 28, costScale: 1.5, max: 8 },
  { id: 'perm_magnet', unlockId: 'magnet', icon: '🧲', name: 'Ímã de Éter Permanente', desc: '+25% alcance de coleta por rank', cost: 18, costScale: 1.4, max: 6 },
  // Habilidades
  { id: 'perm_skill_nebulizer', unlockId: 'skill_nebulizer', icon: '💧', name: 'Nebulizador Integrado', desc: 'Inicia runs com Nebulizador Lv+', cost: 60, costScale: 2.0, max: 3 },
  { id: 'perm_skill_scattergun', unlockId: 'skill_scattergun', icon: '💥', name: 'Estilhaços Integrado', desc: 'Inicia runs com Estilhaços Lv+', cost: 60, costScale: 2.0, max: 3 },
  { id: 'perm_skill_grenade', unlockId: 'skill_grenade', icon: '💣', name: 'Granada Integrada', desc: 'Inicia runs com Carga Volátil Lv+', cost: 70, costScale: 2.0, max: 3 },
  { id: 'perm_skill_emp', unlockId: 'skill_emp', icon: '⚡', name: 'EMP Integrado', desc: 'Inicia runs com EMP Lv+', cost: 70, costScale: 2.0, max: 3 },
  { id: 'perm_skill_laser', unlockId: 'skill_laser', icon: '🔴', name: 'Laser Integrado', desc: 'Inicia runs com Laser Lv+', cost: 80, costScale: 2.0, max: 3 },
  { id: 'perm_skill_zap', unlockId: 'skill_zap', icon: '⚡', name: 'Condutor Arcano Integrado', desc: 'Inicia runs com Zap Lv+', cost: 65, costScale: 2.0, max: 3 },
  { id: 'perm_skill_orbital', unlockId: 'skill_orbital', icon: '🌊', name: 'Escudo Orbital Integrado', desc: 'Inicia runs com Orbital Lv+', cost: 65, costScale: 2.0, max: 3 },
  { id: 'perm_skill_vampirism', unlockId: 'skill_vampirism', icon: '🩸', name: 'Vampirismo Permanente', desc: 'Inicia runs com Vampirismo Lv+', cost: 75, costScale: 2.0, max: 3 },
  { id: 'perm_skill_omega', unlockId: 'skill_omega', icon: '🟢', name: 'Esquadrão Ômega Integrado', desc: 'Inicia runs com Omega Lv+', cost: 90, costScale: 2.0, max: 3 },
];

let level = 1;
let xp = 0;
let xpNextLevel = 100;

let seconds = 0;
let screenShake = 0;

let bossTimer = 0;
let bossActive = false;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ======================
// Sistema de Spatial Partitioning (Grid)
// ======================
const GRID_SIZE = 180;
const collisionGrid = new Map();

function updateCollisionGrid() {
  collisionGrid.clear();
  for (const en of enemies) addToGrid(en, 'enemy');
  for (const b of bullets) addToGrid(b, 'bullet');
}

function addToGrid(entity, type) {
  const gridX = Math.floor(entity.x / GRID_SIZE);
  const gridY = Math.floor(entity.y / GRID_SIZE);
  const key = `${gridX},${gridY}`;
  if (!collisionGrid.has(key)) collisionGrid.set(key, []);
  collisionGrid.get(key).push({ entity, type });
}

function getNearbyEntities(x, y, typeFilter) {
  const gridX = Math.floor(x / GRID_SIZE);
  const gridY = Math.floor(y / GRID_SIZE);
  const results = [];

  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const key = `${gridX + i},${gridY + j}`;
      if (collisionGrid.has(key)) {
        const cell = collisionGrid.get(key);
        for (const item of cell) {
          if (item.type === typeFilter) results.push(item.entity);
        }
      }
    }
  }
  return results;
}

// ======================
// Sistema de Armas
// ======================
const weaponSystem = {
  currentWeapon: 'plasma',
  unlockedWeapons: { plasma: true, shotgun: false, laser: false, railgun: false, flamethrower: false },
  weaponStats: {
    plasma: { name: "Plasma", damageMul: 1.0, fireRateMul: 1.0, speedMul: 1.0, radiusMul: 1.0, color: '#002fffff', pattern: 'single', unlockLevel: 1 },
    shotgun: { name: "Espingarda", damageMul: 0.75, fireRateMul: 0.4, speedMul: 1.1, radiusMul: 0.8, color: '#fff200ff', pattern: 'spread', spreadCount: 5, spreadAngle: 0.6, unlockLevel: 3 },
    laser: { name: "Laser", damageMul: 0.35, fireRateMul: 2.5, speedMul: 1.8, radiusMul: 1.2, color: '#ff0000ff', pattern: 'beam', unlockLevel: 5 },
    railgun: { name: "Railgun", damageMul: 3.5, fireRateMul: 0.3, speedMul: 2.5, radiusMul: 1.5, color: '#8400ffff', pattern: 'piercing', pierceCount: 4, unlockLevel: 8 },
    flamethrower: { name: "Lança-chamas", damageMul: 0.08, fireRateMul: 15.0, speedMul: 0.8, radiusMul: 1.2, color: '#ff7700ff', pattern: 'stream', unlockLevel: 12 }
  }
};

function switchWeapon(key) {
  if (weaponSystem.unlockedWeapons[key]) {
    weaponSystem.currentWeapon = key;
    const w = weaponSystem.weaponStats[key];
    Audio.sfxClick();
    updateHud(0); // Força update HUD
    if (typeof player !== 'undefined' && player.x) {
      showFloatingText(w.name.toUpperCase() + ' EQUIPADO', player.x, player.y, w.color);
    }
  }
}

function cycleWeapon() {
  const order = ['plasma', 'shotgun', 'laser', 'railgun', 'flamethrower'];
  let idx = order.indexOf(weaponSystem.currentWeapon);
  let nextIdx = idx;

  // procura a próxima desbloqueada
  for (let i = 0; i < order.length; i++) {
    nextIdx = (nextIdx + 1) % order.length;
    if (weaponSystem.unlockedWeapons[order[nextIdx]]) {
      switchWeapon(order[nextIdx]);
      return;
    }
  }
}

if (btnWeaponSwap) {
  btnWeaponSwap.addEventListener('click', (e) => {
    e.stopPropagation();
    cycleWeapon();
  });
  btnWeaponSwap.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
}

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

  autoAim: true,
  autoFire: true,

  skills: {
    nebulizer: { level: 0, t: 0 },          // passiva C
    scattergun: { level: 0, t: 0 },         // passiva C
    grenade: { level: 0, cd: 6.0, timer: 0 }, // Q
    emp: { level: 0, cd: 10.0, timer: 0 },    // E
    laser: { level: 0, cd: 12.0, timer: 0, beam: 0 }, // R
    zap: { level: 0, t: 0 },                // passiva A
    omega: { level: 0, t: 0, jets: [] },     // passiva S
    orbital: { level: 0, count: 0, angle: 0, damage: 0 }, // passiva Orbital
    vampirism: { level: 0, chance: 0, healAmount: 0 } // passiva Vampirismo
  },
  laserEnergy: 100,
  laserMaxEnergy: 100,
  isLaserOverheated: false,
  shotgunAmmo: 3,
  shotgunMaxAmmo: 3,
  shotgunReloadTimer: 0
};

// ======================
// Input
// ======================
const keys = {};
const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let mouseDown = false;

window.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;

  // Esconde o cursor virtual se o mouse real se mexer
  if (typeof gamepad !== 'undefined') {
    gamepad.virtualCursorActive = false;
    const vCursor = document.getElementById('virtual-cursor');
    if (vCursor) vCursor.style.display = 'none';
  }
});

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) {
    if (gameActive && !paused && !pausedForUpgrade) cycleWeapon();
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
});
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

  if (k === '1') switchWeapon('plasma');
  if (k === '2') switchWeapon('shotgun');
  if (k === '3') switchWeapon('laser');
  if (k === '4') switchWeapon('railgun');
  if (k === '5') switchWeapon('flamethrower');
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// Mobile: joystick + auto aim/fire
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
if (isTouch) { player.autoAim = true; player.autoFire = true; }

const touchMove = { active: false, id: null, startX: 0, startY: 0, x: 0, y: 0 };
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
  if (e.pointerId === touchMove.id) { touchMove.active = false; touchMove.id = null; }
});

// ======================
// Gamepad (Controle)
// ======================
const gamepad = {
  connected: false,
  index: -1,
  prevButtons: [],
  leftX: 0, leftY: 0,
  rightX: 0, rightY: 0,
  DEADZONE: 0.18,
  triggerPressed: false,
  aimingWithStick: false,
  aimAngleStick: 0,
  // Mouse virtual
  virtualCursorActive: false,
  cursorSensitivity: 12
};

window.addEventListener('gamepadconnected', (e) => {
  gamepad.connected = true;
  gamepad.index = e.gamepad.index;
  gamepad.prevButtons = Array(e.gamepad.buttons.length).fill(false);
  showFloatingText('🎮 CONTROLE CONECTADO!', window.innerWidth / 2 - 100, 80, '#00e676');
  console.log('[Gamepad] Conectado:', e.gamepad.id);
});

window.addEventListener('gamepaddisconnected', (e) => {
  if (e.gamepad.index === gamepad.index) {
    gamepad.connected = false;
    gamepad.index = -1;
    gamepad.leftX = 0; gamepad.leftY = 0;
    gamepad.rightX = 0; gamepad.rightY = 0;
    gamepad.triggerPressed = false;
    gamepad.aimingWithStick = false;
    showFloatingText('🎮 Controle desconectado', window.innerWidth / 2 - 100, 80, '#ff5252');
  }
});

function applyDeadzone(v, dz) {
  if (Math.abs(v) < dz) return 0;
  return (v - Math.sign(v) * dz) / (1 - dz);
}

// Botões anteriores para detecção de borda (pressionamento único)
let gpPrevStart = false;
let gpPrevB = false;
let gpPrevX = false;
let gpPrevY = false;
let gpPrevA = false;
let gpPrevLB = false;

function pollGamepad() {
  if (!gamepad.connected) return;

  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gamepads[gamepad.index];
  if (!gp) return;

  // ── Analógicos ──
  const lx = applyDeadzone(gp.axes[0] || 0, gamepad.DEADZONE);
  const ly = applyDeadzone(gp.axes[1] || 0, gamepad.DEADZONE);
  const rx = applyDeadzone(gp.axes[2] || 0, gamepad.DEADZONE);
  const ry = applyDeadzone(gp.axes[3] || 0, gamepad.DEADZONE);
  gamepad.leftX = lx;
  gamepad.leftY = ly;
  gamepad.rightX = rx;
  gamepad.rightY = ry;

  // Analógico direito → Move Mouse Virtual E Mira
  const stickMag = Math.hypot(rx, ry);
  if (stickMag > 0.1) {
    gamepad.aimingWithStick = true;
    gamepad.aimAngleStick = Math.atan2(ry, rx);

    // Movimentação do cursor
    mouse.x = clamp(mouse.x + rx * gamepad.cursorSensitivity, 0, window.innerWidth);
    mouse.y = clamp(mouse.y + ry * gamepad.cursorSensitivity, 0, window.innerHeight);
    gamepad.virtualCursorActive = true;

    // Mostra o cursor visual
    const vCursor = document.getElementById('virtual-cursor');
    if (vCursor) {
      vCursor.style.display = 'block';
      vCursor.style.left = mouse.x + 'px';
      vCursor.style.top = mouse.y + 'px';
    }
  } else {
    gamepad.aimingWithStick = false;
  }

  // ── Lê TODOS os botões primeiro ──
  const b = gp.buttons;
  const rt = b[7] ? (b[7].value > 0.3 || b[7].pressed) : false;
  const aNow = b[0] ? b[0].pressed : false;
  const bNow = b[1] ? b[1].pressed : false;
  const xNow = b[2] ? b[2].pressed : false;
  const yNow = b[3] ? b[3].pressed : false;
  const lbNow = b[4] ? b[4].pressed : false;
  const startNow = b[9] ? b[9].pressed : false;
  const dpLeft = b[14] ? b[14].pressed : false;
  const dpRight = b[15] ? b[15].pressed : false;

  // Gatilho direito → atirar
  gamepad.triggerPressed = rt;

  // ── Botão A (Seleção/Click) ──
  if (aNow && !gpPrevA) {
    // 1. Se o overlay de fim de fase estiver visível, clica no botão de upgrade automaticamente
    const stageClearOverlay = document.getElementById('stage-clear-overlay');
    if (stageClearOverlay && !stageClearOverlay.classList.contains('hidden')) {
      const btnUpgrade = document.getElementById('btn-stage-upgrade');
      if (btnUpgrade) {
        Audio.sfxClick();
        btnUpgrade.click();
        return;
      }
    }

    // 2. Se o overlay da loja mundial estiver visível, clica no botão de Próximo Mundo automaticamente
    const worldShopOverlay = document.getElementById('world-shop-overlay');
    if (worldShopOverlay && !worldShopOverlay.classList.contains('hidden')) {
      const btnNext = document.getElementById('btn-next-world');
      // Só clica se não estiver em cima de um item da loja (prioridade ao cursor)
      const elUnderCursor = document.elementFromPoint(mouse.x, mouse.y);
      if (btnNext && (!elUnderCursor || !elUnderCursor.classList.contains('shop-buy-btn'))) {
        Audio.sfxClick();
        btnNext.click();
        return;
      }
    }

    // 3. Comportamento padrão: clique no cursor ou habilidade
    if (gamepad.virtualCursorActive) {
      const el = document.elementFromPoint(mouse.x, mouse.y);
      if (el) el.click();
    } else {
      if (gameActive && !paused && !pausedForUpgrade) castLaser();
    }
  }

  // ── Botão B (Voltar / Fechar / Trocar Arma) ──
  if (bNow && !gpPrevB) {
    if (pausedForUpgrade) {
      // Fechar aba de upgrades (conforme solicitado pelo usuário)
      Audio.sfxClick();
      closeUpgradeScreen();
    } else if (gameActive && !paused) {
      cycleWeapon();
    }
  }

  // ── Ações no jogo normal (X, Y, Start) ──
  if (gameActive && !pausedForUpgrade) {
    if (startNow && !gpPrevStart) togglePause();
    if (!paused) {
      if (lbNow && !gpPrevLB) cycleWeapon();
      if (xNow && !gpPrevX) castGrenade();
      if (yNow && !gpPrevY) castEMP();
    }
  }

  // ── Navegação D-pad (mantida como alternativa) ──
  if (pausedForUpgrade) {
    const cards = document.querySelectorAll('.upgrade-card');
    if (cards.length > 0) {
      if ((dpLeft || dpRight) && !gamepad._dpPrev) {
        let idx = gamepad._gpSelIdx !== undefined ? gamepad._gpSelIdx : 0;
        cards.forEach(c => c.classList.remove('gp-selected'));
        if (dpRight) idx = Math.min(idx + 1, cards.length - 1);
        if (dpLeft) idx = Math.max(idx - 1, 0);
        gamepad._gpSelIdx = idx;
        cards[idx].classList.add('gp-selected');

        // Sincroniza o mouse virtual com a carta se usar d-pad
        const rect = cards[idx].getBoundingClientRect();
        mouse.x = rect.left + rect.width / 2;
        mouse.y = rect.top + rect.height / 2;
      }
      gamepad._dpPrev = dpLeft || dpRight;
    }
  }

  // Se o cursor visual estiver ativo, atualiza posição (em caso de resize ou outro movimento)
  const vCursor = document.getElementById('virtual-cursor');
  if (vCursor && gamepad.virtualCursorActive) {
    vCursor.style.left = mouse.x + 'px';
    vCursor.style.top = mouse.y + 'px';
  }

  // ── Atualiza estado anterior ──
  gpPrevStart = startNow;
  gpPrevB = bNow;
  gpPrevX = xNow;
  gpPrevY = yNow;
  gpPrevA = aNow;
  gpPrevLB = lbNow;
}

// ======================
// Entidades
// ======================
const enemies = [];
const bullets = [];
const enemyBullets = [];
const particles = [];
const gems = [];
const coins = [];
const hearts = [];
const driftUpgrades = []; // Novos upgrades à deriva

function spawnDriftUpgrade() {
  const margin = 100;
  const x = margin + Math.random() * (window.innerWidth - margin * 2);
  const y = margin + Math.random() * (window.innerHeight - margin * 2);

  // Sorteia o upgrade logo no spawn para mostrar a imagem
  const candidates = pickUpgrades(1, [], 'run');
  if (candidates.length > 0) {
    const up = candidates[0];
    driftUpgrades.push({ x, y, timer: 15, radius: 32, upgrade: up });
    showFloatingText(`SUPRIMENTO DE ${up.title.toUpperCase()}! 🚀`, x, y - 20, '#f2ff00ff');
  }
}

// Spawn de corações (cura periódica)
let heartTimer = 0;
function scheduleNextHeart() {
  heartTimer = 14 + Math.random() * 10; // entre 14 e 24 segundos
}
function spawnHeart() {
  const margin = 60;
  const x = margin + Math.random() * (window.innerWidth - margin * 2);
  const y = margin + Math.random() * (window.innerHeight - margin * 2);
  const heal = Math.round(12 + level * 0.6); // escala levemente com nível
  hearts.push({ x, y, heal, radius: 6 });
}

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
  const count = isTouch ? 4 : 8; // Menos partículas no mobile para performance
  for (let i = 0; i < count; i++) {
    particles.push({ x, y, color, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, alpha: 1, size: Math.random() * 4 });
  }
}
function killEnemy(index, en) {
  const drop = (en.type === 'boss') ? 40 : 20;
  gems.push({ x: en.x, y: en.y, value: drop });

  // Drop de ouro
  let goldChance = 0.2;
  if (en.type === 'boss') goldChance = 1.0;
  if (Math.random() < goldChance) {
    let goldValue = Math.floor(Math.random() * 5) + 1;
    if (en.type === 'boss') goldValue = Math.floor(Math.random() * 51) + 50;
    coins.push({ x: en.x, y: en.y, value: goldValue });
  }

  // Drop de pedra rara
  if (en.type === 'boss') {
    // Boss: garante 1-3 pedras raras
    const qty = Math.floor(Math.random() * 3) + 1;
    rareStones += qty;
    showFloatingText(`+${qty} 💎 Diamante!`, en.x, en.y - 20, '#a855f7');
  } else if ((en.type === 'tank' || en.type === 'splitter') && Math.random() < 0.07) {
    // Tank/Splitter: 7% de chance de 1 pedra rara
    rareStones += 1;
    showFloatingText('+1 💎', en.x, en.y - 15, '#a855f7');
  }

  // Drop de powerups (Febre do Ouro)
  if (Math.random() < 0.005) { // 0.5% de chance de dropar um powerup
    powerups.push({ x: en.x, y: en.y, type: 'gold_rush' });
  }

  if (typeof en.onDeath === 'function') en.onDeath();
  enemies.splice(index, 1);
  score += en.score;

  // Lógica de Abates para Upgrade (Modo Aventura)
  if (gameMode === 'aventura' && gameActive) {
    adventureState.killsThisPhase++;
    if (adventureState.killsThisPhase >= adventureState.killGoalForUpgrade) {
      adventureState.killsThisPhase = 0;
      Audio.sfxLevel();

      // Em vez de menu, dropa um upgrade dourado direto no inimigo
      const candidates = pickUpgrades(1, [], 'run');
      if (candidates.length > 0) {
        const up = candidates[0];
        driftUpgrades.push({
          x: en.x,
          y: en.y,
          timer: 20, // Dura um pouco mais
          radius: 35,
          upgrade: up,
          isSuper: true // Marca como super upgrade (nível máximo)
        });
        showFloatingText("BÔNUS DE ABATES! ⚔️", en.x, en.y - 40, '#ffd700');
      }
    }
  }

  // Habilidade Vampirismo - chance de curar ao matar inimigos
  const vampSkill = player.skills.vampirism;
  if (vampSkill.level > 0) {
    const shouldHeal = Math.random() < vampSkill.chance;
    if (shouldHeal) {
      player.hp = Math.min(player.maxHp, player.hp + vampSkill.healAmount);
      // Efeito visual de cura
      createParticle(en.x, en.y, '#ff4d6d');
      createParticle(player.x, player.y, '#ff4d6d');
    }
  }
}

// ======================
// Inimigos
// ======================
function makeEnemy(type = 'chaser') {
  const w = window.innerWidth, h = window.innerHeight;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = -60; y = Math.random() * h; }
  else if (side === 1) { x = w + 60; y = Math.random() * h; }
  else if (side === 2) { x = Math.random() * w; y = -60; }
  else { x = Math.random() * w; y = h + 60; }

  const baseSpeed = 1.35 + (level * 0.12);
  let baseHp = 2 + Math.floor(level / 2);

  // Reduzir HP dos inimigos normais em 50% (balanceamento base)
  if (type !== 'boss') {
    baseHp = Math.max(1, Math.floor(baseHp * 0.5));
  }

  // Aplicar multiplicadores de dificuldade (se existirem)
  if (window.difficultyMultipliers) {
    baseHp = Math.max(1, Math.floor(baseHp * window.difficultyMultipliers.enemyHp));
  }

  const finalSpeed = window.difficultyMultipliers ? baseSpeed * window.difficultyMultipliers.enemySpeed : baseSpeed;

  const e = {
    type, x, y,
    radius: 14,
    color: '#ff416c',
    speed: finalSpeed,
    hp: baseHp,
    maxHp: baseHp,
    score: 10,
    onDeath: null,
    shootCooldown: 0,
    slowT: 0
  };

  if (type === 'runner') {
    e.radius = 12; e.speed = baseSpeed * 1.75;
    e.hp = Math.max(1, Math.floor(baseHp * 0.7)); e.maxHp = e.hp;
    e.color = '#ff8a00'; e.score = 12;
  } else if (type === 'tank') {
    e.radius = 24; e.speed = baseSpeed * 0.65;
    e.hp = Math.floor(baseHp * 2.6); e.maxHp = e.hp;
    e.color = '#8a2be2'; e.score = 20;
  } else if (type === 'shooter') {
    e.radius = 16; e.speed = baseSpeed * 0.9;
    e.hp = Math.floor(baseHp * 1.2); e.maxHp = e.hp;
    e.color = '#00e676'; e.score = 18;
    e.shootCooldown = 0.6 + Math.random() * 0.5;
  } else if (type === 'splitter') {
    e.radius = 18; e.speed = baseSpeed * 0.85;
    e.hp = Math.floor(baseHp * 1.5); e.maxHp = e.hp;
    e.color = '#00bcd4'; e.score = 22;
    e.onDeath = () => {
      for (let i = 0; i < 3; i++) {
        const mini = makeEnemy('runner');
        mini.x = e.x + (Math.random() - 0.5) * 20;
        mini.y = e.y + (Math.random() - 0.5) * 20;
        mini.radius = 10;
        mini.hp = Math.max(1, Math.floor(level / 2));
        mini.maxHp = mini.hp;
        mini.speed *= 1.1;
        enemies.push(mini);
      }
    };
  }

  e.update = function (dt) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const slowMul = (this.slowT && this.slowT > 0) ? 0.55 : 1.0;
    if (this.slowT && this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);

    this.x += Math.cos(angle) * this.speed * slowMul * 60 * dt;
    this.y += Math.sin(angle) * this.speed * slowMul * 60 * dt;

    if (this.type === 'shooter') {
      this.shootCooldown -= dt;
      if (this.shootCooldown <= 0) {
        this.shootCooldown = 0.9 + Math.random() * 0.6;
        shootEnemyBullet(this.x, this.y, angle, 5.4 + level * 0.05);
      }
    }
  };

  e.draw = function () {
    const defaultType = 'enemy_basic';
    const mapper = {
      'chaser': 'enemy_basic',
      'runner': 'enemy_basic',
      'splitter': 'enemy_basic',
      'shooter': 'enemy_shooter',
      'tank': 'enemy_tank',
      'boss': 'enemy_boss'
    };
    const sType = mapper[this.type] || defaultType;
    const sprite = sprites[sType];

    if (sprite && sprite.complete) {
      ctx.save();
      ctx.translate(this.x, this.y);
      // Calcula o ângulo apontando para o Player
      const angle = Math.atan2(player.y - this.y, player.x - this.x);
      // O sprite foi gerado "facing downwards", então subtraímos 90 graus para alinhar ao 0(Right)
      ctx.rotate(angle - Math.PI / 2);
      const sSize = this.radius * 3.5; // Ajuste para ocupar visualmente
      ctx.drawImage(sprite, -sSize / 2, -sSize / 2, sSize, sSize);
      ctx.restore();
    } else {
      ctx.shadowBlur = 14;
      ctx.shadowColor = this.color;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (this.type === 'tank' || this.type === 'boss') {
      const barW = this.radius * 2.2, barH = 4;
      const px = this.x - barW / 2, py = this.y - this.radius - 10;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(px, py, barW, barH);
      ctx.fillStyle = 'rgba(255,65,108,0.9)';
      ctx.fillRect(px, py, barW * (this.hp / this.maxHp), barH);
    }
  };

  return e;
}

function spawnBoss() {
  if (bossActive) return;
  bossActive = true;

  const w = window.innerWidth, h = window.innerHeight;
  const b = makeEnemy('boss');
  b.x = Math.random() < 0.5 ? -80 : w + 80;
  b.y = Math.random() * h;

  b.radius = 46;
  b.speed = 1.0 + level * 0.04;
  b.hp = Math.floor(120 + level * 35);

  if (gameMode === 'aventura') {
    const world = adventureWorldData[adventureState.currentWorld];
    b.hp = Math.floor(400 * world.enemyMult);
    b.bossWeapon = world.bossWeapon;
    b.color = weaponColors[b.bossWeapon] || '#ff1744';
  }

  b.maxHp = b.hp;
  b.score = 250;
  b.shootCooldown = 1.2;

  b.update = function (dt) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    this.x += Math.cos(angle) * this.speed * 60 * dt;
    this.y += Math.sin(angle) * this.speed * 60 * dt;

    this.shootCooldown -= dt;
    if (this.shootCooldown <= 0) {
      if (this.bossWeapon === 'shotgun') {
        this.shootCooldown = 0.8;
        for (let i = -2; i <= 2; i++) shootEnemyBullet(this.x, this.y, angle + i * 0.3, 5);
      } else if (this.bossWeapon === 'laser') {
        this.shootCooldown = 0.1;
        shootEnemyBullet(this.x, this.y, angle + (Math.random() - 0.5) * 0.1, 8);
      } else if (this.bossWeapon === 'railgun') {
        this.shootCooldown = 2.0;
        shootEnemyBullet(this.x, this.y, angle, 12, 10); // Bala rápida e grande
      } else if (this.bossWeapon === 'flamethrower') {
        this.shootCooldown = 0.05;
        shootEnemyBullet(this.x, this.y, angle + (Math.random() - 0.5) * 0.5, 4);
      } else {
        // Default pattern
        this.shootCooldown = Math.max(0.7, 1.25 - level * 0.01);
        const bulletsCount = 10 + Math.min(10, Math.floor(level / 2));
        for (let i = 0; i < bulletsCount; i++) {
          const a = (Math.PI * 2) * (i / bulletsCount);
          shootEnemyBullet(this.x, this.y, a, 4.2);
        }
      }
      screenShake = Math.max(screenShake, 10);
      Audio.sfxExplode();
    }
  };

  b.onDeath = () => {
    bossActive = false;

    // Desbloquear nave se estiver no modo aventura
    if (gameMode === 'aventura') {
      const world = adventureWorldData[adventureState.currentWorld];
      if (world.bossWeapon !== 'default_boss') {
        if (!permanentUpgrades.unlockedShips.includes(world.bossWeapon)) {
          permanentUpgrades.unlockedShips.push(world.bossWeapon);
          showFloatingText(`NAVE ${world.bossWeapon.toUpperCase()} DESBLOQUEADA!`, b.x, b.y - 40, '#ffd700');
          saveSettings({ permanentUpgrades });
        }
      }
    }

    for (let i = 0; i < 18; i++) gems.push({ x: b.x + (Math.random() - 0.5) * 40, y: b.y + (Math.random() - 0.5) * 40, value: 35 });
    levelText.innerText = 'BOSS DERROTADO!';

    if (gameMode === 'aventura') {
      setTimeout(() => endGameWithPhaseClear(), 2000);
    } else {
      setTimeout(() => levelText.innerText = `NÍVEL ${level}`, 1600);
    }
  };

  enemies.push(b);
  levelText.innerText = 'ALERTA: BOSS DETECTADO!';
  setTimeout(() => levelText.innerText = (gameMode === 'aventura' ? `CONFRONTO FINAL` : `NÍVEL ${level}`), 1600);
}

// ======================
// Tiros
// ======================
let fireCooldown = 0;

function shootAt(angle) {
  if (!gameActive || paused || pausedForUpgrade) return;

  const w = weaponSystem.weaponStats[weaponSystem.currentWeapon];
  const dmg = Math.max(1, Math.floor(player.damage * w.damageMul));
  const spd = player.bulletSpeed * w.speedMul;
  const rad = player.bulletRadius * w.radiusMul;
  const color = w.color;
  const pierce = player.piercing + (w.pattern === 'piercing' ? w.pierceCount : 0);

  // Sistema de Munição da Shotgun
  if (weaponSystem.currentWeapon === 'shotgun') {
    if (player.shotgunAmmo <= 0 || player.shotgunReloadTimer > 0) {
      Audio.sfxClick(); // Feedback de sem munição
      return;
    }
    player.shotgunAmmo--;
    if (player.shotgunAmmo <= 0) {
      player.shotgunReloadTimer = 1.5; // Tempo de recarga
    }
  }

  // Helper para criar bala
  const mkBullet = (a, speedMul = 1.0) => ({
    x: player.x, y: player.y,
    vx: Math.cos(a) * spd * speedMul,
    vy: Math.sin(a) * spd * speedMul,
    radius: rad,
    color: color,
    damage: dmg,
    pierce: pierce
  });

  if (w.pattern === 'spread') {
    const count = w.spreadCount + Math.floor((player.weaponLevel - 1) / 2);
    const angleStep = w.spreadAngle / (count - 1 || 1);
    const startAngle = angle - w.spreadAngle / 2;

    for (let i = 0; i < count; i++) {
      bullets.push(mkBullet(startAngle + i * angleStep));
    }
  } else if (w.pattern === 'stream') {
    // Flamethrower
    const bullet = mkBullet(angle + (Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.5);
    bullet.isFlame = true;
    bullet.life = 0;
    bullet.maxLife = 0.5 + Math.random() * 0.4; // Meio segundo de vida
    bullet.baseRadius = rad;
    bullets.push(bullet);
  } else {
    // Single/Piercing com multishot
    const count = (player.weaponLevel > 1) ? player.weaponLevel : 1;
    const spread = 0.08;
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * spread;
      bullets.push(mkBullet(a));
    }
  }

  screenShake = Math.max(screenShake, 2.5);
  Audio.sfxShoot();
}

function nearestEnemyAngle() {
  if (enemies.length === 0) return null;
  let best = null, bestD = Infinity;
  for (const en of enemies) {
    const d = (en.x - player.x) ** 2 + (en.y - player.y) ** 2;
    if (d < bestD) { bestD = d; best = en; }
  }
  return best ? Math.atan2(best.y - player.y, best.x - player.x) : null;
}

function aimAngle() {
  // Se o controle estiver conectado e sendo usado para mirar ou atirar, usa a posição do cursor virtual
  if (gamepad.connected && (gamepad.aimingWithStick || gamepad.triggerPressed)) {
    return Math.atan2(mouse.y - player.y, mouse.x - player.x);
  }
  if (mouseDown) return Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const a = player.autoAim ? nearestEnemyAngle() : null;
  return (a !== null) ? a : Math.atan2(mouse.y - player.y, mouse.x - player.x);
}

function shootEnemyBullet(x, y, angle, speed) {
  enemyBullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4,
    color: 'rgba(255,255,255,0.85)',
    damage: 6 + Math.min(10, level * 0.25)
  });
}

// Event listeners para modos e dificuldades
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setGameMode(btn.dataset.mode);
  });
});

document.querySelectorAll('.difficulty-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setDifficulty(btn.dataset.difficulty);
  });
});

// ======================
// Habilidades (C/B/A/S)
// ======================
const activeLasers = [];

function tickNebulizer(dt) {
  const sk = player.skills.nebulizer;
  if (sk.level <= 0) return;
  const rate = 0.9 + sk.level * 0.25;
  sk.t -= dt;
  if (sk.t <= 0) {
    sk.t = 1 / rate;
    const a = Math.random() * Math.PI * 2;
    const spd = player.bulletSpeed * (0.65 + Math.random() * 0.25);
    bullets.push({
      x: player.x, y: player.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, radius: Math.max(2.8, player.bulletRadius * 0.75),
      color: 'rgba(255,255,255,0.8)', damage: Math.max(1, Math.floor(1 + sk.level * 0.4)), pierce: 0
    });
  }
}

function tickScattergun(dt) {
  const sk = player.skills.scattergun;
  if (sk.level <= 0) return;
  const rate = 0.7 + sk.level * 0.12;
  sk.t -= dt;
  if (sk.t <= 0) {
    sk.t = 1 / rate;
    const base = aimAngle();
    const pellets = 6 + sk.level;
    const spread = 0.55;
    for (let i = 0; i < pellets; i++) {
      const off = (i / (pellets - 1) - 0.5) * spread;
      const spd = player.bulletSpeed * 0.85;
      bullets.push({
        x: player.x, y: player.y, vx: Math.cos(base + off) * spd, vy: Math.sin(base + off) * spd, radius: Math.max(3.2, player.bulletRadius * 0.9),
        color: 'rgba(255,255,255,0.9)', damage: Math.max(2, Math.floor(2 + sk.level * 0.8)), pierce: 0
      });
    }
    Audio.sfxShoot();
  }
}

function explodeAt(x, y, radius, damage, color) {
  pulse.flash = Math.max(pulse.flash, 0.75);
  createParticle(x, y, color);
  screenShake = Math.max(screenShake, 10);
  Audio.sfxExplode();

  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    const d = Math.hypot(en.x - x, en.y - y);
    if (d <= radius + en.radius) {
      const t = 1 - (d / (radius + en.radius));
      const dmg = Math.max(1, Math.floor(damage * (0.45 + 0.55 * t)));
      en.hp -= dmg;
      createParticle(en.x, en.y, en.color);

      const nx = (en.x - x) / (d || 1), ny = (en.y - y) / (d || 1);
      en.x += nx * 18 * t;
      en.y += ny * 18 * t;

      if (en.hp <= 0) killEnemy(i, en);
    }
  }
}

function castGrenade() {
  const sk = player.skills.grenade;
  if (sk.level <= 0 || sk.timer > 0) return;
  sk.timer = sk.cd;

  const base = aimAngle();
  const a = base + (Math.random() - 0.5) * (0.9 - Math.min(0.6, sk.level * 0.08));
  const dist = 220 + Math.random() * 220;
  const tx = player.x + Math.cos(a) * dist;
  const ty = player.y + Math.sin(a) * dist;

  explodeAt(tx, ty, 170 + sk.level * 12, 22 + sk.level * 8, 'rgba(255,65,108,0.95)');
}

function castEMP() {
  const sk = player.skills.emp;
  if (sk.level <= 0 || sk.timer > 0) return;
  sk.timer = sk.cd;

  const r = 220 + sk.level * 18;
  const dmg = 18 + sk.level * 6;

  pulse.flash = Math.max(pulse.flash, 0.9);
  screenShake = Math.max(screenShake, 12);
  Audio.sfxPulse();

  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    const d = Math.hypot(en.x - player.x, en.y - player.y);
    if (d <= r + en.radius) {
      let mult = 1.0;
      if (en.type === 'tank') mult = 0.55;
      if (en.type === 'boss') mult = 0.35;
      en.hp -= Math.floor(dmg * mult);
      en.slowT = Math.max(en.slowT || 0, 2.2 + sk.level * 0.3);
      createParticle(en.x, en.y, 'rgba(0,242,254,0.9)');

      if (en.hp <= 0) killEnemy(i, en);
    }
  }
}

function castLaser() {
  const sk = player.skills.laser;
  if (sk.level <= 0 || sk.timer > 0) return;
  sk.timer = sk.cd;
  sk.beam = 0.55 + sk.level * 0.1;
  screenShake = Math.max(screenShake, 8);
  Audio.sfxZap();
}

function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const wx = px - x1, wy = py - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - x1, py - y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - x2, py - y2);
  const t = c1 / c2;
  const bx = x1 + t * vx, by = y1 + t * vy;
  return Math.hypot(px - bx, py - by);
}

function performLaserBeam(dt, angle, range, width, dps, color) {
  const x1 = player.x, y1 = player.y;
  const x2 = x1 + Math.cos(angle) * range;
  const y2 = y1 + Math.sin(angle) * range;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    const dist = pointSegmentDistance(en.x, en.y, x1, y1, x2, y2);
    if (dist <= en.radius + width / 2) {
      en.hp -= dps * dt;
      if (Math.random() < 0.3) createParticle(en.x, en.y, color);
      if (en.hp <= 0) killEnemy(i, en);
    }
  }

  activeLasers.push({ x1, y1, x2, y2, w: width, color });
}

function tickLaser(dt) {
  const sk = player.skills.laser;
  if (sk.level <= 0 || sk.beam <= 0) return;

  sk.beam = Math.max(0, sk.beam - dt);
  const dps = 120 + sk.level * 45;
  const width = 10 + sk.level * 3;

  performLaserBeam(dt, aimAngle(), 900, width, dps, 'rgba(255, 0, 0, 0.8)');
}

function findNearestEnemy(x, y, range = Infinity, ignore = null) {
  let best = null, bestD = Infinity;
  const r2 = range * range;
  for (const en of enemies) {
    if (ignore && ignore.has(en)) continue;
    const dx = en.x - x, dy = en.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD && d2 <= r2) { bestD = d2; best = en; }
  }
  return best;
}

function tickZap(dt) {
  const sk = player.skills.zap;
  if (sk.level <= 0) return;
  sk.t -= dt;
  const rate = 1.2 + sk.level * 0.35;
  if (sk.t > 0) return;
  sk.t = 1 / rate;

  if (enemies.length === 0) return;

  const maxJumps = 2 + Math.floor(sk.level / 2);
  const jumpRange = 220 + sk.level * 15;
  const baseDmg = 10 + sk.level * 5;

  let current = findNearestEnemy(player.x, player.y);
  if (!current) return;

  const hit = new Set();
  for (let j = 0; j < maxJumps; j++) {
    if (!current || hit.has(current)) break;
    hit.add(current);

    current.hp -= baseDmg;
    createParticle(current.x, current.y, 'rgba(0,242,254,0.95)');
    Audio.sfxZap();

    if (current.hp <= 0) {
      const idx = enemies.indexOf(current);
      if (idx >= 0) killEnemy(idx, current);
    }

    current = findNearestEnemy(current.x, current.y, jumpRange, hit);
  }
}

function tickOrbital(dt) {
  const sk = player.skills.orbital;
  if (sk.level <= 0 || sk.count <= 0) return;

  sk.angle += (2.0 + sk.level * 0.15) * dt; // Rotação constante

  const orbitRadius = 65 + sk.level * 2;
  const orbSize = 8 + Math.min(6, sk.level);
  const dmgPerFrame = Math.max(1, (sk.damage * dt)); // Dano contínuo

  for (let i = 0; i < sk.count; i++) {
    const a = sk.angle + (i * (Math.PI * 2 / sk.count));
    const ox = player.x + Math.cos(a) * orbitRadius;
    const oy = player.y + Math.sin(a) * orbitRadius;

    // Colisão com inimigos
    for (let j = enemies.length - 1; j >= 0; j--) {
      const en = enemies[j];
      const dist = Math.hypot(en.x - ox, en.y - oy);

      if (dist < orbSize + en.radius) {
        en.hp -= dmgPerFrame;
        // Partícula simples ao acertar
        if (Math.random() < 0.3) createParticle(en.x, en.y, '#641b00ff');

        if (en.hp <= 0) killEnemy(j, en);
      }
    }
  }
}

function tickOmega(dt) {
  const sk = player.skills.omega;
  if (sk.level <= 0) return;

  const want = 1 + Math.floor((sk.level - 1) / 2);
  while (sk.jets.length < want) sk.jets.push({ a: Math.random() * Math.PI * 2, r: 190 + Math.random() * 40, fireT: 0, _x: 0, _y: 0 });

  for (const jet of sk.jets) {
    jet.a += (0.9 + sk.level * 0.08) * dt;
    const jx = player.x + Math.cos(jet.a) * jet.r;
    const jy = player.y + Math.sin(jet.a) * jet.r;

    // aura dano
    const auraR = 42 + sk.level * 6;
    const auraDps = 80 + sk.level * 22;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i];
      const d = Math.hypot(en.x - jx, en.y - jy);
      if (d <= auraR + en.radius) {
        en.hp -= Math.max(1, Math.floor(auraDps * dt));
        if (en.hp <= 0) killEnemy(i, en);
      }
    }

    // metralhadora
    jet.fireT -= dt;
    const fireRate = 2.2 + sk.level * 0.35;
    if (jet.fireT <= 0 && enemies.length > 0) {
      jet.fireT = 1 / fireRate;
      const target = findNearestEnemy(player.x, player.y, 520);
      if (target) {
        const a = Math.atan2(target.y - jy, target.x - jx) + (Math.random() - 0.5) * 0.25;
        bullets.push({
          x: jx, y: jy, vx: Math.cos(a) * (player.bulletSpeed * 0.95), vy: Math.sin(a) * (player.bulletSpeed * 0.95),
          radius: 3.2, color: 'rgba(255, 0, 187, 0.95)', damage: Math.max(1, Math.floor(2 + sk.level * 0.9)), pierce: 0
        });
      }
    }

    jet._x = jx; jet._y = jy;
  }
}

// ======================
// Upgrades por escolha
// ======================
const upgradePool = [
  { id: 'more_projectiles', title: 'Módulo de Dispersão', desc: 'Dispara +1 projétil por tiro.', tag: 'OFENSIVA', apply: () => player.weaponLevel += 1 },
  { id: 'fire_rate', title: 'Condensador de Pulso', desc: 'Aumenta a taxa de tiro em +18%.', tag: 'OFENSIVA', apply: () => player.fireRate *= 1.18 },
  { id: 'damage', title: 'Amplificador de Impacto', desc: 'Aumenta o dano em +1.', tag: 'OFENSIVA', apply: () => player.damage += 1 },
  { id: 'bullet_speed', title: 'Canhão de Íons', desc: 'Aumenta a velocidade dos projéteis em +15%.', tag: 'OFENSIVA', apply: () => player.bulletSpeed *= 1.15 },
  { id: 'bullet_size', title: 'Núcleo Expandido', desc: 'Projéteis maiores (+25% de raio).', tag: 'OFENSIVA', apply: () => player.bulletRadius *= 1.25 },
  { id: 'piercing', title: 'Faseamento', desc: 'Projéteis atravessam +1 inimigo.', tag: 'TÁTICO', apply: () => player.piercing += 1 },
  { id: 'move_speed', title: 'Propulsores Auxiliares', desc: 'Aumenta a velocidade de movimento em +12%.', tag: 'MOBILIDADE', apply: () => player.speed *= 1.12 },
  { id: 'max_hp', title: 'Reforço de Traje', desc: 'Aumenta HP máximo em +20 e cura 20.', tag: 'DEFESA', apply: () => { player.maxHp += 20; player.hp = Math.min(player.maxHp, player.hp + 20); } },
  { id: 'regen', title: 'Nanorregeneração', desc: 'Regenera +1.2 HP por segundo.', tag: 'DEFESA', apply: () => player.regen += 1.2 },
  { id: 'magnet', title: 'Ímã de Éter', desc: 'Aumenta o alcance de coleta de XP em +35%.', tag: 'UTIL', apply: () => player.xpMagnet *= 1.35 },

  // Habilidades
  { id: 'skill_nebulizer', title: 'Nebulizador Caótico', desc: 'Passiva C: jatos aleatórios fracos em todas as direções.', tag: 'HABILIDADE C', apply: () => player.skills.nebulizer.level += 1 },
  { id: 'skill_scattergun', title: 'Canhão de Estilhaços', desc: 'Passiva C: disparo em cone, bom dano, sem perfuração.', tag: 'HABILIDADE C', apply: () => player.skills.scattergun.level += 1 },
  { id: 'skill_grenade', title: 'Carga Volátil (Q)', desc: 'Ativa B: explosão em área muito forte (arremesso levemente aleatório).', tag: 'HABILIDADE B', apply: () => player.skills.grenade.level += 1 },
  { id: 'skill_emp', title: 'Pulso Eletromagnético (E)', desc: 'Ativa B: dano em área + lentidão (menos efetiva em tanques/boss).', tag: 'HABILIDADE B', apply: () => player.skills.emp.level += 1 },
  { id: 'skill_laser', title: 'Feixe Aniquilador (R)', desc: 'Ativa A: feixe com DPS altíssimo atravessando tudo por curta duração.', tag: 'HABILIDADE A', apply: () => player.skills.laser.level += 1 },
  { id: 'skill_zap', title: 'Condutor Arcano', desc: 'Passiva A: raio que salta entre inimigos automaticamente.', tag: 'HABILIDADE A', apply: () => player.skills.zap.level += 1 },
  {
    id: 'skill_orbital', title: 'Escudo Orbital', desc: 'Passiva B: asteroides que giram e causam dano por contato.', tag: 'HABILIDADE B', apply: () => {
      const sk = player.skills.orbital;
      sk.level += 1;
      sk.count = Math.min(6, sk.level);
      sk.damage = 15 + sk.level * 4;
    }
  },
  { id: 'skill_omega', title: 'Esquadrão Ômega', desc: 'Passiva S: caças orbitais com dano em área e metralhadora.', tag: 'HABILIDADE S', apply: () => player.skills.omega.level += 1 },
  {
    id: 'skill_vampirism', title: 'Vampirismo Sanguinário', desc: 'Passiva V: chance de curar vida ao derrotar inimigos.', tag: 'HABILIDADE V', apply: () => {
      const sk = player.skills.vampirism;
      sk.level += 1;
      sk.chance = 0.3 + (sk.level * 0.1); // 20% a 40% de chance
      sk.healAmount = 3 + (sk.level * 2);   // 5 a 25 de cura
    }
  },

  // Armas Desbloqueáveis
  { id: 'unlock_shotgun', title: 'NOVA ARMA: Espingarda', desc: 'Curto alcance, múltiplos projéteis (Tecla 2).', tag: 'ARMA', apply: () => { weaponSystem.unlockedWeapons.shotgun = true; switchWeapon('shotgun'); } },
  { id: 'unlock_laser', title: 'NOVA ARMA: Rifle Laser', desc: 'Disparo ultra-rápido e preciso (Tecla 3).', tag: 'ARMA', apply: () => { weaponSystem.unlockedWeapons.laser = true; switchWeapon('laser'); } },
  { id: 'unlock_railgun', title: 'NOVA ARMA: Railgun', desc: 'Tiro perfurante de alto dano (Tecla 4).', tag: 'ARMA', apply: () => { weaponSystem.unlockedWeapons.railgun = true; switchWeapon('railgun'); } },
  { id: 'unlock_flamethrower', title: 'NOVA ARMA: Lança-chamas', desc: 'Fluxo contínuo de fogo (Tecla 5).', tag: 'ARMA', apply: () => { weaponSystem.unlockedWeapons.flamethrower = true; switchWeapon('flamethrower'); } },
];

let currentUpgradeOptions = [];

function pickUpgrades(count = 3, forcedIds = [], source = 'normal') {
  const available = upgradePool.filter(u => {
    // Lógica de limite de nível mid-run (Modo Aventura)
    if (gameMode === 'aventura' && source === 'run') {
      const currentLevel = upgradePickCount[u.id] || 0;
      if (currentLevel >= 5) return false;
    }

    // Lógica de armas e requisitos de nível (ignorados no modo Aventura)
    const isAdv = gameMode === 'aventura';

    if (u.id === 'unlock_shotgun') return !weaponSystem.unlockedWeapons.shotgun && (isAdv || level >= 3);
    if (u.id === 'unlock_laser') return !weaponSystem.unlockedWeapons.laser && (isAdv || level >= 5);
    if (u.id === 'unlock_railgun') return !weaponSystem.unlockedWeapons.railgun && (isAdv || level >= 8);
    if (u.id === 'unlock_flamethrower') return !weaponSystem.unlockedWeapons.flamethrower && (isAdv || level >= 12);

    if (u.id === 'skill_omega') return isAdv || level >= 8;
    if (u.id === 'skill_laser') return isAdv || level >= 5;
    if (u.id === 'skill_orbital') return isAdv || level >= 2;
    if (u.id === 'skill_zap') return isAdv || level >= 4;
    if (u.id === 'skill_emp') return isAdv || level >= 3;
    if (u.id === 'skill_grenade') return isAdv || level >= 3;
    return true;
  });

  let result = [];

  // Adicionar forçados (se disponíveis)
  for (const fid of forcedIds) {
    const up = available.find(u => u.id === fid);
    if (up && !result.includes(up)) result.push(up);
  }

  // Preencher o restante (com Peso maior para upgrades que já possuímos)
  const copy = available.filter(u => !result.includes(u));
  while (result.length < count && copy.length) {
    let totalWeight = 0;
    const weights = copy.map(u => {
      let weight = 1.0;
      // Se a skill já está ativa (upgradePickCount > 0), aumentamos a chance em 3x
      if (upgradePickCount[u.id] && upgradePickCount[u.id] > 0) {
        weight = 3.0;
      }
      totalWeight += weight;
      return weight;
    });

    let rnd = Math.random() * totalWeight;
    let selectedIdx = 0;
    for (let i = 0; i < copy.length; i++) {
      rnd -= weights[i];
      if (rnd <= 0) {
        selectedIdx = i;
        break;
      }
    }

    result.push(copy.splice(selectedIdx, 1)[0]);
  }
  return result;
}

function refreshUpgradeButtons() {
  const btnReroll = document.getElementById('btn-reroll');
  const costElReroll = document.getElementById('reroll-cost');

  if (btnReroll) {
    const isFreeSource = currentUpgradeSource === 'run';
    const actualRerollCost = (freeRerolls > 0 || isFreeSource) ? 0 : rerollCost;
    if (costElReroll) costElReroll.innerText = actualRerollCost === 0 ? 'Grátis' : actualRerollCost;
    btnReroll.onclick = () => { Audio.sfxClick(); tryReroll(); };
    const canReroll = gold >= actualRerollCost;
    btnReroll.disabled = !canReroll;
    btnReroll.style.opacity = canReroll ? '1' : '0.4';
  }
}

let activeUpgradeCallback = null;
let currentUpgradeSource = 'normal';

function openUpgradeScreen(isReroll = false, callback = null, source = 'normal') {
  pausedForUpgrade = true;
  upgradeScreen.style.display = 'flex';
  if (callback) activeUpgradeCallback = callback;
  if (!isReroll) currentUpgradeSource = source;

  if (!isReroll) {
    // Primeira abertura: incluir travados e manter estado locked
    const lockedIds = [...nextLevelLockedIds];
    const upgrades = pickUpgrades(3, lockedIds, currentUpgradeSource);
    nextLevelLockedIds = [];
    currentUpgradeOptions = upgrades.map(u => ({ upgrade: u, locked: lockedIds.includes(u.id) }));
  } else {
    // Reroll: trocar cartas não travadas
    const keptOptions = currentUpgradeOptions.filter(o => o.locked);
    const keptIds = keptOptions.map(o => o.upgrade.id);
    const slotsNeeded = 3 - keptOptions.length;

    let newUpgrades = [];
    if (slotsNeeded > 0) {
      const candidates = pickUpgrades(10, [], currentUpgradeSource);
      for (const c of candidates) {
        if (newUpgrades.length >= slotsNeeded) break;
        if (!keptIds.includes(c.id) && !newUpgrades.some(u => u.id === c.id)) {
          newUpgrades.push(c);
        }
      }
    }

    currentUpgradeOptions = [
      ...keptOptions,
      ...newUpgrades.map(u => ({ upgrade: u, locked: false }))
    ];

    const isFreeSource = currentUpgradeSource === 'run';
    const actualRerollCost = (freeRerolls > 0 || isFreeSource) ? 0 : rerollCost;
    gold -= actualRerollCost;

    if (freeRerolls > 0) {
      freeRerolls--;
    } else {
      rerollCost = 20;
    }
    if (goldText) goldText.innerText = gold;
  }

  refreshUpgradeButtons();
  renderUpgradeCards();
}

function renderUpgradeCards() {
  upgradeCardsEl.innerHTML = '';

  // Custo de ouro para escolher um upgrade (aumenta apenas quando comprado, 1º é grátis)
  // No Modo Aventura com source 'run' (drops/kills), é sempre GRATIS
  const pickCost = (currentUpgradeSource === 'run' || freeUpgrades > 1) ? 1 : upgradeCost;

  currentUpgradeOptions.forEach(opt => {
    const up = opt.upgrade;
    const canAfford = gold >= pickCost;
    const card = document.createElement('div');
    card.className = 'upgrade-card' + (opt.locked ? ' card-locked' : '') + (!canAfford ? ' card-cant-afford' : '');

    const hasImage = cardImages[up.id] && cardImages[up.id].complete;

    // Ícone / imagem
    const imgEl = hasImage
      ? Object.assign(document.createElement('img'), { src: cardImages[up.id].src, alt: up.title, className: 'upgrade-image' })
      : (() => { const d = document.createElement('div'); d.className = 'upgrade-icon-placeholder'; d.innerHTML = getDefaultIconHtml(up).replace(/<[^>]+>/g, '') || '⭐'; return d; })();
    card.appendChild(imgEl);

    // Título
    const titleEl = document.createElement('div');
    titleEl.className = 'upgrade-title';
    titleEl.textContent = up.title;
    card.appendChild(titleEl);

    // Descrição
    const descEl = document.createElement('div');
    descEl.className = 'upgrade-desc';
    descEl.textContent = up.desc;
    card.appendChild(descEl);

    // Tag
    const tagEl = document.createElement('div');
    tagEl.className = 'upgrade-tag';
    tagEl.textContent = up.tag;
    card.appendChild(tagEl);

    // Custo de ouro
    const costEl = document.createElement('div');
    costEl.className = 'upgrade-cost' + (canAfford ? '' : ' upgrade-cost-cant');
    costEl.textContent = pickCost > 0 ? `🪙 ${pickCost}` : '🪙 Grátis';
    card.appendChild(costEl);

    // Botão Travar
    const lockBtn = document.createElement('button');
    lockBtn.className = 'lock-btn' + (opt.locked ? ' locked' : '');
    lockBtn.textContent = opt.locked ? '🔒 TRAVADO' : '🔓 Travar';
    lockBtn.title = 'Travar: mantém esta carta no próximo reroll';
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Audio.sfxClick();
      opt.locked = !opt.locked;
      renderUpgradeCards();
    });
    card.appendChild(lockBtn);

    // Selecionar upgrade (somente se NÃO clicar no lock)
    card.addEventListener('click', () => {
      if (!canAfford) {
        showFloatingText('❌ Ouro insuficiente!', player.x, player.y - 20, '#ff416c');
        return;
      }

      // Cobrar ouro e aumentar o custo para o próximo upgrade
      if (pickCost > 0) {
        gold -= pickCost;
        if (freeUpgrades > 0) {
          freeUpgrades--;
        } else {
          upgradeCost += 10; // só aumenta depois de comprado
        }
      }
      if (goldText) goldText.innerText = gold;

      // Rastrear quantas vezes esse upgrade foi pego nessa run
      upgradePickCount[up.id] = (upgradePickCount[up.id] || 0) + 1;

      // Verificar maestria (10x = desbloqueia na loja)
      if (upgradePickCount[up.id] >= 10) {
        const mastered = permanentUpgrades.masteredUpgrades || [];
        if (!mastered.includes(up.id)) {
          mastered.push(up.id);
          permanentUpgrades.masteredUpgrades = mastered;
          saveSettings({ permanentUpgrades });
          showFloatingText('🌟 UPGRADE DOMINADO! Disponivel na loja!', player.x, player.y - 30, '#ffd700');
        }
      }

      // Salva os travados EXCLUINDO o que foi selecionado agora
      nextLevelLockedIds = currentUpgradeOptions
        .filter(o => o.locked && o.upgrade.id !== up.id)
        .map(o => o.upgrade.id);
      Audio.sfxClick();
      up.apply();
      closeUpgradeScreen();
    });

    upgradeCardsEl.appendChild(card);
  });
}

function tryReroll() {
  const actualRerollCost = freeRerolls > 0 ? 0 : rerollCost;
  if (gold >= actualRerollCost) {
    openUpgradeScreen(true);
  }
}


function closeUpgradeScreen() {
  upgradeScreen.style.display = 'none';
  pausedForUpgrade = false;

  // Limpa qualquer timer de progresso se o usuário escolheu manualmente
  if (autoProgressTimer) {
    clearInterval(autoProgressTimer);
    autoProgressTimer = null;
  }

  if (activeUpgradeCallback) {
    const cb = activeUpgradeCallback;
    activeUpgradeCallback = null;
    cb();
  }
}

// Botão X para fechar a janela de upgrade
const btnCloseUpgrade = document.getElementById('btn-close-upgrade');
if (btnCloseUpgrade) {
  btnCloseUpgrade.addEventListener('click', () => {
    Audio.sfxClick();
    // Preserva cartas travadas e fecha (mesmo que Pular, sem bônus de XP)
    nextLevelLockedIds = currentUpgradeOptions.filter(o => o.locked).map(o => o.upgrade.id);
    closeUpgradeScreen();
  });
}

// ======================
// Loop principal
// ======================
let lastTime = performance.now();

function update(dt) {
  if (!gameActive || paused || pausedForUpgrade) return;

  // regen
  if (player.regen > 0) player.hp = Math.min(player.maxHp, player.hp + player.regen * dt);

  // cooldown pulse
  if (pulse.timer > 0) pulse.timer = Math.max(0, pulse.timer - dt);
  if (pulse.flash > 0) pulse.flash = Math.max(0, pulse.flash - 2.2 * dt);

  // Auto-pulse: ativa se houver inimigos no raio
  if (pulse.timer <= 0) {
    for (const en of enemies) {
      if (Math.hypot(en.x - player.x, en.y - player.y) <= pulse.radius + en.radius) {
        tryPulse();
        break;
      }
    }
  }

  // spawn coração periódicamente
  heartTimer -= dt;
  if (heartTimer <= 0) { spawnHeart(); scheduleNextHeart(); }

  // skills ticks
  tickNebulizer(dt);
  tickScattergun(dt);
  tickZap(dt);
  tickOrbital(dt);
  tickOmega(dt);
  tickLaser(dt);

  // cooldowns actives
  const sg = player.skills.grenade, se = player.skills.emp, sl = player.skills.laser;
  if (sg.timer > 0) sg.timer = Math.max(0, sg.timer - dt);
  if (se.timer > 0) se.timer = Math.max(0, se.timer - dt);
  if (sl.timer > 0) sl.timer = Math.max(0, sl.timer - dt);

  // Auto-cast skills
  if (enemies.length > 0) {
    if (sg.level > 0 && sg.timer <= 0) castGrenade();
    if (se.level > 0 && se.timer <= 0) castEMP();
    if (sl.level > 0 && sl.timer <= 0) castLaser();
  }

  // movimento
  let mvx = 0, mvy = 0;
  if (keys['w'] || keys['arrowup']) mvy -= 1;
  if (keys['s'] || keys['arrowdown']) mvy += 1;
  if (keys['a'] || keys['arrowleft']) mvx -= 1;
  if (keys['d'] || keys['arrowright']) mvx += 1;

  // Analógico esquerdo do controle
  if (gamepad.connected && (Math.abs(gamepad.leftX) > 0 || Math.abs(gamepad.leftY) > 0)) {
    mvx = gamepad.leftX;
    mvy = gamepad.leftY;
  }

  if (touchMove.active) {
    const dx = touchMove.x - touchMove.startX;
    const dy = touchMove.y - touchMove.startY;
    const maxR = 60;
    const len = Math.hypot(dx, dy) || 1;
    const nx = clamp(dx / len, -1, 1) * clamp(len / maxR, 0, 1);
    const ny = clamp(dy / len, -1, 1) * clamp(len / maxR, 0, 1);
    mvx = nx; mvy = ny;
  }

  const mlen = Math.hypot(mvx, mvy) || 1;
  if (mvx !== 0 || mvy !== 0) { mvx /= mlen; mvy /= mlen; }

  player.x += mvx * player.speed * 60 * dt;
  player.y += mvy * player.speed * 60 * dt;
  player.x = clamp(player.x, player.radius, window.innerWidth - player.radius);
  player.y = clamp(player.y, player.radius, window.innerHeight - player.radius);

  // tiro contínuo
  fireCooldown -= dt;
  const wantShoot = player.autoFire || mouseDown || (gamepad.connected && gamepad.triggerPressed);

  if (wantShoot && weaponSystem.currentWeapon === 'laser') {
    if (!player.isLaserOverheated && player.laserEnergy > 0) {
      const w = weaponSystem.weaponStats[weaponSystem.currentWeapon];
      // DPS da arma laser escala com o dano do player e nível da arma
      const baseDps = 150 + (player.damage * 10);
      const dps = baseDps * w.damageMul * (1 + (player.weaponLevel - 1) * 0.2);
      const width = 12 + (player.weaponLevel * 2);
      performLaserBeam(dt, aimAngle(), 900, width, dps, w.color);

      // Gasta energia (25 unidades por segundo = 4 segundos de uso contínuo)
      player.laserEnergy = Math.max(0, player.laserEnergy - 100 * dt);
      if (player.laserEnergy <= 0) {
        player.isLaserOverheated = true;
        Audio.sfxExplode(); // Som de alerta de superaquecimento
      }

      if (fireCooldown <= 0) {
        Audio.sfxShoot(); // Som periódico
        fireCooldown = 0.15;
      }
    }
  } else if (wantShoot && fireCooldown <= 0) {
    fireCooldown = 1 / player.fireRate;
    shootAt(aimAngle());
  }

  // Recarga do Laser
  const isFiringLaser = wantShoot && weaponSystem.currentWeapon === 'laser' && !player.isLaserOverheated;
  if (!isFiringLaser) {
    // Recarrega energia (20 unidades por segundo = 5 segundos para recarga total)
    player.laserEnergy = Math.min(player.laserMaxEnergy, player.laserEnergy + 50 * dt);
    // Para de superaquecer quando volta a 100%
    if (player.laserEnergy >= player.laserMaxEnergy) {
      player.isLaserOverheated = false;
    }
  }

  // bullets player
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * 60 * dt;
    b.y += b.vy * 60 * dt;

    if (b.isFlame) {
      b.life += dt;
      // Escala o raio (expande)
      b.radius = b.baseRadius * (1 + (b.life / b.maxLife) * 3.5);
      if (b.life >= b.maxLife) {
        bullets.splice(i, 1);
        continue;
      }
    }

    if (b.x < -100 || b.x > window.innerWidth + 100 || b.y < -100 || b.y > window.innerHeight + 100) bullets.splice(i, 1);
  }

  // bullets enemy
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx * 60 * dt;
    b.y += b.vy * 60 * dt;

    if (b.x < -80 || b.x > window.innerWidth + 80 || b.y < -80 || b.y > window.innerHeight + 80) {
      enemyBullets.splice(i, 1);
      continue;
    }

    const d = Math.hypot(player.x - b.x, player.y - b.y);
    if (d < player.radius + b.radius) {
      let dmgTaken = b.damage * 0.12;
      if (window.difficultyMultipliers) {
        dmgTaken *= window.difficultyMultipliers.enemyDamageMultiplier;
      }
      player.hp -= dmgTaken;
      screenShake = Math.max(screenShake, 9);
      Audio.sfxHit();
      enemyBullets.splice(i, 1);
      if (player.hp <= 0) gameOver();
    }
  }

  // Calcular nível de dificuldade efetivo (no modo aventura ignora nível de XP do player para spawn)
  let difficultyLevel = level;
  let advSpawnRateMult = 1.0;

  if (gameMode === 'aventura') {
    // Escala baseada em Mundo (0-5) e Fase (0-4)
    difficultyLevel = (adventureState.currentWorld * 2.5) + (adventureState.currentPhase * 0.5) + 1;
    // Reduz densidade de inimigos no modo aventura para ser menos caótico
    advSpawnRateMult = 0.65;
  }

  const spawnBase = 0.024 + (difficultyLevel * 0.0035);
  let finalSpawnRate = spawnBase * advSpawnRateMult;

  if (window.difficultyMultipliers) {
    finalSpawnRate *= window.difficultyMultipliers.enemySpawnRate;
  }

  // Aumentar gradualmente a taxa com o tempo da fase especificamente
  if (gameActive && !paused) {
    finalSpawnRate *= (1 + (gameTimeElapsed / 180)); // Aumenta até final da fase
  }

  if (Math.random() < finalSpawnRate) {
    const r = Math.random();
    let type = 'chaser';
    // Inimigos aparecem gradualmente conforme os Mundos da Aventura
    if (difficultyLevel >= 3 && r < 0.20) type = 'runner';
    if (difficultyLevel >= 6 && r >= 0.20 && r < 0.35) type = 'tank';
    if (difficultyLevel >= 9 && r >= 0.35 && r < 0.50) type = 'shooter';
    if (difficultyLevel >= 12 && r >= 0.50 && r < 0.65) type = 'splitter';
    enemies.push(makeEnemy(type));
  }

  if (bossTimer >= 60 && !bossActive && gameMode !== 'aventura') {
    bossTimer = 0;
    spawnBoss();
  }

  // update grid
  updateCollisionGrid();

  // enemies update + colisões
  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    en.update(dt);

    const dist = Math.hypot(player.x - en.x, player.y - en.y);
    if (dist < player.radius + en.radius) {
      let dmg = Math.max(6, Math.floor(10 + level * 0.8));
      if (window.difficultyMultipliers) {
        dmg = Math.ceil(dmg * window.difficultyMultipliers.enemyDamageMultiplier);
      }
      if (en.type === 'runner') dmg = Math.max(4, Math.floor(dmg * 0.7));
      if (en.type === 'tank') dmg = Math.floor(dmg * 1.4);
      if (en.type === 'boss') dmg = Math.floor(dmg * 2.0);
      player.hp = Math.max(0, player.hp - dmg);
      Audio.sfxHit();
      if (en.type === 'boss') {
        const nx = (player.x - en.x) / (dist || 1);
        const ny = (player.y - en.y) / (dist || 1);
        const kb = 140;
        player.x += nx * kb;
        player.y += ny * kb;
        screenShake = Math.max(screenShake, 12);
        player.x = clamp(player.x, player.radius, window.innerWidth - player.radius);
        player.y = clamp(player.y, player.radius, window.innerHeight - player.radius);
        if (player.hp <= 0) { gameOver(); }
        continue;
      } else {
        screenShake = Math.max(screenShake, 8);
        if (player.hp <= 0) { gameOver(); }
        killEnemy(i, en);
        continue;
      }
    }

    // Otimização: buscar apenas balas próximas
    const candidates = getNearbyEntities(en.x, en.y, 'bullet');
    for (const b of candidates) {
      if (b.markedForDeletion) continue;

      const bd = Math.hypot(en.x - b.x, en.y - b.y);
      if (bd < en.radius + b.radius) {
        let finalDmg = b.damage;
        if (window.difficultyMultipliers) {
          finalDmg = Math.max(1, Math.floor(finalDmg * window.difficultyMultipliers.playerDamage));
        }
        en.hp -= finalDmg;
        createParticle(en.x, en.y, en.color);

        if (b.pierce > 0) b.pierce -= 1;
        else b.markedForDeletion = true;

        if (en.hp <= 0) { killEnemy(i, en); break; }
      }
    }
  }

  // Remove balas marcadas
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bullets[i].markedForDeletion) bullets.splice(i, 1);
  }

  // gems
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    const dist = Math.hypot(player.x - g.x, player.y - g.y);

    if (dist < player.xpMagnet) {
      const a = Math.atan2(player.y - g.y, player.x - g.x);
      g.x += Math.cos(a) * 6.2 * 60 * dt;
      g.y += Math.sin(a) * 6.2 * 60 * dt;
    }

    if (dist < player.radius + 10) {
      let xpAmount = g.value;
      if (window.difficultyMultipliers) {
        xpAmount = Math.ceil(xpAmount * window.difficultyMultipliers.xpGain);
      }

      if (goldRushTimer > 0) {
        gold += xpAmount;
        if (goldText) goldText.innerText = gold;
      } else {
        if (gameMode === 'aventura') {
          // Em aventura, XP vira Ouro (+1)
          gold += 1;
          if (goldText) goldText.innerText = gold;
        } else {
          xp += xpAmount;
          if (xp >= xpNextLevel) levelUp();
        }
      }

      gems.splice(i, 1);
      Audio.sfxPickup();
    }
  }

  // powerups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    const dist = Math.hypot(player.x - p.x, player.y - p.y);
    if (dist < player.xpMagnet) {
      const a = Math.atan2(player.y - p.y, player.x - p.x);
      p.x += Math.cos(a) * 7.0 * 60 * dt;
      p.y += Math.sin(a) * 7.0 * 60 * dt;
    }
    if (dist < player.radius + 15) {
      if (p.type === 'gold_rush') {
        goldRushTimer = 5; // 5 segundos
        showFloatingText('FEBRE DO OURO!', player.x, player.y - 30, '#ffd700');
        Audio.sfxLevel(); // reaproveita som top
      }
      powerups.splice(i, 1);
    }
  }

  // drift upgrades timers & collision
  for (let i = driftUpgrades.length - 1; i >= 0; i--) {
    const d = driftUpgrades[i];
    d.timer -= dt;
    if (d.timer <= 0) {
      driftUpgrades.splice(i, 1);
      continue;
    }

    const dist = Math.hypot(player.x - d.x, player.y - d.y);
    if (dist < player.radius + d.radius) {
      driftUpgrades.splice(i, 1);
      Audio.sfxLevel();

      const up = d.upgrade;
      if (up) {
        // Aplicar o upgrade
        if (d.isSuper) {
          // Upgrade Dourado: Garante Nível 5 (Máximo da Run) imediatamente
          const currentLevels = upgradePickCount[up.id] || 0;
          const levelsToAdd = Math.max(1, 5 - currentLevels);

          for (let k = 0; k < levelsToAdd; k++) {
            up.apply();
            upgradePickCount[up.id] = (upgradePickCount[up.id] || 0) + 1;
          }
          showFloatingText(`+${levelsToAdd} ${up.title.toUpperCase()}! 🔱`, player.x, player.y - 40, '#ffd700');
        } else {
          // Upgrade Normal: +1 Nível
          up.apply();
          upgradePickCount[up.id] = (upgradePickCount[up.id] || 0) + 1;
          showFloatingText(`+1 ${up.title.toUpperCase()}! 🚀`, player.x, player.y - 40, '#00f2fe');
        }

        // Rastrear progresso de Maestria
        if (upgradePickCount[up.id] >= 10) {
          const mastered = permanentUpgrades.masteredUpgrades || [];
          if (!mastered.includes(up.id)) {
            mastered.push(up.id);
            permanentUpgrades.masteredUpgrades = mastered;
            saveSettings({ permanentUpgrades });
          }
        }
      }
    }
  }

  // Periodic drift spawn in Adventure (Deterministic Timer)
  if (gameMode === 'aventura' && gameActive && !paused && !pausedForUpgrade) {
    adventureState.driftTimer -= dt;
    if (adventureState.driftTimer <= 0) {
      adventureState.driftTimer = 20; // caixa a cada 10 segundos sumir
      spawnDriftUpgrade();
    }
  }

  // Timer Febre do Ouro
  if (goldRushTimer > 0) {
    goldRushTimer = Math.max(0, goldRushTimer - dt);
    const goldRushUI = document.getElementById('gold-rush-ui');
    if (goldRushTimer > 0) {
      if (goldRushUI) {
        goldRushUI.style.display = 'block';
        document.getElementById('gold-rush-time').innerText = goldRushTimer.toFixed(1);
      }
    } else {
      if (goldRushUI) goldRushUI.style.display = 'none';
      showFloatingText('Acabou a Febre!', player.x, player.y - 30, '#fff');
    }
  }

  // coins (ouro)
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    const dist = Math.hypot(player.x - c.x, player.y - c.y);

    if (dist < player.xpMagnet) {
      const a = Math.atan2(player.y - c.y, player.x - c.x);
      c.x += Math.cos(a) * 7.0 * 60 * dt;
      c.y += Math.sin(a) * 7.0 * 60 * dt;
    }

    if (dist < player.radius + 10) {
      gold += c.value;
      coins.splice(i, 1);
      Audio.sfxPickup();
    }
  }

  // hearts (cura)
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    const dist = Math.hypot(player.x - h.x, player.y - h.y);
    // atrai apenas se precisar de cura
    if (player.hp < player.maxHp && dist < player.xpMagnet) {
      const a = Math.atan2(player.y - h.y, player.x - h.x);
      h.x += Math.cos(a) * 4.2 * 60 * dt;
      h.y += Math.sin(a) * 4.2 * 60 * dt;
    }
    // coleta somente se precisar de cura
    if (player.hp < player.maxHp && dist < player.radius + 12) {
      player.hp = Math.min(player.maxHp, player.hp + h.heal);
      hearts.splice(i, 1);
      Audio.sfxPickup();
      showFloatingText(`+${h.heal} HP`, player.x, player.y, '#ff4d6d');
    }
  }

  // partículas
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * 60 * dt;
    p.y += p.vy * 60 * dt;
    p.alpha -= 0.9 * dt;
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  // ui
  hpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
  xpFill.style.width = `${Math.min(1, xp / xpNextLevel) * 100}%`;

  // UI Laser (Energia)
  const laserLabel = document.getElementById('laser-energy-label');
  const laserBarContainer = document.getElementById('laser-energy-bar');
  const laserFill = document.getElementById('laser-energy-fill');

  if (weaponSystem.currentWeapon === 'laser' && laserLabel && laserBarContainer && laserFill) {
    laserLabel.style.display = 'block';
    laserBarContainer.style.display = 'block';
    const energyPct = (player.laserEnergy / player.laserMaxEnergy) * 100;
    laserFill.style.width = `${energyPct}%`;

    // Feedback visual de superaquecimento
    if (player.isLaserOverheated) {
      laserFill.classList.add('overheated');
      laserLabel.innerText = 'SUPERAQUECIDO! AGUARDE...';
    } else {
      laserFill.classList.remove('overheated');
      laserLabel.innerText = 'CARGA DO LASER';
    }
  } else if (laserLabel && laserBarContainer) {
    laserLabel.style.display = 'none';
    laserBarContainer.style.display = 'none';
  }

  // UI Nível / Mundo / Timer (Modo Aventura)
  const worldPhaseStr = adventureState.active
    ? ` ${adventureState.currentWorld + 1}-${adventureState.currentPhase + 1}`
    : `NÍVEL ${level}`;

  if (levelText) levelText.innerText = worldPhaseStr;

  // Esconder barra de XP no Modo Aventura
  if (xpFill && xpFill.parentElement) {
    xpFill.parentElement.style.display = (gameMode === 'aventura') ? 'none' : 'block';
  }

  // UI Shotgun (Munição)
  const shotgunLabel = document.getElementById('shotgun-ammo-label');
  const shotgunBarContainer = document.getElementById('shotgun-ammo-bar');
  const shotgunFill = document.getElementById('shotgun-ammo-fill');

  if (weaponSystem.currentWeapon === 'shotgun' && shotgunLabel && shotgunBarContainer && shotgunFill) {
    shotgunLabel.style.display = 'block';
    shotgunBarContainer.style.display = 'block';

    if (player.shotgunReloadTimer > 0) {
      player.shotgunReloadTimer -= dt;
      const reloadPct = (1 - (player.shotgunReloadTimer / 1.5)) * 100;
      shotgunFill.style.width = `${reloadPct}%`;
      shotgunFill.classList.add('reloading');
      shotgunLabel.innerText = 'RECARREGANDO PUMP...';

      if (player.shotgunReloadTimer <= 0) {
        player.shotgunAmmo = player.shotgunMaxAmmo;
        shotgunFill.classList.remove('reloading');
      }
    } else {
      const ammoPct = (player.shotgunAmmo / player.shotgunMaxAmmo) * 100;
      shotgunFill.style.width = `${ammoPct}%`;
      shotgunLabel.innerText = `MUNIÇÃO: ${player.shotgunAmmo}/${player.shotgunMaxAmmo}`;
    }
  } else if (shotgunLabel && shotgunBarContainer) {
    shotgunLabel.style.display = 'none';
    shotgunBarContainer.style.display = 'none';
  }

  // UI Skill Buttons Mobile
  if (isTouch && gameActive) {
    const sg = player.skills.grenade, se = player.skills.emp, sl = player.skills.laser;
    document.getElementById('mbtn-q').style.display = sg.level > 0 ? 'flex' : 'none';
    document.getElementById('mbtn-e').style.display = se.level > 0 ? 'flex' : 'none';
    document.getElementById('mbtn-r').style.display = sl.level > 0 ? 'flex' : 'none';

    // Opacidade baseada no cooldown
    const updateBtn = (id, timer, cd) => {
      const el = document.getElementById(id);
      if (timer > 0) el.style.opacity = '0.3';
      else el.style.opacity = '1';
    };
    updateBtn('mbtn-q', sg.timer, sg.cd);
    updateBtn('mbtn-e', se.timer, se.cd);
    updateBtn('mbtn-r', sl.timer, sl.cd);
    updateBtn('mbtn-pulse', pulse.timer, pulse.cooldown);
  }

  // shake decay
  if (screenShake > 0.3) screenShake *= (1 - 6 * dt);
  else screenShake = 0;
}

function showFloatingText(text, x, y, color) {
  const el = document.createElement('div');
  el.innerText = text;
  el.style.position = 'absolute';
  el.style.left = x + 'px';
  el.style.top = (y - 40) + 'px';
  el.style.color = color;
  el.style.fontWeight = 'bold';
  el.style.fontSize = '16px';
  el.style.textShadow = '0 0 4px black';
  el.style.pointerEvents = 'none';
  el.style.transition = 'all 0.8s ease-out';
  el.style.zIndex = '100';
  document.body.appendChild(el);

  // Força reflow
  el.getBoundingClientRect();

  el.style.transform = 'translateY(-40px)';
  el.style.opacity = '0';

  setTimeout(() => el.remove(), 800);
}

// Função para desenhar polígonos regulares
function drawPolygon(ctx, x, y, radius, sides) {
  ctx.moveTo(x + radius, y);
  for (let i = 1; i <= sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
  }
  ctx.closePath();
}

function draw() {
  // fallback se erro fatal
  if (fatalErr) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.fillStyle = '#ff416c';
    ctx.font = '18px Segoe UI, Tahoma, sans-serif';
    ctx.fillText('ERRO NO JOGO:', 20, 40);
    ctx.fillStyle = '#fff';
    ctx.fillText(fatalErr, 20, 70);
    return;
  }

  if (sprites.bg_space && sprites.bg_space.complete && sprites.bg_space.naturalWidth) {
    if (!window.bgPattern) window.bgPattern = ctx.createPattern(sprites.bg_space, 'repeat');
    ctx.save();
    // Calcula offset de parallax (inverte e se move a 10% da vel da nave)
    const offsetX = -(player.x * 0.1) % sprites.bg_space.naturalWidth;
    const offsetY = -(player.y * 0.1) % sprites.bg_space.naturalHeight;
    ctx.translate(offsetX, offsetY);
    ctx.fillStyle = window.bgPattern;
    // Pinta espaço de folga para não vazar a tela
    ctx.fillRect(-sprites.bg_space.naturalWidth, -sprites.bg_space.naturalHeight, window.innerWidth + 2 * sprites.bg_space.naturalWidth, window.innerHeight + 2 * sprites.bg_space.naturalHeight);
    ctx.restore();

    // Contraste e Cor do Mundo (Modo Aventura)
    let tint = 'rgba(0, 0, 0, 0.45)';
    if (gameMode === 'aventura') {
      const tints = [
        'rgba(0, 10, 20, 0.45)', // Mundo 1: Padrão
        'rgba(0, 30, 0, 0.5)',  // Mundo 2: Verde
        'rgba(10, 0, 30, 0.55)', // Mundo 3: Roxo
        'rgba(40, 0, 0, 0.5)',  // Mundo 4: Vermelho
        'rgba(40, 40, 0, 0.4)', // Mundo 5: Amarelo/Ouro
        'rgba(0, 20, 40, 0.5)'  // Mundo 6: Azul profundo
      ];
      tint = tints[adventureState.currentWorld] || tint;
    }
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  } else {
    // Fallback original
    ctx.fillStyle = 'rgba(5, 5, 5, 0.35)';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }

  ctx.save();
  if (screenShake > 1) ctx.translate(Math.random() * screenShake - screenShake / 2, Math.random() * screenShake - screenShake / 2);

  // gems
  for (const g of gems) {
    if (goldRushTimer > 0) {
      ctx.fillStyle = '#ffd700'; // ficam amarelas durante a febre
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#ffa500';
    } else {
      ctx.fillStyle = '#00f2fe';
      ctx.shadowBlur = 0;
    }
    if (sprites.item_xp && sprites.item_xp.complete && !(goldRushTimer > 0)) {
      ctx.drawImage(sprites.item_xp, g.x - 12, g.y - 12, 24, 24);
    } else {
      ctx.beginPath();
      ctx.arc(g.x, g.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;

  // powerups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    if (p.type === 'gold_rush') {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffd700';
      ctx.font = '22px Segoe UI, Tahoma, sans-serif';
      ctx.fillText('⭐', p.x - 11, p.y + 7);
      ctx.shadowBlur = 0;
    }
  }

  // drift upgrades
  for (const d of driftUpgrades) {
    const up = d.upgrade;
    if (!up) continue;

    ctx.save();

    // Efeito de brilho baseado no tipo
    if (d.isSuper) {
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#ffd700';
    } else {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00f2fe';
    }

    const img = cardImages[up.id];
    if (img && img.complete) {
      ctx.drawImage(img, d.x - 24, d.y - 24, 48, 48);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = '24px Segoe UI, Tahoma, sans-serif';
      const icon = getDefaultIconHtml(up).replace(/<[^>]+>/g, '') || '🚀';
      ctx.fillText(icon, d.x - 12, d.y + 8);
    }

    ctx.shadowBlur = 0;

    // Anel de brilho externo
    ctx.strokeStyle = d.isSuper ? 'rgba(255, 215, 0, 0.6)' : 'rgba(0, 242, 254, 0.4)';
    ctx.lineWidth = d.isSuper ? 5 : 3;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 28, 0, Math.PI * 2);
    ctx.stroke();

    // Timer visual circular
    ctx.strokeStyle = d.isSuper ? '#ffd700' : '#00f2fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const maxTimer = d.isSuper ? 20 : 15;
    ctx.arc(d.x, d.y, 32, -Math.PI / 2, -Math.PI / 2 + (d.timer / maxTimer) * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // coins
  for (const c of coins) {
    if (sprites.item_coin && sprites.item_coin.complete) {
      ctx.drawImage(sprites.item_coin, c.x - 14, c.y - 14, 28, 28);
    } else {
      ctx.fillStyle = '#ffd700';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#ffa500';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // hearts
  for (const h of hearts) {
    if (sprites.item_heart && sprites.item_heart.complete) {
      ctx.drawImage(sprites.item_heart, h.x - 12, h.y - 12, 24, 24);
    } else {
      ctx.fillStyle = '#ff4d6d';
      ctx.font = '14px Segoe UI, Tahoma, sans-serif';
      ctx.fillText('❤', h.x - 6, h.y + 5);
    }
  }

  // player - textura baseada na arma selecionada
  const spriteKey = 'player_' + selectedWeapon;
  const playerSprite = sprites[spriteKey] || sprites['player_plasma'];

  if (playerSprite && playerSprite.complete) {
    ctx.save();
    ctx.translate(player.x, player.y);
    // Mira: aimAngle() aponta para onde a nave atira.
    const angle = aimAngle();
    // Nossas texturas "upwards" viradas para a direita (0 radianos):
    ctx.rotate(angle + Math.PI / 2);
    const sSize = player.radius * 5.4; // Um pouco maior que o raio pra cobrir colisões
    ctx.drawImage(playerSprite, -sSize / 2, -sSize / 2, sSize, sSize);
    ctx.restore();
  } else {
    // Fallback Geométrico
    ctx.shadowBlur = 20;
    ctx.shadowColor = weaponColors[selectedWeapon];
    ctx.fillStyle = weaponColors[selectedWeapon];
    ctx.beginPath();

    switch (selectedWeapon) {
      case 'shotgun': drawPolygon(ctx, player.x, player.y, player.radius, 6); break;
      case 'laser': drawPolygon(ctx, player.x, player.y, player.radius, 5); break;
      case 'railgun': drawPolygon(ctx, player.x, player.y, player.radius, 8); break;
      case 'flamethrower': drawPolygon(ctx, player.x, player.y, player.radius, 3); break;
      default: ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // orbital draw
  const skOrb = player.skills.orbital;
  if (skOrb && skOrb.level > 0 && skOrb.count > 0) {
    const orbitR = 65 + skOrb.level * 2;
    const orbSize = 8 + Math.min(6, skOrb.level);
    for (let i = 0; i < skOrb.count; i++) {
      const a = skOrb.angle + (i * (Math.PI * 2 / skOrb.count));
      const ox = player.x + Math.cos(a) * orbitR;
      const oy = player.y + Math.sin(a) * orbitR;

      ctx.shadowBlur = 10;
      ctx.shadowColor = '#5d4037';
      ctx.fillStyle = '#752e20ff';
      ctx.beginPath();
      ctx.arc(ox, oy, orbSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // Barras de cooldown (discretas) abaixo do player
  const bars = [];
  // Pulso (botão direito) sempre
  bars.push({ name: 'PULSO', timer: pulse.timer, cd: pulse.cooldown, readyColor: 'rgba(254, 0, 0, 1)', cdColor: 'rgba(255,65,108,0.85)' });

  // Q/E/R apenas se tiver habilidade
  const g = player.skills.grenade;
  const e = player.skills.emp;
  const l = player.skills.laser;

  if (g.level > 0) bars.push({ name: 'Q', timer: g.timer, cd: g.cd, readyColor: 'rgba(148, 0, 254, 1)', cdColor: 'rgba(255, 65, 246, 1)' });
  if (e.level > 0) bars.push({ name: 'E', timer: e.timer, cd: e.cd, readyColor: 'rgba(254, 0, 152, 0.85)', cdColor: 'rgba(255,65,108,0.85)' });
  if (l.level > 0) bars.push({ name: 'R', timer: l.timer, cd: l.cd, readyColor: 'rgba(144, 254, 0, 0.85)', cdColor: 'rgba(65, 255, 109, 0.85)' });

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
  if (pulse.flash > 0) {
    const r = pulse.radius * (1 - pulse.flash * 0.15);
    ctx.globalAlpha = 0.28 * pulse.flash;
    ctx.strokeStyle = 'rgba(254, 0, 0, 1)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // active lasers draw
  for (const l of activeLasers) {
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = l.color || 'rgba(0,242,254,0.85)';
    ctx.lineWidth = l.w;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();

    // Core central mais brilhante
    ctx.strokeStyle = 'white';
    ctx.lineWidth = l.w / 2.5;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  activeLasers.length = 0; // Limpa para o próximo frame

  // mira (desktop)
  if (!isTouch) {
    ctx.strokeStyle = 'rgba(0,242,254,0.25)';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(mouse.x, mouse.y);
    ctx.stroke();
  }

  // bullets player
  // Usar filter para desenhar chamas com blend mode diferente
  const flameBullets = bullets.filter(b => b.isFlame);
  const normalBullets = bullets.filter(b => !b.isFlame);

  // Desenha balas normais
  for (const b of normalBullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Desenha chamas com brilho
  if (flameBullets.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of flameBullets) {
      const lifePct = b.life / b.maxLife;
      // Rampa de cor: Branco/Amarelo -> Laranja -> Vermelho -> Escuro/Smoke
      let r, g, bl, alpha;

      if (lifePct < 0.25) {
        // Hot start (Branco para Amarelo)
        r = 255; g = 255; bl = 255 * (1 - lifePct / 0.25); alpha = 0.8;
      } else if (lifePct < 0.5) {
        // Mid (Amarelo para Laranja)
        r = 255; g = 255 * (1 - (lifePct - 0.25) / 0.25 * 0.5); bl = 0; alpha = 0.7;
      } else if (lifePct < 0.8) {
        // Late (Laranja para Vermelho)
        r = 255; g = 127 * (1 - (lifePct - 0.5) / 0.3); bl = 0; alpha = 0.5 * (1 - (lifePct - 0.5) / 0.3);
      } else {
        // End (Fumaça / Fade)
        r = 100 * (1 - (lifePct - 0.8) / 0.2); g = 0; bl = 0; alpha = 0.2 * (1 - (lifePct - 0.8) / 0.2);
      }

      ctx.fillStyle = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(bl)},${alpha})`;
      ctx.beginPath();
      // O raio já cresce no update
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // bullets enemy
  for (const b of enemyBullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Joystick Visual (Mobile)
  if (isTouch && touchMove.active) {
    const rBase = 50, rStick = 24;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff';

    // Base
    ctx.beginPath();
    ctx.arc(touchMove.startX, touchMove.startY, rBase, 0, Math.PI * 2);
    ctx.fill();

    // Stick
    ctx.beginPath();
    ctx.arc(touchMove.x, touchMove.y, rStick, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // omega jets
  if (player.skills.omega.level > 0) {
    for (const jet of player.skills.omega.jets) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(85, 255, 0, 0.92)';
      ctx.beginPath();
      ctx.arc(jet._x, jet._y, 6 + player.skills.omega.level * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // enemies
  for (const en of enemies) en.draw();

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // joystick visual
  if (touchMove.active) {
    const dx = touchMove.x - touchMove.startX;
    const dy = touchMove.y - touchMove.startY;
    const maxR = 60;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len * Math.min(maxR, len);
    const ny = dy / len * Math.min(maxR, len);

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = 'rgba(0,242,254,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(touchMove.startX, touchMove.startY, maxR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,242,254,0.6)';
    ctx.beginPath();
    ctx.arc(touchMove.startX + nx, touchMove.startY + ny, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Glow da Febre do Ouro na tela inteira - O efeito pisca com opacidade muito baixa
  if (goldRushTimer > 0) {
    // Pisca entre ligado/desligado a cada 150ms
    if (Math.floor(Date.now() / 150) % 2 === 0) {
      ctx.globalAlpha = 0.03; // Opacidade bem baixinha
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalAlpha = 1;
    }
  }
}

function gameLoop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  pollGamepad(); // Sempre lê o controle, mesmo durante upgrade/pause
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// ======================
// Progressão
// ======================
function levelUp() {
  level++;
  xp = 0;
  xpNextLevel = Math.floor(xpNextLevel * 1.2);

  player.maxHp += 8;
  player.hp = Math.min(player.maxHp, player.hp + 12);

  levelText.innerText = `NÍVEL ${level}`;
  Audio.sfxLevel();
  openUpgradeScreen();
}

function gameOver() {
  gameActive = false;
  stopGameTimer();

  // Salvar ouro e pedras raras mesmo na derrota
  totalGold += gold;
  totalRareStones += rareStones;
  saveSettings({ totalGold, totalRareStones });

  // Restaurar estilo de derrota
  const title = deathScreen.querySelector('h1');
  title.innerText = 'SINAL PERDIDO';
  title.style.color = '#ff416c';


  deathScreen.style.display = 'flex';

  try {
    Audio.stopMusic();
  } catch (e) { }

  if (isTouch) {
    btnPauseMobile.classList.remove('hidden');
    btnWeaponSwap.classList.remove('hidden');
    document.getElementById('mobile-controls').classList.remove('hidden');
  }
  document.getElementById('final-stats').innerHTML =
    `Você sobreviveu por ${timerDisplay.innerText}<br>Eliminou ${score} inimigos<br>🪙 Ouro: ${gold} &nbsp;&nbsp; 💎 Diamantes: ${rareStones}`;
}

// timer removido, agora controlado no updateGameTimer e loop principal

// ======================
// HUD upgrades (texto)
// ======================
let hudAcc = 0;
function updateHud(dt) {
  if (!gameActive) return;

  // Atualiza nome da arma
  if (weaponNameEl) {
    const w = weaponSystem.weaponStats[weaponSystem.currentWeapon];
    weaponNameEl.innerText = w.name.toUpperCase();
    weaponNameEl.style.color = w.color;
  }

  if (goldText) {
    goldText.innerText = gold;
  }
  const rareTextEl = document.getElementById('rare-text');
  if (rareTextEl) {
    rareTextEl.innerText = rareStones;
  }

  hudAcc += dt;
  if (hudAcc < 0.2) return;
  hudAcc = 0;

  const sk = player.skills;
  const lines = [];

  lines.push(`<b>Dano</b>: ${player.damage.toFixed(1)}  <b>Tiro/s</b>: ${player.fireRate.toFixed(1)}  <b>Proj</b>: ${player.weaponLevel}  <b>Pierce</b>: ${player.piercing}`);
  lines.push(`<b>Vel</b>: ${player.speed.toFixed(2)}  <b>Magnet</b>: ${Math.floor(player.xpMagnet)}  <b>Regen</b>: ${player.regen.toFixed(1)}/s`);
  lines.push(`<hr style="border:0;border-top:1px solid rgba(255,255,255,0.12);margin:8px 0;">`);

  const activeSkills = [];
  if (sk.nebulizer.level > 0) activeSkills.push(`✅ Nebulizador Caótico <b>Lv</b> ${sk.nebulizer.level}`);
  if (sk.scattergun.level > 0) activeSkills.push(`✅ Canhão de Estilhaços <b>Lv</b> ${sk.scattergun.level}`);
  if (sk.zap.level > 0) activeSkills.push(`✅ Condutor Arcano <b>Lv</b> ${sk.zap.level}`);
  if (sk.omega.level > 0) activeSkills.push(`✅ Esquadrão Ômega <b>Lv</b> ${sk.omega.level}`);
  if (sk.orbital.level > 0) activeSkills.push(`✅ Escudo Orbital <b>Lv</b> ${sk.orbital.level}`);
  if (sk.vampirism.level > 0) activeSkills.push(`✅ Vampirismo <b>Lv</b> ${sk.vampirism.level}`);

  if (activeSkills.length > 0) {
    lines.push(activeSkills.join('<br>'));
  } else {
    lines.push(`<span style="color:#888;font-size:0.9em;">Nenhum passivo extra</span>`);
  }

  const cd = (timer, cd) => timer > 0 ? `${timer.toFixed(1)}s` : 'PRONTO';
  lines.push(`<hr style="border:0;border-top:1px solid rgba(255,255,255,0.12);margin:8px 0;">`);

  const activeMods = [];
  if (sk.grenade.level > 0) activeMods.push(`💣 Carga Volátil <b>Lv</b> ${sk.grenade.level} — <b>${cd(sk.grenade.timer, sk.grenade.cd)}</b>`);
  if (sk.emp.level > 0) activeMods.push(`⚡ EMP <b>Lv</b> ${sk.emp.level} — <b>${cd(sk.emp.timer, sk.emp.cd)}</b>`);
  if (sk.laser.level > 0) activeMods.push(`🔴 Laser <b>Lv</b> ${sk.laser.level} — <b>${cd(sk.laser.timer, sk.laser.cd)}</b>`);

  if (activeMods.length > 0) {
    lines.push(activeMods.join('<br>'));
  }

  lines.push(`<div style="margin-top:6px;opacity:.75">Pulso (botão direito): <b>${pulse.timer > 0 ? pulse.timer.toFixed(1) + 's' : 'PRONTO'}</b></div>`);

  hudContent.innerHTML = lines.join('<br>');
}

// hook into game loop by wrapping update
const _update = update;
update = function (dt) {
  _update(dt);
  updateHud(dt);
  updateGameTimer(dt);
};

// ======================
// Sistema de Loja (Shop)
// ======================
function getUpgradeCost(id) {
  // Pode ser da shopConfig base ou do upgradeShopItems
  const cfg = shopConfig.find(c => c.id === id) || upgradeShopItems.find(c => c.id === id);
  if (!cfg) return 0;
  const currentLvl = permanentUpgrades[id] || 0;
  return Math.floor(cfg.cost * Math.pow(cfg.costScale, currentLvl));
}

function buildShopItemHtml(cfg, currentLvl, isMaxed, canAfford, currency = 'gold') {
  const dots = Array.from({ length: Math.min(cfg.max, 10) }, (_, i) =>
    `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;margin:0 2px;background-color:${i < currentLvl ? (currency === 'rare' ? '#a855f7' : '#ffd700') : '#444'}"></span>`
  ).join('');

  const cost = Math.floor(cfg.cost * Math.pow(cfg.costScale, currentLvl));
  const currencyIcon = currency === 'rare' ? '💎' : '🪙';
  const affordColor = isMaxed ? '#00e676' : (canAfford ? (currency === 'rare' ? '#a855f7' : '#ffd700') : '#ff416c');

  return `
    <div style="font-size:2em;margin-bottom:8px">${cfg.icon}</div>
    <h3 style="margin:0;font-size:1em;color:#fff">${cfg.name}</h3>
    <div style="font-size:0.82em;color:#aaa;margin:5px 0;line-height:1.3">${cfg.desc}</div>
    <div style="margin:8px 0">${dots}</div>
    <div style="font-size:0.88em;margin-bottom:10px;color:${affordColor}">
      ${isMaxed ? 'MÁXIMO' : `${currencyIcon} ${cost}`}
    </div>
    <button class="shop-btn" ${isMaxed || !canAfford ? 'disabled' : ''}
      style="padding:5px 15px;border-radius:4px;border:none;cursor:pointer;
      background:${isMaxed ? '#333' : (canAfford ? (currency === 'rare' ? '#a855f7' : '#00f2fe') : '#555')};
      color:${isMaxed ? '#888' : '#fff'};font-weight:bold;width:100%">
      ${isMaxed ? 'COMPLETO' : 'COMPRAR'}
    </button>
  `;
}

function renderShop() {
  const container = document.getElementById('shop-items');
  const goldDisplay = document.getElementById('shop-gold-display');
  const rareDisplay = document.getElementById('shop-rare-display');
  if (!container) return;

  if (goldDisplay) goldDisplay.innerText = totalGold;
  if (rareDisplay) rareDisplay.innerText = totalRareStones;

  container.innerHTML = '';

  // Classificadores de categorias baseados no ID
  const isPhysical = (id) => ['maxHp', 'regen', 'goldGain', 'perm_max_hp', 'perm_regen', 'perm_move_speed', 'perm_magnet'].includes(id);
  const isSkill = (id) => id.includes('skill_');

  // Preparar listas unificadas (vamos mesclar ouro e diamante, mas marcando a moeda)
  const allAvailable = [];

  // Base (Ouro)
  shopConfig.forEach(cfg => allAvailable.push({ ...cfg, currency: 'gold', isLocked: false }));

  // Dominados (Diamante) - Mostrar todos, mas marcar os não bloqueados
  const mastered = permanentUpgrades.masteredUpgrades || [];
  upgradeShopItems.forEach(cfg => {
    const unlocked = mastered.includes(cfg.unlockId);
    allAvailable.push({
      ...cfg,
      currency: 'rare',
      isLocked: !unlocked
    });
  });

  const generateSectionHtml = (title, items) => {
    if (items.length === 0) return '';

    let html = `<div class="shop-section-title">${title}</div><div class="shop-grid">`;
    items.forEach(cfg => {
      const currentLvl = permanentUpgrades[cfg.id] || 0;
      const isMaxed = currentLvl >= cfg.max;
      const cost = getUpgradeCost(cfg.id);
      const isRare = cfg.currency === 'rare';
      const isLocked = cfg.isLocked;
      const canAfford = isRare ? (totalRareStones >= cost) : (totalGold >= cost);

      const dotsHtml = Array.from({ length: Math.min(cfg.max, 10) }, (_, i) =>
        `<div class="shop-dot ${i < currentLvl ? (isRare ? 'filled-rare' : 'filled-gold') : ''}"></div>`
      ).join('');

      let itemClass = isRare ? 'shop-item-mastered' : '';
      if (isLocked) itemClass += ' shop-item-locked';

      let btnLabel = isMaxed ? 'COMPLETO' : `${isRare ? '💎' : '🪙'} ${cost}`;
      let btnClass = isRare ? 'btn-rare' : '';
      let btnDisabled = isMaxed || !canAfford;

      if (isLocked) {
        btnLabel = '🔒 BLOQUEADO';
        btnDisabled = true;
      }

      // Nomes disfarçados pra dar aquele clima misterioso em itens trancados! (Opcional, mas aqui mantemos o nome real mas nublado)
      html += `
        <div class="shop-item ${itemClass}">
          <div class="shop-icon-area">${isLocked ? '🔒' : cfg.icon}</div>
          <h3 class="shop-name">${isLocked ? 'Desconhecido' : cfg.name}</h3>
          <p class="shop-desc">${isLocked ? `Maestria Requerida: ${cfg.unlockId.replace('skill_', '').toUpperCase()}` : cfg.desc}</p>
          ${!isLocked ? `<div class="shop-progress">${dotsHtml}</div>` : ''}
          <button class="shop-buy-btn ${btnClass}" data-id="${cfg.id}" data-currency="${cfg.currency}" ${btnDisabled ? 'disabled' : ''}>
            ${btnLabel}
          </button>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  };

  // Separa renderizações
  const physItems = allAvailable.filter(i => isPhysical(i.id));
  const skillItems = allAvailable.filter(i => isSkill(i.id));
  const arsenalItems = allAvailable.filter(i => !isPhysical(i.id) && !isSkill(i.id));

  container.innerHTML += generateSectionHtml('🔋 EVOLUÇÃO FÍSICA', physItems);
  container.innerHTML += generateSectionHtml('🔫 MELHORIAS DE ARSENAL', arsenalItems);
  container.innerHTML += generateSectionHtml('✨ TECNOLOGIAS INTEGRADAS', skillItems);

  if (activeSkillsUnlockHint()) {
    container.innerHTML += `<div class="shop-section-title">🌟 MAIS TECNOLOGIAS</div><p style="color:#888; text-align:center;font-size:0.9em;margin-top:20px;">Pegue habilidades Nv 10 durantes as partidas para desbloquear novas integrações.</p>`;
  }

  // Atachar os eventos programaticamente aos botões gerados
  const buyBtns = container.querySelectorAll('.shop-buy-btn');
  buyBtns.forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const currency = e.target.getAttribute('data-currency');
      if (currency === 'gold') buyUpgrade(id);
      else buyUpgradeMastered(id);
    });
  });
}

function activeSkillsUnlockHint() {
  const mastered = permanentUpgrades.masteredUpgrades || [];
  return upgradeShopItems.length > mastered.length;
}

function buyUpgrade(id) {
  const cfg = shopConfig.find(c => c.id === id);
  if (!cfg) return;

  const currentLvl = permanentUpgrades[id] || 0;
  if (currentLvl >= cfg.max) return;

  const cost = getUpgradeCost(id);
  if (totalGold >= cost) {
    totalGold -= cost;
    permanentUpgrades[id] = currentLvl + 1;
    saveSettings({ totalGold, permanentUpgrades });
    Audio.sfxClick();
    renderShop();
  }
}

function buyUpgradeMastered(id) {
  const cfg = upgradeShopItems.find(c => c.id === id);
  if (!cfg) return;

  const currentLvl = permanentUpgrades[id] || 0;
  if (currentLvl >= cfg.max) return;

  const cost = getUpgradeCost(id);
  if (totalRareStones >= cost) { // usa pedra rara!
    totalRareStones -= cost;
    permanentUpgrades[id] = currentLvl + 1;
    saveSettings({ totalRareStones, permanentUpgrades });
    Audio.sfxClick();
    renderShop();
  }
}

// Event Listeners da Nova Navegação
const mainUiWrapper = document.getElementById('main-ui-wrapper');
const navBtns = document.querySelectorAll('.nav-btn');
const navPanes = document.querySelectorAll('.nav-pane');

navBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    // Tocar sfxzinho
    if (typeof Audio !== 'undefined' && Audio.sfxClick) Audio.sfxClick();

    // Resetar estado de views e botões
    navBtns.forEach(b => b.classList.remove('active'));
    navPanes.forEach(p => p.classList.add('hidden'));

    // Ativar o clicado
    e.target.classList.add('active');

    // Modo gambiarra pra pegar a pane certa
    let targetId = 'menu-screen';
    if (e.target.id === 'nav-btn-hangar') {
      targetId = 'hangar-screen';
    } else if (e.target.id === 'nav-btn-shop') {
      targetId = 'shop-screen';
      renderShop(); // renderiza qdo clica
    } else if (e.target.id === 'nav-btn-settings') {
      targetId = 'settings-screen';
    }

    const targetPane = document.getElementById(targetId);
    if (targetPane) targetPane.classList.remove('hidden');
  });
});

// ======================
// Novo Menu de Aventura (Mapa)
// ======================
function openAdventureMenu() {
  const overlay = document.getElementById('adventure-map-overlay');
  const slots = document.querySelectorAll('.world-slot');
  const progressDesc = document.getElementById('adv-progress-desc');
  const btnContinue = document.getElementById('btn-adv-continue');

  if (!overlay) return;
  overlay.classList.remove('hidden');

  // Carregar progresso real
  const maxW = adventureState.maxWorldReached || 0;
  const curW = adventureState.currentWorld || 0;
  const curP = adventureState.currentPhase || 0;

  if (progressDesc) {
    progressDesc.innerText = `Progresso Atual: Mundo ${curW + 1} - Fase ${curP + 1}`;
  }

  slots.forEach((slot, idx) => {
    if (idx <= maxW) {
      slot.classList.remove('locked');
      slot.querySelector('.world-status').innerText = (idx < maxW) ? "CONCLUÍDO" : "ATUAL";
      if (idx === curW) slot.classList.add('current');
      else slot.classList.remove('current');

      slot.onclick = () => {
        Audio.sfxClick();
        adventureState.currentWorld = idx;
        adventureState.currentPhase = 0; // Se selecionar um mundo ja aberto, recomeça na fase 1 dele
        openAdventureMenu(); // Refresh visual
      };
    } else {
      slot.classList.add('locked');
      slot.querySelector('.world-status').innerText = "BLOQUEADO";
      slot.onclick = null;
    }
  });

  if (btnContinue) {
    btnContinue.onclick = () => {
      overlay.classList.add('hidden');
      Audio.sfxClick();
      startGame();
    };
  }

  const btnBack = document.getElementById('btn-adv-back');
  if (btnBack) {
    btnBack.onclick = () => {
      overlay.classList.add('hidden');
      Audio.sfxClick();
    };
  }
}

// Botões de modo de jogo
const modeBtns = document.querySelectorAll('.mode-btn');
modeBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const mode = e.currentTarget.getAttribute('data-mode');
    if (mode === 'aventura') {
      Audio.sfxClick();
      setGameMode('aventura');
      openAdventureMenu();
    } else {
      Audio.sfxClick();
      setGameMode(mode);
    }

    modeBtns.forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
  });
});

// ======================
// Menu / Pause
// ======================
function startGame() {
  // reset state
  gameActive = true;
  paused = false;
  pausedForUpgrade = false;

  // Reset de progresso da run
  score = 0;
  level = 1;
  xp = 0;
  xpNextLevel = 100;

  // Só reseta ouro e diamantes se NÃO for transição de fase no Modo Aventura
  const isAdvTransition = (gameMode === 'aventura' && adventureState.active && adventureState.currentPhase > 0);
  if (!isAdvTransition) {
    gold = 0;
    rareStones = 0;
    rerollCost = 20;
    upgradeCost = 15;
    freeRerolls = 2;
    freeUpgrades = 1;
    upgradePickCount = {}; // Reseta contagem de upgrades
  }

  goldRushTimer = 0;
  powerups.length = 0;
  nextLevelLockedIds = [];
  seconds = 0; bossTimer = 0; bossActive = false;
  screenShake = 0; pulse.timer = 0; pulse.flash = 0;

  enemies.length = 0; bullets.length = 0; enemyBullets.length = 0; particles.length = 0; gems.length = 0; coins.length = 0;
  hearts.length = 0;
  if (document.getElementById('gold-rush-ui')) document.getElementById('gold-rush-ui').style.display = 'none';

  player.x = window.innerWidth / 2;
  player.y = window.innerHeight / 2;

  // Carregar upgrades permanentes (pu)
  const pu = permanentUpgrades;

  // Só reseta Habilidades e Stats se NÃO for transição de fase
  if (!isAdvTransition) {
    // reset skills
    for (const k in player.skills) {
      const s = player.skills[k];
      if (s.level !== undefined) s.level = 0;
      if (s.t !== undefined) s.t = 0;
      if (s.timer !== undefined) s.timer = 0;
      if (s.beam !== undefined) s.beam = 0;
      if (s.jets) s.jets.length = 0;
      if (s.count !== undefined) s.count = 0;
    }

    // Aplicar atributos base + upgrades permanentes
    const bonusHp = (pu.maxHp || 0) * 10;
    player.maxHp = 100 + bonusHp;
    player.hp = player.maxHp;

    const bonusDmgPct = (pu.damage || 0) * 0.10;
    player.damage = 1 * (1 + bonusDmgPct);

    const bonusRegen = (pu.regen || 0) * 0.5;
    player.regen = 0 + bonusRegen;

    const bonusGold = (pu.goldGain || 0) * 0.10;
    player.goldGain = 1 + bonusGold;

    player.speed = 4.2;
    player.weaponLevel = 1;
    player.bulletSpeed = 8;
    player.bulletRadius = 4;
    player.fireRate = 4.5;
    player.piercing = 0;
    player.xpMagnet = 100;

    // Aplicar upgrades de maestria (shorthand pu)
    player.damage += (pu.perm_damage || 0) * 0.5;
    player.fireRate *= 1 + (pu.perm_fire_rate || 0) * 0.08;
    player.weaponLevel += (pu.perm_more_proj || 0);
    player.bulletSpeed *= 1 + (pu.perm_bullet_speed || 0) * 0.10;
    player.bulletRadius *= 1 + (pu.perm_bullet_size || 0) * 0.15;
    player.piercing += (pu.perm_piercing || 0);
    player.speed *= 1 + (pu.perm_move_speed || 0) * 0.08;
    player.maxHp += (pu.perm_max_hp || 0) * 15;
    player.hp = player.maxHp;
    player.regen += (pu.perm_regen || 0) * 0.8;
    player.xpMagnet *= (1 + (pu.perm_magnet || 0) * 0.25);

    // Iniciar com habilidades (ranks permanentes via maestria)
    const skillPermMap = {
      perm_skill_nebulizer: 'nebulizer',
      perm_skill_scattergun: 'scattergun',
      perm_skill_grenade: 'grenade',
      perm_skill_emp: 'emp',
      perm_skill_laser: 'laser',
      perm_skill_zap: 'zap',
      perm_skill_orbital: 'orbital',
      perm_skill_vampirism: 'vampirism',
      perm_skill_omega: 'omega',
    };
    for (const [permId, skillId] of Object.entries(skillPermMap)) {
      const lvl = pu[permId] || 0;
      if (lvl > 0 && player.skills[skillId]) {
        player.skills[skillId].level = lvl;
        if (skillId === 'vampirism') {
          player.skills.vampirism.chance = 0.3 + lvl * 0.1;
          player.skills.vampirism.healAmount = 3 + lvl * 2;
        }
        if (skillId === 'orbital') {
          player.skills.orbital.count = Math.min(6, lvl);
          player.skills.orbital.damage = 15 + lvl * 4;
        }
      }
    }
  } else {
    // Em transição de fase: Apenas recarregar HP para o novo nível
    player.hp = player.maxHp;
  }

  // Configurar arma baseada na seleção do jogador
  const unlocked = permanentUpgrades.unlockedShips || ['plasma'];
  if (!unlocked.includes(selectedWeapon)) {
    selectedWeapon = 'plasma';
  }
  weaponSystem.currentWeapon = selectedWeapon;

  // No modo aventura, o "unlockedWeapons" do jogo é apenas o que você está usando?
  // Na verdade, o original desbloqueava as armas via upgrades durante a run.
  // Vamos manter a compatibilidade mas priorizar a selecionada.
  weaponSystem.unlockedWeapons = {
    plasma: selectedWeapon === 'plasma',
    shotgun: selectedWeapon === 'shotgun',
    laser: selectedWeapon === 'laser',
    railgun: selectedWeapon === 'railgun',
    flamethrower: selectedWeapon === 'flamethrower'
  };

  // Se for aventura, aplicar estado do mundo
  if (gameMode === 'aventura') {
    adventureState.active = true;
    const world = adventureWorldData[adventureState.currentWorld];
    gameTimeLimit = adventureState.currentPhase === 4 ? null : 120; // Boss não tem tempo

    // Limpa contador de kills da fase e timer de drift
    adventureState.killsThisPhase = 0;
    adventureState.driftTimer = 20; // timer da caixa 

    // Se for fase de Boss, spawna logo ao começar
    if (adventureState.currentPhase === 4) {
      setTimeout(spawnBoss, 1500);
    }
  } else {
    adventureState.active = false;
  }

  // Aplicar configurações de dificuldade e modo de jogo
  applyDifficultySettings();
  startGameTimer();

  // settings
  if (!isTouch) {
    player.autoFire = chkAutofire.checked;
    player.autoAim = chkAutofire.checked;
  }

  deathScreen.style.display = 'none';
  if (mainUiWrapper) mainUiWrapper.classList.add('hidden');
  pauseScreen.classList.add('hidden');

  // Esconde overlay de fase
  const stageClearOverlay = document.getElementById('stage-clear-overlay');
  if (stageClearOverlay) stageClearOverlay.classList.add('hidden');

  // mostra botão de pause apenas no mobile
  if (btnPauseMobile) btnPauseMobile.classList.toggle('hidden', !isTouch);
  if (btnWeaponSwap) btnWeaponSwap.classList.toggle('hidden', !isTouch);
  const mCtrl = document.getElementById('mobile-controls');
  if (mCtrl) mCtrl.classList.toggle('hidden', !isTouch);

  Audio.ensure();
  Audio.startMusic();
  levelText.innerText = adventureState.active
    ? `MUNDO ${adventureState.currentWorld + 1} - FASE ${adventureState.currentPhase + 1}`
    : 'NÍVEL 1';
  timerDisplay.innerText = '00:00';
  heartTimer = 0;
  scheduleNextHeart();
}

let autoProgressTimer = null;

function endGameWithPhaseClear() {
  gameActive = false;
  stopGameTimer();

  const stageClearOverlay = document.getElementById('stage-clear-overlay');
  const stageInfo = document.getElementById('stage-info');
  const countdownEl = document.getElementById('stage-countdown');
  const countdownNum = document.getElementById('stage-countdown-num');

  if (stageInfo) stageInfo.innerText = `Mundo ${adventureState.currentWorld + 1} - Fase ${adventureState.currentPhase + 1} Concluída!`;
  if (stageClearOverlay) stageClearOverlay.classList.remove('hidden');

  let secondsLeft = 5;
  if (countdownNum) countdownNum.innerText = secondsLeft;
  if (countdownEl) countdownEl.style.display = 'block';

  const startNext = () => {
    if (autoProgressTimer) clearInterval(autoProgressTimer);
    autoProgressTimer = null;
    stageClearOverlay.classList.add('hidden');
    openUpgradeScreen(false, () => {
      nextPhase();
    });
  };

  if (autoProgressTimer) clearInterval(autoProgressTimer);
  autoProgressTimer = setInterval(() => {
    secondsLeft--;
    if (countdownNum) countdownNum.innerText = secondsLeft;
    if (secondsLeft <= 0) {
      startNext();
    }
  }, 1000);

  const btnUpgrade = document.getElementById('btn-stage-upgrade');
  if (btnUpgrade) {
    btnUpgrade.onclick = () => {
      Audio.sfxClick();
      startNext();
    };
  }
}

function nextPhase() {
  adventureState.currentPhase++;

  // Se passou do Boss (fase 4), abre o shop mundial
  if (adventureState.currentPhase > 4) {
    openWorldShop();
    return;
  }

  saveSettings({ adventureState });
  startGame();
}

function openWorldShop() {
  const overlay = document.getElementById('world-shop-overlay');
  const container = document.getElementById('world-shop-items');
  if (!overlay || !container) {
    // Fallback se UI falhar
    adventureState.currentPhase = 0;
    adventureState.currentWorld++;
    saveSettings({ adventureState });
    startGame();
    return;
  }

  overlay.classList.remove('hidden');
  // Reutiliza renderização da shop mas injeta no container do overlay
  const oldContainer = document.getElementById('shop-items');
  const tempDiv = document.createElement('div');
  tempDiv.id = 'shop-items'; // Switch ID temporário para o renderShop funcionar

  // Na verdade, vamos apenas clonar a lógica de renderShop para ser mais seguro
  renderShop(); // Atualiza dados globais
  container.innerHTML = document.getElementById('shop-items').innerHTML;

  // Re-atachar eventos no novo container
  const buyBtns = container.querySelectorAll('.shop-buy-btn');
  buyBtns.forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const currency = e.target.getAttribute('data-currency');
      if (currency === 'gold') buyUpgrade(id);
      else buyUpgradeMastered(id);
      // Re-renderiza conteúdo interno
      renderShop();
      container.innerHTML = document.getElementById('shop-items').innerHTML;
      openWorldShop(); // recursão simples pra re-atachar (gambiarra do bem)
    });
  });

  const btnNext = document.getElementById('btn-next-world');
  btnNext.onclick = () => {
    overlay.classList.add('hidden');
    adventureState.currentPhase = 0;
    adventureState.currentWorld++;

    // Atualiza recorde de mundo
    adventureState.maxWorldReached = Math.max(adventureState.maxWorldReached, adventureState.currentWorld);

    if (adventureState.currentWorld >= 6) {
      alert("VOCÊ ATINGIU O LIMITE DA EXPEDIÇÃO! PARABÉNS PELO DESBLOQUEIO DE TODAS AS NAVES!");
      window.location.reload();
      return;
    }

    saveSettings({ adventureState });
    startGame();
  };
}

window.restartRunFromEndgame = function () {
  if (typeof Audio !== 'undefined' && Audio.sfxClick) Audio.sfxClick();
  startGame();
};

function togglePause() {
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

// ======================
// Sistema de Seleção de Personagens
// ======================
// ======================
// Sistema de Seleção de Personagens
// ======================
function renderHangar() {
  const cards = document.querySelectorAll('.character-card');
  const unlocked = permanentUpgrades.unlockedShips || ['plasma'];

  cards.forEach(card => {
    const weapon = card.getAttribute('data-weapon');
    const isUnlocked = unlocked.includes(weapon);
    const btn = card.querySelector('.select-character');

    if (isUnlocked) {
      card.classList.remove('locked');
      const lockIcon = card.querySelector('.lock-icon');
      if (lockIcon) lockIcon.remove();

      const desc = card.querySelector('p');
      if (weapon === 'plasma') desc.innerText = 'Equilibrada. Tiro consecutivo.';
      if (weapon === 'shotgun') desc.innerText = 'Múltiplos tiros em cone.';
      if (weapon === 'laser') desc.innerText = 'Disparo preciso e contínuo.';
      if (weapon === 'railgun') desc.innerText = 'Tiro perfurante poderoso.';
      if (weapon === 'flamethrower') desc.innerText = 'Área de controle ardente.';

      if (btn) {
        btn.innerText = 'ESCOLHER';
        btn.disabled = false;
      }
    } else {
      card.classList.add('locked');
      if (!card.querySelector('.lock-icon')) {
        const icon = document.createElement('div');
        icon.className = 'lock-icon';
        icon.innerText = '🔒';
        card.appendChild(icon);
      }
      if (btn) {
        btn.innerText = 'BLOQUEADO';
        btn.disabled = true;
      }
    }

    // Highlight selected
    if (weapon === selectedWeapon) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

function selectCharacter(weaponType) {
  const unlocked = permanentUpgrades.unlockedShips || ['plasma'];
  if (!unlocked.includes(weaponType)) return;

  selectedWeapon = weaponType;
  renderHangar();

  if (typeof Audio !== 'undefined' && Audio.sfxClick) Audio.sfxClick();
}

// Em vez de DOMContentLoaded individual, centralizamos a inicialização
function initMenu() {
  renderHangar();
  selectCharacter(selectedWeapon);
}

document.addEventListener('DOMContentLoaded', initMenu);

if (typeof btnResume !== 'undefined' && btnResume) {
  btnResume.addEventListener('click', () => {
    if (typeof Audio !== 'undefined' && Audio.sfxClick) Audio.sfxClick();
    togglePause();
  });
}

// Inicializar com padrões
setDifficulty('facil');
setGameMode('10min');

// ======================
// Start loop
// ======================
window.addEventListener('resize', resizeCanvas);
requestAnimationFrame((t) => { lastTime = t; requestAnimationFrame(gameLoop); });
