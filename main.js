// Init Icons
lucide.createIcons();

// --- Background Particles ---
const canvas = document.getElementById('wallpaper');
const ctx = canvas.getContext('2d');
let width, height, particles = [];
function resize() { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();
class Particle {
    constructor() {
        this.x = Math.random() * width; this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.3; this.vy = (Math.random() - 0.5) * 0.3;
        this.radius = Math.random() * 1.5 + 0.5; this.alpha = Math.random() * 0.4 + 0.1;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(66, 165, 245, ${this.alpha})`; ctx.fill();
    }
}
function initParticles() {
    particles = []; const pCount = Math.floor((width * height) / 15000);
    for (let i = 0; i < pCount; i++) particles.push(new Particle());
}
function animate() {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < particles.length; i++) {
        particles[i].update(); particles[i].draw();
        for (let j = i + 1; j < particles.length; j++) {
            const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
            if (dist < 120) {
                ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = `rgba(66, 165, 245, ${0.1 * (1 - dist/120)})`; ctx.lineWidth = 0.5; ctx.stroke();
            }
        }
    }
    requestAnimationFrame(animate);
}
initParticles(); animate();

// --- NOTIFICATIONS SYSTEM (Dunst clone) ---
let dndActive = false;
function notify(title, msg, iconStr = 'bell') {
    if(dndActive && title !== 'Sistema' && title !== 'No Molestar') return; // DND Check

    const container = document.getElementById('notifications-container');
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.innerHTML = `
        <i data-lucide="${iconStr}" class="notif-icon"></i>
        <div class="notif-content">
            <span class="notif-title">${title}</span>
            <span class="notif-msg">${msg}</span>
        </div>
    `;
    container.appendChild(notif);
    lucide.createIcons();
    
    gsap.fromTo(notif, { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.2)' });
    setTimeout(() => {
        gsap.to(notif, { x: 50, opacity: 0, duration: 0.3, onComplete: () => notif.remove() });
    }, 4000);
}

// --- DYNAMIC SYSTEM MONITORS (Waybar) ---
function updateClock() {
    const clock = document.getElementById('clock');
    if (clock) {
        clock.textContent = new Date().toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}
setInterval(updateClock, 1000); updateClock();

setInterval(() => {
    const cpuEl = document.getElementById('cpu-usage');
    if(cpuEl) cpuEl.textContent = (Math.floor(Math.random() * 15) + 1) + '%';
    
    const ramEl = document.getElementById('ram-usage');
    if(ramEl) {
        const base = 2.4;
        const fluct = (Math.random() * 0.2).toFixed(1);
        ramEl.textContent = (base + parseFloat(fluct)) + 'G';
    }
}, 3000);

// --- Window Interactivity (Dragging, Minimize, Maximize, Close) ---
let highestZ = 100;
document.querySelectorAll('.window').forEach(win => {
    win.addEventListener('mousedown', () => {
        document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
        win.classList.add('active');
        win.style.zIndex = ++highestZ;
        document.getElementById('active-ws-title').textContent = `~ / ${win.id.replace('win-', '')}`;
    });
    
    const titlebar = win.querySelector('.titlebar');
    let isDragging = false, startX, startY, initialLeft, initialTop;
    
    titlebar.addEventListener('mousedown', (e) => {
        // Disable drag in mobile or tiling mode
        if(window.innerWidth <= 1024 || document.getElementById('desktop').classList.contains('layout-tiling')) return;
        if(win.dataset.maximized === 'true') return;
        
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        const rect = win.getBoundingClientRect();
        const deskRect = document.getElementById('desktop').getBoundingClientRect();
        initialLeft = rect.left - deskRect.left;
        initialTop = rect.top - deskRect.top;
        win.style.transition = 'none';
        
        win.style.width = rect.width + 'px';
        win.style.height = rect.height + 'px';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        win.style.left = `${initialLeft + (e.clientX - startX)}px`;
        win.style.top = `${initialTop + (e.clientY - startY)}px`;
        win.style.bottom = 'auto'; win.style.right = 'auto';
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            win.style.transition = 'box-shadow var(--duration) var(--ease), border-color var(--duration) var(--ease)';
        }
    });
});

function updateTilingLayout() {
    // Tiling logic has been disabled per user request.
    // Windows are now fully floating and freely manageable.
}

// Window Controls
document.querySelectorAll('.ctrl.close').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const win = e.target.closest('.window');
        win.classList.remove('is-open'); // Mark as closed
        gsap.to(win, { scale: 0.9, opacity: 0, duration: 0.2, onComplete: () => {
            win.style.display = 'none';
            updateTilingLayout();
        }});
        notify('Ventana Cerrada', `Se cerró ${win.id.replace('win-', '')}`, 'x-circle');
    });
});

document.querySelectorAll('.ctrl.minimize').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const win = e.target.closest('.window');
        win.classList.remove('is-open'); // Mark as closed
        gsap.to(win, { 
            scale: 0.8, opacity: 0, y: 50, duration: 0.3, ease: 'power2.in',
            onComplete: () => { 
                win.style.display = 'none'; 
                updateTilingLayout();
            }
        });
    });
});

document.querySelectorAll('.ctrl.maximize').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const win = e.target.closest('.window');
        if(window.innerWidth <= 1024 || document.getElementById('desktop').classList.contains('layout-tiling')) {
            notify("Aviso", "Maximizar deshabilitado en modo Tiling/Mobile", "alert-circle");
            return;
        }
        
        if (win.dataset.maximized === 'true') {
            gsap.to(win, { 
                width: win.dataset.origW, height: win.dataset.origH, 
                left: win.dataset.origL, top: win.dataset.origT, 
                duration: 0.3, ease: 'power2.out',
                onComplete: () => {
                    win.dataset.maximized = 'false';
                    win.style.borderRadius = '';
                }
            });
        } else {
            win.dataset.origW = win.style.width || getComputedStyle(win).width;
            win.dataset.origH = win.style.height || getComputedStyle(win).height;
            win.dataset.origL = win.style.left || getComputedStyle(win).left;
            win.dataset.origT = win.style.top || getComputedStyle(win).top;
            
            gsap.to(win, { 
                width: '100%', height: 'calc(100% - 16px)', 
                left: '8px', top: '8px', 
                duration: 0.3, ease: 'power2.out'
            });
            win.dataset.maximized = 'true';
            win.style.zIndex = ++highestZ;
        }
    });
});

// --- WORKSPACE SWITCHER LOGIC (Hyprland Slide Animation) ---
document.querySelectorAll('.workspace-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        if(btn.classList.contains('active')) return;
        
        const currentWs = document.querySelector('.workspace-btn.active').textContent.trim();
        const nextWs = btn.textContent.trim();
        const goingForward = parseInt(nextWs) > parseInt(currentWs);
        
        document.querySelectorAll('.workspace-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const allWindows = document.querySelectorAll('.window');
        const toHide = Array.from(allWindows).filter(w => w.dataset.workspace === currentWs && w.style.display !== 'none');
        const toShow = Array.from(allWindows).filter(w => w.dataset.workspace === nextWs && w.classList.contains('is-open'));
        
        if (toShow.length === 0) {
            notify('Workspace Vacío', `No hay ventanas en el Workspace ${nextWs}`, 'layout-grid');
        } else {
            notify('Workspace', `Cambiando al Workspace ${nextWs}`, 'layout-grid');
        }

        if (toHide.length > 0) {
            // Slide out X depending on direction
            const exitX = goingForward ? -50 : 50;
            gsap.to(toHide, { x: exitX, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => {
                toHide.forEach(w => { w.style.display = 'none'; gsap.set(w, {x:0}); });
                showNextWorkspace(toShow, goingForward);
            }});
        } else {
            showNextWorkspace(toShow, goingForward);
        }

        function showNextWorkspace(windowsArray, goingForward) {
            if (windowsArray.length === 0) {
                updateTilingLayout();
                return;
            }
            const enterX = goingForward ? 50 : -50;
            windowsArray.forEach(w => {
                w.style.display = 'flex';
                gsap.set(w, { x: enterX, opacity: 0, scale: 1, y: 0 });
            });
            updateTilingLayout(); // UPDATE GRID NOW so they slide into their correct grid cells
            gsap.to(windowsArray, { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out', stagger: 0.05 });
        }
    });
});

// --- File Manager Content ---
const projectsData = {
    "alma": { title: "ALMA", status: "EN DESARROLLO", link: "https://auralix-studio.github.io/alma/", tags: ["Zig", "Compilador", "Custom Language", "VSCode Extension"], desc: "Lenguaje de programación diseñado desde cero por Auralix Studio. Escrito en Zig, apunta a ser completamente independiente de dependencias externas. Incluye su propio lexer, parser, sistema de tipos e intérprete.", features: ["Lexer y Parser construidos desde cero sin dependencias.", "Sistema de tipos estático y checkeo en tiempo de compilación.", "Extensión oficial de VSCode (Language Server) con auto-completado."], commits: ["a1b2c3d fix(parser): resolve ambiguity in unary expressions", "f9e8d7c feat(lexer): add support for multi-line strings", "453a12b refactor(types): implement custom type checker in Zig"] },
    "kanso": { title: "KANSO", status: "EN DESARROLLO", link: "https://auralix-studio.github.io/kanso/", tags: ["Flutter", "Dart", "IA offline", "llama.cpp", "Qwen2.5"], desc: "App de productividad estudiantil minimalista con Lumen, un asistente IA 100% offline. Cero suscripciones y completamente privado.", features: ["Integración nativa de Qwen2.5 3B GGUF para inferencia on-device.", "Memoria episódica indexada localmente con sqlite-vec.", "Tool Calling determinista guiado por gramáticas GBNF.", "Gestión fluida de tareas, sistema Pomodoro y reproductor Lo-Fi integrado."], commits: ["7f8e9d0 feat(lumen): integrate Whisper for local speech-to-text", "1a2b3c4 fix(ui): timer state persisting across app restarts", "9876543 perf(db): optimize episodic memory queries with sqlite-vec"] },
    "nexo": { title: "NEXO", status: "EN DESARROLLO", link: "https://auralix-studio.github.io/nexo/", tags: ["Flutter", "Elixir", "Android", "iOS", "Scraping", "UPLA"], desc: "App multiplataforma que unifica los portales universitarios de la UPLA (SIGMA + Intranet) en una única interfaz unificada, rápida y resiliente.", features: ["Backend Proxy escrito en Elixir (Phoenix) para scraping ultra-rápido de calificaciones.", "Cálculo automático de ponderaciones y tracker de asistencias.", "Integración bidireccional con Kanso para exportar datos del semestre al asistente IA."], commits: ["d1c2b3a feat(api): proxy SIGMA responses via Elixir backend", "a9b8c7d fix(auth): handle expired sessions gracefully", "4f5e6d7 feat(export): payload schema for Kanso integration"] },
    "lumen": { title: "LUMEN IA", status: "EN DESARROLLO", link: "https://auralix-studio.github.io/lumen/", tags: ["IA", "llama.cpp", "Qwen2.5", "GGUF", "QLoRA", "GBNF"], desc: "Asistente de inteligencia artificial on-device de Auralix, optimizado agresivamente para correr directo en smartphones y tablets sin conexión a internet.", features: ["Ejecución del modelo Qwen2.5 3B cuantizado en formato Q4_K_M.", "Fine-tuning (QLoRA) sobre un dataset de 20,000 ejemplos para forjar su personalidad.", "Pipeline RAG offline: extracción y vectorización de PDFs/DOCX vía OCR."], commits: ["e2d3c4b feat(model): quantize to Q4_K_M for Android constraints", "8a7b6c5 fix(gbnf): strict grammar rules for JSON tool calls", "1234567 docs: add training parameters for QLoRA dataset"] },
    "media-keep": { title: "MEDIA KEEP", status: "BETA", link: "https://alexito-hub.github.io/mediakeep/", tags: ["Flutter", "Android Native", "TileService", "API 29-35"], desc: "Descargador multimedia rápido y sin fricciones para Android. Opera de forma completamente silenciosa en segundo plano a través de los Quick Settings.", features: ["Mapeo de TileService nativo de Android interactuando vía MethodChannels en Flutter.", "Compatibilidad total con restricciones de Background Process en Android 10-14.", "Sin rastreadores ni servicios restrictivos de Play Services."], commits: ["b5c6d7e feat(service): migrate from Accessibility to TileService", "f1e2d3c fix(clipboard): background listener restrictions on API 33+", "890abcd chore: setup GitHub Pages auto-deploy for APK"] },
    "flux": { title: "FLUX", status: "EN DESARROLLO", link: "https://auralix-studio.github.io/flux/", tags: ["Flutter", "Dart", "UX Research", "Architecture"], desc: "Próximo gran proyecto de la suite Auralix. Actualmente iterando en fase de diseño, UX y validación arquitectónica.", features: ["Framework interno de animaciones fluidas, priorizando ~120fps en displays de alta tasa.", "Patrón de estado desacoplado, zero-boilerplate y memory-safe."], commits: ["3c4d5e6 docs: init project structure and architecture specs"] }
};

function renderProject(id) {
    const data = projectsData[id];
    if(!data) return;
    const tagsHtml = data.tags.map(t => `<span class="tag">${t}</span>`).join('');
    const commitsHtml = data.commits.map(c => {
        const parts = c.split(' ');
        return `<div><span class="git-commit">${parts[0]}</span> ${parts.slice(1).join(' ')}</div>`;
    }).join('');
    const featuresHtml = data.features ? data.features.map(f => `<li style="font-size: 13px; color: var(--ctp-text); padding-left: 15px; position: relative; margin-bottom: 6px;"><span style="position: absolute; left: 0; top: 0; color: var(--accent); user-select: none;">•</span> ${f}</li>`).join('') : '';
    const detailEl = document.getElementById('project-detail');
    gsap.to(detailEl, { opacity: 0, duration: 0.15, onComplete: () => {
        detailEl.innerHTML = `
            <header style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
                <h3 class="project-title">${data.title}</h3>
                <a href="${data.link}" target="_blank" rel="noopener noreferrer" style="color: var(--ctp-subtext); text-decoration: none; font-size: 12px; display: flex; align-items: center; gap: 4px;">Ver Repo <i data-lucide="external-link" style="width:12px; height:12px;"></i></a>
            </header>
            <div style="font-size: 11px; color: var(--green); margin-top: 2px;">Estado: ${data.status}</div>
            <div class="project-tags">${tagsHtml}</div>
            <p class="project-desc" style="margin-top: 12px; line-height: 1.6;">${data.desc}</p>
            <div style="margin-top: 15px;"><h4 style="font-size: 11px; color: var(--ctp-overlay0); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Highlights</h4><ul style="list-style: none; margin: 0; padding: 0;">${featuresHtml}</ul></div>
            <div class="git-log" aria-label="Historial de Git ficticio"><div style="color: var(--ctp-overlay0); margin-bottom: 5px; font-weight: bold;">$ git log --oneline</div>${commitsHtml}</div>
        `;
        lucide.createIcons();
        gsap.to(detailEl, { opacity: 1, duration: 0.2, ease: "power1.out" });
    }});
}

document.querySelectorAll('.fm-dir-title').forEach(dir => {
    dir.addEventListener('click', () => {
        let next = dir.nextElementSibling;
        while(next && next.classList.contains('fm-item')) {
            if (next.style.display === 'none') {
                next.style.display = 'flex';
                gsap.fromTo(next, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.2 });
            } else { next.style.display = 'none'; }
            next = next.nextElementSibling;
        }
    });
});

document.querySelectorAll('.fm-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.fm-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        renderProject(item.dataset.project);
    });
});
document.querySelector('.fm-item').classList.add('selected'); renderProject('alma');

// --- Control Center Logic & Sliders ---
const cc = document.getElementById('control-center');
document.querySelectorAll('.cc-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cc.style.display === 'none') {
            cc.style.display = 'flex';
            gsap.fromTo(cc, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' });
        } else {
            gsap.to(cc, { opacity: 0, y: 20, duration: 0.2, onComplete: () => cc.style.display = 'none' });
        }
    });
});

document.querySelectorAll('.cc-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if(btn.id === 'btn-tiling-cc') {
            toggleTiling();
            return;
        }
        const span = btn.querySelector('span').textContent;
        const isActive = btn.classList.toggle('active');
        
        if (btn.dataset.id === 'dnd') {
            dndActive = isActive;
            notify("No Molestar", isActive ? "Activado. Notificaciones silenciadas." : "Desactivado", "moon");
        } else {
            if(!isActive) {
                btn.style.background = 'rgba(255,255,255,0.05)';
                notify(span, "Desconectado", 'power-off');
            } else {
                btn.style.background = span.includes('Bluetooth') ? 'var(--purple)' : 'var(--accent)';
                notify(span, "Conectado / Activado", 'check');
            }
        }
    });
});

// Real working sliders
const volSlider = document.getElementById('vol-slider');
const volText = document.getElementById('vol-text');
const audio = document.getElementById('audio-player');
volSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    audio.volume = val / 100;
    if(volText) {
        volText.innerHTML = `<i data-lucide="${val == 0 ? 'volume-x' : 'volume-2'}" class="waybar-icon"></i> ${val}%`;
        lucide.createIcons();
    }
});

const brightSlider = document.getElementById('bright-slider');
const brightOverlay = document.getElementById('brightness-overlay');
brightSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    const opacity = 0.8 - (val / 100) * 0.8;
    brightOverlay.style.opacity = opacity;
});

function toggleTiling() {
    const desktop = document.getElementById('desktop');
    const isTiling = desktop.classList.toggle('layout-tiling');
    notify('Hyprland WM', isTiling ? 'Modo Tiling Activado' : 'Modo Floating Activado', 'layout-grid');
    
    // reset inline styles if switching to tiling
    if(isTiling) {
        document.querySelectorAll('.window').forEach(w => {
            w.style.width = ''; w.style.height = ''; w.style.top = ''; w.style.left = '';
            w.dataset.maximized = 'false';
        });
    }
    updateTilingLayout();
}

// --- Waybar App Shortcuts ---
document.querySelectorAll('.app-shortcut').forEach(btn => {
    btn.addEventListener('click', () => {
        const appId = btn.dataset.app;
        if(appId) {
            restoreWindow(appId);
            notify("App Iniciada", `Abriendo ${btn.getAttribute('title') || appId}`, "zap");
        }
    });
});

// --- App Launcher (Rofi/Wofi) ---
const launcher = document.getElementById('app-launcher');
const launcherInput = document.getElementById('launcher-input');
let launcherActive = false;

function toggleLauncher() {
    launcherActive = !launcherActive;
    if (launcherActive) {
        launcher.style.display = 'flex';
        gsap.fromTo(launcher, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'power2.out' });
        launcherInput.focus(); launcherInput.value = ''; filterLauncher('');
    } else {
        gsap.to(launcher, { scale: 0.9, opacity: 0, duration: 0.2, onComplete: () => launcher.style.display = 'none' });
    }
}
document.getElementById('btn-start-launcher')?.addEventListener('click', (e) => { e.stopPropagation(); toggleLauncher(); });
launcherInput.addEventListener('input', (e) => filterLauncher(e.target.value.toLowerCase()));
function filterLauncher(term) {
    document.querySelectorAll('.launcher-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(term) ? 'flex' : 'none';
    });
}
document.querySelectorAll('.launcher-item').forEach(item => {
    item.addEventListener('click', () => {
        const appId = item.dataset.app;
        toggleLauncher();
        restoreWindow(appId);
        notify("Aplicación lanzada", item.textContent.trim(), 'play');
    });
});

// --- Context Menu (Right Click) ---
const ctxMenu = document.getElementById('context-menu');
document.getElementById('desktop').addEventListener('contextmenu', (e) => {
    if (e.target.id === 'desktop' || e.target.id === 'wallpaper') {
        e.preventDefault();
        ctxMenu.style.display = 'block';
        ctxMenu.style.left = e.clientX + 'px';
        ctxMenu.style.top = e.clientY + 'px';
        gsap.fromTo(ctxMenu, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.15 });
    }
});
document.getElementById('ctx-terminal').addEventListener('click', () => { restoreWindow('win-terminal'); notify('Terminal', 'Sesión iniciada', 'terminal'); });
document.getElementById('ctx-launcher').addEventListener('click', toggleLauncher);
document.getElementById('ctx-tiling-toggle').addEventListener('click', toggleTiling);
document.getElementById('ctx-wallpaper').addEventListener('click', () => {
    notify('Sistema', 'Fondo actualizado', 'image');
    const colors = ['#1E1E2E', '#181825', '#11111B', '#24273a', '#1e2030'];
    document.getElementById('wallpaper').style.background = `radial-gradient(circle at center, ${colors[Math.floor(Math.random()*colors.length)]}, var(--ctp-base))`;
});

// Global Event Listeners (KEYBINDINGS / SUPER KEY)
document.addEventListener('keydown', (e) => {
    if (e.altKey) {
        switch(e.code) {
            case 'Digit1': document.querySelectorAll('.workspace-btn')[0].click(); e.preventDefault(); break;
            case 'Digit2': document.querySelectorAll('.workspace-btn')[1].click(); e.preventDefault(); break;
            case 'Digit3': document.querySelectorAll('.workspace-btn')[2].click(); e.preventDefault(); break;
            case 'Digit4': document.querySelectorAll('.workspace-btn')[3].click(); e.preventDefault(); break;
            case 'Digit5': document.querySelectorAll('.workspace-btn')[4].click(); e.preventDefault(); break;
            case 'Space': toggleLauncher(); e.preventDefault(); break;
            case 'KeyT': restoreWindow('win-terminal'); notify("Lanzador", "Abriendo Terminal", "terminal"); e.preventDefault(); break;
            case 'KeyF': toggleTiling(); e.preventDefault(); break;
            case 'KeyQ': 
                const activeWin = document.querySelector('.window.active');
                if(activeWin && activeWin.style.display !== 'none') {
                    activeWin.querySelector('.ctrl.close').click();
                }
                e.preventDefault(); break;
        }
    }
    
    if (e.code === 'Escape') {
        if (launcherActive) toggleLauncher();
        if (cc.style.display !== 'none') gsap.to(cc, { opacity: 0, y: 20, duration: 0.2, onComplete: () => cc.style.display = 'none' });
        if (ctxMenu.style.display !== 'none') ctxMenu.style.display = 'none';
    }
});
document.addEventListener('click', (e) => {
    if (cc.style.display !== 'none' && !cc.contains(e.target) && !e.target.closest('.cc-toggle')) {
        gsap.to(cc, { opacity: 0, y: 20, duration: 0.2, onComplete: () => cc.style.display = 'none' });
    }
    if (ctxMenu.style.display !== 'none') ctxMenu.style.display = 'none';
});


// --- Music Player Logic ---
const playBtn = document.getElementById('btn-play');
const disk = document.getElementById('music-disk');
let isPlaying = false, rotationTween;

const tracks = [
    { title: "Lo-Fi Study Vibes", file: "track1.mp3" },
    { title: "Deep Coding Session", file: "track2.mp3" },
    { title: "Midnight Hacker", file: "track3.mp3" }
];
let currentTrackIdx = 0;

function updateTrack() {
    document.getElementById('track-name').textContent = tracks[currentTrackIdx].title;
    document.getElementById('track-artist').textContent = `Auralix Session - assets/${tracks[currentTrackIdx].file}`;
    audio.src = `assets/${tracks[currentTrackIdx].file}`;
    if (isPlaying) {
        audio.play().catch(e => console.warn('Missing track', e));
    }
    notify('Música', `Pista: ${tracks[currentTrackIdx].title}`, 'music');
}

document.getElementById('btn-next').addEventListener('click', () => {
    currentTrackIdx = (currentTrackIdx + 1) % tracks.length;
    updateTrack();
});
document.getElementById('btn-prev').addEventListener('click', () => {
    currentTrackIdx = (currentTrackIdx - 1 + tracks.length) % tracks.length;
    updateTrack();
});

playBtn.addEventListener('click', () => {
    if (isPlaying) {
        audio.pause(); playBtn.innerHTML = '<i data-lucide="play"></i>';
        if(rotationTween) rotationTween.pause();
        notify("Música", "Pausada", "pause-circle");
    } else {
        audio.play().catch(err => console.warn('No hay track1.mp3 en assets/', err));
        playBtn.innerHTML = '<i data-lucide="pause"></i>';
        if(!rotationTween) rotationTween = gsap.to(disk, { rotation: 360, repeat: -1, duration: 4, ease: "none" });
        else rotationTween.play();
        notify("Música", `Reproduciendo ${tracks[currentTrackIdx].title}`, "play-circle");
    }
    lucide.createIcons();
    isPlaying = !isPlaying;
});


// --- Terminal Logic ---
const tInput = document.getElementById('terminal-input');
const tHistory = document.getElementById('terminal-history');
const tContainer = document.getElementById('terminal-container');
const tInputWrapper = document.querySelector('.terminal-input-wrapper');
let cmdHist = [], histIdx = -1;

const printT = (c) => { tHistory.innerHTML += `<div class="terminal-line">${c}</div>`; tContainer.scrollTop = tContainer.scrollHeight; }
const printP = (cmd) => { printT(`<span class="prompt-user">alessandro</span><span class="prompt-at">@</span><span class="prompt-host">auralix</span> <span class="prompt-path">~</span> <span class="prompt-char">➜</span> ${cmd}`); }

const restoreWindow = (id) => {
    const win = document.getElementById(id);
    if (!win) return;
    
    const currentWs = document.querySelector('.workspace-btn.active').textContent.trim();
    
    // Si la ventana ya está abierta (y visible en algún workspace)
    if (win.classList.contains('is-open')) {
        const winWs = win.dataset.workspace;
        
        if (winWs !== currentWs) {
            // Está en otro workspace: cambiar a ese workspace
            const wsBtns = Array.from(document.querySelectorAll('.workspace-btn'));
            const targetBtn = wsBtns.find(b => b.textContent.trim() === winWs);
            if (targetBtn) {
                targetBtn.click();
                // Darle tiempo a la animación de cambio de workspace
                setTimeout(() => {
                    document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
                    win.classList.add('active');
                    win.style.zIndex = ++highestZ;
                    document.getElementById('active-ws-title').textContent = `~ / ${win.id.replace('win-', '')}`;
                }, 300);
                return;
            }
        }
    } else {
        // No está abierta: asignarla al workspace actual
        win.dataset.workspace = currentWs;
    }
    
    win.classList.add('is-open'); // Mark as open
    
    if (win.style.display === 'none' || win.style.display === '') {
        win.style.display = 'flex';
        gsap.fromTo(win, { scale: 0.9, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, x: 0, duration: 0.3, ease: 'power2.out', onComplete: updateTilingLayout });
    } else {
        updateTilingLayout();
    }
    
    // trigger focus logic
    document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
    win.classList.add('active');
    win.style.zIndex = ++highestZ;
    document.getElementById('active-ws-title').textContent = `~ / ${win.id.replace('win-', '')}`;
};

tInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const cmd = tInput.value.trim();
        if (cmd) { cmdHist.push(cmd); histIdx = cmdHist.length; }
        printP(cmd); tInput.value = '';
        if (!cmd) return;
        const args = cmd.split(' ').filter(Boolean);
        const main = args[0].toLowerCase();
        
        switch(main) {
            case 'help': printT('Comandos disponibles: help, ls, cat, whoami, clear, github, contact, music, htop'); break;
            case 'whoami': printT('Alessandro Villogas'); break;
            case 'clear': tHistory.innerHTML = ''; break;
            case 'github': printT('Abriendo GitHub...'); window.open('https://github.com/Alexito-Hub', '_blank'); break;
            case 'contact': printT('Email: alessandrovillogas@outlook.es'); break;
            case 'music': printT('Abriendo ncmpcpp...'); restoreWindow('win-music'); break;
            case 'htop': printT('Ejecutando analizador de Skills...'); restoreWindow('win-htop'); break;
            case 'ls': printT('<span style="color:var(--accent)">alma</span> <span style="color:var(--accent)">kanso</span> <span style="color:var(--accent)">nexo</span> <span style="color:var(--accent)">lumen</span> perfil.txt'); break;
            case 'cat':
                if (args[1] === 'perfil.txt' || args[1] === './perfil.txt') {
                    printT('Fundador — Auralix Studio<br>Full-Stack Engineer<br>Mobile Developer · IA Local<br>Ing. Sistemas - UPLA');
                } else if (['alma', 'kanso', 'nexo', 'lumen'].includes(args[1])) {
                    printT(`Abriendo ${args[1]}...`); restoreWindow('win-projects');
                    document.querySelector(`.fm-item[data-project="${args[1]}"]`)?.click();
                } else { printT(`cat: ${args[1]}: No such file or directory`); }
                break;
            default: printT(`<span style="color:var(--red)">comando no encontrado: ${main}</span>`);
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault(); if (histIdx > 0) { histIdx--; tInput.value = cmdHist[histIdx]; }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault(); if (histIdx < cmdHist.length - 1) { histIdx++; tInput.value = cmdHist[histIdx]; }
        else { histIdx = cmdHist.length; tInput.value = ''; }
    }
});
tContainer.addEventListener('click', () => { if (tInputWrapper.style.display !== 'none') tInput.focus(); });

// --- Boot Animation ---
// --- SDDM Login Screen Logic ---
const loginScreen = document.getElementById('login-screen');
const loginBtn = document.getElementById('login-btn');
const loginPwd = document.getElementById('login-pwd');

function updateLoginClock() {
    const now = new Date();
    document.getElementById('login-time').textContent = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    document.getElementById('login-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}
setInterval(updateLoginClock, 1000);
updateLoginClock();

window.addEventListener('DOMContentLoaded', () => {
    // We now start in FLOATING mode by default, so programs are "libres" 
    // and can be dragged around by the user.
    updateTilingLayout();

    const tw = document.getElementById('typewriter-container');
    const text = "./init_os.sh && neofetch";
    let idx = 0;
    
    tw.innerHTML = '<span class="prompt-user">alessandro</span><span class="prompt-at">@</span><span class="prompt-host">auralix</span> <span class="prompt-path">~</span> <span class="prompt-char">➜</span> <span id="tw-text"></span><span class="cursor-block" style="display:inline-block; width:8px; height:15px; background:var(--accent); vertical-align:middle; margin-left:2px; animation:blink 1s step-end infinite;"></span>';
    const spanText = document.getElementById('tw-text');

    const type = () => {
        if(idx < text.length) {
            spanText.textContent += text.charAt(idx); idx++; setTimeout(type, 40);
        } else {
                tHistory.innerHTML = `
                    <div style="display: flex; gap: 30px; margin-bottom: 25px; flex-wrap: wrap; padding: 15px; background: rgba(30,30,46,0.3); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); align-items: center;">
                        <div style="color: var(--blue); font-weight: bold; white-space: pre; line-height: 1.2; font-size: 13px; text-shadow: 0 0 10px rgba(137, 180, 250, 0.4);">
      /\\
     /  \\
    /    \\
   /      \\
  /   ,,   \\
 /   |  |   \\
/_-''    ''-_\\
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span style="color:var(--blue);font-weight:bold;margin-bottom:4px;font-size:14px">alessandro<span style="color:var(--ctp-text)">@</span>auralix</span>
                            <span style="color:var(--ctp-overlay0); margin-bottom: 6px;">-----------------------</span>
                            <span><strong style="color:var(--blue); display:inline-block; width: 70px;">OS</strong> <span style="color:var(--ctp-subtext)">Auralix OS (Arch Linux x86_64)</span></span>
                            <span><strong style="color:var(--blue); display:inline-block; width: 70px;">Host</strong> <span style="color:var(--ctp-subtext)">Auralix-Studio v2.0</span></span>
                            <span><strong style="color:var(--blue); display:inline-block; width: 70px;">Kernel</strong> <span style="color:var(--ctp-subtext)">6.9.1-zen1-1-zen</span></span>
                            <span><strong style="color:var(--blue); display:inline-block; width: 70px;">Uptime</strong> <span style="color:var(--ctp-subtext)">20+ años</span></span>
                            <span><strong style="color:var(--blue); display:inline-block; width: 70px;">Packages</strong> <span style="color:var(--ctp-subtext)">1337 (pacman)</span></span>
                            <span><strong style="color:var(--blue); display:inline-block; width: 70px;">Shell</strong> <span style="color:var(--ctp-subtext)">zsh 5.9</span></span>
                            <span><strong style="color:var(--blue); display:inline-block; width: 70px;">WM</strong> <span style="color:var(--ctp-subtext)">Hyprland (Wayland)</span></span>
                            <span><strong style="color:var(--blue); display:inline-block; width: 70px;">Theme</strong> <span style="color:var(--ctp-subtext)">Catppuccin Mocha [GTK3]</span></span>
                            <span><strong style="color:var(--blue); display:inline-block; width: 70px;">Terminal</strong> <span style="color:var(--ctp-subtext)">tty1.sh (kitty-clone)</span></span>
                            <div style="display: flex; gap: 5px; margin-top: 10px;">
                                <div style="width:12px;height:12px;border-radius:50%;background:#f38ba8"></div>
                                <div style="width:12px;height:12px;border-radius:50%;background:#a6e3a1"></div>
                                <div style="width:12px;height:12px;border-radius:50%;background:#f9e2af"></div>
                                <div style="width:12px;height:12px;border-radius:50%;background:#89b4fa"></div>
                                <div style="width:12px;height:12px;border-radius:50%;background:#cba6f7"></div>
                                <div style="width:12px;height:12px;border-radius:50%;background:#94e2d5"></div>
                            </div>
                        </div>
                    </div>`;
            setTimeout(() => {
                tw.style.display = 'none';
                tHistory.style.display = 'block';
                tInputWrapper.style.display = 'flex';
                tInput.focus();
                
                setTimeout(() => notify("Sistema", "Bienvenido a Auralix OS. Presiona Alt+Space para lanzar apps.", "terminal"), 800);
            }, 300);
        }
    };

    function doLogin() {
        loginScreen.style.opacity = '0';
        loginScreen.style.pointerEvents = 'none';
        
        setTimeout(() => {
            loginScreen.style.display = 'none';
            // Update layout (disabled tiling but kept function call for safety)
            updateTilingLayout();
            
            // Only animate the windows that are open by default
            const ws1Windows = Array.from(document.querySelectorAll('.window[data-workspace="1"].is-open'));
            if(ws1Windows.length > 0) {
                gsap.from(ws1Windows, { duration: 0.5, y: 20, opacity: 0, scale: 0.95, stagger: 0.1, ease: "power3.out" });
            }
            
            // Start boot animation in the terminal tile
            setTimeout(type, 300);
        }, 500);
    }

    // Auto-login animation
    loginPwd.value = ''; // Ensure empty on load
    setTimeout(() => {
        let pwdLength = 0;
        const targetLength = 8;
        const typeInterval = setInterval(() => {
            loginPwd.value += '•';
            pwdLength++;
            if (pwdLength >= targetLength) {
                clearInterval(typeInterval);
                setTimeout(doLogin, 400); // Wait a bit then login!
            }
        }, 150);
    }, 1000); // 1 second delay before starting to type

    // Fallback if they click before animation finishes
    loginBtn.addEventListener('click', doLogin);
    loginPwd.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') doLogin();
    });
});

// --- Notifications for Waybar Buttons ---
document.getElementById('btn-cpu')?.addEventListener('click', () => {
    notify("Rendimiento del Sistema", "Uso de CPU: 4% (Ryzen 9 5900X). Temperatura estable a 45°C.", "cpu");
});
document.getElementById('btn-ram')?.addEventListener('click', () => {
    notify("Rendimiento del Sistema", "Uso de RAM: 2.4G / 32GB (DDR4 3600MHz). Swap: 0B.", "memory-stick");
});
document.getElementById('btn-location')?.addEventListener('click', () => {
    notify("Ubicación", "Huancayo, Perú. Latencia de red: 12ms a servidores de Lima.", "map-pin");
});

// --- Music Player Logic ---
const playlist = [
    { title: "Ocean Eyes", artist: "Billie Eilish", file: "assets/music/ocean_eyes.mp3" },
    { title: "Gone, Gone, Gone", artist: "Phillip Phillips", file: "assets/music/gone_gone_gone.mp3" },
    { title: "Riptide", artist: "Vance Joy", file: "assets/music/riptide.mp3" }
];
let currentSongIndex = 0;

const audioPlayer = document.getElementById('audio-player');
const trackName = document.getElementById('track-name');
const trackArtist = document.getElementById('track-artist');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const musicDisk = document.getElementById('music-disk');

function loadSong(index) {
    const song = playlist[index];
    trackName.textContent = song.title;
    trackArtist.textContent = song.artist;
    audioPlayer.src = song.file;
}

function playSong() {
    audioPlayer.play();
    btnPlay.innerHTML = '<i data-lucide="pause"></i>';
    musicDisk.style.animationPlayState = 'running';
    lucide.createIcons();
}

function pauseSong() {
    audioPlayer.pause();
    btnPlay.innerHTML = '<i data-lucide="play"></i>';
    musicDisk.style.animationPlayState = 'paused';
    lucide.createIcons();
}

btnPlay?.addEventListener('click', () => {
    if (audioPlayer.paused) {
        playSong();
    } else {
        pauseSong();
    }
});

btnNext?.addEventListener('click', () => {
    currentSongIndex = (currentSongIndex + 1) % playlist.length;
    loadSong(currentSongIndex);
    playSong();
});

btnPrev?.addEventListener('click', () => {
    currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
    loadSong(currentSongIndex);
    playSong();
});

audioPlayer?.addEventListener('ended', () => {
    btnNext.click();
});

// Load first song on init
if(audioPlayer) {
    loadSong(currentSongIndex);
    audioPlayer.loop = false; // Disable default loop since we handle 'ended' event
}
