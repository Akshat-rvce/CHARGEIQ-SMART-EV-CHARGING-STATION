// CHARGEIQ AI — TELEMETRY CONTROL ROOM CLIENT LOGIC

let currentMode = "LIVE"; // LIVE or SIMULATION
let socket = null;
let chart = null;
let stm32ConnectionStatus = "STM32_DISCONNECTED";

// SCADA telemetry and connection statistics
let packetsReceived = 0;
let packetsLost = 0;
let physicalPacketCount = 0;
let lastTelemetryTime = null;
let rollingIntervals = [];
let ppsCounter = 0;
let pps = 0;
let connectionStartTime = null;
let serialDurationTimer = null;
let globalCyclesCount = 12;


// Telemetry state binding
let telemetryData = {
  voltage: 4.12,
  current: 0.82,
  temperature: 34,
  soc: 72,
  chargingRate: 3.38,
  mode: "MEDIUM",
  relay: true,
  batteryHealth: 95,
  fault: false,
  timestamp: new Date().toISOString()
};

// Simulation active loop timer
let simInterval = null;
let liveSessionStartTime = Date.now();
let totalEnergyAccumulated = 15.82;
let customConfirmCallback = null;

document.addEventListener("DOMContentLoaded", () => {
  initSocketConnection();
  initChart();
  loadChartHistory();
  initSessionsTable();
  initUptimeCounters();
  
  // Initialize SCADA statistics trackers
  startPpsAndAgeTracker();
  startWatchdogTimer();
  updateAnalytics(); // Seed the historical DB analytics card
  
  // Set default live mode UI
  setMode("LIVE");
  
  // Start polling serial ports
  pollSerialPorts();
  setInterval(pollSerialPorts, 5000);
  
  // Run startup diagnostics sequence
  runStartupDiagnostics();
  
  // Set up dropdown listener
  const comSelector = document.getElementById("com-port-selector");
  if (comSelector) {
    comSelector.addEventListener("change", (e) => {
      const val = e.target.value;
      const payload = val === "AUTO" ? { auto: true } : { port: val, auto: false };
      
      addTerminalLog("INFO", `Selecting COM Port: ${val}`);
      
      fetch('/api/serial/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        addTerminalLog("INFO", `Port selection updated: ${data.message}`);
        showToast("Serial Port", data.message);
      })
      .catch(err => {
        console.error("Error setting serial port:", err);
        addTerminalLog("ERROR", "Failed to communicate port selection to backend.");
      });
    });
  }
});

/* 1. WebSocket Node.js Socket.IO Connector */
function initSocketConnection() {
  updateConnectionStatus("server", "amber");
  updateConnectionStatus("stm32", "amber");
  updateConnectionStatus("database", "amber");

  try {
    // Connect to localhost backend Socket.IO
    socket = io({
      reconnectionAttempts: 5,
      timeout: 3000
    });

    socket.on('connect', () => {
      console.log("WebSocket client link established.");
      updateConnectionStatus("server", "green");
      updateConnectionStatus("socket", "green");
      updateConnectionStatus("database", "green");
      updateConnectionStatus("wifi", "green");
      
      // Stop the local simulation loop since server is connected
      if (simInterval) {
        clearInterval(simInterval);
        simInterval = null;
      }
      
      // Query serial status from server
      fetch('/api/serial/status')
        .then(res => res.json())
        .then(statusData => {
          stm32ConnectionStatus = statusData.status;
          const banner = document.getElementById("stm32-disconnect-banner");
          const stm32Dot = document.getElementById("health-stm32");
          const portLbl = document.getElementById("serial-port-lbl");
          const portName = document.getElementById("serial-port-name");
          const healthTxt = document.getElementById("system-health-txt");
          const linkStatus = document.getElementById("serial-link-status");
          
          if (stm32ConnectionStatus === 'STM32_CONNECTED') {
            if (banner) banner.style.display = 'none';
            if (stm32Dot) stm32Dot.className = "status-dot green";
            if (portLbl) portLbl.textContent = statusData.port;
            if (portName) portName.textContent = statusData.port;
            if (healthTxt) healthTxt.textContent = "LIVE DATA LINK";
            if (linkStatus) {
              linkStatus.textContent = "CONNECTED";
              linkStatus.style.color = "var(--accent-green)";
            }
            if (!connectionStartTime && statusData.uptimeSecs) {
              connectionStartTime = Date.now() - (statusData.uptimeSecs * 1000);
              startDurationTracker();
            }
          } else if (stm32ConnectionStatus === 'STM32_CONNECTING') {
            if (banner) banner.style.display = 'none';
            if (stm32Dot) stm32Dot.className = "status-dot amber";
            if (portLbl) portLbl.textContent = statusData.port || 'CONNECTING';
            if (portName) portName.textContent = statusData.port || 'CONNECTING';
            if (healthTxt) healthTxt.textContent = "CONNECTING STM32...";
            if (linkStatus) {
              linkStatus.textContent = "CONNECTING";
              linkStatus.style.color = "var(--accent-amber)";
            }
          } else {
            if (banner && currentMode === "LIVE") banner.style.display = 'block';
            if (stm32Dot) stm32Dot.className = "status-dot red";
            if (portLbl) portLbl.textContent = 'NONE';
            if (portName) portName.textContent = 'AUTO';
            if (healthTxt) {
              if (currentMode === "LIVE") {
                healthTxt.textContent = "STM32 DISCONNECTED";
              } else {
                healthTxt.textContent = "DEMO MODE ACTIVE";
              }
            }
            if (linkStatus) {
              linkStatus.textContent = "DISCONNECTED";
              linkStatus.style.color = "var(--accent-red)";
            }
            connectionStartTime = null;
            if (serialDurationTimer) {
              clearInterval(serialDurationTimer);
              serialDurationTimer = null;
            }
            const durationEl = document.getElementById("serial-duration");
            if (durationEl) durationEl.textContent = "00:00:00";
          }
          updateDashboardUI();
        })
        .catch(err => console.error(err));
      
      const pingLatency = document.getElementById("ping-latency");
      if (pingLatency) pingLatency.textContent = "8ms";
      
      const discoveryStatus = document.getElementById("discovery-status");
      if (discoveryStatus) {
        discoveryStatus.textContent = "ONLINE";
        discoveryStatus.style.color = "var(--accent-green)";
      }
      
      addTerminalLog("INFO", "Established local host backend socket link.");
      showToast("System Connected", "Dashboard successfully linked to live telemetry backend server.");
    });

    socket.on('stm32_status', (statusData) => {
      console.log("STM32 status update received:", statusData);
      stm32ConnectionStatus = statusData.status;
      
      const banner = document.getElementById("stm32-disconnect-banner");
      const stm32Dot = document.getElementById("health-stm32");
      const portLbl = document.getElementById("serial-port-lbl");
      const portName = document.getElementById("serial-port-name");
      const healthTxt = document.getElementById("system-health-txt");
      
      const linkStatus = document.getElementById("serial-link-status");
      if (stm32ConnectionStatus === 'STM32_CONNECTED') {
        if (banner) banner.style.display = 'none';
        if (stm32Dot) stm32Dot.className = "status-dot green";
        if (portLbl) portLbl.textContent = statusData.port;
        if (portName) portName.textContent = statusData.port;
        if (healthTxt) healthTxt.textContent = "LIVE DATA LINK";
        if (linkStatus) {
          linkStatus.textContent = "CONNECTED";
          linkStatus.style.color = "var(--accent-green)";
        }
        if (!connectionStartTime) {
          connectionStartTime = Date.now();
          startDurationTracker();
        }
      } else if (stm32ConnectionStatus === 'STM32_CONNECTING') {
        if (banner) banner.style.display = 'none';
        if (stm32Dot) stm32Dot.className = "status-dot amber";
        if (portLbl) portLbl.textContent = statusData.port || 'CONNECTING';
        if (portName) portName.textContent = statusData.port || 'CONNECTING';
        if (healthTxt) healthTxt.textContent = "CONNECTING STM32...";
        if (linkStatus) {
          linkStatus.textContent = "CONNECTING";
          linkStatus.style.color = "var(--accent-amber)";
        }
      } else {
        // Disconnected
        if (banner && currentMode === "LIVE") banner.style.display = 'block';
        if (stm32Dot) stm32Dot.className = "status-dot red";
        if (portLbl) portLbl.textContent = 'NONE';
        if (portName) portName.textContent = 'AUTO';
        if (healthTxt) {
          if (currentMode === "LIVE") {
            healthTxt.textContent = "STM32 DISCONNECTED";
          } else {
            healthTxt.textContent = "DEMO MODE ACTIVE";
          }
        }
        if (linkStatus) {
          linkStatus.textContent = "DISCONNECTED";
          linkStatus.style.color = "var(--accent-red)";
        }
        connectionStartTime = null;
        if (serialDurationTimer) {
          clearInterval(serialDurationTimer);
          serialDurationTimer = null;
        }
        const durationEl = document.getElementById("serial-duration");
        if (durationEl) durationEl.textContent = "00:00:00";
      }
      updateDashboardUI();
    });

    socket.on('raw_serial_line', (data) => {
      const term = document.getElementById("serial-monitor-terminal");
      if (term) {
        const line = document.createElement("div");
        line.className = "log-line info";
        line.textContent = `[${data.timestamp}] ${data.line}`;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
        
        // Limit terminal lines
        while (term.children.length > 100) {
          term.removeChild(term.firstChild);
        }
      }

      // Update Last Raw Packet panel with the exact JSON string
      const lastRawPacketEl = document.getElementById("last-raw-packet");
      if (lastRawPacketEl) {
        lastRawPacketEl.textContent = data.line;
      }
      
      // Increment and update packet counter
      physicalPacketCount++;
      const packetCountEl = document.getElementById("raw-packet-count");
      if (packetCountEl) {
        packetCountEl.textContent = physicalPacketCount;
      }
    });

    socket.on('telemetry', (data) => {
      console.log("Socket.IO 'telemetry' event received:", data);
      if (!data) return;

      // Disable all demo/simulation telemetry whenever a valid STM32 packet is received
      if (data.isSimulated === false) {
        if (currentMode !== "LIVE") {
          console.log("Valid physical STM32 packet received. Disabling demo/simulation mode.");
          setMode("LIVE");
        }
        if (stm32ConnectionStatus !== 'STM32_CONNECTED') {
          console.log("STM32 serial connection detected via active telemetry flow.");
          stm32ConnectionStatus = 'STM32_CONNECTED';
          
          const banner = document.getElementById("stm32-disconnect-banner");
          const stm32Dot = document.getElementById("health-stm32");
          const portLbl = document.getElementById("serial-port-lbl");
          const portName = document.getElementById("serial-port-name");
          const healthTxt = document.getElementById("system-health-txt");
          const linkStatus = document.getElementById("serial-link-status");
          
          if (banner) banner.style.display = 'none';
          if (stm32Dot) stm32Dot.className = "status-dot green";
          if (portLbl) portLbl.textContent = data.port || 'COM5';
          if (portName) portName.textContent = data.port || 'COM5';
          if (healthTxt) healthTxt.textContent = "LIVE DATA LINK";
          if (linkStatus) {
            linkStatus.textContent = "CONNECTED";
            linkStatus.style.color = "var(--accent-green)";
          }
        }
      }

      if (currentMode === "LIVE") {
        telemetryData = data;
        updatePacketStats(data);
        updateDashboardUI();
        appendChartData(data);
      }
    });

    socket.on('event_log', (event) => {
      addTerminalLog(event.severity, event.description);
      showToast(event.severity, event.description);
    });

    socket.on('disconnect', () => {
      console.warn("WebSocket client connection dropped.");
      handleSocketOffline();
    });

    socket.on('connect_error', () => {
      handleSocketOffline();
    });

  } catch (err) {
    console.error("Socket.io library client connection failed.", err);
    handleSocketOffline();
  }
}

