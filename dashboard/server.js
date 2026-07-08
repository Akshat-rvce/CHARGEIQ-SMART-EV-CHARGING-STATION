const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const config = require('./config');
const PDFDocument = require('pdfkit');

const app = express();
const server = http.createServer(app);

// Import Socket.IO handler
const { initSocket, broadcastTelemetry, broadcastEvent } = require('./socket');

// PORT Configuration
const PORT = process.env.PORT || config.socketPort;

// Setup static files directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialize Database connection with a robust JSON fallback if sqlite3 compilation fails
let db = null;
let useJsonFallback = false;
const fallbackDbPath = path.join(__dirname, 'telemetry_fallback.json');

// Initialize JSON fallback database if needed
function initJsonFallback() {
  if (!fs.existsSync(fallbackDbPath)) {
    const initialData = {
      telemetry: [],
      sessions: [
        {
          session_id: 1,
          start_time: new Date(Date.now() - 3600000 * 2).toISOString(),
          end_time: new Date(Date.now() - 3600000 * 1).toISOString(),
          start_soc: 45,
          end_soc: 96,
          energy_delivered: 12.8,
          avg_temperature: 32.4
        },
        {
          session_id: 2,
          start_time: new Date(Date.now() - 3600000 * 5).toISOString(),
          end_time: new Date(Date.now() - 3600000 * 4).toISOString(),
          start_soc: 30,
          end_soc: 95,
          energy_delivered: 16.4,
          avg_temperature: 34.2
        }
      ],
      events: [
        {
          event_id: 1,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          severity: "INFO",
          description: "System initialized. Relay path tested: OK."
        },
        {
          event_id: 2,
          timestamp: new Date(Date.now() - 5400000).toISOString(),
          severity: "INFO",
          description: "Charging session started. Initial SoC: 30%."
        },
        {
          event_id: 3,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          severity: "WARNING",
          description: "Thermal caution: Battery temperature reached 41°C. Throttling current to MEDIUM."
        }
      ]
    };
    fs.writeFileSync(fallbackDbPath, JSON.stringify(initialData, null, 2));
  }
}

try {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.isAbsolute(config.databasePath) ? config.databasePath : path.join(__dirname, config.databasePath);
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to open SQLite database. Falling back to JSON file storage.', err);
      useJsonFallback = true;
      initJsonFallback();
    } else {
      console.log('Connected to SQLite telemetry.db database.');
      createTables();
    }
  });
} catch (e) {
  console.log('sqlite3 module not compiled/available. Using local JSON file storage fallback.');
  useJsonFallback = true;
  initJsonFallback();
}

function createTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      voltage REAL NOT NULL,
      current REAL NOT NULL,
      temperature REAL NOT NULL,
      soc INTEGER NOT NULL,
      chargingRate REAL NOT NULL,
      mode TEXT NOT NULL,
      relay INTEGER NOT NULL,
      batteryHealth INTEGER NOT NULL,
      fault INTEGER NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      session_id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      start_soc INTEGER NOT NULL,
      end_soc INTEGER,
      energy_delivered REAL NOT NULL,
      avg_temperature REAL NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL
    )`);

    // Insert mock historical data if telemetry table is empty
    db.get("SELECT count(*) as count FROM telemetry", (err, row) => {
      if (row && row.count === 0) {
        console.log("Seeding mock telemetry logs database tables...");
        const now = Date.now();
        const stmt = db.prepare(`INSERT INTO telemetry 
          (timestamp, voltage, current, temperature, soc, chargingRate, mode, relay, batteryHealth, fault)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        for (let i = 60; i >= 0; i--) {
          const t = new Date(now - i * 60000).toISOString();
          const soc = Math.min(100, 50 + Math.floor((60 - i) * 0.5));
          const temp = 30 + Math.sin(i / 10) * 4;
          const current = soc >= 95 ? 0 : (temp > 40 ? 0.4 : (soc < 70 ? 1.5 : 0.8));
          const mode = soc >= 95 ? "FULL" : (temp > 42 ? "STOP" : (current === 1.5 ? "FAST" : (current === 0.8 ? "MEDIUM" : "SLOW")));
          const relay = mode === "STOP" || mode === "FULL" ? 0 : 1;
          const rate = 100 * (current / 1.5);
          stmt.run(t, 4.1, current, temp, soc, rate, mode, relay, 95, 0);
        }
        stmt.finalize();

        // Seed events
        db.run(`INSERT INTO events (timestamp, severity, description) VALUES 
          (?, 'INFO', 'STM32 system booted successfully. Firmware version v1.0.4-rvce.'),
          (?, 'INFO', 'WiFi connection established. RSSI: -65dBm.'),
          (?, 'INFO', 'Charging session initiated automatically. Relays engaged.')`, 
          [new Date(now - 3600000).toISOString(), new Date(now - 3500000).toISOString(), new Date(now - 3400000).toISOString()]);

        // Seed sessions
        db.run(`INSERT INTO sessions (start_time, end_time, start_soc, end_soc, energy_delivered, avg_temperature) VALUES
          (?, ?, 35, 95, 14.85, 33.2),
          (?, ?, 50, 96, 11.20, 31.8)`,
          [new Date(now - 7200000).toISOString(), new Date(now - 5400000).toISOString(),
           new Date(now - 14400000).toISOString(), new Date(now - 12600000).toISOString()]);
      }
    });
  });
}

