/** Trigger a browser download of `blob` under `filename` (object URL + a click). */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoke on the next tick: revoking synchronously can abort the download the
  // click just started (Firefox/Safari).
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
