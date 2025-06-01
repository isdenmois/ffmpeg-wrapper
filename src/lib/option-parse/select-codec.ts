import select from '@inquirer/select'

export const selectCodec = async () => {
  return await select({
    message: 'Select video codec',
    choices: [
      {
        name: 'AV1',
        value: 'libsvtav1',
      },
      {
        name: 'HEVC',
        value: 'hevc',
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