// Helper database writers
function logTelemetryToDb(data) {
  if (useJsonFallback) {
    try {
      const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
      content.telemetry.push({
        id: content.telemetry.length + 1,
        ...data
      });
      // Keep only last 200 logs to prevent file bloating
      if (content.telemetry.length > 200) content.telemetry.shift();
      fs.writeFileSync(fallbackDbPath, JSON.stringify(content, null, 2));
    } catch (e) {
      console.error("JSON write error", e);
    }
  } else {
    db.run(`INSERT INTO telemetry 
      (timestamp, voltage, current, temperature, soc, chargingRate, mode, relay, batteryHealth, fault)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.timestamp, data.voltage, data.current, data.temperature, data.soc, data.chargingRate, data.mode, data.relay ? 1 : 0, data.batteryHealth, data.fault ? 1 : 0]
    );
  }
}

function logEventToDb(severity, description) {
  const timestamp = new Date().toISOString();
  if (useJsonFallback) {
    try {
      const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
      content.events.push({
        event_id: content.events.length + 1,
        timestamp,
        severity,
        description
      });
      if (content.events.length > 100) content.events.shift();
      fs.writeFileSync(fallbackDbPath, JSON.stringify(content, null, 2));
    } catch (e) {
      console.error("JSON write error", e);
    }
  } else {
    db.run(`INSERT INTO events (timestamp, severity, description) VALUES (?, ?, ?)`,
      [timestamp, severity, description]
    );
  }
}

// API Routes
app.get('/api/history', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 60;
  if (useJsonFallback) {
    const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
    res.json(content.telemetry.slice(-limit));
  } else {
    db.all(`SELECT * FROM telemetry ORDER BY id DESC LIMIT ?`, [limit], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.reverse());
    });
  }
});

app.get('/api/sessions', (req, res) => {
  if (useJsonFallback) {
    const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
    res.json(content.sessions);
  } else {
    db.all(`SELECT * FROM sessions ORDER BY session_id DESC`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
});

app.post('/api/sessions', (req, res) => {
  const { start_time, end_time, start_soc, end_soc, energy_delivered, avg_temperature } = req.body;
  if (useJsonFallback) {
    const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
    const newSession = {
      session_id: content.sessions.length + 1,
      start_time,
      end_time,
      start_soc,
      end_soc,
      energy_delivered,
      avg_temperature
    };
    content.sessions.push(newSession);
    fs.writeFileSync(fallbackDbPath, JSON.stringify(content, null, 2));
    res.json(newSession);
  } else {
    db.run(`INSERT INTO sessions (start_time, end_time, start_soc, end_soc, energy_delivered, avg_temperature) VALUES (?, ?, ?, ?, ?, ?)`,
      [start_time, end_time, start_soc, end_soc, energy_delivered, avg_temperature],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ session_id: this.lastID, start_time, end_time, start_soc, end_soc, energy_delivered, avg_temperature });
      }
    );
  }
});

app.get('/api/events', (req, res) => {
  if (useJsonFallback) {
    const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
    res.json(content.events);
  } else {
    db.all(`SELECT * FROM events ORDER BY event_id DESC LIMIT 50`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.reverse());
    });
  }
});

app.post('/api/events', (req, res) => {
  const { severity, description } = req.body;
  logEventToDb(severity, description);
  broadcastEvent({ timestamp: new Date().toISOString(), severity, description });
  res.json({ success: true });
});

// API Route to fetch telemetry range for playbacks
app.get('/api/telemetry', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "Missing start or end timestamp parameters" });
  }

  if (useJsonFallback) {
    try {
      const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
      const filtered = content.telemetry.filter(t => t.timestamp >= start && t.timestamp <= end);
      res.json(filtered);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    db.all(`SELECT * FROM telemetry WHERE timestamp >= ? AND timestamp <= ? ORDER BY id ASC`, [start, end], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
});

// Database backup download endpoint
app.get('/api/db/backup', (req, res) => {
  if (useJsonFallback) {
    res.download(fallbackDbPath, 'telemetry_fallback.json');
  } else {
    const dbPath = path.isAbsolute(config.databasePath) ? config.databasePath : path.join(__dirname, config.databasePath);
    res.download(dbPath, 'telemetry.db');
  }
});

// CSV export endpoint
app.get('/api/export/csv', (req, res) => {
  res.setHeader('Content-disposition', 'attachment; filename="ChargeIQ_Telemetry_History.csv"');
  res.setHeader('Content-type', 'text/csv');

  const header = "Timestamp,Voltage,Current,Temperature,SOC,Mode,Relay\n";
  res.write(header);

  if (useJsonFallback) {
    const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
    content.telemetry.forEach(t => {
      res.write(`${t.timestamp},${t.voltage},${t.current},${t.temperature},${t.soc},${t.mode},${t.relay ? 1 : 0}\n`);
    });
    res.end();
  } else {
    db.each(`SELECT timestamp, voltage, current, temperature, soc, mode, relay FROM telemetry ORDER BY id ASC`, (err, row) => {
      if (!err && row) {
        res.write(`${row.timestamp},${row.voltage},${row.current},${row.temperature},${row.soc},${row.mode},${row.relay}\n`);
      }
    }, (err) => {
      res.end();
    });
  }
});

// Helper for PDF rendering
function writeSessionsToPdf(sessions, doc) {
  sessions.forEach((s) => {
    doc.fillColor('#0066FF').fontSize(14).text(`Session #${s.session_id}`, { underline: true });
    doc.fillColor('#1E293B').fontSize(10);
    doc.text(`• Start Time: ${new Date(s.start_time).toLocaleString()}`);
    doc.text(`• End Time: ${s.end_time ? new Date(s.end_time).toLocaleString() : 'Active/In Progress'}`);
    doc.text(`• Session Duration: ${s.duration || 'N/A'}`);
    doc.text(`• Start SoC: ${s.start_soc}% | End SoC: ${s.end_soc || '--'}%`);
    doc.text(`• Energy Delivered: ${s.energy_delivered.toFixed(2)} Wh`);
    doc.text(`• Average Temp: ${s.avg_temperature}°C | Max Temp: ${s.max_temp}°C`);
    doc.text(`• Charging Modes Used: ${s.modes_used}`);
    doc.moveDown(1.5);
  });
  doc.end();
}

