// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
/**
 * Server Date utility for formatting and parsing dates in DD/MM/AAAA format.
 */

export function formatDateBR(dateInput?: string | Date | null): string {
  if (!dateInput) return '';

  if (typeof dateInput === 'string') {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      return dateInput;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
      const parts = dateInput.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

export function parseDateToISO(dateStr: string | number | Date): string {
  if (!dateStr) return '';

  // Excel serial date number
  if (typeof dateStr === 'number') {
    // Excel base date Dec 30, 1899
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const targetDate = new Date(excelEpoch.getTime() + Math.floor(dateStr) * 86400000);
    return targetDate.toISOString().split('T')[0];
  }

  if (dateStr instanceof Date) {
    return dateStr.toISOString().split('T')[0];
  }

  const trimmed = String(dateStr).trim();

  // Excel serial number stored as text (célula em formato número, ex.: 46295 = 30/09/2026)
  if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
    const serial = Math.floor(Number(trimmed));
    if (serial > 20000 && serial < 80000) return parseDateToISO(serial);
  }

  // DD/MM/AAAA or DD-MM-AAAA
  const brMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    let year = brMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.split('T')[0];
  }

  return trimmed;
}

export function isValidDateBR(dateValue: string | number | Date): boolean {
  if (dateValue === undefined || dateValue === null || dateValue === '') return false;
  const iso = parseDateToISO(dateValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !isNaN(d.getTime());
}