function handleSocketOffline() {
  updateConnectionStatus("server", "red");
  updateConnectionStatus("stm32", "amber");
  updateConnectionStatus("database", "amber");
  const pingLatency = document.getElementById("ping-latency");
  if (pingLatency) pingLatency.textContent = "--";
  const discoveryStatus = document.getElementById("discovery-status");
  if (discoveryStatus) {
    discoveryStatus.textContent = "OFFLINE DEMO";
    discoveryStatus.style.color = "var(--accent-amber)";
  }

  // If live mode is selected but server is offline, display fallback
  if (currentMode === "LIVE") {
    addTerminalLog("WARNING", "Server offline. Enabling local demo telemetry generator loop.");
    showToast("Offline Fallback", "Live backend link disconnected. Showing simulated data loop.");
    startLocalSimulationEngine();
  }
}

function updateConnectionStatus(node, statusClass) {
  const dot = document.getElementById(`health-${node}`);
  if (dot) {
    dot.className = `status-dot ${statusClass}`;
  }
}

/* 2. Unified Dashboard UI Updating */
function updateDashboardUI() {
  // Update raw JSON inspector
  const jsonInspector = document.getElementById("raw-json-inspector");
  if (jsonInspector) {
    jsonInspector.textContent = JSON.stringify(telemetryData, null, 2);
  }

  // Toggle Operating Mode badge
  const badgeLive = document.getElementById("mode-badge-live");
  const badgeDemo = document.getElementById("mode-badge-demo");
  if (badgeLive && badgeDemo) {
    if (currentMode === "LIVE" && stm32ConnectionStatus === "STM32_CONNECTED") {
      badgeLive.style.display = "flex";
      badgeDemo.style.display = "none";
    } else {
      badgeLive.style.display = "none";
      badgeDemo.style.display = "flex";
    }
  }

  // Update gauges
  updateSvgGauge("soc", telemetryData.soc, 100);
  updateSvgGauge("temp", telemetryData.temperature, 80);
  
  // Power card calculation
  const calculatedPower = Math.round((telemetryData.voltage * telemetryData.current) * 100) / 100;
  document.getElementById("twin-watts-txt").textContent = `${calculatedPower} W`;

  // Mode display card
  const modeTxt = document.getElementById("mode-display-txt");
  const modeSub = document.getElementById("mode-display-sub");
  modeTxt.textContent = `${telemetryData.mode} ${telemetryData.mode === 'STOP' ? '⚠' : '⚡'}`;
  
  // Dynamic color adjustments based on active charging state
  if (telemetryData.mode === "FAST") {
    modeTxt.style.color = "var(--accent-cyan)";
    modeTxt.style.textShadow = "0 0 20px rgba(0, 180, 255, 0.4)";
  } else if (telemetryData.mode === "MEDIUM") {
    modeTxt.style.color = "var(--accent-green)";
    modeTxt.style.textShadow = "0 0 20px rgba(0, 255, 136, 0.4)";
  } else if (telemetryData.mode === "SLOW") {
    modeTxt.style.color = "var(--accent-purple)";
    modeTxt.style.textShadow = "0 0 20px rgba(155, 93, 229, 0.4)";
  } else if (telemetryData.mode === "FULL") {
    modeTxt.style.color = "var(--accent-green)";
    modeTxt.style.textShadow = "0 0 20px rgba(0, 255, 136, 0.5)";
    modeTxt.textContent = "FULL 🔋";
  } else {
    modeTxt.style.color = "var(--accent-red)";
    modeTxt.style.textShadow = "0 0 20px rgba(255, 48, 96, 0.4)";
  }
  
  modeSub.textContent = telemetryData.relay ? "Relay Path: ENGAGED (ON)" : "Relay Path: DISCONNECTED (OFF)";
  
  // Tickers
  document.getElementById("ticker-soc").textContent = `BATTERY SOC: ${telemetryData.soc} %`;
  document.getElementById("ticker-temp").textContent = `CELL TEMP: ${telemetryData.temperature} °C`;
  document.getElementById("ticker-mode").textContent = `MODE: ${telemetryData.mode}`;

  // Time logs
  const now = new Date();
  document.getElementById("last-msg-time").textContent = now.toTimeString().split(' ')[0];

  // Digital Twin schematic elements
  document.getElementById("twin-volts-lbl").textContent = `${telemetryData.voltage}V`;
  document.getElementById("twin-amps-lbl").textContent = `${telemetryData.current}A`;
  document.getElementById("twin-soc-lbl").textContent = `${telemetryData.soc}%`;
  document.getElementById("twin-temp-lbl").textContent = `${telemetryData.temperature}°C`;
  document.getElementById("twin-relay-lbl").textContent = telemetryData.relay ? "CLOSED" : "OPEN";
  
  // Highlight active digital twin flow paths
  const wire1 = document.getElementById("twin-wire-1");
  const relayNode = document.getElementById("twin-relay-rect");
  const tempNode = document.getElementById("twin-temp-rect");
  const btnRelay = document.getElementById("btn-relay");

  const isFlowActive = telemetryData.relay && 
                       telemetryData.mode !== "STOP" && 
                       telemetryData.mode !== "FULL" && 
                       telemetryData.temperature < 50;

  if (isFlowActive) {
    if (wire1) wire1.classList.add("active");
    if (relayNode) {
      relayNode.style.fill = "rgba(0, 255, 136, 0.1)";
      relayNode.style.stroke = "var(--accent-green)";
    }
    if (btnRelay) btnRelay.textContent = "🔌 Relay ON";
  } else {
    if (wire1) wire1.classList.remove("active");
    if (relayNode) {
      relayNode.style.fill = "rgba(255, 48, 96, 0.1)";
      relayNode.style.stroke = "var(--accent-red)";
    }
    if (btnRelay) btnRelay.textContent = "🔌 Relay OFF";
  }

  if (telemetryData.temperature > 44) {
    if (tempNode) {
      tempNode.style.fill = "rgba(255, 48, 96, 0.2)";
      tempNode.style.stroke = "var(--accent-red)";
      tempNode.style.animation = "red-pulsing 1s infinite";
    }
  } else {
    if (tempNode) {
      tempNode.style.fill = "rgba(8, 20, 40, 0.6)";
      tempNode.style.stroke = "var(--border-cyan)";
      tempNode.style.animation = "none";
    }
  }

  // Update battery state badge and description
  const batteryBadge = document.getElementById("battery-status-badge");
  const batteryDesc = document.getElementById("battery-status-desc");
  if (batteryBadge && batteryDesc) {
    batteryBadge.className = "";
    if (currentMode === "LIVE" && stm32ConnectionStatus !== 'STM32_CONNECTED') {
      batteryBadge.classList.add("battery-badge-disconnected");
      batteryBadge.textContent = "DISCONNECTED";
      batteryDesc.textContent = "Waiting for STM32 serial link...";
    } else if (telemetryData.temperature >= 50) {
      batteryBadge.classList.add("battery-badge-overheat");
      batteryBadge.textContent = "OVERHEAT ⚠️";
      batteryDesc.textContent = `Safety Shutdown: Cell temperature ${telemetryData.temperature}°C >= 50°C!`;
    } else if (telemetryData.temperature >= 45) {
      batteryBadge.classList.add("battery-badge-warning");
      batteryBadge.textContent = "WARNING ⚠️";
      batteryDesc.textContent = `High cell temp (${telemetryData.temperature}°C). Current throttled.`;
    } else if (telemetryData.mode === "FULL" || telemetryData.soc >= 95) {
      batteryBadge.classList.add("battery-badge-full");
      batteryBadge.textContent = "FULL 🔋";
      batteryDesc.textContent = "Battery fully charged. Charging cycle complete.";
    } else if (telemetryData.relay && (telemetryData.mode === "FAST" || telemetryData.mode === "MEDIUM" || telemetryData.mode === "SLOW")) {
      batteryBadge.classList.add("battery-badge-charging");
      batteryBadge.textContent = "CHARGING ⚡";
      batteryDesc.textContent = `Fuzzy engine active. Charging at ${telemetryData.current} A.`;
    } else {
      batteryBadge.classList.add("battery-badge-disconnected");
      batteryBadge.textContent = "STANDBY 💤";
      batteryDesc.textContent = "Circuit open. System in standby mode.";
    }
  }

  // Update hardware sensor registry indicators
  const sVolt = document.getElementById("status-volt-sensor");
  const sCurr = document.getElementById("status-curr-sensor");
  const sTemp = document.getElementById("status-temp-sensor");
  const sRelay = document.getElementById("status-relay");
  const sLcd = document.getElementById("status-lcd");
  const sBuzzer = document.getElementById("status-buzzer");
  const sLeds = document.getElementById("status-leds");

  const setDot = (el, status) => {
    if (el) el.className = `status-dot ${status}`;
  };

  if (currentMode === "LIVE" && stm32ConnectionStatus !== 'STM32_CONNECTED') {
    setDot(sVolt, "red");
    setDot(sCurr, "red");
    setDot(sTemp, "red");
    setDot(sRelay, "red");
    setDot(sLcd, "red");
    setDot(sBuzzer, "red");
    setDot(sLeds, "red");
  } else {
    // Volt sensor nominal or fault
    if (telemetryData.voltage <= 0 && telemetryData.relay) {
      setDot(sVolt, "red");
    } else {
      setDot(sVolt, "green");
    }
    // ACS712 nominal or fault
    if (telemetryData.current < 0 || telemetryData.current > 2.0) {
      setDot(sCurr, "red");
    } else {
      setDot(sCurr, "green");
    }
    // NTC nominal or fault
    if (telemetryData.temperature >= 50) {
      setDot(sTemp, "red");
    } else if (telemetryData.temperature >= 45) {
      setDot(sTemp, "amber");
    } else {
      setDot(sTemp, "green");
    }
    // Safety Relay
    if (telemetryData.relay) {
      setDot(sRelay, "green");
    } else {
      setDot(sRelay, "amber");
    }
    // LCD 16x2
    setDot(sLcd, "green");
    // Piezo Buzzer
    if (telemetryData.temperature >= 45 || telemetryData.mode === "FULL" || telemetryData.mode === "STOP") {
      setDot(sBuzzer, "amber");
    } else {
      setDot(sBuzzer, "green");
    }
    // RGB LEDs
    setDot(sLeds, "green");
  }

  // Calculate and update health score
  let healthScore = 0;
  const isEspOnline = (currentMode === "SIMULATION") || (stm32ConnectionStatus === 'STM32_CONNECTED');

  if (isEspOnline) {
    healthScore += 40;
    
    if (telemetryData.temperature < 45) {
      healthScore += 20;
    } else if (telemetryData.temperature < 50) {
      healthScore += 10;
    }
    
    let sensorFaults = 0;
    if (telemetryData.voltage <= 0 && telemetryData.relay) sensorFaults++;
    if (telemetryData.current < 0 || telemetryData.current > 2.0) sensorFaults++;
    if (telemetryData.temperature >= 50) sensorFaults++;
    
    if (sensorFaults === 0) {
      healthScore += 20;
    } else if (sensorFaults === 1) {
      healthScore += 10;
    }
    
    healthScore += 10; // relay nominal
    healthScore += 10; // comm latency nominal
  } else {
    healthScore = 0;
  }

  const scoreValEl = document.getElementById("health-score-val");
  const scoreBarEl = document.getElementById("health-score-bar");
  if (scoreValEl && scoreBarEl) {
    scoreValEl.textContent = `${healthScore}%`;
    scoreBarEl.style.width = `${healthScore}%`;
    
    if (healthScore >= 80) {
      scoreValEl.style.color = "var(--accent-green)";
      scoreValEl.style.textShadow = "0 0 10px rgba(0, 255, 136, 0.3)";
      scoreBarEl.style.backgroundColor = "var(--accent-green)";
    } else if (healthScore >= 50) {
      scoreValEl.style.color = "var(--accent-amber)";
      scoreValEl.style.textShadow = "0 0 10px rgba(255, 184, 0, 0.3)";
      scoreBarEl.style.backgroundColor = "var(--accent-amber)";
    } else {
      scoreValEl.style.color = "var(--accent-red)";
      scoreValEl.style.textShadow = "0 0 10px rgba(255, 48, 96, 0.3)";
      scoreBarEl.style.backgroundColor = "var(--accent-red)";
    }
  }

  // Digital Twin specific components update
  const lcdLine1 = document.getElementById("twin-lcd-line1");
  const lcdLine2 = document.getElementById("twin-lcd-line2");
  if (lcdLine1 && lcdLine2) {
    if (currentMode === "LIVE" && stm32ConnectionStatus !== 'STM32_CONNECTED') {
      lcdLine1.textContent = "CONN LOST...";
      lcdLine2.textContent = "SCANNING PORT";
    } else if (telemetryData.temperature >= 50) {
      lcdLine1.textContent = "OVERHEAT SHUTDOWN";
      lcdLine2.textContent = `TEMP: ${telemetryData.temperature}C`;
    } else if (telemetryData.mode === "FULL") {
      lcdLine1.textContent = "BATTERY FULL";
      lcdLine2.textContent = "SOC: 100%";
    } else if (telemetryData.mode === "STOP") {
      lcdLine1.textContent = "SYSTEM STOPPED";
      lcdLine2.textContent = `SOC: ${telemetryData.soc}%`;
    } else {
      lcdLine1.textContent = `SOC: ${telemetryData.soc}%  ${telemetryData.mode}`;
      lcdLine2.textContent = `V:${telemetryData.voltage.toFixed(2)}V  I:${telemetryData.current.toFixed(2)}A`;
    }
  }

  const btnCap = document.getElementById("twin-btn-cap");
  if (btnCap) {
    if (telemetryData.relay) {
      btnCap.style.fill = "var(--accent-green)";
    } else {
      btnCap.style.fill = "var(--accent-red)";
    }
  }

  const buzzerCircle = document.getElementById("twin-buzzer-circle");
  if (buzzerCircle) {
    if (telemetryData.temperature >= 45 || telemetryData.mode === "FULL" || telemetryData.mode === "STOP") {
      buzzerCircle.style.animation = "pulse-ring 1.8s infinite";
      buzzerCircle.style.stroke = "var(--accent-amber)";
    } else {
      buzzerCircle.style.animation = "none";
      buzzerCircle.style.stroke = "var(--border-cyan)";
    }
  }

  const ledRed = document.getElementById("twin-led-red");
  const ledGreen = document.getElementById("twin-led-green");
  const ledBlue = document.getElementById("twin-led-blue");
  if (ledRed && ledGreen && ledBlue) {
    if (currentMode === "LIVE" && stm32ConnectionStatus !== 'STM32_CONNECTED') {
      ledRed.style.fill = "#1a0508";
      ledGreen.style.fill = "#051a08";
      ledBlue.style.fill = "#05081a";
    } else if (telemetryData.temperature >= 50 || telemetryData.mode === "STOP") {
      ledRed.style.fill = "var(--accent-red)";
      ledGreen.style.fill = "#051a08";
      ledBlue.style.fill = "#05081a";
    } else if (telemetryData.mode === "FULL") {
      ledRed.style.fill = "#1a0508";
      ledGreen.style.fill = "var(--accent-green)";
      ledBlue.style.fill = "#05081a";
    } else if (telemetryData.relay) {
      ledRed.style.fill = "#1a0508";
      ledGreen.style.fill = "#051a08";
      ledBlue.style.fill = "var(--accent-blue)";
    } else {
      ledRed.style.fill = "#1a0508";
      ledGreen.style.fill = "var(--accent-green)";
      ledBlue.style.fill = "#05081a";
    }
  }

  // Update KPI counters
  totalEnergyAccumulated += (calculatedPower / 3600); // incrementally sum Energy Wh
  document.getElementById("kpi-energy").textContent = (Math.round(totalEnergyAccumulated * 100) / 100).toFixed(2);
  document.getElementById("kpi-cost").textContent = `₹ ${(totalEnergyAccumulated * 0.12).toFixed(2)}`;
  document.getElementById("kpi-carbon").textContent = (Math.round(totalEnergyAccumulated * 0.78 * 10) / 10).toFixed(1);

  // Calculate session metrics and ETA
  updateSessionSummaryAndEta(calculatedPower);

  // Update State of Health metrics
  updateSohMetrics(globalCyclesCount);

  // Compute fuzzy logic memberships activation and draw bars
  runFuzzyLogicCentroidComputation(telemetryData.soc, telemetryData.temperature);
}