// PDF export endpoint
app.get('/api/export/pdf', (req, res) => {
  res.setHeader('Content-disposition', 'attachment; filename="ChargeIQ_Sessions_Summary.pdf"');
  res.setHeader('Content-type', 'application/pdf');

  const doc = new PDFDocument();
  doc.pipe(res);

  doc.fillColor('#00B4FF').fontSize(22).text('ChargeIQ AI — Charging Analytics Report', { align: 'center' });
  doc.fontSize(10).fillColor('#4A6A8A').text(`Generated: ${new Date().toLocaleString()} | RVCE SCADA Core`, { align: 'center' });
  doc.moveDown(2);

  if (useJsonFallback) {
    const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
    const compiledSessions = content.sessions.map(s => {
      const telemetry = content.telemetry.filter(t => t.timestamp >= s.start_time && t.timestamp <= (s.end_time || new Date().toISOString()));
      const temps = telemetry.map(t => t.temperature);
      const maxTemp = temps.length > 0 ? Math.max(...temps) : s.avg_temperature;
      const modes = [...new Set(telemetry.map(t => t.mode))];
      
      const durationSecs = s.end_time ? Math.round((new Date(s.end_time) - new Date(s.start_time)) / 1000) : 0;
      const hours = Math.floor(durationSecs / 3600);
      const mins = Math.floor((durationSecs % 3600) / 60);
      const secs = durationSecs % 60;
      const durationStr = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
      
      return {
        ...s,
        max_temp: maxTemp,
        modes_used: modes.join(', ') || 'N/A',
        duration: durationStr
      };
    });
    writeSessionsToPdf(compiledSessions, doc);
  } else {
    db.all(`SELECT * FROM sessions ORDER BY session_id DESC`, [], (err, sessions) => {
      if (err) {
        doc.text(`Error: ${err.message}`);
        doc.end();
        return;
      }
      
      if (sessions.length === 0) {
        doc.text("No charging sessions found.");
        doc.end();
        return;
      }
      
      let completed = 0;
      const compiledSessions = [];
      
      sessions.forEach(s => {
        const endTime = s.end_time || new Date().toISOString();
        db.all(`SELECT temperature, mode FROM telemetry WHERE timestamp >= ? AND timestamp <= ?`, [s.start_time, endTime], (tErr, telemetry) => {
          if (tErr || !telemetry || telemetry.length === 0) {
            s.max_temp = s.avg_temperature;
            s.modes_used = "N/A";
          } else {
            const temps = telemetry.map(t => t.temperature);
            s.max_temp = Math.max(...temps);
            const modes = [...new Set(telemetry.map(t => t.mode))];
            s.modes_used = modes.join(', ');
          }
          
          const durationSecs = s.end_time ? Math.round((new Date(s.end_time) - new Date(s.start_time)) / 1000) : 0;
          const hours = Math.floor(durationSecs / 3600);
          const mins = Math.floor((durationSecs % 3600) / 60);
          const secs = durationSecs % 60;
          s.duration = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
          
          compiledSessions.push(s);
          completed++;
          
          if (completed === sessions.length) {
            compiledSessions.sort((a,b) => b.session_id - a.session_id);
            writeSessionsToPdf(compiledSessions, doc);
          }
        });
      });
    });
  }
});

