import { saveAs } from 'file-saver';

/** Download a text payload (CSV etc.) as a file. */
export function downloadText(content: string, filename: string, mime = 'text/plain'): void {
  saveAs(new Blob([content], { type: `${mime};charset=utf-8` }), filename);
}
