// === DRAWING HELPERS ===

function drawGlowText(ctx, text, x, y, size, color, glow, alpha, align) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = color;
    ctx.shadowBlur = glow;
    ctx.shadowColor = color;
    ctx.font = `bold ${size}px Orbitron`;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawGlowTextThin(ctx, text, x, y, size, color, glow, alpha, align) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = color;
    ctx.shadowBlur = glow;
    ctx.shadowColor = color;
    ctx.font = `500 ${size}px Rajdhani`;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
}

// Enhanced EV car with spinning wheels and charge port glow
function drawCar(ctx, x, y, scale, color, glowColor, wheelAngle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const wa = wheelAngle || 0;

    // Shadow underneath
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 55, 120, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body glow
    ctx.shadowBlur = 25;
    ctx.shadowColor = glowColor;

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-110, 30);
    ctx.lineTo(-100, -10);
    ctx.lineTo(-60, -40);
    ctx.lineTo(30, -45);
    ctx.lineTo(70, -30);
    ctx.lineTo(100, -15);
    ctx.lineTo(110, 10);
    ctx.lineTo(110, 30);
    ctx.closePath();
    ctx.fill();

    // Body outline
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Windshield / windows
    ctx.fillStyle = 'rgba(0,200,255,0.3)';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#0af';
    ctx.beginPath();
    ctx.moveTo(-55, -35); ctx.lineTo(-25, -40); ctx.lineTo(-25, -10); ctx.lineTo(-60, -10);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-20, -40); ctx.lineTo(25, -40); ctx.lineTo(60, -25); ctx.lineTo(-20, -10);
    ctx.closePath(); ctx.fill();

    // Headlight beam
    ctx.save();
    const headGrad = ctx.createRadialGradient(115, 0, 0, 115, 0, 50);
    headGrad.addColorStop(0, 'rgba(255,255,220,0.5)');
    headGrad.addColorStop(1, 'rgba(255,255,220,0)');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.moveTo(110, -5); ctx.lineTo(160, -20); ctx.lineTo(160, 20); ctx.lineTo(110, 8);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Headlight
    ctx.fillStyle = '#ffe';
    ctx.shadowBlur = 20; ctx.shadowColor = '#fff';
    ctx.beginPath(); ctx.ellipse(105, 0, 6, 10, 0, 0, Math.PI * 2); ctx.fill();

    // Tail light
    ctx.fillStyle = '#ff2020'; ctx.shadowColor = '#f00'; ctx.shadowBlur = 15;
    ctx.fillRect(-108, -5, 5, 15);

    // Wheels with spinning rims
    ctx.shadowBlur = 0;
    const wPositions = [[-60, 40], [65, 40]];
    wPositions.forEach(([wx, wy]) => {
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(wx, wy, 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(wx, wy, 18, 0, Math.PI * 2); ctx.stroke();
        // Rim spokes
        ctx.strokeStyle = '#777'; ctx.lineWidth = 2;
        for (let s = 0; s < 5; s++) {
            const a = wa + s * Math.PI * 2 / 5;
            ctx.beginPath();
            ctx.moveTo(wx + Math.cos(a) * 4, wy + Math.sin(a) * 4);
            ctx.lineTo(wx + Math.cos(a) * 14, wy + Math.sin(a) * 14);
            ctx.stroke();
        }
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(wx, wy, 5, 0, Math.PI * 2); ctx.fill();
    });

    // Charging port with glow
    ctx.fillStyle = glowColor;
    ctx.shadowBlur = 15; ctx.shadowColor = glowColor;
    ctx.beginPath(); ctx.roundRect(82, 2, 10, 10, 2); ctx.fill();

    ctx.restore();
}

