export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob failed'))
    }, 'image/png')
  })
}

export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToBlob(canvas)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function canShareFiles(): boolean {
  try {
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
    return typeof nav.share === 'function' && typeof nav.canShare === 'function'
  } catch {
    return false
  }
}

export async function shareCanvas(canvas: HTMLCanvasElement, title: string, text: string): Promise<boolean> {
  try {
    const blob = await canvasToBlob(canvas)
    const file = new File([blob], `${title}.png`, { type: 'image/png' })
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean
      share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
    }
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title, text })
      return true
    }
    return false
  } catch {
    return false
  }
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
