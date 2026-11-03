// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { JsonRepository } from '../storage/db';
import { IndicatorRecord } from '../storage/schemas';

const generalRepo = new JsonRepository<any>('economic_summary.json');

export interface EconomicSummaryState {
  selicOver: { value: string; date: string; source: string; updatedAt: string; status: 'ONLINE' | 'PENDING'; history12m: Array<{ date: string; value: number }> };
  ptaxVenda: { value: string; date: string; source: string; updatedAt: string; status: 'ONLINE' | 'PENDING'; history12m: Array<{ date: string; value: number }> };
  ipcaMonthly: { value: string; date: string; source: string; updatedAt: string; status: 'ONLINE' | 'PENDING'; history12m: Array<{ date: string; value: number }> };
  ipca12m: { value: string; date: string; source: string; updatedAt: string; status: 'ONLINE' | 'PENDING'; history12m: Array<{ date: string; value: number }> };
  lastSyncAttempt: string;
  lastSuccessfulSync?: string;
}

const parseBcbDate = (d: string) => { const [day, month, year] = d.split('/'); return `${year}-${month}-${day}`; };
const toNum = (v: unknown) => Number(String(v).replace(',', '.'));
const timeoutFetch = async (url: string) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try { const r = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(`Fonte respondeu HTTP ${r.status}`); return await r.json(); }
  finally { clearTimeout(timer); }
};

export class EconomicIndicatorsService {
  private static lastSyncAt = 0;
  private static inFlight: Promise<any> | null = null;

  private static async getSummaryRecord(): Promise<any> {
    const list = await generalRepo.getAll();
    if (list.length) return list[0];
    const now = new Date().toISOString();
    return generalRepo.create({ id: 'summary_state',
      selicOver: { value: '', date: '', source: 'Banco Central do Brasil — SGS 1178 (Selic Over diária, % a.a.)', updatedAt: '', status: 'PENDING', history12m: [] },
      ptaxVenda: { value: '', date: '', source: 'Banco Central do Brasil — SGS 1 (Dólar venda)', updatedAt: '', status: 'PENDING', history12m: [] },
      ipcaMonthly: { value: '', date: '', source: 'IBGE — SIDRA tabela 7060', updatedAt: '', status: 'PENDING', history12m: [] },
      ipca12m: { value: '', date: '', source: 'IBGE — SIDRA tabela 7060', updatedAt: '', status: 'PENDING', history12m: [] },
      lastSyncAttempt: now
    });
  }

  static async getSummary(): Promise<EconomicSummaryState> { return this.getSummaryRecord(); }