function updateSvgGauge(gaugeId, value, maxVal) {
  const fillElement = document.getElementById(`gauge-fill-${gaugeId}`);
  const txtElement = document.getElementById(`gauge-txt-${gaugeId}`);
  if (!fillElement || !txtElement) return;

  const percentage = Math.min(100, Math.max(0, (value / maxVal) * 100));
  // Circle circumference is 2 * PI * r = 2 * Math.PI * 55 = 345.57
  const circumference = 345.57;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  fillElement.style.strokeDasharray = circumference;
  fillElement.style.strokeDashoffset = strokeDashoffset;
  
  txtElement.textContent = gaugeId === 'soc' ? `${value}%` : `${value}°C`;

  // Gauge colors
  if (gaugeId === 'temp') {
    if (value > 45) {
      fillElement.style.stroke = "var(--accent-red)";
    } else if (value > 38) {
      fillElement.style.stroke = "var(--accent-amber)";
    } else {
      fillElement.style.stroke = "var(--accent-green)";
    }
  }
}

/* 3. Mamdani Fuzzy Inference Controller Calculations (JS Replicated Engine) */
function runFuzzyLogicCentroidComputation(soc, temp) {
  // 1. Fuzzification membership logic
  // Membership SoC [Low, Med, High]
  const mu_soc_low = trapmf(soc, [0, 0, 35, 55]);
  const mu_soc_med = trimf(soc, [35, 55, 75]);
  const mu_soc_high = trapmf(soc, [60, 80, 100, 100]);

  // Membership Temp [Cool, Normal, Hot]
  const mu_temp_cool = trapmf(temp, [0, 0, 15, 25]);
  const mu_temp_normal = trimf(temp, [15, 30, 45]);
  const mu_temp_hot = trapmf(temp, [35, 48, 100, 100]);

  // Update membership activation bars on UI
  updateFuzzyBar("soc-low", mu_soc_low);
  updateFuzzyBar("soc-med", mu_soc_med);
  updateFuzzyBar("soc-high", mu_soc_high);
  updateFuzzyBar("temp-cool", mu_temp_cool);
  updateFuzzyBar("temp-norm", mu_temp_normal);
  updateFuzzyBar("temp-hot", mu_temp_hot);

  // 2. Fuzzy Rules & Inference Logic
  // Rule 1: IF Temp = Hot ➔ Current = Stop (0.0A)
  const w1 = mu_temp_hot;
  
  // Rule 2: IF SoC = High AND Temp = Normal ➔ Current = Slow (0.4A)
  const w2 = Math.min(mu_soc_high, mu_temp_normal);

  // Rule 3: IF SoC = Medium AND Temp = Normal ➔ Current = Medium (0.8A)
  const w3 = Math.min(mu_soc_med, mu_temp_normal);

  // Rule 4: IF SoC = Low AND Temp = Normal ➔ Current = Fast (1.5A)
  const w4 = Math.min(mu_soc_low, mu_temp_normal);

  // Rule 5: IF Temp = Cool AND SoC = Low ➔ Current = Medium (0.8A)
  const w5 = Math.min(mu_temp_cool, mu_soc_low);

  // Centroid defuzzification logic mapping discrete outcomes
  const sumWeights = w1 + w2 + w3 + w4 + w5;
  let finalCurrentVal = 0.0;
  
  if (sumWeights > 0) {
    // centroid equation calculation
    finalCurrentVal = (w1 * 0.0 + w2 * 0.4 + w3 * 0.8 + w4 * 1.5 + w5 * 0.8) / sumWeights;
  }
  
  finalCurrentVal = Math.round(finalCurrentVal * 100) / 100;

  // AI Decision explainer mapping
  let explainerText = `Fuzzy inputs evaluated: SoC = ${soc}%, Temperature = ${temp}°C. `;
  
  if (temp >= 45) {
    explainerText += `CRITICAL WARNING: Cell temp ${temp}°C exceeded maximum safety threshold. Rule 1 triggered: Force Relay cut-off (STOP Mode).`;
  } else if (soc >= 95) {
    explainerText += `FULL CHARGE DETECTED: SoC reached ${soc}%. Charging deactivated automatically to protect cell health.`;
  } else {
    explainerText += `Fuzzy Inference Centroid Output current calculated: ${finalCurrentVal}A. `;
    if (w4 > 0.4) explainerText += `State: Low SoC & Normal Temp. Mode FAST active.`;
    else if (w3 > 0.4) explainerText += `State: Medium SoC & Normal Temp. Mode MEDIUM active.`;
    else if (w2 > 0.4) explainerText += `State: High SoC. Throttling current to SLOW to optimize battery cycle life.`;
  }
  
  document.getElementById("fuzzy-explainer-txt").textContent = explainerText;
}

