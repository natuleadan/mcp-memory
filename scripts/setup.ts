#!/usr/bin/env tsx
/**
 * Cross-platform setup script — installs Ollama and pulls required models.
 * Supports: macOS, Linux, Windows
 *
 * Usage: pnpm setup
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

log(`🖥️  Detectado: ${os} (${cpu})`)

// ─── Install Ollama ─────────────────────────────────────────────────────────

function installMac() {
  if (isInstalled('brew')) {
    log('🍺 Instalando Ollama con Homebrew...')
    if (!shInherit('brew', ['install', 'ollama'])) fail('brew install ollama falló')
  } else {
    log('⬇️  Instalando Ollama (install.sh)...')
    // curl + sh — comandos hardcodeados, sin input del usuario
    const curl = spawnSync('curl', ['-fsSL', 'https://ollama.com/install.sh'], { encoding: 'utf8', stdio: 'pipe' })
    if (curl.status !== 0) fail('No se pudo descargar el instalador de Ollama')
    const install = spawnSync('sh', ['-c', curl.stdout], { stdio: 'inherit' })
    if (install.status !== 0) fail('El instalador de Ollama falló')
  }
}

function installLinux() {
  log('⬇️  Instalando Ollama para Linux...')
  const curl = spawnSync('curl', ['-fsSL', 'https://ollama.com/install.sh'], { encoding: 'utf8', stdio: 'pipe' })
  if (curl.status !== 0) fail('No se pudo descargar el instalador de Ollama')
  const install = spawnSync('sh', ['-c', curl.stdout], { stdio: 'inherit' })
  if (install.status !== 0) fail('El instalador de Ollama falló')
}

function installWindows() {
  log('⬇️  Instalando Ollama para Windows (winget)...')
  const check = sh('winget', ['--version'])
  if (!check.ok) {
    warn('winget no está disponible. Descarga el instalador manualmente desde:\n  https://ollama.com/download/windows\nLuego vuelve a correr: pnpm setup')
    process.exit(1)
  }
  if (!shInherit('winget', ['install', '-e', '--id', 'Ollama.Ollama'])) {
    fail('winget install Ollama.Ollama falló')
  }
}

if (isInstalled('ollama')) {
  ok('Ollama ya está instalado')
} else {
  if (os === 'darwin')      installMac()
  else if (os === 'linux')  installLinux()
  else if (os === 'win32')  installWindows()
  else fail(`SO no soportado: ${os}. Instala manualmente desde https://ollama.com/download`)

  if (!isInstalled('ollama')) fail('La instalación falló. Instala manualmente desde https://ollama.com/download')
  ok('Ollama instalado')
}

// ─── Arrancar Ollama si no está corriendo ────────────────────────────────────

if (!isOllamaRunning()) {
  log('🦙 Arrancando Ollama en background...')
  spawnSync('ollama', ['serve'], { detached: true, stdio: 'ignore' })

  let ready = false
  for (let i = 0; i < 15; i++) {
    sleep(1000)
    if (isOllamaRunning()) { ready = true; break }
  }

  if (ready) ok('Ollama corriendo en ' + OLLAMA_HOST)
  else warn('Ollama no responde aún. Corre `ollama serve` en otra terminal y vuelve a intentar.')
} else {
  ok('Ollama ya está corriendo')
}

// ─── Pull modelo ─────────────────────────────────────────────────────────────

log(`📦 Verificando modelo ${REQUIRED_MODEL}...`)
const list = sh('ollama', ['list'])
if (list.stdout.includes(REQUIRED_MODEL)) {
  ok(`Modelo ${REQUIRED_MODEL} ya disponible`)
} else {
  log(`⬇️  Descargando ${REQUIRED_MODEL} (primera vez, puede tardar)...`)
  if (!shInherit('ollama', ['pull', REQUIRED_MODEL])) {
    fail(`No se pudo descargar el modelo. Corre manualmente: ollama pull ${REQUIRED_MODEL}`)
  }
  ok(`Modelo ${REQUIRED_MODEL} listo`)
}

// ─── Done ─────────────────────────────────────────────────────────────────────

log('🎉 Setup completo.\n   pnpm start  → inicia el servidor MCP\n   pnpm index  → indexa el codebase')
