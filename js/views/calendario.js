/* ============================================================
   views/calendario.js — calendário financeiro do mês
   ============================================================ */

CF.views = CF.views || {};

CF.views.calendario = (function () {
  const U = CF.utils;
  const S = () => CF.store;

  const TIPOS = {
    receita:   { cor: 'var(--income)',  icone: 'arrow-down-left', nome: 'Receita' },
    despesa:   { cor: 'var(--expense)', icone: 'arrow-up-right',  nome: 'Despesa' },
    pendente:  { cor: 'var(--warning)', icone: 'clock',           nome: 'A pagar' },
    fatura:    { cor: 'var(--brand)',   icone: 'credit-card',     nome: 'Fatura' },
    assinatura:{ cor: '#e11d48',        icone: 'repeat',          nome: 'Assinatura' }
  };

  /** Todos os eventos financeiros do mês, indexados por data. */
  function eventosDoMes(mk) {
    const st = S();
    const de = U.monthStart(mk), ate = U.monthEnd(mk);
    const mapa = new Map();
    const add = (data, ev) => {
      if (data < de || data > ate) return;
      if (!mapa.has(data)) mapa.set(data, []);
      mapa.get(data).push(ev);
    };

    st.state.transacoes.filter(t => t.data >= de && t.data <= ate).forEach(t => {
      const tipo = t.tipo === 'receita' ? 'receita' : (t.status === 'pago' ? 'despesa' : 'pendente');
      add(t.data, { tipo, titulo: t.descricao, valor: t.valor, id: t.id, ref: t });
    });

    st.state.cartoes.filter(c => c.ativo !== false).forEach(c => {
      const f = st.fatura(c.id, mk);
      if (f && f.total > 0) {
        add(f.vencimento, { tipo: 'fatura', titulo: `Fatura ${c.nome}`, valor: f.total, cartaoId: c.id });
      }
    });

    return mapa;
  }

  function render(el) {
    const st = S();
    if (st.state.carregando) { el.innerHTML = CF.ui.skeleton.pagina(); U.icons(el); return; }

    const mk = st.periodo.tipo === 'mes' ? st.periodo.mk : U.monthOf(U.today());
    const eventos = eventosDoMes(mk);
    const [ano, mes] = mk.split('-').map(Number);
    const primeiro = new Date(ano, mes - 1, 1);
    const inicioSemana = primeiro.getDay();
    const dias = U.daysInMonth(ano, mes - 1);
    const hoje = U.today();

    const celulas = [];
    // dias do mês anterior para completar a primeira semana
    const mesAnterior = U.addMonthKey(mk, -1);
    const diasAnterior = U.daysInMonth(Number(mesAnterior.slice(0, 4)), Number(mesAnterior.slice(5)) - 1);
    for (let i = inicioSemana - 1; i >= 0; i--) {
      celulas.push({ data: U.dayInMonth(mesAnterior, diasAnterior - i), fora: true });
    }
    for (let d = 1; d <= dias; d++) celulas.push({ data: U.dayInMonth(mk, d), fora: false });
    const proximoMes = U.addMonthKey(mk, 1);
    let extra = 1;
    while (celulas.length % 7 !== 0) celulas.push({ data: U.dayInMonth(proximoMes, extra++), fora: true });

    const totalReceitas = U.sum([...eventos.values()].flat().filter(e => e.tipo === 'receita'), e => e.valor);
    const totalDespesas = U.sum([...eventos.values()].flat().filter(e => e.tipo === 'despesa' || e.tipo === 'pendente'), e => e.valor);

    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">Calendário financeiro</div>
          <div class="view-sub">Receitas, contas, parcelas, assinaturas e faturas de ${U.esc(U.monthLabel(mk))}</div>
        </div>
        <button class="btn btn-primary" data-act="add"><i data-lucide="plus" class="icon"></i>Adicionar</button>
      </div>

      <div class="grid grid-3 mb-4">
        ${CF.ui.metric({ label: 'Entradas previstas', variante: 'income', icone: 'arrow-down-left',
          valor: `<span class="income">${U.money(totalReceitas)}</span>` })}
        ${CF.ui.metric({ label: 'Saídas previstas', variante: 'expense', icone: 'arrow-up-right',
          valor: `<span class="expense">${U.money(totalDespesas)}</span>` })}
        ${CF.ui.metric({ label: 'Resultado do mês', variante: 'info', icone: 'equal',
          valor: `<span class="${totalReceitas - totalDespesas >= 0 ? 'income' : 'expense'}">${U.money(totalReceitas - totalDespesas)}</span>` })}
      </div>

      <div class="card">
        <div class="card-header wrap">
          <div class="card-title">${U.esc(U.monthLabel(mk))}</div>
          <div class="row gap-3 wrap">
            ${Object.entries(TIPOS).map(([k, v]) => `
              <span class="row gap-1 tiny muted">
                <span class="cal-dot" style="background:${v.cor}"></span>${v.nome}</span>`).join('')}
          </div>
        </div>

        <div class="cal-grid" style="margin-bottom:4px">
          ${U.DIAS.map(d => `<div class="cal-dow">${d}</div>`).join('')}
        </div>
        <div class="cal-grid">
          ${celulas.map(c => celula(c, eventos, hoje)).join('')}
        </div>
      </div>`;

    U.icons(el);

    return CF.ui.acoes(el, {
      add: (b) => CF.app.menuAdicionar(b),
      dia: (b) => abrirDia(b.dataset.data, eventos.get(b.dataset.data) || [])
    });
  }

  function celula(c, eventos, hoje) {
    const evs = eventos.get(c.data) || [];
    const num = Number(c.data.slice(8));
    const visiveis = evs.slice(0, 2);
    return `
      <button class="cal-day ${c.fora ? 'is-out' : ''} ${c.data === hoje ? 'is-today' : ''}"
              data-act="dia" data-data="${c.data}">
        <span class="row-between">
          <span class="cal-num">${num}</span>
          ${evs.length > 2 ? `<span class="tiny dim">+${evs.length - 2}</span>` : ''}
        </span>
        ${visiveis.map(e => `
          <span class="cal-ev" style="background:${U.withAlpha('#000', 0)};color:${TIPOS[e.tipo].cor};
            background-color:color-mix(in srgb, ${TIPOS[e.tipo].cor} 14%, transparent)">
            ${U.esc(e.titulo)}</span>`).join('')}
        ${evs.length && !visiveis.length ? '' : ''}
        ${evs.length > 2 ? `<span class="cal-dots">${evs.slice(2, 8).map(e => `<span class="cal-dot" style="background:${TIPOS[e.tipo].cor}"></span>`).join('')}</span>` : ''}
      </button>`;
  }

  function abrirDia(data, eventos) {
    const receitas = U.sum(eventos.filter(e => e.tipo === 'receita'), e => e.valor);
    const despesas = U.sum(eventos.filter(e => e.tipo !== 'receita'), e => e.valor);

    const modal = CF.ui.abrirModal({
      titulo: U.fmtDateLong(data),
      subtitulo: eventos.length ? `${U.plural(eventos.length, 'evento financeiro', 'eventos financeiros')}` : 'Nenhum evento neste dia',
      corpo: eventos.length ? `
        <div class="grid grid-2 mb-4">
          <div class="card card-flat card-pad-sm">
            <div class="tiny dim">Entradas</div><div class="h3 income">${U.money(receitas)}</div></div>
          <div class="card card-flat card-pad-sm">
            <div class="tiny dim">Saídas</div><div class="h3 expense">${U.money(despesas)}</div></div>
        </div>
        <div class="txn-list">
          ${eventos.map(e => `
            <div class="txn-item" ${e.id ? `data-txn="${e.id}"` : ''}>
              <span class="txn-ico" style="color:${TIPOS[e.tipo].cor};background-color:color-mix(in srgb, ${TIPOS[e.tipo].cor} 14%, transparent)">
                <i data-lucide="${TIPOS[e.tipo].icone}" class="icon"></i></span>
              <div class="txn-main">
                <div class="txn-title truncate">${U.esc(e.titulo)}</div>
                <div class="txn-meta">${TIPOS[e.tipo].nome}</div>
              </div>
              <div class="txn-value ${e.tipo === 'receita' ? 'income' : 'expense'}">
                ${e.tipo === 'receita' ? '+' : '−'} ${U.money(e.valor)}</div>
            </div>`).join('')}
        </div>` : `
        <div class="center col gap-3" style="padding:24px 0">
          <p class="muted small">Nada agendado para este dia.</p>
        </div>`,
      rodape: `
        <button class="btn btn-ghost" data-modal-close>Fechar</button>
        <button class="btn btn-primary" data-nova><i data-lucide="plus" class="icon"></i>Lançar neste dia</button>`
    });

    modal.querySelector('[data-nova]').addEventListener('click', () => {
      CF.ui.fecharModal();
      CF.forms.transacao('despesa', null, { data });
    });
    modal.addEventListener('click', (e) => {
      const row = e.target.closest('[data-txn]');
      if (!row) return;
      CF.ui.fecharModal();
      CF.app.detalheTransacao(row.dataset.txn);
    });
  }

  return { titulo: 'Calendário', render };
})();
