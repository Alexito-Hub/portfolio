'use strict';
// Aplicaciones del escritorio y la barra (waybar). Cada módulo es dueño de su ventana.

// ---------- Gestor de proyectos ----------

const Projects = (() => {
    const treeEl = $('#fm-tree');
    const detail = $('#project-detail');
    const filterEl = $('#fm-filter');
    let selected = null;

    const byId = (id) => PROJECTS.find((p) => p.id === id);
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const statusKind = (status) => (status === 'BETA' ? 'beta' : 'dev');

    // "SQLite" no debe coincidir con "sqlite-vec", ni "Git" con "GitHub".
    function uses(project, tech) {
        const re = new RegExp(`(?<![\\w-])${escapeRe(tech)}(?![\\w-])`, 'i');
        return re.test([...project.tags, ...project.features, project.desc].join(' · '));
    }

    function renderTree() {
        treeEl.innerHTML = PROJECT_GROUPS.map((group) => {
            const items = PROJECTS.filter((p) => p.group === group.id);
            return `
                <div class="fm-group">
                    <button class="fm-dir" aria-expanded="true"><i data-lucide="folder" class="fm-icon"></i>${esc(group.label)}</button>
                    <ul class="fm-list">
                        ${items.map((p, i) => `
                        <li><button class="fm-item" data-project="${p.id}" aria-current="false">
                            <span class="fm-branch" aria-hidden="true">${i === items.length - 1 ? '└─' : '├─'}</span>
                            <i data-lucide="file-code" class="fm-icon"></i><span>${esc(p.id)}/</span>
                        </button></li>`).join('')}
                    </ul>
                </div>`;
        }).join('');
        refreshIcons();
    }

    function detailHtml(p) {
        const cover = p.image
            ? `<img src="${esc(p.image)}" alt="Ícono de ${esc(p.title)}" width="56" height="56" loading="lazy" decoding="async">`
            : `<span class="cover-glyph" aria-hidden="true">${esc(p.title.charAt(0))}</span>`;
        return `
            <figure class="project-cover">
                ${cover}
                <figcaption class="cover-path">~/${esc(p.group)}/<strong>${esc(p.id)}</strong></figcaption>
            </figure>
            <header class="project-head">
                <h3 class="project-title">${esc(p.title)}</h3>
                <span class="status status--${statusKind(p.status)}"><span class="status-dot" aria-hidden="true"></span>${esc(p.status)}</span>
            </header>
            <div class="project-tags">
                ${p.tags.map((t) => `<button class="tag" data-tech="${esc(t)}" title="Ver proyectos con ${esc(t)}">${esc(t)}</button>`).join('')}
            </div>
            <p class="project-desc">${esc(p.desc)}</p>
            <section>
                <h4 class="fm-label">Lo destacado</h4>
                <ul class="project-features">${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
            </section>
            <a class="project-link" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">Ver proyecto <i data-lucide="external-link" class="ext"></i></a>
            <div class="git-log" aria-label="Últimos commits">
                <div class="git-cmd">$ git log --oneline</div>
                ${p.commits.map(([hash, msg]) => `<div><span class="git-hash">${esc(hash)}</span> ${esc(msg)}</div>`).join('')}
            </div>`;
    }

    function select(id, { updateHash = true, instant = false } = {}) {
        const project = byId(id);
        if (!project) return false;
        selected = id;
        $$('.fm-item', treeEl).forEach((b) => b.setAttribute('aria-current', String(b.dataset.project === id)));
        if (updateHash) history.replaceState(null, '', `#${id}`);

        const render = () => {
            detail.innerHTML = detailHtml(project);
            detail.scrollTop = 0;
            refreshIcons();
        };
        if (instant) {
            render();
            return true;
        }
        gsap.to(detail, {
            opacity: 0, duration: 0.1, ease: 'power1.in', overwrite: true,
            onComplete: () => {
                render();
                gsap.to(detail, { opacity: 1, duration: 0.2, ease: 'power1.out' });
            },
        });
        return true;
    }

    function setFilter(tech) {
        const matches = PROJECTS.filter((p) => !tech || uses(p, tech)).map((p) => p.id);
        $$('.fm-item', treeEl).forEach((b) => b.classList.toggle('dim', !matches.includes(b.dataset.project)));
        filterEl.hidden = !tech;
        if (!tech) return;
        filterEl.innerHTML = `
            <span>filtro: <strong>${esc(tech)}</strong> · ${matches.length}</span>
            <button class="fm-filter-clear" aria-label="Quitar filtro"><i data-lucide="x"></i></button>`;
        refreshIcons();
        if (matches.length && !matches.includes(selected)) select(matches[0]);
    }

    treeEl.addEventListener('click', (e) => {
        const item = e.target.closest('.fm-item');
        if (item) return select(item.dataset.project);
        const dir = e.target.closest('.fm-dir');
        if (!dir) return;
        const expanded = dir.getAttribute('aria-expanded') !== 'true';
        dir.setAttribute('aria-expanded', String(expanded));
        dir.nextElementSibling.hidden = !expanded;
    });

    treeEl.addEventListener('keydown', (e) => {
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        const items = $$('.fm-item', treeEl).filter((b) => b.offsetParent !== null);
        const i = items.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        const next = items[clamp(i + step, 0, items.length - 1)];
        next.focus();
        select(next.dataset.project);
    });

    detail.addEventListener('click', (e) => {
        const tag = e.target.closest('.tag');
        if (tag) setFilter(tag.dataset.tech);
    });

    filterEl.addEventListener('click', (e) => {
        if (e.target.closest('.fm-filter-clear')) setFilter(null);
    });

    renderTree();
    select(PROJECTS[0].id, { updateHash: false, instant: true });

    return { select, setFilter, uses, byId };
})();

