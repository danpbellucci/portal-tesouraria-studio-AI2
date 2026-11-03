import { describe, it, expect } from "vitest";
import { judicialBlockSummary } from "@/portal/utils/judicialBlocks";

describe("bloqueios judiciais", () => {
  it("saldo = bloqueado − desbloqueado e transferido em separado", () => {
    const s = judicialBlockSummary({ amount: "10000", movements: [
      { id: "1", date: "2026-10-01", type: "Desbloqueio", amount: "2500.50" },
      { id: "2", date: "2026-10-02", type: "Transferência", amount: "3000" },
    ] });
    expect(s.balance).toBe(7499.5);
    expect(s.transferred).toBe(3000);
  });
});
