export function scheduleIdleWork(work: () => void) {
  if (typeof window === 'undefined') {
    work()
    return () => undefined
  }

  const browserWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    cancelIdleCallback?: (handle: number) => void
  }

  if (
    typeof browserWindow.requestIdleCallback === 'function' &&
    typeof browserWindow.cancelIdleCallback === 'function'
  ) {
    const handle = browserWindow.requestIdleCallback(() => work(), { timeout: 1200 })
    return () => browserWindow.cancelIdleCallback?.(handle)
  }

  const timeoutId = globalThis.setTimeout(work, 0)
  return () => globalThis.clearTimeout(timeoutId)
}
