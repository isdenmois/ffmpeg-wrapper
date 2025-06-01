import path, { basename } from 'node:path'
import type { SingleBar } from 'cli-progress'
import { FFMpegProgress } from 'ffmpeg-progress-wrapper'
import pidusage from 'pidusage'
import type { Input } from '../../types'
import { log } from '../log'
import type { Options } from '../option-parse'
import { bars } from '../progress'

const qualities: Record<string, number> = {
  hevc: 22,
  h264: 21,
  libsvtav1: 28,
  av1_nvenc: 70,
  hevc_nvenc: 22,
  h264_nvenc: 20,
}

function getQuality(codec: string, q?: number) {
  const qp = String(q || qualities[codec])

  if (codec.includes('nvenc')) {
    return ['-qp', qp]
  }

  if (codec in qualities) {
    return ['-crf', qp]
  }

  return []
}

const hwCodecs = {
  av1: 'av1_nvenc',
  libsvtav1: 'av1_nvenc',
  hevc: 'hevc_nvenc',
  h264: 'h264_nvenc',
} as const

function getCodec(codec: string, hw: boolean): string {
  if (hw && codec in hwCodecs) {
    return hwCodecs[codec as keyof typeof hwCodecs] as string
  }

  return codec
}

export async function convertFile(to: string, i: Input, options: Options, totalBar?: SingleBar) {
  const ffmpegOptions: string[] = []
  const videoPath = path.join(i.from, i.video)
  const videoFilters: string[] = [] // options.hw ? ['format=vaapi,hwupload'] : []
  const audioFilters: string[] = options.loudnorm ? ['loudnorm=i=-13:lra=15:tp=-1'] : []
  const codec = getCodec(options.codec || 'hevc', options.hw)

  audioFilters.push("pan='stereo|c0=c2+0.30*c0+0.30*c4|c1=c2+0.30*c1+0.30*c5'")

  const codecs = [
    '-c:v',
    codec,
    ...getQuality(codec, options.q),
    '-c:a',
    'libopus',
    '-b:a',
    '96k',
    '-af',
    audioFilters.join(','),
    '-c:s',
    'copy',
  ]
  const toVideoPath = path.join(to, basename(i.video))

  if (options.scale) {
    if (options.hw) {
      videoFilters.push(`scale_vaapi='w=-2:h=${options.scale}'`)
    } else {
      videoFilters.push(`scale='-2:${options.scale}'`)
    }
  }
  if (options.hw && !options.preset) {
    options.preset = '18'
  }

  if (options['8']) {
    videoFilters.push('format=yuv420p')
  }

  const filters = videoFilters.length ? ['-vf', ...videoFilters] : []
  const params = [
    ...ffmpegOptions,
    '-i',
    videoPath,
    ...filters,
    ...codecs,
    options.extra,
    ...(options.preset ? ['-preset', options.preset] : []),
    ...i.map,
    ...(options.t ? ['-t', options.t] : []),
    ...(options.s ? ['-ss', options.s] : []),
    '-y',
  ].filter(Boolean)
  const command = ['ffmpeg', ...params].join(' ')

  // log('Encode', i.video)
  const start = Date.now()

  // console.log(`${command} '${toVideoPath}'`);

  // log('ffmpeg', ...params, toVideoPath)
  let percentMultiplier = 1
  const bar1 = bars.create(100, 0, { name: i.i })
  const proc = new FFMpegProgress([...params, toVideoPath] as string[])
  const raw: string[] = []
  proc.on('raw', text => {
    raw.push(text)
  })

  if (options.t) {
    proc.on('details', ({ duration }) => {
      log(i.i, 'details', duration)
      if (duration > 0) {
        percentMultiplier = duration / +options.t
      }
    })
  }

  const startTotal = totalBar ? totalBar.getProgress() * totalBar.getTotal() : 0

  proc.on('progress', ({ progress }) => {
    const percent = (progress || 0) * percentMultiplier * 100

    if (percent > 0) {
      totalBar?.update(startTotal + percent)
      bar1.update(percent)
    }
  })

  const intervalTimeout = setInterval(async () => {
    const { pid, exitCode } = proc.process

    if (exitCode !== null && exitCode !== undefined) {
      proc.emit('end', exitCode)
    } else if (pid) {
      const stats = await pidusage(pid)

      if (stats?.elapsed > 5_000 && stats.cpu < 0.1) {
        proc.emit('end')
        proc.stop()
      }
    }
  }, 1_000)

  proc.on('end', () => {
    clearInterval(intervalTimeout)
  })

  await proc.onDone()

  clearInterval(intervalTimeout)

  proc.removeAllListeners()
  proc.stop()
  bar1.stop()
  bars.remove(bar1)

  if (totalBar) {
    log('Finished', i.video)
    log()
  }
}
