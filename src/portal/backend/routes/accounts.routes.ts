// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import { JsonRepository } from '../storage/db';
import { Bank, CurrentAccount, BankAgreement, BankAccess, Company } from '../storage/schemas';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();
const banksRepo = new JsonRepository<Bank>('banks.json');
const accountsRepo = new JsonRepository<CurrentAccount>('current_accounts.json');
const agreementsRepo = new JsonRepository<BankAgreement>('bank_agreements.json');
const accessesRepo = new JsonRepository<BankAccess>('bank_accesses.json');
const currentAccountsRepo = new JsonRepository<CurrentAccount>('current_accounts.json');
const companiesRepo = new JsonRepository<Company>('companies.json');

// List banks
router.get('/banks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const banks = await banksRepo.getAll();
    res.json(banks.sort((a, b) => a.code.localeCompare(b.code)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create bank
router.post('/banks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) {
      res.status(400).json({ error: 'Código FEBRABAN e Nome do Banco são obrigatórios.' });
      return;
    }
    const bank = await banksRepo.create({ code: code.trim(), name: name.trim() });
    res.status(201).json(bank);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- CURRENT ACCOUNTS ---

router.get('/current-accounts', requireAuth, requirePermission('current_accounts', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const accounts = await accountsRepo.getAll();
    const companies = await companiesRepo.getAll();
    const banks = await banksRepo.getAll();

    const compMap = new Map(companies.map((c) => [c.id, c]));
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    const enriched = accounts.map((acc) => ({
      ...acc,
      company: compMap.get(acc.companyId) || null,
      bank: bankMap.get(acc.bankId) || null
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/current-accounts', requireAuth, requirePermission('current_accounts', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, bankId, agency, accountNumber, hasIntradayLimit, intradayLimitAmount, hasAutoInvestment, hasSweeping, sweepingDestinationAccount, notes } = req.body;

    if (!companyId || !bankId || !agency || !accountNumber) {
      res.status(400).json({ error: 'Empresa, Banco, Agência e Conta Corrente são campos obrigatórios.' });
      return;
    }
    if (hasIntradayLimit && !String(intradayLimitAmount || '').trim()) {
      res.status(400).json({ error: 'Informe o valor do limite Intraday.' });
      return;
    }
    if (hasSweeping && !String(sweepingDestinationAccount || '').trim()) {
      res.status(400).json({ error: 'Informe a conta corrente de destino do tombamento.' });
      return;
    }

    const created = await accountsRepo.create({
      companyId,
      bankId,
      agency: String(agency).trim(),
      accountNumber: String(accountNumber).trim(),
      hasIntradayLimit: !!hasIntradayLimit,
      intradayLimitAmount: hasIntradayLimit ? String(intradayLimitAmount || '').trim() : '',
      hasAutoInvestment: !!hasAutoInvestment,
      hasSweeping: !!hasSweeping,
      sweepingDestinationAccount: hasSweeping ? String(sweepingDestinationAccount || '').trim() : '',
      active: true,
      notes: notes?.trim()
    });

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'current_accounts',
      action: 'CREATE',
      recordId: created.id,
      summary: `Conta corrente cadastrada: Agência ${created.agency} Conta ${created.accountNumber}`,
      newValue: created,
      ipAddress: req.ip
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/current-accounts/:id', requireAuth, requirePermission('current_accounts', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await accountsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Conta corrente não encontrada.' });
      return;
    }

    if (req.body.hasIntradayLimit && !String(req.body.intradayLimitAmount || '').trim()) {
      res.status(400).json({ error: 'Informe o valor do limite Intraday.' });
      return;
    }
    if (req.body.hasSweeping && !String(req.body.sweepingDestinationAccount || '').trim()) {
      res.status(400).json({ error: 'Informe a conta corrente de destino do tombamento.' });
      return;
    }

    const updated = await accountsRepo.update(id, {
      ...req.body,
      agency: req.body.agency !== undefined ? String(req.body.agency).trim() : existing.agency,
      accountNumber: req.body.accountNumber !== undefined ? String(req.body.accountNumber).trim() : existing.accountNumber,
      intradayLimitAmount: req.body.hasIntradayLimit ? String(req.body.intradayLimitAmount || '').trim() : '',
      sweepingDestinationAccount: req.body.hasSweeping ? String(req.body.sweepingDestinationAccount || '').trim() : ''
    });

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'current_accounts',
      action: 'UPDATE',
      recordId: id,
      summary: `Conta corrente atualizada: Agência ${updated?.agency} Conta ${updated?.accountNumber}`,
      previousValue: existing,
      newValue: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/current-accounts/:id', requireAuth, requirePermission('current_accounts', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await accountsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Conta corrente não encontrada.' });
      return;
    }

    await accountsRepo.delete(id);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'current_accounts',
      action: 'DELETE',
      recordId: id,
      summary: `Conta corrente excluída: Agência ${existing.agency} Conta ${existing.accountNumber}`,
      previousValue: existing,
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- BANK AGREEMENTS ---

router.get('/agreements', requireAuth, requirePermission('agreements', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const agreements = await agreementsRepo.getAll();
    const companies = await companiesRepo.getAll();
    const banks = await banksRepo.getAll();
    const currentAccounts = await currentAccountsRepo.getAll();

    const compMap = new Map(companies.map((c) => [c.id, c]));
    const bankMap = new Map(banks.map((b) => [b.id, b]));
    const accountMap = new Map(currentAccounts.map((a) => [a.id, a]));

    const enriched = agreements.map((agr) => ({
      ...agr,
      company: compMap.get(agr.companyId) || null,
      bank: bankMap.get(agr.bankId) || null,
      currentAccount: accountMap.get(agr.currentAccountId) || null
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agreements', requireAuth, requirePermission('agreements', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bankId, companyId, currentAccountId, agreementType, agreementCode, managerName, notes } = req.body;
    if (!bankId || !companyId || !currentAccountId || !agreementType || !agreementCode) {
      res.status(400).json({ error: 'Banco, Empresa, Conta Corrente, Tipo e Código do Convênio são obrigatórios.' });
      return;
    }

    const linkedAccount = await currentAccountsRepo.getById(currentAccountId);
    if (!linkedAccount || linkedAccount.bankId !== bankId || linkedAccount.companyId !== companyId) {
      res.status(400).json({ error: 'A conta corrente deve pertencer à empresa e ao banco selecionados.' });
      return;
    }
    if (!['PAGFOR', 'COBRANCA', 'OUTROS'].includes(agreementType)) {
      res.status(400).json({ error: 'Tipo de convênio inválido.' });
      return;
    }
    const created = await agreementsRepo.create({
      bankId,
      companyId,
      currentAccountId,
      agreementType,
      agreementCode: String(agreementCode).trim(),
      managerName: String(managerName || '').trim(),
      active: true,
      notes: notes?.trim()
    });

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'agreements',
      action: 'CREATE',
      recordId: created.id,
      summary: `Convênio bancário cadastrado: Código ${created.agreementCode} (${created.agreementType})`,
      newValue: created,
      ipAddress: req.ip
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/agreements/:id', requireAuth, requirePermission('agreements', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await agreementsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Convênio não encontrado.' });
      return;
    }

    const patch = { ...req.body };
    if (patch.currentAccountId) {
      const linkedAccount = await currentAccountsRepo.getById(patch.currentAccountId);
      const targetCompany = patch.companyId || existing.companyId;
      const targetBank = patch.bankId || existing.bankId;
      if (!linkedAccount || linkedAccount.companyId !== targetCompany || linkedAccount.bankId !== targetBank) {
        res.status(400).json({ error: 'A conta corrente deve pertencer à empresa e ao banco selecionados.' });
        return;
      }
    }
    if (patch.agreementType && !['PAGFOR', 'COBRANCA', 'OUTROS'].includes(patch.agreementType)) {
      res.status(400).json({ error: 'Tipo de convênio inválido.' });
      return;
    }
    const updated = await agreementsRepo.update(id, patch);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'agreements',
      action: 'UPDATE',
      recordId: id,
      summary: `Convênio atualizado: Código ${updated?.agreementCode}`,
      previousValue: existing,
      newValue: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/agreements/:id', requireAuth, requirePermission('agreements', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await agreementsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Convênio não encontrado.' });
      return;
    }

    await agreementsRepo.delete(id);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'agreements',
      action: 'DELETE',
      recordId: id,
      summary: `Convênio excluído: Código ${existing.agreementCode}`,
      previousValue: existing,
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- BANK ACCESSES ---

router.get('/accesses', requireAuth, requirePermission('accesses', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const accesses = await accessesRepo.getAll();
    const companies = await companiesRepo.getAll();
    const banks = await banksRepo.getAll();

    const compMap = new Map(companies.map((c) => [c.id, c]));
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    const enriched = accesses.map((acc) => ({
      ...acc,
      company: compMap.get(acc.companyId) || null,
      bank: bankMap.get(acc.bankId) || null
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accesses', requireAuth, requirePermission('accesses', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId, bankId, accessProfile, userName, managerName, notes } = req.body;
    if (!companyId || !bankId || !accessProfile || !userName) {
      res.status(400).json({ error: 'Empresa, Banco, Perfil de Acesso e Nome do Usuário são obrigatórios.' });
      return;
    }

    const created = await accessesRepo.create({
      companyId,
      bankId,
      accessProfile: String(accessProfile).trim(),
      userName: String(userName).trim(),
      managerName: String(managerName || '').trim(),
      active: true,
      notes: notes?.trim()
    });

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'accesses',
      action: 'CREATE',
      recordId: created.id,
      summary: `Acesso bancário cadastrado para: ${created.userName} (Perfil: ${created.accessProfile})`,
      newValue: created,
      ipAddress: req.ip
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/accesses/:id', requireAuth, requirePermission('accesses', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await accessesRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Acesso bancário não encontrado.' });
      return;
    }

    const updated = await accessesRepo.update(id, req.body);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'accesses',
      action: 'UPDATE',
      recordId: id,
      summary: `Acesso bancário atualizado para: ${updated?.userName}`,
      previousValue: existing,
      newValue: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/accesses/:id', requireAuth, requirePermission('accesses', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await accessesRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Acesso bancário não encontrado.' });
      return;
    }

    await accessesRepo.delete(id);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'accesses',
      action: 'DELETE',
      recordId: id,
      summary: `Acesso bancário excluído: ${existing.userName}`,
      previousValue: existing,
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
