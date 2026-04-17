// Simple PDF export using browser print
// For full PDF generation, would need pdf-lib or puppeteer on server

export function printProtocolPDF() {
  // Trigger browser's print-to-PDF
  window.print();
}

export function exportProtocolJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
