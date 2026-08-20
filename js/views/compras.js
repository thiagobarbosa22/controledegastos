/* ============================================================
   views/compras.js — compras avulsas e parceladas
   ============================================================ */

CF.views = CF.views || {};

CF.views.compras = (function () {
  const U = CF.utils;
  const S = () => CF.store;
  let aba = 'parceladas';

  function render(el) {
    const st = S();
    if (st.state.carregando) { el.innerHTML = CF.ui.skeleton.pagina(); U.icons(el); return; }

    const todas = st.comprasComProgresso();
    const parceladas = U.sortBy(todas.filter(c => c.parcelas > 1), c => c.quitada ? 1 : 0, 1);
    const avulsas = U.sortBy(todas.filter(c => c.parcelas <= 1), c => c.dataCompra, -1);
    const emAberto = parceladas.filter(c => !c.quitada);

    const totalRestante = U.sum(emAberto, c => c.restante);
    const parcelaMensal = U.sum(emAberto, c => c.valorParcela);
    const lista = aba === 'parceladas' ? parceladas : avulsas;

    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">Compras</div>
          <div class="view-sub">Compras avulsas e parcelamentos em andamento</div>
        </div>
        <div class="row gap-2">
          <button class="btn btn-outline" data-act="nova-avulsa"><i data-lucide="shopping-bag" class="icon"></i>Compra avulsa</button>
          <button class="btn btn-primary" data-act="nova-parcelada"><i data-lucide="layers" class="icon"></i>Compra parcelada</button>
        </div>
      </div>

      <div class="grid grid-4 stagger">
        ${CF.ui.metric({ label: 'Parcelamentos ativos', icone: 'layers', valor: String(emAberto.length),
          rodape: `<span class="dim">${U.plural(parceladas.length, 'compra parcelada', 'compras parceladas')} no total</span>` })}
        ${CF.ui.metric({ label: 'Saldo devedor', variante: 'expense', icone: 'banknote',
          valor: `<span class="expense">${U.money(totalRestante)}</span>`,
          rodape: `<span class="dim">ainda a pagar</span>` })}
        ${CF.ui.metric({ label: 'Compromisso mensal', variante: 'warning', icone: 'calendar-clock',
          valor: U.money(parcelaMensal), rodape: `<span class="dim">soma das parcelas do mês</span>` })}
        ${CF.ui.metric({ label: 'Compras no período', variante: 'info', icone: 'receipt',
          valor: String(todas.filter(c => c.dataCompra >= st.periodo.de && c.dataCompra <= st.periodo.ate).length),
          rodape: `<span class="dim">${U.esc(st.periodoLabel())}</span>` })}
      </div>

      <div class="section">
        <div class="tabs mb-4">
          <button class="tab ${aba === 'parceladas' ? 'is-active' : ''}" data-act="aba" data-val="parceladas">
            Parceladas <span class="badge">${parceladas.length}</span></button>
          <button class="tab ${aba === 'avulsas' ? 'is-active' : ''}" data-act="aba" data-val="avulsas">
            Avulsas <span class="badge">${avulsas.length}</span></button>
        </div>

        ${lista.length
          ? (aba === 'parceladas'
              ? `<div class="grid grid-2 stagger">${lista.map(cardParcelada).join('')}</div>`
              : `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="table">
                   <thead><tr><th>Data</th><th>Produto</th><th>Categoria</th><th>Loja</th><th>Pagamento</th><th class="col-value">Valor</th><th class="col-actions"></th></tr></thead>
                   <tbody>${lista.map(linhaAvulsa).join('')}</tbody></table></div></div>`)
          : CF.ui.empty({
              icone: 'shopping-bag',
              titulo: aba === 'parceladas' ? 'Nenhuma compra parcelada' : 'Nenhuma compra avulsa',
              texto: aba === 'parceladas'
                ? 'Registre uma compra parcelada e o sistema lança todas as parcelas futuras automaticamente.'
                : 'Registre suas compras à vista para acompanhar onde o dinheiro está indo.',
              acao: aba === 'parceladas' ? 'Adicionar compra parcelada' : 'Adicionar compra avulsa',
              acaoId: aba === 'parceladas' ? 'nova-parcelada' : 'nova-avulsa'
            })}
      </div>`;

    U.icons(el);

    return CF.ui.acoes(el, {
      aba: (b) => { aba = b.dataset.val; S().emit('change'); },
      'nova-avulsa': () => CF.forms.compra(null, 'avulsa'),
      'nova-parcelada': () => CF.forms.compra(null, 'parcelada'),
      editar: (b) => CF.forms.compra(st.state.compras.find(c => c.id === b.dataset.id)),
      parcelas: (b) => verParcelas(b.dataset.id),
      excluir: async (b) => {
        const c = st.state.compras.find(x => x.id === b.dataset.id);
        const sim = await CF.ui.confirmar({
          titulo: 'Excluir compra?',
          texto: `"${c.produto}" e todas as suas parcelas serão removidas do extrato. Esta ação não pode ser desfeita.`,
          confirmarTexto: 'Excluir'
        });
        if (!sim) return;
        await st.excluirCompra(c.id);
        CF.ui.ok('Compra removida.');
      },
      menu: (b) => {
        const c = st.state.compras.find(x => x.id === b.dataset.id);
        CF.ui.dropdown(b, [
          { label: 'Ver parcelas', icone: 'list', onClick: () => verParcelas(c.id) },
          { label: 'Editar', icone: 'pencil', onClick: () => CF.forms.compra(c) },
          { separador: true },
          { label: 'Excluir', icone: 'trash-2', perigo: true, onClick: async () => {
            const sim = await CF.ui.confirmar({ titulo: 'Excluir compra?', texto: `"${c.produto}" e todas as parcelas serão removidas.`, confirmarTexto: 'Excluir' });
            if (sim) { await S().excluirCompra(c.id); CF.ui.ok('Compra removida.'); }
          } }
        ]);
      }
    });
  }

  function cardParcelada(c) {
    const cat = CF.catalog.categoria(c.categoria, 'despesa');
    const cartao = c.cartaoId ? S().cartao(c.cartaoId) : null;
    return `
      <div class="card card-hover">
        <div class="row-between mb-4">
          <span class="row gap-3">
            <span class="cat-ico" style="width:44px;height:44px;background:${U.withAlpha(cat.cor, .14)};color:${cat.cor}">
              <i data-lucide="${cat.icone}" class="icon-lg"></i></span>
            <span>
              <span class="bold" style="display:block">${U.esc(c.produto)}</span>
              <span class="tiny dim">${U.esc(c.loja || cat.nome)} · ${U.fmtDate(c.dataCompra)}</span>
            </span>
          </span>
          <button class="btn-icon" data-act="menu" data-id="${c.id}" aria-label="Ações">
            <i data-lucide="ellipsis-vertical" class="icon"></i></button>
        </div>

        <div class="row-between mb-4">
          <div>
            <div class="h2">${U.money(c.valorTotal)}</div>
            <div class="tiny dim">${c.parcelas}x de ${U.money(c.valorParcela)}</div>
          </div>
          <span class="badge ${c.quitada ? 'badge-income' : 'badge-brand'}">
            ${c.quitada ? 'Quitada' : `${c.parcelasPagas} de ${c.parcelas} pagas`}</span>
        </div>

        ${CF.ui.progresso(c.pct, c.quitada ? 'success' : '', true)}

        <div class="grid grid-2 mt-4 gap-3">
          <div><div class="tiny dim">Total pago</div><div class="bold income num">${U.money(c.pago)}</div></div>
          <div class="right"><div class="tiny dim">Restante</div><div class="bold expense num">${U.money(c.restante)}</div></div>
          <div><div class="tiny dim">Próxima parcela</div>
            <div class="bold small">${c.proxima ? `${U.fmtDate(c.proxima.data)} · ${U.money(c.proxima.valor)}` : '—'}</div></div>
          <div class="right"><div class="tiny dim">Conclusão</div>
            <div class="bold small">${U.fmtDate(c.conclusao)}</div></div>
        </div>

        ${cartao ? `<div class="row gap-2 mt-4 tiny dim">
          <i data-lucide="credit-card" class="icon-sm"></i>${U.esc(cartao.nome)} •••• ${U.esc(cartao.final || '----')}</div>` : ''}

        <button class="btn btn-outline btn-sm btn-block mt-4" data-act="parcelas" data-id="${c.id}">
          <i data-lucide="list" class="icon-sm"></i>Ver parcelas</button>
      </div>`;
  }

  function linhaAvulsa(c) {
    const cat = CF.catalog.categoria(c.categoria, 'despesa');
    const cartao = c.cartaoId ? S().cartao(c.cartaoId) : null;
    return `
      <tr>
        <td class="num small" style="white-space:nowrap">${U.fmtDate(c.dataCompra)}</td>
        <td class="bold">${U.esc(c.produto)}</td>
        <td><span class="row gap-2">${CF.ui.catIcon(c.categoria, 'despesa')}<span class="small">${U.esc(cat.nome)}</span></span></td>
        <td class="small muted">${U.esc(c.loja || '—')}</td>
        <td class="small muted">${cartao ? U.esc(cartao.nome) : U.esc(CF.catalog.pagamento(c.formaPagamento).nome)}</td>
        <td class="col-value expense">${U.money(c.valorTotal)}</td>
        <td class="col-actions">
          <button class="btn-icon" data-act="menu" data-id="${c.id}" aria-label="Ações">
            <i data-lucide="ellipsis-vertical" class="icon"></i></button>
        </td>
      </tr>`;
  }

  function verParcelas(compraId) {
    const c = S().comprasComProgresso().find(x => x.id === compraId);
    if (!c) return;
    const parcelas = U.sortBy(S().state.transacoes.filter(t => t.compraId === compraId || (t.origemTipo === 'compra' && t.origemId === compraId)), t => t.data, 1);

    const modal = CF.ui.abrirModal({
      titulo: c.produto,
      subtitulo: `${c.parcelas}x de ${U.money(c.valorParcela)} · total ${U.money(c.valorTotal)}`,
      corpo: `
        <div class="mb-4">${CF.ui.progresso(c.pct, c.quitada ? 'success' : '', true)}</div>
        <div class="row-between mb-4 small">
          <span class="muted">Pago: <b class="income">${U.money(c.pago)}</b></span>
          <span class="muted">Restante: <b class="expense">${U.money(c.restante)}</b></span>
        </div>
        <div class="table-wrap">
          <table class="table" style="min-width:0">
            <thead><tr><th>#</th><th>Vencimento</th><th class="col-value">Valor</th><th>Status</th><th class="col-actions"></th></tr></thead>
            <tbody>
              ${parcelas.map(p => `
                <tr>
                  <td class="bold">${p.parcelaNum || 1}/${p.parcelaTotal || 1}</td>
                  <td class="small">${U.fmtDate(p.data)}</td>
                  <td class="col-value">${U.money(p.valor)}</td>
                  <td>${CF.ui.badgeStatus(S().statusReal(p))}</td>
                  <td class="col-actions">
                    <button class="btn btn-sm ${p.status === 'pago' ? 'btn-ghost' : 'btn-soft'}" data-parcela="${p.id}">
                      ${p.status === 'pago' ? 'Desfazer' : 'Pagar'}</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`,
      rodape: `<button class="btn btn-ghost" data-modal-close>Fechar</button>`
    });

    modal.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-parcela]');
      if (!b) return;
      await S().alternarPagamento(b.dataset.parcela);
      CF.ui.fecharModal();
      CF.ui.ok('Parcela atualizada.');
    });
  }

  return { titulo: 'Compras', render };
})();
