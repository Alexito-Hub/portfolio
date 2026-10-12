'use strict';
// Contenido del portfolio. Todo lo editable vive aquí; la lógica está en el resto de js/.

const PROFILE = {
    name: 'Alessandro Villogas',
    user: 'alessandro',
    host: 'auralix',
    email: 'alessandrovillogas@outlook.es',
    github: 'https://github.com/Alexito-Hub',
    studio: 'https://github.com/Auralix-Studio',
    city: 'Huancayo, Perú',
    codingSince: 2022,
};

// Ventanas del escritorio. La clave coincide con data-app en index.html.
const APPS = {
    terminal: { name: 'Terminal', file: 'tty1.sh', label: 'inicio', icon: 'terminal', size: [640, 420], keywords: 'tty shell consola kitty zsh' },
    projects: { name: 'Proyectos', file: 'proyectos/', label: 'proyectos', icon: 'folder-open', size: [880, 580], keywords: 'archivos gestor thunar portfolio repos' },
    about:    { name: 'Sobre mí', file: 'readme.md', label: 'sobre-mi', icon: 'file-text', size: [620, 540], keywords: 'readme nvim bio perfil auralix' },
    stack:    { name: 'Stack', file: 'stack.json', label: 'stack', icon: 'braces', size: [560, 420], keywords: 'skills tecnologias lenguajes json htop' },
    contact:  { name: 'Contacto', file: 'contact.sh', label: 'contacto', icon: 'mail', size: [580, 500], keywords: 'email correo contact freelance' },
    music:    { name: 'Música', file: 'ncmpcpp', label: 'musica', icon: 'music', size: [420, 580], keywords: 'ncmpcpp player reproductor audio canciones' },
};

// Distribución inicial del workspace 1 (árbol dwindle).
// dir 'v' = lado a lado, 'h' = arriba/abajo; ratio = proporción del primer hijo.
const INITIAL_LAYOUT = {
    dir: 'v', ratio: 0.46,
    a: { dir: 'h', ratio: 0.5, a: 'terminal', b: 'about' },
    b: { dir: 'h', ratio: 0.62, a: 'projects', b: 'stack' },
};

const PROJECT_GROUPS = [
    { id: 'auralix-studio', label: 'auralix-studio/' },
    { id: 'alexito-hub', label: 'alexito-hub/' },
];

