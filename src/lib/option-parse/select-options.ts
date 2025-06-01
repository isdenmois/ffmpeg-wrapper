import path, { join } from 'node:path'
import confirm from '@inquirer/confirm'
import type { Input } from '../../types'
import { type ParsedStream, probeFile } from '../probe'
import type { Options } from './option-parse'
import { selectCodec } from './select-codec'
import { selectMap } from './select-map'

export async function selectOptions(input: Input[], options: Options) {
  if (!options.codec && !options.subsonly) {
    options.codec = await selectCodec()

    if (options.codec !== 'copy') {
      options.hw = await confirm({ message: 'Hardware accelerate?' })
    }
  }

  if (options.map) {
    const map = options.map.split(' ')

    for (const i of input) {
      i.map = map
    }
  } else if (!options.subsonly) {
    const probes = new Map<string, ParsedStream[]>()

    for (const i of input) {
      try {
        const videoPath = join(i.from, i.video)

        probes.set(i.video, await probeFile(videoPath))
      } catch (e) {
        // skip
      }
    }

    const groups = Map.groupBy(probes, ([_, streams]) =>
      streams.flatMap(stream => [stream.id, stream.type, stream.codec, stream.tags.language]).join(','),
    )

    for (const group of groups.values()) {
      const result = await selectMap(group[0][1])
      const map = result.flatMap(i => ['-map', `0:${i}`])

      for (const [file] of group) {
        const i = input.find(i => i.video === file)

        if (i) {
          i.map = map
        }
      }
    }
  }
}
