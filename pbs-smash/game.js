// ============================================================
// PBS SMASH! - A Super Smash Bros style platform fighter
// starring PBS Kids characters from the 2000s
// ============================================================

// ---------- CHARACTER ROSTER ----------
// All fighters are 100% legally distinct original characters. Any
// resemblance to beloved public-television icons is purely educational.
const CHARACTERS = [
    {
        id: 'arthur', name: 'ARTY', tagline: 'A bespectacled aardvark who loves the library',
        color: '#ffca28', size: 1.0,
        speed: 5.2, jump: 14, weight: 1.0, power: 1.0,
        special: 'book', specialName: 'Library Card Toss',
        taunt: 'Having fun isn\'t hard, with a library card!'
    },
    {
        id: 'buster', name: 'BLASTER', tagline: 'A rabbit who believes in aliens',
        color: '#e0e0e0', size: 1.0,
        speed: 5.0, jump: 16.5, weight: 0.85, power: 0.9,
        special: 'carrot', specialName: 'Carrot Lob',
        taunt: 'Aliens are totally real.'
    },
    {
        id: 'dw', name: 'D-DUB', tagline: 'A little sister with a big attitude',
        color: '#f48fb1', size: 0.92,
        speed: 6.0, jump: 14.5, weight: 0.75, power: 0.85,
        special: 'tantrum', specialName: 'Tantrum Spin',
        taunt: 'I\'m telling MOM!'
    },
    {
        id: 'clifford', name: 'BIG RED', tagline: 'An enormous crimson canine',
        color: '#e53935', size: 1.18,
        speed: 3.8, jump: 12, weight: 1.5, power: 1.45,
        special: 'bark', specialName: 'BIG RED BARK',
        taunt: 'Woof.'
    },
    {
        id: 'george', name: 'JORGE', tagline: 'A monkey with too many questions',
        color: '#8d6e63', size: 0.95,
        speed: 5.8, jump: 16, weight: 0.8, power: 0.9,
        special: 'banana', specialName: 'Banana Bounce',
        taunt: '*curious monkey noises*'
    },
    {
        id: 'wordgirl', name: 'THESAURA', tagline: 'A superhero with a synonym for everything',
        color: '#d32f2f', size: 1.0,
        speed: 6.5, jump: 15, weight: 0.9, power: 1.05,
        special: 'dash', specialName: 'Vocabulary Velocity',
        taunt: 'WORD UP!'
    },
    {
        id: 'digit', name: 'GIGABYTE', tagline: 'A cybernetic bird from inside the internet',
        color: '#ab47bc', size: 1.0,
        speed: 5.5, jump: 15.5, weight: 0.85, power: 0.95,
        special: 'zap', specialName: 'Cyber Beak Bolt',
        taunt: 'Yoiks!'
    },
    {
        id: 'caillou', name: 'BALDWIN', tagline: 'A bald four-year-old with unresolved anger',
        color: '#fdd835', size: 0.95,
        speed: 4.8, jump: 13.5, weight: 0.7, power: 1.15,
        special: 'scream', specialName: 'The Tantrum Heard Round The World',
        taunt: '*whining intensifies*'
    },
];

