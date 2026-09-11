#!/usr/bin/env node
/**
 * GUPTCHARA Cross-Platform Demo Launcher
 * Works natively on Windows (PowerShell/CMD), macOS, and Linux.
 * 
 * Usage:
 *   node scripts/launch_demo.js [chrome|edge|firefox|demo]
 * Or via npm:
 *   npm run demo:chrome
 *   npm run demo:edge
 *   npm run demo:server
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT_DIR, 'extension');
const PORT = process.env.PORT || 3000;
const DEMO_URL = `http://localhost:${PORT}/index.html`;

const TARGET = (process.argv[2] || 'chrome').toLowerCase();

console.log('============================================================');
console.log('    GUPTCHARA: Privacy-Preserving Agentic Demo Launcher     ');
console.log(`    Platform: ${process.platform} (${os.release()})`);
console.log(`    Target  : ${TARGET.toUpperCase()}`);
console.log('============================================================');

/**
 * Checks if a file exists and is readable
 */
function fileExists(filePath) {
  try {
    return Boolean(filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile());
  } catch {
    return false;
  }
}

/**
 * Search PATH on Linux/macOS or Windows
 */
function findInPath(names) {
  for (const name of names) {
    try {
      const checkCmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
      const res = execSync(checkCmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf-8' }).trim();
      const firstLine = res.split(/\r?\n/)[0];
      if (firstLine && fileExists(firstLine)) {
        return firstLine;
      }
    } catch {
      // not found in PATH
    }
  }
  return null;
}

/**
 * Find Chrome, Chromium, Edge, or Brave executable across Windows, macOS, and Linux
 */
function findChromiumBinary(preferred = 'chrome') {
  if (process.env.CHROME_BIN && fileExists(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  if (process.env.CHROME_PATH && fileExists(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const progFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const progFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';

    const chromeCandidates = [
      path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
    ];

    const edgeCandidates = [
      path.join(progFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(progFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ];

    const braveCandidates = [
      path.join(progFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(progFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
    ];

    let searchLists = [];
    if (preferred === 'edge') {
      searchLists = [edgeCandidates, chromeCandidates, braveCandidates];
    } else if (preferred === 'brave') {
      searchLists = [braveCandidates, chromeCandidates, edgeCandidates];
    } else {
      searchLists = [chromeCandidates, edgeCandidates, braveCandidates];
    }

    for (const list of searchLists) {
      for (const candidate of list) {
        if (fileExists(candidate)) return candidate;
      }
    }

    return findInPath(['chrome.exe', 'msedge.exe', 'brave.exe']);
  }

  if (process.platform === 'darwin') {
    const macCandidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
    for (const candidate of macCandidates) {
      if (fileExists(candidate)) return candidate;
    }
    return findInPath(['google-chrome', 'chromium', 'brave-browser']);
  }

  // Linux: Prioritize open Chromium builds (chromium, brave) which permit automated --load-extension.
  // Note: Official Google Chrome 137+ explicitly ignores --load-extension from the CLI for security.
  return findInPath([
    'chromium',
    'chromium-browser',
    'brave',
    'brave-browser',
    'microsoft-edge',
    'google-chrome-stable',
    'google-chrome'
  ]);
}

/**
 * Find Firefox binary
 */
function findFirefoxBinary() {
  if (process.env.FIREFOX_BIN && fileExists(process.env.FIREFOX_BIN)) {
    return process.env.FIREFOX_BIN;
  }

  if (process.platform === 'win32') {
    const progFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const progFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const candidates = [
      path.join(progFiles, 'Mozilla Firefox', 'firefox.exe'),
      path.join(progFilesX86, 'Mozilla Firefox', 'firefox.exe')
    ];
    for (const cand of candidates) {
      if (fileExists(cand)) return cand;
    }
    return findInPath(['firefox.exe']);
  }

  if (process.platform === 'darwin') {
    const macCand = '/Applications/Firefox.app/Contents/MacOS/firefox';
    if (fileExists(macCand)) return macCand;
    return findInPath(['firefox']);
  }

  return findInPath(['firefox', 'firefox-esr']);
}

let demoServerProc = null;
let browserProc = null;

function cleanup() {
  console.log('\n[GUPTCHARA] Shutting down processes...');
  if (browserProc && !browserProc.killed) {
    try {
      browserProc.kill();
    } catch {}
  }
  if (demoServerProc && !demoServerProc.killed) {
    try {
      demoServerProc.kill();
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  if (demoServerProc && !demoServerProc.killed) {
    try { demoServerProc.kill(); } catch {}
  }
});

/**
 * Starts the local static demo server
 */
function startDemoServer() {
  return new Promise((resolve, reject) => {
    console.log(`==> Starting local demo benchmark server on http://localhost:${PORT}...`);
    const serverScript = path.join(__dirname, 'serve_demo.js');
    
    demoServerProc = spawn(process.execPath, [serverScript], {
      stdio: 'inherit',
      env: { ...process.env, PORT: String(PORT) }
    });

    demoServerProc.on('error', (err) => {
      console.error('[!] Failed to start demo server:', err);
      reject(err);
    });

    setTimeout(() => {
      resolve();
    }, 600);
  });
}

/**
 * Launch Chromium or Edge with GUPTCHARA extension
 */
async function launchChromium(preferred = 'chrome') {
  const binaryPath = findChromiumBinary(preferred);
  if (!binaryPath) {
    console.error('[!] Error: No Chromium-based browser (Chrome, Edge, Brave) was found.');
    console.error('    Please install Google Chrome or Microsoft Edge, or specify path via CHROME_BIN.');
    console.error('\n    Manual Extension Setup:');
    console.error('    1. Open your browser and go to chrome://extensions (or edge://extensions)');
    console.error('    2. Enable "Developer mode"');
    console.error(`    3. Click "Load unpacked" and select: ${EXT_DIR}`);
    console.error(`    4. Navigate to: ${DEMO_URL}`);
    return;
  }

  console.log(`==> Detected browser: ${binaryPath}`);
  if (binaryPath.includes('google-chrome')) {
    console.log('    [!] Notice: Official Google Chrome 137+ restricts command-line "--load-extension".');
    console.log('    [!] For automatic loading, install Chromium: sudo apt install chromium-browser (or pacman -S chromium)');
    console.log('    [!] In Google Chrome: Open chrome://extensions -> toggle Developer mode -> click "Load unpacked" -> select extension folder.');
  }

  const tempProfileDir = path.join(os.tmpdir(), `guptchara_profile_${Date.now()}`);
  fs.mkdirSync(path.join(tempProfileDir, 'Default'), { recursive: true });

  try {
    const extId = 'idladkdajgfkeeleaghkjojnpdicnblm';
    const prefs = {
      extensions: {
        ui: {
          developer_mode: true
        },
        pinned_extensions: [extId]
      }
    };
    fs.writeFileSync(
      path.join(tempProfileDir, 'Default', 'Preferences'),
      JSON.stringify(prefs),
      'utf-8'
    );
  } catch (e) {
    // Non-fatal
  }

  const args = [
    `--load-extension=${EXT_DIR}`,
    `--user-data-dir=${tempProfileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-features=WebGPU',
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--enable-zero-copy'
  ];

  if (process.platform === 'win32') {
    args.push('--disable-features=RendererCodeIntegrity');
  }

  if (process.platform === 'linux') {
    if (process.env.WAYLAND_DISPLAY) {
      args.push('--ozone-platform-hint=auto', '--ozone-platform=wayland');
    }
    args.push(
      '--use-gl=angle',
      '--use-angle=gl',
      '--disable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan'
    );
  }

  args.push(DEMO_URL);

  console.log(`==> Launching browser with GUPTCHARA extension...`);
  console.log(`    Extension Path: ${EXT_DIR}`);
  console.log(`    Target URL    : ${DEMO_URL}`);
  console.log('------------------------------------------------------------');
  console.log('⭐ Browser opened! If the GUPTCHARA side panel is not visible:');
  console.log('   Click the extension icon on the top-right toolbar.');
  console.log('   Press Ctrl+C in this terminal when finished to close.');
  console.log('------------------------------------------------------------');

  browserProc = spawn(binaryPath, args, {
    stdio: 'ignore',
    detached: false
  });

  browserProc.on('exit', (code) => {
    console.log(`\n[GUPTCHARA] Browser closed (exit code ${code}). Exiting demo.`);
    cleanup();
  });
}

/**
 * Launch Firefox
 */
async function launchFirefox() {
  const binaryPath = findFirefoxBinary();
  if (!binaryPath) {
    console.error('[!] Error: Firefox was not found on this system.');
    console.error('    Please install Firefox or set FIREFOX_BIN environment variable.');
    return;
  }

  console.log(`==> Detected Firefox: ${binaryPath}`);
  console.log(`==> Launching Firefox with web-ext...`);

  const stagingDir = path.join(os.tmpdir(), `guptchara_firefox_ext_${Date.now()}`);
  fs.mkdirSync(stagingDir, { recursive: true });

  fs.cpSync(EXT_DIR, stagingDir, { recursive: true });
  fs.copyFileSync(
    path.join(EXT_DIR, 'manifest.firefox.json'),
    path.join(stagingDir, 'manifest.json')
  );

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  browserProc = spawn(npxCmd, [
    'web-ext',
    'run',
    `--source-dir=${stagingDir}`,
    `--firefox=${binaryPath}`,
    `--start-url=${DEMO_URL}`,
    '--pref=dom.webgpu.enabled=true',
    '--pref=gfx.webrender.all=true'
  ], {
    stdio: 'inherit'
  });

  browserProc.on('exit', () => {
    cleanup();
  });
}

async function main() {
  await startDemoServer();

  if (TARGET === 'demo' || TARGET === 'server') {
    console.log('==> Standalone server mode. Press Ctrl+C to terminate.');
    return;
  }

  if (TARGET === 'firefox') {
    await launchFirefox();
  } else if (TARGET === 'edge') {
    await launchChromium('edge');
  } else {
    await launchChromium('chrome');
  }
}

main().catch((err) => {
  console.error('[!] Fatal error in demo launcher:', err);
  cleanup();
});
