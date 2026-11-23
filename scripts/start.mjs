import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cliPath = fileURLToPath(new URL('../node_modules/vercel/dist/vc.js', import.meta.url))
const child = spawn(process.execPath, [cliPath, 'dev'], { stdio: 'inherit' })

child.on('error', (error) => {
  console.error('Failed to start the local development server:', error.message)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exitCode = code ?? 1
})
