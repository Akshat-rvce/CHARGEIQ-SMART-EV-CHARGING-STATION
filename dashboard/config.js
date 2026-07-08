// Central Configuration System for ChargeIQ AI SCADA Platform
module.exports = {
  baudRate: 115200,
  socketPort: 3000,
  databasePath: './telemetry.db',
  telemetryInterval: 1000,
  reconnectInterval: 5000,
  watchdogTimeout: 5000,
  exportDirectory: './exports'
};