// ---------- stack.json ----------

(() => {
    const code = $('#stack-code');
    const entries = Object.entries(STACK);
    const punc = (s) => `<span class="tok-punc">${s}</span>`;

    // Solo las tecnologías usadas en algún proyecto son clicables (filtran el gestor).
    const token = (tech) => {
        const used = PROJECTS.filter((p) => Projects.uses(p, tech));
        if (!used.length) return `<span class="tok-str">"${esc(tech)}"</span>`;
        const where = used.map((p) => p.title).join(', ');
        return `<button class="tok-str tok-link" data-tech="${esc(tech)}" title="Usado en: ${esc(where)}">"${esc(tech)}"</button>`;
    };

    const lines = [
        punc('{'),
        ...entries.map(([key, list], i) => `  <span class="tok-key">"${esc(key)}"</span>${punc(': [')}${list.map(token).join(punc(', '))}${punc(i < entries.length - 1 ? '],' : ']')}`),
        punc('}'),
    ];
    code.innerHTML = lines.map((line, i) => `<div class="code-line"><span class="ln">${i + 1}</span><span class="lc">${line}</span></div>`).join('');
    $('#stack-lines').textContent = `${lines.length}L`;

    code.addEventListener('click', (e) => {
        const tok = e.target.closest('.tok-link');
        if (!tok) return;
        Projects.setFilter(tok.dataset.tech);
        Actions.openApp('projects');
    });
})();

// ---------- readme.md: posición tipo Neovim en la statusline ----------

(() => {
    const buffer = $('#about-buffer');
    const pos = $('#about-pos');
    const update = () => {
        const max = buffer.scrollHeight - buffer.clientHeight;
        if (max <= 1) pos.textContent = 'All';
        else if (buffer.scrollTop <= 1) pos.textContent = 'Top';
        else if (buffer.scrollTop >= max - 1) pos.textContent = 'Bot';
        else pos.textContent = `${Math.round((buffer.scrollTop / max) * 100)}%`;
    };
    buffer.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(buffer);
})();

// ---------- contact.sh ----------

$('#win-contact').addEventListener('click', (e) => {
    if (e.target.closest('[data-contact="copy"]')) Actions.copyEmail();
});

// ---------- Música (ncmpcpp) ----------

