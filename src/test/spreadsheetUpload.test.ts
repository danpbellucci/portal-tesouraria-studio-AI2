import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { localFetch, ensureBackend } from "@/portal/backend/app";
import { ExcelService } from "@/portal/backend/services/excel.service";
import { AuthService } from "@/portal/backend/services/auth.service";
import { JsonRepository } from "@/portal/backend/storage/db";
import { UserAccount, UserRole } from "@/portal/backend/storage/schemas";

describe("Spreadsheet upload and preview API", () => {
  let authToken = "";
  let tempUserId = "";

  beforeAll(async () => {
    await ensureBackend();
    const usersRepo = new JsonRepository<UserAccount>("users.json");
    const rolesRepo = new JsonRepository<UserRole>("roles.json");
    const roles = await rolesRepo.getAll();
    const adminRole = roles.find((r) => r.isSystemAdmin || r.id === "role_admin") || roles[0];

    const salt = AuthService.generateSalt();
    const hash = AuthService.hashPassword("TestPass@123", salt);
    const tempUser = await usersRepo.create({
      email: "test_upload_runner@elopar.com.br",
      name: "Test Upload Runner",
      passwordHash: hash,
      salt,
      roleId: adminRole.id,
      status: "ACTIVE",
      failedLoginAttempts: 0
    });
    tempUserId = tempUser.id;

    const loginRes = await localFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test_upload_runner@elopar.com.br", password: "TestPass@123" })
    });

    const loginData = await loginRes.json();
    authToken = loginData.session?.token;
  });

  afterAll(async () => {
    if (tempUserId) {
      const usersRepo = new JsonRepository<UserAccount>("users.json");
      await usersRepo.delete(tempUserId);
    }
  });

  it("successfully previews tecban template spreadsheet without 'Nenhum arquivo enviado' error", async () => {
    const buffer = ExcelService.generateTemplateBuffer("tecban");
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const formData = new FormData();
    formData.append("file", blob, "modelo_tecban.xlsx");

    const res = await localFetch("/api/spreadsheets/preview/tecban", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: formData
    });

    if (res.status !== 200) {
      console.log('Test error response:', await res.json());
    }
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalRows).toBeGreaterThan(0);
    expect(data.fileName).toBe("modelo_tecban.xlsx");
    expect(Array.isArray(data.rows)).toBe(true);
  });

  it("successfully previews csv file via FormData", async () => {
    const csvContent = "Data;Saldo D0 Banco (R$);Saldo D0 Tecban (R$);Saldo D1 Banco (R$);Saldo D1 Tecban (R$);Observações\n30/10/2026;1500000,00;1500000,00;1200000,00;1200000,00;Fechamento regular\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", blob, "dados_tecban.csv");

    const res = await localFetch("/api/spreadsheets/preview/tecban", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: formData
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalRows).toBe(1);
    expect(data.validRowsCount).toBe(1);
  });

  it("successfully commits spreadsheet data via FormData", async () => {
    const csvContent = "Data;Saldo D0 Banco (R$);Saldo D0 Tecban (R$);Saldo D1 Banco (R$);Saldo D1 Tecban (R$);Observações\n29/10/2026;2000000,00;2000000,00;1800000,00;1800000,00;Importado via teste automatizado\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", blob, "dados_tecban_commit.csv");
    formData.append("duplicateStrategy", "replace");
    formData.append("notes", "Teste automatizado");

    const res = await localFetch("/api/spreadsheets/commit/tecban", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: formData
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.summary.totalRows).toBe(1);
    expect(data.summary.insertedCount + data.summary.updatedCount).toBeGreaterThanOrEqual(1);
  });
});