function updateFuzzyBar(barId, val) {
  const bar = document.getElementById(`f-${barId}`);
  const label = document.getElementById(`f-${barId}-val`);
  if (bar && label) {
    const pct = Math.round(val * 100);
    bar.style.width = `${pct}%`;
    label.textContent = val.toFixed(2);
  }
}

// Membership curve calculation helpers
function trimf(x, [a, b, c]) {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  if (x > b && x < c) return (c - x) / (c - b);
  return 0;
}

function trapmf(x, [a, b, c, d]) {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  if (x > c && x < d) return (d - x) / (d - c);
  return 0;
}

/* 4. Chart.js Graph Logging */
function initChart() {
  const ctx = document.getElementById("telemetry-chart").getContext("2d");
  
  const initialLabels = Array.from({length: 60}, (_, i) => `${60 - i}s ago`);
  const initialData = Array.from({length: 60}, () => null);

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: initialLabels,
      datasets: [
        {
          label: 'SoC (%)',
          borderColor: '#00B4FF',
          backgroundColor: 'rgba(0, 180, 255, 0.05)',
          borderWidth: 2,
          data: [...initialData],
          yAxisID: 'y'
        },
        {
          label: 'Temperature (°C)',
          borderColor: '#FFB800',
          backgroundColor: 'rgba(255, 184, 0, 0.05)',
          borderWidth: 2,
          data: [...initialData],
          yAxisID: 'y1'
        },
        {
          label: 'Current (A)',
          borderColor: '#9B5DE5',
          backgroundColor: 'rgba(155, 93, 229, 0.05)',
          borderWidth: 2,
          data: [...initialData],
          yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Share Tech Mono', size: 9 }, color: '#4A6A8A' }
        },
        y: {
          position: 'left',
          min: 0,
          max: 100,
          grid: { color: 'rgba(0, 180, 255, 0.03)' },
          ticks: { font: { family: 'Share Tech Mono', size: 9 }, color: '#00B4FF' }
        },
        y1: {
          position: 'right',
          min: 0,
          max: 80,
          grid: { display: false },
          ticks: { font: { family: 'Share Tech Mono', size: 9 }, color: '#FFB800' }
        },
        y2: {
          position: 'right',
          min: 0,
          max: 2,
          grid: { display: false },
          ticks: { font: { family: 'Share Tech Mono', size: 9 }, color: '#9B5DE5' }
        }
      },
      plugins: {
        legend: {
          labels: { font: { family: 'Rajdhani', size: 12 }, color: '#E8F4FF' }
        }
      }
    }
  });
}