const Music = (() => {
    const audio = $('#audio');
    const root = $('#win-music');
    const titleEl = $('#track-title');
    const artistEl = $('#track-artist');
    const seek = $('#track-seek');
    const timeEl = $('#track-time');
    const durationEl = $('#track-duration');
    const list = $('#playlist');
    const playBtn = $('#btn-play');
    const listeners = new Set();
    let index = 0;
    let started = false;
    let seeking = false;
    let announced = -1;

    const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '--:--');
    const state = () => ({ title: PLAYLIST[index].title, playing: !audio.paused, started });
    const emit = () => listeners.forEach((fn) => fn(state()));

    list.innerHTML = PLAYLIST.map((t, i) => `
        <li><button class="pl-item" data-i="${i}" aria-current="false">
            <span class="pl-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="pl-title">${esc(t.title)}</span>
            <span class="pl-artist">${esc(t.artist)}</span>
        </button></li>`).join('');

    function load(i) {
        index = (i + PLAYLIST.length) % PLAYLIST.length;
        const track = PLAYLIST[index];
        audio.src = track.file;
        titleEl.textContent = track.title;
        artistEl.textContent = track.artist;
        seek.value = 0;
        timeEl.textContent = '0:00';
        durationEl.textContent = '--:--';
        $$('.pl-item', list).forEach((b, j) => b.setAttribute('aria-current', String(j === index)));
        emit();
    }

    async function play() {
        try {
            await audio.play();
        } catch (err) {
            // AbortError = se cambió de pista antes de que empezara; no es un fallo.
            if (err.name !== 'AbortError') Notify.show('Música', `No se pudo reproducir "${PLAYLIST[index].title}"`, 'circle-alert');
        }
    }

    const pause = () => audio.pause();
    const toggle = () => (audio.paused ? play() : pause());
    const next = () => { load(index + 1); play(); };
    const prev = () => {
        if (audio.currentTime > 3) { audio.currentTime = 0; return; }
        load(index - 1);
        play();
    };
    const playAt = (i) => {
        if (i !== index) load(i);
        play();
    };

    function setPlaying(playing) {
        root.classList.toggle('is-playing', playing);
        playBtn.dataset.playing = String(playing);
        playBtn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
        emit();
    }

    audio.addEventListener('play', () => {
        started = true;
        setPlaying(true);
        if (announced !== index) {
            announced = index;
            Notify.show('Reproduciendo', `${PLAYLIST[index].title} — ${PLAYLIST[index].artist}`, 'music');
        }
    });
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('ended', next);
    audio.addEventListener('loadedmetadata', () => { durationEl.textContent = fmt(audio.duration); });
    audio.addEventListener('timeupdate', () => {
        if (seeking || !audio.duration) return;
        seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
        timeEl.textContent = fmt(audio.currentTime);
    });

    seek.addEventListener('input', () => {
        seeking = true;
        if (audio.duration) timeEl.textContent = fmt((seek.value / 1000) * audio.duration);
    });
    seek.addEventListener('change', () => {
        if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
        seeking = false;
    });

    playBtn.addEventListener('click', toggle);
    $('#btn-next').addEventListener('click', next);
    $('#btn-prev').addEventListener('click', prev);
    list.addEventListener('click', (e) => {
        const item = e.target.closest('.pl-item');
        if (item) playAt(+item.dataset.i);
    });

    audio.volume = Settings.get('volume') / 100;
    Settings.on((key, value) => { if (key === 'volume') audio.volume = value / 100; });
    load(0);

    return { play, pause, toggle, next, prev, state, onChange: (fn) => listeners.add(fn) };
})();

// ---------- Fondo animado ----------

