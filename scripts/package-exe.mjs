#!/usr/bin/env node
/**
 * Deterministic replacement for caxa's own packaging step.
 *
 * caxa 3.0.1 builds the embedded tarball with `archiver`, which on this build
 * machine silently truncated the archive in the middle of a large file
 * (`node_modules/typescript/lib/typescript.js`, 9.1 MB). Everything that
 * sorted after it (package.json, public/, server.js, start.cjs) never made it
 * into the .exe, so the extracted application failed at runtime with
 * "Cannot find module 'styled-jsx/style'".
 *
 * This script reuses the caxa stub (the native self-extracting launcher) but
 * builds the payload with the platform `tar` binary, then verifies the payload
 * by fully extracting it before assembling the executable. A truncated bundle
 * can therefore never be shipped.
 *
 * Usage:
 *   node scripts/package-exe.mjs --input build/exe-staging --output dist/app.exe
 */

import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const args = process.argv.slice(2)

function arg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback
}

const input = path.resolve(arg('input', 'build/exe-staging'))
const output = path.resolve(arg('output', 'dist/Billing Integration (Bani Swaif Water).exe'))
const uncompressionMessage = arg('message', 'Extracting Billing Integration, please wait...')

const REQUIRED_PATHS = [
  'package.json',
  'server.js',
  'start.cjs',
  '.next/BUILD_ID',
  '.next/static',
  'node_modules/.bin/node.exe',
  'node_modules/next/package.json',
  'node_modules/react/package.json',
  'node_modules/styled-jsx/style.js',
  'node_modules/oracledb/package.json',
]

function fail(message) {
  console.error(`\nERROR: ${message}`)
  process.exit(1)
}

function collectFiles(dir, base = dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) {
      console.warn(`    ! skipping link: ${path.relative(base, full)}`)
      continue
    }
    if (entry.isDirectory()) {
      collectFiles(full, base, acc)
    } else if (entry.isFile()) {
      acc.push({
        rel: path.relative(base, full).split(path.sep).join('/'),
        size: fs.statSync(full).size,
      })
    }
  }
  return acc
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  if (/Truncated input file/i.test(result.stderr || '')) {
    throw new Error(`${command} reported a truncated archive:\n${result.stderr}`)
  }
  return result
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase()
}

async function main() {
  if (!fs.existsSync(input)) fail(`input directory not found: ${input}`)

  const stub = path.join(
    process.cwd(),
    'node_modules',
    'caxa',
    'stubs',
    `stub--${process.platform}--${process.arch}`,
  )
  if (!fs.existsSync(stub)) fail(`caxa stub not found: ${stub} (run "npm install")`)

  const stagingFiles = collectFiles(input)
  const stagingBytes = stagingFiles.reduce((sum, file) => sum + file.size, 0)
  console.log(`==> Staged payload: ${stagingFiles.length} files, ${(stagingBytes / 1e6).toFixed(1)} MB`)

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'billing-exe-'))
  const tarPath = path.join(workDir, 'payload.tgz')
  const extractDir = path.join(workDir, 'verify')

  try {
    console.log('==> Creating payload archive...')
    run('tar', ['-czf', tarPath, '-C', input, '.'])

    const tarBytes = fs.statSync(tarPath).size
    console.log(`    payload archive: ${(tarBytes / 1e6).toFixed(1)} MB`)

    console.log('==> Verifying payload archive by full extraction...')
    fs.mkdirSync(extractDir, { recursive: true })
    run('tar', ['-xzf', tarPath, '-C', extractDir])

    const extractedFiles = collectFiles(extractDir)
    const extractedBytes = extractedFiles.reduce((sum, file) => sum + file.size, 0)
    if (extractedFiles.length !== stagingFiles.length) {
      fail(`payload is incomplete: ${extractedFiles.length} files extracted, expected ${stagingFiles.length}`)
    }
    if (extractedBytes !== stagingBytes) {
      fail(`payload is corrupt: ${extractedBytes} bytes extracted, expected ${stagingBytes}`)
    }

    const extractedPaths = new Set(extractedFiles.map((file) => file.rel))
    for (const required of REQUIRED_PATHS) {
      if (!extractedPaths.has(required) && !fs.existsSync(path.join(extractDir, required))) {
        fail(`payload is missing required path: ${required}`)
      }
    }
    console.log(`    verified ${extractedFiles.length} files, ${(extractedBytes / 1e6).toFixed(1)} MB`)

    console.log('==> Assembling executable...')
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.rmSync(output, { force: true })
    fs.copyFileSync(stub, output)
    await pipeline(fs.createReadStream(tarPath), fs.createWriteStream(output, { flags: 'a' }))

    const baseName = path.basename(output, path.extname(output))
    const identifier = `${baseName}\\${crypto.randomBytes(8).toString('hex').slice(0, 10)}`
    const footer = {
      identifier,
      command: ['{{caxa}}/node_modules/.bin/node.exe', '{{caxa}}/start.cjs'],
      uncompressionMessage,
    }
    fs.appendFileSync(output, `\n${JSON.stringify(footer)}`)

    // Confirm the executable really contains stub + payload + footer.
    const expectedSize = fs.statSync(stub).size + tarBytes + 1 + Buffer.byteLength(JSON.stringify(footer))
    const actualSize = fs.statSync(output).size
    if (actualSize !== expectedSize) {
      fail(`executable size mismatch: ${actualSize} bytes, expected ${expectedSize}`)
    }

    const sizeMb = (actualSize / 1e6).toFixed(1)
    console.log(`==> Done: ${output} (${sizeMb} MB)`)
    console.log(`    SHA256: ${sha256(output)}`)
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}

main().catch((error) => fail(error.message))
