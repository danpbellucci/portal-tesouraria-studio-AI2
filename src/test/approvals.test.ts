import { describe, it, expect } from "vitest";
import { validateApproval, normalizeApprovers, buildApprovalMailto, maskBRL } from "@/portal/backend/services/approvals.logic";

const base = {
  kind: "TRANSFERENCIA_PAGAMENTO" as const,
  operation: "Transferência" as const,
  companyId: "c1",
  date: "2026-11-03",
  amount: "1000.00",
  sourceAccountId: "a1",
  destinationAccountId: "a2",
  approvers: ["cfo@elopar.com.br", "ceo@elopar.com.br"],
};

describe("aprovações", () => {
  it("aceita transação válida", () => expect(validateApproval(base)).toBeNull());
  it("transferência/pagamento exige 2 procuradores", () => expect(validateApproval({ ...base, approvers: ["cfo@elopar.com.br"] })).toMatch(/2 procuradores/));
  it("aplicação/resgate exige exatamente 1 procurador", () => {
    const { destinationAccountId: _d, ...rest } = base;
    const app = { ...rest, kind: "APLICACAO_RESGATE" as const, operation: "Aplicação" as const };
    expect(validateApproval({ ...app, approvers: ["cfo@elopar.com.br"] })).toBeNull();
    expect(validateApproval(app)).toMatch(/1 procurador/);
  });
  it("máscara de valor xxx.xxx,xx", () => {
    expect(maskBRL("12345678")).toBe("123.456,78");
    expect(maskBRL("5")).toBe("0,05");
  });
  it("rejeita valor zero", () => expect(validateApproval({ ...base, amount: "0" })).toMatch(/maior que zero/));
  it("rejeita operação de outro tipo", () => expect(validateApproval({ ...base, operation: "Resgate" })).toMatch(/incompatível/));
  it("rejeita destino igual à origem", () => expect(validateApproval({ ...base, destinationAccountId: "a1" })).toMatch(/diferente/));
  it("separa aprovadores por ; e remove duplicados", () =>
    expect(normalizeApprovers("A@x.com; a@x.com, b@x.com")).toEqual(["a@x.com", "b@x.com"]));
  it("mailto inclui destinatários e valor total em formato brasileiro", () => {
    const url = buildApprovalMailto(
      [{ operation: "Pagamento", company: "Elo", date: "2026-11-03", amount: "1234.56", source: "CC 1", destination: "Fornecedor" }],
      ["a@x.com", "b@x.com"], "Tesouraria");
    expect(url.startsWith("mailto:a@x.com;b@x.com?")).toBe(true);
    expect(decodeURIComponent(url)).toContain("1.234,56");
    expect(decodeURIComponent(url)).toContain("03/11/2026");
  });
});