// ---------- CHARACTER SPRITES ----------
// Hand-drawn vector fighters. Each draws facing RIGHT in a local space
// with feet at (0,0), head up around y=-160, width roughly ±45.
const SPRITES = (() => {
    const TAU = Math.PI * 2;
    function ell(c, x, y, rx, ry, fill) {
        c.fillStyle = fill;
        c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
    }
    function rr(c, x, y, w, h, r, fill) {
        c.fillStyle = fill;
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath(); c.fill();
    }
    function eyes(c, x, y, gap, r = 4) {
        ell(c, x - gap, y, r + 2, r + 3, '#fff');
        ell(c, x + gap, y, r + 2, r + 3, '#fff');
        ell(c, x - gap + 1.5, y + 0.5, r - 1, r, '#222');
        ell(c, x + gap + 1.5, y + 0.5, r - 1, r, '#222');
    }
    function smile(c, x, y, r, color = '#5d4037') {
        c.strokeStyle = color; c.lineWidth = 2.5; c.lineCap = 'round';
        c.beginPath(); c.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    }
    function star(c, x, y, r, fill) {
        c.fillStyle = fill;
        c.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 5;
            const rad = i % 2 === 0 ? r : r * 0.45;
            c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
        }
        c.closePath(); c.fill();
    }

    return {
        // ARTY — tan aardvark, round ears, yellow sweater, round glasses
        arthur(c) {
            const skin = '#eec9a2', sweater = '#fbc02d';
            ell(c, -11, -3, 10, 5, '#6d4c41'); ell(c, 13, -3, 10, 5, '#6d4c41');
            rr(c, -18, -30, 14, 28, 4, '#5c7fbe'); rr(c, 4, -30, 14, 28, 4, '#5c7fbe');
            rr(c, -32, -76, 10, 34, 5, sweater); rr(c, 22, -76, 10, 34, 5, sweater);
            ell(c, -27, -41, 6, 6, skin); ell(c, 27, -41, 6, 6, skin);
            rr(c, -23, -80, 46, 52, 12, sweater);
            c.fillStyle = '#fff';
            c.beginPath(); c.moveTo(-10, -80); c.lineTo(0, -70); c.lineTo(10, -80); c.closePath(); c.fill();
            ell(c, -15, -120, 9, 10, skin); ell(c, 15, -120, 9, 10, skin);
            ell(c, -15, -120, 4.5, 5.5, '#d9a87c'); ell(c, 15, -120, 4.5, 5.5, '#d9a87c');
            ell(c, 0, -97, 26, 24, skin);
            c.strokeStyle = '#7a5230'; c.lineWidth = 3;
            c.beginPath(); c.arc(-9, -99, 8, 0, TAU); c.stroke();
            c.beginPath(); c.arc(10, -99, 8, 0, TAU); c.stroke();
            c.beginPath(); c.moveTo(-1, -99); c.lineTo(2, -99); c.stroke();
            ell(c, -8, -99, 2.5, 3, '#222'); ell(c, 11, -99, 2.5, 3, '#222');
            ell(c, 1, -88, 4, 3, '#8d6e63');
            smile(c, 0, -86, 7);
        },

        // BLASTER — pale rabbit, long ears, orange shirt
        buster(c) {
            const fur = '#ececec', inner = '#f8bbd0', shirt = '#ef5350';
            ell(c, -11, -3, 10, 5, '#fafafa'); ell(c, 13, -3, 10, 5, '#fafafa');
            c.strokeStyle = '#bdbdbd'; c.lineWidth = 2;
            c.beginPath(); c.moveTo(-19, -4); c.lineTo(-3, -4); c.moveTo(5, -4); c.lineTo(21, -4); c.stroke();
            rr(c, -18, -30, 14, 28, 4, '#5c7fbe'); rr(c, 4, -30, 14, 28, 4, '#5c7fbe');
            rr(c, -32, -76, 10, 34, 5, shirt); rr(c, 22, -76, 10, 34, 5, shirt);
            ell(c, -27, -41, 6, 6, fur); ell(c, 27, -41, 6, 6, fur);
            rr(c, -23, -80, 46, 52, 12, shirt);
            rr(c, -16, -158, 13, 48, 7, fur); rr(c, 4, -160, 13, 48, 7, fur);
            rr(c, -12.5, -152, 6, 34, 3, inner); rr(c, 7.5, -154, 6, 34, 3, inner);
            ell(c, 0, -97, 26, 25, fur);
            eyes(c, 1, -100, 9, 4);
            ell(c, 1, -88, 3.5, 2.5, '#e57373');
            smile(c, 0, -86, 7, '#9e9e9e');
            c.strokeStyle = '#bdbdbd'; c.lineWidth = 1.5;
            c.beginPath(); c.moveTo(5, -88); c.lineTo(18, -91); c.moveTo(5, -86); c.lineTo(18, -84); c.stroke();
        },

        // D-DUB — small aardvark, pink dress, hair bow
        dw(c) {
            const skin = '#eec9a2', dress = '#f06292';
            ell(c, -10, -3, 9, 5, '#d81b60'); ell(c, 12, -3, 9, 5, '#d81b60');
            rr(c, -14, -28, 10, 26, 4, skin); rr(c, 4, -28, 10, 26, 4, skin);
            c.fillStyle = dress;
            c.beginPath(); c.moveTo(-26, -28); c.lineTo(26, -28); c.lineTo(15, -78); c.lineTo(-15, -78); c.closePath(); c.fill();
            rr(c, -28, -74, 9, 30, 5, dress); rr(c, 19, -74, 9, 30, 5, dress);
            ell(c, -24, -42, 5.5, 5.5, skin); ell(c, 24, -42, 5.5, 5.5, skin);
            ell(c, 0, -78, 13, 6, '#fff');
            ell(c, -12, -114, 7, 8, skin); ell(c, 12, -114, 7, 8, skin);
            ell(c, -12, -114, 3.5, 4.5, '#d9a87c'); ell(c, 12, -114, 3.5, 4.5, '#d9a87c');
            ell(c, 0, -94, 23, 22, skin);
            c.fillStyle = '#ec407a';
            c.beginPath(); c.moveTo(14, -112); c.lineTo(24, -118); c.lineTo(22, -106); c.closePath(); c.fill();
            c.beginPath(); c.moveTo(14, -112); c.lineTo(6, -119); c.lineTo(8, -106); c.closePath(); c.fill();
            ell(c, 14, -112, 3, 3, '#c2185b');
            eyes(c, 2, -96, 8, 3.5);
            ell(c, 1, -86, 3.5, 2.5, '#8d6e63');
            smile(c, 0, -84, 6);
        },

        // BIG RED — enormous crimson canine
        clifford(c) {
            const red = '#e53935', dark = '#b71c1c';
            c.strokeStyle = red; c.lineWidth = 8; c.lineCap = 'round';
            c.beginPath(); c.moveTo(-32, -50); c.quadraticCurveTo(-48, -62, -44, -80); c.stroke();
            rr(c, -34, -28, 17, 26, 7, red); rr(c, 16, -28, 17, 26, 7, red);
            ell(c, -25, -3, 11, 5, dark); ell(c, 25, -3, 11, 5, dark);
            ell(c, 0, -56, 37, 33, red);
            ell(c, 6, -105, 30, 27, red);
            ell(c, -20, -108, 8, 16, dark);
            ell(c, 26, -122, 8, 14, dark);
            ell(c, 28, -97, 14, 11, red);
            ell(c, 39, -98, 6.5, 5.5, '#212121');
            eyes(c, 6, -112, 9, 4);
            smile(c, 26, -92, 7, '#7f0000');
        },

        // JORGE — curious brown monkey
        george(c) {
            const fur = '#795548', face = '#e7c39a';
            ell(c, -11, -3, 10, 5, fur); ell(c, 13, -3, 10, 5, fur);
            rr(c, -17, -28, 13, 26, 5, fur); rr(c, 4, -28, 13, 26, 5, fur);
            rr(c, -33, -76, 10, 38, 5, fur); rr(c, 23, -76, 10, 38, 5, fur);
            ell(c, -28, -37, 6, 6, face); ell(c, 28, -37, 6, 6, face);
            rr(c, -22, -78, 44, 52, 14, fur);
            ell(c, 0, -52, 14, 18, face);
            ell(c, -24, -100, 8, 9, fur); ell(c, 24, -100, 8, 9, fur);
            ell(c, -24, -100, 4, 5, face); ell(c, 24, -100, 4, 5, face);
            ell(c, 0, -98, 25, 23, fur);
            ell(c, 2, -93, 18, 16, face);
            eyes(c, 2, -99, 7, 3.5);
            ell(c, 0, -89, 1.5, 1.2, '#4e342e'); ell(c, 5, -89, 1.5, 1.2, '#4e342e');
            smile(c, 2, -89, 9, '#4e342e');
        },

        // THESAURA — caped superhero with a star emblem
        wordgirl(c) {
            const skin = '#9c6b3f', suit = '#d32f2f', accent = '#fbc02d', capeC = '#b71c1c';
            c.fillStyle = capeC;
            c.beginPath(); c.moveTo(-16, -80); c.lineTo(-32, -14); c.lineTo(6, -22); c.lineTo(14, -80); c.closePath(); c.fill();
            rr(c, -16, -30, 12, 24, 4, suit); rr(c, 4, -30, 12, 24, 4, suit);
            rr(c, -17, -10, 14, 9, 4, capeC); rr(c, 3, -10, 14, 9, 4, capeC);
            rr(c, -30, -76, 9, 34, 5, suit); rr(c, 21, -76, 9, 34, 5, suit);
            ell(c, -25, -40, 5.5, 5.5, skin); ell(c, 25, -40, 5.5, 5.5, skin);
            rr(c, -20, -80, 40, 52, 10, suit);
            rr(c, -20, -39, 40, 8, 3, accent);
            star(c, 0, -62, 10, accent);
            ell(c, 0, -98, 22, 22, skin);
            c.fillStyle = '#1b1b1b';
            c.beginPath(); c.arc(0, -100, 23, Math.PI, 0); c.closePath(); c.fill();
            ell(c, -19, -90, 6, 11, '#1b1b1b');
            eyes(c, 3, -95, 7.5, 3.5);
            smile(c, 2, -88, 6, '#4e342e');
        },

        // GIGABYTE — cybernetic bird with a giant beak
        digit(c) {
            const body = '#ab47bc', belly = '#ce93d8', beak = '#fb8c00', metal = '#26c6da';
            c.fillStyle = body;
            c.beginPath(); c.moveTo(-22, -50); c.lineTo(-42, -64); c.lineTo(-38, -42); c.closePath(); c.fill();
            rr(c, -11, -22, 5, 22, 2, beak); rr(c, 7, -22, 5, 22, 2, beak);
            ell(c, -7, -2, 9, 3.5, beak); ell(c, 11, -2, 9, 3.5, beak);
            ell(c, 0, -52, 26, 31, body);
            ell(c, 3, -47, 15, 21, belly);
            ell(c, -17, -55, 10, 17, metal);
            ell(c, 2, -94, 21, 19, body);
            c.strokeStyle = metal; c.lineWidth = 2.5;
            c.beginPath(); c.moveTo(0, -110); c.lineTo(-5, -126); c.stroke();
            ell(c, -5, -128, 4.5, 4.5, metal);
            eyes(c, 4, -98, 8, 4.5);
            c.fillStyle = beak;
            c.beginPath(); c.moveTo(15, -96); c.lineTo(43, -90); c.lineTo(15, -84); c.closePath(); c.fill();
            c.fillStyle = '#e65100';
            c.beginPath(); c.moveTo(15, -83); c.lineTo(34, -82); c.lineTo(15, -77); c.closePath(); c.fill();
        },

        // BALDWIN — bald kid, yellow shirt, perpetually upset
        caillou(c) {
            const skin = '#ffd6b0', shirt = '#fdd835', trim = '#e53935', shorts = '#3f51b5';
            ell(c, -11, -3, 10, 5, '#fafafa'); ell(c, 13, -3, 10, 5, '#fafafa');
            rr(c, -16, -28, 12, 26, 4, skin); rr(c, 4, -28, 12, 26, 4, skin);
            rr(c, -18, -46, 36, 19, 6, shorts);
            rr(c, -29, -74, 9, 32, 5, shirt); rr(c, 20, -74, 9, 32, 5, shirt);
            ell(c, -24, -40, 5.5, 5.5, skin); ell(c, 24, -40, 5.5, 5.5, skin);
            rr(c, -20, -80, 40, 40, 10, shirt);
            rr(c, -20, -80, 40, 7, 3, trim);
            ell(c, 0, -102, 24, 23, skin);
            ell(c, -23, -100, 4, 6, skin); ell(c, 23, -100, 4, 6, skin);
            c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.lineCap = 'round';
            c.beginPath(); c.arc(-2, -104, 17, 1.25 * Math.PI, 1.6 * Math.PI); c.stroke();
            eyes(c, 2, -102, 7.5, 3.5);
            c.strokeStyle = '#5d4037'; c.lineWidth = 2.5;
            c.beginPath(); c.moveTo(-9, -112); c.lineTo(-2, -109); c.moveTo(13, -112); c.lineTo(6, -109); c.stroke();
            c.beginPath(); c.arc(2, -84, 6, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke();
        },
    };
})();

