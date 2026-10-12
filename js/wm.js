'use strict';
// Window manager estilo Hyprland.
// - Cada workspace tiene un árbol dwindle (splits binarios) con sus ventanas abiertas.
// - Modo tiling: el árbol decide posición y tamaño; arrastrar una ventana sobre otra las intercambia
//   y los bordes redimensionan el split.
// - Modo floating: cada ventana guarda su rectángulo (en fracciones del escritorio) y se mueve libre.
// - En pantallas <= 1024px no hay WM: las ventanas se apilan como tarjetas (lo resuelve el CSS).

const WM = (() => {
    const desktop = $('#desktop');
    const GAP_IN = 6;
    const GAP_OUT = 8;
    const MIN_W = 300;
    const MIN_H = 200;
    const WORKSPACES = 5;
    const desktopQuery = matchMedia('(min-width: 1025px)');
    const isDesktop = () => desktopQuery.matches;
    const tiling = () => Settings.get('layout') === 'tiling';

    const wins = {};
    const trees = {};
    let current = 1;
    let activeKey = null;
    let z = 10;
    const listeners = new Set();
    const emit = () => listeners.forEach((fn) => fn());

    // ---------- Árbol dwindle ----------

    const isLeaf = (node) => node && node.key !== undefined;

    function fromConfig(node) {
        if (typeof node === 'string') return { key: node };
        return { dir: node.dir, ratio: node.ratio, a: fromConfig(node.a), b: fromConfig(node.b) };
    }

    function keysOf(node, out = []) {
        if (!node) return out;
        if (isLeaf(node)) out.push(node.key);
        else { keysOf(node.a, out); keysOf(node.b, out); }
        return out;
    }

    // Quita una hoja; su hermano ocupa el lugar del split padre.
    function prune(node, key) {
        if (!node) return null;
        if (isLeaf(node)) return node.key === key ? null : node;
        const a = prune(node.a, key);
        const b = prune(node.b, key);
        if (!a || !b) return a || b;
        node.a = a;
        node.b = b;
        return node;
    }

    function replace(node, key, replacement) {
        if (isLeaf(node)) return node.key === key ? replacement : node;
        node.a = replace(node.a, key, replacement);
        node.b = replace(node.b, key, replacement);
        return node;
    }

    function swapKeys(node, k1, k2) {
        if (!node) return;
        if (isLeaf(node)) {
            if (node.key === k1) node.key = k2;
            else if (node.key === k2) node.key = k1;
            return;
        }
        swapKeys(node.a, k1, k2);
        swapKeys(node.b, k1, k2);
    }

    function pathTo(node, key, path = []) {
        if (!node) return null;
        if (isLeaf(node)) return node.key === key ? path : null;
        return pathTo(node.a, key, [...path, { node, side: 'a' }])
            || pathTo(node.b, key, [...path, { node, side: 'b' }]);
    }

    function computeLayout(node, rect, leaves = {}, splits = new Map()) {
        if (!node) return { leaves, splits };
        if (isLeaf(node)) {
            leaves[node.key] = rect;
            return { leaves, splits };
        }
        splits.set(node, rect);
        if (node.dir === 'v') {
            const w1 = Math.round((rect.w - GAP_IN) * node.ratio);
            computeLayout(node.a, { x: rect.x, y: rect.y, w: w1, h: rect.h }, leaves, splits);
            computeLayout(node.b, { x: rect.x + w1 + GAP_IN, y: rect.y, w: rect.w - w1 - GAP_IN, h: rect.h }, leaves, splits);
        } else {
            const h1 = Math.round((rect.h - GAP_IN) * node.ratio);
            computeLayout(node.a, { x: rect.x, y: rect.y, w: rect.w, h: h1 }, leaves, splits);
            computeLayout(node.b, { x: rect.x, y: rect.y + h1 + GAP_IN, w: rect.w, h: rect.h - h1 - GAP_IN }, leaves, splits);
        }
        return { leaves, splits };
    }

    const tileLayout = (ws) => computeLayout(trees[ws], workArea());

    // Igual que dwindle: la ventana nueva divide a la enfocada por su lado más largo.
    function treeInsert(ws, key, nearKey) {
        if (!trees[ws]) {
            trees[ws] = { key };
            return;
        }
        const { leaves } = tileLayout(ws);
        const target = leaves[nearKey] ? nearKey : Object.keys(leaves).pop();
        const r = leaves[target];
        trees[ws] = replace(trees[ws], target, {
            dir: r.w >= r.h ? 'v' : 'h', ratio: 0.5, a: { key: target }, b: { key },
        });
    }

    function treeRemove(ws, key) {
        trees[ws] = prune(trees[ws], key);
    }

    // ---------- Geometría ----------

    const area = () => ({ x: 0, y: 0, w: desktop.clientWidth, h: desktop.clientHeight });
    const workArea = () => {
        const a = area();
        return { x: GAP_OUT, y: GAP_OUT, w: a.w - GAP_OUT * 2, h: a.h - GAP_OUT * 2 };
    };
    const rectOf = (el) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

    function toFrac(r) {
        const a = area();
        return { x: r.x / a.w, y: r.y / a.h, w: r.w / a.w, h: r.h / a.h };
    }

    function fromFrac(f) {
        const a = area();
        return { x: f.x * a.w, y: f.y * a.h, w: f.w * a.w, h: f.h * a.h };
    }

    // Una ventana flotante puede salirse por los lados, pero su barra de título siempre queda alcanzable.
    function clampFloating(r) {
        const a = area();
        const w = clamp(r.w, MIN_W, a.w - GAP_OUT * 2);
        const h = clamp(r.h, MIN_H, a.h - GAP_OUT * 2);
        return { w, h, x: clamp(r.x, 120 - w, a.w - 120), y: clamp(r.y, GAP_OUT, a.h - 40) };
    }

    // Primera vez que una ventana flota: si es parte del layout inicial conserva ese hueco,
    // si no, aparece centrada y escalonada respecto a las demás.
    function defaultRect(win) {
        const designed = computeLayout(fromConfig(INITIAL_LAYOUT), workArea()).leaves[win.key];
        if (designed) return designed;
        const a = workArea();
        const w = Math.min(win.app.size[0], a.w);
        const h = Math.min(win.app.size[1], a.h);
        const step = (visibleKeys().length % 4) * 28;
        return { x: a.x + (a.w - w) / 2 + step, y: a.y + Math.max(0, (a.h - h) / 3) + step, w, h };
    }

    // ---------- Render ----------

    function visibleKeys(ws = current) {
        return Object.values(wins).filter((w) => w.status === 'open' && w.ws === ws).map((w) => w.key);
    }

    function shouldShow(win) {
        return isDesktop() ? win.status === 'open' && win.ws === current : win.status !== 'closed';
    }

    function place(win, r, animate) {
        const props = { left: Math.round(r.x), top: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h) };
        if (animate) gsap.to(win.el, { ...props, duration: 0.3, ease: 'power3.out', overwrite: 'auto' });
        else gsap.set(win.el, props);
    }

    // Los bordes de redimensionado solo existen donde hay algo que mover.
    function updateHandles(win, tiled) {
        let east = !win.max;
        let south = !win.max;
        if (tiled && !win.max) {
            const path = pathTo(trees[current], win.key) || [];
            east = path.some((p) => p.node.dir === 'v' && p.side === 'a');
            south = path.some((p) => p.node.dir === 'h' && p.side === 'a');
        }
        win.el.dataset.rzE = east ? '1' : '0';
        win.el.dataset.rzS = south ? '1' : '0';
    }

    function arrange({ animate = true, instant = null } = {}) {
        if (!isDesktop()) return;
        const leaves = tiling() ? tileLayout(current).leaves : null;
        for (const key of visibleKeys()) {
            const win = wins[key];
            let r;
            if (win.max) r = workArea();
            else if (leaves) r = leaves[key];
            else {
                if (!win.rect) win.rect = toFrac(defaultRect(win));
                r = clampFloating(fromFrac(win.rect));
            }
            win.el.classList.toggle('is-max', win.max);
            win.el.classList.toggle('is-tiled', !!leaves && !win.max);
            updateHandles(win, !!leaves);
            place(win, r, animate && key !== instant);
        }
    }

    function reveal(win) {
        gsap.killTweensOf(win.el, 'opacity,scale,x,y');
        win.el.classList.add('is-visible');
        gsap.fromTo(win.el,
            { opacity: 0, scale: 0.96, x: 0, y: 0 },
            { opacity: 1, scale: 1, duration: 0.25, ease: 'power3.out', clearProps: 'opacity,transform' });
    }

    function conceal(win, dy = -8) {
        gsap.to(win.el, {
            opacity: 0, scale: 0.97, y: dy, duration: 0.16, ease: 'power1.in',
            onComplete: () => {
                if (!shouldShow(win)) win.el.classList.remove('is-visible');
                gsap.set(win.el, { clearProps: 'opacity,transform' });
            },
        });
    }

    function scrollToWindow(win) {
        win.el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }

    // ---------- Foco ----------

    function normalizeZ() {
        const sorted = Object.values(wins).sort((a, b) => (+a.el.style.zIndex || 0) - (+b.el.style.zIndex || 0));
        z = 10;
        sorted.forEach((w) => { w.el.style.zIndex = ++z; });
    }

    function focus(key) {
        const win = wins[key];
        if (!win) return;
        if (activeKey !== key) {
            wins[activeKey]?.el.classList.remove('active');
            activeKey = key;
            win.el.classList.add('active');
        }
        if (z > 9000) normalizeZ();
        win.el.style.zIndex = ++z;
        emit();
    }

    function focusTop() {
        const top = Object.values(wins)
            .filter((w) => w.status === 'open' && (!isDesktop() || w.ws === current))
            .sort((a, b) => (+b.el.style.zIndex || 0) - (+a.el.style.zIndex || 0))[0];
        if (top) return focus(top.key);
        wins[activeKey]?.el.classList.remove('active');
        activeKey = null;
        emit();
    }

    function cycleFocus(step) {
        const keys = Object.values(wins)
            .filter((w) => w.status === 'open' && (!isDesktop() || w.ws === current))
            .map((w) => w.key);
        if (!keys.length) return;
        const i = keys.indexOf(activeKey);
        focus(keys[(i + step + keys.length) % keys.length]);
    }

    // ---------- Acciones ----------

    function open(key) {
        const win = wins[key];
        if (!win) return;
        if (win.status === 'open') {
            if (isDesktop() && win.ws !== current) switchTo(win.ws);
            focus(key);
            if (!isDesktop()) scrollToWindow(win);
            return;
        }
        const near = wins[activeKey]?.status === 'open' && wins[activeKey].ws === current ? activeKey : null;
        win.ws = current;
        win.status = 'open';
        treeInsert(current, key, near);
        arrange({ instant: key });
        reveal(win);
        focus(key);
        if (!isDesktop()) scrollToWindow(win);
    }

    function close(key = activeKey) {
        const win = wins[key];
        if (!win || win.status === 'closed') return;
        if (win.status === 'open') treeRemove(win.ws, key);
        win.status = 'closed';
        win.max = false;
        conceal(win);
        if (activeKey === key) focusTop();
        arrange();
        emit();
    }

    function minimize(key = activeKey) {
        const win = wins[key];
        if (!win || win.status !== 'open') return;
        if (!isDesktop()) return close(key);
        treeRemove(win.ws, key);
        win.status = 'min';
        conceal(win, 16);
        if (activeKey === key) focusTop();
        arrange();
        emit();
    }

    function toggleMax(key = activeKey) {
        const win = wins[key];
        if (!win || win.status !== 'open' || !isDesktop()) return;
        win.max = !win.max;
        focus(key);
        arrange();
    }

    function switchTo(n) {
        if (n === current || n < 1 || n > WORKSPACES) return;
        const dir = n > current ? 1 : -1;
        const leaving = visibleKeys(current).map((k) => wins[k].el);
        current = n;
        if (isDesktop()) {
            const entering = visibleKeys(n).map((k) => wins[k].el);
            gsap.killTweensOf([...leaving, ...entering], 'opacity,x,y,scale');
            if (leaving.length) {
                gsap.to(leaving, {
                    x: -48 * dir, opacity: 0, duration: 0.18, ease: 'power1.in',
                    onComplete: () => leaving.forEach((el) => {
                        if (!shouldShow(wins[el.dataset.app])) el.classList.remove('is-visible');
                        gsap.set(el, { clearProps: 'opacity,transform' });
                    }),
                });
            }
            entering.forEach((el) => el.classList.add('is-visible'));
            arrange({ animate: false });
            if (entering.length) {
                gsap.fromTo(entering, { x: 48 * dir, opacity: 0 }, {
                    x: 0, opacity: 1, duration: 0.3, ease: 'power3.out', stagger: 0.04,
                    delay: leaving.length ? 0.08 : 0, clearProps: 'opacity,transform',
                });
            }
        }
        focusTop();
    }

    function moveTo(n, key = activeKey) {
        const win = wins[key];
        if (!win || win.status !== 'open' || !isDesktop() || n === win.ws || n < 1 || n > WORKSPACES) return;
        treeRemove(win.ws, key);
        win.ws = n;
        win.max = false;
        treeInsert(n, key, null);
        conceal(win, 0);
        focusTop();
        arrange();
        emit();
        Notify.show('Workspace', `${win.app.name} se movió al workspace ${n}`, 'layout-grid');
    }

    function toggleLayout() {
        Settings.set('layout', tiling() ? 'floating' : 'tiling');
    }

    // ---------- Arrastre y redimensionado ----------

    function enableDrag(win) {
        const bar = $('.titlebar', win.el);

        bar.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 || e.target.closest('button') || !isDesktop()) return;
            focus(win.key);
            if (win.max) return;
            e.preventDefault();

            const start = { x: e.clientX, y: e.clientY };
            const origin = rectOf(win.el);
            const deskBox = desktop.getBoundingClientRect();
            const tiled = tiling();
            const leaves = tiled ? tileLayout(current).leaves : null;
            let moved = false;
            let target = null;
            bar.setPointerCapture(e.pointerId);

            const move = (ev) => {
                const dx = ev.clientX - start.x;
                const dy = ev.clientY - start.y;
                if (!moved) {
                    if (Math.hypot(dx, dy) < 4) return;
                    moved = true;
                    gsap.killTweensOf(win.el, 'left,top,width,height');
                    win.el.classList.add('dragging');
                }
                const next = { ...origin, x: origin.x + dx, y: origin.y + dy };
                const r = tiled ? next : clampFloating(next);
                gsap.set(win.el, { left: r.x, top: r.y });

                if (tiled) {
                    const px = ev.clientX - deskBox.left;
                    const py = ev.clientY - deskBox.top;
                    const hit = Object.keys(leaves).find((k) => k !== win.key && inside(leaves[k], px, py)) || null;
                    if (hit !== target) {
                        if (target) wins[target].el.classList.remove('drop-target');
                        target = hit;
                        if (target) wins[target].el.classList.add('drop-target');
                    }
                }
            };

            const end = () => {
                bar.removeEventListener('pointermove', move);
                bar.removeEventListener('pointerup', end);
                bar.removeEventListener('pointercancel', end);
                if (!moved) return;
                win.el.classList.remove('dragging');
                if (tiled) {
                    if (target) {
                        wins[target].el.classList.remove('drop-target');
                        swapKeys(trees[current], win.key, target);
                    }
                    arrange();
                } else {
                    win.rect = toFrac(rectOf(win.el));
                }
            };

            bar.addEventListener('pointermove', move);
            bar.addEventListener('pointerup', end);
            bar.addEventListener('pointercancel', end);
        });

        bar.addEventListener('dblclick', (e) => {
            if (!e.target.closest('button')) toggleMax(win.key);
        });
    }

    function enableResize(win) {
        for (const edge of ['e', 's', 'se']) {
            const handle = document.createElement('div');
            handle.className = `rz rz-${edge}`;
            handle.setAttribute('aria-hidden', 'true');
            win.el.appendChild(handle);

            handle.addEventListener('pointerdown', (e) => {
                if (e.button !== 0 || !isDesktop() || win.max) return;
                e.preventDefault();
                e.stopPropagation();
                focus(win.key);

                const start = { x: e.clientX, y: e.clientY };
                const origin = rectOf(win.el);
                const deskBox = desktop.getBoundingClientRect();
                const splits = [];

                if (tiling()) {
                    // En tiling, el borde derecho/inferior es el divisor del split ancestro más cercano.
                    const layout = tileLayout(current);
                    const path = (pathTo(trees[current], win.key) || []).reverse();
                    const pick = (dir) => path.find((p) => p.node.dir === dir && p.side === 'a');
                    const east = edge !== 's' && pick('v');
                    const south = edge !== 'e' && pick('h');
                    if (east) splits.push({ node: east.node, rect: layout.splits.get(east.node), axis: 'x' });
                    if (south) splits.push({ node: south.node, rect: layout.splits.get(south.node), axis: 'y' });
                    if (!splits.length) return;
                }

                handle.setPointerCapture(e.pointerId);
                win.el.classList.add('resizing');

                const move = (ev) => {
                    if (splits.length) {
                        const px = ev.clientX - deskBox.left;
                        const py = ev.clientY - deskBox.top;
                        for (const s of splits) {
                            s.node.ratio = s.axis === 'x'
                                ? clamp((px - s.rect.x - GAP_IN / 2) / (s.rect.w - GAP_IN), 0.15, 0.85)
                                : clamp((py - s.rect.y - GAP_IN / 2) / (s.rect.h - GAP_IN), 0.15, 0.85);
                        }
                        arrange({ animate: false });
                        return;
                    }
                    const a = area();
                    const width = edge === 's' ? origin.w
                        : clamp(origin.w + ev.clientX - start.x, MIN_W, a.w - origin.x - GAP_OUT);
                    const height = edge === 'e' ? origin.h
                        : clamp(origin.h + ev.clientY - start.y, MIN_H, a.h - origin.y - GAP_OUT);
                    gsap.set(win.el, { width, height });
                };

                const end = () => {
                    handle.removeEventListener('pointermove', move);
                    handle.removeEventListener('pointerup', end);
                    handle.removeEventListener('pointercancel', end);
                    win.el.classList.remove('resizing');
                    if (!splits.length) win.rect = toFrac(rectOf(win.el));
                };

                handle.addEventListener('pointermove', move);
                handle.addEventListener('pointerup', end);
                handle.addEventListener('pointercancel', end);
            });
        }
    }

    // ---------- Init ----------

    function init() {
        for (const el of $$('.window', desktop)) {
            const key = el.dataset.app;
            const win = { key, el, app: APPS[key], ws: 1, status: 'closed', max: false, rect: null };
            wins[key] = win;
            el.addEventListener('pointerdown', () => focus(key));
            $$('.ctrl', el).forEach((btn) => btn.addEventListener('click', () => {
                ({ close, minimize, maximize: toggleMax })[btn.dataset.action](key);
            }));
            enableDrag(win);
            enableResize(win);
        }

        trees[1] = fromConfig(INITIAL_LAYOUT);
        for (const key of keysOf(trees[1])) wins[key].status = 'open';
        for (const win of Object.values(wins)) win.el.classList.toggle('is-visible', shouldShow(win));
        arrange({ animate: false });
        focus('terminal');

        let frame = 0;
        window.addEventListener('resize', () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => arrange({ animate: false }));
        });

        desktopQuery.addEventListener('change', () => {
            for (const win of Object.values(wins)) {
                win.el.classList.toggle('is-visible', shouldShow(win));
                if (!isDesktop()) gsap.set(win.el, { clearProps: 'left,top,width,height,opacity,transform' });
            }
            arrange({ animate: false });
            focusTop();
        });

        Settings.on((key) => {
            if (key !== 'layout') return;
            arrange();
            emit();
        });
    }

    return {
        init, open, close, minimize, toggleMax, focus, cycleFocus, switchTo, moveTo, toggleLayout, isDesktop,
        onChange: (fn) => listeners.add(fn),
        get current() { return current; },
        get active() { return activeKey; },
        status: (key) => wins[key]?.status,
        wsOf: (key) => wins[key]?.ws,
        windowsIn: (ws) => visibleKeys(ws),
        visibleElements: () => Object.values(wins).filter(shouldShow).map((w) => w.el),
    };
})();
