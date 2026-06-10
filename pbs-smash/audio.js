// ============================================================
// PBS SMASH! Audio Engine
// Procedural music + SFX via Web Audio, announcer via speech
// synthesis. No audio files — everything is synthesized live.
// ============================================================

const AudioEngine = (() => {
    let ctx = null;
    let master, musicBus, sfxBus;
    let muted = false;
    let currentSong = null;
    let schedTimer = null;
    let announcerVoice = null;

    const NOTE = {};
    (() => {
        // build note-name → frequency table (C0..B8)
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        for (let midi = 12; midi <= 119; midi++) {
            const f = 440 * Math.pow(2, (midi - 69) / 12);
            NOTE[names[midi % 12] + (Math.floor(midi / 12) - 1)] = f;
        }
    })();

    function init() {
        if (ctx) return true;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 1;
        master.connect(ctx.destination);
        musicBus = ctx.createGain();
        musicBus.gain.value = 0.22;
        musicBus.connect(master);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.5;
        sfxBus.connect(master);
        pickVoice();
        if (window.speechSynthesis) speechSynthesis.onvoiceschanged = pickVoice;
        return true;
    }

    function pickVoice() {
        if (!window.speechSynthesis) return;
        const voices = speechSynthesis.getVoices();
        announcerVoice =
            voices.find(v => /en[-_]US/i.test(v.lang) && /male|david|alex|daniel/i.test(v.name)) ||
            voices.find(v => /en[-_]US/i.test(v.lang)) ||
            voices.find(v => /^en/i.test(v.lang)) || null;
    }

    function resume() {
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    // ---------- SYNTH VOICES ----------
    function tone(time, freq, dur, { type = 'square', gain = 0.2, attack = 0.01, release = 0.08, detune = 0, slide = 0, bus = musicBus, filterFreq = 0 } = {}) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), time + dur);
        if (detune) osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(gain, time + attack);
        g.gain.setValueAtTime(gain, time + Math.max(attack, dur - release));
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        let node = osc;
        if (filterFreq) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = filterFreq;
            osc.connect(f);
            node = f;
        }
        node.connect(g);
        g.connect(bus);
        osc.start(time);
        osc.stop(time + dur + 0.05);
    }

    function noise(time, dur, { gain = 0.3, filterType = 'bandpass', freq = 1000, q = 1, slide = 0, bus = sfxBus } = {}) {
        const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.setValueAtTime(freq, time);
        if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), time + dur);
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(gain, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        src.connect(f); f.connect(g); g.connect(bus);
        src.start(time);
    }

    // lead voices: 'brass' wall of saws, 'chip' bright square, 'soft' mellow triangle
    function lead(time, freq, dur, gain = 0.16, style = 'brass') {
        if (style === 'chip') {
            tone(time, freq, dur, { type: 'square', gain: gain * 0.9, release: 0.1 });
            tone(time, freq, dur, { type: 'square', gain: gain * 0.4, detune: 9, release: 0.1 });
            return;
        }
        if (style === 'soft') {
            tone(time, freq, dur, { type: 'triangle', gain: gain * 1.3, release: 0.15 });
            tone(time, freq * 2, dur, { type: 'sine', gain: gain * 0.35, release: 0.15 });
            return;
        }
        tone(time, freq, dur, { type: 'sawtooth', gain, detune: -7, release: 0.12 });
        tone(time, freq, dur, { type: 'sawtooth', gain, detune: 7, release: 0.12 });
        tone(time, freq, dur, { type: 'square', gain: gain * 0.45, release: 0.12 });
        tone(time, freq / 2, dur, { type: 'sawtooth', gain: gain * 0.5, release: 0.12 });
    }

    function bassNote(time, freq, dur, gain = 0.22) {
        tone(time, freq, dur, { type: 'sawtooth', gain, filterFreq: 600, release: 0.05 });
        tone(time, freq / 2, dur, { type: 'triangle', gain: gain * 0.8, release: 0.05 });
    }

    function padChord(time, freqs, dur, gain = 0.055) {
        for (const f of freqs) {
            tone(time, f, dur, { type: 'sawtooth', gain, detune: -5, attack: 0.15, release: 0.3, filterFreq: 1800 });
            tone(time, f, dur, { type: 'sawtooth', gain, detune: 5, attack: 0.15, release: 0.3, filterFreq: 1800 });
        }
    }

    function kick(time) {
        tone(time, 150, 0.16, { type: 'sine', gain: 0.5, attack: 0.002, release: 0.1, slide: -110 });
    }
    function snare(time) {
        noise(time, 0.14, { gain: 0.22, filterType: 'highpass', freq: 1500, bus: musicBus });
        tone(time, 220, 0.08, { type: 'triangle', gain: 0.15, attack: 0.002, slide: -100 });
    }
    function hat(time, open = false) {
        noise(time, open ? 0.12 : 0.045, { gain: 0.07, filterType: 'highpass', freq: 7000, bus: musicBus });
    }
    function timpani(time, freq) {
        tone(time, freq, 0.5, { type: 'sine', gain: 0.4, attack: 0.004, release: 0.4, slide: -freq * 0.25 });
        noise(time, 0.1, { gain: 0.1, filterType: 'lowpass', freq: 300, bus: musicBus });
    }
    function crash(time) {
        noise(time, 1.2, { gain: 0.16, filterType: 'highpass', freq: 5000, bus: musicBus });
    }

    // ---------- SONGS ----------
    // Step format: 8 steps per bar (8th notes). '.' = rest, '-' = sustain.
    const chord = (root, kind) => {
        const semis = kind === 'maj' ? [0, 4, 7] : kind === 'min' ? [0, 3, 7] : [0, 5, 7];
        return semis.map(s => NOTE[root] * Math.pow(2, s / 12));
    };

    // ===== "FIGHTERS OF THE ROUND TABLE" — the epic main theme =====
    // Original heroic anthem: D minor, soaring melody over driving low
    // strings, war drums, and a wall of brass. 16 bars, loops forever.
    const THEME = {
        bpm: 152,
        bars: 16,
        melody: (
            'D5 - . A4 D5 - F5 -|E5 - D5 - E5 - F5 -|F5 - . D5 F5 - A5 -|G5 - F5 - G5 - A5 -|' +
            'A5 - . F5 A5 - C6 -|A#5 - A5 - G5 - F5 -|A5 - G5 - F5 - E5 -|F5 - E5 - D5 - C5 -|' +
            'D5 - E5 - F5 - G5 -|A5 - - - . F5 A5 -|A#5 - A5 - G5 - F5 -|G5 - F5 - E5 - D5 -|' +
            'G5 - . D5 G5 - A#5 -|A5 - G5 - A5 - A#5 -|A5 - - - E5 - C#5 -|E5 - - - A5 - - -'
        ).split('|').map(b => b.trim().split(/\s+/)),
        bass: ['D2', 'D2', 'A#1', 'A#1', 'F2', 'F2', 'C2', 'C2', 'D2', 'D2', 'A#1', 'A#1', 'G2', 'G2', 'A2', 'A2'],
        chords: [
            ['D3', 'min'], ['D3', 'min'], ['A#2', 'maj'], ['A#2', 'maj'],
            ['F3', 'maj'], ['F3', 'maj'], ['C3', 'maj'], ['C3', 'maj'],
            ['D3', 'min'], ['D3', 'min'], ['A#2', 'maj'], ['A#2', 'maj'],
            ['G3', 'min'], ['G3', 'min'], ['A3', 'maj'], ['A3', 'maj'],
        ],
        drums: { kick: 'x...x...', snare: '....x...', hat: 'x.x.x.xx' },
        timpaniBars: [7, 15],
        crashBars: [0, 8],
    };

    // ===== STAGE THEMES — one per map, lighter than the title anthem =====

    // Elwood City: "SUNNY SIDEWALK" — bouncy, cheerful suburb stroll
    const SONG_ELWOOD = {
        bpm: 126,
        bars: 8,
        leadType: 'chip',
        leadGain: 0.12,
        melody: (
            'B4 . D5 B4 G4 . A4 B4|C5 . E5 C5 A4 . B4 C5|B4 . D5 G5 . F#5 E5 D5|A4 B4 C5 A4 D5 - - .|' +
            'B4 . D5 B4 G4 . A4 B4|C5 . E5 G5 . E5 C5 E5|D5 G5 - F#5 E5 - D5 -|G5 - - - . . D5 .'
        ).split('|').map(b => b.trim().split(/\s+/)),
        bass: ['G2', 'E2', 'C2', 'D2', 'G2', 'C2', 'D2', 'G2'],
        chords: [
            ['G3', 'maj'], ['E3', 'min'], ['C3', 'maj'], ['D3', 'maj'],
            ['G3', 'maj'], ['C3', 'maj'], ['D3', 'maj'], ['G3', 'maj'],
        ],
        drums: { kick: 'x...x...', snare: '....x...', hat: 'x.x.x.x.' },
        timpaniBars: [],
        crashBars: [],
        ambient(barTime, bar, stepDur) {
            // songbirds
            if (Math.random() < 0.4) {
                const t = barTime + Math.random() * stepDur * 6;
                const f = 2200 + Math.random() * 1200;
                tone(t, f, 0.07, { type: 'sine', gain: 0.05, attack: 0.01, slide: 500 });
                tone(t + 0.09, f * 1.15, 0.06, { type: 'sine', gain: 0.04, attack: 0.01, slide: -400 });
            }
        },
    };

    // Birdwell Island: "BIG BEACH DAY" — laid-back island skank
    const SONG_BIRDWELL = {
        bpm: 112,
        bars: 8,
        leadType: 'soft',
        leadGain: 0.11,
        chordStyle: 'offbeat',
        melody: (
            'E5 - . G5 E5 - C5 -|A4 - C5 - F5 - E5 -|D5 - . B4 D5 - G5 -|E5 - C5 - G4 - - .|' +
            'A4 - C5 E5 A5 - G5 -|F5 - E5 - D5 - E5 -|C5 - E5 - A4 - C5 -|D5 - B4 - G4 - . .'
        ).split('|').map(b => b.trim().split(/\s+/)),
        bass: ['C2', 'F2', 'G2', 'C2', 'F2', 'G2', 'A2', 'G2'],
        chords: [
            ['C3', 'maj'], ['F3', 'maj'], ['G3', 'maj'], ['C3', 'maj'],
            ['F3', 'maj'], ['G3', 'maj'], ['A3', 'min'], ['G3', 'maj'],
        ],
        drums: { kick: 'x...x...', snare: '....x...', hat: 'x.xx.x.x' },
        timpaniBars: [],
        crashBars: [],
        ambient(barTime, bar, stepDur) {
            // rolling surf every fourth bar
            if (bar % 4 === 0) {
                noise(barTime, stepDur * 8, { gain: 0.05, filterType: 'lowpass', freq: 600, slide: 500, bus: musicBus });
            }
        },
    };

    // Cyberspace: "FIREWALL FRENZY" — driving synth arpeggios
    const SONG_CYBER = {
        bpm: 150,
        bars: 8,
        leadType: 'chip',
        leadGain: 0.1,
        melody: (
            'A4 C5 E5 A5 E5 C5 E5 A4|F4 A4 C5 F5 C5 A4 C5 F4|C5 E5 G5 C6 G5 E5 G5 C5|B4 D5 G5 B5 G5 D5 B4 G4|' +
            'A4 C5 E5 A5 E5 C5 A4 E5|F5 - E5 - C5 - A4 -|D5 F5 A5 D6 - A5 F5 D5|E5 - G#5 - B5 - E5 .'
        ).split('|').map(b => b.trim().split(/\s+/)),
        bass: ['A1', 'F2', 'C2', 'G2', 'A1', 'F2', 'D2', 'E2'],
        chords: [
            ['A2', 'min'], ['F3', 'maj'], ['C3', 'maj'], ['G3', 'maj'],
            ['A2', 'min'], ['F3', 'maj'], ['D3', 'min'], ['E3', 'maj'],
        ],
        drums: { kick: 'x..x..x.', snare: '....x...', hat: 'xxxxxxxx' },
        timpaniBars: [],
        crashBars: [0],
        ambient(barTime, bar, stepDur) {
            // stray data packets
            if (Math.random() < 0.5) {
                const t = barTime + Math.random() * stepDur * 7;
                tone(t, 1200 + Math.random() * 2000, 0.05, { type: 'square', gain: 0.035, attack: 0.005, slide: 900 });
            }
        },
    };

    const STAGE_SONGS = [SONG_ELWOOD, SONG_BIRDWELL, SONG_CYBER];

    function scheduleBar(song, barIndex, barTime) {
        const stepDur = 60 / song.bpm / 2; // 8th note
        const bar = barIndex % song.bars;

        // melody (with '-' sustain merging)
        const mel = song.melody[bar];
        for (let s = 0; s < 8; s++) {
            const tok = mel[s];
            if (!tok || tok === '.' || tok === '-') continue;
            let len = 1;
            while (s + len < 8 && mel[s + len] === '-') len++;
            lead(barTime + s * stepDur, NOTE[tok], stepDur * len * 0.95, song.leadGain || 0.16, song.leadType || 'brass');
        }

        // driving bass 8ths with octave bounce
        const bFreq = NOTE[song.bass[bar]];
        for (let s = 0; s < 8; s++) {
            bassNote(barTime + s * stepDur, s % 2 ? bFreq * 2 : bFreq, stepDur * 0.9);
        }

        // harmony: sustained pad, or short offbeat stabs
        const [cRoot, cKind] = song.chords[bar];
        if (song.chordStyle === 'offbeat') {
            for (const s of [1, 3, 5, 7]) {
                padChord(barTime + s * stepDur, chord(cRoot, cKind), stepDur * 0.6, 0.07);
            }
        } else {
            padChord(barTime, chord(cRoot, cKind), stepDur * 8);
        }

        // stage ambience layer
        if (song.ambient) song.ambient(barTime, bar, stepDur);

        // drums
        for (let s = 0; s < 8; s++) {
            const t = barTime + s * stepDur;
            if (song.drums.kick[s] === 'x') kick(t);
            if (song.drums.snare[s] === 'x') snare(t);
            if (song.drums.hat[s] === 'x') hat(t);
        }
        // timpani fill at phrase ends
        if (song.timpaniBars.includes(bar)) {
            for (let s = 4; s < 8; s++) timpani(barTime + s * stepDur, s % 2 ? NOTE['D2'] : NOTE['A2']);
        }
        if (song.crashBars.includes(bar)) crash(barTime);
    }

    function playSong(song) {
        if (!init()) return;
        resume();
        stopMusic();
        currentSong = song;
        let nextBar = 0;
        let nextBarTime = ctx.currentTime + 0.08;
        const barLen = (60 / song.bpm / 2) * 8;
        const tick = () => {
            if (currentSong !== song) return;
            while (nextBarTime < ctx.currentTime + 0.5) {
                scheduleBar(song, nextBar, nextBarTime);
                nextBar++;
                nextBarTime += barLen;
            }
            schedTimer = setTimeout(tick, 120);
        };
        tick();
    }

    function stopMusic() {
        currentSong = null;
        if (schedTimer) { clearTimeout(schedTimer); schedTimer = null; }
    }

    function fanfare() {
        if (!init()) return;
        resume();
        stopMusic();
        const t = ctx.currentTime + 0.05;
        const b = 0.17;
        const seq = [['C5', 0, 1], ['F5', 1, 1], ['A5', 2, 1], ['C6', 3, 2.6], ['A#5', 5.6, 0.7], ['C6', 6.3, 3.5]];
        for (const [n, st, len] of seq) lead(t + st * b, NOTE[n], len * b, 0.2);
        padChord(t, chord('F3', 'maj'), 10 * b, 0.08);
        padChord(t + 6.3 * b, chord('F3', 'maj'), 4 * b, 0.09);
        kick(t); crash(t);
        crash(t + 6.3 * b);
        for (let i = 0; i < 6; i++) timpani(t + i * b * 0.5, i % 2 ? NOTE['C3'] : NOTE['F2']);
    }

    // ---------- SOUND EFFECTS ----------
    const sfx = {
        hit(strength = 1) { // strength ~0..2
            const t = ctx.currentTime;
            noise(t, 0.09, { gain: 0.3 * strength, freq: 900, q: 0.8 });
            tone(t, 160, 0.12, { type: 'sine', gain: 0.4 * strength, attack: 0.002, slide: -110, bus: sfxBus });
            if (strength > 1.2) noise(t, 0.18, { gain: 0.2, filterType: 'lowpass', freq: 400 });
        },
        ko() {
            const t = ctx.currentTime;
            tone(t, 120, 0.5, { type: 'sine', gain: 0.6, attack: 0.002, slide: -90, bus: sfxBus });
            noise(t, 0.5, { gain: 0.4, filterType: 'lowpass', freq: 900, slide: -700 });
            tone(t, 300, 0.55, { type: 'sawtooth', gain: 0.18, attack: 0.01, slide: 1400, bus: sfxBus });
            noise(t + 0.05, 0.7, { gain: 0.15, filterType: 'highpass', freq: 4000 });
        },
        jump() {
            tone(ctx.currentTime, 240, 0.13, { type: 'sine', gain: 0.16, attack: 0.005, slide: 260, bus: sfxBus });
        },
        land() {
            noise(ctx.currentTime, 0.06, { gain: 0.12, filterType: 'lowpass', freq: 500 });
        },
        projectile() {
            tone(ctx.currentTime, 850, 0.16, { type: 'square', gain: 0.12, attack: 0.005, slide: -620, bus: sfxBus });
        },
        bark() {
            const t = ctx.currentTime;
            tone(t, 95, 0.2, { type: 'sawtooth', gain: 0.45, attack: 0.005, slide: -35, bus: sfxBus });
            noise(t, 0.18, { gain: 0.3, filterType: 'lowpass', freq: 700 });
        },
        scream() {
            const t = ctx.currentTime;
            tone(t, 600, 0.4, { type: 'sawtooth', gain: 0.2, attack: 0.01, slide: 800, bus: sfxBus });
            tone(t, 605, 0.4, { type: 'square', gain: 0.12, attack: 0.01, slide: 830, bus: sfxBus });
            noise(t, 0.4, { gain: 0.12, filterType: 'highpass', freq: 2500 });
        },
        dash() {
            noise(ctx.currentTime, 0.25, { gain: 0.22, filterType: 'highpass', freq: 800, slide: 2400 });
        },
        spin() {
            const t = ctx.currentTime;
            for (let i = 0; i < 5; i++) {
                tone(t + i * 0.07, 400 + i * 120, 0.07, { type: 'square', gain: 0.1, bus: sfxBus });
            }
        },
        click() {
            tone(ctx.currentTime, 700, 0.06, { type: 'square', gain: 0.12, attack: 0.002, bus: sfxBus });
        },
        select() {
            const t = ctx.currentTime;
            tone(t, 520, 0.09, { type: 'square', gain: 0.14, attack: 0.002, bus: sfxBus });
            tone(t + 0.08, 780, 0.14, { type: 'square', gain: 0.14, attack: 0.002, bus: sfxBus });
        },
        countdown(final = false) {
            tone(ctx.currentTime, final ? 1320 : 880, final ? 0.4 : 0.12,
                { type: 'square', gain: 0.2, attack: 0.005, bus: sfxBus });
        },
    };

    function playSfx(name, arg) {
        if (!init()) return;
        resume();
        if (sfx[name]) sfx[name](arg);
    }

    // ---------- ANNOUNCER ----------
    function say(text, { rate = 0.92, pitch = 0.55, interrupt = true } = {}) {
        if (!window.speechSynthesis) return;
        if (interrupt) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = rate;
        u.pitch = pitch;
        u.volume = muted ? 0 : 1;
        if (announcerVoice) u.voice = announcerVoice;
        speechSynthesis.speak(u);
    }

    function toggleMute() {
        muted = !muted;
        if (ctx) master.gain.value = muted ? 0 : 1;
        if (muted && window.speechSynthesis) speechSynthesis.cancel();
        return muted;
    }

    return {
        init, resume, toggleMute,
        playMenuTheme: () => playSong(THEME),
        playBattleTheme: (stage = 0) => playSong(STAGE_SONGS[stage] || STAGE_SONGS[0]),
        stopMusic, fanfare,
        sfx: playSfx,
        say,
        get muted() { return muted; },
    };
})();
