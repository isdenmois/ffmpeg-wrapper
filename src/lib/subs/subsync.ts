import { log } from '../log'

export async function subSync(toVideoPath: string, subsPath: string, toSubsPath: string) {
  const command = ['subsync', '-c', 'sync', '--sub', subsPath, '--ref', toVideoPath, '--out', toSubsPath, '--overwrite']

  const proc = Bun.spawn(command, {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  await proc.exited

  if (proc.exitCode !== 0) {
    const stderr = await Bun.readableStreamToText(proc.stderr!)
    const stdout = await Bun.readableStreamToText(proc.stdout)
    log(command.join(' '))
    log(stderr)
    throw new Error(stdout)
  }
}
