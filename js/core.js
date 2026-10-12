'use strict';
// Utilidades compartidas, ajustes persistentes y notificaciones (dunst).

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (value) => String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Minúsculas y sin tildes, para búsquedas tolerantes ("musica" encuentra "Música").
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMotion) gsap.globalTimeline.timeScale(20);

// Lucide reemplaza cada [data-lucide] por un <svg>. Se agrupa en un frame para
// no recorrer el DOM varias veces cuando se inyecta contenido seguido.
let iconsQueued = false;
function refreshIcons() {
    if (iconsQueued) return;
    iconsQueued = true;
    requestAnimationFrame(() => {
        iconsQueued = false;
        window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } });
    });
}

function openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

const Settings = (() => {
    const KEY = 'auralix.settings';
    const data = { dnd: false, particles: !reducedMotion, volume: 70, brightness: 100, palette: 0, layout: 'floating' };
    try { Object.assign(data, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { /* almacenamiento bloqueado */ }
    const listeners = new Set();

    return {
        get: (key) => data[key],
        set(key, value) {
            if (data[key] === value) return;
            data[key] = value;
            try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* sin persistencia */ }
            listeners.forEach((fn) => fn(key, value));
        },
        on: (fn) => listeners.add(fn),
    };
})();

const Notify = (() => {
    const box = $('#notifications');
    const MAX = 3;

    function show(title, msg, icon = 'bell', { force = false, timeout = 4000 } = {}) {
        if (Settings.get('dnd') && !force) return;
        const el = document.createElement('div');
        el.className = 'notification';
        el.setAttribute('role', 'status');
        el.innerHTML = `
            <i data-lucide="${esc(icon)}" class="notif-icon"></i>
            <div class="notif-content">
                <span class="notif-title">${esc(title)}</span>
                <span class="notif-msg">${esc(msg)}</span>
            </div>`;
        box.appendChild(el);
        while (box.children.length > MAX) box.firstElementChild.remove();
        refreshIcons();
        gsap.fromTo(el, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });

        const dismiss = () => {
            if (el.dataset.leaving) return;
            el.dataset.leaving = 'true';
            gsap.to(el, { x: 24, opacity: 0, duration: 0.2, ease: 'power1.in', onComplete: () => el.remove() });
        };
        const timer = setTimeout(dismiss, timeout);
        el.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
    }

    return { show };
})();