  static async syncOfficialRates(force = false): Promise<{ success: boolean; message: string; state: EconomicSummaryState }> {
    if (!force && Date.now() - this.lastSyncAt < 15 * 60 * 1000) {
      const state = await this.getSummaryRecord(); return { success: true, message: 'Cache de atualização recente.', state };
    }
    if (this.inFlight) return this.inFlight;
    this.inFlight = (async () => {
      const current = await this.getSummaryRecord();
      const now = new Date().toISOString();
      let updated = 0;
      const end = new Date();
      // SGS passou a exigir intervalo explícito para séries diárias e limita
      // /ultimos/{N}; a consulta por período evita HTTP 406 e recupera 12 meses.
      const selicStart = new Date(end.getFullYear(), end.getMonth() - 11, 1);
      const bcbDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      const selicParams = new URLSearchParams({ formato: 'json', dataInicial: bcbDate(selicStart), dataFinal: bcbDate(end) });
      const selicUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados?${selicParams.toString()}`;
      const ptaxStart = new Date(end); ptaxStart.setDate(ptaxStart.getDate() - 30);
      const mmddyyyy = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
      const ptaxUrl = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='USD'&@dataInicial='${mmddyyyy(ptaxStart)}'&@dataFinalCotacao='${mmddyyyy(end)}'&$format=json`;
      const results = await Promise.allSettled([
        timeoutFetch(selicUrl),
        timeoutFetch(ptaxUrl),
        timeoutFetch('https://apisidra.ibge.gov.br/values/t/7060/n1/1/v/63/p/last%2024')
      ]);
      const applyBcb = (result: PromiseSettledResult<any[]>, target: any, source: string) => {
        if (result.status !== 'fulfilled' || !Array.isArray(result.value) || !result.value.length) { target.status = 'PENDING'; return; }
        const rows = result.value.filter((r: any) => r.data && r.valor !== undefined && Number.isFinite(toNum(r.valor)));
        if (!rows.length) { target.status = 'PENDING'; return; }
        const latest = rows[rows.length - 1];
        target.value = String(latest.valor); target.date = parseBcbDate(latest.data); target.updatedAt = now; target.source = source; target.status = 'ONLINE';
        target.history12m = rows.map((r: any) => ({ date: parseBcbDate(r.data), value: toNum(r.valor) })); updated++;
      };
      // SELIC Over: série diária SGS 1178 (% a.a., base 252).
      // O gráfico guarda a última observação disponível de cada mês, em ordem cronológica.
      const selicResult = results[0];
      if (selicResult.status === 'fulfilled' && Array.isArray(selicResult.value)) {
        const dailyRows = selicResult.value
          .filter((r: any) => r.data && r.valor !== undefined && Number.isFinite(toNum(r.valor)))
          .map((r: any) => ({ date: parseBcbDate(r.data), value: toNum(r.valor) }))
          .sort((a: any, b: any) => a.date.localeCompare(b.date));
        if (dailyRows.length) {
          const lastByMonth = new Map<string, { date: string; value: number }>();
          for (const row of dailyRows) lastByMonth.set(row.date.slice(0, 7), row);
          const monthlyHistory = Array.from(lastByMonth.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12)
            .map(([, row]) => row);
          const latest = dailyRows[dailyRows.length - 1];
          current.selicOver.value = String(latest.value);
          current.selicOver.date = latest.date;
          current.selicOver.updatedAt = now;
          current.selicOver.source = 'Banco Central do Brasil — SGS 1178 (Selic Over diária, % a.a.)';
          current.selicOver.status = 'ONLINE';
          current.selicOver.history12m = monthlyHistory;
          updated++;
        } else current.selicOver.status = 'PENDING';
      } else current.selicOver.status = 'PENDING';
      const ptaxResult = results[1];
      if (ptaxResult.status === 'fulfilled' && Array.isArray(ptaxResult.value?.value)) {
        const quotes = ptaxResult.value.value.filter((q: any) => Number.isFinite(Number(q.cotacaoVenda)) && q.dataHoraCotacao)
          .sort((a: any, b: any) => String(a.dataHoraCotacao).localeCompare(String(b.dataHoraCotacao)));
        if (quotes.length) {
          const latest = quotes[quotes.length - 1];
          current.ptaxVenda.value = String(latest.cotacaoVenda);
          current.ptaxVenda.date = String(latest.dataHoraCotacao).slice(0, 10);
          current.ptaxVenda.updatedAt = now;
          current.ptaxVenda.source = 'Banco Central do Brasil — API PTAX, cotação de venda USD';
          current.ptaxVenda.status = 'ONLINE';
          current.ptaxVenda.history12m = quotes.slice(-12).map((q: any) => ({ date: String(q.dataHoraCotacao).slice(0, 10), value: Number(q.cotacaoVenda) }));
          updated++;
        } else current.ptaxVenda.status = 'PENDING';
      } else current.ptaxVenda.status = 'PENDING';
      const ipcaResult = results[2];
      if (ipcaResult.status === 'fulfilled' && Array.isArray(ipcaResult.value)) {
        const rows = ipcaResult.value.slice(1).filter((r: any) => r.V && r.D3C && r.D3C !== '0' && Number.isFinite(toNum(r.V)));
        if (rows.length) {
          const normalized = rows.map((r: any) => ({ date: `${String(r.D3C).slice(0,4)}-${String(r.D3C).slice(4,6)}`, value: toNum(r.V) })).sort((a: any,b: any) => a.date.localeCompare(b.date));
          const latest = normalized[normalized.length - 1];
          current.ipcaMonthly.value = String(latest.value); current.ipcaMonthly.date = `${latest.date}-01`; current.ipcaMonthly.updatedAt = now; current.ipcaMonthly.source = 'IBGE — SIDRA tabela 7060, variável 63 (IPCA mensal)'; current.ipcaMonthly.status = 'ONLINE'; current.ipcaMonthly.history12m = normalized.slice(-12);
          const last12 = normalized.slice(-12);
          const accumulatedHistory = normalized
            .map((_, index) => normalized.slice(Math.max(0, index - 11), index + 1))
            .filter((window) => window.length === 12)
            .map((window) => ({
              date: window[window.length - 1].date,
              value: (window.reduce((acc, item) => acc * (1 + item.value / 100), 1) - 1) * 100
            }))
            .slice(-12);
          if (last12.length === 12) current.ipca12m.value = (last12.reduce((acc: number, x: any) => acc * (1 + x.value / 100), 1) - 1) * 100 + '';
          current.ipca12m.date = `${latest.date}-01`; current.ipca12m.updatedAt = now; current.ipca12m.source = current.ipcaMonthly.source; current.ipca12m.status = last12.length === 12 ? 'ONLINE' : 'PENDING'; updated++;
          current.ipca12m.history12m = accumulatedHistory;
        } else current.ipcaMonthly.status = 'PENDING';
      } else current.ipcaMonthly.status = 'PENDING';
      current.lastSyncAttempt = now; if (updated) current.lastSuccessfulSync = now;
      await generalRepo.update(current.id, current); this.lastSyncAt = Date.now();
      return { success: updated > 0, message: updated === 3 ? 'Selic Over, PTAX e IPCA atualizados nas fontes oficiais.' : `${updated} de 3 indicadores atualizados. Dados anteriores preservados quando a fonte falhou.`, state: current };
    })();
    try { return await this.inFlight; } finally { this.inFlight = null; }
  }

  static async updateManualSummary(payload: Partial<EconomicSummaryState>): Promise<EconomicSummaryState> {
    const current = await this.getSummaryRecord(); const updated = { ...current, ...payload }; await generalRepo.update(current.id, updated); return updated;
  }
}