function loadChartHistory() {
  fetch('/api/history?limit=60')
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0 && chart) {
        // Clear initial null data
        chart.data.datasets[0].data = [];
        chart.data.datasets[1].data = [];
        chart.data.datasets[2].data = [];
        
        data.forEach(item => {
          chart.data.datasets[0].data.push(item.soc);
          chart.data.datasets[1].data.push(item.temperature);
          chart.data.datasets[2].data.push(item.current);
        });
        
        chart.update();
        addTerminalLog("INFO", "Historical telemetry chart data loaded.");
      }
    })
    .catch(err => {
      console.log("History endpoint offline or failed. Showing empty chart.", err);
    });
}

function appendChartData(data) {
  if (!chart) return;
  
  // Push new point
  chart.data.datasets[0].data.push(data.soc);
  chart.data.datasets[1].data.push(data.temperature);
  chart.data.datasets[2].data.push(data.current);

  // Shift if window is full
  if (chart.data.datasets[0].data.length > 60) {
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.shift();
    chart.data.datasets[2].data.shift();
  }

  chart.update('none'); // silent update
}

/* 5. Demo Fallback Telemetry Engine Loop */
function startLocalSimulationEngine() {
  if (simInterval) clearInterval(simInterval);
  
  addTerminalLog("INFO", "Initialized local demo simulation engine loop.");

  simInterval = setInterval(() => {
    // Generate simulated voltage and current curves based on SoC
    if (currentMode === "SIMULATION") return; // Sliders are overriding

    // Slowly increment SoC
    let soc = telemetryData.soc;
    let temp = telemetryData.temperature;
    let relay = telemetryData.relay;
    
    if (soc >= 95) {
      relay = false;
      telemetryData.mode = "FULL";
      telemetryData.current = 0.0;
    } else if (temp > 45) {
      relay = false;
      telemetryData.mode = "STOP";
      telemetryData.current = 0.0;
    } else {
      relay = true;
      if (soc < 65 && temp < 38) {
        telemetryData.mode = "FAST";
        telemetryData.current = 1.50;
      } else if (soc >= 80 || temp >= 40) {
        telemetryData.mode = "SLOW";
        telemetryData.current = 0.40;
      } else {
        telemetryData.mode = "MEDIUM";
        telemetryData.current = 0.82;
      }
    }

    if (relay) {
      if (telemetryData.mode === "FAST") temp += 0.2;
      else if (telemetryData.mode === "MEDIUM") temp += 0.08;
      else temp -= 0.05;

      soc = Math.min(100, soc + 1);
    } else {
      temp = Math.max(26, temp - 0.15);
    }

    telemetryData.soc = soc;
    telemetryData.temperature = Math.round(temp * 10) / 10;
    telemetryData.voltage = Math.round((3.2 + (soc / 100) * 1.0) * 100) / 100;
    telemetryData.relay = relay;
    
    updateDashboardUI();
    appendChartData(telemetryData);
  }, 1000);
}

function setMode(mode) {
  currentMode = mode;
  const liveBtn = document.getElementById("mode-live");
  const simBtn = document.getElementById("mode-sim");
  const simPanel = document.getElementById("sim-controls-panel");
  const livePanel = document.getElementById("live-connection-manager-panel");

  if (mode === "LIVE") {
    liveBtn.classList.add("active");
    simBtn.classList.remove("active");
    simPanel.style.display = "none";
    livePanel.style.display = "block";
    addTerminalLog("INFO", "Operating mode toggled to: LIVE TELEMETRY.");
    
    // Resume socket link or simulation fallback loop
    if (socket && socket.connected) {
      clearInterval(simInterval);
    } else {
      startLocalSimulationEngine();
    }
  } else {
    liveBtn.classList.remove("active");
    simBtn.classList.add("active");
    simPanel.style.display = "block";
    livePanel.style.display = "none";
    clearInterval(simInterval);
    addTerminalLog("INFO", "Operating mode toggled to: MANUAL SIMULATION SLIDERS OVERRIDE.");
    simUpdate();
  }
}

function simUpdate() {
  if (currentMode !== "SIMULATION") return;

  const volts = parseFloat(document.getElementById("range-volts").value);
  const amps = parseFloat(document.getElementById("range-amps").value);
  const temp = parseInt(document.getElementById("range-temp").value);
  const soc = parseInt(document.getElementById("range-soc").value);

  document.getElementById("val-volts").textContent = `${volts.toFixed(2)} V`;
  document.getElementById("val-amps").textContent = `${amps.toFixed(2)} A`;
  document.getElementById("val-temp").textContent = `${temp} °C`;
  document.getElementById("val-soc").textContent = `${soc} %`;

  // Dynamically assign simulation states
  let mode = "MEDIUM";
  let relay = true;

  if (soc >= 95) {
    mode = "FULL";
    relay = false;
  } else if (temp > 45) {
    mode = "STOP";
    relay = false;
  } else {
    if (soc < 65 && temp < 38) mode = "FAST";
    else if (soc >= 80 || temp >= 40) mode = "SLOW";
    else mode = "MEDIUM";
    relay = amps > 0;
  }

  telemetryData = {
    voltage: volts,
    current: amps,
    temperature: temp,
    soc: soc,
    mode: mode,
    relay: relay,
    batteryHealth: 95,
    fault: temp > 47,
    timestamp: new Date().toISOString()
  };

  updateDashboardUI();
  appendChartData(telemetryData);
}

/* 6. Remote Commands POST Callbacks */
function getButtonForCommand(command) {
  const buttons = document.querySelectorAll(".control-btn, #btn-relay");
  for (const btn of buttons) {
    const text = btn.textContent.toLowerCase();
    if (command === 'START' && text.includes('start')) return btn;
    if (command === 'STOP' && text.includes('stop') && !text.includes('emergency')) return btn;
    if (command === 'RESET' && text.includes('reset')) return btn;
    if (command === 'EMERGENCY_STOP' && text.includes('emergency')) return btn;
  }
  return null;
}

function triggerControl(command) {
  addTerminalLog("INFO", `Sending control command: ${command} to charging backend...`);
  
  const btn = getButtonForCommand(command);
  let originalHtml = "";
  if (btn) {
    originalHtml = btn.innerHTML;
    btn.innerHTML = `Sending...`;
    btn.disabled = true;
  }

  fetch('/api/controls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command })
  })
  .then(res => {
    if (!res.ok) throw new Error("Command execution failed or timed out.");
    return res.json();
  })
  .then(data => {
    addTerminalLog("INFO", `Command processed. Status: ${data.status}`);
    showToast("Command Relay", `Command ${command} executed successfully.`);
    
    if (btn) {
      btn.innerHTML = `✓ Success`;
      btn.style.borderColor = "var(--accent-green)";
      btn.style.color = "var(--accent-green)";
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.borderColor = "";
        btn.style.color = "";
        btn.disabled = false;
      }, 1500);
    }

    // Locally adjust simulation state immediately to match
    if (command === 'START') {
      telemetryData.relay = true;
      if (telemetryData.soc >= 95) telemetryData.soc = 50;
    } else if (command === 'STOP' || command === 'EMERGENCY_STOP') {
      telemetryData.relay = false;
      telemetryData.current = 0.0;
    } else if (command === 'RESET') {
      telemetryData.soc = 50;
      telemetryData.temperature = 28;
      totalEnergyAccumulated = 0;
    }
    updateDashboardUI();
  })
  .catch(err => {
    console.error("Backend control route failed, executing local override.", err);
    showToast("Command Failed", `Command ${command} failed: ${err.message}`);
    
    if (btn) {
      btn.innerHTML = `✗ Failed`;
      btn.style.borderColor = "var(--accent-red)";
      btn.style.color = "var(--accent-red)";
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.borderColor = "";
        btn.style.color = "";
        btn.disabled = false;
      }, 1500);
    }

    // Local fallback overrides
    if (command === 'START') {
      telemetryData.relay = true;
      if (telemetryData.soc >= 95) telemetryData.soc = 50;
    } else if (command === 'STOP' || command === 'EMERGENCY_STOP') {
      telemetryData.relay = false;
      telemetryData.current = 0.0;
    } else if (command === 'RESET') {
      telemetryData.soc = 50;
      telemetryData.temperature = 28;
      totalEnergyAccumulated = 0;
    }
    updateDashboardUI();
    addTerminalLog("WARNING", `Offline control executed locally.`);
  });
}