// Pre-render each fighter to an offscreen canvas for UI and indicators
const spriteCache = {};
function buildSpriteCache() {
    for (const ch of CHARACTERS) {
        const cv = document.createElement('canvas');
        cv.width = 130; cv.height = 185;
        const c = cv.getContext('2d');
        c.translate(65, 178);
        SPRITES[ch.id](c);
        spriteCache[ch.id] = cv;
    }
}
buildSpriteCache();

// ---------- STAGES ----------
const W = 1280, H = 720;
const STAGES = [
    {
        id: 'elwood', name: 'Elwood City',
        sky: ['#7ec8e3', '#cfeefb'],
        accent: '#66bb6a',
        platforms: [
            { x: 240, y: 560, w: 800, h: 30, main: true },
            { x: 380, y: 420, w: 180, h: 16 },
            { x: 720, y: 420, w: 180, h: 16 },
            { x: 550, y: 300, w: 180, h: 16 },
        ]
    },
    {
        id: 'birdwell', name: 'Birdwell Island',
        sky: ['#ff8a65', '#ffe0b2'],
        accent: '#e53935',
        platforms: [
            { x: 180, y: 580, w: 420, h: 30, main: true },
            { x: 680, y: 580, w: 420, h: 30, main: true },
            { x: 480, y: 410, w: 320, h: 16 },
        ]
    },
    {
        id: 'cyberspace', name: 'Cyberspace',
        sky: ['#0d0d2b', '#2a1a5e'],
        accent: '#26c6da',
        platforms: [
            { x: 290, y: 540, w: 700, h: 30, main: true },
            { x: 150, y: 400, w: 160, h: 16 },
            { x: 970, y: 400, w: 160, h: 16 },
            { x: 560, y: 330, w: 160, h: 16 },
        ]
    },
];

