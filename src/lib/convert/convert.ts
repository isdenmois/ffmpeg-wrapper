import type { Input } from '../../types'
import type { Options } from '../option-parse'
import { bars } from '../progress'
import { convertFile } from './convert-file'
import { convertPoolItems, pool } from './convert-pool'

export async function convert(inputs: Input[], options: Options, to: string) {
  if (options.pool !== undefined) {
    pool.setMaxThreads(options.pool)

    await convertPoolItems(inputs, options, to)
  } else {
    const totalBar = bars.create(inputs.length * 100, 0, { name: 'total' })
    let currentFileIdx = 0

    for (const input of inputs) {
      await convertFile(to, input, options, totalBar)

      totalBar.update(++currentFileIdx * 100)
    }
    totalBar.stop()
    bars.remove(totalBar)
  }
}