function triggerEmergencyCutoff() {
  openConfirmModal(
    "Emergency Relay Shutdown",
    "Are you sure you want to engage the manual emergency cutoff? This physically opens the charging circuit relay immediately, arresting power delivery.",
    () => {
      triggerControl("EMERGENCY_STOP");
      closeModal();
    }
  );
}

function toggleRelayManual() {
  if (telemetryData.relay) {
    triggerControl("STOP");
  } else {
    triggerControl("START");
  }
}

/* 7. Timeline Session Replays */
let playbackTimer = null;
let playbackIndex = 0;
let playbackSessionData = []; // To store retrieved database session telemetry logs

const mockPlaybackSession = Array.from({length: 30}, (_, i) => ({
  soc: 40 + i,
  temp: 28 + Math.round((i * 0.4) * 10) / 10,
  amps: i > 25 ? 0.4 : (i > 15 ? 0.8 : 1.5),
  volts: 3.4 + (i * 0.02)
}));

function getActiveSessionLength() {
  return playbackSessionData.length > 0 ? playbackSessionData.length : mockPlaybackSession.length;
}

function updatePlaybackFrame(idx) {
  const isReal = playbackSessionData.length > 0;
  const totalLength = getActiveSessionLength();
  
  if (idx < 0 || idx >= totalLength) return;
  playbackIndex = idx;

  if (isReal) {
    const frame = playbackSessionData[idx];
    telemetryData = {
      ...frame,
      relay: !!frame.relay,
      fault: !!frame.fault
    };
    
    // Format timestamp label
    const dateObj = new Date(frame.timestamp);
    const timeStr = dateObj.toTimeString().split(' ')[0];
    document.getElementById("playback-time-lbl").textContent = timeStr;
  } else {
    const frame = mockPlaybackSession[idx];
    telemetryData = {
      voltage: Math.round(frame.volts * 100) / 100,
      current: frame.amps,
      temperature: frame.temp,
      soc: frame.soc,
      mode: frame.soc >= 95 ? "FULL" : (frame.amps === 1.5 ? "FAST" : (frame.amps === 0.8 ? "MEDIUM" : "SLOW")),
      relay: true,
      batteryHealth: 95,
      fault: false,
      timestamp: new Date().toISOString()
    };
    
    const hours = Math.floor(idx / 60);
    const mins = idx % 60;
    document.getElementById("playback-time-lbl").textContent = `00:${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}`;
  }

  updateDashboardUI();
  
  // Set slider value (0-100 percentage)
  const rangeVal = Math.round((idx / (totalLength - 1 || 1)) * 100);
  document.getElementById("playback-range").value = rangeVal;
  
  // Append historical data to the chart
  appendChartData(telemetryData);
}

function playbackPlay() {
  const btn = document.getElementById("play-btn-lbl");
  if (playbackTimer) {
    playbackPause();
    return;
  }
  
  btn.textContent = "⏸";
  addTerminalLog("INFO", "Session playback started.");
  
  const totalLength = getActiveSessionLength();
  
  playbackTimer = setInterval(() => {
    if (playbackIndex >= totalLength) {
      playbackReset();
      return;
    }
    
    updatePlaybackFrame(playbackIndex);
    playbackIndex++;
  }, 500);
}

function playbackPause() {
  const btn = document.getElementById("play-btn-lbl");
  if (btn) btn.textContent = "▶";
  if (playbackTimer) {
    clearInterval(playbackTimer);
    playbackTimer = null;
  }
  addTerminalLog("INFO", "Session playback paused.");
}

function playbackReset() {
  playbackPause();
  playbackIndex = 0;
  const totalLength = getActiveSessionLength();
  document.getElementById("playback-range").value = 0;
  
  if (playbackSessionData.length > 0) {
    updatePlaybackFrame(0);
  } else {
    document.getElementById("playback-time-lbl").textContent = "00:00:00";
  }
}

function playbackSeek() {
  playbackPause();
  const pct = parseInt(document.getElementById("playback-range").value);
  const totalLength = getActiveSessionLength();
  const idx = Math.floor((pct / 100) * (totalLength - 1));
  updatePlaybackFrame(idx);
}

function loadSessionForPlayback(sess) {
  addTerminalLog("INFO", `Loading telemetry for Session #${sess.session_id}...`);
  
  const startTime = sess.start_time;
  const endTime = sess.end_time || new Date().toISOString();
  
  fetch(`/api/telemetry?start=${startTime}&end=${endTime}`)
    .then(res => res.json())
    .then(data => {
      if (!data || data.length === 0) {
        addTerminalLog("WARNING", `No telemetry logs found for Session #${sess.session_id}.`);
        showToast("Load Failed", `No logs in database for Session #${sess.session_id}.`);
        return;
      }
      
      playbackSessionData = data;
      playbackIndex = 0;
      
      // Stop live telemetry if active
      if (currentMode === "LIVE") {
        setMode("SIMULATION");
        addTerminalLog("INFO", "Switched to playback mode. Live socket flow suspended.");
      }
      
      // Update playback slider
      const slider = document.getElementById("playback-range");
      slider.value = 0;
      
      // Set the first frame values on the UI
      updatePlaybackFrame(0);
      
      addTerminalLog("INFO", `Loaded ${playbackSessionData.length} data frames for Session #${sess.session_id}.`);
      showToast("Session Loaded", `Session #${sess.session_id} ready for playback.`);
    })
    .catch(err => {
      console.error("Error loading session telemetry", err);
      addTerminalLog("ERROR", `Failed to load telemetry for Session #${sess.session_id}.`);
    });
}

/* 8. UI Dialog Modal Controls */
function openConfirmModal(title, message, callback) {
  document.getElementById("modal-title-element").textContent = title;
  document.getElementById("modal-body-element").textContent = message;
  document.getElementById("confirm-modal").classList.add("active");
  customConfirmCallback = callback;
}

function closeModal() {
  document.getElementById("confirm-modal").classList.remove("active");
  customConfirmCallback = null;
}

document.getElementById("btn-modal-confirm").addEventListener("click", () => {
  if (customConfirmCallback) customConfirmCallback();
});

/* 9. Event Log Helpers */
function addTerminalLog(severity, message) {
  const term = document.getElementById("event-log-terminal");
  if (!term) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const line = document.createElement("div");
  line.className = `log-line ${severity.toLowerCase()}`;
  line.textContent = `[${timeStr}] ${severity}: ${message}`;
  
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}

/* 10. Data Export center */
function exportData(format) {
  addTerminalLog("INFO", `Initiating dynamic ${format} report export download...`);
  showToast("Export Status", `Downloading ChargeIQ telemetry ${format} report...`);
  if (format === 'CSV') {
    window.location.href = '/api/export/csv';
  } else if (format === 'PDF') {
    window.location.href = '/api/export/pdf';
  }
}

function downloadDatabaseBackup() {
  addTerminalLog("INFO", "Initiating telemetry database file backup download...");
  window.location.href = '/api/db/backup';
}

