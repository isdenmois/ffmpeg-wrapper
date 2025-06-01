import { existsSync, lstatSync, mkdirSync, readdirSync } from 'node:fs'

export function ensureFolder(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path)
  }
}
