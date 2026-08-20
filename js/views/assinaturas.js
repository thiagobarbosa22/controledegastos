/* ============================================================
   views/assinaturas.js — serviços recorrentes
   ============================================================ */

CF.views = CF.views || {};

CF.views.assinaturas = (function () {
  const U = CF.utils;
  const S = () => CF.store;
  let filtroStatus = 'ativa';

  function render(el) {
    const st = S();
    if (st.state.carregando) { el.innerHTML = CF.ui.skeleton.pagina(); U.icons(el); return; }

    const res = st.assinaturasResumo();
    const todas = st.state.assinaturas;
    const lista = U.sortBy(
      filtroStatus === 'todas' ? todas : todas.filter(a => a.status === filtroStatus),
      a => a.proximaCobranca || '9999-12-31', 1
    );
    const porCategoria = agruparPorCategoria(todas.filter(a => a.status === 'ativa'));

    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">Assinaturas</div>
          <div class="view-sub">Todos os serviços que se repetem automaticamente</div>
        </div>
        <button class="btn btn-primary" data-act="nova"><i data-lucide="plus" class="icon"></i>Nova assinatura</button>
      </div>

      <div class="grid grid-4 stagger">
        ${CF.ui.metric({ label: 'Assinaturas ativas', icone: 'repeat', valor: String(res.qtd),
          rodape: `<span class="dim">${res.qtdTotal - res.qtd} pausadas ou canceladas</span>` })}
        ${CF.ui.metric({ label: 'Custo mensal', variante: 'expense', icone: 'calendar',
          valor: `<span class="expense">${U.money(res.mensal)}</span>`,
          rodape: `<span class="dim">média por mês</span>` })}
        ${CF.ui.metric({ label: 'Custo anual estimado', variante: 'warning', icone: 'calendar-range',
          valor: U.money(res.anual), rodape: `<span class="dim">projeção de 12 meses</span>` })}
        ${CF.ui.metric({ label: 'Próxima cobrança', variante: 'info', icone: 'clock',
          valor: res.proximas[0] ? U.money(res.proximas[0].valor) : '—',
          rodape: res.proximas[0]
            ? `<span class="dim">${U.esc(res.proximas[0].nome)} · ${U.relativeDay(res.proximas[0].proximaCobranca)}</span>`
            : '<span class="dim">nenhuma agendada</span>' })}
      </div>

      ${todas.length ? `
      <div class="section grid" style="grid-template-columns:1fr 1.4fr;align-items:start">
        <div class="card">
          <div class="card-header"><div class="card-title">Distribuição por categoria</div></div>
          ${porCategoria.length ? `
            <div class="chart-box short"><canvas id="ch-ass"></canvas></div>
            <div class="legend mt-4">
              ${porCategoria.map(c => `
                <div class="legend-item">
                  <span class="legend-swatch" style="background:${c.cor}"></span>
                  <span class="grow truncate">${U.esc(c.nome)}</span>
                  <span class="bold small num">${U.money(c.valor)}</span>
                </div>`).join('')}
            </div>` : '<p class="muted small">Nenhuma assinatura ativa.</p>'}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Próximas cobranças</div>
            <span class="badge badge-brand">${U.plural(res.proximas.length, 'cobrança', 'cobranças')}</span>
          </div>
          ${res.proximas.length ? `<div class="txn-list">
            ${res.proximas.map(a => {
              const cat = CF.catalog.categoria(a.categoria, 'despesa');
              const dias = U.daysUntil(a.proximaCobranca);
              return `<div class="txn-item" data-act="editar" data-id="${a.id}">
                <span class="txn-ico" style="background:${U.withAlpha(cat.cor, .14)};color:${cat.cor}">
                  <i data-lucide="${cat.icone}" class="icon"></i></span>
                <div class="txn-main">
                  <div class="txn-title">${U.esc(a.nome)}</div>
                  <div class="txn-meta"><span>${U.fmtDate(a.proximaCobranca)}</span><span>•</span>
                    <span class="${dias <= 1 ? 'text-warning bold' : ''}">${U.relativeDay(a.proximaCobranca)}</span></div>
                </div>
                <div class="txn-value">${U.money(a.valor)}</div>
              </div>`;
            }).join('')}
          </div>` : '<p class="muted small">Sem cobranças agendadas.</p>'}
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <div class="section-title">Suas assinaturas</div>
          <div class="segmented">
            ${['ativa', 'pausada', 'cancelada', 'todas'].map(s => `
              <button data-act="filtro" data-val="${s}" class="${filtroStatus === s ? 'is-active' : ''}">
                ${s === 'todas' ? 'Todas' : s.charAt(0).toUpperCase() + s.slice(1) + 's'}</button>`).join('')}
          </div>
        </div>
        ${lista.length ? `<div class="grid grid-auto stagger">${lista.map(cardAssinatura).join('')}</div>`
          : CF.ui.empty({ icone: 'repeat', titulo: 'Nenhuma assinatura neste filtro', texto: 'Troque o filtro acima ou cadastre uma nova assinatura.', acao: 'Nova assinatura', acaoId: 'nova' })}
      </div>`
      : CF.ui.empty({
          icone: 'repeat', titulo: 'Você ainda não possui nenhuma assinatura',
          texto: 'Cadastre Netflix, Spotify, academia e outros serviços recorrentes. O sistema lança as cobranças automaticamente.',
          acao: 'Adicionar primeira assinatura', acaoId: 'nova'
        })}`;

    U.icons(el);
    if (porCategoria.length) CF.charts.rosca('ch-ass', porCategoria, { legenda: false });

    return CF.ui.acoes(el, {
      nova: () => CF.forms.assinatura(),
      filtro: (b) => { filtroStatus = b.dataset.val; S().emit('change'); },
      editar: (b) => CF.forms.assinatura(st.state.assinaturas.find(a => a.id === b.dataset.id)),
      pausar: (b) => pausar(b.dataset.id),
      excluir: (b) => excluir(b.dataset.id),
      menu: (b) => {
        const a = st.state.assinaturas.find(x => x.id === b.dataset.id);
        CF.ui.dropdown(b, [
          { label: 'Editar', icone: 'pencil', onClick: () => CF.forms.assinatura(a) },
          { label: a.status === 'ativa' ? 'Pausar' : 'Reativar', icone: a.status === 'ativa' ? 'pause' : 'play',
            onClick: () => pausar(a.id) },
          { label: 'Ver lançamentos', icone: 'list', onClick: () => { location.hash = '#/transacoes'; } },
          { separador: true },
          { label: 'Excluir', icone: 'trash-2', perigo: true, onClick: () => excluir(a.id) }
        ]);
      }
    });
  }

  async function pausar(id) {
    const a = CF.store.state.assinaturas.find(x => x.id === id);
    if (!a) return;
    const novo = a.status === 'ativa' ? 'pausada' : 'ativa';
    await CF.store.atualizar('assinaturas', id, { status: novo });
    CF.ui.ok(novo === 'ativa' ? 'Assinatura reativada.' : 'Assinatura pausada.');
  }

  async function excluir(id) {
    const a = CF.store.state.assinaturas.find(x => x.id === id);
    if (!a) return;
    const sim = await CF.ui.confirmar({
      titulo: 'Excluir assinatura?',
      texto: `"${a.nome}" será removida. As cobranças futuras ainda não pagas também serão apagadas. Esta ação não pode ser desfeita.`,
      confirmarTexto: 'Excluir'
    });
    if (!sim) return;
    await CF.store.excluirAssinatura(id);
    CF.ui.ok('Assinatura removida.');
  }

  function cardAssinatura(a) {
    const cat = CF.catalog.categoria(a.categoria, 'despesa');
    const cartao = a.cartaoId ? S().cartao(a.cartaoId) : null;
    const per = CF.catalog.recorrencia(a.periodicidade || 'mensal');
    const stt = CF.catalog.STATUS_ASSINATURA.find(s => s.id === a.status) || CF.catalog.STATUS_ASSINATURA[0];
    const dias = a.proximaCobranca ? U.daysUntil(a.proximaCobranca) : null;

    return `
      <div class="card card-hover" style="opacity:${a.status === 'cancelada' ? .6 : 1}">
        <div class="row-between mb-4">
          <span class="row gap-3">
            <span class="cat-ico" style="width:44px;height:44px;background:${U.withAlpha(cat.cor, .14)};color:${cat.cor}">
              <i data-lucide="${cat.icone}" class="icon-lg"></i></span>
            <span>
              <span class="bold" style="display:block">${U.esc(a.nome)}</span>
              <span class="tiny dim">${U.esc(cat.nome)} · ${U.esc(per.nome)}</span>
            </span>
          </span>
          <button class="btn-icon" data-act="menu" data-id="${a.id}" aria-label="Ações">
            <i data-lucide="ellipsis-vertical" class="icon"></i></button>
        </div>

        <div class="row-between">
          <span class="h2">${U.money(a.valor)}</span>
          <span class="badge ${stt.classe}">${stt.nome}</span>
        </div>

        <div class="col gap-1 mt-4">
          <div class="row-between tiny gap-2">
            <span class="dim" style="white-space:nowrap">Próxima</span>
            <span class="bold truncate ${dias !== null && dias <= 3 && a.status === 'ativa' ? 'text-warning' : ''}">
              ${a.proximaCobranca ? `${U.fmtDateShort(a.proximaCobranca)} · ${U.relativeDay(a.proximaCobranca)}` : '—'}</span>
          </div>
          <div class="row-between tiny gap-2">
            <span class="dim" style="white-space:nowrap">Pagamento</span>
            <span class="truncate">${cartao ? `${U.esc(cartao.nome)} ••${U.esc(cartao.final || '----')}` : U.esc(CF.catalog.pagamento(a.formaPagamento).nome)}</span>
          </div>
          <div class="row-between tiny gap-2">
            <span class="dim" style="white-space:nowrap">Custo anual</span>
            <span class="truncate">${U.money(a.valor * (12 / (per.meses || 1)))}</span>
          </div>
        </div>

        <div class="row gap-2 mt-4">
          <button class="btn btn-outline btn-sm grow" data-act="editar" data-id="${a.id}">
            <i data-lucide="pencil" class="icon-sm"></i>Editar</button>
          <button class="btn btn-ghost btn-sm" data-act="pausar" data-id="${a.id}">
            <i data-lucide="${a.status === 'ativa' ? 'pause' : 'play'}" class="icon-sm"></i>
            ${a.status === 'ativa' ? 'Pausar' : 'Ativar'}</button>
        </div>
      </div>`;
  }

  function agruparPorCategoria(ativas) {
    const grupos = U.groupBy(ativas, a => a.categoria || 'assinaturas');
    const out = [];
    grupos.forEach((itens, catId) => {
      const cat = CF.catalog.categoria(catId, 'despesa');
      const valor = U.sum(itens, a => {
        const r = CF.catalog.recorrencia(a.periodicidade || 'mensal');
        return a.valor / (r.meses || 1);
      });
      out.push({ id: catId, nome: cat.nome, cor: cat.cor, valor });
    });
    return U.sortBy(out, x => x.valor, -1);
  }

  return { titulo: 'Assinaturas', render };
})();
