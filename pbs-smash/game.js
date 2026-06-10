// ============================================================
// PBS SMASH! - A Super Smash Bros style platform fighter
// starring PBS Kids characters from the 2000s
// ============================================================

// ---------- CHARACTER ROSTER ----------
const CHARACTERS = [
    {
        id: 'arthur', name: 'ARTHUR', emoji: '🐵', show: 'Arthur',
        color: '#ffca28',
        speed: 5.2, jump: 14, weight: 1.0, power: 1.0,
        special: 'book', specialName: 'Library Card Toss',
        taunt: 'Having fun isn\'t hard, with a library card!'
    },
    {
        id: 'buster', name: 'BUSTER', emoji: '🐰', show: 'Arthur',
        color: '#e0e0e0',
        speed: 5.0, jump: 16.5, weight: 0.85, power: 0.9,
        special: 'carrot', specialName: 'Carrot Lob',
        taunt: 'Aliens are totally real.'
    },
    {
        id: 'dw', name: 'D.W.', emoji: '👧', show: 'Arthur',
        color: '#f48fb1',
        speed: 6.0, jump: 14.5, weight: 0.75, power: 0.85,
        special: 'tantrum', specialName: 'Tantrum Spin',
        taunt: 'I\'m telling MOM!'
    },
    {
        id: 'clifford', name: 'CLIFFORD', emoji: '🐶', show: 'Clifford',
        color: '#e53935',
        speed: 3.8, jump: 12, weight: 1.5, power: 1.45,
        special: 'bark', specialName: 'BIG RED BARK',
        taunt: 'Woof.'
    },
    {
        id: 'george', name: 'GEORGE', emoji: '🐒', show: 'Curious George',
        color: '#8d6e63',
        speed: 5.8, jump: 16, weight: 0.8, power: 0.9,
        special: 'banana', specialName: 'Banana Bounce',
        taunt: '*curious monkey noises*'
    },
    {
        id: 'wordgirl', name: 'WORDGIRL', emoji: '🦸', show: 'WordGirl',
        color: '#d32f2f',
        speed: 6.5, jump: 15, weight: 0.9, power: 1.05,
        special: 'dash', specialName: 'Vocabulary Velocity',
        taunt: 'WORD UP!'
    },
    {
        id: 'digit', name: 'DIGIT', emoji: '🐦', show: 'Cyberchase',
        color: '#26c6da',
        speed: 5.5, jump: 15.5, weight: 0.85, power: 0.95,
        special: 'zap', specialName: 'Cyber Beak Bolt',
        taunt: 'Yoiks!'
    },
    {
        id: 'caillou', name: 'CAILLOU', emoji: '👦', show: 'Caillou',
        color: '#fff176',
        speed: 4.8, jump: 13.5, weight: 0.7, power: 1.15,
        special: 'scream', specialName: 'The Tantrum Heard Round The World',
        taunt: '*whining intensifies*'
    },
];

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
    if (id !== 'gameScreen') drawMenuBackground();
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
        cell.innerHTML = `<span>${c.emoji}</span><span class="char-cell-name">${c.name}</span>`;
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
    if (nextPick === 1) {
        p1Char = i;
        document.getElementById('p1Preview').textContent = c.emoji;
        document.getElementById('p1Name').textContent = c.name;
        nextPick = 2;
    } else {
        p2Char = i;
        document.getElementById('p2Preview').textContent = c.emoji;
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
    constructor(charIndex, playerNum, x) {
        this.char = CHARACTERS[charIndex];
        this.playerNum = playerNum;
        this.keys = playerNum === 1 ? P1_KEYS : P2_KEYS;
        this.w = 56;
        this.h = 64;
        this.spawnX = x;
        this.respawn(true);
        this.stocks = STOCKS;
        this.damage = 0;
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
        if (!inHitstun && this.dashTimer <= 0) {
            const spd = this.char.speed;
            if (keys[this.keys.left]) {
                this.vx -= this.onGround ? spd * 0.3 : spd * 0.12;
                this.facing = -1;
            }
            if (keys[this.keys.right]) {
                this.vx += this.onGround ? spd * 0.3 : spd * 0.12;
                this.facing = 1;
            }
            const maxSpd = this.spinTimer > 0 ? spd * 1.4 : spd;
            this.vx = Math.max(-maxSpd, Math.min(maxSpd, this.vx));

            // jump (with edge detection so holding doesn't multi-jump)
            if (keys[this.keys.jump]) {
                if (!this.jumpHeld && this.jumpsLeft > 0) {
                    this.vy = -this.char.jump * (this.jumpsLeft === 2 ? 1 : 0.88);
                    this.jumpsLeft--;
                    this.onGround = false;
                    this.squash = 1.25;
                    g.spawnParticles(this.x, this.y, 4, '#ffffff', 2);
                }
                this.jumpHeld = true;
            } else {
                this.jumpHeld = false;
            }

            // attack
            if (keys[this.keys.attack] && this.attackCooldown <= 0) {
                this.attackTimer = 10;
                this.attackCooldown = 24;
            }

            // special
            if (keys[this.keys.special] && this.specialCooldown <= 0) {
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
        this.onGround = false;
        const stage = STAGES[selectedStage];
        for (const p of stage.platforms) {
            const withinX = this.x > p.x - 10 && this.x < p.x + p.w + 10;
            const falling = this.vy >= 0;
            const feetPrev = this.y - this.vy;
            if (withinX && falling && feetPrev <= p.y + 4 && this.y >= p.y && this.y <= p.y + p.h + this.vy + 4) {
                // drop-through soft platforms by holding down... keep simple: main is solid, others pass holding nothing
                this.y = p.y;
                this.vy = 0;
                if (!this.onGround) this.squash = Math.min(this.squash, 0.8);
                this.onGround = true;
                this.jumpsLeft = 2;
            }
        }

        // squash/stretch recovery
        this.squash += (1 - this.squash) * 0.2;

        // --- melee hit detection ---
        if (this.attackTimer > 4 && this.attackTimer <= 8) {
            const reach = 48;
            const hb = {
                x: this.facing === 1 ? this.x : this.x - reach - this.w / 2,
                y: this.y - this.h,
                w: reach + this.w / 2,
                h: this.h
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

        ctx.save();
        ctx.translate(px, py);

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 2 * scale, 26 * scale * this.squash, 6 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // spin rotation for tantrum
        if (this.spinTimer > 0) {
            ctx.rotate((this.spinTimer * 0.8) % (Math.PI * 2));
        }

        // dash trail
        if (this.dashTimer > 0) {
            ctx.shadowColor = this.char.color;
            ctx.shadowBlur = 30 * scale;
        }

        // body (emoji)
        ctx.scale(this.facing * (1 / this.squash) * 0.9 + this.facing * 0.1, this.squash);
        ctx.font = `${56 * scale}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // player ring indicator
        ctx.restore();
        ctx.save();
        ctx.translate(px, py);
        ctx.strokeStyle = this.playerNum === 1 ? '#4fc3f7' : '#ff6f00';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.ellipse(0, 2 * scale, 30 * scale, 8 * scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(px, py - (this.h / 2) * scale * this.squash);
        if (this.spinTimer > 0) ctx.rotate(this.spinTimer * 0.6);
        ctx.scale(this.facing, 1);
        ctx.font = `${58 * scale * (2 - this.squash)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.char.emoji, 0, 0);
        ctx.restore();

        // attack swing visual
        if (this.attackTimer > 4) {
            ctx.save();
            ctx.translate(px + this.facing * 45 * scale, py - 35 * scale);
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
            if (this.x > hb.x - 12 && this.x < hb.x + hb.w + 12 && this.y > hb.y - 12 && this.y < hb.y + hb.h + 12) {
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
            new Fighter(p2Char, 2, W * 0.68),
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
        document.getElementById('hudP2Name').textContent = this.fighters[1].char.name;
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
                disp.textContent = winner.char.emoji;
                disp.title = winner.char.taunt;
            } else {
                txt.textContent = 'SUDDEN TIE!';
                disp.textContent = '🤝';
            }
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
                if (this.countdown === 0) this.announce('GO!', 600);
                else this.announce(String(now), 500);
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
                ctx.font = `${22 * scale}px serif`;
                ctx.fillText(f.char.emoji, ix, offsetY + 70 * scale);
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
