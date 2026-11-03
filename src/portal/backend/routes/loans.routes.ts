// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import Decimal from 'decimal.js';
import { JsonRepository } from '../storage/db';
import { LoanContract, LoanSimulation, Company, Bank, IndicatorVersion } from '../storage/schemas';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.middleware';
import { LoanCalculatorService } from '../services/financial-math';
import { AuditService } from '../services/audit.service';

const router = Router();
const contractsRepo = new JsonRepository<LoanContract>('loan_contracts.json');
const simulationsRepo = new JsonRepository<LoanSimulation>('loan_simulations.json');
const companiesRepo = new JsonRepository<Company>('companies.json');
const banksRepo = new JsonRepository<Bank>('banks.json');
const versionsRepo = new JsonRepository<IndicatorVersion>('indicator_versions.json');

// Get loans dashboard KPIs
router.get('/dashboard', requireAuth, requirePermission('loans', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contracts = await contractsRepo.getAll();
    const activeContracts = contracts.filter((c) => c.active);

    let totalContracted = new Decimal(0);
    let totalOutstanding = new Decimal(0);
    let totalProjectedInterest = new Decimal(0);

    const upcomingEvents: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const c of activeContracts) {
      totalContracted = totalContracted.plus(c.contractedAmount || 0);
      totalOutstanding = totalOutstanding.plus(c.currentOutstandingBalance || c.contractedAmount || 0);

      for (const evt of c.events || []) {
        totalProjectedInterest = totalProjectedInterest.plus(evt.plannedInterest || 0);
        if (evt.plannedDate >= today && evt.status === 'PENDING') {
          upcomingEvents.push({
            contractId: c.id,
            contractNumber: c.contractNumber,
            companyId: c.companyId,
            bankId: c.bankId,
            ...evt
          });
        }
      }
    }

    upcomingEvents.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));

    res.json({
      totalContracted: totalContracted.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      totalProjectedInterest: totalProjectedInterest.toFixed(2),
      activeContractsCount: activeContracts.length,
      upcomingEvents: upcomingEvents.slice(0, 10)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all loan contracts
router.get('/', requireAuth, requirePermission('loans', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contracts = await contractsRepo.getAll();
    const companies = await companiesRepo.getAll();
    const banks = await banksRepo.getAll();

    const compMap = new Map(companies.map((c) => [c.id, c]));
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    const enriched = contracts.map((c) => ({
      ...c,
      company: compMap.get(c.companyId) || null,
      bank: bankMap.get(c.bankId) || null
    }));

    res.json(enriched.sort((a, b) => b.startDate.localeCompare(a.startDate)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single loan contract
router.get('/:id', requireAuth, requirePermission('loans', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contract = await contractsRepo.getById(req.params.id);
    if (!contract) {
      res.status(404).json({ error: 'Contrato não encontrado.' });
      return;
    }

    const company = await companiesRepo.getById(contract.companyId);
    const bank = await banksRepo.getById(contract.bankId);

    res.json({
      ...contract,
      company,
      bank
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create loan contract with schedule calculation
router.post('/', requireAuth, requirePermission('loans', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contractNumber, companyId, bankId, startDate, maturityDate, contractedAmount, spreadAnnual, cdiVersionId, events, notes } = req.body;

    if (!contractNumber || !companyId || !bankId || !startDate || !maturityDate || !contractedAmount) {
      res.status(400).json({ error: 'Número do contrato, Empresa, Banco, Datas e Valor contratado são obrigatórios.' });
      return;
    }

    // Project schedule
    const calculation = await LoanCalculatorService.projectLoanSchedule(
      contractedAmount,
      startDate,
      spreadAnnual || '0.00',
      events || [],
      cdiVersionId,
      companyId
    );

    const contract = await contractsRepo.create({
      contractNumber: String(contractNumber).trim(),
      companyId,
      bankId,
      startDate,
      maturityDate,
      contractedAmount: new Decimal(contractedAmount).toFixed(2),
      spreadAnnual: new Decimal(spreadAnnual || 0).toFixed(2),
      indexer: 'CDI',
      cdiVersionId: cdiVersionId || 'default',
      dayCountConvention: 'BUS_252',
      currentOutstandingBalance: new Decimal(contractedAmount).toFixed(2),
      events: calculation.events,
      active: true,
      notes: notes?.trim()
    });

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'loans',
      action: 'CREATE',
      recordId: contract.id,
      summary: `Contrato de empréstimo cadastrado: ${contract.contractNumber} (R$ ${contract.contractedAmount})`,
      newValue: contract,
      ipAddress: req.ip
    });

    res.status(201).json(contract);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update contract or recalculate schedule
router.delete('/:id', requireAuth, requirePermission('loans', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const before = await contractsRepo.getById(req.params.id);
    if (!before) { res.status(404).json({ error: 'Contrato não encontrado.' }); return; }
    await contractsRepo.delete(req.params.id);
    await AuditService.log({ userId: req.user?.userId, userEmail: req.user?.email, module: 'loans', action: 'DELETE', recordId: req.params.id, summary: `Contrato de empréstimo ${before.contractNumber} excluído`, previousValue: before, ipAddress: req.ip });
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requirePermission('loans', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await contractsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Contrato não encontrado.' });
      return;
    }

    const contractedAmount = req.body.contractedAmount || existing.contractedAmount;
    const startDate = req.body.startDate || existing.startDate;
    const spreadAnnual = req.body.spreadAnnual !== undefined ? req.body.spreadAnnual : existing.spreadAnnual;
    const cdiVersionId = req.body.cdiVersionId || existing.cdiVersionId;
    const eventsToCalculate = req.body.events || existing.events;

    const calculation = await LoanCalculatorService.projectLoanSchedule(
      contractedAmount,
      startDate,
      spreadAnnual,
      eventsToCalculate,
      cdiVersionId,
      existing.companyId
    );

    // Calculate current balance based on settled actual amortizations
    let remaining = new Decimal(contractedAmount);
    for (const evt of calculation.events) {
      if (evt.status === 'SETTLED' && evt.actualAmortization) {
        remaining = remaining.minus(evt.actualAmortization);
      }
    }
    if (remaining.isNegative()) remaining = new Decimal(0);

    const updated = await contractsRepo.update(id, {
      ...req.body,
      contractedAmount: new Decimal(contractedAmount).toFixed(2),
      spreadAnnual: new Decimal(spreadAnnual).toFixed(2),
      currentOutstandingBalance: remaining.toFixed(2),
      events: calculation.events
    });

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'loans',
      action: 'UPDATE',
      recordId: id,
      summary: `Contrato ${updated?.contractNumber} atualizado`,
      previousValue: existing,
      newValue: updated,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Record realized event settlement
router.post('/:id/events/:eventId/realize', requireAuth, requirePermission('loans', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, eventId } = req.params;
    const { actualDate, actualInterest, actualAmortization, notes } = req.body;

    const contract = await contractsRepo.getById(id);
    if (!contract) {
      res.status(404).json({ error: 'Contrato não encontrado.' });
      return;
    }

    const eventIndex = contract.events.findIndex((e) => e.id === eventId);
    if (eventIndex === -1) {
      res.status(404).json({ error: 'Evento não encontrado.' });
      return;
    }

    const targetEvent = contract.events[eventIndex];
    targetEvent.actualDate = actualDate || new Date().toISOString().split('T')[0];
    targetEvent.actualInterest = actualInterest !== undefined ? new Decimal(actualInterest).toFixed(2) : targetEvent.plannedInterest;
    targetEvent.actualAmortization = actualAmortization !== undefined ? new Decimal(actualAmortization).toFixed(2) : targetEvent.plannedAmortization;
    targetEvent.status = 'SETTLED';
    if (notes) targetEvent.notes = notes;

    // Recalculate remaining principal balance
    let remainingPrincipal = new Decimal(contract.contractedAmount);
    for (const evt of contract.events) {
      if (evt.status === 'SETTLED' && evt.actualAmortization) {
        remainingPrincipal = remainingPrincipal.minus(evt.actualAmortization);
      }
    }
    if (remainingPrincipal.isNegative()) remainingPrincipal = new Decimal(0);

    contract.currentOutstandingBalance = remainingPrincipal.toFixed(2);
    await contractsRepo.update(id, contract);

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'loans',
      action: 'UPDATE',
      recordId: id,
      summary: `Liquidação realizada registrada no contrato ${contract.contractNumber}: Evento ${eventId}`,
      newValue: targetEvent,
      ipAddress: req.ip
    });

    res.json(contract);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Run loan simulation without altering active contracts
router.post('/simulate', requireAuth, requirePermission('loans', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, companyId, bankId, startDate, maturityDate, principalAmount, spreadAnnual, cdiVersionId, events } = req.body;

    const calculation = await LoanCalculatorService.projectLoanSchedule(
      principalAmount || 0,
      startDate,
      spreadAnnual || 0,
      events || [],
      cdiVersionId,
      companyId
    );

    const simulation = await simulationsRepo.create({
      name: name || `Simulação ${new Date().toLocaleDateString('pt-BR')}`,
      companyId,
      bankId,
      startDate,
      maturityDate,
      principalAmount: new Decimal(principalAmount || 0).toFixed(2),
      spreadAnnual: new Decimal(spreadAnnual || 0).toFixed(2),
      cdiVersionId: cdiVersionId || 'default',
      totalProjectedInterest: calculation.totalProjectedInterest,
      totalCost: new Decimal(principalAmount || 0).plus(calculation.totalProjectedInterest).toFixed(2),
      events: calculation.events,
      createdAtUser: req.user?.email || 'user'
    });

    res.json(simulation);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List simulations
router.get('/simulations/all', requireAuth, requirePermission('loans', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const simulations = await simulationsRepo.getAll();
    res.json(simulations.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
