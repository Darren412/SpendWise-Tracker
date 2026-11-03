/**
 * Print a standalone HTML document via a hidden iframe — the user picks
 * "Save as PDF" in the print dialog. Browser-only; no-ops outside DOM.
 */
export function printHTML(html: string, filename = 'report'): void {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  iframe.title = filename;
  document.body.appendChild(iframe);

  const cleanup = () => { iframe.remove(); };

  iframe.onload = () => {
    const w = iframe.contentWindow;
    if (!w) { cleanup(); return; }
    w.addEventListener('afterprint', cleanup);
    // Fallback cleanup in case afterprint never fires
    setTimeout(cleanup, 60_000);
    w.focus();
    w.print();
  };

  iframe.srcdoc = html;
}
