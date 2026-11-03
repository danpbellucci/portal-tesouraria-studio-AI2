// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import * as XLSX from 'xlsx';
import fs from '../shims/fs';
import path from '../shims/path';
import { IMPORTS_DIR, EXPORTS_DIR, SystemModule, ImportVersion } from '../storage/schemas';
import { JsonRepository } from '../storage/db';

const versionsRepo = new JsonRepository<ImportVersion>('import_versions.json');

export interface TemplateDefinition {
  module: SystemModule;
  filename: string;
  sheetName: string;
  columns: string[];
  widths?: number[];
  sampleRow: Record<string, any>;
  instructions: string[];
}

import { formatDateBR } from '../utils/date';

export const MODULE_TEMPLATES: Record<string, TemplateDefinition> = {
  companies: {
    module: 'companies',
    sheetName: 'Empresas',
    filename: 'modelo_empresas.xlsx',
    columns: ['Nome Fantasia', 'Razão Social', 'CNPJ', 'Diretores Estatutários (separados por vírgula)'],
    sampleRow: {
      'Nome Fantasia': 'Elo Serviços',
      'Razão Social': 'Elo Serviços S.A.',
      'CNPJ': '09.227.084/0001-75',
      'Diretores Estatutários (separados por vírgula)': 'Eduardo Chedid, Roberto Valério'
    },
    instructions: [
      'CNPJ deve ser válido e sem duplicidade no cadastro.',
      'Diretores informados serão vinculados automaticamente à empresa.'
    ]
  },
  current_accounts: {
    module: 'current_accounts',
    sheetName: 'Contas Correntes',
    filename: 'modelo_contas_correntes.xlsx',
    columns: ['Nome da Empresa', 'Código Banco', 'Agência', 'Conta Corrente', 'Limite Intraday (Sim/Não)', 'Valor Limite Intraday (R$)', 'Aplicação Automática (Sim/Não)', 'Tombamento (Sim/Não)', 'Conta Destino Tombamento', 'Observações'],
    sampleRow: {
      'Nome da Empresa': 'Elo Serviços',
      'Código Banco': '001',
      'Agência': '0100',
      'Conta Corrente': '00012345-6',
      'Limite Intraday (Sim/Não)': 'Sim',
      'Valor Limite Intraday (R$)': '250.000,00',
      'Aplicação Automática (Sim/Não)': 'Sim',
      'Tombamento (Sim/Não)': 'Não',
      'Conta Destino Tombamento': '',
      'Observações': 'Conta principal de arrecadação'
    },
    instructions: [
      'Informar o Nome da Empresa cadastrada.',
      'Preserve zeros à esquerda na Agência e Conta Corrente.',
      'Campos booleanos devem conter "Sim" ou "Não". Se Limite Intraday=Sim, preencher Valor Limite Intraday (R$). Se Tombamento=Sim, preencher Conta Destino Tombamento.'
    ]
  },
  agreements: {
    module: 'agreements',
    sheetName: 'Convênios Bancários',
    filename: 'modelo_convenios_bancarios.xlsx',
    columns: ['Nome da Empresa', 'Código Banco', 'Conta Corrente', 'Tipo do Convênio (PAGFOR/COBRANCA/OUTROS)', 'Código do Convênio', 'Gestor do Convênio', 'Observações'],
    sampleRow: {
      'Nome da Empresa': 'Elo Serviços',
      'Código Banco': '237',
      'Conta Corrente': '00012345-6',
      'Tipo do Convênio (PAGFOR/COBRANCA/OUTROS)': 'COBRANCA',
      'Código do Convênio': '00987654',
      'Gestor do Convênio': 'Carlos Silva',
      'Observações': 'Contrato renovado em 2026'
    },
    instructions: [
      'Informar o Nome da Empresa cadastrada.',
      'Tipo de convênio deve ser PAGFOR, COBRANCA ou OUTROS.',
      'Código preserva caracteres e zeros à esquerda.'
    ]
  },
  accesses: {
    module: 'accesses',
    sheetName: 'Acessos Bancários',
    filename: 'modelo_acessos_bancarios.xlsx',
    columns: ['Nome da Empresa', 'Código Banco', 'Perfil de Acesso', 'Nome do Usuário', 'Gestor do Usuário', 'Observações'],
    sampleRow: {
      'Nome da Empresa': 'Elo Serviços',
      'Código Banco': '341',
      'Perfil de Acesso': 'Master / Aprovador Nível 2',
      'Nome do Usuário': 'Mariana Souza',
      'Gestor do Usuário': 'Carlos Silva',
      'Observações': 'Acesso via certificado A3'
    },
    instructions: [
      'Informar o Nome da Empresa cadastrada.',
      'Perfil de acesso é texto livre (ex: Consulta, Operador, Aprovador).'
    ]
  },
  indicators: {
    module: 'indicators',
    sheetName: 'Indicadores e Cotas',
    filename: 'modelo_indicadores_taxas.xlsx',
    columns: ['Data', 'CDI Realizado (% a.a.)', 'CDI Projetado (% a.a.)', 'Cota Baraúna', 'Cota Carnaúba', 'Cota Jacarandá', 'Cota Caliandra', 'Cota BB Corporate Fácil'],
    sampleRow: {
      'Data': '30/10/2026',
      'CDI Realizado (% a.a.)': '10,65',
      'CDI Projetado (% a.a.)': '10,50',
      'Cota Baraúna': '1,428512',
      'Cota Carnaúba': '1,385410',
      'Cota Jacarandá': '1,512040',
      'Cota Caliandra': '1,294100',
      'Cota BB Corporate Fácil': '1,189500'
    },
    instructions: [
      'Data no formato DD/MM/AAAA.',
      'CDI informado em taxa anualizada (% a.a.). Utilize vírgula como separador decimal e ponto para milhares (ex.: 10,65).',
      'Fundos representam o valor da cota patrimonial.'
    ]
  },
  cash_projections: {
    module: 'cash_projections',
    sheetName: 'Projeção de Caixa',
    filename: 'modelo_projecao_caixa.xlsx',
    columns: ['Nome da Empresa', 'Data', 'Saldo Real', 'Saídas Reais', 'Entradas Reais', 'Saldo Projetado', 'Saída Projetada', 'Entrada Projetada'],
    sampleRow: {
      'Nome da Empresa': 'Elo Serviços',
      'Data': '30/10/2026',
      'Saldo Real': '15.500.000,00',
      'Saídas Reais': '3.200.000,00',
      'Entradas Reais': '4.100.000,00',
      'Saldo Projetado': '16.400.000,00',
      'Saída Projetada': '2.800.000,00',
      'Entrada Projetada': '3.700.000,00'
    },
    instructions: [
      'Informar o Nome da Empresa cadastrada.',
      'Data no formato DD/MM/AAAA.',
      'Valores monetários em Reais (R$).'
    ]
  },
  tecban: {
    module: 'tecban',
    sheetName: 'Controle Tecban',
    filename: 'modelo_controle_tecban.xlsx',
    columns: ['Data', 'Saldo Real', 'Saques Reais', 'Recargas Reais', 'Saldo Projetado', 'Saque Projetado', 'Recarga Projetada'],
    sampleRow: {
      'Data': '30/10/2026',
      'Saldo Real': '82.500.000,00',
      'Saques Reais': '12.400.000,00',
      'Recargas Reais': '15.000.000,00',
      'Saldo Projetado': '85.100.000,00',
      'Saque Projetado': '11.800.000,00',
      'Recarga Projetada': '14.400.000,00'
    },
    instructions: [
      'Valores em Reais (R$) referentes à operação da Tecban.',
      'Data no formato DD/MM/AAAA.',
      'Valores monetários com vírgula decimal e ponto para milhares (ex.: 82.500.000,00).'
    ]
  },
  tariffs: {
    module: 'tariffs',
    sheetName: 'Mapa de Tarifas',
    filename: 'modelo_mapa_tarifas.xlsx',
    columns: ['Nome da Empresa', 'Código Banco', 'Conta Corrente', 'Nome da Tarifa', 'Tipo', 'Tarifa Unitária (R$)', 'Data de Validade'],
    sampleRow: {
      'Nome da Empresa': 'Elo Serviços',
      'Código Banco': '001',
      'Conta Corrente': '00012345-6',
      'Nome da Tarifa': 'TED Eletrônica',
      'Tipo': 'Transferência',
      'Tarifa Unitária (R$)': '8,50',
      'Data de Validade': '31/12/2026'
    },
    instructions: [
      'Informar o Nome da Empresa cadastrada (nome fantasia, razão social ou CNPJ).',
      'Código do banco com 3 dígitos (ex.: 001, 237, 341).',
      'Conta Corrente é opcional; se informada, deve estar cadastrada para a mesma empresa e banco.',
      'Tarifa unitária com vírgula decimal (ex.: 8,50). Data de validade no formato DD/MM/AAAA.'
    ]
  },
  bank_contacts: {
    module: 'bank_contacts',
    sheetName: 'Contatos Bancários',
    filename: 'modelo_contatos_bancarios.xlsx',
    columns: ['Código Banco', 'Gerente Comercial', 'Telefone Comercial', 'E-mail Comercial', 'Gerente de Cash', 'Telefone Cash', 'E-mail Cash', 'Gerente Operacional', 'Telefone Operacional', 'E-mail Operacional'],
    sampleRow: { 'Código Banco': '341', 'Gerente Comercial': 'Ana Souza', 'Telefone Comercial': '(11) 99999-0000', 'E-mail Comercial': 'ana.souza@banco.com.br', 'Gerente de Cash': 'Carlos Lima', 'Telefone Cash': '(11) 98888-0000', 'E-mail Cash': 'carlos.lima@banco.com.br', 'Gerente Operacional': 'Paula Reis', 'Telefone Operacional': '(11) 97777-0000', 'E-mail Operacional': 'paula.reis@banco.com.br' },
    instructions: ['Código do banco com 3 dígitos (ex.: 001, 237, 341) — obrigatório.', 'Demais campos são opcionais.']
  },
  dividends_jcp: {
    module: 'dividends_jcp',
    sheetName: 'Dividendos e JCP',
    filename: 'modelo_dividendos_jcp.xlsx',
    columns: ['Empresa Origem', 'Empresa Destino', 'Data', 'Valor (R$)', 'Tipo (Dividendos/JCP)'],
    sampleRow: { 'Empresa Origem': 'Elo Serviços', 'Empresa Destino': 'Elo Participações', 'Data': '30/04/2026', 'Valor (R$)': '1.500.000,00', 'Tipo (Dividendos/JCP)': 'Dividendos' },
    instructions: ['Empresas cadastradas (nome fantasia, razão social ou CNPJ).', 'Data no formato DD/MM/AAAA; valor com vírgula decimal.', 'Tipo deve ser Dividendos ou JCP. O comprovante pode ser anexado depois, pela edição do registro.']
  },
  loans: {
    module: 'loans',
    sheetName: 'Empréstimos',
    filename: 'modelo_emprestimos.xlsx',
    columns: ['Número do Contrato', 'Nome da Empresa', 'Código Banco', 'Data de Início', 'Data de Vencimento', 'Valor Contratado (R$)', 'Spread (% a.a.)', 'Observações'],
    sampleRow: { 'Número do Contrato': 'CCB-2026-001', 'Nome da Empresa': 'Elo Serviços', 'Código Banco': '237', 'Data de Início': '01/02/2026', 'Data de Vencimento': '01/02/2029', 'Valor Contratado (R$)': '50.000.000,00', 'Spread (% a.a.)': '1,85', 'Observações': '' },
    instructions: ['Contratos indexados ao CDI (convenção 252 dias úteis), vinculados à versão vigente da curva CDI.', 'Datas no formato DD/MM/AAAA; valores com vírgula decimal.', 'O cronograma de eventos (juros/amortização) deve ser lançado no módulo Empréstimos.']
  },
  judicial_blocks: {
    module: 'judicial_blocks',
    sheetName: 'Bloqueios Judiciais',
    filename: 'modelo_bloqueios_judiciais.xlsx',
    columns: ['Nome da Empresa', 'Código Banco', 'Data', 'Valor Bloqueado (R$)', 'Número do Processo', 'Observação'],
    sampleRow: { 'Nome da Empresa': 'Elo Serviços', 'Código Banco': '001', 'Data': '15/03/2026', 'Valor Bloqueado (R$)': '125.000,00', 'Número do Processo': '0001234-56.2026.8.26.0100', 'Observação': '' },
    instructions: ['Cada linha gera um bloqueio. Desbloqueios e transferências são lançados no módulo.', 'Data no formato DD/MM/AAAA; valor com vírgula decimal.']
  },
  procurators: {
    module: 'procurators',
    sheetName: 'Procuradores',
    filename: 'modelo_procuradores.xlsx',
    columns: ['Nome', 'E-mail', 'Tipo'],
    sampleRow: { 'Nome': 'Maria Oliveira', 'E-mail': 'maria.oliveira@elopar.com.br', 'Tipo': 'Gerente' },
    instructions: ['Tipo: Coordenador, Especialista, Gerente, Gerente executivo, Superintendente ou Outro.']
  },
  accounting_routes: {
    module: 'accounting_routes',
    sheetName: 'Roteiro Contábil',
    filename: 'modelo_roteiro_contabil.xlsx',
    columns: ['Nome da Empresa', 'Código Banco', 'Conta Corrente', 'Nome do Movimento', 'Conta Contábil'],
    sampleRow: { 'Nome da Empresa': 'Elo Serviços', 'Código Banco': '001', 'Conta Corrente': '00012345-6', 'Nome do Movimento': 'Tarifa bancária', 'Conta Contábil': '4.1.02.003' },
    instructions: ['Banco e Conta Corrente são opcionais; se a conta for informada, deve estar cadastrada para a mesma empresa e banco.']
  },
  holidays: {
    module: 'holidays',
    sheetName: 'Calendário Financeiro',
    filename: 'modelo_feriados_financeiros.xlsx',
    columns: ['Data', 'Descrição', 'Tipo (NACIONAL/ESTADUAL/MUNICIPAL)', 'UF', 'Município', 'Fonte'],
    sampleRow: {
      'Data': '20/11/2026',
      'Descrição': 'Dia Nacional de Zumbi e da Consciência Negra',
      'Tipo (NACIONAL/ESTADUAL/MUNICIPAL)': 'NACIONAL',
      'UF': '',
      'Município': '',
      'Fonte': 'FEBRABAN / Lei Federal'
    },
    instructions: [
      'Data no formato DD/MM/AAAA.',
      'Tipo deve ser NACIONAL, ESTADUAL ou MUNICIPAL.'
    ]
  }
};

