import checkbox from '@inquirer/checkbox'
import type { ParsedStream } from '../probe'

const getTitle = (stream: ParsedStream) =>
  [
    stream.type,
    stream.codec,
    stream.tags.language,
    stream.tags.title || stream.tags.title_original || stream.tags.filename || 'Unknown',
  ]
    .filter(Boolean)
    .join(' ')

export const selectMap = async (data: ParsedStream[]) => {
  const result = [] // = data.filter((d) => d.type === "video").map((d) => d.id);

  const choices = data.map(stream => ({
    name: getTitle(stream),
    value: stream.id,
    checked: stream.type === 'video',
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
