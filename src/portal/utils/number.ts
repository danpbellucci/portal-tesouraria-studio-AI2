// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
export const formatNumberBR = (value: number | string, digits = 2): string => { const n = typeof value === 'number' ? value : Number(String(value).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—'; };
export const formatCurrencyBR = (value: number | string): string => `R$ ${formatNumberBR(value, 2)}`;
export const parseNumberBR = (value: string): string => value.trim().replace(/\./g, '').replace(',', '.');