// ---------- GLOBAL STATE ----------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let scale = 1, offsetX = 0, offsetY = 0;

let p1Char = null, p2Char = null, nextPick = 1;
let selectedStage = 0;
let game = null;
let vsCPU = false;

function setMode(cpu) {
    vsCPU = cpu;
    document.getElementById('p2Heading').textContent = cpu ? 'CPU' : 'Player 2';
    showScreen('characterSelect');
}

const GRAVITY = 0.75;
const FRICTION = 0.82;
const AIR_FRICTION = 0.96;
const STOCKS = 3;
const MATCH_TIME = 99;

// ---------- INPUT ----------
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

const P1_KEYS = { left: 'a', right: 'd', jump: 'w', attack: 'f', special: 'g' };
const P2_KEYS = { left: 'arrowleft', right: 'arrowright', jump: 'arrowup', attack: 'k', special: 'l' };

// ---------- AUDIO ----------
const SND = (typeof AudioEngine !== 'undefined') ? AudioEngine : {
    init: () => false, resume() {}, toggleMute: () => false,
    playMenuTheme() {}, playBattleTheme() {}, stopMusic() {}, fanfare() {},
    sfx() {}, say() {}, muted: false,
};
let currentMusic = '';

function setMusic(kind) {
    if (currentMusic === kind) return;
    currentMusic = kind;
    if (kind === 'menu') SND.playMenuTheme();
    else if (kind === 'battle') SND.playBattleTheme(selectedStage);
    else if (kind === 'fanfare') SND.fanfare();
    else SND.stopMusic();
}

// browsers require a user gesture before audio can start
function ensureAudio() {
    if (!SND.init()) return;
    SND.resume();
    if (currentMusic === '' && !game) setMusic('menu');
}
window.addEventListener('pointerdown', ensureAudio);
window.addEventListener('keydown', ensureAudio);

// ---------- CANVAS SIZING ----------
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    scale = Math.min(canvas.width / W, canvas.height / H);
    offsetX = (canvas.width - W * scale) / 2;
    offsetY = (canvas.height - H * scale) / 2;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---------- SCREEN MANAGEMENT ----------
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (game && id !== 'gameScreen') {
        game.running = false;
        game = null;
    }
    if (id !== 'gameScreen') {
        SND.sfx('click');
        if (id === 'titleScreen' || id === 'howToPlay' || id === 'characterSelect') setMusic('menu');
        if (id === 'characterSelect') SND.say('Choose your fighter!');
        drawMenuBackground();
    }
}

function drawMenuBackground() {
    if (game) return;
    ctx.fillStyle = '#1a0a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // floating stars
    for (let i = 0; i < 60; i++) {
        const x = (i * 137.5) % canvas.width;
        const y = (i * 89.7 + Date.now() * 0.01 * ((i % 3) + 1)) % canvas.height;
        ctx.fillStyle = `rgba(255,255,255,${0.1 + (i % 5) * 0.06})`;
        ctx.beginPath();
        ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
    }
    if (!game) requestAnimationFrame(drawMenuBackground);
}

// ---------- CHARACTER SELECT ----------
function buildCharacterSelect() {
    const grid = document.getElementById('charGrid');
    grid.innerHTML = '';
    CHARACTERS.forEach((c, i) => {
        const cell = document.createElement('div');
        cell.className = 'char-cell';
        cell.id = 'cell-' + c.id;
        cell.title = c.tagline;
        cell.innerHTML = `<img src="${spriteCache[c.id].toDataURL()}" alt="${c.name}"><span class="char-cell-name">${c.name}</span>`;
        cell.onclick = () => pickCharacter(i);
        grid.appendChild(cell);
    });

    const stages = document.getElementById('stageOptions');
    stages.innerHTML = '';
    STAGES.forEach((s, i) => {
        const opt = document.createElement('div');
        opt.className = 'stage-option' + (i === selectedStage ? ' selected' : '');
        opt.textContent = s.name;
        opt.onclick = () => {
            selectedStage = i;
            document.querySelectorAll('.stage-option').forEach((o, j) =>
                o.classList.toggle('selected', j === i));
        };
        stages.appendChild(opt);
    });
}

function pickCharacter(i) {
    const c = CHARACTERS[i];
    SND.sfx('select');
    SND.say(c.name + '!', { rate: 0.95 });
    const img = `<img src="${spriteCache[c.id].toDataURL()}" alt="${c.name}">`;
    if (nextPick === 1) {
        p1Char = i;
        document.getElementById('p1Preview').innerHTML = img;
        document.getElementById('p1Name').textContent = c.name;
        nextPick = 2;
    } else {
        p2Char = i;
        document.getElementById('p2Preview').innerHTML = img;
        document.getElementById('p2Name').textContent = c.name;
        nextPick = 1;
    }
    document.querySelectorAll('.char-cell').forEach(cell => {
        cell.classList.remove('selected-p1', 'selected-p2');
    });
    if (p1Char !== null) document.getElementById('cell-' + CHARACTERS[p1Char].id).classList.add('selected-p1');
    if (p2Char !== null) document.getElementById('cell-' + CHARACTERS[p2Char].id).classList.add('selected-p2');
    document.getElementById('fightBtn').disabled = !(p1Char !== null && p2Char !== null);
}

// ---------- FIGHTER ----------
class Fighter {
    constructor(charIndex, playerNum, x, cpu = false) {
        this.char = CHARACTERS[charIndex];
        this.playerNum = playerNum;
        this.keys = playerNum === 1 ? P1_KEYS : P2_KEYS;
        this.cpu = cpu;
        this.aiInput = { left: false, right: false, jump: false, attack: false, special: false };
        this.w = 46;
        this.h = 64;
        this.spawnX = x;
        this.respawn(true);
        this.stocks = STOCKS;
        this.damage = 0;
    }

    readInput() {
        if (this.cpu) return this.aiInput;
        return {
            left: !!keys[this.keys.left],
            right: !!keys[this.keys.right],
            jump: !!keys[this.keys.jump],
            attack: !!keys[this.keys.attack],
            special: !!keys[this.keys.special],
        };
    }

