// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import { JsonRepository } from '../storage/db';
import { Company, Director, CompanyDirector } from '../storage/schemas';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();
const companiesRepo = new JsonRepository<Company>('companies.json');
const directorsRepo = new JsonRepository<Director>('directors.json');
const relationsRepo = new JsonRepository<CompanyDirector>('company_directors.json');

// Validate Brazilian CNPJ algorithm
export function isValidCNPJ(cnpjStr: string): boolean {
  const digits = cnpjStr.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let size = digits.length - 2;
  let numbers = digits.substring(0, size);
  const checkDigits = digits.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(checkDigits.charAt(0))) return false;

  size = size + 1;
  numbers = digits.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === Number(checkDigits.charAt(1));
}

// Format CNPJ as XX.XXX.XXX/XXXX-XX
export function formatCNPJ(cnpjStr: string): string {
  const d = cnpjStr.replace(/\D/g, '');
  if (d.length !== 14) return cnpjStr;
  return `${d.substring(0, 2)}.${d.substring(2, 5)}.${d.substring(5, 8)}/${d.substring(8, 12)}-${d.substring(12, 14)}`;
}

// List companies with their statutory directors
router.get('/', requireAuth, requirePermission('companies', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companies = await companiesRepo.getAll();
    const relations = await relationsRepo.getAll();
    const directors = await directorsRepo.getAll();

    const dirMap = new Map<string, Director>();
    directors.forEach((d) => dirMap.set(d.id, d));

    const enriched = companies.map((comp) => {
      const compRels = relations.filter((r) => r.companyId === comp.id && r.active);
      const compDirectors = compRels
        .map((r) => dirMap.get(r.directorId))
        .filter((d): d is Director => !!d);

      return {
        ...comp,
        directors: compDirectors
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create company
router.post('/', requireAuth, requirePermission('companies', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tradeName, legalName, cnpj, state, city, directorNames } = req.body;

    if (!tradeName || !legalName || !cnpj) {
      res.status(400).json({ error: 'Nome Fantasia, Razão Social e CNPJ são campos obrigatórios.' });
      return;
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (!isValidCNPJ(cleanCnpj)) {
      res.status(400).json({ error: 'Número de CNPJ inválido segundo as regras da Receita Federal.' });
      return;
    }

    const formatted = formatCNPJ(cleanCnpj);

    // Check duplicate
    const existing = await companiesRepo.getAll();
    const duplicate = existing.find((c) => c.cnpj.replace(/\D/g, '') === cleanCnpj);
    if (duplicate) {
      res.status(400).json({ error: `Já existe empresa cadastrada com este CNPJ (${duplicate.tradeName}).` });
      return;
    }

    const company = await companiesRepo.create({
      tradeName: tradeName.trim(),
      legalName: legalName.trim(),
      cnpj: formatted,
      state: state ? state.trim().toUpperCase() : undefined,
      city: city ? city.trim() : undefined,
      active: true
    });

    // Handle directors if provided (e.g. array or comma-separated)
    let namesList: string[] = [];
    if (Array.isArray(directorNames)) {
      namesList = directorNames;
    } else if (typeof directorNames === 'string') {
      namesList = directorNames.split(',').map((s) => s.trim()).filter(Boolean);
    }

    for (const name of namesList) {
      if (!name) continue;
      // Find or create director
      const allDirs = await directorsRepo.getAll();
      let dir = allDirs.find((d) => d.name.toLowerCase() === name.toLowerCase());
      if (!dir) {
        dir = await directorsRepo.create({ name: name.trim(), active: true });
      }
      await relationsRepo.create({
        companyId: company.id,
        directorId: dir.id,
        active: true
      });
    }

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'companies',
      action: 'CREATE',
      recordId: company.id,
      summary: `Empresa cadastrada: ${company.tradeName} (${company.cnpj})`,
      newValue: company,
      ipAddress: req.ip
    });

    res.status(201).json(company);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update company
router.put('/:id', requireAuth, requirePermission('companies', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tradeName, legalName, cnpj, state, city, active, directorNames } = req.body;

    const existing = await companiesRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Empresa não encontrada.' });
      return;
    }

    let formattedCnpj = existing.cnpj;
    if (cnpj) {
      const clean = cnpj.replace(/\D/g, '');
      if (!isValidCNPJ(clean)) {
        res.status(400).json({ error: 'CNPJ inválido.' });
        return;
      }
      formattedCnpj = formatCNPJ(clean);

      // Verify duplicate CNPJ with other companies
      const allCompanies = await companiesRepo.getAll();
      const duplicate = allCompanies.find((c) => c.id !== id && c.cnpj.replace(/\D/g, '') === clean);
      if (duplicate) {
        res.status(400).json({ error: `Outra empresa (${duplicate.tradeName}) já utiliza este CNPJ.` });
        return;
      }
    }

    const updated = await companiesRepo.update(id, {
      tradeName: tradeName?.trim() || existing.tradeName,
      legalName: legalName?.trim() || existing.legalName,
      cnpj: formattedCnpj,
      state: state !== undefined ? state.trim().toUpperCase() : existing.state,
      city: city !== undefined ? city.trim() : existing.city,
      active: active !== undefined ? !!active : existing.active
    });

    // Update directors if list provided
    if (directorNames !== undefined) {
      const namesList: string[] = Array.isArray(directorNames)
        ? directorNames
        : typeof directorNames === 'string'
        ? directorNames.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      // Remove existing relations
      const allRels = await relationsRepo.getAll();
      const existingRels = allRels.filter((r) => r.companyId === id);
      for (const r of existingRels) {
        await relationsRepo.delete(r.id);
      }

      // Add new
      for (const name of namesList) {
        if (!name) continue;
        const allDirs = await directorsRepo.getAll();
        let dir = allDirs.find((d) => d.name.toLowerCase() === name.toLowerCase());
        if (!dir) {
          dir = await directorsRepo.create({ name: name.trim(), active: true });
        }
        await relationsRepo.create({
          companyId: id,
          directorId: dir.id,
          active: true
        });
      }
    }

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'companies',
      action: 'UPDATE',
      recordId: id,
      summary: `Empresa atualizada: ${updated?.tradeName}`,
      previousValue: existing,
      newValue: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete company
router.delete('/:id', requireAuth, requirePermission('companies', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await companiesRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Empresa não encontrada.' });
      return;
    }

    // Bloqueia exclusão de empresa com registros vinculados (evita contas/convênios órfãos)
    const linked: string[] = [];
    const checks: Array<[string, string, string[]]> = [
      ['current_accounts.json', 'contas correntes', ['companyId']],
      ['bank_agreements.json', 'convênios', ['companyId']],
      ['bank_accesses.json', 'acessos bancários', ['companyId']],
      ['cash_projections.json', 'projeções de caixa', ['companyId']],
      ['tariffs.json', 'tarifas', ['companyId']],
      ['loan_contracts.json', 'empréstimos', ['companyId']],
    ];
    for (const [file, label, keys] of checks) {
      const n = (await new JsonRepository<any>(file).getAll()).filter((r) => keys.some((k) => r[k] === id)).length;
      if (n) linked.push(`${n} ${label}`);
    }
    if (linked.length) {
      res.status(409).json({ error: `Não é possível excluir: a empresa possui ${linked.join(', ')} vinculados. Remova ou transfira esses registros antes.` });
      return;
    }

    await companiesRepo.delete(id);

    // Remove relations
    const allRels = await relationsRepo.getAll();
    for (const r of allRels.filter((r) => r.companyId === id)) {
      await relationsRepo.delete(r.id);
    }

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'companies',
      action: 'DELETE',
      recordId: id,
      summary: `Empresa excluída: ${existing.tradeName} (${existing.cnpj})`,
      previousValue: existing,
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List statutory directors
router.get('/directors/all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const directors = await directorsRepo.getAll();
    res.json(directors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
