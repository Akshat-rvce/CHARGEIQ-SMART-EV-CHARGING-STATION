// CHARGEIQ AI — LANDING PAGE LOGIC

document.addEventListener("DOMContentLoaded", () => {
  initPreloader();
  initIntersectionObserver();
  initParticleCanvas();
  initThreeJsBattery();
  initArchitectureTooltips();
});

/* 1. Terminal Startup Preloader */
function initPreloader() {
  const bar = document.getElementById("preloader-bar");
  const terminal = document.getElementById("preloader-terminal");
  const loader = document.getElementById("preloader");
  
  const bootLogs = [
    "Initializing Sensor Calibration Grids...",
    "Scanning ADCs [GPIO33, GPIO34, GPIO35]... [OK]",
    "Reading Mamdani FIS Membership Configurations...",
    "Compiling 5 Fuzzy Rules... [SUCCESS]",
    "Connecting Express Local WebSocket Server...",
    "Searching for STM32 DevKit Core... [STANDBY]",
    "Running in Local Loop Simulation Mode... [ACTIVE]",
    "System Ready. Launching Dashboard Interface..."
  ];

  let progress = 0;
  let logIndex = 0;

  const progressInterval = setInterval(() => {
    progress += Math.floor(Math.random() * 5) + 3;
    if (progress >= 100) {
      progress = 100;
      clearInterval(progressInterval);
      setTimeout(() => {
        loader.style.opacity = 0;
        setTimeout(() => {
          loader.style.display = "none";
        }, 600);
      }, 500);
    }
    bar.style.width = `${progress}%`;
  }, 50);

  const logInterval = setInterval(() => {
    if (logIndex < bootLogs.length) {
      const line = document.createElement("div");
      line.textContent = `> ${bootLogs[logIndex]}`;
      terminal.appendChild(line);
      terminal.scrollTop = terminal.scrollHeight;
      logIndex++;
    } else {
      clearInterval(logInterval);
    }
  }, 250);
}

/* 2. Scroll Intersections */
function initIntersectionObserver() {
  const elements = document.querySelectorAll(".fade-up-element");
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        
        // Highlight active navigation dots
        const targetSection = entry.target.closest("section");
        if (targetSection) {
          updateActiveDot(targetSection.id);
        }
      }
    });
  }, {
    threshold: 0.15
  });

  elements.forEach(el => observer.observe(el));
}

function updateActiveDot(sectionId) {
  const dots = document.querySelectorAll(".dot");
  dots.forEach(dot => {
    dot.classList.remove("active");
    if (dot.getAttribute("data-target") === sectionId) {
      dot.classList.add("active");
    }
  });
}

// Map scroll highlights to dots
window.addEventListener("scroll", () => {
  const sections = document.querySelectorAll("section");
  const navLinks = document.querySelectorAll(".nav-links a");
  let currentSectionId = "home";

  sections.forEach(sec => {
    const top = window.scrollY;
    const offset = sec.offsetTop - 150;
    const height = sec.offsetHeight;
    if (top >= offset && top < offset + height) {
      currentSectionId = sec.id;
    }
  });

  updateActiveDot(currentSectionId);

  // Update navbar links
  navLinks.forEach(link => {
    link.classList.remove("active");
    const href = link.getAttribute("href");
    if (href === `#${currentSectionId}` || (href === "dashboard.html" && currentSectionId === "dashboard")) {
      link.classList.add("active");
    }
  });
});

/* 3. Hero Particle Drift Canvas */
function initParticleCanvas() {
  const canvas = document.getElementById("hero-particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const particleCount = 120;
  let mouse = { x: null, y: null };

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.x;
    mouse.y = e.y;
  });

  window.addEventListener("mouseout", () => {
    mouse.x = null;
    mouse.y = null;
  });

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.radius = Math.random() * 2 + 1; // 1px to 3px
      this.color = Math.random() > 0.5 ? "rgba(0, 180, 255, 0.3)" : "rgba(0, 255, 136, 0.2)";
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }

    update() {
      // Drift movement
      this.x += this.vx;
      this.y += this.vy;

      // Bounce borders
      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      // Mouse attraction force
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 150) {
          const force = (150 - dist) / 1500;
          this.x += (dx / dist) * force * 1.5;
          this.y += (dy / dist) * force * 1.5;
        }
      }
    }
  }

  // Create particles
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    
    // Update and draw particles
    particles.forEach(p => {
      p.update();
      p.draw();
    });

    // Draw connection lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 100) {
          const alpha = (100 - dist) / 1000 * 0.8;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(0, 180, 255, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();
}

