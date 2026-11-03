import Decimal from 'decimal.js';

export type JudicialMovement = { id: string; date: string; type: 'Desbloqueio' | 'Transferência'; amount: string | number; observation?: string };

const num = (v: unknown) => { try { return new Decimal(String(v ?? 0).replace(',', '.') || 0); } catch { return new Decimal(0); } };

/** Saldo do bloqueio = total bloqueado − total desbloqueado; transferências são exibidas à parte. */
export function judicialBlockSummary(block: { amount?: string | number; movements?: JudicialMovement[] }) {
  const movements = block.movements || [];
  const blocked = num(block.amount);
  const unblocked = movements.filter((m) => m.type === 'Desbloqueio').reduce((s, m) => s.plus(num(m.amount)), new Decimal(0));
  const transferred = movements.filter((m) => m.type === 'Transferência').reduce((s, m) => s.plus(num(m.amount)), new Decimal(0));
  return { blocked: blocked.toNumber(), unblocked: unblocked.toNumber(), transferred: transferred.toNumber(), balance: blocked.minus(unblocked).toNumber() };
}
