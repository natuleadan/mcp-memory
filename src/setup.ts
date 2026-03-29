#!/usr/bin/env tsx
/**
 * Cross-platform setup script — installs Ollama and pulls required models.
 * Supports: macOS, Linux, Windows
 *
 * Usage: pnpm bootstrap
 */

import { spawnSync } from 'child_process'
import { platform, arch } from 'os'

const REQUIRED_MODEL = 'nomic-embed-text'
const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434'

// ─── Helpers ────────────────────────────────────────────────────────────────

function sh(cmd: string, args: string[]): { ok: boolean; stdout: string } {
  const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe' })
  return { ok: result.status === 0, stdout: result.stdout?.trim() ?? '' }
}

function shInherit(cmd: string, args: string[]): boolean {
  const result = spawnSync(cmd, args, { stdio: 'inherit' })
  return result.status === 0
}

function isInstalled(bin: string): boolean {
  const checker = os === 'win32' ? 'where' : 'which'
  return sh(checker, [bin]).ok
}

function isOllamaRunning(): boolean {
  const result = sh('curl', ['-s', '--max-time', '2', `${OLLAMA_HOST}/api/tags`])
  if (!result.ok) return false
  try { JSON.parse(result.stdout); return true } catch { return false }
}

function log(msg: string)  { process.stdout.write(`\n${msg}\n`) }
function ok(msg: string)   { process.stdout.write(`✅ ${msg}\n`) }
function warn(msg: string) { process.stdout.write(`⚠️  ${msg}\n`) }
function fail(msg: string): never { process.stderr.write(`❌ ${msg}\n`); process.exit(1) }
function sleep(ms: number) { spawnSync('node', ['-e', `setTimeout(()=>{},${ms})`]) }

// ─── OS Detection ───────────────────────────────────────────────────────────

const os = platform() // 'darwin' | 'linux' | 'win32'
const cpu = arch()

log(`🖥️  Detected: ${os} (${cpu})`)

// ─── Install Ollama ─────────────────────────────────────────────────────────

function installMac() {
  if (isInstalled('brew')) {
    log('🍺 Installing Ollama with Homebrew...')
    if (!shInherit('brew', ['install', 'ollama'])) fail('brew install ollama failed')
  } else {
    log('⬇️  Installing Ollama (install.sh)...')
    // curl + sh — hardcoded commands, no user input
    const curl = spawnSync('curl', ['-fsSL', 'https://ollama.com/install.sh'], { encoding: 'utf8', stdio: 'pipe' })
    if (curl.status !== 0) fail('Could not download the Ollama installer')
    const install = spawnSync('sh', ['-c', curl.stdout], { stdio: 'inherit' })
    if (install.status !== 0) fail('Ollama installer failed')
  }
}

function installLinux() {
  log('⬇️  Installing Ollama for Linux...')
  const curl = spawnSync('curl', ['-fsSL', 'https://ollama.com/install.sh'], { encoding: 'utf8', stdio: 'pipe' })
  if (curl.status !== 0) fail('Could not download the Ollama installer')
  const install = spawnSync('sh', ['-c', curl.stdout], { stdio: 'inherit' })
  if (install.status !== 0) fail('Ollama installer failed')
}

function installWindows() {
  log('⬇️  Installing Ollama for Windows (winget)...')
  const check = sh('winget', ['--version'])
  if (!check.ok) {
    warn('winget is not available. Download the installer manually from:\n  https://ollama.com/download/windows\nThen run: pnpm bootstrap')
    process.exit(1)
  }
  if (!shInherit('winget', ['install', '-e', '--id', 'Ollama.Ollama'])) {
    fail('winget install Ollama.Ollama failed')
  }
}

if (isInstalled('ollama')) {
  ok('Ollama is already installed')
} else {
  if (os === 'darwin')      installMac()
  else if (os === 'linux')  installLinux()
  else if (os === 'win32')  installWindows()
  else fail(`Unsupported OS: ${os}. Install manually from https://ollama.com/download`)

  if (!isInstalled('ollama')) fail('Installation failed. Install manually from https://ollama.com/download')
  ok('Ollama installed')
}

// ─── Start Ollama if not running ─────────────────────────────────────────────

if (!isOllamaRunning()) {
  log('🦙 Starting Ollama in the background...')
  spawnSync('ollama', ['serve'], { detached: true, stdio: 'ignore' })

  let ready = false
  for (let i = 0; i < 15; i++) {
    sleep(1000)
    if (isOllamaRunning()) { ready = true; break }
  }

  if (ready) ok('Ollama running at ' + OLLAMA_HOST)
  else warn('Ollama is not responding yet. Run `ollama serve` in another terminal and try again.')
} else {
  ok('Ollama is already running')
}

// ─── Pull model ──────────────────────────────────────────────────────────────

log(`📦 Checking model ${REQUIRED_MODEL}...`)
const list = sh('ollama', ['list'])
if (list.stdout.includes(REQUIRED_MODEL)) {
  ok(`Model ${REQUIRED_MODEL} already available`)
} else {
  log(`⬇️  Downloading ${REQUIRED_MODEL} (first time, may take a while)...`)
  if (!shInherit('ollama', ['pull', REQUIRED_MODEL])) {
    fail(`Could not download the model. Run manually: ollama pull ${REQUIRED_MODEL}`)
  }
  ok(`Model ${REQUIRED_MODEL} ready`)
}

// ─── Done ─────────────────────────────────────────────────────────────────────

log('🎉 Bootstrap complete.\n   pnpm start  → start the MCP server\n   pnpm index  → index the codebase')
