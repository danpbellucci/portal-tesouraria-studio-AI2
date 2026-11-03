import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseDateToISO, isValidDateBR } from "@/portal/backend/utils/date";
import { ExcelService } from "@/portal/backend/services/excel.service";

describe("datas importadas de planilha", () => {
  it("número de série do Excel 46295 = 30/09/2026", () => {
    expect(parseDateToISO("46295")).toBe("2026-09-30");
    expect(parseDateToISO(46295)).toBe("2026-09-30");
  });
  it("célula em formato data é lida como DD/MM/AAAA", () => {
    const ws = XLSX.utils.aoa_to_sheet([["Data", "Saldo"], [46295, 10]]);
    ws["A2"].z = "dd/mm/yyyy";
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "P");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const rows = ExcelService.parseUploadedBuffer(buf);
    expect(rows[0].Data).toBe("30/09/2026");
    expect(isValidDateBR(rows[0].Data)).toBe(true);
  });
});
