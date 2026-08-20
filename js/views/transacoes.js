/* ============================================================
   views/transacoes.js — extrato completo com filtros.
   Também alimenta as telas "Despesas" e "Receitas" (mesmo
   componente com o filtro de tipo travado).
   ============================================================ */

CF.views = CF.views || {};

CF.views.transacoes = (function () {
  const U = CF.utils;
  const S = () => CF.store;

  const filtroPadrao = () => ({
    busca: '', tipo: '', categoria: '', status: '', cartaoId: '',
    contaId: '', formaPagamento: '', min: null, max: null, avancado: false
  });

  let filtros = filtroPadrao();
  let contexto = '';
  let limite = 40;

  function render(el, params = {}) {
    const st = S();
    if (st.state.carregando) { el.innerHTML = CF.ui.skeleton.pagina(); U.icons(el); return; }

    // troca de contexto (extrato / despesas / receitas) zera os filtros
    const ctx = params.tipo || 'todos';
    if (ctx !== contexto) { filtros = filtroPadrao(); contexto = ctx; limite = 40; }
    if (params.tipo) filtros.tipo = params.tipo;

    const lista = st.transacoes(filtros);
    const visiveis = lista.slice(0, limite);
    const totalReceitas = U.sum(lista.filter(t => t.tipo === 'receita'), t => t.valor);
    const totalDespesas = U.sum(lista.filter(t => t.tipo === 'despesa'), t => t.valor);

    const titulo = params.tipo === 'despesa' ? 'Despesas' : params.tipo === 'receita' ? 'Receitas' : 'Movimentações';
    const cats = CF.catalog.categorias(params.tipo || 'despesa');

    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">${titulo}</div>
          <div class="view-sub">${U.plural(lista.length, 'lançamento encontrado', 'lançamentos encontrados')} em ${U.esc(st.periodoLabel())}</div>
        </div>
        <div class="row gap-2 wrap">
          <button class="btn btn-outline" data-act="exportar"><i data-lucide="download" class="icon"></i>Exportar CSV</button>
          ${params.tipo === 'receita'
            ? `<button class="btn btn-primary" data-act="nova-receita"><i data-lucide="plus" class="icon"></i>Nova receita</button>`
            : `<button class="btn btn-primary" data-act="nova-despesa"><i data-lucide="plus" class="icon"></i>Nova despesa</button>`}
        </div>
      </div>

      <!-- resumo -->
      <div class="grid grid-3 mb-4">
        ${CF.ui.metric({ label: 'Entradas', variante: 'income', icone: 'arrow-down-left', valor: `<span class="income">${U.money(totalReceitas)}</span>` })}
        ${CF.ui.metric({ label: 'Saídas', variante: 'expense', icone: 'arrow-up-right', valor: `<span class="expense">${U.money(totalDespesas)}</span>` })}
        ${CF.ui.metric({ label: 'Resultado', variante: 'info', icone: 'equal',
          valor: `<span class="${totalReceitas - totalDespesas >= 0 ? 'income' : 'expense'}">${U.money(totalReceitas - totalDespesas)}</span>` })}
      </div>

      <!-- filtros -->
      <div class="card mb-4">
        <div class="row gap-3 wrap">
          <div class="grow" style="position:relative;min-width:220px">
            <i data-lucide="search" class="icon-sm" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-3)"></i>
            <input class="input" id="f-busca" style="padding-left:36px" placeholder="Pesquisar por descrição…" value="${U.esc(filtros.busca)}">
          </div>
          ${!params.tipo ? `
          <select class="select" id="f-tipo" style="width:auto;min-width:140px">
            <option value="">Todos os tipos</option>
            <option value="despesa" ${filtros.tipo === 'despesa' ? 'selected' : ''}>Despesas</option>
            <option value="receita" ${filtros.tipo === 'receita' ? 'selected' : ''}>Receitas</option>
          </select>` : ''}
          <select class="select" id="f-categoria" style="width:auto;min-width:160px">
            <option value="">Todas as categorias</option>
            ${cats.map(c => `<option value="${c.id}" ${filtros.categoria === c.id ? 'selected' : ''}>${U.esc(c.nome)}</option>`).join('')}
          </select>
          <select class="select" id="f-status" style="width:auto;min-width:140px">
            <option value="">Todos os status</option>
            ${CF.catalog.STATUS_TXN.map(s => `<option value="${s.id}" ${filtros.status === s.id ? 'selected' : ''}>${s.nome}</option>`).join('')}
          </select>
          <button class="btn btn-outline" data-act="avancado">
            <i data-lucide="sliders-horizontal" class="icon"></i>Mais filtros</button>
          ${temFiltro() ? `<button class="btn btn-ghost" data-act="limpar"><i data-lucide="x" class="icon"></i>Limpar</button>` : ''}
        </div>

        <div class="grid grid-4 mt-4 ${filtros.avancado ? '' : 'hidden'}" id="filtros-avancados">
          <div class="field">
            <label class="field-label">Cartão</label>
            <select class="select" id="f-cartao">
              <option value="">Todos</option>
              ${st.state.cartoes.map(c => `<option value="${c.id}" ${filtros.cartaoId === c.id ? 'selected' : ''}>${U.esc(c.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label">Forma de pagamento</label>
            <select class="select" id="f-forma">
              <option value="">Todas</option>
              ${CF.catalog.PAGAMENTOS.map(p => `<option value="${p.id}" ${filtros.formaPagamento === p.id ? 'selected' : ''}>${U.esc(p.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label">Valor mínimo</label>
            <input class="input" id="f-min" type="number" step="0.01" placeholder="0,00" value="${filtros.min ?? ''}">
          </div>
          <div class="field">
            <label class="field-label">Valor máximo</label>
            <input class="input" id="f-max" type="number" step="0.01" placeholder="0,00" value="${filtros.max ?? ''}">
          </div>
        </div>
      </div>

      <!-- tabela -->
      <div class="card" style="padding:0;overflow:hidden">
        ${lista.length ? `
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th>
                <th>Pagamento</th><th class="col-value">Valor</th><th>Status</th><th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              ${visiveis.map(linha).join('')}
            </tbody>
          </table>
        </div>
        ${lista.length > limite ? `
          <div class="center" style="padding:16px;border-top:1px solid var(--border)">
            <button class="btn btn-outline" data-act="mais">
              Carregar mais (${lista.length - limite} restantes)</button>
          </div>` : ''}`
        : CF.ui.empty({
            icone: 'search-x',
            titulo: temFiltro() ? 'Nenhum resultado' : 'Nenhuma movimentação no período',
            texto: temFiltro() ? 'Tente ajustar ou limpar os filtros aplicados.' : 'Registre seu primeiro lançamento para começar.',
            acao: temFiltro() ? null : 'Adicionar lançamento', acaoId: 'nova-despesa'
          })}
      </div>`;

    U.icons(el);
    ligarFiltros(el, params);

    return CF.ui.acoes(el, {
      'nova-despesa': () => CF.forms.transacao('despesa'),
      'nova-receita': () => CF.forms.transacao('receita'),
      avancado: () => { filtros.avancado = !filtros.avancado; el.querySelector('#filtros-avancados').classList.toggle('hidden', !filtros.avancado); },
      limpar: () => { const t = filtros.tipo; filtros = filtroPadrao(); if (params.tipo) filtros.tipo = params.tipo; else filtros.tipo = ''; S().emit('change'); },
      mais: () => { limite += 40; S().emit('change'); },
      exportar: () => exportarCSV(lista),
      'ver-txn': (b) => CF.app.detalheTransacao(b.dataset.id),
      'menu-txn': (b) => CF.app.menuTransacao(b, b.dataset.id)
    });
  }

  function temFiltro() {
    return Boolean(filtros.busca || filtros.categoria || filtros.status || filtros.cartaoId ||
      filtros.formaPagamento || filtros.min || filtros.max);
  }

  function linha(t) {
    const cat = CF.catalog.categoria(t.categoria, t.tipo);
    const receita = t.tipo === 'receita';
    const status = S().statusReal(t);
    const pg = CF.catalog.pagamento(t.formaPagamento);
    const cartao = t.cartaoId ? S().cartao(t.cartaoId) : null;
    return `
      <tr data-act="ver-txn" data-id="${t.id}" style="cursor:pointer">
        <td class="num small" style="white-space:nowrap">${U.fmtDate(t.data)}</td>
        <td>
          <div class="bold truncate" style="max-width:280px">${U.esc(t.descricao)}</div>
          ${t.parcelaTotal > 1 ? `<span class="tiny dim">Parcela ${t.parcelaNum} de ${t.parcelaTotal}</span>` : ''}
          ${t.origemTipo === 'assinatura' ? '<span class="tiny dim">Assinatura</span>' : ''}
          ${t.origemTipo === 'contaFixa' ? '<span class="tiny dim">Conta fixa</span>' : ''}
        </td>
        <td><span class="row gap-2">${CF.ui.catIcon(t.categoria, t.tipo)}<span class="small truncate">${U.esc(cat.nome)}</span></span></td>
        <td><span class="badge ${receita ? 'badge-income' : 'badge-expense'}">${receita ? 'Receita' : 'Despesa'}</span></td>
        <td class="small muted truncate">${U.esc(pg.nome)}${cartao ? ` · ${U.esc(cartao.nome)}` : ''}</td>
        <td class="col-value ${receita ? 'income' : 'expense'}">${receita ? '+' : '−'} ${U.money(t.valor)}</td>
        <td>${CF.ui.badgeStatus(status)}</td>
        <td class="col-actions">
          <button class="btn-icon" data-act="menu-txn" data-id="${t.id}" aria-label="Ações">
            <i data-lucide="ellipsis-vertical" class="icon"></i></button>
        </td>
      </tr>`;
  }

  function ligarFiltros(el, params) {
    const aplicar = U.debounce(() => S().emit('change'), 260);
    const bind = (id, campo, transformar = (v) => v) => {
      const node = el.querySelector(id);
      if (!node) return;
      node.addEventListener(node.tagName === 'SELECT' ? 'change' : 'input', () => {
        filtros[campo] = transformar(node.value);
        limite = 40;
        if (node.tagName === 'SELECT') S().emit('change'); else aplicar();
      });
    };
    bind('#f-busca', 'busca');
    bind('#f-tipo', 'tipo');
    bind('#f-categoria', 'categoria');
    bind('#f-status', 'status');
    bind('#f-cartao', 'cartaoId');
    bind('#f-forma', 'formaPagamento');
    bind('#f-min', 'min', (v) => (v === '' ? null : Number(v)));
    bind('#f-max', 'max', (v) => (v === '' ? null : Number(v)));

    // devolve o foco ao campo de busca após o re-render
    const busca = el.querySelector('#f-busca');
    if (busca && filtros.busca) {
      busca.focus();
      busca.setSelectionRange(busca.value.length, busca.value.length);
    }
  }

  function exportarCSV(lista) {
    const cab = ['ID', 'Data', 'Tipo', 'Descrição', 'Categoria', 'Subcategoria', 'Valor', 'Forma de pagamento', 'Cartão', 'Conta', 'Status', 'Observação'];
    const linhas = lista.map(t => [
      t.id, U.fmtDate(t.data), t.tipo, t.descricao,
      CF.catalog.categoria(t.categoria, t.tipo).nome, t.subcategoria || '',
      U.number(t.valor), CF.catalog.pagamento(t.formaPagamento).nome,
      S().cartao(t.cartaoId)?.nome || '', S().conta(t.contaId)?.nome || '',
      S().statusReal(t), t.observacao || ''
    ]);
    const csv = [cab, ...linhas]
      .map(l => l.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `movimentacoes-${CF.store.periodo.mk}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    CF.ui.ok('Arquivo CSV gerado.');
  }

  return { titulo: 'Movimentações', render };
})();

CF.views.despesas = {
  titulo: 'Despesas',
  render: (el) => CF.views.transacoes.render(el, { tipo: 'despesa' })
};

CF.views.receitas = {
  titulo: 'Receitas',
  render: (el) => CF.views.transacoes.render(el, { tipo: 'receita' })
};