const Wallpaper = (() => {
    const canvas = $('#wallpaper');
    const ctx = canvas.getContext('2d');
    const PALETTES = [
        { rgb: '66, 165, 245', glow: '#181825' },
        { rgb: '203, 166, 247', glow: '#1f1a2e' },
        { rgb: '166, 227, 161', glow: '#16201a' },
        { rgb: '148, 226, 213', glow: '#142120' },
        { rgb: '245, 194, 231', glow: '#231a25' },
    ];
    const LINK = 120;
    let width = 0;
    let height = 0;
    let particles = [];
    let frameId = 0;

    const palette = () => PALETTES[Settings.get('palette') % PALETTES.length];
    const spawn = () => ({
        x: Math.random() * width, y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5, a: Math.random() * 0.4 + 0.1,
    });

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = Math.min(140, Math.floor((width * height) / 15000));
        while (particles.length < count) particles.push(spawn());
        particles.length = count;
        for (const p of particles) {
            p.x = Math.min(p.x, width);
            p.y = Math.min(p.y, height);
        }
    }

    function frame() {
        ctx.clearRect(0, 0, width, height);
        const { rgb } = palette();
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb}, ${p.a})`;
            ctx.fill();
            for (let j = i + 1; j < particles.length; j++) {
                const q = particles[j];
                const d2 = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
                if (d2 >= LINK * LINK) continue;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.strokeStyle = `rgba(${rgb}, ${0.1 * (1 - Math.sqrt(d2) / LINK)})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
        frameId = requestAnimationFrame(frame);
    }

    const start = () => { if (!frameId) frameId = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(frameId); frameId = 0; ctx.clearRect(0, 0, width, height); };
    const paint = () => { canvas.style.background = `radial-gradient(circle at 50% 40%, ${palette().glow}, var(--ctp-base) 70%)`; };
    const cycle = () => Settings.set('palette', (Settings.get('palette') + 1) % PALETTES.length);

    Settings.on((key, value) => {
        if (key === 'particles') (value ? start : stop)();
        if (key === 'palette') paint();
    });
    window.addEventListener('resize', resize);
    resize();
    paint();
    if (Settings.get('particles')) start();

    return { cycle };
})();

// ---------- Centro de control ----------

const ControlCenter = (() => {
    const panel = $('#control-center');
    const toggleBtn = $('#mod-cc');
    const volume = $('#vol-slider');
    const volumeOut = $('#vol-value');
    const brightness = $('#bright-slider');
    const brightnessOut = $('#bright-value');
    const overlay = $('#brightness-overlay');

    const toggles = {
        dnd: { get: () => Settings.get('dnd'), set: (v) => Settings.set('dnd', v) },
        tiling: { get: () => Settings.get('layout') === 'tiling', set: (v) => Settings.set('layout', v ? 'tiling' : 'floating') },
        particles: { get: () => Settings.get('particles'), set: (v) => Settings.set('particles', v) },
    };

    function sync() {
        $$('[data-toggle]', panel).forEach((b) => b.setAttribute('aria-pressed', String(toggles[b.dataset.toggle].get())));
        volume.value = Settings.get('volume');
        volumeOut.textContent = `${volume.value}%`;
        brightness.value = Settings.get('brightness');
        brightnessOut.textContent = `${brightness.value}%`;
        overlay.style.opacity = String(((100 - Settings.get('brightness')) / 100) * 0.7);
    }

    const isOpen = () => !panel.hidden;

    function open() {
        Launcher.close();
        ContextMenu.close();
        gsap.killTweensOf(panel);
        panel.hidden = false;
        toggleBtn.setAttribute('aria-expanded', 'true');
        gsap.fromTo(panel, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power3.out' });
    }

    function close() {
        if (!isOpen()) return;
        toggleBtn.setAttribute('aria-expanded', 'false');
        gsap.to(panel, { opacity: 0, y: -6, duration: 0.14, ease: 'power1.in', onComplete: () => { panel.hidden = true; } });
    }

    panel.addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
            const t = toggles[toggle.dataset.toggle];
            t.set(!t.get());
        }
        if (e.target.closest('[data-cc="wallpaper"]')) Wallpaper.cycle();
    });
    volume.addEventListener('input', () => Settings.set('volume', +volume.value));
    brightness.addEventListener('input', () => Settings.set('brightness', +brightness.value));
    toggleBtn.addEventListener('click', () => (isOpen() ? close() : open()));
    document.addEventListener('pointerdown', (e) => {
        if (isOpen() && !panel.contains(e.target) && !toggleBtn.contains(e.target)) close();
    });

    Settings.on(sync);
    sync();
    return { open, close, isOpen };
})();