    cpuThink(g) {
        const inp = { left: false, right: false, jump: false, attack: false, special: false };
        const foe = g.fighters.find(f => f !== this);
        if (this.dead || !foe || foe.dead) { this.aiInput = inp; return; }

        const mains = STAGES[selectedStage].platforms.filter(p => p.main);
        const left = Math.min(...mains.map(p => p.x));
        const right = Math.max(...mains.map(p => p.x + p.w));
        const mainY = mains[0].y;
        const dx = foe.x - this.x;
        const dy = foe.y - this.y;

        const offStage = this.x < left - 5 || this.x > right + 5 || this.y > mainY + 40;
        if (offStage) {
            // recovery: head back to center, burn jumps while falling
            const cx = (left + right) / 2;
            if (cx < this.x) inp.left = true; else inp.right = true;
            if (this.vy > 1 && this.jumpsLeft > 0 && Math.random() < 0.35) inp.jump = true;
        } else {
            // approach until in melee range
            if (Math.abs(dx) > 55) {
                if (dx > 0) inp.right = true; else inp.left = true;
            } else if (Math.abs(dx) < 25 && Math.random() < 0.04) {
                // occasionally create space
                if (dx > 0) inp.left = true; else inp.right = true;
            }
            // chase upward
            if (dy < -90 && this.onGround && Math.random() < 0.1) inp.jump = true;
            if (Math.random() < 0.004) inp.jump = true;
            // swing when in range (turn toward foe so the hit lands)
            if (Math.abs(dx) < 62 && Math.abs(dy) < 60 && Math.random() < 0.12) {
                inp.attack = true;
                if (dx > 0) inp.right = true; else if (dx < 0) inp.left = true;
            }
            // specials: projectiles from range, bursts up close
            if (this.specialCooldown <= 0 && Math.random() < 0.03) {
                const ranged = ['book', 'carrot', 'banana', 'zap'].includes(this.char.special);
                const ok = ranged ? Math.abs(dx) > 110 && Math.abs(dy) < 80 : Math.abs(dx) < 150;
                if (ok) {
                    inp.special = true;
                    if (dx > 0) inp.right = true; else if (dx < 0) inp.left = true;
                }
            }
            // don't walk off the edge unless edge-guarding a nearby foe
            const nextX = this.x + (inp.right ? 35 : inp.left ? -35 : 0);
            if (this.onGround && (nextX < left + 15 || nextX > right - 15) && Math.abs(dx) > 90) {
                inp.left = inp.right = false;
            }
        }
        this.aiInput = inp;
    }

    respawn(initial = false) {
        this.x = this.spawnX;
        this.y = initial ? 300 : 100;
        this.vx = 0;
        this.vy = 0;
        this.facing = this.playerNum === 1 ? 1 : -1;
        this.onGround = false;
        this.jumpsLeft = 2;
        this.hitstun = 0;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.specialCooldown = 0;
        this.invuln = initial ? 0 : 120;
        this.damage = 0;
        this.squash = 1;
        this.spinTimer = 0;
        this.dashTimer = 0;
        this.jumpHeld = false;
        this.dead = false;
        this.deathTimer = 0;
    }

    get hurtbox() {
        return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    }

    update(g) {
        if (this.dead) {
            this.deathTimer--;
            if (this.deathTimer <= 0 && this.stocks > 0) {
                this.dead = false;
                this.respawn();
            }
            return;
        }

        if (this.invuln > 0) this.invuln--;
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.specialCooldown > 0) this.specialCooldown--;
        if (this.attackTimer > 0) this.attackTimer--;
        if (this.spinTimer > 0) this.spinTimer--;
        if (this.dashTimer > 0) this.dashTimer--;

        const inHitstun = this.hitstun > 0;
        if (inHitstun) this.hitstun--;

        // --- movement input ---
        if (this.cpu) this.cpuThink(g);
        const inp = this.readInput();
        if (!inHitstun && this.dashTimer <= 0) {
            const spd = this.char.speed;
            if (inp.left) {
                // turn assist: braking is stronger than accelerating
                this.vx -= (this.onGround ? spd * 0.3 : spd * 0.18) * (this.vx > 0 ? 1.8 : 1);
                this.facing = -1;
            }
            if (inp.right) {
                this.vx += (this.onGround ? spd * 0.3 : spd * 0.18) * (this.vx < 0 ? 1.8 : 1);
                this.facing = 1;
            }
            const maxSpd = this.spinTimer > 0 ? spd * 1.4 : spd;
            this.vx = Math.max(-maxSpd, Math.min(maxSpd, this.vx));

            // jump (with edge detection so holding doesn't multi-jump)
            if (inp.jump) {
                if (!this.jumpHeld && this.jumpsLeft > 0) {
                    this.vy = -this.char.jump * (this.jumpsLeft === 2 ? 1 : 0.88);
                    this.jumpsLeft--;
                    this.onGround = false;
                    this.squash = 1.25;
                    SND.sfx('jump');
                    g.spawnParticles(this.x, this.y, 4, '#ffffff', 2);
                }
                this.jumpHeld = true;
            } else {
                this.jumpHeld = false;
            }

            // attack
            if (inp.attack && this.attackCooldown <= 0) {
                this.attackTimer = 10;
                this.attackCooldown = 24;
            }

            // special
            if (inp.special && this.specialCooldown <= 0) {
                this.doSpecial(g);
            }
        }

        // --- physics ---
        this.vy += GRAVITY * (this.vy > 0 ? 1.15 : 1);
        this.vy = Math.min(this.vy, 22);
        this.vx *= this.onGround ? FRICTION : AIR_FRICTION;
        this.x += this.vx;
        this.y += this.vy;

