// Launcher used inside the packaged .exe.
// Loads runtime configuration, then starts the Next.js standalone server.
const fs = require('fs');
const os = require('os');
const path = require('path');

// Remember where the executable was launched from so an optional .env placed
// next to the .exe can override the bundled defaults.
const launchDirectory = process.cwd();

// Always resolve bundled files relative to the extracted application folder.
process.chdir(__dirname);

// Keep runtime state (logs and schedule data) outside the temporary extraction
// folder so it survives restarts and temp cleanup. Junctions do not require
// administrator rights on Windows; fall back to local folders if unavailable.
function ensurePersistentDirectory(name) {
  const base = process.env.BILLING_DATA_DIR ||
    path.join(process.env.LOCALAPPDATA || os.homedir() || os.tmpdir(), 'BillingIntegration');
  const target = path.join(base, name);
  const link = path.join(__dirname, name);

  try {
    fs.mkdirSync(target, { recursive: true });
    if (!fs.existsSync(link)) {
      fs.symlinkSync(target, link, 'junction');
    }
  } catch (err) {
    try {
      fs.mkdirSync(link, { recursive: true });
    } catch (ignored) {
      // The application will report the underlying error if it needs the folder.
    }
  }
}

ensurePersistentDirectory('logs');
ensurePersistentDirectory('data');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;

  const content = fs.readFileSync(file, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Do not overwrite values supplied by the host environment.
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// .env.local takes precedence over .env, matching Next.js conventions.
// External files (next to the .exe) win over the bundled configuration.
loadEnvFile(path.join(launchDirectory, '.env.local'));
loadEnvFile(path.join(launchDirectory, '.env'));
loadEnvFile(path.join(__dirname, '.env.local'));
loadEnvFile(path.join(__dirname, '.env'));

process.env.NODE_ENV = 'production';
process.env.NEXT_TELEMETRY_DISABLED = '1';

// Listen on all interfaces so the dashboard is reachable over the LAN.
// Override HOSTNAME/PORT from the environment if needed.
if (!process.env.HOSTNAME) process.env.HOSTNAME = '0.0.0.0';
if (!process.env.PORT) process.env.PORT = '3000';

require('./server.js');
