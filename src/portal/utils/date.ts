// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
/**
 * Date utility for formatting and parsing dates in DD/MM/AAAA format.
 */

/**
 * Formats a date string (YYYY-MM-DD or ISO) or Date into DD/MM/AAAA.
 */
export function formatDateBR(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  
  if (typeof dateInput === 'string') {
    // If already in DD/MM/AAAA format, return as is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      return dateInput;
    }
    // If in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
      const parts = dateInput.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    // If in YYYY-MM format (for months)
    if (/^\d{4}-\d{2}$/.test(dateInput)) {
      const parts = dateInput.split('-');
      return `${parts[1]}/${parts[0]}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formats date and time into DD/MM/AAAA, HH:mm
 */
export function formatDateTimeBR(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Parses a date string in DD/MM/AAAA or other formats into internal ISO YYYY-MM-DD.
 */
export function parseDateToISO(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();

  // DD/MM/AAAA or DD/MM/YY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    const day = d.padStart(2, '0');
    const month = m.padStart(2, '0');
    let year = y;
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.split('T')[0];
  }

  // Attempt standard date parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return trimmed;
}