const PROJECTS = [
    {
        id: 'alma', group: 'auralix-studio', title: 'ALMA', status: 'EN DESARROLLO',
        link: 'https://auralix-studio.github.io/alma/',
        tags: ['Zig', 'Compilador', 'Lenguaje propio', 'VSCode Extension'],
        desc: 'Lenguaje de programación diseñado desde cero por Auralix Studio. Escrito en Zig, apunta a ser completamente independiente de dependencias externas. Incluye su propio lexer, parser, sistema de tipos e intérprete. Cuenta con extensión oficial para Visual Studio Code. Objetivo a largo plazo: auto-hosting.',
        features: [
            'Lexer y parser construidos desde cero, sin dependencias.',
            'Sistema de tipos estático con chequeo en tiempo de compilación.',
            'Extensión oficial de VSCode con resaltado y autocompletado.',
        ],
        commits: [
            ['a1b2c3d', 'fix(parser): resolve ambiguity in unary expressions'],
            ['f9e8d7c', 'feat(lexer): add support for multi-line strings'],
            ['453a12b', 'refactor(types): implement custom type checker in Zig'],
        ],
    },
    {
        id: 'kanso', group: 'auralix-studio', title: 'KANSO', status: 'EN DESARROLLO',
        link: 'https://auralix-studio.github.io/kanso/',
        tags: ['Flutter', 'Dart', 'IA offline', 'llama.cpp', 'Qwen2.5', 'QLoRA', 'GGUF', 'Whisper'],
        desc: 'App de productividad estudiantil minimalista con Lumen, un asistente IA 100% offline. Sin suscripciones ni APIs externas: horarios, tareas, Pomodoro, notas y reproductor de estudio. Lumen usa Qwen2.5 3B GGUF con 28 herramientas locales, tool calling vía gramáticas GBNF, memoria episódica, entrada por voz (Whisper) y procesamiento de documentos (PDF, DOCX, OCR). Se integra con Nexo.',
        features: [
            'Inferencia on-device de Qwen2.5 3B GGUF vía llama.cpp.',
            'Memoria episódica indexada localmente con sqlite-vec.',
            'Tool calling determinista guiado por gramáticas GBNF.',
            'Tareas, Pomodoro y reproductor Lo-Fi integrados.',
        ],
        commits: [
            ['7f8e9d0', 'feat(lumen): integrate Whisper for local speech-to-text'],
            ['1a2b3c4', 'fix(ui): timer state persisting across app restarts'],
            ['9876543', 'perf(db): optimize episodic memory queries with sqlite-vec'],
        ],
    },
    {
        id: 'nexo', group: 'auralix-studio', title: 'NEXO', status: 'EN DESARROLLO',
        link: 'https://auralix-studio.github.io/nexo/',
        image: 'https://raw.githubusercontent.com/Auralix-Studio/nexo-code/7b41a6c42c53afc0dbb9f8decdd56e17fed93935/assets/icon.png',
        tags: ['Flutter', 'Dart', 'Elixir', 'Android', 'iOS', 'REST API', 'UPLA'],
        desc: 'App Flutter que unifica los portales universitarios de la UPLA (SIGMA + Intranet) en una sola interfaz. Accede a horarios de clases, notas con ponderaciones reales y registro de asistencias. Se integra con Kanso para exportar datos directamente al asistente Lumen.',
        features: [
            'Backend proxy en Elixir (Phoenix) para consultar SIGMA de forma rápida.',
            'Cálculo automático de ponderaciones y control de asistencias.',
            'Exportación de datos del semestre hacia Kanso y Lumen.',
        ],
        commits: [
            ['d1c2b3a', 'feat(api): proxy SIGMA responses via Elixir backend'],
            ['a9b8c7d', 'fix(auth): handle expired sessions gracefully'],
            ['4f5e6d7', 'feat(export): payload schema for Kanso integration'],
        ],
    },
    {
        id: 'lumen', group: 'auralix-studio', title: 'LUMEN IA', status: 'EN DESARROLLO',
        link: 'https://auralix-studio.github.io/lumen/',
        tags: ['IA', 'llama.cpp', 'Qwen2.5', 'GGUF', 'QLoRA', 'Fine-tuning', 'Offline', 'GBNF'],
        desc: 'Asistente de inteligencia artificial on-device de Auralix. Qwen2.5 3B GGUF Q4_K_M con inferencia vía llama.cpp directamente en el teléfono. Identidad entrenada en los pesos vía QLoRA sobre 20 000+ ejemplos. Modo thinking siempre activo, 28 herramientas locales y memoria episódica con sqlite-vec. Desarrollado para Kanso.',
        features: [
            'Qwen2.5 3B cuantizado a Q4_K_M para correr en Android.',
            'Fine-tuning QLoRA sobre un dataset de 20 000+ ejemplos.',
            'RAG offline: extracción y vectorización de PDF/DOCX con OCR.',
        ],
        commits: [
            ['e2d3c4b', 'feat(model): quantize to Q4_K_M for Android constraints'],
            ['8a7b6c5', 'fix(gbnf): strict grammar rules for JSON tool calls'],
            ['1234567', 'docs: add training parameters for QLoRA dataset'],
        ],
    },
    {
        id: 'media-keep', group: 'alexito-hub', title: 'MEDIA KEEP', status: 'BETA',
        link: 'https://alexito-hub.github.io/mediakeep/',
        tags: ['Flutter', 'Dart', 'Android', 'TileService', 'API 29-35'],
        desc: 'Descargador multimedia para Android. Detecta enlaces en el portapapeles vía Android TileService y descarga sin abrir la app. Distribuida directamente vía GitHub y GitHub Pages, sin Play Store. Resolvió el rechazo por AccessibilityService reescribiendo la integración a TileService.',
        features: [
            'TileService nativo de Android conectado a Flutter con MethodChannels.',
            'Compatible con las restricciones de segundo plano de Android 10 a 15.',
            'Sin rastreadores ni dependencias de Play Services.',
        ],
        commits: [
            ['b5c6d7e', 'feat(service): migrate from Accessibility to TileService'],
            ['f1e2d3c', 'fix(clipboard): background listener restrictions on API 33+'],
            ['890abcd', 'chore: setup GitHub Pages auto-deploy for APK'],
        ],
    },
    {
        id: 'flux', group: 'alexito-hub', title: 'FLUX', status: 'EN DESARROLLO',
        link: 'https://auralix-studio.github.io/flux/',
        tags: ['Flutter', 'Dart', 'Android'],
        desc: 'Próximo gran proyecto de la suite Auralix. Actualmente iterando en fase de diseño, UX y validación arquitectónica.',
        features: [
            'Framework interno de animaciones fluidas, apuntando a ~120 fps.',
            'Estado desacoplado, sin boilerplate y seguro en memoria.',
        ],
        commits: [
            ['3c4d5e6', 'docs: init project structure and architecture specs'],
        ],
    },
];

const STACK = {
    mobile: ['Flutter', 'Dart'],
    backend: ['Elixir', 'Node.js', 'TypeScript', 'JavaScript'],
    systems: ['Zig', 'Rust', 'C/C++'],
    'ia/llm': ['llama.cpp', 'Qwen2.5', 'GGUF', 'QLoRA'],
    devops: ['Docker', 'Linux (Arch)', 'Git', 'Hyprland'],
    db: ['MongoDB', 'MySQL', 'SQLite', 'sqlite-vec'],
    tools: ['VSCode', 'Termux', 'Arduino'],
};

const PERFIL = [
    'Fundador — Auralix Studio',
    'Full-Stack Engineer',
    'Mobile Developer · Flutter/Dart',
    'Creador de Lumen IA on-device',
    'Ing. Sistemas y Computación — UPLA',
    'Huancayo, Perú',
];

const PLAYLIST = [
    { title: 'Ocean Eyes', artist: 'Billie Eilish', file: 'assets/music/ocean_eyes.mp3' },
    { title: 'Gone, Gone, Gone', artist: 'Phillip Phillips', file: 'assets/music/gone_gone_gone.mp3' },
    { title: 'Riptide', artist: 'Vance Joy', file: 'assets/music/riptide.mp3' },
];

// Fuente única de los atajos: la usan la terminal (`atajos`) y el lanzador.
const KEYBINDS = [
    ['Ctrl+K / Alt+Space', 'abrir el lanzador'],
    ['Alt+1 … Alt+5', 'cambiar de workspace'],
    ['Alt+Shift+1 … 5', 'mover la ventana activa a otro workspace'],
    ['Alt+T / Alt+Enter', 'abrir la terminal'],
    ['Alt+Q', 'cerrar la ventana activa'],
    ['Alt+F', 'maximizar / restaurar la ventana activa'],
    ['Alt+V', 'alternar modo tiling / floating'],
    ['Alt+J / Alt+K', 'enfocar la ventana siguiente / anterior'],
    ['Esc', 'cerrar menús y lanzador'],
];