/* 11. Custom notification floating center */
function showToast(header, message) {
  const container = document.getElementById("notification-center");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast-alert";
  
  // Set border color based on warning tags
  if (header.includes("WARN") || header.includes("WARNING")) {
    toast.style.borderLeftColor = "var(--accent-amber)";
  } else if (header.includes("CRITICAL") || header.includes("FAULT")) {
    toast.style.borderLeftColor = "var(--accent-red)";
  } else {
    toast.style.borderLeftColor = "var(--accent-cyan)";
  }

  toast.innerHTML = `
    <div class="toast-header">
      <span style="font-weight:bold; color:var(--accent-cyan)">⚡ ${header}</span>
      <span style="color:var(--text-muted); cursor:pointer" onclick="this.parentElement.parentElement.remove()">✕</span>
    </div>
    <div class="toast-body">${message}</div>
  `;

  container.appendChild(toast);
  
  // Animate Entrance
  setTimeout(() => {
    toast.classList.add("active");
  }, 50);

  // Self decay
  setTimeout(() => {
    toast.classList.remove("active");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4500);
}

/* 12. Helper tickers & session table loading */
function initSessionsTable() {
  fetch('/api/sessions')
    .then(res => res.json())
    .then(data => {
      if (data && data.length) {
        globalCyclesCount = data.length;
      }
      const tbody = document.querySelector("#sessions-table tbody");
      if (!tbody || !data || data.length === 0) return;
      
      tbody.innerHTML = "";
      data.forEach(sess => {
        const row = document.createElement("tr");
        const start = new Date(sess.start_time).toTimeString().split(' ')[0];
        const end = sess.end_time ? new Date(sess.end_time).toTimeString().split(' ')[0] : "--:--:--";
        row.innerHTML = `
          <td># ${sess.session_id}</td>
          <td>${start}</td>
          <td>${end}</td>
          <td>${sess.start_soc}%</td>
          <td>${sess.end_soc || '--'}%</td>
          <td>${sess.energy_delivered.toFixed(2)} Wh</td>
          <td>${sess.avg_temperature}°C</td>
        `;
        row.style.cursor = "pointer";
        row.addEventListener("click", () => {
          document.querySelectorAll("#sessions-table tbody tr").forEach(r => r.style.background = "");
          row.style.background = "rgba(0, 180, 255, 0.15)";
          loadSessionForPlayback(sess);
        });
        tbody.appendChild(row);
      });
    })
    .catch(() => {
      console.log("Database session querying offline. Showing static mock data table.");
    });
}

function initUptimeCounters() {
  let uptimeSecs = 862; // start value
  setInterval(() => {
    uptimeSecs++;
    const hrs = Math.floor(uptimeSecs / 3600);
    const mins = Math.floor((uptimeSecs % 3600) / 60);
    const secs = uptimeSecs % 60;
    
    document.getElementById("stm32-uptime").textContent = `${hrs}h ${mins}m ${secs}s`;
    
    // Update dashboard duration timer
    const sessTime = Date.now() - liveSessionStartTime;
    const sHrs = Math.floor(sessTime / 3600000);
    const sMins = Math.floor((sessTime % 3600000) / 60000);
    const sSecs = Math.floor((sessTime % 60000) / 1000);
    
    document.getElementById("kpi-duration").textContent = 
      `${sHrs.toString().padStart(2,'0')}:${sMins.toString().padStart(2,'0')}:${sSecs.toString().padStart(2,'0')}`;
  }, 1000);
}

/* 13. Poll Serial Ports */
function pollSerialPorts() {
  fetch('/api/serial/ports')
    .then(res => res.json())
    .then(ports => {
      const selector = document.getElementById("com-port-selector");
      if (!selector) return;
      
      const currentValue = selector.value;
      
      // Keep AUTO option
      selector.innerHTML = '<option value="AUTO">AUTO DETECT</option>';
      
      ports.forEach(p => {
        const option = document.createElement("option");
        option.value = p.path;
        option.textContent = `${p.path} (${p.friendlyName})`;
        selector.appendChild(option);
      });
      
      // Restore previous selection if it's still in the list
      if ([...selector.options].some(opt => opt.value === currentValue)) {
        selector.value = currentValue;
      }
    })
    .catch(err => {
      console.warn("Could not fetch serial ports from backend:", err);
    });
}

/* 14. SCADA Integration Helper Functions */

// Startup Diagnostics sequential checking
function runStartupDiagnostics() {
  const steps = [
    { id: "diag-backend", api: "/api/serial/status", label: "Backend Server Link" },
    { id: "diag-database", api: "/api/history?limit=1", label: "SQLite Database" },
    { id: "diag-socket", check: () => socket && socket.connected, label: "Socket.IO Registry" },
    { id: "diag-serial", api: "/api/serial/ports", label: "Serial Interface Manager" },
    { id: "diag-stm32", check: () => (currentMode === "SIMULATION" || stm32ConnectionStatus === "STM32_CONNECTED"), label: "STM32 Connection", optional: true },
    { id: "diag-stream", check: () => packetsReceived > 0 || currentMode === "SIMULATION", label: "Telemetry Stream", optional: true }
  ];
  
  let stepIndex = 0;
  
  function executeNextStep() {
    if (stepIndex >= steps.length) {
      const overlay = document.getElementById("diagnostics-overlay");
      if (overlay) {
        overlay.style.opacity = 0;
        setTimeout(() => {
          overlay.style.display = "none";
        }, 800);
      }
      addTerminalLog("INFO", "Startup diagnostics completed. SCADA Dashboard active.");
      return;
    }
    
    const step = steps[stepIndex];
    const el = document.getElementById(step.id);
    
    if (el) {
      el.innerHTML = `<span style="color:var(--accent-amber)">○</span> ${step.label}: <span style="color:var(--accent-amber)">CHECKING...</span>`;
    }
    
    const pass = () => {
      if (el) {
        el.innerHTML = `<span style="color:var(--accent-green)">✓</span> ${step.label}: <span style="color:var(--accent-green)">OK</span>`;
      }
      stepIndex++;
      setTimeout(executeNextStep, 250);
    };
    
    const warn = (msg) => {
      if (el) {
        el.innerHTML = `<span style="color:var(--accent-amber)">⚠</span> ${step.label}: <span style="color:var(--accent-amber)">${msg}</span>`;
      }
      stepIndex++;
      setTimeout(executeNextStep, 250);
    };
    
    const fail = (msg) => {
      if (el) {
        el.innerHTML = `<span style="color:var(--accent-red)">✗</span> ${step.label}: <span style="color:var(--accent-red)">FAILED (${msg})</span>`;
      }
      stepIndex++;
      setTimeout(executeNextStep, 400);
    };
    
    if (step.api) {
      fetch(step.api)
        .then(res => {
          if (res.ok) pass();
          else fail(res.statusText);
        })
        .catch(err => {
          if (step.optional) warn("OFFLINE (DEMO FALLBACK)");
          else fail("OFFLINE");
        });
    } else if (step.check) {
      if (step.check()) {
        pass();
      } else {
        if (step.optional) {
          warn("OFFLINE (DEMO FALLBACK)");
        } else {
          fail("CHECK FAILED");
        }
      }
    }
  }
  
  setTimeout(executeNextStep, 500);
}

// Packet stats calculations
function updatePacketStats(data) {
  packetsReceived++;
  ppsCounter++;
  const statsRecv = document.getElementById("stats-received");
  if (statsRecv) statsRecv.textContent = packetsReceived;

  const now = Date.now();
  if (lastTelemetryTime) {
    const interval = now - lastTelemetryTime;
    rollingIntervals.push(interval);
    if (rollingIntervals.length > 20) rollingIntervals.shift();
    const avgInterval = Math.round(rollingIntervals.reduce((a, b) => a + b, 0) / rollingIntervals.length);
    
    const statsInt = document.getElementById("stats-interval");
    if (statsInt) statsInt.textContent = `${avgInterval} ms`;

    if (interval > 1800) {
      const lost = Math.floor(interval / 1000) - 1;
      if (lost > 0) {
        packetsLost += lost;
        const statsLostEl = document.getElementById("stats-lost");
        if (statsLostEl) statsLostEl.textContent = packetsLost;
      }
    }
  }
  lastTelemetryTime = now;

  const totalExpected = packetsReceived + packetsLost;
  const reliability = totalExpected > 0 ? (packetsReceived / totalExpected) * 100 : 100;
  const statsRelEl = document.getElementById("stats-reliability");
  if (statsRelEl) statsRelEl.textContent = `${reliability.toFixed(2)}%`;
}

function startPpsAndAgeTracker() {
  setInterval(() => {
    pps = ppsCounter;
    ppsCounter = 0;
    const ppsEl = document.getElementById("stats-pps");
    if (ppsEl) ppsEl.textContent = `${pps} pkt/sec`;
    
    const serialLastTime = document.getElementById("serial-last-time");
    if (serialLastTime) {
      if (lastTelemetryTime) {
        const diff = (Date.now() - lastTelemetryTime) / 1000;
        serialLastTime.textContent = `${diff.toFixed(1)}s ago`;
      } else {
        serialLastTime.textContent = "--";
      }
    }
  }, 1000);
}

// Watchdog timer check
function startWatchdogTimer() {
  setInterval(() => {
    if (currentMode === "LIVE") {
      if (lastTelemetryTime) {
        const elapsed = (Date.now() - lastTelemetryTime) / 1000;
        const timeoutBanner = document.getElementById("stm32-timeout-banner");
        if (elapsed > 5.0) {
          if (timeoutBanner) {
            timeoutBanner.style.display = "block";
            const lbl = document.getElementById("timeout-seconds-lbl");
            if (lbl) lbl.textContent = elapsed.toFixed(1);
          }
          const healthDot = document.getElementById("health-stm32");
          if (healthDot) healthDot.className = "status-dot red";
          
          const linkStatus = document.getElementById("serial-link-status");
          if (linkStatus) {
            linkStatus.textContent = "TIMEOUT";
            linkStatus.style.color = "var(--accent-red)";
          }
        } else {
          if (timeoutBanner) timeoutBanner.style.display = "none";
        }
      }
    } else {
      const timeoutBanner = document.getElementById("stm32-timeout-banner");
      if (timeoutBanner) timeoutBanner.style.display = "none";
    }
  }, 250);
}

// Live Session Summary & ETA Calculations
let liveSessionStartSoc = null;
let liveSessionStartTimeStamp = null;
let liveSessionTemps = [];

function updateSessionSummaryAndEta(calculatedPower) {
  const summaryDuration = document.getElementById("summary-duration");
  const summaryStartSoc = document.getElementById("summary-start-soc");
  const summaryCurrentSoc = document.getElementById("summary-current-soc");
  const summaryEnergy = document.getElementById("summary-energy");
  const summaryAvgTemp = document.getElementById("summary-avg-temp");
  const summaryMaxTemp = document.getElementById("summary-max-temp");
  const summaryMode = document.getElementById("summary-mode");
  const summaryEta = document.getElementById("summary-eta");
  const chargeEtaLbl = document.getElementById("charge-eta-lbl");

  if (telemetryData.relay) {
    if (!liveSessionStartTimeStamp) {
      liveSessionStartTimeStamp = Date.now();
      liveSessionStartSoc = telemetryData.soc;
      liveSessionTemps = [telemetryData.temperature];
    } else {
      liveSessionTemps.push(telemetryData.temperature);
    }
    
    // Duration
    const diff = Date.now() - liveSessionStartTimeStamp;
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const durationStr = `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    
    if (summaryDuration) summaryDuration.textContent = durationStr;
    if (summaryStartSoc) summaryStartSoc.textContent = `${liveSessionStartSoc}%`;
    if (summaryCurrentSoc) summaryCurrentSoc.textContent = `${telemetryData.soc}%`;
    
    // Energy
    const sessionEnergy = Math.max(0, calculatedPower * (diff / 3600000));
    if (summaryEnergy) summaryEnergy.textContent = `${sessionEnergy.toFixed(2)} Wh`;
    
    // Temps
    const avgT = liveSessionTemps.reduce((a, b) => a + b, 0) / liveSessionTemps.length;
    const maxT = Math.max(...liveSessionTemps);
    if (summaryAvgTemp) summaryAvgTemp.textContent = `${avgT.toFixed(1)}°C`;
    if (summaryMaxTemp) summaryMaxTemp.textContent = `${maxT.toFixed(1)}°C`;
    
    // ETA Calculation
    let etaText = "--";
    if (calculatedPower > 0 && telemetryData.soc < 95) {
      const batteryCapacityWh = 100;
      const remainingWh = ((95 - telemetryData.soc) / 100) * batteryCapacityWh;
      const etaMins = Math.round((remainingWh / calculatedPower) * 60);
      etaText = `${etaMins} mins`;
    } else if (telemetryData.soc >= 95) {
      etaText = "Full Charge";
    }
    if (summaryEta) summaryEta.textContent = etaText;
    if (chargeEtaLbl) chargeEtaLbl.textContent = `ETA: ${etaText}`;
  } else {
    // Standby or disconnected
    liveSessionStartTimeStamp = null;
    liveSessionStartSoc = null;
    liveSessionTemps = [];
    
    if (summaryDuration) summaryDuration.textContent = "--:--:--";
    if (summaryStartSoc) summaryStartSoc.textContent = "--";
    if (summaryCurrentSoc) summaryCurrentSoc.textContent = "--";
    if (summaryEnergy) summaryEnergy.textContent = "0.00 Wh";
    if (summaryAvgTemp) summaryAvgTemp.textContent = "--";
    if (summaryMaxTemp) summaryMaxTemp.textContent = "--";
    if (summaryEta) summaryEta.textContent = "Not Charging";
    if (chargeEtaLbl) chargeEtaLbl.textContent = "ETA: Not Charging";
  }
  
  if (summaryMode) summaryMode.textContent = telemetryData.mode;
}

// Battery SOH Calculation
function updateSohMetrics(cycleCount) {
  const temp = telemetryData.temperature;
  const thermalStress = Math.max(0, (temp - 35) * 0.05);
  const stressLevel = thermalStress > 0.5 ? "HIGH" : (thermalStress > 0.1 ? "MEDIUM" : "LOW");
  
  const lossRatio = packetsReceived > 0 ? (packetsLost / (packetsReceived + packetsLost)) : 0;
  const qualityScore = Math.max(60, 99.5 - (thermalStress * 15) - (lossRatio * 50));
  
  const soh = Math.max(50, 98.5 - (cycleCount * 0.12) - (thermalStress * 0.45));
  const degradation = 100 - soh;
  
  const valEl = document.getElementById("soh-val");
  if (valEl) {
    valEl.textContent = `${soh.toFixed(1)}%`;
    if (soh >= 85) valEl.style.color = "var(--accent-green)";
    else if (soh >= 70) valEl.style.color = "var(--accent-amber)";
    else valEl.style.color = "var(--accent-red)";
  }
  
  const cyclesEl = document.getElementById("soh-cycles");
  if (cyclesEl) cyclesEl.textContent = cycleCount;
  
  const thermalEl = document.getElementById("soh-thermal");
  if (thermalEl) thermalEl.textContent = `${thermalStress.toFixed(2)} (${stressLevel})`;
  
  const qualityEl = document.getElementById("soh-quality");
  if (qualityEl) qualityEl.textContent = `${qualityScore.toFixed(1)}%`;
  
  const degEl = document.getElementById("soh-degradation");
  if (degEl) degEl.textContent = `${degradation.toFixed(1)}%`;
}

// Historical Database Analytics aggregator queries
function updateAnalytics() {
  const selector = document.getElementById("analytics-range-selector");
  if (!selector) return;
  const range = selector.value;
  
  fetch(`/api/analytics?range=${range}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("analytics-avg-soc").textContent = data.avgSoc;
      document.getElementById("analytics-avg-temp").textContent = data.avgTemp;
      document.getElementById("analytics-peak-temp").textContent = data.peakTemp;
      document.getElementById("analytics-total-energy").textContent = data.totalEnergy;
      document.getElementById("analytics-session-count").textContent = data.sessionCount;
    })
    .catch(err => {
      console.warn("Analytics retrieval failed:", err);
    });
}

