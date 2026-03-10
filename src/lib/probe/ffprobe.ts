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

  if (proc.error) throw new Error(String(proc.error))
  if (proc.status) throw new Error(proc.stderr?.toString() ?? 'ffprobe failed')

  return JSON.parse(proc.stdout.toString()) as Probe
}
