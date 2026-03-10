import { existsSync } from 'node:fs'
import path, { basename } from 'node:path'
import type { Input } from '../../types'
import { log } from '../log'
import { bars } from '../progress'
import { subSync } from './subsync'

export async function syncSubs(toFormat: Input[], to: string) {
  let currentFileIdx = 0
  const totalBar = bars.create(toFormat.length, 0, { name: 'total' })
  log('total', toFormat.length)

  for (const i of toFormat) {
    if (!i.subtitles) {
      log('Skip sync - no subtitles')
      totalBar.update(++currentFileIdx)
      continue
    }

    const base = basename(i.video, path.extname(i.video))
    const toVideoPath = path.join(to, basename(i.video))
    const subsPath = path.join(i.from, i.subtitles)

    if (!existsSync(subsPath)) {
      log('Skip sync - subtitles not found:', subsPath)
      totalBar.update(++currentFileIdx)
      continue
    }

    const toSubsPath = `${path.join(to, base)}.en.srt`

    log('Sync', i.subtitles)

    await subSync(toVideoPath, subsPath, toSubsPath)

    totalBar.update(++currentFileIdx)
  }

  totalBar.stop()

  bars.remove(totalBar)
}