// ---------- Lanzador (rofi) ----------

const Launcher = (() => {
    const root = $('#launcher');
    const box = $('.launcher', root);
    const input = $('#launcher-input');
    const list = $('#launcher-list');
    let results = [];
    let selected = 0;
    let lastFocus = null;

    function entries() {
        const tilingOn = Settings.get('layout') === 'tiling';
        return [
            ...Object.entries(APPS).map(([key, app]) => ({
                label: app.name, hint: app.file, icon: app.icon, terms: app.keywords, run: () => Actions.openApp(key),
            })),
            ...PROJECTS.map((p) => ({
                label: p.title, hint: `proyecto · ${p.tags.slice(0, 3).join(' · ')}`, icon: 'file-code',
                terms: `${p.id} ${p.tags.join(' ')}`, run: () => Actions.openProject(p.id),
            })),
            { label: 'Copiar email', hint: PROFILE.email, icon: 'copy', terms: 'correo contacto mail', run: Actions.copyEmail },
            { label: 'GitHub personal', hint: 'Alexito-Hub', icon: 'github', terms: 'repos codigo', run: () => openExternal(PROFILE.github) },
            { label: 'GitHub de Auralix Studio', hint: 'Auralix-Studio', icon: 'github', terms: 'repos organizacion', run: () => openExternal(PROFILE.studio) },
            { label: tilingOn ? 'Cambiar a modo floating' : 'Cambiar a modo tiling', hint: 'Alt+V', icon: 'layout-dashboard', terms: 'layout ventanas hyprland', run: WM.toggleLayout },
            { label: 'Cambiar color del fondo', hint: 'fondo', icon: 'palette', terms: 'fondo tema color', run: Wallpaper.cycle },
            { label: 'Atajos de teclado', hint: 'teclado', icon: 'keyboard', terms: 'teclas ayuda help', run: Actions.showKeybinds },
        ];
    }

    // Todas las palabras deben aparecer; primero lo que empieza igual que la búsqueda.
    function score(entry, words) {
        const label = norm(entry.label);
        const haystack = norm(`${entry.label} ${entry.hint} ${entry.terms || ''}`);
        if (!words.every((w) => haystack.includes(w))) return -1;
        if (label.startsWith(words[0])) return 2;
        return label.includes(words[0]) ? 1 : 0;
    }

    function render() {
        const words = norm(input.value).split(/\s+/).filter(Boolean);
        results = entries()
            .map((entry, i) => ({ entry, i, s: words.length ? score(entry, words) : 0 }))
            .filter((r) => r.s >= 0)
            .sort((a, b) => b.s - a.s || a.i - b.i)
            .map((r) => r.entry);
        selected = 0;
        list.innerHTML = results.length
            ? results.map((e, i) => `
                <li role="option" id="lopt-${i}" class="launcher-item" data-i="${i}" aria-selected="false">
                    <i data-lucide="${esc(e.icon)}"></i>
                    <span class="li-label">${esc(e.label)}</span>
                    <span class="li-hint">${esc(e.hint)}</span>
                </li>`).join('')
            : `<li class="launcher-empty">Sin resultados para “${esc(input.value)}”</li>`;
        highlight();
        refreshIcons();
    }

    function highlight() {
        $$('.launcher-item', list).forEach((li, i) => li.setAttribute('aria-selected', String(i === selected)));
        const active = $(`#lopt-${selected}`, list);
        input.setAttribute('aria-activedescendant', active ? active.id : '');
        active?.scrollIntoView({ block: 'nearest' });
    }

    const isOpen = () => !root.hidden;

    function open() {
        if (isOpen()) return;
        ContextMenu.close();
        ControlCenter.close();
        lastFocus = document.activeElement;
        root.hidden = false;
        input.value = '';
        render();
        input.focus();
        gsap.fromTo(box, { opacity: 0, y: -8, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: 'power3.out' });
    }

    function close() {
        if (!isOpen()) return;
        root.hidden = true;
        if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }

    function run(i) {
        const entry = results[i];
        if (!entry) return;
        close();
        entry.run();
    }

    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!results.length) return;
            selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
            highlight();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            run(selected);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'Tab') {
            e.preventDefault();
        }
    });
    list.addEventListener('click', (e) => {
        const item = e.target.closest('.launcher-item');
        if (item) run(+item.dataset.i);
    });
    list.addEventListener('pointermove', (e) => {
        const item = e.target.closest('.launcher-item');
        if (item && +item.dataset.i !== selected) {
            selected = +item.dataset.i;
            highlight();
        }
    });
    root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });

    return { open, close, isOpen, toggle: () => (isOpen() ? close() : open()) };
})();

