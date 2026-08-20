/* ============================================================
   views/relatorios.js — análises por período
   ============================================================ */

CF.views = CF.views || {};

CF.views.relatorios = (function () {
  const U = CF.utils;
  const S = () => CF.store;

  const PERIODOS = [
    { id: '30d', nome: 'Últimos 30 dias', dias: 30 },
    { id: '3m', nome: '3 meses', meses: 3 },
    { id: '6m', nome: '6 meses', meses: 6 },
    { id: '12m', nome: '12 meses', meses: 12 },
    { id: 'ano', nome: 'Ano atual' },
    { id: 'custom', nome: 'Personalizado' }
  ];

  let selecionado = '6m';
  let custom = { de: U.addMonths(U.today(), -1), ate: U.today() };

  function intervalo() {
    const hoje = U.today();
    const p = PERIODOS.find(x => x.id === selecionado);
    if (p.dias) return { de: U.addDays(hoje, -p.dias + 1), ate: hoje };
    if (p.meses) return { de: U.monthStart(U.addMonthKey(U.monthOf(hoje), -(p.meses - 1))), ate: hoje };
    if (p.id === 'ano') return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje };
    return { de: custom.de, ate: custom.ate };
  }

  function render(el) {
    const st = S();
    if (st.state.carregando) { el.innerHTML = CF.ui.skeleton.pagina(); U.icons(el); return; }

    const { de, ate } = intervalo();
    const r = st.resumo(de, ate);
    const catsDespesa = st.porCategoria('despesa', de, ate);
    const catsReceita = st.porCategoria('receita', de, ate);
    const mesesNoIntervalo = Math.max(1, Math.round(U.daysBetween(de, ate) / 30));
    const serie = st.serieMensal(Math.min(12, Math.max(2, mesesNoIntervalo)), U.monthOf(ate));
    const topGastos = st.maioresGastos(8, true, de, ate);
    const assinaturas = st.assinaturasResumo();
    const parceladas = st.comprasComProgresso().filter(c => c.parcelas > 1 && !c.quitada);
    const diaria = r.despesas / Math.max(1, U.daysBetween(de, ate) + 1);

    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">Relatórios</div>
          <div class="view-sub">Análise de ${U.fmtDate(de)} até ${U.fmtDate(ate)}</div>
        </div>
        <button class="btn btn-outline" data-act="imprimir"><i data-lucide="printer" class="icon"></i>Imprimir</button>
      </div>

      <div class="card mb-4">
        <div class="row gap-3 wrap">
          <div class="segmented">
            ${PERIODOS.map(p => `<button data-act="periodo" data-val="${p.id}" class="${selecionado === p.id ? 'is-active' : ''}">${p.nome}</button>`).join('')}
          </div>
          <div class="row gap-2 ${selecionado === 'custom' ? '' : 'hidden'}">
            <input class="input" type="date" id="c-de" value="${custom.de}" style="width:auto">
            <span class="dim">até</span>
            <input class="input" type="date" id="c-ate" value="${custom.ate}" style="width:auto">
          </div>
        </div>
      </div>

      <div class="grid grid-4 mb-4 stagger">
        ${CF.ui.metric({ label: 'Receitas', variante: 'income', icone: 'arrow-down-left', valor: `<span class="income">${U.money(r.receitas)}</span>` })}
        ${CF.ui.metric({ label: 'Despesas', variante: 'expense', icone: 'arrow-up-right', valor: `<span class="expense">${U.money(r.despesas)}</span>` })}
        ${CF.ui.metric({ label: 'Economia', variante: r.economia >= 0 ? 'info' : 'expense', icone: 'piggy-bank',
          valor: `<span class="${r.economia >= 0 ? 'income' : 'expense'}">${U.money(r.economia)}</span>`,
          rodape: `<span class="badge ${r.taxaEconomia >= 20 ? 'badge-income' : 'badge-warning'}">${U.pct(r.taxaEconomia, 1)} da renda</span>` })}
        ${CF.ui.metric({ label: 'Gasto médio diário', variante: 'warning', icone: 'calendar-days', valor: U.money(diaria),
          rodape: `<span class="dim">${U.plural(r.qtdTransacoes, 'lançamento', 'lançamentos')}</span>` })}
      </div>

      <div class="section grid" style="grid-template-columns:1.5fr 1fr;align-items:start">
        <div class="card">
          <div class="card-header"><div>
            <div class="card-title">Receitas x Despesas</div>
            <div class="card-sub">Comparativo mês a mês</div></div></div>
          <div class="chart-box"><canvas id="rp-comparativo"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Gastos por categoria</div></div>
          ${catsDespesa.length
            ? `<div class="chart-box"><canvas id="rp-cats"></canvas></div>`
            : '<p class="muted small">Sem despesas no período.</p>'}
        </div>
      </div>

      <div class="section grid" style="grid-template-columns:1fr 1fr;align-items:start">
        <div class="card">
          <div class="card-header"><div>
            <div class="card-title">Evolução do saldo</div>
            <div class="card-sub">Saldo consolidado ao final de cada mês</div></div></div>
          <div class="chart-box"><canvas id="rp-saldo"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Maiores gastos</div></div>
          ${topGastos.length ? `
            <div class="chart-box"><canvas id="rp-top"></canvas></div>` : '<p class="muted small">Sem dados.</p>'}
        </div>
      </div>

      <div class="section grid grid-2">
        <div class="card">
          <div class="card-header"><div class="card-title">Detalhamento das despesas</div></div>
          ${catsDespesa.length ? tabelaCategorias(catsDespesa, r.despesas) : '<p class="muted small">Sem despesas no período.</p>'}
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Detalhamento das receitas</div></div>
          ${catsReceita.length ? tabelaCategorias(catsReceita, r.receitas) : '<p class="muted small">Sem receitas no período.</p>'}
        </div>
      </div>

      <div class="section grid grid-3">
        <div class="card">
          <div class="card-header"><div class="card-title">Assinaturas</div></div>
          <div class="col gap-3">
            <div class="row-between"><span class="muted small">Ativas</span><span class="bold">${assinaturas.qtd}</span></div>
            <div class="row-between"><span class="muted small">Custo mensal</span><span class="bold expense">${U.money(assinaturas.mensal)}</span></div>
            <div class="row-between"><span class="muted small">Custo anual</span><span class="bold">${U.money(assinaturas.anual)}</span></div>
            <div class="row-between"><span class="muted small">% da renda do período</span>
              <span class="bold">${U.pct(r.receitas ? (assinaturas.mensal * mesesNoIntervalo / r.receitas) * 100 : 0, 1)}</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">Parcelamentos em aberto</div></div>
          ${parceladas.length ? `<div class="col gap-3">
            ${parceladas.slice(0, 5).map(c => `
              <div>
                <div class="row-between" style="margin-bottom:5px">
                  <span class="small bold truncate">${U.esc(c.produto)}</span>
                  <span class="tiny dim">${c.parcelasPagas}/${c.parcelas}</span>
                </div>
                ${CF.ui.progresso(c.pct)}
              </div>`).join('')}
            <div class="row-between mt-2"><span class="muted small">Saldo devedor</span>
              <span class="bold expense">${U.money(U.sum(parceladas, c => c.restante))}</span></div>
          </div>` : '<p class="muted small">Nenhum parcelamento em aberto.</p>'}
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">Contas do período</div></div>
          <div class="col gap-3">
            <div class="row-between"><span class="muted small">Pagas</span>
              <span class="bold income">${U.money(r.despesasPagas)}</span></div>
            <div class="row-between"><span class="muted small">Pendentes</span>
              <span class="bold text-warning">${U.money(r.comprometido)}</span></div>
            <div class="row-between"><span class="muted small">Em atraso</span>
              <span class="bold expense">${U.money(r.atrasado)}</span></div>
            <div class="row-between"><span class="muted small">Contas fixas ativas</span>
              <span class="bold">${st.state.contasFixas.filter(c => c.status !== 'pausada').length}</span></div>
          </div>
        </div>
      </div>`;

    U.icons(el);

    CF.charts.receitasDespesas('rp-comparativo', serie);
    CF.charts.evolucaoSaldo('rp-saldo', serie);
    if (catsDespesa.length) CF.charts.rosca('rp-cats', catsDespesa.slice(0, 8));
    if (topGastos.length) CF.charts.ranking('rp-top', topGastos.map(t => ({
      nome: t.nome.length > 26 ? t.nome.slice(0, 25) + '…' : t.nome,
      valor: t.valor,
      cor: t.cor
    })));

    el.querySelector('#c-de')?.addEventListener('change', (e) => { custom.de = e.target.value; S().emit('change'); });
    el.querySelector('#c-ate')?.addEventListener('change', (e) => { custom.ate = e.target.value; S().emit('change'); });

    return CF.ui.acoes(el, {
      periodo: (b) => { selecionado = b.dataset.val; S().emit('change'); },
      imprimir: () => window.print()
    });
  }

  function tabelaCategorias(cats, total) {
    return `<div class="table-wrap"><table class="table" style="min-width:0">
      <thead><tr><th>Categoria</th><th class="right">Qtd.</th><th class="col-value">Valor</th><th class="right">%</th></tr></thead>
      <tbody>
        ${cats.map(c => `
          <tr>
            <td><span class="row gap-2">
              <span class="legend-swatch" style="background:${c.cor}"></span>
              <span class="small">${U.esc(c.nome)}</span></span></td>
            <td class="right small muted">${c.qtd}</td>
            <td class="col-value">${U.money(c.valor)}</td>
            <td class="right small muted">${U.pct(c.pct, 1)}</td>
          </tr>`).join('')}
        <tr style="background:var(--surface-2)">
          <td class="bold">Total</td><td></td>
          <td class="col-value bold">${U.money(total)}</td>
          <td class="right small bold">100,0%</td>
        </tr>
      </tbody>
    </table></div>`;
  }

  return { titulo: 'Relatórios', render };
})();
