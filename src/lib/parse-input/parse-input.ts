import { existsSync, lstatSync, mkdirSync, readdirSync } from 'node:fs'
import path, { extname } from 'node:path'
import { sort } from 'fast-sort'
import type { Input } from '../../types'
import type { Options } from '../option-parse'

const isVideo = new Set(['.mkv', '.avi', '.mp4'])

export const parseInput = (from: string, start: number): Input[] => {
  const files = new Map<number, Input>()

  if (lstatSync(from).isDirectory()) {
    for (const file of readdirSync(from)) {
      const name = file.toLowerCase()
      const i = +(name.match(/[ex](\d+)/)?.[1] ?? 0)

      if (i) {
        if (!files.has(i)) {
          files.set(i, { from, video: '', subtitles: '', i, map: [] })
        }

        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        const data = files.get(i)!

        if (isVideo.has(extname(name))) {
          data.video = file
        } else if (name.endsWith('.srt')) {
          data.subtitles = file
        }
      }
    }
  } else {
    files.set(1, { from: './', video: from, subtitles: '', i: 1, map: [] })
  }

  return sort([...files])
    .by({ asc: i => i[0] })
    .filter(i => !start || i[0] >= start)
    .map(i => i[1])
    .filter(i => i.video)
}
