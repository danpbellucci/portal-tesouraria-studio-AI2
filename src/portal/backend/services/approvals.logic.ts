/** Pure business rules for the Approvals module (shared by browser and Express). */
export type ApprovalKind = 'APLICACAO_RESGATE' | 'TRANSFERENCIA_PAGAMENTO';
export type ApprovalOperation = 'Aplicação' | 'Resgate' | 'Transferência' | 'Pagamento';

export interface ApprovalInput {
  kind: ApprovalKind;
  operation: ApprovalOperation;
  companyId: string;
  date: string; // YYYY-MM-DD
  amount: string; // decimal com ponto
  sourceAccountId: string;
  destinationAccountId?: string;
  destinationDescription?: string;
  product?: string;
  approvers: string[];
  description?: string;
}

const OPS: Record<ApprovalKind, ApprovalOperation[]> = {
  APLICACAO_RESGATE: ['Aplicação', 'Resgate'],
  TRANSFERENCIA_PAGAMENTO: ['Transferência', 'Pagamento'],
};

/** Aplicações/resgates: 1 procurador; transferências/pagamentos: 2 procuradores. */
export const REQUIRED_APPROVERS: Record<ApprovalKind, number> = { APLICACAO_RESGATE: 1, TRANSFERENCIA_PAGAMENTO: 2 };

/** Máscara monetária brasileira enquanto digita: "123456" -> "1.234,56". */
export function maskBRL(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  const cents = digits.padStart(3, '0');
  const int = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${int},${cents.slice(-2)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeApprovers(v: unknown): string[] {
  const list = Array.isArray(v) ? v : String(v ?? '').split(/[;,\s]+/);
  return [...new Set(list.map((x) => String(x).trim().toLowerCase()).filter(Boolean))];
}

export function validateApproval(input: ApprovalInput): string | null {
  if (!OPS[input.kind]) return 'Tipo de transação inválido.';
  if (!OPS[input.kind].includes(input.operation)) return 'Operação incompatível com o tipo de transação.';
  if (!input.companyId) return 'Empresa é obrigatória.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) return 'Data inválida.';
  const n = Number(input.amount);
  if (!input.amount || !Number.isFinite(n) || n <= 0) return 'Valor deve ser maior que zero.';
  if (!input.sourceAccountId) return 'Conta de origem é obrigatória.';
  if (input.kind === 'TRANSFERENCIA_PAGAMENTO' && !input.destinationAccountId && !input.destinationDescription?.trim())
    return 'Informe a conta de destino ou o favorecido.';
  if (input.destinationAccountId && input.destinationAccountId === input.sourceAccountId)
    return 'Conta de destino deve ser diferente da conta de origem.';
  const required = REQUIRED_APPROVERS[input.kind];
  if (input.approvers.length !== required)
    return required === 1 ? 'Selecione 1 procurador aprovador.' : `Selecione ${required} procuradores aprovadores distintos.`;
  const bad = input.approvers.find((e) => !EMAIL_RE.test(e));
  if (bad) return `E-mail de aprovador inválido: ${bad}`;
  return null;
}

export const formatBRL = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
export const formatDateBR = (iso: string) => {
  const [y, m, d] = (iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export interface ApprovalLine {
  operation: string;
  company: string;
  date: string;
  amount: string;
  source: string;
  destination: string;
  product?: string;
  description?: string;
}

/** Builds an Outlook-friendly mailto link. Recipients = union of all approvers. */
export function buildApprovalMailto(lines: ApprovalLine[], approvers: string[], requester: string): string {
  const total = lines.reduce((s, l) => s + Number(l.amount), 0);
  const body = [
    'Prezados,',
    '',
    `Solicito a aprovação das ${lines.length} transação(ões) abaixo:`,
    '',
    ...lines.flatMap((l, i) => [
      `${i + 1}. ${l.operation} — ${l.company}`,
      `   Data: ${formatDateBR(l.date)}`,
      `   Valor: ${formatBRL(l.amount)}`,
      `   Conta de origem: ${l.source}`,
      `   Destino: ${l.destination || '—'}`,
      ...(l.product ? [`   Produto: ${l.product}`] : []),
      ...(l.description ? [`   Observação: ${l.description}`] : []),
      '',
    ]),
    `Valor total: ${formatBRL(total)}`,
    '',
    'Atenciosamente,',
    requester,
    'Tesouraria — Elo Participações',
  ].join('\r\n');
  const subject = `[Tesouraria EloPar] Solicitação de aprovação — ${lines.length} transação(ões) — ${formatBRL(total)}`;
  return `mailto:${approvers.join(';')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
