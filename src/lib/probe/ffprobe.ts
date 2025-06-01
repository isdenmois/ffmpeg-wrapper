import { spawnSync } from 'node:child_process'

export interface Probe {
  streams: Stream[]
}

export interface Stream {
  index: number
  codec_type: string
  codec_name: string
  tags: Record<string, string>
}

export const ffprobe = (file: string) => {
  const proc = spawnSync(
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
  const probeData = []
  const errData = []
  let exitCode = null

  probeData.push(proc.stdout)
  errData.push(proc.stderr)

  exitCode = proc.status

  if (proc.error) throw new Error(String(proc.error))
  if (exitCode) throw new Error(errData.join(''))

  return JSON.parse(probeData.join('')) as Probe
}
