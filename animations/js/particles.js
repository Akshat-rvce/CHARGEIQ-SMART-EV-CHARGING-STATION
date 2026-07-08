// === PARTICLE SYSTEMS ===
class Particle {
    constructor(x, y, opts = {}) {
        this.x = x; this.y = y;
        this.vx = opts.vx || (Math.random() - 0.5) * 2;
        this.vy = opts.vy || (Math.random() - 0.5) * 2;
        this.life = opts.life || 60;
        this.maxLife = this.life;
        this.size = opts.size || 2;
        this.color = opts.color || [0, 255, 255];
        this.gravity = opts.gravity || 0;
        this.friction = opts.friction || 0.99;
        this.glow = opts.glow || 10;
        this.trail = opts.trail || false;
        this.prevX = x; this.prevY = y;
    }
    update() {
        this.prevX = this.x; this.prevY = this.y;
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.life--;
    }
    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        const [r, g, b] = this.color;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (this.trail) {
            ctx.strokeStyle = `rgb(${r},${g},${b})`;
            ctx.lineWidth = this.size * alpha;
            ctx.shadowBlur = this.glow;
            ctx.shadowColor = `rgb(${r},${g},${b})`;
            ctx.beginPath();
            ctx.moveTo(this.prevX, this.prevY);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
        }
        ctx.shadowBlur = this.glow;
        ctx.shadowColor = `rgb(${r},${g},${b})`;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    get dead() { return this.life <= 0; }
}

class ParticleSystem {
    constructor() { this.particles = []; }
    emit(x, y, count, opts) {
        for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, opts));
    }
    update() {
        this.particles = this.particles.filter(p => { p.update(); return !p.dead; });
    }
    draw(ctx) { this.particles.forEach(p => p.draw(ctx)); }
    clear() { this.particles = []; }
}

// Energy stream with bezier curve path
class EnergyStream {
    constructor(x1, y1, x2, y2, opts = {}) {
        this.x1 = x1; this.y1 = y1;
        this.x2 = x2; this.y2 = y2;
        this.color = opts.color || [0, 255, 255];
        this.width = opts.width || 3;
        this.speed = opts.speed || 0.02;
        this.particleCount = opts.particleCount || 15;
        this.active = false;
        this.dots = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.dots.push({ t: i / this.particleCount, speed: this.speed * (0.8 + Math.random() * 0.4), size: 0.7 + Math.random() * 0.6 });
        }
    }
    start() { this.active = true; }
    stop() { this.active = false; }
    setPoints(x1, y1, x2, y2) { this.x1=x1; this.y1=y1; this.x2=x2; this.y2=y2; }
    update() {
        if (!this.active) return;
        this.dots.forEach(d => { d.t += d.speed; if (d.t > 1) d.t -= 1; });
    }
    draw(ctx) {
        if (!this.active) return;
        const [r, g, b] = this.color;
        const mx = (this.x1 + this.x2) / 2;
        const my = (this.y1 + this.y2) / 2 - 15;
        ctx.save();
        // Base path
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 5; ctx.shadowColor = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.quadraticCurveTo(mx, my, this.x2, this.y2);
        ctx.stroke();
        // Flowing dots
        this.dots.forEach(d => {
            const t = d.t;
            const x = (1-t)*(1-t)*this.x1 + 2*(1-t)*t*mx + t*t*this.x2;
            const y = (1-t)*(1-t)*this.y1 + 2*(1-t)*t*my + t*t*this.y2;
            const pulse = 0.7 + Math.sin(t * 6) * 0.3;
            ctx.globalAlpha = pulse;
            ctx.shadowBlur = 12;
            ctx.shadowColor = `rgb(${r},${g},${b})`;
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.beginPath();
            ctx.arc(x, y, this.width * d.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }
}

// Floating grid background
class GridBackground {
    constructor(w, h) {
        this.w = w; this.h = h;
        this.spacing = 50;
        this.offset = 0;
    }
    update() { this.offset = (this.offset + 0.2) % this.spacing; }
    draw(ctx) {
        ctx.save();
        const cx = this.w / 2, cy = this.h / 2;
        for (let x = -this.spacing + this.offset; x < this.w + this.spacing; x += this.spacing) {
            const dist = Math.abs(x - cx) / this.w;
            ctx.strokeStyle = `rgba(0,255,255,${0.06 - dist * 0.05})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.h); ctx.stroke();
        }
        for (let y = -this.spacing + this.offset; y < this.h + this.spacing; y += this.spacing) {
            const dist = Math.abs(y - cy) / this.h;
            ctx.strokeStyle = `rgba(0,255,255,${0.06 - dist * 0.05})`;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke();
        }
        // Intersection dots
        for (let x = -this.spacing + this.offset; x < this.w + this.spacing; x += this.spacing) {
            for (let y = -this.spacing + this.offset; y < this.h + this.spacing; y += this.spacing) {
                const dist = Math.hypot(x - cx, y - cy) / Math.max(this.w, this.h);
                if (dist < 0.5) {
                    ctx.fillStyle = `rgba(0,255,255,${0.12 - dist * 0.2})`;
                    ctx.beginPath();
                    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }
}

// Floating ambient particles
class AmbientParticles {
    constructor(w, h, count) {
        this.dots = [];
        for (let i = 0; i < count; i++) {
            this.dots.push({
                x: Math.random() * w, y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
                size: Math.random() * 2 + 0.4, alpha: Math.random() * 0.5,
                hue: Math.random() < 0.8 ? 180 : 200 + Math.random() * 40
            });
        }
        this.w = w; this.h = h;
    }
    update() {
        this.dots.forEach(d => {
            d.x += d.vx; d.y += d.vy;
            if (d.x < 0) d.x = this.w; if (d.x > this.w) d.x = 0;
            if (d.y < 0) d.y = this.h; if (d.y > this.h) d.y = 0;
            d.alpha = 0.15 + Math.sin(Date.now() * 0.001 + d.x * 0.01) * 0.25;
        });
    }
    draw(ctx) {
        ctx.save();
        this.dots.forEach(d => {
            ctx.globalAlpha = Math.max(0, d.alpha);
            const color = `hsl(${d.hue}, 100%, 70%)`;
            ctx.fillStyle = color;
            ctx.shadowBlur = 8; ctx.shadowColor = color;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }
}

// Spark burst helper
function emitSparkBurst(ps, x, y, count, color, spread) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * (spread || 5);
        ps.emit(x, y, 1, {
            vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
            life: 20 + Math.random() * 20, size: 1 + Math.random() * 2,
            color: color, glow: 15, trail: true, friction: 0.96
        });
    }
}
