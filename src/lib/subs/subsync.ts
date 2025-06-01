import { log } from '../log'

export async function subSync(toVideoPath: string, subsPath: string, toSubsPath: string) {
  const command = ['subsync', '-c', 'sync', '--sub', subsPath, '--ref', toVideoPath, '--out', toSubsPath]
  const proc = Bun.spawn(command)

  await proc.exited

  if (proc.exitCode !== 0) {
    throw proc.stdout.toString()
  }
}