        // --- platform collision ---
        const wasGrounded = this.onGround;
        this.onGround = false;
        const stage = STAGES[selectedStage];
        for (const p of stage.platforms) {
            const withinX = this.x > p.x - 10 && this.x < p.x + p.w + 10;
            const falling = this.vy >= 0;
            const feetPrev = this.y - this.vy;
            if (withinX && falling && feetPrev <= p.y + 4 && this.y >= p.y && this.y <= p.y + p.h + this.vy + 4) {
                this.y = p.y;
                this.vy = 0;
                this.onGround = true;
                this.jumpsLeft = 2;
            }
        }
        if (this.onGround && !wasGrounded) {
            // just landed
            this.squash = 0.8;
            SND.sfx('land');
        }

        // squash/stretch recovery
        this.squash += (1 - this.squash) * 0.2;

        // --- melee hit detection ---
        if (this.attackTimer > 4 && this.attackTimer <= 8) {
            // hitbox starts at the body's edge and reaches one arm's length —
            // a swing should only land when it visibly looks like it connects
            const reach = 42;
            const hb = {
                x: this.facing === 1 ? this.x + this.w * 0.2 : this.x - this.w * 0.2 - reach,
                y: this.y - this.h + 6,
                w: reach,
                h: this.h - 10
            };
            const foe = g.fighters.find(f => f !== this);
            if (foe && !foe.dead && foe.invuln <= 0 && rectsOverlap(hb, foe.hurtbox)) {
                g.hit(this, foe, 7 * this.char.power, 8, this.facing, -6);
                this.attackTimer = 4; // single hit per swing
            }
        }

        // spinning tantrum multi-hit
        if (this.spinTimer > 0 && this.spinTimer % 8 === 0) {
            const foe = g.fighters.find(f => f !== this);
            const hb = { x: this.x - 60, y: this.y - this.h - 10, w: 120, h: this.h + 20 };
            if (foe && !foe.dead && foe.invuln <= 0 && rectsOverlap(hb, foe.hurtbox)) {
                g.hit(this, foe, 4, 6, Math.sign(foe.x - this.x) || this.facing, -5);
            }
        }

        // dash punch hit
        if (this.dashTimer > 0) {
            const foe = g.fighters.find(f => f !== this);
            if (foe && !foe.dead && foe.invuln <= 0 && rectsOverlap(this.hurtbox, foe.hurtbox)) {
                g.hit(this, foe, 12, 14, this.facing, -8);
                this.dashTimer = 0;
            }
        }

