import { ffprobe } from './ffprobe'

export interface ParsedStream {
  id: number
  type: string
  codec: string
  tags: Record<string, string>
}

export const probeFile = async (file: string) => {
  const { streams } = ffprobe(file)

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
