'use strict';
// Terminal interactiva (tty1.sh). Todo lo que escribe el usuario se escapa antes de pintarse.

const Terminal = (() => {
    const root = $('#terminal');
    const out = $('#terminal-output');
    const form = $('#terminal-form');
    const input = $('#terminal-input');
    const MAX_LINES = 400;
    const history = [];
    let historyIndex = 0;
    let ready = false;

    const ARCH_LOGO = [
        '      /\\',
        '     /  \\',
        '    /    \\',
        '   /      \\',
        '  /   ,,   \\',
        ' /   |  |   \\',
        "/_-''    ''-_\\",
    ].join('\n');

    // ---------- Salida ----------

    const prompt = (cmd = '') => `<span class="prompt"><span class="prompt-user">${PROFILE.user}</span><span class="prompt-at">@</span><span class="prompt-host">${PROFILE.host}</span> <span class="prompt-path">~</span> <span class="prompt-char">➜</span></span> ${esc(cmd)}`;
    const link = (cmd, label = cmd) => `<button type="button" class="t-link" data-cmd="${esc(cmd)}">${esc(label)}</button>`;
    const grid = (rows) => `<div class="term-grid">${rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>`;

    function print(html, cls = '') {
        const line = document.createElement('div');
        line.className = `term-line ${cls}`.trim();
        line.innerHTML = html.trim(); // .term-line usa pre-wrap: la indentación de las plantillas se vería
        out.appendChild(line);
        while (out.childElementCount > MAX_LINES) out.firstElementChild.remove();
        root.scrollTop = root.scrollHeight;
        return line;
    }
    const error = (msg) => print(esc(msg), 'term-error');
    const muted = (msg) => print(esc(msg), 'term-muted');

    function neofetch() {
        const years = new Date().getFullYear() - PROFILE.codingSince;
        const rows = [
            ['OS', 'Arch Linux x86_64'], ['WM', 'Hyprland'], ['Shell', 'zsh'], ['Editor', 'VSCode · Neovim'],
            ['Lang', 'Dart · TypeScript · Rust'], ['Studio', 'Auralix'], ['Local AI', 'Lumen (Qwen2.5 3B)'],
            ['Uptime', `${years} años programando`],
        ];
        const colors = ['red', 'green', 'yellow', 'blue', 'purple', 'teal'];
        return `
            <div class="neofetch">
                <pre class="nf-logo" aria-hidden="true">${esc(ARCH_LOGO)}</pre>
                <div class="nf-info">
                    <span class="nf-title">${PROFILE.user}<span class="nf-at">@</span>${PROFILE.host}</span>
                    <span class="nf-sep" aria-hidden="true">${'-'.repeat(17)}</span>
                    ${rows.map(([k, v]) => `<span><b>${k}</b>${esc(v)}</span>`).join('')}
                    <span class="nf-colors" aria-hidden="true">${colors.map((c) => `<span style="background: var(--${c})"></span>`).join('')}</span>
                </div>
            </div>`;
    }

    function printProject(p) {
        print(`<span class="t-title">${esc(p.title)}</span> <span class="t-status t-status--${p.status === 'BETA' ? 'beta' : 'dev'}">[${esc(p.status)}]</span>`);
        print(esc(p.desc));
        print(`<span class="term-muted">stack:</span> ${p.tags.map(esc).join(' · ')}`);
        print(`<span class="term-muted">→</span> ${link(`open ${p.id}`)}`);
    }

    // ---------- Sistema de archivos virtual ----------

    const FILES = {
        'perfil.txt': () => print(PERFIL.map(esc).join('<br>')),
        'readme.md': () => $$('#about-buffer p').forEach((p) => print(esc(p.textContent.trim().replace(/\s+/g, ' ')))),
        'stack.json': () => print(`<pre class="term-pre">${esc(JSON.stringify(STACK, null, 2))}</pre>`),
        'contact.sh': () => print(`<pre class="term-pre">${esc($('#contact-script').textContent)}</pre>`),
    };

    function resolve(arg) {
        const clean = arg.replace(/^(\.\/|~\/)+/, '').replace(/\/+$/, '');
        if (FILES[clean]) return { type: 'file', name: clean };
        const group = PROJECT_GROUPS.find((g) => g.id === clean);
        if (group) return { type: 'dir', group };
        const name = norm(clean.split('/').pop());
        const project = PROJECTS.find((p) => p.id === name || norm(p.title) === name);
        return project ? { type: 'project', project } : null;
    }

    const listGroup = (group) => PROJECTS.filter((p) => p.group === group.id).map((p) => link(`cat ${p.id}`, `${p.id}/`)).join('  ');

    const APP_ALIASES = {
        terminal: 'terminal', tty: 'terminal',
        proyectos: 'projects', projects: 'projects',
        readme: 'about', 'readme.md': 'about', 'sobre-mi': 'about', about: 'about',
        stack: 'stack', 'stack.json': 'stack',
        contacto: 'contact', contact: 'contact', 'contact.sh': 'contact',
        musica: 'music', music: 'music', ncmpcpp: 'music',
    };

    // ---------- Comandos ----------
    // Los que tienen `desc` aparecen en `help` y en el autocompletado; el resto son easter eggs.

    const COMMANDS = {
        help: {
            desc: 'muestra esta ayuda',
            run() {
                print('Comandos disponibles <span class="term-muted">(click para ejecutar, Tab autocompleta)</span>');
                print(grid(Object.entries(COMMANDS)
                    .filter(([, c]) => c.desc)
                    .map(([name, c]) => [link(c.example || name, c.usage || name), esc(c.desc)])));
            },
        },
        ls: {
            usage: 'ls [carpeta]', desc: 'lista proyectos y archivos',
            complete: () => PROJECT_GROUPS.map((g) => `${g.id}/`),
            run(args) {
                const target = args.find((a) => !a.startsWith('-'));
                if (!target) {
                    PROJECT_GROUPS.forEach((g) => print(`<span class="t-dir">${esc(g.label)}</span>  ${listGroup(g)}`));
                    print(Object.keys(FILES).map((f) => link(`cat ${f}`, f)).join('  '));
                    return;
                }
                const r = resolve(target);
                if (r?.type === 'dir') print(listGroup(r.group));
                else if (r?.type === 'project') print(`${link(`cat ${r.project.id}`, 'README.md')}  ${link(`open ${r.project.id}`, 'abrir ↗')}`);
                else if (r?.type === 'file') print(esc(r.name));
                else error(`ls: no se puede acceder a '${target}': No existe el archivo o directorio`);
            },
        },
        cat: {
            usage: 'cat <archivo>', example: 'cat perfil.txt', desc: 'muestra un archivo o un proyecto',
            complete: () => [...Object.keys(FILES), ...PROJECTS.map((p) => p.id)],
            run(args) {
                if (!args.length) return error('cat: falta el archivo. Prueba: cat perfil.txt');
                for (const arg of args) {
                    const r = resolve(arg);
                    if (!r) error(`cat: ${arg}: No existe el archivo o directorio`);
                    else if (r.type === 'dir') error(`cat: ${arg}: Es un directorio. Prueba: ls ${arg}`);
                    else if (r.type === 'file') FILES[r.name]();
                    else printProject(r.project);
                }
            },
        },
        open: {
            usage: 'open <app|proyecto>', example: 'open kanso', desc: 'abre una ventana o un proyecto',
            complete: () => [...new Set([...Object.keys(APP_ALIASES), ...PROJECTS.map((p) => p.id), 'github'])],
            run(args) {
                const target = args[0];
                if (!target) return error('open: falta el destino. Prueba: open kanso');
                if (norm(target) === 'github') return COMMANDS.github.run();
                const app = APP_ALIASES[norm(target)];
                if (app) {
                    muted(`Abriendo ${APPS[app].file}…`);
                    return Actions.openApp(app);
                }
                const r = resolve(target);
                if (r?.type === 'project') {
                    muted(`Abriendo ${r.project.id}/ en el gestor de proyectos…`);
                    return Actions.openProject(r.project.id);
                }
                error(`open: '${target}' no existe. Prueba: ls`);
            },
        },
        whoami: { desc: 'quién soy', run: () => print(esc(PROFILE.name)) },
        neofetch: { desc: 'información del sistema', run: () => print(neofetch()) },
        stack: {
            desc: 'tecnologías que uso',
            run() {
                muted('Abriendo stack.json…');
                Actions.openApp('stack');
            },
        },
        contact: {
            desc: 'datos de contacto',
            run() {
                print(`Email:  <a href="mailto:${esc(PROFILE.email)}">${esc(PROFILE.email)}</a>`);
                print(`GitHub: <a href="${esc(PROFILE.github)}" target="_blank" rel="noopener noreferrer">${esc(PROFILE.github.replace('https://', ''))}</a>`);
                Actions.openApp('contact');
            },
        },
        github: {
            desc: 'abre mi GitHub',
            run() {
                muted('Abriendo github.com/Alexito-Hub…');
                openExternal(PROFILE.github);
            },
        },
        music: {
            usage: 'music [play|pause|next|prev]', example: 'music play', desc: 'controla el reproductor',
            complete: () => ['play', 'pause', 'next', 'prev'],
            run([action]) {
                const actions = { play: Music.play, pause: Music.pause, next: Music.next, prev: Music.prev };
                if (!action) return Actions.openApp('music');
                if (!actions[action]) return error(`music: acción desconocida '${action}'. Usa play, pause, next o prev`);
                actions[action]();
                muted(`♪ ${Music.state().title}`);
            },
        },
        layout: {
            usage: 'layout [tiling|floating]', desc: 'cambia el modo de las ventanas',
            complete: () => ['tiling', 'floating'],
            run([mode]) {
                if (!mode) return print(`modo actual: <span class="t-dir">${Settings.get('layout')}</span>`);
                if (mode !== 'tiling' && mode !== 'floating') return error('layout: usa tiling o floating');
                Settings.set('layout', mode);
            },
        },
        workspace: {
            usage: 'workspace <1-5>', example: 'workspace 2', desc: 'cambia de workspace',
            complete: () => ['1', '2', '3', '4', '5'],
            run([n]) {
                const ws = Number(n);
                if (!Number.isInteger(ws) || ws < 1 || ws > 5) return error('workspace: indica un número del 1 al 5');
                WM.switchTo(ws);
            },
        },
        atajos: {
            desc: 'atajos de teclado',
            run: () => print(grid(KEYBINDS.map(([keys, what]) => [`<span class="t-key">${esc(keys)}</span>`, esc(what)]))),
        },
        history: {
            desc: 'historial de comandos',
            run: () => history.forEach((cmd, i) => print(`<span class="term-muted">${String(i + 1).padStart(4, ' ')}</span>  ${esc(cmd)}`)),
        },
        clear: { desc: 'limpia la pantalla (Ctrl+L)', run: () => { out.innerHTML = ''; } },
        exit: { desc: 'cierra la terminal', run: () => WM.close('terminal') },

        echo: { run: (args) => print(esc(args.join(' '))) },
        pwd: { run: () => print('/home/alessandro') },
        date: { run: () => print(esc(new Date().toLocaleString('es-PE', { dateStyle: 'full', timeStyle: 'medium' }))) },
        uname: { run: (args) => print(args.includes('-a') ? 'Linux auralix 6.9.1-zen1-1-zen #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux' : 'Linux') },
        sudo: { run: () => error(`${PROFILE.user} no está en el archivo sudoers. Este incidente será reportado.`) },
        rm: { run: () => error('rm: sistema de archivos de solo lectura') },
        cd: {
            run([target]) {
                if (!target || target === '~' || target === '/') return;
                const r = resolve(target);
                if (r?.type === 'project') return COMMANDS.open.run([r.project.id]);
                if (r?.type === 'dir') return print(listGroup(r.group));
                error(`cd: ${target}: No existe el archivo o directorio`);
            },
        },
        nvim: {
            run([file]) {
                const app = file ? APP_ALIASES[norm(file)] : 'about';
                if (app) return Actions.openApp(app);
                error(`nvim: ${file}: solo lectura. Prueba: nvim readme.md`);
            },
        },
        htop: {
            run() {
                const rows = PROJECTS.map((p, i) => `${String(100 + i).padStart(5)}  ${PROFILE.user.padEnd(10)}  ${p.status.padEnd(13)}  ${link(`open ${p.id}`, p.id)}`);
                print(`<pre class="term-pre"><span class="term-muted">  PID  USER        ESTADO         PROYECTO</span>\n${rows.join('\n')}</pre>`);
            },
        },
    };

    const ALIASES = {
        ll: 'ls', la: 'ls', dir: 'ls', vim: 'nvim', vi: 'nvim', top: 'htop', ps: 'htop',
        ayuda: 'help', '?': 'help', keys: 'atajos', email: 'contact', contacto: 'contact', ws: 'workspace',
        proyectos: 'ls', projects: 'ls', cls: 'clear',
    };

    // ---------- Ejecución ----------

    function distance(a, b) {
        const row = Array.from({ length: b.length + 1 }, (_, i) => i);
        for (let i = 1; i <= a.length; i++) {
            let prev = row[0];
            row[0] = i;
            for (let j = 1; j <= b.length; j++) {
                const tmp = row[j];
                row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
                prev = tmp;
            }
        }
        return row[b.length];
    }

    function suggest(name) {
        let best = null;
        let bestDistance = 3;
        for (const candidate of [...Object.keys(COMMANDS), ...Object.keys(ALIASES)]) {
            const d = distance(name, candidate);
            if (d < bestDistance) { best = candidate; bestDistance = d; }
        }
        return best;
    }

    function run(line) {
        const raw = line.trim();
        print(prompt(raw));
        if (!raw) return;
        if (history[history.length - 1] !== raw) history.push(raw);
        historyIndex = history.length;

        const [first, ...args] = raw.split(/\s+/);
        const name = norm(first);
        const command = COMMANDS[name] || COMMANDS[ALIASES[name]];
        if (!command) {
            const guess = suggest(name);
            print(`<span class="term-error">comando no encontrado: ${esc(first)}</span>${guess ? ` · ¿quisiste decir ${link(guess)}?` : ''}`);
            return;
        }
        try {
            command.run(args);
        } catch (err) {
            error(`${first}: error inesperado`);
            console.error(err);
        }
    }

    function complete() {
        const value = input.value.replace(/^\s+/, '');
        const parts = value.split(/\s+/);
        const last = parts[parts.length - 1];
        let options;
        if (parts.length === 1) {
            options = Object.keys(COMMANDS).filter((c) => COMMANDS[c].desc);
        } else {
            const command = COMMANDS[norm(parts[0])] || COMMANDS[ALIASES[norm(parts[0])]];
            options = command?.complete ? command.complete() : [];
        }
        const matches = options.filter((o) => o.startsWith(last));
        if (!matches.length) return;
        if (matches.length === 1) {
            parts[parts.length - 1] = matches[0] + (matches[0].endsWith('/') ? '' : ' ');
            input.value = parts.join(' ');
            return;
        }
        let prefix = matches[0];
        for (const m of matches) while (!m.startsWith(prefix)) prefix = prefix.slice(0, -1);
        if (prefix.length > last.length) {
            parts[parts.length - 1] = prefix;
            input.value = parts.join(' ');
            return;
        }
        print(prompt(value));
        print(matches.map(esc).join('  '), 'term-muted');
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const value = input.value;
        input.value = '';
        run(value);
    });

    input.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (e.key === 'Tab') {
            e.preventDefault();
            complete();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) input.value = history[--historyIndex];
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < history.length - 1) input.value = history[++historyIndex];
            else { historyIndex = history.length; input.value = ''; }
        } else if (e.ctrlKey && key === 'l') {
            e.preventDefault();
            out.innerHTML = '';
        } else if (e.ctrlKey && key === 'c' && !window.getSelection().toString() && input.selectionStart === input.selectionEnd) {
            e.preventDefault();
            print(`${prompt(input.value)}^C`);
            input.value = '';
        }
    });

    out.addEventListener('click', (e) => {
        const btn = e.target.closest('.t-link');
        if (btn) run(btn.dataset.cmd);
    });

    // Click en la terminal = foco en el input, salvo que se esté seleccionando texto o pulsando un enlace.
    root.addEventListener('click', (e) => {
        if (!ready || e.target.closest('a, button') || window.getSelection().toString()) return;
        input.focus({ preventScroll: true });
    });

    function boot({ animate }) {
        const command = './init_os.sh && neofetch';
        const finish = () => {
            print(prompt(command));
            print(neofetch());
            print(`Escribe ${link('help')} para ver los comandos o ${link('ls')} para explorar los proyectos.`, 'term-hint');
            form.hidden = false;
            ready = true;
            if (WM.isDesktop() && WM.active === 'terminal') input.focus({ preventScroll: true });
        };
        if (!animate) return finish();

        const line = print(`${prompt()}<span class="tw"></span><span class="tw-cursor" aria-hidden="true"></span>`);
        const typed = $('.tw', line);
        let i = 0;
        const step = () => {
            if (i < command.length) {
                typed.textContent += command[i++];
                setTimeout(step, 38);
            } else {
                setTimeout(() => { line.remove(); finish(); }, 250);
            }
        };
        step();
    }

    return {
        boot,
        run,
        focus() {
            if (ready && WM.isDesktop()) input.focus({ preventScroll: true });
        },
    };
})();
