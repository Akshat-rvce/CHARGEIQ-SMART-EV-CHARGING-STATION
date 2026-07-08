// === MAIN ENGINE ===
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
let W, H;

function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Custom cursor
const cursorGlow = document.getElementById('cursor-glow');
document.addEventListener('mousemove', e => {
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
});

// Background systems
const grid = new GridBackground(W, H);
const ambient = new AmbientParticles(W, H, 80);

// All 8 Scenes
let scenes = [
    new SceneIntro(W, H),
    new SceneDumbVsSmart(W, H),
    new SceneFuzzyLogic(W, H),
    new SceneCCCV(W, H),
    new ScenePWM(W, H),
    new SceneProtection(W, H),
    new SceneSystemFlow(W, H),
    new SceneIoT(W, H)
];
let currentScene = 0;
let transitioning = false;
let transitionAlpha = 0;

// Scene indicators
const dots = document.querySelectorAll('.scene-dot');
function updateDots() {
    dots.forEach((d, i) => {
        d.classList.toggle('active', i === currentScene);
    });
}

function switchScene(index) {
    if (index < 0 || index >= scenes.length || transitioning) return;
    transitioning = true;
    transitionAlpha = 0;
    autoAdvanceTimer = 0;
    const fadeOut = setInterval(() => {
        transitionAlpha += 0.05;
        if (transitionAlpha >= 1) {
            transitionAlpha = 1;
            clearInterval(fadeOut);
            scenes[currentScene].reset();
            currentScene = index;
            scenes[currentScene].reset();
            updateDots();
            const fadeIn = setInterval(() => {
                transitionAlpha -= 0.05;
                if (transitionAlpha <= 0) {
                    transitionAlpha = 0;
                    clearInterval(fadeIn);
                    transitioning = false;
                }
            }, 16);
        }
    }, 16);
}

// Controls
document.getElementById('btn-next').addEventListener('click', () => switchScene(currentScene + 1));
document.getElementById('btn-prev').addEventListener('click', () => switchScene(currentScene - 1));
document.getElementById('btn-replay').addEventListener('click', () => {
    scenes[currentScene].reset();
    autoAdvanceTimer = 0;
});

// Keyboard
document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); switchScene(currentScene + 1); }
    if (e.key === 'ArrowLeft') switchScene(currentScene - 1);
    if (e.key === 'r' || e.key === 'R') { scenes[currentScene].reset(); autoAdvanceTimer = 0; }
});

// Auto-advance timer
let autoAdvanceTimer = 0;

// Scene title overlay
const sceneNames = [
    'INTRODUCTION',
    'DUMB vs SMART CHARGING',
    'FUZZY LOGIC ENGINE',
    'CC-CV CHARGING CURVE',
    'PWM & BUCK CONVERTER',
    'PROTECTION SYSTEM',
    'SYSTEM ARCHITECTURE',
    'IoT CLOUD DASHBOARD'
];

// Main render loop
function render() {
    ctx.clearRect(0, 0, W, H);

    // Deep background with vignette
    const bgGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.7);
    bgGrad.addColorStop(0, '#080818');
    bgGrad.addColorStop(0.6, '#040410');
    bgGrad.addColorStop(1, '#000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Animated grid
    grid.w = W; grid.h = H;
    grid.update();
    grid.draw(ctx);

    // Ambient particles
    ambient.w = W; ambient.h = H;
    ambient.update();
    ambient.draw(ctx);

    // Current scene
    const scene = scenes[currentScene];
    scene.W = W; scene.H = H;
    scene.update();
    scene.draw(ctx);

    // Scene number badge
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#0ff';
    ctx.font = '11px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillText(`${currentScene + 1}/${scenes.length}  ${sceneNames[currentScene]}`, 20, H - 15);
    ctx.restore();

    // Transition overlay
    if (transitionAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = transitionAlpha;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    // Auto-advance is disabled for manual control
    // autoAdvanceTimer++;
    // if (autoAdvanceTimer > scene.duration && !transitioning) {
    //     autoAdvanceTimer = 0;
    //     if (currentScene < scenes.length - 1) {
    //         switchScene(currentScene + 1);
    //     }
    // }

    requestAnimationFrame(render);
}

// Start
updateDots();
render();
