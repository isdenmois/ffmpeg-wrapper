import { readdirSync, existsSync, mkdirSync, statSync, lstatSync } from 'node:fs'
import path, { extname, basename } from 'node:path'
import { program } from 'commander'
import { sort } from 'fast-sort'
import { exec, spawnSync } from 'node:child_process'
import { promisify } from 'node:util'
import checkbox from '@inquirer/checkbox'
import select from '@inquirer/select'
import confirm from '@inquirer/confirm'
import { MultiBar, Presets, SingleBar } from 'cli-progress'
import { FFMpegProgress } from 'ffmpeg-progress-wrapper'

// const utils = require("fluent-ffmpeg/lib/utils");
const probe = (file: string) => {
  let proc = spawnSync(
    'ffprobe',
    [
      '-hide_banner',
      '-loglevel',
      'fatal',
      '-show_error',
      '-show_format',
      '-show_streams',
      '-show_programs',
      '-show_chapters',
      '-show_private_data',
      '-print_format',
      'json',
      file,
    ],
    { encoding: 'utf8' },
  )
  let probeData = []
  let errData = []
  let exitCode = null

  probeData.push(proc.stdout)
  errData.push(proc.stderr)

  exitCode = proc.status

  if (proc.error) throw new Error(proc.error)
  if (exitCode) throw new Error(errData.join(''))

  return JSON.parse(probeData.join(''))
}

const execAsync = promisify(exec)

const bars = new MultiBar(
  {
    hideCursor: true,
    clearOnComplete: true,
    emptyOnZero: true,
    barsize: 60,
    format: ' {name} \t | {bar} | {percentage}%\t | {duration_formatted}\t | ETA: {eta_formatted}',
  },
  Presets.shades_classic,
)
let totalBar: SingleBar
let currentFileIdx = 0

interface Input {
  from: string
  video: string
  subtitles: string
  i: number
}

interface Options {
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
  first: boolean
  extra: string
}

interface Probe {
  streams: Stream[]
}

interface Stream {
  index: number
  codec_type: string
  codec_name: string
  tags: Record<string, string>
}

interface ParsedStream {
  id: number
  type: string
  codec: string
  tags: Record<string, string>
}

const qualities: Record<string, number> = {
  hevc: 27,
  h264: 23,
  libsvtav1: 34,
}

const probeFile = async (file: string) => {
  const { streams } = probe(file) as Probe

  return streams.map(
    stream =>
      ({
        id: stream.index,
        type: stream.codec_type,
        codec: stream.codec_name,
        tags: stream?.tags ?? {},
      }) as ParsedStream,
  )
}

const getTitle = (stream: ParsedStream) =>
  [
    stream.type,
    stream.codec,
    stream.tags.language,
    stream.tags.title || stream.tags.title_original || stream.tags.filename || 'Unknown',
  ]
    .filter(Boolean)
    .join(' ')

const getMap = async (data: ParsedStream[]) => {
  const result = [] // = data.filter((d) => d.type === "video").map((d) => d.id);

  const choices = data
    // .filter((d) => d.type !== "video")
    .map(stream => ({
      name: getTitle(stream),
      value: stream.id,
    }))

  if (choices.length) {
    const answer = await checkbox({
      message: 'Select source',
      choices,
    })

    result.push(...answer)
  }

  return result
}

function getQuality({ codec, hw, q }: Options) {
  if (codec.includes('amf')) {
    codec = codec.replace('_amf', '')
    q = q || qualities[codec]

    return ['-rc', 'cqp', '-qp_i', q, '-qp_p', q]
  }

  if (codec in qualities) {
    q = q || qualities[codec]

    return hw ? ['-rc_mode', 'CQP', '-qp', q] : ['-crf', q]
  }

  return []
}

function log(...args: any) {
  if (args.length) {
    const toLog = [new Date().toLocaleTimeString('ru'), ...args].join(' ')

    bars.log(toLog.endsWith('\n') ? toLog : `${toLog}\n`)
  } else {
    bars.log('\n')
  }
}

