// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { JsonRepository } from './db';
import { Company, Director, CompanyDirector, CurrentAccount, BankAgreement, BankAccess, IndicatorRecord, CashProjection, TecbanRecord, LoanContract } from './schemas';

export async function seedInitialBusinessData(): Promise<void> {
  const companiesRepo = new JsonRepository<Company>('companies.json');
  const directorsRepo = new JsonRepository<Director>('directors.json');
  const relationsRepo = new JsonRepository<CompanyDirector>('company_directors.json');
  const accountsRepo = new JsonRepository<CurrentAccount>('current_accounts.json');
  const agreementsRepo = new JsonRepository<BankAgreement>('bank_agreements.json');
  const accessesRepo = new JsonRepository<BankAccess>('bank_accesses.json');
  const indicatorsRepo = new JsonRepository<IndicatorRecord>('indicators.json');
  const cashRepo = new JsonRepository<CashProjection>('cash_projections.json');
  const tecbanRepo = new JsonRepository<TecbanRecord>('tecban_records.json');
  const loansRepo = new JsonRepository<LoanContract>('loan_contracts.json');

  const existingCompanies = await companiesRepo.getAll();
  if (existingCompanies.length === 0) {
    // 1. Statutory Directors
    const dir1 = await directorsRepo.create({ name: 'Eduardo Chedid', active: true });
    const dir2 = await directorsRepo.create({ name: 'Roberto Valério', active: true });
    const dir3 = await directorsRepo.create({ name: 'Luciana Martins', active: true });

    // 2. Companies
    const comp1 = await companiesRepo.create({
      id: 'comp_elo_part',
      tradeName: 'Elo Participações',
      legalName: 'Elo Participações S.A.',
      cnpj: '11.234.567/0001-89',
      state: 'SP',
      city: 'Barueri',
      active: true
    });

    const comp2 = await companiesRepo.create({
      id: 'comp_elo_servicos',
      tradeName: 'Elo Serviços',
      legalName: 'Elo Serviços S.A.',
      cnpj: '09.227.084/0001-75',
      state: 'SP',
      city: 'Barueri',
      active: true
    });

    const comp3 = await companiesRepo.create({
      id: 'comp_livelo',
      tradeName: 'Livelo Fidelidade',
      legalName: 'Livelo S.A.',
      cnpj: '12.888.999/0001-44',
      state: 'SP',
      city: 'Barueri',
      active: true
    });

    // 3. Link directors
    await relationsRepo.create({ companyId: comp1.id, directorId: dir1.id, active: true });
    await relationsRepo.create({ companyId: comp1.id, directorId: dir2.id, active: true });
    await relationsRepo.create({ companyId: comp2.id, directorId: dir1.id, active: true });
    await relationsRepo.create({ companyId: comp2.id, directorId: dir3.id, active: true });
    await relationsRepo.create({ companyId: comp3.id, directorId: dir2.id, active: true });

    // 4. Current Accounts
    await accountsRepo.create({
      companyId: comp1.id,
      bankId: 'bank_001',
      agency: '0100',
      accountNumber: '00012345-6',
      hasIntradayLimit: true,
      hasAutoInvestment: true,
      hasSweeping: false,
      active: true,
      notes: 'Conta Principal Centralizadora'
    });

    await accountsRepo.create({
      companyId: comp2.id,
      bankId: 'bank_237',
      agency: '3456',
      accountNumber: '00098765-4',
      hasIntradayLimit: true,
      hasAutoInvestment: true,
      hasSweeping: true,
      active: true,
      notes: 'Arrecadação e Liquidação de Estabelecimentos'
    });

    await accountsRepo.create({
      companyId: comp2.id,
      bankId: 'bank_341',
      agency: '0050',
      accountNumber: '00055443-2',
      hasIntradayLimit: false,
      hasAutoInvestment: true,
      hasSweeping: false,
      active: true,
      notes: 'Conta Reserva Operacional'
    });

    // 5. Bank Agreements
    await agreementsRepo.create({
      companyId: comp2.id,
      bankId: 'bank_001',
      agreementType: 'COBRANCA',
      agreementCode: '0087654321',
      managerName: 'Mariana Silveira',
      active: true,
      notes: 'Convênio com liquidação D+1'
    });

    await agreementsRepo.create({
      companyId: comp2.id,
      bankId: 'bank_237',
      agreementType: 'PAGFOR',
      agreementCode: '00445566-01',
      managerName: 'Carlos Drummond',
      active: true,
      notes: 'Lote de folha e pagamentos a terceiros'
    });

    // 6. Bank Accesses (strictly separate from app login)
    await accessesRepo.create({
      companyId: comp2.id,
      bankId: 'bank_001',
      accessProfile: 'Master / Aprovador Nível 3',
      userName: 'Carlos Silva',
      managerName: 'Mariana Silveira',
      active: true,
      notes: 'Acesso com token físico e certificação digital'
    });

    await accessesRepo.create({
      companyId: comp2.id,
      bankId: 'bank_237',
      accessProfile: 'Operador Financeiro / Remessa',
      userName: 'Camila Fernandes',
      managerName: 'Carlos Silva',
      active: true
    });

    // 7. Indicators history
    const baseIndicators = [
      { date: '2026-10-26', cdiR: '10.65', cdiP: '10.50', b: '1.4250', c: '1.3810', j: '1.5090', cal: '1.2910', bb: '1.1860' },
      { date: '2026-10-27', cdiR: '10.65', cdiP: '10.50', b: '1.4261', c: '1.3822', j: '1.5101', cal: '1.2921', bb: '1.1872' },
      { date: '2026-10-28', cdiR: '10.65', cdiP: '10.50', b: '1.4273', c: '1.3835', j: '1.5112', cal: '1.2932', bb: '1.1884' },
      { date: '2026-10-29', cdiR: '10.65', cdiP: '10.50', b: '1.4281', c: '1.3846', j: '1.5119', cal: '1.2939', bb: '1.1891' },
      { date: '2026-10-30', cdiR: '10.65', cdiP: '10.50', b: '1.4285', c: '1.3854', j: '1.5120', cal: '1.2941', bb: '1.1895' }
    ];

    for (const ind of baseIndicators) {
      await indicatorsRepo.create({
        date: ind.date,
        cdiRealizedAnnual: ind.cdiR,
        cdiProjectedAnnual: ind.cdiP,
        quotaBarauna: ind.b,
        quotaCarnauba: ind.c,
        quotaJacaranda: ind.j,
        quotaCaliandra: ind.cal,
        quotaBBCorporateFacil: ind.bb,
        versionId: 'v_initial_seed'
      });
    }

    // 8. Cash Projections
    await cashRepo.create({
      companyId: comp1.id,
      date: '2026-10-30',
      actualBalance: '25450000.00',
      actualInflow: '4200000.00',
      actualOutflow: '1850000.00',
      projectedBalance: '26000000.00',
      projectedInflow: '4000000.00',
      projectedOutflow: '2100000.00'
    });

    await cashRepo.create({
      companyId: comp2.id,
      date: '2026-10-30',
      actualBalance: '48320000.00',
      actualInflow: '12400000.00',
      actualOutflow: '9800000.00',
      projectedBalance: '49500000.00',
      projectedInflow: '11900000.00',
      projectedOutflow: '10200000.00'
    });

    // 9. Tecban Records
    await tecbanRepo.create({
      date: '2026-10-28',
      actualBalance: '81200000.00',
      actualWithdrawals: '11500000.00',
      actualReloads: '14000000.00',
      projectedBalance: '82000000.00',
      projectedWithdrawals: '11200000.00',
      projectedReloads: '13800000.00'
    });

    await tecbanRepo.create({
      date: '2026-10-29',
      actualBalance: '82100000.00',
      actualWithdrawals: '12100000.00',
      actualReloads: '14500000.00',
      projectedBalance: '83000000.00',
      projectedWithdrawals: '11900000.00',
      projectedReloads: '14200000.00'
    });

    await tecbanRepo.create({
      date: '2026-10-30',
      actualBalance: '83450000.00',
      actualWithdrawals: '12800000.00',
      actualReloads: '15200000.00',
      projectedBalance: '84000000.00',
      projectedWithdrawals: '12300000.00',
      projectedReloads: '15000000.00'
    });

    // 10. Loan Contract
    await loansRepo.create({
      contractNumber: 'ELO-FIN-2026-001',
      companyId: comp2.id,
      bankId: 'bank_001',
      startDate: '2026-01-15',
      maturityDate: '2027-01-15',
      contractedAmount: '20000000.00',
      spreadAnnual: '1.65',
      indexer: 'CDI',
      cdiVersionId: 'v_initial_seed',
      dayCountConvention: 'BUS_252',
      currentOutstandingBalance: '20000000.00',
      active: true,
      notes: 'Capital de Giro Institucional - Indexado ao CDI',
      events: [
        {
          id: 'evt_1',
          plannedDate: '2026-04-15',
          type: 'INTEREST',
          plannedAmortization: '0.00',
          plannedInterest: '625340.12',
          plannedOutstandingBalance: '20000000.00',
          actualDate: '2026-04-15',
          actualInterest: '625340.12',
          actualAmortization: '0.00',
          status: 'SETTLED'
        },
        {
          id: 'evt_2',
          plannedDate: '2026-07-15',
          type: 'INTEREST',
          plannedAmortization: '0.00',
          plannedInterest: '618290.45',
          plannedOutstandingBalance: '20000000.00',
          actualDate: '2026-07-15',
          actualInterest: '618290.45',
          actualAmortization: '0.00',
          status: 'SETTLED'
        },
        {
          id: 'evt_3',
          plannedDate: '2026-10-15',
          type: 'INTEREST',
          plannedAmortization: '0.00',
          plannedInterest: '612140.20',
          plannedOutstandingBalance: '20000000.00',
          actualDate: '2026-10-15',
          actualInterest: '612140.20',
          actualAmortization: '0.00',
          status: 'SETTLED'
        },
        {
          id: 'evt_4',
          plannedDate: '2027-01-15',
          type: 'INTEREST_AND_AMORTIZATION',
          plannedAmortization: '20000000.00',
          plannedInterest: '629850.80',
          plannedOutstandingBalance: '0.00',
          status: 'PENDING'
        }
      ]
    });
  }
}