/* 4. Three.js Interactive 3D Battery Cylinder */
function initThreeJsBattery() {
  const container = document.getElementById("battery-3d-canvas");
  if (!container) return;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 8;

  const renderer = new THREE.WebGLRenderer({ canvas: container, alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Resize listener
  window.addEventListener("resize", () => {
    if (!container.clientWidth) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // Battery Group
  const batteryGroup = new THREE.Group();
  scene.add(batteryGroup);

  // Transparent outer casing
  const cylinderGeo = new THREE.CylinderGeometry(1.4, 1.4, 4, 32, 1, true);
  const cylinderMat = new THREE.MeshBasicMaterial({
    color: 0x00B4FF,
    wireframe: true,
    transparent: true,
    opacity: 0.15
  });
  const casingMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
  batteryGroup.add(casingMesh);

  // Outer solid metal caps
  const capGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.2, 32);
  const capMat = new THREE.MeshPhongMaterial({
    color: 0x0b1c28,
    emissive: 0x001122,
    specular: 0x00B4FF,
    shininess: 30
  });
  
  const capTop = new THREE.Mesh(capGeo, capMat);
  capTop.position.y = 2.1;
  const capBottom = new THREE.Mesh(capGeo, capMat);
  capBottom.position.y = -2.1;
  
  // Terminal positive nipple
  const nippleGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
  const nipple = new THREE.Mesh(nippleGeo, capMat);
  nipple.position.y = 2.3;

  batteryGroup.add(capTop);
  batteryGroup.add(capBottom);
  batteryGroup.add(nipple);

  // Charge Flow Particles inside
  const particleCount = 60;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const speeds = [];

  for (let i = 0; i < particleCount; i++) {
    // Random cylindrical coordinates
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 1.1;
    positions[i * 3] = Math.cos(angle) * r; // x
    positions[i * 3 + 1] = (Math.random() - 0.5) * 3.8; // y
    positions[i * 3 + 2] = Math.sin(angle) * r; // z
    speeds.push(Math.random() * 0.02 + 0.01);
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Particle Material (Glowing Green/Cyan spheres)
  const loader = new THREE.TextureLoader();
  const particleMat = new THREE.PointsMaterial({
    color: 0x00FF88,
    size: 0.15,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(particleGeometry, particleMat);
  batteryGroup.add(particleSystem);

  // Inner Core Rod (Glowing Orange/Green wireframe)
  const coreGeo = new THREE.CylinderGeometry(0.4, 0.4, 3.8, 16);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x0066FF,
    wireframe: true,
    transparent: true,
    opacity: 0.4
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  batteryGroup.add(coreMesh);

  // Lights
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  const ambLight = new THREE.AmbientLight(0x0a1122, 0.8);
  scene.add(ambLight);

  // Mouse Movement Reactivity
  let targetRotationX = 0.3;
  let targetRotationY = 0.5;
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    mouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    
    targetRotationY = mouseX * 0.8;
    targetRotationX = mouseY * 0.8 + 0.3;
  });

  // Animation Loop
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Rotate group smoothly toward target
    batteryGroup.rotation.y += (targetRotationY - batteryGroup.rotation.y) * 0.05;
    batteryGroup.rotation.x += (targetRotationX - batteryGroup.rotation.x) * 0.05;

    // Default continuous rotation
    batteryGroup.rotation.y += 0.005;

    // Animate inner charge particles moving upwards
    const positionsAttr = particleGeometry.attributes.position;
    for (let i = 0; i < particleCount; i++) {
      let y = positionsAttr.getY(i);
      y += speeds[i];
      // Reset at top cap
      if (y > 1.9) {
        y = -1.9;
        // randomize radius slightly
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.1;
        positionsAttr.setX(i, Math.cos(angle) * r);
        positionsAttr.setZ(i, Math.sin(angle) * r);
      }
      positionsAttr.setY(i, y);
    }
    positionsAttr.needsUpdate = true;

    // Pulsing Core glow
    const time = clock.getElapsedTime();
    coreMesh.scale.x = 1 + Math.sin(time * 3) * 0.08;
    coreMesh.scale.z = 1 + Math.sin(time * 3) * 0.08;
    coreMat.color.setHex(Math.sin(time) > 0 ? 0x00B4FF : 0x00FF88);

    renderer.render(scene, camera);
  }

  animate();
}

/* 5. Live Architecture Node Hovers */
function initArchitectureTooltips() {
  const nodes = document.querySelectorAll(".arch-node");
  const tooltip = document.getElementById("arch-tooltip");

  nodes.forEach(node => {
    node.addEventListener("mouseenter", () => {
      const desc = node.getAttribute("data-desc");
      tooltip.textContent = desc;
      tooltip.style.borderColor = "var(--accent-cyan)";
      tooltip.style.color = "var(--text-white)";
    });

    node.addEventListener("mouseleave", () => {
      tooltip.textContent = "Hover over an architecture node to inspect telemetry system details.";
      tooltip.style.borderColor = "var(--border-cyan)";
      tooltip.style.color = "var(--text-muted)";
    });
  });
}