// Enhanced charging station with animated screen
function drawChargingStation(ctx, x, y, scale, color, glowColor, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const tt = t || 0;

    // Base plate
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.roundRect(-35, 45, 70, 12, 3); ctx.fill();

    // Main body
    ctx.fillStyle = '#0d1a2e';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 20; ctx.shadowColor = glowColor;
    ctx.beginPath(); ctx.roundRect(-30, -90, 60, 140, 10); ctx.fill(); ctx.stroke();

    // Screen area
    ctx.fillStyle = '#000a14';
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.roundRect(-22, -75, 44, 35, 4); ctx.fill(); ctx.stroke();

    // Screen content
    ctx.fillStyle = color; ctx.font = '7px Share Tech Mono'; ctx.textAlign = 'center';
    ctx.shadowBlur = 5; ctx.shadowColor = color;
    ctx.fillText('ChargeIQ v2.1', 0, -63);
    ctx.fillStyle = '#39ff14'; ctx.shadowColor = '#39ff14';
    ctx.fillText('SOC: 67%', 0, -52);
    ctx.fillStyle = '#ff9900'; ctx.shadowColor = '#ff9900';
    ctx.fillText('2.4A  28°C', 0, -41);

    // Lightning bolt
    ctx.fillStyle = color; ctx.shadowBlur = 25; ctx.shadowColor = glowColor;
    ctx.font = 'bold 22px Orbitron'; ctx.fillText('⚡', 0, -10);

    // Status LED blinking
    const ledOn = Math.sin(tt * 0.1) > 0;
    ctx.fillStyle = ledOn ? '#39ff14' : '#0a2a0a';
    ctx.shadowBlur = ledOn ? 10 : 0; ctx.shadowColor = '#39ff14';
    ctx.beginPath(); ctx.arc(20, -78, 3, 0, Math.PI * 2); ctx.fill();

    // Cable
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.shadowBlur = 8; ctx.shadowColor = glowColor;
    ctx.beginPath();
    ctx.moveTo(22, 20); ctx.quadraticCurveTo(55, 30, 65, 65); ctx.quadraticCurveTo(75, 95, 55, 105);
    ctx.stroke();
    // Plug
    ctx.fillStyle = color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(55, 105, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(55, 105, 2, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
}

// Enhanced battery with segments and glow
function drawBattery(ctx, x, y, w, h, fillPct, fillColor, borderColor, glow) {
    ctx.save(); ctx.translate(x, y);
    // Terminal
    ctx.fillStyle = borderColor; ctx.shadowBlur = glow || 0; ctx.shadowColor = fillColor;
    ctx.beginPath(); ctx.roundRect(w * 0.3, -10, w * 0.4, 12, 2); ctx.fill();
    // Body
    ctx.strokeStyle = borderColor; ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 6); ctx.fill(); ctx.stroke();
    // Segments background
    const segments = 5;
    for (let i = 0; i < segments; i++) {
        const sy = h - (i + 1) * (h / segments) + 3;
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.beginPath(); ctx.roundRect(4, sy, w - 8, h / segments - 4, 2); ctx.fill();
    }
    // Fill
    const fillH = (h - 6) * (Math.min(100, fillPct) / 100);
    if (fillH > 0) {
        const grad = ctx.createLinearGradient(0, h - fillH, 0, h);
        grad.addColorStop(0, fillColor);
        grad.addColorStop(1, borderColor);
        ctx.fillStyle = grad;
        ctx.shadowBlur = glow || 15; ctx.shadowColor = fillColor;
        ctx.beginPath(); ctx.roundRect(4, h - fillH - 3, w - 8, fillH, 3); ctx.fill();
    }
    // Percentage
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
    ctx.font = `bold ${Math.floor(w * 0.32)}px Orbitron`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(fillPct) + '%', w / 2, h / 2);
    ctx.restore();
}

// Circular gauge
function drawGauge(ctx, x, y, radius, value, max, color, label) {
    ctx.save(); ctx.translate(x, y);
    // Outer ring glow
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI * 0.75, Math.PI * 0.75); ctx.stroke();
    // Background arc
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI * 0.75, Math.PI * 0.75); ctx.stroke();
    // Value arc
    const pct = Math.min(1, value / max);
    const endAngle = -Math.PI * 0.75 + pct * Math.PI * 1.5;
    const grad = ctx.createLinearGradient(-radius, 0, radius, 0);
    grad.addColorStop(0, color === '#0ff' ? '#0088ff' : color);
    grad.addColorStop(1, color);
    ctx.strokeStyle = grad; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.shadowBlur = 18; ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI * 0.75, endAngle); ctx.stroke();
    // Tick marks
    ctx.shadowBlur = 0;
    for (let i = 0; i <= 10; i++) {
        const a = -Math.PI * 0.75 + i * Math.PI * 1.5 / 10;
        const r1 = radius + 5, r2 = radius + (i % 5 === 0 ? 12 : 8);
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = i % 5 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        ctx.stroke();
    }
    // Center value
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
    ctx.font = `bold ${radius * 0.5}px Orbitron`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(value), 0, -6);
    if (label) {
        ctx.font = `${radius * 0.26}px Rajdhani`;
        ctx.fillStyle = color; ctx.fillText(label, 0, radius * 0.38);
    }
    ctx.restore();
}

