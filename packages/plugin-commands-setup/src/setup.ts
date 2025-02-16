import fs from 'fs'
import os from 'os'
import path from 'path'
import { docsUrl } from '@pnpm/cli-utils'
import logger from '@pnpm/logger'
import renderHelp from 'render-help'

export const rcOptionsTypes = () => ({})

export const cliOptionsTypes = () => ({})

export const shorthands = {}

export const commandNames = ['setup']

export function help () {
  return renderHelp({
    description: 'Sets up pnpm',
    descriptionLists: [
    ],
    url: docsUrl('setup'),
    usages: ['pnpm setup'],
  })
}

function getExecPath () {
  if (process['pkg'] != null) {
    // If the pnpm CLI was bundled by vercel/pkg then we cannot use the js path for npm_execpath
    // because in that case the js is in a virtual filesystem inside the executor.
    // Instead, we use the path to the exe file.
    return process.execPath
  }
  return (require.main != null) ? require.main.filename : process.cwd()
}

function moveCli (currentLocation: string, targetDir: string) {
  const newExecPath = path.join(targetDir, path.basename(currentLocation))
  if (path.relative(newExecPath, currentLocation) === '') return
  logger.info({
    message: `Moving pnpm CLI from ${currentLocation} to ${newExecPath}`,
    prefix: process.cwd(),
  })
  fs.mkdirSync(targetDir, { recursive: true })
  try {
    fs.renameSync(currentLocation, newExecPath)
  } catch (err) {
    fs.copyFileSync(currentLocation, newExecPath)
    try {
      fs.unlinkSync(currentLocation)
    } catch (err) {}
  }
}

export async function handler (
  opts: {
    pnpmHomeDir: string
  }
) {
  const currentShell = process.env.SHELL ? path.basename(process.env.SHELL) : null
  const execPath = getExecPath()
  if (execPath.match(/\.[cm]?js$/) == null) {
    moveCli(execPath, opts.pnpmHomeDir)
  }
  const updateOutput = await updateShell(currentShell, opts.pnpmHomeDir)
  if (updateOutput === false) {
    return 'Could not infer shell type.'
  }
  return `${updateOutput}

Setup complete. Open a new terminal to start using pnpm.`
}

async function updateShell (currentShell: string | null, pnpmHomeDir: string): Promise<string | false> {
  switch (currentShell) {
  case 'bash': {
    const configFile = path.join(os.homedir(), '.bashrc')
    return setupShell(configFile, pnpmHomeDir)
  }
  case 'zsh': {
    const configFile = path.join(os.homedir(), '.zshrc')
    return setupShell(configFile, pnpmHomeDir)
  }
  case 'fish': {
    return setupFishShell(pnpmHomeDir)
  }
  }
  return 'Could not infer shell type.'
}

async function setupShell (configFile: string, pnpmHomeDir: string) {
  if (!fs.existsSync(configFile)) return `Could not setup pnpm. No ${configFile} found`
  const configContent = await fs.promises.readFile(configFile, 'utf8')
  if (configContent.includes('PNPM_HOME')) {
    return `PNPM_HOME is already in ${configFile}`
  }
  await fs.promises.writeFile(configFile, `${configContent}
export PNPM_HOME="${pnpmHomeDir}"
export PATH="$PNPM_HOME:$PATH"
`, 'utf8')
  return `Updated ${configFile}`
}

async function setupFishShell (pnpmHomeDir: string) {
  const configFile = path.join(os.homedir(), '.config/fish/config.fish')
  if (!fs.existsSync(configFile)) return `Could not setup pnpm. No ${configFile} found`
  const configContent = await fs.promises.readFile(configFile, 'utf8')
  if (configContent.includes('PNPM_HOME')) {
    return `PNPM_HOME is already in ${configFile}`
  }
  await fs.promises.writeFile(configFile, `${configContent}
set -gx PNPM_HOME "${pnpmHomeDir}"
set -gx PATH "$PNPM_HOME" $PATH
`, 'utf8')
  return `Updated ${configFile}`
}