// Analytics Route
app.get('/api/analytics', (req, res) => {
  const { range } = req.query;
  let timeLimit;
  const now = new Date();
  
  if (range === 'hour') {
    timeLimit = new Date(now - 3600000).toISOString();
  } else if (range === 'day') {
    timeLimit = new Date(now - 86400000).toISOString();
  } else if (range === 'week') {
    timeLimit = new Date(now - 604800000).toISOString();
  } else {
    timeLimit = new Date(0).toISOString();
  }

  if (useJsonFallback) {
    try {
      const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
      const telemetry = content.telemetry.filter(t => t.timestamp >= timeLimit);
      const sessions = content.sessions.filter(s => s.start_time >= timeLimit);
      
      const count = telemetry.length;
      const avgSoc = count > 0 ? (telemetry.reduce((sum, t) => sum + t.soc, 0) / count) : 0;
      const avgTemp = count > 0 ? (telemetry.reduce((sum, t) => sum + t.temperature, 0) / count) : 0;
      const peakTemp = count > 0 ? Math.max(...telemetry.map(t => t.temperature)) : 0;
      const totalEnergy = sessions.reduce((sum, s) => sum + s.energy_delivered, 0);
      const sessionCount = sessions.length;
      
      res.json({
        avgSoc: Math.round(avgSoc * 10) / 10,
        avgTemp: Math.round(avgTemp * 10) / 10,
        peakTemp: Math.round(peakTemp * 10) / 10,
        totalEnergy: Math.round(totalEnergy * 100) / 100,
        efficiency: 98.2,
        sessionCount
      });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const query = `
      SELECT 
        COUNT(*) as count,
        AVG(soc) as avgSoc,
        AVG(temperature) as avgTemp,
        MAX(temperature) as peakTemp
      FROM telemetry 
      WHERE timestamp >= ?
    `;
    db.get(query, [timeLimit], (err, telemetryRow) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get(`
        SELECT 
          COUNT(*) as sessionCount,
          SUM(energy_delivered) as totalEnergy
        FROM sessions 
        WHERE start_time >= ?
      `, [timeLimit], (sErr, sessionRow) => {
        if (sErr) return res.status(500).json({ error: sErr.message });
        
        res.json({
          avgSoc: telemetryRow.count > 0 ? Math.round(telemetryRow.avgSoc * 10) / 10 : 0,
          avgTemp: telemetryRow.count > 0 ? Math.round(telemetryRow.avgTemp * 10) / 10 : 0,
          peakTemp: telemetryRow.count > 0 ? Math.round(telemetryRow.peakTemp * 10) / 10 : 0,
          totalEnergy: sessionRow.totalEnergy ? Math.round(sessionRow.totalEnergy * 100) / 100 : 0,
          efficiency: 98.2,
          sessionCount: sessionRow.sessionCount
        });
      });
    });
  }
});

