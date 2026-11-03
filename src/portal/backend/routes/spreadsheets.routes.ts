// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import multer from '../shims/multer';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.middleware';
import { ExcelService, MODULE_TEMPLATES } from '../services/excel.service';
import { AuditService } from '../services/audit.service';
import { JsonRepository } from '../storage/db';
import { SystemModule, Company, Bank, IndicatorVersion } from '../storage/schemas';
import { isValidCNPJ, formatCNPJ } from './companies.routes';

const router = Router();
const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

const companiesRepo = new JsonRepository<Company>('companies.json');
const banksRepo = new JsonRepository<Bank>('banks.json');
const indicatorVersionsRepo = new JsonRepository<IndicatorVersion>('indicator_versions.json');

router.get('/templates/all', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const buffer = ExcelService.generateAllTemplatesBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="todos_os_modelos.xlsx"');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download template
router.get('/template/:module', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { module } = req.params;
    const tmpl = MODULE_TEMPLATES[module];
    if (!tmpl) {
      res.status(404).json({ error: `Modelo não localizado para o módulo ${module}.` });
      return;
    }

    const buffer = ExcelService.generateTemplateBuffer(module);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${tmpl.filename}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { isValidDateBR, parseDateToISO, formatDateBR } from '../utils/date';


// Converte valores monetários/percentuais digitados no padrão brasileiro
// (1.234.567,89) para decimal canônico (1234567.89), preservando precisão.
function normalizeDecimalInput(value: unknown, fallback: string | null = '0.00'): string | null {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  let text = String(value).trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error(`Valor numérico inválido: ${String(value)}`);
  return text;
}

// Helper validation per module row
async function validateRow(
  module: string,
  row: Record<string, any>,
  rowIndex: number,
  allCompanies: Company[] = []
): Promise<{ isValid: boolean; errors: string[]; key?: string }> {
  const errors: string[] = [];
  let key: string | undefined;

  // Helper to resolve company by name or CNPJ
  const findCompany = (query: string): Company | undefined => {
    if (!query) return undefined;
    const cleanQuery = query.trim().toLowerCase();
    const cleanDigits = query.replace(/\D/g, '');
    return allCompanies.find((c) => {
      if (cleanDigits && c.cnpj.replace(/\D/g, '') === cleanDigits) return true;
      if (c.tradeName && c.tradeName.trim().toLowerCase() === cleanQuery) return true;
      if (c.legalName && c.legalName.trim().toLowerCase() === cleanQuery) return true;
      return false;
    });
  };

  switch (module) {
    case 'companies': {
      const nome = row['Nome Fantasia'] || row['nomeFantasia'] || row['tradeName'];
      const razao = row['Razão Social'] || row['razaoSocial'] || row['legalName'];
      const cnpj = row['CNPJ'] || row['cnpj'];

      if (!nome) errors.push('Nome Fantasia é obrigatório.');
      if (!razao) errors.push('Razão Social é obrigatória.');
      if (!cnpj) {
        errors.push('CNPJ é obrigatório.');
      } else {
        const clean = String(cnpj).replace(/\D/g, '');
        if (!isValidCNPJ(clean)) {
          errors.push(`CNPJ inválido (${cnpj}).`);
        } else {
          key = formatCNPJ(clean);
        }
      }
      break;
    }
    case 'current_accounts': {
      const empresaInput = row['Nome da Empresa'] || row['Empresa'] || row['CNPJ Empresa'] || row['cnpj'];
      const banco = row['Código Banco'] || row['codigoBanco'];
      const ag = row['Agência'] || row['agencia'];
      const cc = row['Conta Corrente'] || row['contaCorrente'];
      const intraday = String(row['Limite Intraday (Sim/Não)'] || '').trim().toLowerCase().startsWith('s');
      const sweeping = String(row['Tombamento (Sim/Não)'] || '').trim().toLowerCase().startsWith('s');
      const intradayValue = row['Valor Limite Intraday (R$)'];
      const sweepingDestination = row['Conta Destino Tombamento'];

      if (!empresaInput) {
        errors.push('Nome da Empresa é obrigatório.');
      } else if (!findCompany(String(empresaInput))) {
        errors.push(`Empresa "${empresaInput}" não encontrada no cadastro.`);
      }

      if (!banco) errors.push('Código do banco é obrigatório.');
      if (!ag) errors.push('Agência é obrigatória.');
      if (!cc) errors.push('Conta corrente é obrigatória.');
      if (intraday && (intradayValue === undefined || String(intradayValue).trim() === '')) errors.push('Valor Limite Intraday (R$) é obrigatório quando Limite Intraday=Sim.');
      if (sweeping && !sweepingDestination) errors.push('Conta Destino Tombamento é obrigatória quando Tombamento=Sim.');

      if (empresaInput && ag && cc) {
        key = `${String(empresaInput).trim()}_${banco}_${ag}_${cc}`;
      }
      break;
    }
    case 'agreements': {
      const empresaInput = row['Nome da Empresa'] || row['Empresa'] || row['CNPJ Empresa'] || row['cnpj'];
      const banco = row['Código Banco'] || row['codigoBanco'];
      const tipo = row['Tipo do Convênio (PAGFOR/COBRANCA/OUTROS)'] || row['Tipo do Convênio'] || row['tipoConvenio'];
      const conta = row['Conta Corrente'] || row['contaCorrente'];
      const codigo = row['Código do Convênio'] || row['codigoConvenio'];

      if (!empresaInput) {
        errors.push('Nome da Empresa é obrigatório.');
      } else if (!findCompany(String(empresaInput))) {
        errors.push(`Empresa "${empresaInput}" não encontrada no cadastro.`);
      }

      if (!banco) errors.push('Código do banco é obrigatório.');
      if (!conta) errors.push('Conta Corrente é obrigatória.');
      if (!tipo) errors.push('Tipo do convênio é obrigatório.');
      if (tipo && !['PAGFOR','COBRANCA','OUTROS'].includes(String(tipo).trim().toUpperCase())) errors.push('Tipo do convênio deve ser PAGFOR, COBRANCA ou OUTROS.');
      if (!codigo) errors.push('Código do convênio é obrigatório.');

      if (codigo) key = String(codigo).trim();
      break;
    }
    case 'accesses': {
      const empresaInput = row['Nome da Empresa'] || row['Empresa'] || row['CNPJ Empresa'] || row['cnpj'];
      const banco = row['Código Banco'] || row['codigoBanco'];
      const perfil = row['Perfil de Acesso'] || row['perfilAcesso'];
      const usuario = row['Nome do Usuário'] || row['nomeUsuario'];

      if (!empresaInput) {
        errors.push('Nome da Empresa é obrigatório.');
      } else if (!findCompany(String(empresaInput))) {
        errors.push(`Empresa "${empresaInput}" não encontrada no cadastro.`);
      }

      if (!banco) errors.push('Código do banco é obrigatório.');
      if (!perfil) errors.push('Perfil de acesso é obrigatório.');
      if (!usuario) errors.push('Nome do usuário é obrigatório.');

      if (empresaInput && banco && usuario) {
        key = `${String(empresaInput).trim()}_${banco}_${usuario}`;
      }
      break;
    }
    case 'indicators': {
      const data = row['Data'] || row['data'] || row['Date'];
      if (!data) {
        errors.push('Data é obrigatória.');
      } else if (!isValidDateBR(data)) {
        errors.push('Formato de data inválido. Use DD/MM/AAAA.');
      } else {
        key = parseDateToISO(data);
      }
      break;
    }
    case 'cash_projections': {
      const empresaInput = row['Nome da Empresa'] || row['Empresa'] || row['CNPJ Empresa'] || row['cnpj'];
      const data = row['Data'] || row['data'];

      if (!empresaInput) {
        errors.push('Nome da Empresa é obrigatório.');
      } else if (!findCompany(String(empresaInput))) {
        errors.push(`Empresa "${empresaInput}" não encontrada no cadastro.`);
      }

      if (!data) {
        errors.push('Data é obrigatória.');
      } else if (!isValidDateBR(data)) {
        errors.push('Formato de data inválido. Use DD/MM/AAAA.');
      }

      if (empresaInput && data) {
        const iso = isValidDateBR(data) ? parseDateToISO(data) : String(data);
        key = `${String(empresaInput).trim()}_${iso}`;
      }
      break;
    }
    case 'tecban': {
      const data = row['Data'] || row['data'];
      if (!data) {
        errors.push('Data é obrigatória.');
      } else if (!isValidDateBR(data)) {
        errors.push('Formato de data inválido. Use DD/MM/AAAA.');
      } else {
        key = parseDateToISO(data);
      }
      break;
    }
    case 'tariffs': {
      const empresaInput = row['Nome da Empresa'] || row['Empresa'];
      if (!empresaInput) errors.push('Nome da Empresa é obrigatório.');
      else if (!findCompany(String(empresaInput))) errors.push(`Empresa "${empresaInput}" não encontrada no cadastro.`);
      if (!row['Código Banco']) errors.push('Código do banco é obrigatório.');
      if (!row['Nome da Tarifa']) errors.push('Nome da tarifa é obrigatório.');
      if (!row['Tipo']) errors.push('Tipo é obrigatório.');
      if (!row['Tarifa Unitária (R$)']) errors.push('Tarifa unitária é obrigatória.');
      const val = row['Data de Validade'];
      if (!val) errors.push('Data de validade é obrigatória.');
      else if (!isValidDateBR(val)) errors.push('Formato de data inválido. Use DD/MM/AAAA.');
      if (empresaInput && row['Nome da Tarifa']) key = `${String(empresaInput).trim()}_${row['Código Banco']}_${row['Conta Corrente'] || ''}_${row['Nome da Tarifa']}`;
      break;
    }
    case 'bank_contacts': {
      if (!row['Código Banco']) errors.push('Código do banco é obrigatório.');
      break;
    }
    case 'dividends_jcp': {
      for (const col of ['Empresa Origem', 'Empresa Destino']) {
        if (!row[col]) errors.push(`${col} é obrigatória.`);
        else if (!findCompany(String(row[col]))) errors.push(`Empresa "${row[col]}" não encontrada no cadastro.`);
      }
      if (!row['Data'] || !isValidDateBR(row['Data'])) errors.push('Data inválida. Use DD/MM/AAAA.');
      if (!row['Valor (R$)']) errors.push('Valor é obrigatório.');
      if (!['Dividendos', 'JCP'].includes(String(row['Tipo (Dividendos/JCP)'] || '').trim())) errors.push('Tipo deve ser Dividendos ou JCP.');
      break;
    }
    case 'loans': {
      if (!row['Número do Contrato']) errors.push('Número do contrato é obrigatório.');
      else key = String(row['Número do Contrato']).trim();
      if (!row['Nome da Empresa'] || !findCompany(String(row['Nome da Empresa']))) errors.push(`Empresa "${row['Nome da Empresa'] || ''}" não encontrada no cadastro.`);
      if (!row['Código Banco']) errors.push('Código do banco é obrigatório.');
      for (const col of ['Data de Início', 'Data de Vencimento']) if (!row[col] || !isValidDateBR(row[col])) errors.push(`${col} inválida. Use DD/MM/AAAA.`);
      if (!row['Valor Contratado (R$)']) errors.push('Valor contratado é obrigatório.');
      if (row['Spread (% a.a.)'] === undefined || row['Spread (% a.a.)'] === '') errors.push('Spread é obrigatório.');
      break;
    }
    case 'judicial_blocks': {
      if (!row['Nome da Empresa'] || !findCompany(String(row['Nome da Empresa']))) errors.push(`Empresa "${row['Nome da Empresa'] || ''}" não encontrada no cadastro.`);
      if (!row['Código Banco']) errors.push('Código do banco é obrigatório.');
      if (!row['Data'] || !isValidDateBR(row['Data'])) errors.push('Data inválida. Use DD/MM/AAAA.');
      if (!row['Valor Bloqueado (R$)']) errors.push('Valor bloqueado é obrigatório.');
      if (!row['Número do Processo']) errors.push('Número do processo é obrigatório.');
      break;
    }
    case 'procurators': {
      if (!row['Nome']) errors.push('Nome é obrigatório.');
      if (!row['E-mail'] || !/^\S+@\S+\.\S+$/.test(String(row['E-mail']).trim())) errors.push('E-mail inválido.');
      else key = String(row['E-mail']).trim().toLowerCase();
      if (!['Coordenador', 'Especialista', 'Gerente', 'Gerente executivo', 'Superintendente', 'Outro'].includes(String(row['Tipo'] || '').trim())) errors.push('Tipo de procurador inválido.');
      break;
    }
    case 'accounting_routes': {
      if (!row['Nome da Empresa'] || !findCompany(String(row['Nome da Empresa']))) errors.push(`Empresa "${row['Nome da Empresa'] || ''}" não encontrada no cadastro.`);
      if (!row['Nome do Movimento']) errors.push('Nome do movimento é obrigatório.');
      if (!row['Conta Contábil']) errors.push('Conta contábil é obrigatória.');
      break;
    }
    case 'holidays': {
      const data = row['Data'] || row['data'];
      const desc = row['Descrição'] || row['descricao'];
      if (!data) {
        errors.push('Data é obrigatória.');
      } else if (!isValidDateBR(data)) {
        errors.push('Formato de data inválido. Use DD/MM/AAAA.');
      } else {
        key = parseDateToISO(data);
      }
      if (!desc) errors.push('Descrição é obrigatória.');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    key
  };
}

// Upload & Preview endpoint
router.post('/preview/:module', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { module } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      return;
    }

    const rows = ExcelService.parseUploadedBuffer(file.buffer, req.body.sheetName);
    if (!rows || rows.length === 0) {
      res.status(400).json({ error: 'O arquivo enviado não contém dados legíveis.' });
      return;
    }

    const allCompanies = await companiesRepo.getAll();
    const previewRows: any[] = [];
    const validationErrors: string[] = [];
    const keysSeen = new Set<string>();
    let duplicatesInFile = 0;

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const validation = await validateRow(module, rawRow, i + 1, allCompanies);

      let isDuplicate = false;
      if (validation.key) {
        if (keysSeen.has(validation.key)) {
          isDuplicate = true;
          duplicatesInFile++;
        } else {
          keysSeen.add(validation.key);
        }
      }

      if (!validation.isValid) {
        validationErrors.push(`Linha ${i + 2}: ${validation.errors.join(' ')}`);
      }

      previewRows.push({
        rowIndex: i + 1,
        data: rawRow,
        key: validation.key,
        isValid: validation.isValid,
        errors: validation.errors,
        isDuplicate
      });
    }

    res.json({
      fileName: file.originalname,
      totalRows: rows.length,
      validRowsCount: previewRows.filter((r) => r.isValid).length,
      errorRowsCount: previewRows.filter((r) => !r.isValid).length,
      duplicatesCount: duplicatesInFile,
      validationErrors: validationErrors.slice(0, 50),
      rows: previewRows.slice(0, 500) // Preview up to 500 rows
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Commit import with duplicate handling strategy
router.post('/commit/:module', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { module } = req.params;
    const { duplicateStrategy, notes } = req.body; // 'replace' | 'keep_existing' | 'cancel'
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Arquivo obrigatório para confirmação da importação.' });
      return;
    }

    const rows = ExcelService.parseUploadedBuffer(file.buffer, req.body.sheetName);
    const savedPath = await ExcelService.saveImportFile(file.originalname, file.buffer);

    // Load master lookup data
    const allCompanies = await companiesRepo.getAll();
    const allBanks = await banksRepo.getAll();
    const compByCnpj = new Map(allCompanies.map((c) => [c.cnpj.replace(/\D/g, ''), c]));
    const bankByCode = new Map(allBanks.map((b) => [b.code.padStart(3, '0'), b]));

    const resolveCompany = (query: any): Company | undefined => {
      if (!query) return undefined;
      const qStr = String(query).trim();
      const cleanDigits = qStr.replace(/\D/g, '');
      if (cleanDigits && compByCnpj.has(cleanDigits)) {
        return compByCnpj.get(cleanDigits);
      }
      const lower = qStr.toLowerCase();
      return allCompanies.find(
        (c) =>
          (c.tradeName && c.tradeName.trim().toLowerCase() === lower) ||
          (c.legalName && c.legalName.trim().toLowerCase() === lower)
      );
    };

    let targetRepo: JsonRepository<any>;
    switch (module) {
      case 'companies': targetRepo = new JsonRepository<any>('companies.json'); break;
      case 'current_accounts': targetRepo = new JsonRepository<any>('current_accounts.json'); break;
      case 'agreements': targetRepo = new JsonRepository<any>('bank_agreements.json'); break;
      case 'accesses': targetRepo = new JsonRepository<any>('bank_accesses.json'); break;
      case 'indicators': targetRepo = new JsonRepository<any>('indicators.json'); break;
      case 'cash_projections': targetRepo = new JsonRepository<any>('cash_projections.json'); break;
      case 'tecban': targetRepo = new JsonRepository<any>('tecban_records.json'); break;
      case 'holidays': targetRepo = new JsonRepository<any>('financial_holidays.json'); break;
      case 'tariffs': targetRepo = new JsonRepository<any>('tariffs.json'); break;
      case 'bank_contacts': targetRepo = new JsonRepository<any>('bank_contacts.json'); break;
      case 'dividends_jcp': targetRepo = new JsonRepository<any>('dividends_jcp.json'); break;
      case 'loans': targetRepo = new JsonRepository<any>('loan_contracts.json'); break;
      case 'judicial_blocks': targetRepo = new JsonRepository<any>('judicial_blocks.json'); break;
      case 'procurators': targetRepo = new JsonRepository<any>('procurators.json'); break;
      case 'accounting_routes': targetRepo = new JsonRepository<any>('accounting_routes.json'); break;
      default:
        res.status(400).json({ error: `Módulo inválido: ${module}` });
        return;
    }

    const existingRecords = await targetRepo.getAll();
    const existingMap = new Map<string, any>();

    // Map existing keys
    for (const r of existingRecords) {
      let k = r.id;
      if (module === 'companies') k = r.cnpj ? r.cnpj.replace(/\D/g, '') : r.id;
      if (module === 'indicators') k = r.date;
      if (module === 'cash_projections') k = `${r.companyId}_${r.date}`;
      if (module === 'tecban') k = r.date;
      if (module === 'holidays') k = r.date;
      if (module === 'loans') k = r.contractNumber;
      if (module === 'procurators') k = String(r.email || '').toLowerCase();
      existingMap.set(k, r);
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let rejectedCount = 0;
    const finalRecords = [...existingRecords];
    const touchedIds = new Set<string>();
    const validationErrors: string[] = [];

    // Indicator version tracking
    const indicatorVersionId = `ind_v_${Date.now()}`;
    if (module === 'indicators') {
      const allIndVersions = await indicatorVersionsRepo.getAll();
      const nextVerNum = allIndVersions.length + 1;
      const newIndVer = await indicatorVersionsRepo.create({
        id: indicatorVersionId,
        versionNumber: nextVerNum,
        label: `Curva CDI v${nextVerNum} (${file.originalname})`,
        importedBy: req.user?.email || 'user',
        fileName: file.originalname,
        recordCount: rows.length,
        validations: ['Validação de formato e precisão decimal'],
        notes: notes || 'Importação oficial via planilha',
        isCurrent: true
      });
      // Mark previous versions as not current
      for (const v of allIndVersions) {
        if (v.isCurrent) {
          await indicatorVersionsRepo.update(v.id, { isCurrent: false });
        }
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const validation = await validateRow(module, rawRow, i + 1, allCompanies);

      if (!validation.isValid) {
        rejectedCount++;
        validationErrors.push(`Linha ${i + 2}: ${validation.errors.join(' ')}`);
        continue;
      }

      let lookupKey = validation.key || `row_${i}`;
      if (module === 'cash_projections') {
        const empresaInput = rawRow['Nome da Empresa'] || rawRow['Empresa'] || rawRow['CNPJ Empresa'] || rawRow['cnpj'];
        const comp = resolveCompany(empresaInput);
        const iso = parseDateToISO(rawRow['Data'] || rawRow['data']);
        lookupKey = `${comp ? comp.id : String(empresaInput).trim()}_${iso}`;
      }

      const existing = existingMap.get(lookupKey);

      if (existing) {
        if (duplicateStrategy === 'cancel') {
          res.status(400).json({ error: `Importação cancelada devido à duplicidade encontrada na linha ${i + 2}: ${lookupKey}` });
          return;
        } else if (duplicateStrategy === 'keep_existing') {
          rejectedCount++;
          continue;
        } else {
          // Replace existing record
          updatedCount++;
          // Prepare updated object based on module
          const updatedObj = { ...existing };
          if (module === 'companies') {
            updatedObj.tradeName = rawRow['Nome Fantasia'] || existing.tradeName;
            updatedObj.legalName = rawRow['Razão Social'] || existing.legalName;
          } else if (module === 'indicators') {
            updatedObj.cdiRealizedAnnual = normalizeDecimalInput(rawRow['CDI Realizado (% a.a.)'], null);
            updatedObj.cdiProjectedAnnual = normalizeDecimalInput(rawRow['CDI Projetado (% a.a.)'], null);
            updatedObj.quotaBarauna = normalizeDecimalInput(rawRow['Cota Baraúna'], null);
            updatedObj.quotaCarnauba = normalizeDecimalInput(rawRow['Cota Carnaúba'], null);
            updatedObj.quotaJacaranda = normalizeDecimalInput(rawRow['Cota Jacarandá'], null);
            updatedObj.quotaCaliandra = normalizeDecimalInput(rawRow['Cota Caliandra'], null);
            updatedObj.quotaBBCorporateFacil = normalizeDecimalInput(rawRow['Cota BB Corporate Fácil'], null);
            updatedObj.versionId = indicatorVersionId;
          } else if (module === 'cash_projections') {
            // CRITICAL: Preserve projected balance verbatim!
            updatedObj.actualBalance = normalizeDecimalInput(rawRow['Saldo Real'], null);
            updatedObj.actualInflow = normalizeDecimalInput(rawRow['Entradas Reais'], null);
            updatedObj.actualOutflow = normalizeDecimalInput(rawRow['Saídas Reais'], null);
            updatedObj.projectedBalance = normalizeDecimalInput(rawRow['Saldo Projetado'], null);
            updatedObj.projectedInflow = normalizeDecimalInput(rawRow['Entrada Projetada'], null);
            updatedObj.projectedOutflow = normalizeDecimalInput(rawRow['Saída Projetada'], null);
          } else if (module === 'tecban') {
            updatedObj.actualBalance = normalizeDecimalInput(rawRow['Saldo Real'], null);
            updatedObj.actualWithdrawals = normalizeDecimalInput(rawRow['Saques Reais'], null);
            updatedObj.actualReloads = normalizeDecimalInput(rawRow['Recargas Reais'], null);
            updatedObj.projectedBalance = normalizeDecimalInput(rawRow['Saldo Projetado'], null);
            updatedObj.projectedWithdrawals = normalizeDecimalInput(rawRow['Saque Projetado'], null);
            updatedObj.projectedReloads = normalizeDecimalInput(rawRow['Recarga Projetada'], null);
          }
          const idx = finalRecords.findIndex((r) => r.id === existing.id);
          if (idx >= 0) finalRecords[idx] = updatedObj;
          touchedIds.add(existing.id);
        }
      } else {
        // Insert new record
        insertedCount++;
        const newRecord: any = {
          id: `${module}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (module === 'companies') {
          const clean = String(rawRow['CNPJ']).replace(/\D/g, '');
          newRecord.tradeName = String(rawRow['Nome Fantasia'] || '').trim();
          newRecord.legalName = String(rawRow['Razão Social'] || '').trim();
          newRecord.cnpj = formatCNPJ(clean);
          newRecord.active = true;
        } else if (module === 'current_accounts') {
          const empresaInput = rawRow['Nome da Empresa'] || rawRow['Empresa'] || rawRow['CNPJ Empresa'] || rawRow['cnpj'];
          const comp = resolveCompany(empresaInput);
          const bankCode = String(rawRow['Código Banco'] || '').padStart(3, '0');
          const bank = bankByCode.get(bankCode);
          newRecord.companyId = comp ? comp.id : String(empresaInput).trim();
          newRecord.bankId = bank ? bank.id : bankCode;
          newRecord.agency = String(rawRow['Agência'] || '').trim();
          newRecord.accountNumber = String(rawRow['Conta Corrente'] || '').trim();
          newRecord.hasIntradayLimit = String(rawRow['Limite Intraday (Sim/Não)'] || '').toLowerCase().includes('s');
          newRecord.intradayLimitAmount = newRecord.hasIntradayLimit ? normalizeDecimalInput(rawRow['Valor Limite Intraday (R$)'], '') : '';
          newRecord.hasAutoInvestment = String(rawRow['Aplicação Automática (Sim/Não)'] || '').toLowerCase().includes('s');
          newRecord.hasSweeping = String(rawRow['Tombamento (Sim/Não)'] || '').toLowerCase().includes('s');
          newRecord.sweepingDestinationAccount = newRecord.hasSweeping ? String(rawRow['Conta Destino Tombamento'] || '').trim() : '';
          newRecord.notes = rawRow['Observações'] ? String(rawRow['Observações']).trim() : undefined;
          newRecord.active = true;
        } else if (module === 'agreements') {
          const empresaInput = rawRow['Nome da Empresa'] || rawRow['Empresa'] || rawRow['CNPJ Empresa'] || rawRow['cnpj'];
          const comp = resolveCompany(empresaInput);
          const bankCode = String(rawRow['Código Banco'] || '').padStart(3, '0');
          const bank = bankByCode.get(bankCode);
          newRecord.companyId = comp ? comp.id : String(empresaInput).trim();
          newRecord.bankId = bank ? bank.id : bankCode;
          newRecord.agreementType = String(rawRow['Tipo do Convênio (PAGFOR/COBRANCA/OUTROS)'] || rawRow['Tipo do Convênio'] || '').trim().toUpperCase();
          const accountText = String(rawRow['Conta Corrente'] || '').trim();
          const linkedAccount = (await new JsonRepository<any>('current_accounts.json').getAll()).find((a) => a.companyId === newRecord.companyId && a.bankId === newRecord.bankId && a.accountNumber === accountText);
          if (!linkedAccount) throw new Error(`Conta corrente ${accountText} não encontrada para empresa/banco informados.`);
          newRecord.currentAccountId = linkedAccount.id;
          newRecord.agreementCode = String(rawRow['Código do Convênio'] || '').trim();
          newRecord.managerName = String(rawRow['Gestor do Convênio'] || '').trim();
          newRecord.notes = rawRow['Observações'] ? String(rawRow['Observações']).trim() : undefined;
          newRecord.active = true;
        } else if (module === 'accesses') {
          const empresaInput = rawRow['Nome da Empresa'] || rawRow['Empresa'] || rawRow['CNPJ Empresa'] || rawRow['cnpj'];
          const comp = resolveCompany(empresaInput);
          const bankCode = String(rawRow['Código Banco'] || '').padStart(3, '0');
          const bank = bankByCode.get(bankCode);
          newRecord.companyId = comp ? comp.id : String(empresaInput).trim();
          newRecord.bankId = bank ? bank.id : bankCode;
          newRecord.accessProfile = String(rawRow['Perfil de Acesso'] || '').trim();
          newRecord.userName = String(rawRow['Nome do Usuário'] || '').trim();
          newRecord.managerName = String(rawRow['Gestor do Usuário'] || '').trim();
          newRecord.notes = rawRow['Observações'] ? String(rawRow['Observações']).trim() : undefined;
          newRecord.active = true;
        } else if (module === 'indicators') {
          newRecord.date = parseDateToISO(String(rawRow['Data']).trim());
          newRecord.cdiRealizedAnnual = normalizeDecimalInput(rawRow['CDI Realizado (% a.a.)'], null);
          newRecord.cdiProjectedAnnual = normalizeDecimalInput(rawRow['CDI Projetado (% a.a.)'], null);
          newRecord.quotaBarauna = normalizeDecimalInput(rawRow['Cota Baraúna'], null);
          newRecord.quotaCarnauba = normalizeDecimalInput(rawRow['Cota Carnaúba'], null);
          newRecord.quotaJacaranda = normalizeDecimalInput(rawRow['Cota Jacarandá'], null);
          newRecord.quotaCaliandra = normalizeDecimalInput(rawRow['Cota Caliandra'], null);
          newRecord.quotaBBCorporateFacil = normalizeDecimalInput(rawRow['Cota BB Corporate Fácil'], null);
          newRecord.versionId = indicatorVersionId;
        } else if (module === 'cash_projections') {
          const empresaInput = rawRow['Nome da Empresa'] || rawRow['Empresa'] || rawRow['CNPJ Empresa'] || rawRow['cnpj'];
          const comp = resolveCompany(empresaInput);
          newRecord.companyId = comp ? comp.id : String(empresaInput).trim();
          newRecord.date = parseDateToISO(String(rawRow['Data'] || rawRow['data']).trim());
          newRecord.actualBalance = normalizeDecimalInput(rawRow['Saldo Real'], null);
          newRecord.actualInflow = normalizeDecimalInput(rawRow['Entradas Reais'], null);
          newRecord.actualOutflow = normalizeDecimalInput(rawRow['Saídas Reais'], null);
          // Preserved verbatim!
          newRecord.projectedBalance = normalizeDecimalInput(rawRow['Saldo Projetado'], null);
          newRecord.projectedInflow = normalizeDecimalInput(rawRow['Entrada Projetada'], null);
          newRecord.projectedOutflow = normalizeDecimalInput(rawRow['Saída Projetada'], null);
        } else if (module === 'tecban') {
          newRecord.date = parseDateToISO(String(rawRow['Data']).trim());
          newRecord.actualBalance = normalizeDecimalInput(rawRow['Saldo Real'], null);
          newRecord.actualWithdrawals = normalizeDecimalInput(rawRow['Saques Reais'], null);
          newRecord.actualReloads = normalizeDecimalInput(rawRow['Recargas Reais'], null);
          newRecord.projectedBalance = normalizeDecimalInput(rawRow['Saldo Projetado'], null);
          newRecord.projectedWithdrawals = normalizeDecimalInput(rawRow['Saque Projetado'], null);
          newRecord.projectedReloads = normalizeDecimalInput(rawRow['Recarga Projetada'], null);
        } else if (module === 'tariffs') {
          const comp = resolveCompany(rawRow['Nome da Empresa'] || rawRow['Empresa']);
          const bankCode = String(rawRow['Código Banco'] || '').padStart(3, '0');
          const bank = bankByCode.get(bankCode);
          newRecord.companyId = comp ? comp.id : '';
          newRecord.bankId = bank ? bank.id : bankCode;
          const accountText = String(rawRow['Conta Corrente'] || '').trim();
          if (accountText) {
            const acc = (await new JsonRepository<any>('current_accounts.json').getAll()).find((a) => a.companyId === newRecord.companyId && a.bankId === newRecord.bankId && a.accountNumber === accountText);
            if (!acc) throw new Error(`Conta corrente ${accountText} não encontrada para empresa/banco informados.`);
            newRecord.accountId = acc.id;
          }
          newRecord.name = String(rawRow['Nome da Tarifa'] || '').trim();
          newRecord.type = String(rawRow['Tipo'] || '').trim();
          newRecord.unitFee = normalizeDecimalInput(rawRow['Tarifa Unitária (R$)']);
          newRecord.validUntil = parseDateToISO(String(rawRow['Data de Validade']).trim());
        } else if (module === 'bank_contacts') {
          const bank = bankByCode.get(String(rawRow['Código Banco'] || '').padStart(3, '0'));
          const t = (k: string) => (rawRow[k] ? String(rawRow[k]).trim() : '');
          Object.assign(newRecord, { bankId: bank ? bank.id : String(rawRow['Código Banco']).padStart(3, '0'), commercialManagerName: t('Gerente Comercial'), commercialPhone: t('Telefone Comercial'), commercialEmail: t('E-mail Comercial'), cashManagerName: t('Gerente de Cash'), cashPhone: t('Telefone Cash'), cashEmail: t('E-mail Cash'), operationalManagerName: t('Gerente Operacional'), operationalPhone: t('Telefone Operacional'), operationalEmail: t('E-mail Operacional') });
        } else if (module === 'dividends_jcp') {
          newRecord.originCompanyId = resolveCompany(rawRow['Empresa Origem'])?.id || '';
          newRecord.destinationCompanyId = resolveCompany(rawRow['Empresa Destino'])?.id || '';
          newRecord.date = parseDateToISO(String(rawRow['Data']).trim());
          newRecord.amount = normalizeDecimalInput(rawRow['Valor (R$)']);
          newRecord.type = String(rawRow['Tipo (Dividendos/JCP)']).trim();
        } else if (module === 'loans') {
          const bank = bankByCode.get(String(rawRow['Código Banco'] || '').padStart(3, '0'));
          const currentVersion = (await indicatorVersionsRepo.getAll()).find((v) => v.isCurrent);
          const amount = normalizeDecimalInput(rawRow['Valor Contratado (R$)']);
          Object.assign(newRecord, { contractNumber: String(rawRow['Número do Contrato']).trim(), companyId: resolveCompany(rawRow['Nome da Empresa'])?.id || '', bankId: bank ? bank.id : String(rawRow['Código Banco']).padStart(3, '0'), startDate: parseDateToISO(String(rawRow['Data de Início']).trim()), maturityDate: parseDateToISO(String(rawRow['Data de Vencimento']).trim()), contractedAmount: amount, spreadAnnual: normalizeDecimalInput(rawRow['Spread (% a.a.)']), indexer: 'CDI', cdiVersionId: currentVersion?.id || '', dayCountConvention: 'BUS_252', currentOutstandingBalance: amount, events: [], active: true, notes: rawRow['Observações'] ? String(rawRow['Observações']).trim() : undefined });
        } else if (module === 'judicial_blocks') {
          const bank = bankByCode.get(String(rawRow['Código Banco'] || '').padStart(3, '0'));
          Object.assign(newRecord, { companyId: resolveCompany(rawRow['Nome da Empresa'])?.id || '', bankId: bank ? bank.id : String(rawRow['Código Banco']).padStart(3, '0'), date: parseDateToISO(String(rawRow['Data']).trim()), type: 'Bloqueio', amount: normalizeDecimalInput(rawRow['Valor Bloqueado (R$)']), processNumber: String(rawRow['Número do Processo']).trim(), observation: rawRow['Observação'] ? String(rawRow['Observação']).trim() : '' });
        } else if (module === 'procurators') {
          Object.assign(newRecord, { name: String(rawRow['Nome']).trim(), email: String(rawRow['E-mail']).trim().toLowerCase(), type: String(rawRow['Tipo']).trim() });
        } else if (module === 'accounting_routes') {
          newRecord.companyId = resolveCompany(rawRow['Nome da Empresa'])?.id || '';
          const bankCode = rawRow['Código Banco'] ? String(rawRow['Código Banco']).padStart(3, '0') : '';
          const bank = bankCode ? bankByCode.get(bankCode) : undefined;
          if (bankCode) newRecord.bankId = bank ? bank.id : bankCode;
          const accountText = String(rawRow['Conta Corrente'] || '').trim();
          if (accountText) {
            const acc = (await new JsonRepository<any>('current_accounts.json').getAll()).find((a) => a.companyId === newRecord.companyId && (!newRecord.bankId || a.bankId === newRecord.bankId) && a.accountNumber === accountText);
            if (!acc) throw new Error(`Conta corrente ${accountText} não encontrada para empresa/banco informados.`);
            newRecord.accountId = acc.id;
            newRecord.bankId = acc.bankId;
          }
          newRecord.movementName = String(rawRow['Nome do Movimento']).trim();
          newRecord.accountingAccount = String(rawRow['Conta Contábil']).trim();
        } else if (module === 'holidays') {
          newRecord.date = parseDateToISO(String(rawRow['Data']).trim());
          newRecord.description = String(rawRow['Descrição'] || '').trim();
          newRecord.type = String(rawRow['Tipo (NACIONAL/ESTADUAL/MUNICIPAL)'] || 'NATIONAL_BANKING').trim().toUpperCase();
          newRecord.state = rawRow['UF'] ? String(rawRow['UF']).trim().toUpperCase() : undefined;
          newRecord.city = rawRow['Município'] ? String(rawRow['Município']).trim() : undefined;
          newRecord.source = rawRow['Fonte'] ? String(rawRow['Fonte']).trim() : 'Planilha importada';
        }

        finalRecords.push(newRecord);
        touchedIds.add(newRecord.id);
        existingMap.set(lookupKey, newRecord);
      }
    }

    // Atomically write updated collection
    await targetRepo.replaceAll(finalRecords);

    // Create immutable import version record with snapshot
    const versionRecord = await ExcelService.createVersion({
      module: module as SystemModule,
      fileName: file.originalname,
      savedFilePath: savedPath,
      importedBy: req.user?.email || 'user',
      totalRows: rows.length,
      insertedCount,
      updatedCount,
      rejectedCount,
      validationErrors: validationErrors.slice(0, 50),
      snapshotSummary: `${insertedCount} inseridos, ${updatedCount} atualizados, ${rejectedCount} rejeitados`,
      dataSnapshot: rows.slice(0, 1000)
    });

    // Tag every inserted/updated record with the import version (enables version filter on "Dados")
    await targetRepo.replaceAll(finalRecords.map((r) => (touchedIds.has(r.id) ? { ...r, importVersionId: versionRecord.id } : r)));

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: module as SystemModule,
      action: 'IMPORT',
      recordId: versionRecord.id,
      summary: `Importação de planilha concluída no módulo ${module}: ${file.originalname} (${insertedCount} novos, ${updatedCount} alterados)`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      version: versionRecord,
      summary: {
        totalRows: rows.length,
        insertedCount,
        updatedCount,
        rejectedCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Raw records of a module (used by the "Dados" tab with version filter)
router.get('/records/:module', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files: Record<string, string> = { indicators: 'indicators.json', cash_projections: 'cash_projections.json', tecban: 'tecban_records.json' };
    const file = files[req.params.module];
    if (!file) { res.status(400).json({ error: 'Módulo inválido.' }); return; }
    const records = await new JsonRepository<any>(file).getAll();
    records.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List import versions of a module
router.get('/versions/:module', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { module } = req.params;
    const versions = await ExcelService.getVersions(module as SystemModule);
    res.json(versions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an import version and the records currently tagged with it (admin-only via global DELETE guard)
router.delete('/versions/:module/:versionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files: Record<string, string> = { indicators: 'indicators.json', cash_projections: 'cash_projections.json', tecban: 'tecban_records.json' };
    const { module, versionId } = req.params;
    const file = files[module];
    if (!file) { res.status(400).json({ error: 'Módulo inválido.' }); return; }
    const vRepo = new JsonRepository<any>('import_versions.json');
    const version = await vRepo.getById(versionId);
    if (!version || version.module !== module) { res.status(404).json({ error: 'Versão não encontrada.' }); return; }
    const repo = new JsonRepository<any>(file);
    const all = await repo.getAll();
    const removed = all.filter((r) => r.importVersionId === versionId);
    await repo.replaceAll(all.filter((r) => r.importVersionId !== versionId));
    await vRepo.delete(versionId);
    await AuditService.log({ userId: req.user?.userId, userEmail: req.user?.email, module: module as any, action: 'DELETE', recordId: versionId, summary: `Versão "${version.fileName}" excluída (${removed.length} registro(s) removido(s))`, previousValue: { version, records: removed.length }, ipAddress: req.ip });
    res.json({ success: true, removedRecords: removed.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete manually entered records (records without an import version) — admin only
router.post('/records/:module/delete-manual', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) { res.status(403).json({ error: 'Apenas administradores podem excluir registros.' }); return; }
    const files: Record<string, string> = { indicators: 'indicators.json', cash_projections: 'cash_projections.json', tecban: 'tecban_records.json' };
    const { module } = req.params;
    const file = files[module];
    if (!file) { res.status(400).json({ error: 'Módulo inválido.' }); return; }
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (ids.length === 0) { res.status(400).json({ error: 'Nenhum registro selecionado.' }); return; }
    const repo = new JsonRepository<any>(file);
    const all = await repo.getAll();
    const removed = all.filter((r) => ids.includes(r.id) && !r.importVersionId);
    if (removed.length === 0) { res.status(400).json({ error: 'Somente lançamentos manuais podem ser excluídos individualmente.' }); return; }
    const removedIds = new Set(removed.map((r) => r.id));
    await repo.replaceAll(all.filter((r) => !removedIds.has(r.id)));
    await AuditService.log({ userId: req.user?.userId, userEmail: req.user?.email, module: module as any, action: 'DELETE', recordId: removed.map((r) => r.id).join(','), summary: `${removed.length} lançamento(s) manual(is) excluído(s)`, previousValue: removed, ipAddress: req.ip });
    res.json({ success: true, removedRecords: removed.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Compare two versions
router.get('/compare', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { v1, v2 } = req.query;
    if (!v1 || !v2) {
      res.status(400).json({ error: 'Parâmetros v1 e v2 são obrigatórios para comparação.' });
      return;
    }
    const comparison = await ExcelService.compareVersions(String(v1), String(v2));
    res.json(comparison);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export records as XLSX
router.get('/export/:module', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { module } = req.params;
    let repo: JsonRepository<any>;
    switch (module) {
      case 'companies': repo = new JsonRepository<any>('companies.json'); break;
      case 'current_accounts': repo = new JsonRepository<any>('current_accounts.json'); break;
      case 'agreements': repo = new JsonRepository<any>('bank_agreements.json'); break;
      case 'accesses': repo = new JsonRepository<any>('bank_accesses.json'); break;
      case 'indicators': repo = new JsonRepository<any>('indicators.json'); break;
      case 'cash_projections': repo = new JsonRepository<any>('cash_projections.json'); break;
      case 'tecban': repo = new JsonRepository<any>('tecban_records.json'); break;
      case 'holidays': repo = new JsonRepository<any>('financial_holidays.json'); break;
      case 'tariffs': repo = new JsonRepository<any>('tariffs.json'); break;
      case 'bank_contacts': repo = new JsonRepository<any>('bank_contacts.json'); break;
      case 'dividends_jcp': repo = new JsonRepository<any>('dividends_jcp.json'); break;
      case 'loans': repo = new JsonRepository<any>('loan_contracts.json'); break;
      case 'judicial_blocks': repo = new JsonRepository<any>('judicial_blocks.json'); break;
      case 'procurators': repo = new JsonRepository<any>('procurators.json'); break;
      case 'accounting_routes': repo = new JsonRepository<any>('accounting_routes.json'); break;
      default:
        res.status(400).json({ error: 'Módulo inválido para exportação.' });
        return;
    }

    const records = await repo.getAll();
    const buffer = ExcelService.exportRecordsToBuffer(records, module);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="export_${module}_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
