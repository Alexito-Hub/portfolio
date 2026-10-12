'use strict';
// Arranque: pantalla de login (SDDM), entrada al escritorio y enlaces directos (#kanso abre ese proyecto).

(() => {
    const login = $('#login-screen');
    const SESSION_KEY = 'auralix.session';
    let returning = false;
    try { returning = sessionStorage.getItem(SESSION_KEY) === '1'; } catch { /* sin sessionStorage */ }

    WM.init();
    document.body.dataset.session = 'login';

    function openDeepLink() {
        const id = decodeURIComponent(location.hash.slice(1));
        if (Projects.byId(id)) Actions.openProject(id);
    }
    window.addEventListener('hashchange', openDeepLink);

    function enterDesktop(animate) {
        document.body.dataset.session = 'ready';
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* sin sessionStorage */ }
        Terminal.boot({ animate });
        openDeepLink();
        if (animate) {
            setTimeout(() => Notify.show('Auralix OS', 'Ctrl+K o Alt+Space abre el lanzador. Click derecho en el escritorio para más opciones.', 'terminal', { timeout: 6000 }), 1800);
        }
    }

    // Recargar la página no vuelve a pedir login en la misma sesión.
    if (returning || reducedMotion) {
        login.remove();
        enterDesktop(false);
        return;
    }

    const timeEl = $('#login-time');
    const dateEl = $('#login-date');
    const dots = $('#login-pwd');
    const tick = () => {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
        const date = now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
        dateEl.textContent = date.charAt(0).toUpperCase() + date.slice(1);
    };
    tick();
    const clockTimer = setInterval(tick, 1000);

    let unlocked = false;
    let typing = 0;

    function unlock() {
        if (unlocked) return;
        unlocked = true;
        clearInterval(typing);
        clearInterval(clockTimer);
        document.removeEventListener('keydown', unlock);
        dots.textContent = '••••••••';
        login.classList.add('is-leaving');
        setTimeout(() => login.remove(), 500);

        gsap.from(WM.visibleElements(), {
            y: 16, opacity: 0, scale: 0.97, duration: 0.5, stagger: 0.08, delay: 0.25,
            ease: 'power3.out', clearProps: 'opacity,transform',
        });
        setTimeout(() => enterDesktop(true), 450);
    }

    // Autologin: escribe la "contraseña" y entra solo. Cualquier tecla o click lo adelanta.
    setTimeout(() => {
        if (unlocked) return;
        let count = 0;
        typing = setInterval(() => {
            dots.textContent += '•';
            if (++count >= 8) {
                clearInterval(typing);
                setTimeout(unlock, 350);
            }
        }, 110);
    }, 700);

    $('#login-form').addEventListener('submit', (e) => { e.preventDefault(); unlock(); });
    login.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
})();