// ---------- Menú contextual del escritorio ----------

const ContextMenu = (() => {
    const menu = $('#context-menu');
    const layoutLabel = $('#ctx-layout-label');
    const actions = {
        terminal: () => Actions.openApp('terminal'),
        launcher: () => Launcher.open(),
        layout: () => WM.toggleLayout(),
        wallpaper: () => Wallpaper.cycle(),
        keys: () => Actions.showKeybinds(),
    };

    function open(x, y) {
        layoutLabel.textContent = Settings.get('layout') === 'tiling' ? 'Cambiar a floating' : 'Cambiar a tiling';
        menu.hidden = false;
        menu.style.left = `${Math.min(x, innerWidth - menu.offsetWidth - 8)}px`;
        menu.style.top = `${Math.min(y, innerHeight - menu.offsetHeight - 8)}px`;
        gsap.fromTo(menu, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.14, ease: 'power3.out', transformOrigin: 'top left' });
        $('[data-ctx]', menu).focus({ preventScroll: true });
    }

    const close = () => { menu.hidden = true; };

    $('#desktop').addEventListener('contextmenu', (e) => {
        if (e.target.closest('.window') || !WM.isDesktop()) return;
        e.preventDefault();
        Launcher.close();
        ControlCenter.close();
        open(e.clientX, e.clientY);
    });
    menu.addEventListener('click', (e) => {
        const item = e.target.closest('[data-ctx]');
        if (!item) return;
        close();
        actions[item.dataset.ctx]();
    });
    menu.addEventListener('keydown', (e) => {
        const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const items = $$('[data-ctx]', menu);
        const i = items.indexOf(document.activeElement);
        items[(i + step + items.length) % items.length].focus();
    });
    document.addEventListener('pointerdown', (e) => {
        if (!menu.hidden && !menu.contains(e.target)) close();
    });

    return { close };
})();

// ---------- Acciones compartidas ----------

const Actions = {
    openApp(key) {
        WM.open(key);
        if (key === 'terminal') Terminal.focus();
    },

    openProject(id) {
        if (Projects.select(id)) WM.open('projects');
    },

    // Como una taskbar: abre, trae al frente o minimiza si ya está enfocada.
    taskbar(key) {
        const focused = WM.status(key) === 'open' && WM.active === key && WM.wsOf(key) === WM.current;
        if (focused && WM.isDesktop()) WM.minimize(key);
        else Actions.openApp(key);
    },

    async copyEmail() {
        try {
            await navigator.clipboard.writeText(PROFILE.email);
            Notify.show('Email copiado', PROFILE.email, 'clipboard-check', { force: true });
        } catch {
            Notify.show('Email', PROFILE.email, 'mail', { force: true, timeout: 8000 });
        }
    },

    showKeybinds() {
        Actions.openApp('terminal');
        Terminal.run('atajos');
    },
};

Settings.on((key, value) => {
    if (key === 'dnd') {
        Notify.show('No molestar', value ? 'Notificaciones silenciadas' : 'Notificaciones activadas', value ? 'bell-off' : 'bell', { force: true });
    }
    if (key === 'layout') {
        Notify.show('Hyprland', value === 'tiling'
            ? 'Modo tiling: arrastra una ventana sobre otra para intercambiarlas'
            : 'Modo floating: mueve y redimensiona las ventanas libremente', 'layout-dashboard');
    }
});