// Get list of all serial COM ports
app.get('/api/serial/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json(ports.map(p => ({
      path: p.path,
      friendlyName: p.friendlyName || p.manufacturer || 'Unknown Device'
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Configure or manually connect to a serial port
app.post('/api/serial/connect', (req, res) => {
  const { port, baudRate, auto, disconnect } = req.body;
  
  if (disconnect) {
    autoDetectPort = false;
    closeSerialPort();
    broadcastStm32Status('STM32_DISCONNECTED', null);
    console.log("Manual Serial Port Disconnect requested.");
    return res.json({ success: true, message: "Disconnected successfully." });
  }

  const targetBaud = baudRate ? parseInt(baudRate) : config.baudRate;

  if (auto) {
    autoDetectPort = true;
    console.log("Enabled Serial Port AUTO DETECT mode.");
    scanAndConnectSerial(null, targetBaud);
    res.json({ success: true, message: "Auto-detect mode enabled." });
  } else {
    autoDetectPort = false;
    console.log(`Manual Serial Port Selection: ${port} at ${targetBaud} baud.`);
    scanAndConnectSerial(port, targetBaud);
    res.json({ success: true, message: `Connecting manually to ${port} at ${targetBaud} baud...` });
  }
});

// Get serial connection status
app.get('/api/serial/status', (req, res) => {
  res.json({
    status: stm32Status,
    port: activeComPort || 'NONE',
    baudRate: activeBaudRate,
    lastPacketTime: lastPacketTime || 'NEVER',
    autoDetect: autoDetectPort,
    uptimeSecs: serialStartTime ? Math.round((Date.now() - serialStartTime) / 1000) : 0
  });
});

// Start Express + WebSocket Server
initSocket(server);

// MOCK STM32 BROADCAST ENGINE (Runs when no physical serial data is overriding)
let activeSoC = 50;
let activeTemp = 28;
let activeRelay = true;
let activeSessionTime = 0;
let activeEnergy = 0.0;
let chargingActive = true;

// Active session tracking state
let activeSessionId = null;
let sessionStartTime = null;
let sessionStartSoc = 50;
let sessionTemps = [];
let sessionEnergyStart = 0.0;

// Serial connection state
let serialPort = null;
let serialParser = null;
let activeComPort = null;
let activeBaudRate = 115200;
let serialStartTime = null;
let autoDetectPort = true;
let stm32Status = 'STM32_DISCONNECTED';
let lastPacketTime = null;
let lastSavedTelemetry = null;
let lastSavedTime = 0;
let pendingAck = null;

// Scan available ports and connect
async function scanAndConnectSerial(targetPortName = null, targetBaud = null) {
  const baud = targetBaud || config.baudRate;
  try {
    const ports = await SerialPort.list();
    
    if (targetPortName && targetPortName !== 'AUTO') {
      const foundPort = ports.find(p => p.path === targetPortName);
      if (foundPort) {
        connectToPort(foundPort.path, baud);
        return;
      } else {
        console.warn(`Requested port ${targetPortName} not found.`);
        broadcastStm32Status('STM32_DISCONNECTED', null);
        return;
      }
    }

    // Auto-detect mode
    const espPort = ports.find(port => {
      const desc = (port.friendlyName || port.manufacturer || port.pnpId || '').toLowerCase();
      return desc.includes('cp210') || 
             desc.includes('ch340') || 
             desc.includes('ftdi') || 
             desc.includes('silicon labs') || 
             desc.includes('usb-to-uart') || 
             desc.includes('wch') ||
             desc.includes('stm32');
    });

    if (espPort) {
      console.log(`Auto-detected STM32 Serial Port: ${espPort.path} (${espPort.friendlyName || espPort.manufacturer || 'Unknown device'})`);
      connectToPort(espPort.path, baud);
    } else {
      if (stm32Status !== 'STM32_DISCONNECTED') {
        broadcastStm32Status('STM32_DISCONNECTED', null);
      }
    }
  } catch (err) {
    console.error("Error listing serial ports during scanning", err);
  }
}

// Open serial connection
function connectToPort(portPath, baud = null) {
  const baudRate = baud || config.baudRate;
  if (serialPort && serialPort.isOpen && activeComPort === portPath && activeBaudRate === baudRate) {
    return;
  }

  closeSerialPort();
  console.log(`Attempting connection to Serial Port: ${portPath} at ${baudRate} baud...`);
  broadcastStm32Status('STM32_CONNECTING', portPath);

  try {
    serialPort = new SerialPort({
      path: portPath,
      baudRate: baudRate,
      autoOpen: false
    });

    serialParser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    serialPort.open((err) => {
      if (err) {
        console.error(`Failed to open serial port ${portPath}:`, err.message);
        broadcastStm32Status('STM32_DISCONNECTED', null);
        return;
      }

      activeComPort = portPath;
      activeBaudRate = baudRate;
      serialStartTime = Date.now();
      broadcastStm32Status('STM32_CONNECTED', portPath);
      console.log(`Successfully connected to STM32 on port ${portPath}`);
      logEventToDb("INFO", `STM32 connected on serial port ${portPath}.`);
    });

    serialParser.on('data', handleSerialData);

    serialPort.on('close', () => {
      console.log(`Serial Port ${portPath} closed.`);
      logEventToDb("WARNING", `STM32 serial port ${portPath} disconnected.`);
      closeSerialPort();
      broadcastStm32Status('STM32_DISCONNECTED', null);
    });

    serialPort.on('error', (err) => {
      console.error(`Serial Port ${portPath} error:`, err.message);
      closeSerialPort();
      broadcastStm32Status('STM32_DISCONNECTED', null);
    });

  } catch (err) {
    console.error(`Exception initializing serial port connection`, err);
    closeSerialPort();
    broadcastStm32Status('STM32_DISCONNECTED', null);
  }
}

function closeSerialPort() {
  if (serialPort) {
    if (serialPort.isOpen) {
      try {
        serialPort.close();
      } catch (e) {}
    }
    serialPort = null;
  }
  serialParser = null;
  activeComPort = null;
}

function broadcastStm32Status(status, port) {
  stm32Status = status;
  const { initSocket } = require('./socket');
  const io = initSocket();
  if (io) {
    io.emit('stm32_status', {
      status: stm32Status,
      port: port || 'NONE',
      lastPacketTime: lastPacketTime || 'NEVER'
    });
  }
}

function handleSerialData(line) {
  try {
    line = line.trim();
    if (!line) return;

    // Log every raw serial line received from STM32 to the Node.js console.
    console.log(`[RAW SERIAL IN]: ${line}`);

    // Clean leading garbage and potential corrupted start of JSON
    let cleanedLine = line;
    if (cleanedLine.endsWith('}')) {
      const braceIndex = cleanedLine.indexOf('{');
      if (braceIndex !== -1) {
        cleanedLine = cleanedLine.substring(braceIndex);
      } else {
        cleanedLine = '{' + cleanedLine.replace(/^.*?[vo]{0,2}ltage":/, '"voltage":');
      }
    }

    if (cleanedLine !== line) {
      console.log(`[CLEANED SERIAL]: ${cleanedLine}`);
    }

    // Emit raw text string for Console monitor
    const { initSocket } = require('./socket');
    const io = initSocket();
    if (io) {
      io.emit('raw_serial_line', {
        timestamp: new Date().toLocaleTimeString(),
        line: cleanedLine
      });
    }

    // Check for Command ACK
    if (pendingAck) {
      if (cleanedLine === pendingAck.command) {
        console.log(`Received explicit line ACK: ${cleanedLine}`);
        pendingAck.resolve();
        return;
      }
      try {
        const parsed = JSON.parse(cleanedLine);
        if (parsed.ack === pendingAck.command) {
          console.log(`Received JSON ACK: ${parsed.ack}`);
          pendingAck.resolve();
          return;
        }
      } catch (e) {}
    }

    // Try parsing
    const data = JSON.parse(cleanedLine);
    if (data.voltage !== undefined && data.current !== undefined && data.soc !== undefined) {
      lastPacketTime = new Date().toISOString();
      const voltage = parseFloat(data.voltage);
      const current = parseFloat(data.current);
      const chargingRate = Math.round((voltage * current) * 100) / 100;

      const parsedTelemetry = {
        voltage: voltage,
        current: current,
        temperature: parseFloat(data.temperature),
        soc: parseInt(data.soc),
        chargingRate: data.chargingRate !== undefined ? parseFloat(data.chargingRate) : chargingRate,
        mode: data.mode || "STANDBY",
        relay: data.relay !== undefined ? !!data.relay : (current > 0),
        batteryHealth: 95,
        fault: parseFloat(data.temperature) > 48,
        timestamp: lastPacketTime,
        firmware: data.firmware || "1.0.4-rvce",
        build: data.build || "20260607",
        protocol: data.protocol || "v1",
        isSimulated: false,
        port: activeComPort || "COM5"
      };

      // Log every parsed telemetry packet before broadcasting through Socket.IO.
      console.log("[PARSED TELEMETRY]:", JSON.stringify(parsedTelemetry));

      // Broadcast parsed telemetry
      if (io) {
        // Verify Socket.IO emits the telemetry event.
        console.log("Emitting Socket.IO 'telemetry' event...");
        io.emit('telemetry', parsedTelemetry);
      }

      // Check optimization: Save to DB only if values change OR at least 10 seconds have elapsed
      const nowMs = Date.now();
      let shouldSave = false;

      if (!lastSavedTelemetry) {
        shouldSave = true;
      } else {
        const timeElapsed = nowMs - lastSavedTime;
        const valueChanged = 
          lastSavedTelemetry.soc !== parsedTelemetry.soc ||
          lastSavedTelemetry.temperature !== parsedTelemetry.temperature ||
          lastSavedTelemetry.current !== parsedTelemetry.current ||
          lastSavedTelemetry.relay !== parsedTelemetry.relay ||
          lastSavedTelemetry.mode !== parsedTelemetry.mode;

        if (valueChanged || timeElapsed >= 10000) {
          shouldSave = true;
        }
      }

      if (shouldSave) {
        logTelemetryToDb(parsedTelemetry);
        lastSavedTelemetry = parsedTelemetry;
        lastSavedTime = nowMs;
      }

      // Session tracking logic in live mode
      if (parsedTelemetry.relay) {
        if (!activeSessionId) {
          startSession(parsedTelemetry.soc);
        }
        sessionTemps.push(parsedTelemetry.temperature);
      } else {
        if (activeSessionId) {
          endSession(parsedTelemetry.soc);
        }
      }

      // Handle Full Charge event from STM32 Mode
      if (parsedTelemetry.mode === "FULL" && parsedTelemetry.relay) {
        logEventToDb("INFO", "Battery Fully Charged. Charging Completed Successfully.");
        if (io) {
          io.emit('event_log', {
            timestamp: new Date().toISOString(),
            severity: "INFO",
            description: "Battery Fully Charged. Charging Completed Successfully."
          });
        }
        if (activeSessionId) {
          endSession(parsedTelemetry.soc);
        }
      }

      // Handle Overheat event
      if (parsedTelemetry.temperature >= 50.0) {
        logEventToDb("CRITICAL", `Safety Shutdown: Overheat event detected at ${parsedTelemetry.temperature}°C.`);
        if (io) {
          io.emit('event_log', {
            timestamp: new Date().toISOString(),
            severity: "CRITICAL",
            description: `Safety Shutdown: Overheat event detected at ${parsedTelemetry.temperature}°C.`
          });
        }
        if (activeSessionId) {
          endSession(parsedTelemetry.soc);
        }
      }
    }
  } catch (err) {
    console.error("Error parsing serial line:", err.message, "Line was:", line);
  }
}

function startSession(startSoc) {
  // If there's an active session, end it first to prevent duplicates
  if (activeSessionId) {
    endSession(startSoc);
  }
  
  sessionStartTime = new Date().toISOString();
  sessionStartSoc = startSoc;
  sessionTemps = [];
  sessionEnergyStart = activeEnergy;

  if (useJsonFallback) {
    try {
      const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
      const newSession = {
        session_id: content.sessions.length + 1,
        start_time: sessionStartTime,
        end_time: null,
        start_soc: sessionStartSoc,
        end_soc: null,
        energy_delivered: 0.0,
        avg_temperature: activeTemp
      };
      content.sessions.push(newSession);
      fs.writeFileSync(fallbackDbPath, JSON.stringify(content, null, 2));
      activeSessionId = newSession.session_id;
      console.log(`[Session Started (Fallback)]: ID = ${activeSessionId}`);
    } catch (e) {
      console.error("JSON session start error", e);
    }
  } else {
    db.run(
      `INSERT INTO sessions (start_time, start_soc, energy_delivered, avg_temperature) VALUES (?, ?, 0.0, ?)`,
      [sessionStartTime, sessionStartSoc, activeTemp],
      function (err) {
        if (err) {
          console.error("SQLite session start error", err);
        } else {
          activeSessionId = this.lastID;
          console.log(`[Session Started]: ID = ${activeSessionId}`);
        }
      }
    );
  }
}

function endSession(endSoc) {
  if (!activeSessionId) return;

  const currentSessionId = activeSessionId;
  const endTime = new Date().toISOString();
  const energyDelivered = activeEnergy - sessionEnergyStart;
  const avgTemp = sessionTemps.length > 0 ? (sessionTemps.reduce((a, b) => a + b, 0) / sessionTemps.length) : activeTemp;
  const roundedEnergy = Math.round(energyDelivered * 100) / 100;
  const roundedTemp = Math.round(avgTemp * 10) / 10;

  if (useJsonFallback) {
    try {
      const content = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
      const sess = content.sessions.find(s => s.session_id === currentSessionId);
      if (sess) {
        sess.end_time = endTime;
        sess.end_soc = endSoc;
        sess.energy_delivered = roundedEnergy;
        sess.avg_temperature = roundedTemp;
        fs.writeFileSync(fallbackDbPath, JSON.stringify(content, null, 2));
        console.log(`[Session Ended (Fallback)]: ID = ${currentSessionId}`);
      }
    } catch (e) {
      console.error("JSON session end error", e);
    }
  } else {
    db.run(
      `UPDATE sessions SET end_time = ?, end_soc = ?, energy_delivered = ?, avg_temperature = ? WHERE session_id = ?`,
      [endTime, endSoc, roundedEnergy, roundedTemp, currentSessionId],
      function (err) {
        if (err) {
          console.error("SQLite session end error", err);
        } else {
          console.log(`[Session Ended]: ID = ${currentSessionId}`);
        }
      }
    );
  }

  activeSessionId = null;
  sessionTemps = [];
}

// Reconnect scan interval from config
setInterval(() => {
  if (autoDetectPort && (!serialPort || !serialPort.isOpen)) {
    console.log("No serial connection active. Running auto-reconnect port scan...");
    scanAndConnectSerial();
  }
}, config.reconnectInterval);

setInterval(() => {
  if (serialPort && serialPort.isOpen) {
    // Physical serial connection active, bypass simulation fallback
    return;
  }

  if (!chargingActive) {
    // If charging is stopped, decrease battery current and cool down
    activeTemp = Math.max(26, activeTemp - 0.2);
    const packet = {
      voltage: 3.7,
      current: 0.0,
      temperature: Math.round(activeTemp * 10) / 10,
      soc: activeSoC,
      chargingRate: 0,
      mode: "STOP",
      relay: false,
      batteryHealth: 95,
      fault: false,
      timestamp: new Date().toISOString()
    };
    broadcastTelemetry(packet);

    if (activeSessionId) {
      endSession(activeSoC);
    }
    return;
  }

  // Simulate charging calculations (Mamdani FIS logic replicated in JS backend for mock telemetry generation)
  let currentVal = 0.8; // default
  let modeStr = "MEDIUM";

  // Override logic mimicking physical charging loop
  if (activeSoC >= 95) {
    activeRelay = false;
    currentVal = 0.0;
    modeStr = "FULL";
  } else if (activeTemp > 45) {
    activeRelay = false;
    currentVal = 0.0;
    modeStr = "STOP";
  } else {
    activeRelay = true;
    if (activeSoC < 65 && activeTemp < 38) {
      currentVal = 1.5; // Fast Mode
      modeStr = "FAST";
    } else if (activeSoC >= 80 || activeTemp >= 40) {
      currentVal = 0.4; // Slow Mode
      modeStr = "SLOW";
    } else {
      currentVal = 0.8; // Medium Mode
      modeStr = "MEDIUM";
    }
  }

  // Calculate voltage curve based on SoC
  const voltageVal = Math.round((3.2 + (activeSoC / 100) * 1.0) * 100) / 100;

  // Temperature dynamics: FAST heats battery, SLOW cools it
  if (activeRelay) {
    if (modeStr === "FAST") {
      activeTemp += 0.3;
    } else if (modeStr === "MEDIUM") {
      activeTemp += 0.1;
    } else {
      activeTemp -= 0.05;
    }
    activeSoC = Math.min(100, activeSoC + 1); // 1% increment
  } else {
    activeTemp -= 0.15; // Cools down when charging cut off
  }

  // Cap temperature
  activeTemp = Math.max(20, Math.min(80, activeTemp));

  // Compute charging rate (W = V * A)
  const powerVal = Math.round((voltageVal * currentVal) * 100) / 100;
  activeEnergy += (powerVal / 3600); // add energy per second (mock Wh)

  const telemetryPacket = {
    voltage: voltageVal,
    current: currentVal,
    temperature: Math.round(activeTemp * 10) / 10,
    soc: activeSoC,
    chargingRate: powerVal, // in Watts
    mode: modeStr,
    relay: activeRelay,
    batteryHealth: 95,
    fault: activeTemp > 48,
    timestamp: new Date().toISOString(),
    firmware: "1.0.0-demo",
    build: "20260607-sim",
    protocol: "v1-mock",
    isSimulated: true
  };

  // Log and Broadcast
  logTelemetryToDb(telemetryPacket);
  broadcastTelemetry(telemetryPacket);

  // Collect temps and manage sessions dynamically based on relay states
  if (activeRelay) {
    if (!activeSessionId) {
      startSession(activeSoC);
    }
    sessionTemps.push(activeTemp);
  } else {
    if (activeSessionId) {
      endSession(activeSoC);
    }
  }

  // Trigger events when status changes
  if (activeSoC >= 95 && modeStr === "FULL" && activeRelay) {
    logEventToDb("INFO", "Battery fully charged (95%+). Automatic relay cutoff engaged.");
    broadcastEvent({ timestamp: new Date().toISOString(), severity: "INFO", description: "Battery fully charged (95%+). Automatic relay cutoff engaged." });
    if (activeSessionId) {
      endSession(activeSoC);
    }
  }

}, config.telemetryInterval);

// WebSocket Listener for dashboard control command relays
app.post('/api/controls', (req, res) => {
  const { command } = req.body;
  console.log(`[Remote Control Room Command Executed]: ${command}`);

  const executeStateChange = () => {
    if (command === 'START') {
      chargingActive = true;
      activeRelay = true;
      if (activeSoC >= 95) activeSoC = 50; // reset charge cycle for demo
      logEventToDb("INFO", "Charging session started manually via remote console command.");
      if (!serialPort || !serialPort.isOpen) startSession(activeSoC);
    } else if (command === 'STOP' || command === 'EMERGENCY_STOP') {
      chargingActive = false;
      activeRelay = false;
      logEventToDb(command === 'EMERGENCY_STOP' ? "CRITICAL" : "INFO", 
        command === 'EMERGENCY_STOP' ? "EMERGENCY CUTOFF ENGAGED. Relay disconnected immediately." : "Charging suspended manually via control panel.");
      if (!serialPort || !serialPort.isOpen) endSession(activeSoC);
    } else if (command === 'RESET') {
      if (!serialPort || !serialPort.isOpen) endSession(activeSoC);
      activeSoC = 50;
      activeTemp = 28;
      activeEnergy = 0.0;
      chargingActive = true;
      activeRelay = true;
      logEventToDb("INFO", "System reboot triggered. Resetting session metrics.");
      if (!serialPort || !serialPort.isOpen) startSession(activeSoC);
    }
  };

  if (serialPort && serialPort.isOpen) {
    if (pendingAck) {
      try { pendingAck.reject("Preempted by new command."); } catch(e){}
    }

    let resolved = false;

    pendingAck = {
      command: `${command}_ACK`,
      resolve: () => {
        if (resolved) return;
        resolved = true;
        pendingAck = null;
        executeStateChange();
        res.json({ success: true, status: `Command ${command} executed and acknowledged.` });
      },
      reject: (err) => {
        if (resolved) return;
        resolved = true;
        pendingAck = null;
        res.status(500).json({ success: false, status: `Command ${command} failed: ${err}` });
      }
    };

    serialPort.write(`${command}\n`, (err) => {
      if (err) {
        console.error("Error writing to serial port:", err.message);
        logEventToDb("ERROR", `Failed to send control command ${command} to serial port.`);
        if (pendingAck) pendingAck.reject(err.message);
      } else {
        console.log(`Sent command ${command} over serial. Waiting for ${command}_ACK...`);
        // Timeout
        setTimeout(() => {
          if (pendingAck && !resolved) {
            console.warn(`Timeout waiting for ${command}_ACK`);
            logEventToDb("WARNING", `Timeout waiting for physical STM32 command ACK: ${command}`);
            pendingAck.reject("Timeout waiting for acknowledgment.");
          }
        }, 2000);
      }
    });
  } else {
    // Simulation / Demo Mode - auto ACK after 200ms
    setTimeout(() => {
      executeStateChange();
      res.json({ success: true, status: `Command ${command} executed (Simulation Mode).` });
    }, 200);
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` CHARGEIQ AI BACKEND WEB SERVER ACTIVE ON PORT ${PORT} `);
  console.log(` Link: http://localhost:${PORT}                        `);
  console.log(`=======================================================`);
  
  // Start the initial session after database connection is settled
  setTimeout(() => {
    if (chargingActive && (!serialPort || !serialPort.isOpen)) {
      startSession(activeSoC);
    }
  }, 1000);

  // Initial trigger for serial scanner
  setTimeout(() => {
    scanAndConnectSerial();
  }, 1500);
});