// Enhanced STM32 board
function drawSTM32Board(ctx, x, y, scale, glowing, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const tt = t || 0;
    
    // PCB (Usually Blue/Teal for STM32 Blue Pill)
    ctx.fillStyle = glowing ? '#002244' : '#001122';
    ctx.strokeStyle = glowing ? '#00d2ff' : '#0066aa';
    ctx.lineWidth = 2; ctx.shadowBlur = glowing ? 30 : 0; ctx.shadowColor = '#00d2ff';
    ctx.beginPath(); ctx.roundRect(-55, -38, 110, 76, 5); ctx.fill(); ctx.stroke();
    
    // Board header pins (Blue Pill style: two long header rows on top & bottom)
    ctx.fillStyle = '#111'; // Header plastic base
    ctx.shadowBlur = 0;
    ctx.fillRect(-48, -32, 96, 4);
    ctx.fillRect(-48, 28, 96, 4);
    
    ctx.fillStyle = '#d4af37'; // Golden pin tips
    for (let i = 0; i < 13; i++) {
        ctx.fillRect(-45 + i * 7.2, -35, 2.5, 3);
        ctx.fillRect(-45 + i * 7.2, 32, 2.5, 3);
    }
    
    // Main STM32 chip (QFP package: square with pins on all 4 sides)
    ctx.fillStyle = '#151515';
    ctx.beginPath(); ctx.roundRect(-16, -16, 32, 32, 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(-16, -16, 32, 32);
    
    // QFP pins on the chip sides
    ctx.fillStyle = '#b5b5b5';
    for (let i = 0; i < 5; i++) {
        const offset = -12 + i * 6;
        // Left
        ctx.fillRect(-20, offset - 0.5, 4, 1.2);
        // Right
        ctx.fillRect(16, offset - 0.5, 4, 1.2);
        // Top
        ctx.fillRect(offset - 0.5, -20, 1.2, 4);
        // Bottom
        ctx.fillRect(offset - 0.5, 16, 1.2, 4);
    }
    
    // Chip label
    ctx.fillStyle = glowing ? '#00d2ff' : '#0077aa';
    ctx.font = '7px Share Tech Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('STM32F103', 0, 0);
    
    // Micro-USB/USB-C port on the left edge
    ctx.fillStyle = '#444'; ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(-58, -9, 8, 18, 2); ctx.fill(); ctx.stroke();
    // Metal connector inside USB
    ctx.fillStyle = '#222';
    ctx.fillRect(-54, -6, 4, 12);
    
    // Reset button (typically yellow/red button on STM32)
    ctx.fillStyle = '#cc3333'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.roundRect(36, 15, 8, 8, 1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(40, 19, 2, 0, Math.PI * 2); ctx.fill();
    
    // Power LED (Red)
    const ledOn = glowing && Math.sin(tt * 0.15) > 0;
    ctx.fillStyle = ledOn ? '#ff3333' : '#440000'; ctx.shadowBlur = ledOn ? 10 : 0; ctx.shadowColor = '#ff3333';
    ctx.beginPath(); ctx.arc(38, -20, 2.5, 0, Math.PI * 2); ctx.fill();
    
    // User LED (PC13 - Blue, blinking)
    const pc13On = glowing && Math.sin(tt * 0.3) > 0;
    ctx.fillStyle = pc13On ? '#00d2ff' : '#002244'; ctx.shadowBlur = pc13On ? 8 : 0; ctx.shadowColor = '#00d2ff';
    ctx.beginPath(); ctx.arc(38, -10, 2.5, 0, Math.PI * 2); ctx.fill();
    
    // Board Label
    ctx.fillStyle = glowing ? '#00d2ff' : '#0077aa'; ctx.shadowBlur = 0;
    ctx.font = 'bold 9px Orbitron'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('STM32', 0, 22);
    ctx.restore();
}

// Enhanced thermometer
function drawThermometer(ctx, x, y, temp, maxTemp) {
    ctx.save(); ctx.translate(x, y);
    const h = 90;
    const pct = Math.min(1, temp / maxTemp);
    const color = temp > 50 ? '#ff2020' : temp > 35 ? '#ff9900' : '#0ff';
    // Glass tube
    ctx.strokeStyle = 'rgba(200,200,200,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-8, 0, 16, h, 8); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(-8, 0, 16, h, 8); ctx.fill();
    // Liquid
    const fillH = pct * (h - 14);
    if (fillH > 0) {
        const grad = ctx.createLinearGradient(0, h - fillH, 0, h);
        grad.addColorStop(0, color); grad.addColorStop(1, '#fff');
        ctx.fillStyle = grad; ctx.shadowBlur = 12; ctx.shadowColor = color;
        ctx.beginPath(); ctx.roundRect(-5, h - fillH - 3, 10, fillH, 3); ctx.fill();
    }
    // Bulb
    ctx.fillStyle = color; ctx.shadowBlur = 15; ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(0, h + 13, 13, 0, Math.PI * 2); ctx.fill();
    // Scale lines
    for (let i = 0; i <= 5; i++) {
        const ly = h - (i / 5) * (h - 14) - 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(8, ly); ctx.lineTo(14, ly); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '7px Share Tech Mono'; ctx.textAlign = 'left';
        ctx.fillText(Math.round(i * maxTemp / 5) + '°', 16, ly + 3);
    }
    ctx.textAlign = 'center';
    // Value
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
    ctx.font = 'bold 13px Orbitron';
    ctx.fillText(Math.round(temp) + '°C', 0, h + 38);
    ctx.restore();
}

// Draw a power MOSFET symbol
function drawMOSFET(ctx, x, y, active, color) {
    ctx.save(); ctx.translate(x, y);
    const c = color || '#ff9900';
    ctx.strokeStyle = active ? c : '#444'; ctx.lineWidth = 2;
    ctx.shadowBlur = active ? 15 : 0; ctx.shadowColor = c;
    // Gate line
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-15, 0); ctx.stroke();
    // Gate bar
    ctx.beginPath(); ctx.moveTo(-15, -15); ctx.lineTo(-15, 15); ctx.stroke();
    // Channel
    ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(-10, 12); ctx.stroke();
    // Drain / Source
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(20, -10); ctx.lineTo(20, -20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(20, 10); ctx.lineTo(20, 20); ctx.stroke();
    // Arrow
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-2, -4); ctx.lineTo(-2, 4); ctx.closePath();
    ctx.fillStyle = active ? c : '#444'; ctx.fill();
    // Label
    ctx.fillStyle = active ? c : '#444'; ctx.font = '8px Share Tech Mono'; ctx.textAlign = 'center';
    ctx.fillText('MOSFET', 0, 30); ctx.shadowBlur = 0;
    ctx.restore();
}

// Draw inductor symbol
function drawInductor(ctx, x, y, w, active, color) {
    ctx.save(); ctx.translate(x, y);
    const c = color || '#ff9900';
    ctx.strokeStyle = active ? c : '#444'; ctx.lineWidth = 2.5;
    ctx.shadowBlur = active ? 12 : 0; ctx.shadowColor = c;
    const loops = 4; const lw = w / loops;
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let i = 0; i < loops; i++) {
        ctx.arc(lw * i + lw / 2, 0, lw / 2, Math.PI, 0, false);
    }
    ctx.stroke();
    ctx.fillStyle = active ? c : '#444'; ctx.font = '8px Share Tech Mono'; ctx.textAlign = 'center';
    ctx.fillText('L', w / 2, 18); ctx.shadowBlur = 0;
    ctx.restore();
}