// ---------- Waybar ----------

(() => {
    const workspaces = $('#workspaces');
    const taskbar = $('#taskbar');
    const title = $('#active-title');
    const clock = $('#clock');
    const media = $('#mod-media');
    const mediaText = $('#mod-media-text');

    workspaces.innerHTML = Array.from({ length: 5 }, (_, i) => `
        <button class="ws-btn" data-ws="${i + 1}" role="tab" aria-selected="false" aria-label="Workspace ${i + 1}" title="Workspace ${i + 1} (Alt+${i + 1})">${i + 1}</button>`).join('');
    taskbar.innerHTML = Object.entries(APPS).map(([key, app]) => `
        <button class="task-btn" data-app="${key}" data-state="closed" title="${esc(app.name)}" aria-label="${esc(app.name)}">
            <i data-lucide="${app.icon}" class="waybar-icon"></i>
        </button>`).join('');

    function render() {
        $$('.ws-btn', workspaces).forEach((b) => {
            const n = +b.dataset.ws;
            b.classList.toggle('active', n === WM.current);
            b.classList.toggle('occupied', WM.windowsIn(n).length > 0);
            b.setAttribute('aria-selected', String(n === WM.current));
        });
        $$('.task-btn', taskbar).forEach((b) => {
            const key = b.dataset.app;
            b.dataset.state = WM.status(key);
            b.classList.toggle('active', WM.active === key);
        });
        title.textContent = `~ / ${WM.active ? APPS[WM.active].label : 'escritorio'}`;
    }

    const tick = () => {
        clock.textContent = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };

    workspaces.addEventListener('click', (e) => {
        const b = e.target.closest('.ws-btn');
        if (b) WM.switchTo(+b.dataset.ws);
    });
    taskbar.addEventListener('click', (e) => {
        const b = e.target.closest('.task-btn');
        if (b) Actions.taskbar(b.dataset.app);
    });
    $('#btn-logo').addEventListener('click', () => Launcher.toggle());
    $('#mod-stack').addEventListener('click', () => Actions.openApp('stack'));
    $('#mod-location').addEventListener('click', () => Notify.show('Ubicación', `${PROFILE.city} · UTC-5`, 'map-pin', { force: true }));
    media.addEventListener('click', () => Actions.openApp('music'));

    Music.onChange(({ title: track, playing, started }) => {
        media.hidden = !started;
        mediaText.textContent = track;
        media.classList.toggle('is-paused', !playing);
    });

    WM.onChange(render);
    tick();
    setInterval(tick, 1000);
    refreshIcons();
})();

// ---------- Atajos de teclado ----------

document.addEventListener('keydown', (e) => {
    if (document.body.dataset.session !== 'ready') return;

    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyK') {
        e.preventDefault();
        Launcher.toggle();
        return;
    }
    if (e.key === 'Escape') {
        Launcher.close();
        ContextMenu.close();
        ControlCenter.close();
        return;
    }

    // AltGr (Ctrl+Alt en Windows) escribe @, #, [ ... en teclados en español: no es un atajo.
    if (!e.altKey || e.ctrlKey || e.metaKey || e.getModifierState('AltGraph')) return;

    const digit = /^Digit([1-5])$/.exec(e.code);
    if (digit) {
        e.preventDefault();
        if (e.shiftKey) WM.moveTo(+digit[1]);
        else WM.switchTo(+digit[1]);
        return;
    }

    const bindings = {
        Space: () => Launcher.toggle(),
        KeyT: () => Actions.openApp('terminal'),
        Enter: () => Actions.openApp('terminal'),
        KeyQ: () => WM.close(),
        KeyF: () => WM.toggleMax(),
        KeyV: () => WM.toggleLayout(),
        KeyJ: () => WM.cycleFocus(1),
        KeyK: () => WM.cycleFocus(-1),
    };
    const action = bindings[e.code];
    if (!action) return;
    e.preventDefault();
    action();
});
