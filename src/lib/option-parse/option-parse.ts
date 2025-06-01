import { program } from 'commander'

export interface Options {
  map: string
  codec: string
  scale: string
  hw: boolean
  vmaf: boolean
  t: string
  s: string
  preset: string
  q: number
  2: boolean
  8: boolean
  first: boolean
  loudnorm: boolean
  extra: string
  start: number
  subsonly: boolean
  pool?: number
}

export const parseOptions = (): Promise<{ from: string; to: string; options: Options }> =>
  new Promise(resolve => {
    program
      .argument('<from>', 'from directory')
      .argument('<to>', 'to directory')
      .option('--map <items>', 'ffmpeg map', i =>
        i
          .split(',')
          .map(i => `-map 0:${i}`)
          .join(' '),
      )
      .option('--codec <string>', 'video codec: hevc or h264 or copy')
      .option('--scale <string>', 'scale video')
      .option('--hw', 'hardware decode')
      .option('--vmaf', 'check vmaf rating')
      .option('--t <string>', 'limit')
      .option('--s <string>', 'seek')
      .option('--preset <string>', 'preset')
      .option('--q <number>', 'quality')
      .option('--2', 'two pass')
      .option('--8', 'to 8 bit video')
      .option('--first', 'only first file')
      .option('--start <number>', 'episode to start with')
      .option('--loudnorm', 'normalize audio')
      .option('--pool [number]', 'use threads pool')
      .option('--subsonly', 'only subs sync')
      .option('--extra <string>', 'extra params to ffmpeg')
      .action((from, to, options) => {
        if (options.pool === true) {
          options.pool = 0
        }

        resolve({
          from,
          to,
          options,
        })
      })

    program.parse()
  })
