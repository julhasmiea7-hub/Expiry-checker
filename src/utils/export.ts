export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printFormattedReport(reportTitle: string, subtitle: string, tableHtml: string, summaryStats?: { label: string; value: string }[]) {
  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (!printWindow) {
    // Fallback if popup blocked
    window.print();
    return;
  }

  const dateStr = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const statsHtml = summaryStats && summaryStats.length > 0
    ? `<div style="display: flex; gap: 20px; margin-bottom: 24px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        ${summaryStats.map(s => `
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">${s.label}</div>
            <div style="font-size: 18px; font-weight: 700; color: #0f172a;">${s.value}</div>
          </div>
        `).join('')}
       </div>`
    : '';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${reportTitle} - ShelfGuard Pro</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            font-size: 12px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .title { font-size: 20px; font-weight: 800; color: #0f172a; }
          .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
          .meta { text-align: right; font-size: 11px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
          th { background: #f1f5f9; color: #334155; text-align: left; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; font-weight: 700; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
          .badge-expired { background: #fee2e2; color: #b91c1c; }
          .badge-urgent { background: #fef3c7; color: #b45309; }
          .badge-critical { background: #ffedd5; color: #c2410c; }
          .badge-safe { background: #d1fae5; color: #047857; }
          .footer {
            margin-top: 36px;
            padding-top: 16px;
            border-top: 1px solid #cbd5e1;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #64748b;
          }
          .sign-area { display: flex; gap: 40px; margin-top: 30px; }
          .sign-box { border-top: 1px dashed #94a3b8; width: 180px; padding-top: 6px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${reportTitle}</div>
            <div class="subtitle">${subtitle}</div>
          </div>
          <div class="meta">
            <div><strong>ShelfGuard Supermarket Systems</strong></div>
            <div>Generated: ${dateStr}</div>
            <div>Confidential Store Audit Report</div>
          </div>
        </div>

        ${statsHtml}

        <div class="table-container">
          ${tableHtml}
        </div>

        <div class="sign-area">
          <div class="sign-box">Store Clerk / Inspector</div>
          <div class="sign-box">Department Supervisor</div>
          <div class="sign-box">Store General Manager</div>
        </div>

        <div class="footer">
          <div>Report ID: SG-${Date.now().toString().slice(-6)}</div>
          <div>Page 1 of 1 • Official Stock Verification Record</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