async function checkScore(toVideoPath: string, videoPath: string, options: Options, type: string) {
  const command = [
    'ffmpeg',
    // "-hwaccel auto -hwaccel_output_format auto",
    `-i '${toVideoPath}'`,
    `-i '${videoPath}'`,
    `-lavfi ${type}`,
    // `-lavfi "[0:v]setpts=PTS-STARTPTS[distorted];[1:v]setpts=PTS-STARTPTS[reference];[distorted]crop=iw:ih-40:0:0;[reference]crop=iw:ih-40:0:0;[distorted][reference]${type}"`,
    // "-lavfi psnr",
    // `-lavfi "[0:v]setpts=PTS-STARTPTS[distorted];[1:v]setpts=PTS-STARTPTS[reference];[distorted]scale=1920:1080;[reference]scale=1920:1080;[distorted][reference]${type}"`,
    // '-lavfi libvmaf',
    // '-lavfi "[0:v]setpts=PTS-STARTPTS[distorted];[1:v]setpts=PTS-STARTPTS[reference];[distorted]scale=1920:1080;[reference]scale=1920:1080;[distorted][reference]libvmaf=n_threads=16"',
    options.t ? `-t ${options.t}` : '',
    options.s ? `-ss ${options.s}` : '',
    '-f null',
    '-',
  ].join(' ')
  const vmaf = await execAsync(command)
  const output = vmaf.stderr || vmaf.stdout
  const result = output.split('\n').find(s => s.includes('Parsed_'))
  // console.log(result);
  log(result)

  if (command.includes('psnr')) {
    const avg = +(result?.match(/average:(\d+\.\d+)/)?.[1] || 40) || 40
    const score = (avg - 42) * 40

    log('PSNR Score:', score, 'avg:', avg)
  } else if (command.includes('ssim')) {
    const avg = +(result?.match(/All:.*\((\d+\.\d+)/)?.[1] || 15) || 15
    const score = (avg - 15) * 67

    log('SSIM Score:', score, 'avg:', avg)
  } else if (type.includes('libvmaf')) {
    const avg = +(result?.match(/score: (\d+\.\d+)/)?.[1] || 15) || 15
    const score = (avg - 81) * 8

    log('VMAF Score:', score, 'avg:', avg)
  } else {
    log(result)
  }
}

async function convertFile(to: string, i: Input, options: Options, map: string) {
  const ffmpegOptions = options.hw
    ? ['-hwaccel', 'vaapi', '-hwaccel_output_format', 'vaapi']
    : options.codec.includes('amf')
      ? ['-hwaccel', 'auto', '-hwaccel_output_format', 'auto']
      : []
  const videoPath = path.join(i.from, i.video)
  const videoFilters = options.hw ? ["format='vaapi'", 'hwupload'] : []
  const codecName = options.codec || 'hevc'
  const codec = options.hw ? `${codecName}_vaapi` : codecName
  const codecs = [
    '-c:v',
    codec,
    ...getQuality(options),
    '-c:a',
    'libopus',
    '-b:a',
    '96k',
    '-af',
    "pan='stereo|c0=c2+0.30*c0+0.30*c4|c1=c2+0.30*c1+0.30*c5'",
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

  const filters = videoFilters.length ? ['-vf', ...videoFilters] : []
  const params = [
    ...ffmpegOptions,
    `-i`,
    videoPath,
    ...filters,
    ...codecs,
    options.extra,
    ...(options.preset ? ['-preset', options.preset] : []),
    ...map,
    ...(options.t ? ['-t', options.t] : []),
    ...(options.s ? ['-ss', options.s] : []),
    '-y',
  ].filter(Boolean)
  const command = ['ffmpeg', ...params].join(' ')

  log('Encode', i.video)
  const start = Date.now()

  // console.log(`${command} '${toVideoPath}'`);

  if (options['2']) {
    await execAsync(`${command} -b:v 1200k -pass 1 -an -f null /dev/null`)
    await execAsync(`${command} -b:v 1200k -pass 2 '${toVideoPath}'`)
  } else if (false) {
    // start the progress bar with a total value of 200 and start value of 0
    const bar1 = bars.create(100, 0, { name: i.i })

    // stop the progress bar
    await new Promise((res, rej) => {
      let percentMultiplier = 1
      const process = ffmpeg(videoPath)
        // .videoCodec(codec)
        // .map("0")
        .addInputOptions(ffmpegOptions.split(' '))
        .addOptions(map?.split(' ') ?? [])
        .addOptions('-c:v', codec, ...getQuality(options).split(' '))
        .addOptions('-c:a', 'libopus')
        .addOptions('-af', "pan='stereo|c0=c2+0.30*c0+0.30*c4|c1=c2+0.30*c1+0.30*c5'")
        .addOptions(filters.split(' '))
        .output(toVideoPath)

      if (options.t) {
        process.duration(options.t)
      }

      if (options.preset) {
        process.addOptions('-preset', options.preset)
      }

      process.on('start', function (commandLine) {
        log('FFmpeg command:', commandLine, '\n\n')
      })

      process.on('codecData', data => {
        if (options.t && 'duration' in data) {
          percentMultiplier = utils.timemarkToSeconds(data.duration) / utils.timemarkToSeconds(options.t)
        }
      })
      process.on('progress', progress => {
        const percent = (progress.percent || 0) * percentMultiplier

        if (percent > 0) {
          bar1.update(percent)
          totalBar.update(currentFileIdx * 100 + percent)
        }
      })
      process.on('end', () => res(true))
      process.on('error', (error, stdout, stderr) => {
        log('Error: ' + error.message)
        log('ffmpeg output:\n' + stdout)
        log('ffmpeg stderr:\n' + stderr)
        rej(error)
      })

      log('ffmpeg', ...process._getArguments())

      process.run()
    })
    // bar1.stop();
    // bars.remove(bar1);
  } else if (true) {
    log('ffmpeg', ...params, toVideoPath)
    let percentMultiplier = 1
    const bar1 = bars.create(100, 0, { name: i.i })
    const process = new FFMpegProgress([...params, toVideoPath] as string[])

    if (options.t) {
      process.on('details', ({ duration }) => {
        if (duration > 0) {
          percentMultiplier = duration / +options.t
        }
      })
    }

    process.on('progress', ({ progress, size }) => {
      const percent = (progress || 0) * percentMultiplier * 100

      if (percent > 0) {
        bar1.update(percent)
        totalBar.update(currentFileIdx * 100 + percent)
      }
    })

    await process.onDone()
    bar1.stop()
    bars.remove(bar1)
  } else {
    await execAsync(`${command} '${toVideoPath}'`)
  }

  const fromSize = Math.round(statSync(videoPath).size / 1024 / 10.24) / 100
  const toSize = Math.round(statSync(toVideoPath).size / 1024 / 10.24) / 100

  log('Converted size change:', `${fromSize}MB`, '=>', `${toSize}MB`)

  if (i.subtitles && !options.vmaf && !options.t) {
    const base = basename(i.video, path.extname(i.video))
    const subsPath = path.join(i.from, i.subtitles)
    const toSubsPath = path.join(to, base) + '.en.srt'

    log('Sync', i.subtitles)
    await execAsync(
      // `subsync --cli sync -s '${subsPath}' -r '${toVideoPath}' --out='${toSubsPath}' --ref-lang=en`
      `ffsubsync --gss --max-offset-seconds 240 '${toVideoPath}' -i '${subsPath}' -o ${toSubsPath}`,
    )
  }

  const end = Math.round((Date.now() - start) / 1000)
  const minutes = Math.floor(end / 60)
  const seconds = end - minutes * 60

  log('Took', `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, 'minutes') //, '( or', Date.now() - start, 'ms)')

  if (options.vmaf) {
    await checkScore(toVideoPath, videoPath, options, 'ssim')
    await checkScore(toVideoPath, videoPath, options, 'psnr')
    await checkScore(toVideoPath, videoPath, options, 'libvmaf=n_threads=16')
  }

  log()
  // console.log("\n");
}

const selectCodec = async () => {
  return await select({
    message: 'Select video codec',
    choices: [
      {
        name: 'HEVC',
        value: 'hevc',
      },
      {
        name: 'AV1',
        value: 'libsvtav1',
      },
      {
        name: 'H264 (AVC)',
        value: 'h264',
      },
      {
        name: 'Copy',
        value: 'copy',
      },
    ],
  })
}

const isVideo = new Set(['.mkv', '.avi', '.mp4'])

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
  .option('--first', 'only first file')
  .option('--start <number>', 'episode to start with')
  .option('--extra <string>', 'extra params to ffmpeg')
  .action(async (from, to, options) => {
    const files = new Map<number, Input>()

    if (lstatSync(from).isDirectory()) {
      for (const file of readdirSync(from)) {
        const name = file.toLowerCase()
        const i = +(name.match(/[ex](\d+)/)?.[1] ?? 0)

        if (i) {
          if (!files.has(i)) {
            files.set(i, { from, video: '', subtitles: '', i })
          }

          const data = files.get(i)!

          if (isVideo.has(extname(name))) {
            data.video = file
          } else if (name.endsWith('.srt')) {
            data.subtitles = file
          }
        }
      }
    } else {
      files.set(1, { from: './', video: from, subtitles: '', i: 1 })
    }

    let toFormat = sort([...files])
      .by({ asc: i => i[0] })
      .filter(i => !options.start || i[0] >= options.start)
      .map(i => i[1])
      .filter(i => i.video)

    if (!existsSync(to)) {
      mkdirSync(to)
    }

    if (!options.codec) {
      options.codec = await selectCodec()

      if (options.codec === 'hevc' || options.codec === 'h264') {
        options.hw = await confirm({ message: 'Hardware accelerate?' })
      }
    }

    if (options.first) {
      toFormat = toFormat.slice(0, 1)
    }
    let maps = new Map<string, string[]>()

    if (!options.map) {
      const probes = new Map<string, ParsedStream[]>()

      for (const input of toFormat) {
        try {
          const videoPath = path.join(input.from, input.video)

          probes.set(input.video, await probeFile(videoPath))
        } catch (e) {
          // skip
        }
      }

      const groups = Map.groupBy(probes, ([file, streams]) =>
        streams.flatMap(stream => [stream.id, stream.type, stream.codec, stream.tags.language]).join(','),
      )

      for (const group of groups.values()) {
        const result = await getMap(group[0][1])
        const map = result.flatMap(i => [`-map`, `0:${i}`])

        for (const [file] of group) {
          maps.set(file, map)
        }
      }
    }

    totalBar = bars.create(100 * toFormat.length, 0, { name: 'total' })

    for (const input of toFormat) {
      const map = maps.get(input.video) || options.map.split(' ')

      await convertFile(to, input, options, map)

      totalBar.update(++currentFileIdx * 100)
    }

    totalBar.stop()
    bars.remove(totalBar)
    bars.stop()
  })

program.parse()