        // --- blast zones ---
        if (this.x < -150 || this.x > W + 150 || this.y > H + 180 || this.y < -500) {
            g.koFighter(this);
        }
    }

    doSpecial(g) {
        const c = this.char;
        const SPECIAL_SFX = {
            book: 'projectile', carrot: 'projectile', banana: 'projectile', zap: 'projectile',
            bark: 'bark', scream: 'scream', dash: 'dash', tantrum: 'spin',
        };
        SND.sfx(SPECIAL_SFX[c.special]);
        switch (c.special) {
            case 'book':
                g.projectiles.push(new Projectile(this, this.x + this.facing * 40, this.y - 40,
                    this.facing * 9, 0, '📚', 9, 9, 'straight'));
                this.specialCooldown = 50;
                break;
            case 'carrot':
                g.projectiles.push(new Projectile(this, this.x + this.facing * 30, this.y - 50,
                    this.facing * 7, -9, '🥕', 8, 8, 'arc'));
                this.specialCooldown = 45;
                break;
            case 'tantrum':
                this.spinTimer = 40;
                this.specialCooldown = 90;
                g.announce('TANTRUM!', 500);
                break;
            case 'bark': {
                g.spawnShockwave(this.x + this.facing * 30, this.y - 30, this.facing);
                const foe = g.fighters.find(f => f !== this);
                if (foe && !foe.dead && foe.invuln <= 0) {
                    const dist = Math.abs(foe.x - this.x);
                    const inFront = Math.sign(foe.x - this.x) === this.facing || dist < 40;
                    if (dist < 200 && Math.abs(foe.y - this.y) < 120 && inFront) {
                        g.hit(this, foe, 14, 18, this.facing, -10);
                    }
                }
                this.specialCooldown = 100;
                break;
            }
            case 'banana':
                g.projectiles.push(new Projectile(this, this.x + this.facing * 30, this.y - 50,
                    this.facing * 6, -7, '🍌', 7, 7, 'bounce'));
                this.specialCooldown = 40;
                break;
            case 'dash':
                this.dashTimer = 14;
                this.vx = this.facing * 16;
                this.vy = -2;
                this.specialCooldown = 80;
                break;
            case 'zap':
                g.projectiles.push(new Projectile(this, this.x + this.facing * 40, this.y - 45,
                    this.facing * 13, 0, '⚡', 8, 7, 'straight'));
                this.specialCooldown = 38;
                break;
            case 'scream': {
                g.spawnScreamRing(this.x, this.y - 30);
                const foe = g.fighters.find(f => f !== this);
                if (foe && !foe.dead && foe.invuln <= 0) {
                    const dx = foe.x - this.x, dy = (foe.y - 30) - (this.y - 30);
                    if (Math.hypot(dx, dy) < 180) {
                        g.hit(this, foe, 11, 15, Math.sign(dx) || this.facing, -11);
                    }
                }
                this.specialCooldown = 110;
                break;
            }
        }
    }

    draw() {
        if (this.dead) return;
        if (this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 0) return; // flicker

        const px = offsetX + this.x * scale;
        const py = offsetY + this.y * scale;

        // shadow + player ring
        ctx.save();
        ctx.translate(px, py);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 2 * scale, 26 * scale * this.squash, 6 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.playerNum === 1 ? '#4fc3f7' : '#ff6f00';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.ellipse(0, 2 * scale, 30 * scale, 8 * scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // body sprite (squash stretches height, widens on landing)
        ctx.save();
        if (this.spinTimer > 0) {
            ctx.translate(px, py - 48 * scale);
            ctx.rotate(this.spinTimer * 0.6);
            ctx.translate(0, 48 * scale);
        } else {
            ctx.translate(px, py);
        }
        if (this.dashTimer > 0) {
            ctx.shadowColor = this.char.color;
            ctx.shadowBlur = 30 * scale;
        }
        const sz = 0.48 * this.char.size;
        ctx.scale(scale * sz * this.facing * (2 - this.squash), scale * sz * this.squash);
        SPRITES[this.char.id](ctx);
        ctx.restore();

        // attack swing visual
        if (this.attackTimer > 4) {
            ctx.save();
            ctx.translate(px + this.facing * 32 * scale, py - 35 * scale);
            ctx.font = `${34 * scale}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = 0.9;
            ctx.fillText('💥', 0, 0);
            ctx.restore();
        }
    }
}

// ---------- PROJECTILES ----------
class Projectile {
    constructor(owner, x, y, vx, vy, emoji, dmg, kb, kind) {
        this.owner = owner;
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.emoji = emoji;
        this.dmg = dmg;
        this.kb = kb;
        this.kind = kind;
        this.life = 160;
        this.bounces = 2;
        this.rot = 0;
    }

    update(g) {
        this.life--;
        this.rot += 0.2 * Math.sign(this.vx || 1);
        if (this.kind === 'arc' || this.kind === 'bounce') this.vy += GRAVITY * 0.6;
        this.x += this.vx;
        this.y += this.vy;

        if (this.kind === 'bounce') {
            const stage = STAGES[selectedStage];
            for (const p of stage.platforms) {
                if (this.x > p.x && this.x < p.x + p.w && this.y > p.y && this.y < p.y + p.h + 12 && this.vy > 0) {
                    this.vy = -this.vy * 0.7;
                    this.y = p.y;
                    if (--this.bounces < 0) this.life = 0;
                }
            }
        }

        const foe = g.fighters.find(f => f !== this.owner);
        if (foe && !foe.dead && foe.invuln <= 0) {
            const hb = foe.hurtbox;
            if (this.x > hb.x - 8 && this.x < hb.x + hb.w + 8 && this.y > hb.y - 8 && this.y < hb.y + hb.h + 8) {
                g.hit(this.owner, foe, this.dmg, this.kb, Math.sign(this.vx) || this.owner.facing, -6);
                this.life = 0;
            }
        }

        if (this.x < -100 || this.x > W + 100 || this.y > H + 100) this.life = 0;
        return this.life > 0;
    }

    draw() {
        ctx.save();
        ctx.translate(offsetX + this.x * scale, offsetY + this.y * scale);
        ctx.scale(this.vx < 0 ? -1 : 1, 1);
        ctx.rotate(this.rot);
        ctx.font = `${30 * scale}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();
    }
}

// ---------- GAME ----------
function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

class Game {
    constructor() {
        this.fighters = [
            new Fighter(p1Char, 1, W * 0.32),
            new Fighter(p2Char, 2, W * 0.68, vsCPU),
        ];
        this.projectiles = [];
        this.particles = [];
        this.shockwaves = [];
        this.running = true;
        this.over = false;
        this.freeze = 0;
        this.timeLeft = MATCH_TIME * 60;
        this.countdown = 180; // 3..2..1..GO

        document.getElementById('hudP1Name').textContent = this.fighters[0].char.name;
        document.getElementById('hudP2Name').textContent = this.fighters[1].char.name + (vsCPU ? ' (CPU)' : '');
        this.updateHUD();
    }

    hit(attacker, victim, dmg, baseKb, dirX, dirY) {
        victim.damage = Math.min(999, Math.round(victim.damage + dmg));
        const kbScale = 1 + victim.damage / 55;
        const kb = baseKb * kbScale * attacker.char.power / victim.char.weight;
        victim.vx = dirX * kb * 0.9;
        victim.vy = dirY * (kb / 9) - 3;
        victim.hitstun = Math.min(40, 8 + kb * 0.8);
        victim.invuln = 8;
        this.freeze = Math.min(8, 2 + dmg * 0.4); // hitstop for juice
        SND.sfx('hit', Math.min(2, 0.6 + dmg / 8 + victim.damage / 120));
        this.spawnParticles(victim.x, victim.y - 40, 8, attacker.char.color, 5);
        this.updateHUD();
    }

    koFighter(f) {
        if (f.dead) return;
        f.stocks--;
        f.dead = true;
        f.deathTimer = 90;
        this.spawnParticles(
            Math.max(30, Math.min(W - 30, f.x)),
            Math.max(30, Math.min(H - 30, f.y)),
            20, '#ffffff', 9
        );
        this.announce(f.stocks > 0 ? 'KO!' : 'GAME!', 900);
        SND.sfx('ko');
        SND.say(f.stocks > 0 ? 'K O!' : 'GAME!', { rate: 0.85, pitch: 0.5 });
        this.updateHUD();
        if (f.stocks <= 0) this.endGame();
    }

    endGame(timeUp = false) {
        if (this.over) return;
        this.over = true;
        let winner;
        const [a, b] = this.fighters;
        if (timeUp) {
            if (a.stocks !== b.stocks) winner = a.stocks > b.stocks ? a : b;
            else if (a.damage !== b.damage) winner = a.damage < b.damage ? a : b;
            else winner = null;
        } else {
            winner = a.stocks > 0 ? a : b;
        }
        setTimeout(() => {
            this.running = false;
            const txt = document.getElementById('winnerText');
            const disp = document.getElementById('winnerDisplay');
            if (winner) {
                txt.textContent = `${winner.char.name} WINS!`;
                disp.innerHTML = `<img src="${spriteCache[winner.char.id].toDataURL()}" alt="${winner.char.name}">`;
                disp.title = winner.char.taunt;
                SND.say(`The winner is... ${winner.char.name}!`, { rate: 0.9, interrupt: false });
            } else {
                txt.textContent = 'SUDDEN TIE!';
                disp.textContent = '🤝';
                SND.say('It\'s a tie!', { interrupt: false });
            }
            setMusic('fanfare');
            showScreen('resultsScreen');
        }, 1400);
    }

    announce(text, ms) {
        const el = document.createElement('div');
        el.className = 'announcer';
        el.textContent = text;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), ms);
    }

    spawnParticles(x, y, n, color, speed) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = speed * (0.4 + Math.random());
            this.particles.push({
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
                life: 30 + Math.random() * 20, color, size: 3 + Math.random() * 4
            });
        }
    }

    spawnShockwave(x, y, dir) {
        this.shockwaves.push({ x, y, r: 10, maxR: 190, dir, life: 18 });
    }

    spawnScreamRing(x, y) {
        this.shockwaves.push({ x, y, r: 10, maxR: 180, dir: 0, life: 22 });
    }

    updateHUD() {
        const [a, b] = this.fighters;
        const d1 = document.getElementById('hudP1Damage');
        const d2 = document.getElementById('hudP2Damage');
        d1.textContent = a.damage + '%';
        d2.textContent = b.damage + '%';
        for (const [el, f] of [[d1, a], [d2, b]]) {
            el.classList.toggle('high', f.damage >= 80);
            el.classList.toggle('medium', f.damage >= 40 && f.damage < 80);
        }
        document.getElementById('hudP1Stocks').textContent = '⭐'.repeat(Math.max(0, a.stocks));
        document.getElementById('hudP2Stocks').textContent = '⭐'.repeat(Math.max(0, b.stocks));
    }

    update() {
        if (this.countdown > 0) {
            const prev = Math.ceil(this.countdown / 60);
            this.countdown--;
            const now = Math.ceil(this.countdown / 60);
            if (now !== prev || this.countdown === 179) {
                if (this.countdown === 0) {
                    this.announce('GO!', 600);
                    SND.sfx('countdown', true);
                    SND.say('GO!', { rate: 1.1, pitch: 0.6 });
                    setMusic('battle');
                } else {
                    this.announce(String(now), 500);
                    SND.sfx('countdown');
                }
            }
            return;
        }

        if (this.freeze > 0) { this.freeze--; return; }
        if (this.over) return;

        this.timeLeft--;
        document.getElementById('hudTimer').textContent = Math.max(0, Math.ceil(this.timeLeft / 60));
        if (this.timeLeft <= 0) { this.endGame(true); return; }

        for (const f of this.fighters) f.update(this);
        this.projectiles = this.projectiles.filter(p => p.update(this));

        for (const p of this.particles) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life--;
        }
        this.particles = this.particles.filter(p => p.life > 0);

        for (const s of this.shockwaves) {
            s.r += (s.maxR - s.r) * 0.25;
            s.life--;
        }
        this.shockwaves = this.shockwaves.filter(s => s.life > 0);
    }

    draw() {
        const stage = STAGES[selectedStage];

        // sky gradient
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, stage.sky[0]);
        grad.addColorStop(1, stage.sky[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // stage decoration
        if (stage.id === 'cyberspace') {
            ctx.strokeStyle = 'rgba(38,198,218,0.15)';
            ctx.lineWidth = 1;
            const g = 60 * scale;
            for (let x = offsetX % g; x < canvas.width; x += g) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (let y = offsetY % g; y < canvas.height; y += g) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }
        } else {
            // clouds
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            for (let i = 0; i < 5; i++) {
                const cx = ((i * 280 + Date.now() * 0.012) % (canvas.width + 200)) - 100;
                const cy = offsetY + (60 + i * 55) * scale;
                ctx.beginPath();
                ctx.ellipse(cx, cy, 60 * scale, 20 * scale, 0, 0, Math.PI * 2);
                ctx.ellipse(cx + 35 * scale, cy - 10 * scale, 40 * scale, 18 * scale, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // platforms
        for (const p of stage.platforms) {
            const px = offsetX + p.x * scale;
            const py = offsetY + p.y * scale;
            const pw = p.w * scale, ph = p.h * scale;
            ctx.fillStyle = p.main ? stage.accent : 'rgba(255,255,255,0.85)';
            roundRect(px, py, pw, ph, 8 * scale);
            ctx.fill();
            if (p.main) {
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                roundRect(px, py + ph * 0.55, pw, ph * 0.45, 6 * scale);
                ctx.fill();
                // grass tufts / circuit dots
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                for (let i = 0; i < p.w / 50; i++) {
                    ctx.fillRect(px + (i * 50 + 12) * scale, py + 3 * scale, 14 * scale, 3 * scale);
                }
            }
        }

        // shockwaves
        for (const s of this.shockwaves) {
            ctx.save();
            ctx.strokeStyle = `rgba(255,255,255,${s.life / 22})`;
            ctx.lineWidth = 5 * scale;
            ctx.beginPath();
            if (s.dir === 0) {
                ctx.arc(offsetX + s.x * scale, offsetY + s.y * scale, s.r * scale, 0, Math.PI * 2);
            } else {
                const start = s.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
                ctx.arc(offsetX + s.x * scale, offsetY + s.y * scale, s.r * scale, start, start + Math.PI * (s.dir === 1 ? 1 : -1) * -1, s.dir === 1);
            }
            ctx.stroke();
            ctx.restore();
        }

        // entities
        for (const p of this.projectiles) p.draw();
        for (const f of this.fighters) f.draw();

        // particles
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.min(1, p.life / 20);
            ctx.beginPath();
            ctx.arc(offsetX + p.x * scale, offsetY + p.y * scale, p.size * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // offscreen indicators
        for (const f of this.fighters) {
            if (f.dead) continue;
            if (f.y < -10) {
                const ix = offsetX + Math.max(30, Math.min(W - 30, f.x)) * scale;
                ctx.font = `${30 * scale}px serif`;
                ctx.textAlign = 'center';
                ctx.fillText('🔻', ix, offsetY + 40 * scale);
                const iw = 34 * scale, ih = iw * (185 / 130);
                ctx.drawImage(spriteCache[f.char.id], ix - iw / 2, offsetY + 48 * scale, iw, ih);
            }
        }
    }
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// ---------- MAIN LOOP ----------
function startFight() {
    SND.sfx('select');
    setMusic('none');
    showScreen('gameScreen');
    game = new Game();
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (!game || !game.running) return;
    game.update();
    game.draw();
    requestAnimationFrame(gameLoop);
}

// ---------- INIT ----------
buildCharacterSelect();
drawMenuBackground();
const muteBtn = document.getElementById('muteBtn');
if (muteBtn) {
    muteBtn.onclick = (e) => {
        e.stopPropagation();
        muteBtn.textContent = SND.toggleMute() ? '🔇' : '🔊';
    };
}
