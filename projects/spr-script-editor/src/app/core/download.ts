/**
 * Saves `text` to the operator's disk as `filename`.
 *
 * The browser's only way to hand a file over: a Blob URL behind a synthetic `<a download>`. The
 * source view's Export and the library's per-row Export both end here, so the two cannot drift into
 * different filenames or media types.
 */
export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