export class ExcelService {
  /**
   * Builds template workbook as buffer
   */
  static generateTemplateBuffer(moduleKey: string): Buffer {
    const tmpl = MODULE_TEMPLATES[moduleKey];
    if (!tmpl) {
      throw new Error(`Modelo não encontrado para o módulo ${moduleKey}`);
    }

    const wb = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.json_to_sheet([tmpl.sampleRow], { header: tmpl.columns });
    dataSheet['!cols'] = ExcelService.columnWidths(tmpl);
    XLSX.utils.book_append_sheet(wb, dataSheet, tmpl.sheetName);

    const instrData = tmpl.instructions.map((inst, idx) => ({ 'Item': idx + 1, 'Orientação': inst }));
    const instrSheet = XLSX.utils.json_to_sheet(instrData);
    instrSheet['!cols'] = [{ wch: 6 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, instrSheet, 'Instruções');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buf;
  }

  static columnWidths(tmpl: TemplateDefinition) {
    return tmpl.columns.map((c) => ({ wch: Math.max(14, Math.min(48, c.length + 4, ...[String(tmpl.sampleRow[c] ?? '').length + 4])) }));
  }

  /** Resolves a sheet by its Portuguese name, a module key, or falls back to the first sheet. */
  static resolveSheetName(sheetNames: string[], requested?: string): string | undefined {
    if (!requested) return sheetNames[0];
    if (sheetNames.includes(requested)) return requested;
    const pt = MODULE_TEMPLATES[requested]?.sheetName;
    if (pt && sheetNames.includes(pt)) return pt;
    const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return sheetNames.find((n) => norm(n) === norm(pt || requested)) || requested;
  }

  static generateAllTemplatesBuffer(): Buffer {
    const wb = XLSX.utils.book_new();

    for (const [moduleKey, tmpl] of Object.entries(MODULE_TEMPLATES)) {
      const dataSheet = XLSX.utils.aoa_to_sheet([tmpl.columns]);
      dataSheet['!cols'] = ExcelService.columnWidths(tmpl);
      XLSX.utils.book_append_sheet(wb, dataSheet, tmpl.sheetName);
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Parse uploaded XLSX or CSV file buffer
   */
  static parseUploadedBuffer(buffer: Buffer, sheetName?: string): any[] {
    // Read dates as serial numbers + number format so we can render them as DD/MM/AAAA
    // (SheetJS would otherwise format them with the US default "m/d/yy").
    const wb = XLSX.read(buffer, { type: 'buffer', cellNF: true });
    const selectedSheetName = ExcelService.resolveSheetName(wb.SheetNames, sheetName);
    if (!selectedSheetName) return [];

    const sheet = wb.Sheets[selectedSheetName];
    if (!sheet) throw new Error(`Aba "${selectedSheetName}" não encontrada na planilha.`);
    for (const addr of Object.keys(sheet)) {
      if (addr[0] === '!') continue;
      const cell: any = sheet[addr];
      const isDateCell = cell?.t === 'd' || (cell?.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z));
      if (!isDateCell) {
        // Numeric cells (currency, percent, thousands formats): use the raw value, not the
        // locale-formatted display text (e.g. "R$ 80,000,000.00"), so validation sees 80000000.
        if (cell?.t === 'n' && typeof cell.v === 'number') cell.w = String(cell.v);
        continue;
      }
      let y: number, m: number, d: number;
      if (cell.v instanceof Date) { y = cell.v.getFullYear(); m = cell.v.getMonth() + 1; d = cell.v.getDate(); }
      else { const pd = XLSX.SSF.parse_date_code(cell.v); if (!pd) continue; y = pd.y; m = pd.m; d = pd.d; }
      cell.w = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, defval: '' });
    return rows;
  }

  /**
   * Exports array of records to XLSX buffer with dates formatted to DD/MM/AAAA
   */
  static exportRecordsToBuffer(records: any[], sheetName: string = 'Registros'): Buffer {
    const formattedRecords = records.map((rec) => {
      const copy: Record<string, any> = {};
      for (const [key, value] of Object.entries(rec)) {
        if (
          (key.toLowerCase().includes('date') || key === 'data' || key === 'dataReferencia') &&
          typeof value === 'string' &&
          /^\d{4}-\d{2}-\d{2}/.test(value)
        ) {
          copy[key] = formatDateBR(value);
        } else {
          copy[key] = value;
        }
      }
      return copy;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(formattedRecords);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Save original uploaded file in /imports/
   */
  static async saveImportFile(filename: string, buffer: Buffer): Promise<string> {
    if (!fs.existsSync(IMPORTS_DIR)) {
      fs.mkdirSync(IMPORTS_DIR, { recursive: true });
    }
    const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const target = path.join(IMPORTS_DIR, safeName);
    await fs.promises.writeFile(target, buffer);
    return target;
  }

  /**
   * Record import version snapshot
   */
  static async createVersion(entry: {
    module: SystemModule;
    fileName: string;
    savedFilePath?: string;
    importedBy: string;
    totalRows: number;
    insertedCount: number;
    updatedCount: number;
    rejectedCount: number;
    validationErrors: string[];
    snapshotSummary: string;
    dataSnapshot?: any[];
  }): Promise<ImportVersion> {
    const rec = await versionsRepo.create({
      module: entry.module,
      fileName: entry.fileName,
      savedFilePath: entry.savedFilePath,
      importedBy: entry.importedBy,
      importedAt: new Date().toISOString(),
      totalRows: entry.totalRows,
      insertedCount: entry.insertedCount,
      updatedCount: entry.updatedCount,
      rejectedCount: entry.rejectedCount,
      validationErrors: entry.validationErrors,
      snapshotSummary: entry.snapshotSummary,
      dataSnapshot: entry.dataSnapshot
    });
    return rec;
  }

  static async getVersions(moduleName: SystemModule): Promise<ImportVersion[]> {
    const all = await versionsRepo.getAll();
    return all
      .filter((v) => v.module === moduleName)
      .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
  }

  /**
   * Compare two versions
   */
  static async compareVersions(v1Id: string, v2Id: string): Promise<{
    version1: ImportVersion;
    version2: ImportVersion;
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    diffDetails: Array<{ id: string; key: string; oldValue: any; newValue: any }>;
  }> {
    const v1 = await versionsRepo.getById(v1Id);
    const v2 = await versionsRepo.getById(v2Id);
    if (!v1 || !v2) throw new Error('Versões não localizadas para comparação.');

    const snap1 = v1.dataSnapshot || [];
    const snap2 = v2.dataSnapshot || [];

    const map1 = new Map<string, any>();
    const map2 = new Map<string, any>();

    for (const r of snap1) {
      const k = r.id || r.CNPJ || r.Data || JSON.stringify(r);
      map1.set(k, r);
    }
    for (const r of snap2) {
      const k = r.id || r.CNPJ || r.Data || JSON.stringify(r);
      map2.set(k, r);
    }

    let addedCount = 0;
    let removedCount = 0;
    let modifiedCount = 0;
    const diffDetails: Array<{ id: string; key: string; oldValue: any; newValue: any }> = [];

    for (const [k, r2] of map2.entries()) {
      if (!map1.has(k)) {
        addedCount++;
      } else {
        const r1 = map1.get(k);
        let hasDiff = false;
        for (const prop of Object.keys(r2)) {
          if (r1[prop] !== r2[prop] && prop !== 'updatedAt' && prop !== 'id') {
            hasDiff = true;
            diffDetails.push({ id: k, key: prop, oldValue: r1[prop], newValue: r2[prop] });
          }
        }
        if (hasDiff) modifiedCount++;
      }
    }

    for (const k of map1.keys()) {
      if (!map2.has(k)) {
        removedCount++;
      }
    }

    return {
      version1: v1,
      version2: v2,
      addedCount,
      removedCount,
      modifiedCount,
      diffDetails: diffDetails.slice(0, 100) // top 100 differences
    };
  }
}