// Connection manager connect/disconnect actions
function connectSerialPort() {
  const portSelector = document.getElementById("com-port-selector");
  const baudSelector = document.getElementById("baud-rate-selector");
  
  const port = portSelector ? portSelector.value : "AUTO";
  const baudRate = baudSelector ? parseInt(baudSelector.value) : 115200;
  const auto = port === "AUTO";
  
  addTerminalLog("INFO", `Initiating manual connection to port ${port} at ${baudRate} baud...`);
  showToast("Serial Connect", `Connecting to ${port}...`);
  
  fetch('/api/serial/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ port, baudRate, auto })
  })
  .then(res => res.json())
  .then(data => {
    addTerminalLog("INFO", data.message);
    showToast("Serial Status", data.message);
    
    connectionStartTime = Date.now();
    startDurationTracker();
  })
  .catch(err => {
    addTerminalLog("ERROR", `Failed to trigger connection: ${err.message}`);
    showToast("Connect Failed", "Could not request serial port connection.");
  });
}

function disconnectSerialPort() {
  addTerminalLog("INFO", "Requesting manual serial port disconnect...");
  showToast("Serial Disconnect", "Disconnecting...");
  
  fetch('/api/serial/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disconnect: true })
  })
  .then(res => res.json())
  .then(data => {
    addTerminalLog("INFO", data.message);
    showToast("Serial Status", data.message);
    
    if (serialDurationTimer) {
      clearInterval(serialDurationTimer);
      serialDurationTimer = null;
    }
    document.getElementById("serial-duration").textContent = "00:00:00";
    
    const linkStatus = document.getElementById("serial-link-status");
    if (linkStatus) {
      linkStatus.textContent = "DISCONNECTED";
      linkStatus.style.color = "var(--accent-red)";
    }
  })
  .catch(err => {
    addTerminalLog("ERROR", `Failed to disconnect serial: ${err.message}`);
    showToast("Disconnect Failed", "Could not request serial port disconnect.");
  });
}

function startDurationTracker() {
  if (serialDurationTimer) clearInterval(serialDurationTimer);
  serialDurationTimer = setInterval(() => {
    if (stm32ConnectionStatus === 'STM32_CONNECTED' && connectionStartTime) {
      const diff = Date.now() - connectionStartTime;
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      
      const timeStr = `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
      const durationEl = document.getElementById("serial-duration");
      if (durationEl) durationEl.textContent = timeStr;
    } else {
      const durationEl = document.getElementById("serial-duration");
      if (durationEl) durationEl.textContent = "00:00:00";
    }
  }, 1000);
}

