<p align="center">
  <img src="assets/header.svg" alt="ChargeIQ Header" width="100%" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/System-Active-00f2fe?style=flat-square&logo=cpu-chip" alt="System Status" />
  <img src="https://img.shields.io/badge/Microcontroller-STM32F103-blue?style=flat-square&logo=stmicroelectronics" alt="STM32" />
  <img src="https://img.shields.io/badge/Co--Processor-ESP32-purple?style=flat-square&logo=espressif" alt="ESP32" />
  <img src="https://img.shields.io/badge/Backend-Node.js-green?style=flat-square&logo=nodedotjs" alt="Node" />
  <img src="https://img.shields.io/badge/Realtime-Socket.io-black?style=flat-square&logo=socketdotio" alt="SocketIO" />
  <img src="https://img.shields.io/badge/Database-SQLite-003b57?style=flat-square&logo=sqlite" alt="SQLite" />
</p>

<h3 align="center">━━━━━━━ ⚡ SYSTEM CONTROL HUB ━━━━━━━</h3>

<p align="center">
  ChargeIQ is an adaptive, AI-driven EV Charging System. Built on an <b>STM32F103</b> microcontroller core and paired with an <b>ESP32 co-processor</b>, it implements a real-time Fuzzy Logic engine that automatically modulates charging rates based on live telemetry (voltage, current, and temperature), safeguarding battery health and preventing thermal decay.
</p>

<br />

## 🪐 Project Workspace Directory

This repository is structured as a **Split Workspace (Monorepo)**, separating the backend controller service from the simulation presentation.

```yaml
CHARGEIQ-PLATFORM/
├── dashboard/            # Express.js Server + Real-time Telemetry Dashboard
│   ├── public/           # Dashboard Web App files (HTML, CSS, JS)
│   ├── server.js         # Node/Express main server
│   ├── socket.js         # Socket.io telemetry broadcaster
│   └── telemetry.db      # SQLite telemetry logs database
│
├── animations/           # Cinematic WebGL/Canvas Physics Presentation
│   ├── index.html        # Interactive presentation landing page
│   ├── css/              # Styling resources
│   └── js/               # Particle physics & scene animation scripts
│
└── assets/               # Workspace SVG media and banners
```

---

## ⚡ Technical Architecture

The telemetry pipeline aggregates raw physical measurements, feeds them to the fuzzy logic engine, and relays the state wirelessly:

```mermaid
graph LR
    subgraph STM32 Core
        VD[V-Divider] -->|Analog Volts| STM[STM32F103 Core]
        ACS[ACS712 Sensor] -->|Analog Amps| STM
        NTC[NTC Thermistor] -->|Analog Temp| STM
        Fuzzy[Fuzzy Logic Engine] <==> STM
        Relay[5V Safety Relay] <-->|GPIO Out| STM
        LCD[LCD 16x2 I2C] <-->|I2C Out| STM
    end

    subgraph IoT Gateway
        STM -->|UART Serial JSON| ESP[ESP32 Co-Processor]
        ESP -->|Wireless BLE/WiFi| AP[Router / Internet]
    end

    subgraph Cloud Infrastructure
        AP -->|REST API| FB[(Firebase DB)]
        AP -->|WebSockets| BY[Blynk App]
    end

    subgraph Operator Console
        FB -->|Fetch Logs| ND[Node.js Express Server]
        ESP -.->|Direct Socket.io Stream| ND
        ND -->|Push States| Browser[Real-time Web Dashboard]
    end

    classDef hardware fill:#0f2a4a,stroke:#00f2fe,stroke-width:1.5px,color:#fff;
    classDef iot fill:#380e4a,stroke:#a855f7,stroke-width:1.5px,color:#fff;
    classDef cloud fill:#0d3d20,stroke:#22c55e,stroke-width:1.5px,color:#fff;
    
    class VD,ACS,NTC,STM,Fuzzy,Relay,LCD hardware;
    class ESP,AP iot;
    class FB,BY,ND,Browser cloud;
```

---

## 🛠️ Workspace Deployment Guide

You can open and run either component completely independently.

### 🎮 Running the Animations & Simulation

The cinematic presentation simulates the hardware behavior, sensor data generation, and cloud transmission in a beautiful canvas-based physics animation.

1. **Direct browser execution**:
   - Double-click the file [animations/index.html](file:///c:/Users/rajak/OneDrive/Desktop/CHARGEIQ%20MAIN%20EL%20DASHBOARD/animations/index.html) to open the presentation instantly.
2. **Local HTTP Server execution**:
   - Open a terminal at `animations/` and start a static server:
     ```bash
     python -m http.server 8080
     ```
   - Open [http://localhost:8080](http://localhost:8080) in your web browser.

---

### 📊 Running the SCADA Telemetry Dashboard

The dashboard aggregates database logs, handles command signals (UART connection), and updates charging states on a real-time monitor.

1. Go into the dashboard directory:
   ```bash
   cd dashboard
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Boot the Express Server:
   ```bash
   npm run start
   ```
4. Access the telemetry console:
   - Monitor URL: [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)
   - Landing Portal: [http://localhost:3000/index.html](http://localhost:3000/index.html)

---

## 🔮 Hardware Core Highlights
> [!TIP]
> **Fuzzy Logic Engine**: Implements dynamic current throttling. If NTC thermistor temperatures approach critical levels (>42°C), charging switches from FAST mode (1.5A) to MEDIUM (0.8A) or stand-by, protecting lead-acid cells from swelling.
> 
> **ESP32 Co-Processing**: Relieves STM32 clock-cycles from TCP/IP stack overhead, handling direct socket client handshakes and databases asynchronously.

<p align="center">━━━━━━━ ⚡ RVCE SCADA CORE ━━━━━━━</p>