// Draw capacitor symbol
function drawCapacitor(ctx, x, y, h, active, color) {
    ctx.save(); ctx.translate(x, y);
    const c = color || '#0ff';
    ctx.strokeStyle = active ? c : '#444'; ctx.lineWidth = 2.5;
    ctx.shadowBlur = active ? 12 : 0; ctx.shadowColor = c;
    ctx.beginPath(); ctx.moveTo(0, -h/2); ctx.lineTo(0, -5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, h/2); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-12, -5); ctx.lineTo(12, -5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 5); ctx.lineTo(12, 5); ctx.stroke();
    ctx.fillStyle = active ? c : '#444'; ctx.font = '8px Share Tech Mono'; ctx.textAlign = 'center';
    ctx.fillText('C', 20, 0); ctx.shadowBlur = 0;
    ctx.restore();
}

// Easing
function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
function easeOutQuart(t) { return 1 - Math.pow(1-t, 4); }
function easeOutBounce(t) {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1/d1) return n1*t*t;
    if (t < 2/d1) return n1*(t-=1.5/d1)*t+0.75;
    if (t < 2.5/d1) return n1*(t-=2.25/d1)*t+0.9375;
    return n1*(t-=2.625/d1)*t+0.984375;
}
function lerp(a, b, t) { return a + (b-a)*t; }
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
