/* ============================================================
   views/contas.js — contas a pagar, contas fixas e contas
   bancárias/carteiras.
   ============================================================ */

CF.views = CF.views || {};

CF.views.contas = (function () {
  const U = CF.utils;
  const S = () => CF.store;
  let aba = 'pagar';

  function render(el) {
    const st = S();
    if (st.state.carregando) { el.innerHTML = CF.ui.skeleton.pagina(); U.icons(el); return; }

    const pendentes = U.sortBy(st.state.transacoes.filter(t => t.tipo === 'despesa' && t.status !== 'pago'), t => t.data, 1);
    const atrasadas = pendentes.filter(t => t.data < U.today());
    const doMes = pendentes.filter(t => t.data >= st.periodo.de && t.data <= st.periodo.ate);
    const pagasNoPeriodo = st.transacoes({ tipo: 'despesa', status: 'pago' });

    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">Contas</div>
          <div class="view-sub">Contas a pagar, contas fixas e suas contas bancárias</div>
        </div>
        <div class="row gap-2">
          <button class="btn btn-outline" data-act="nova-conta-banco"><i data-lucide="landmark" class="icon"></i>Nova conta bancária</button>
          <button class="btn btn-primary" data-act="nova-fixa"><i data-lucide="plus" class="icon"></i>Nova conta fixa</button>
        </div>
      </div>

      <div class="grid grid-4 mb-4 stagger">
        ${CF.ui.metric({ label: 'A pagar no período', variante: 'warning', icone: 'clock',
          valor: U.money(U.sum(doMes, t => t.valor)),
          rodape: `<span class="dim">${U.plural(doMes.length, 'conta', 'contas')}</span>` })}
        ${CF.ui.metric({ label: 'Em atraso', variante: 'expense', icone: 'triangle-alert',
          valor: `<span class="${atrasadas.length ? 'expense' : ''}">${U.money(U.sum(atrasadas, t => t.valor))}</span>`,
          rodape: `<span class="dim">${U.plural(atrasadas.length, 'conta atrasada', 'contas atrasadas')}</span>` })}
        ${CF.ui.metric({ label: 'Pago no período', variante: 'income', icone: 'circle-check',
          valor: `<span class="income">${U.money(U.sum(pagasNoPeriodo, t => t.valor))}</span>`,
          rodape: `<span class="dim">${U.plural(pagasNoPeriodo.length, 'lançamento', 'lançamentos')}</span>` })}
        ${CF.ui.metric({ label: 'Contas fixas ativas', icone: 'repeat',
          valor: String(st.state.contasFixas.filter(c => c.status !== 'pausada').length),
          rodape: `<span class="dim">${U.money(U.sum(st.state.contasFixas.filter(c => c.status !== 'pausada'), c => c.valor))} por mês</span>` })}
      </div>

      <div class="tabs mb-4">
        <button class="tab ${aba === 'pagar' ? 'is-active' : ''}" data-act="aba" data-val="pagar">
          A pagar <span class="badge">${pendentes.length}</span></button>
        <button class="tab ${aba === 'fixas' ? 'is-active' : ''}" data-act="aba" data-val="fixas">
          Contas fixas <span class="badge">${st.state.contasFixas.length}</span></button>
        <button class="tab ${aba === 'pagas' ? 'is-active' : ''}" data-act="aba" data-val="pagas">
          Pagas <span class="badge">${pagasNoPeriodo.length}</span></button>
        <button class="tab ${aba === 'bancos' ? 'is-active' : ''}" data-act="aba" data-val="bancos">
          Contas bancárias <span class="badge">${st.state.contas.length}</span></button>
      </div>

      <div id="aba-conteudo">${conteudo(aba, { pendentes, pagasNoPeriodo })}</div>`;

    U.icons(el);

    return CF.ui.acoes(el, {
      aba: (b) => { aba = b.dataset.val; S().emit('change'); },
      'nova-fixa': () => CF.forms.contaFixa(),
      'nova-conta-banco': () => CF.forms.conta(),
      'editar-fixa': (b) => CF.forms.contaFixa(st.state.contasFixas.find(c => c.id === b.dataset.id)),
      'editar-banco': (b) => CF.forms.conta(st.state.contas.find(c => c.id === b.dataset.id)),
      'ver-txn': (b) => CF.app.detalheTransacao(b.dataset.id),
      pagar: async (b) => { await st.alternarPagamento(b.dataset.id); CF.ui.ok('Conta marcada como paga.'); },
      desfazer: async (b) => { await st.alternarPagamento(b.dataset.id); CF.ui.ok('Pagamento desfeito.'); },
      'pagar-todas': async () => {
        const alvo = pendentes.filter(t => t.data <= U.today());
        if (!alvo.length) return CF.ui.aviso('Nenhuma conta vencida para quitar.');
        const sim = await CF.ui.confirmar({
          titulo: 'Quitar contas vencidas?',
          texto: `${U.plural(alvo.length, 'conta será marcada', 'contas serão marcadas')} como paga, totalizando ${U.money(U.sum(alvo, t => t.valor))}.`,
          confirmarTexto: 'Confirmar', perigo: false, icone: 'check-check'
        });
        if (!sim) return;
        for (const t of alvo) await st.atualizar('transacoes', t.id, { status: 'pago' });
        CF.ui.ok('Contas quitadas.');
      },
      'excluir-fixa': async (b) => {
        const c = st.state.contasFixas.find(x => x.id === b.dataset.id);
        const sim = await CF.ui.confirmar({
          titulo: 'Excluir conta fixa?',
          texto: `"${c.nome}" será removida e as cobranças futuras ainda não pagas serão apagadas.`,
          confirmarTexto: 'Excluir'
        });
        if (!sim) return;
        await st.excluirContaFixa(c.id);
        CF.ui.ok('Conta fixa removida.');
      },
      'excluir-banco': async (b) => {
        const c = st.state.contas.find(x => x.id === b.dataset.id);
        const sim = await CF.ui.confirmar({
          titulo: 'Excluir conta?',
          texto: `"${c.nome}" será removida. Os lançamentos permanecem, mas sem conta vinculada.`,
          confirmarTexto: 'Excluir'
        });
        if (!sim) return;
        await st.excluirConta(c.id);
        CF.ui.ok('Conta removida.');
      },
      'pausar-fixa': async (b) => {
        const c = st.state.contasFixas.find(x => x.id === b.dataset.id);
        const novo = c.status === 'pausada' ? 'ativa' : 'pausada';
        await st.atualizar('contasFixas', c.id, { status: novo });
        CF.ui.ok(novo === 'ativa' ? 'Conta reativada.' : 'Conta pausada.');
      }
    });
  }

  /* ---------------- Conteúdo das abas ---------------- */

  function conteudo(qual, dados) {
    const st = S();

    if (qual === 'pagar') {
      if (!dados.pendentes.length) {
        return `<div class="card">${CF.ui.empty({
          icone: 'calendar-check', titulo: 'Nenhuma conta pendente',
          texto: 'Tudo em dia! Quando houver contas a vencer, elas aparecem aqui.',
          acao: 'Cadastrar conta fixa', acaoId: 'nova-fixa'
        })}</div>`;
      }
      const grupos = U.groupBy(dados.pendentes, t => U.monthOf(t.data));
      let html = `<div class="row-between mb-4">
        <span class="muted small">${U.plural(dados.pendentes.length, 'conta pendente', 'contas pendentes')}</span>
        <button class="btn btn-soft btn-sm" data-act="pagar-todas">
          <i data-lucide="check-check" class="icon-sm"></i>Quitar contas vencidas</button>
      </div><div class="col gap-4">`;
      [...grupos.keys()].sort().forEach(mk => {
        const itens = grupos.get(mk);
        html += `<div class="card">
          <div class="card-header">
            <div class="card-title">${U.monthLabel(mk)}</div>
            <span class="badge badge-warning">${U.money(U.sum(itens, t => t.valor))}</span>
          </div>
          <div class="txn-list">${itens.map(linhaPagar).join('')}</div>
        </div>`;
      });
      return html + '</div>';
    }

    if (qual === 'fixas') {
      const lista = st.state.contasFixas;
      if (!lista.length) {
        return `<div class="card">${CF.ui.empty({
          icone: 'receipt-text', titulo: 'Nenhuma conta fixa cadastrada',
          texto: 'Aluguel, energia, internet, faculdade… cadastre uma vez e o sistema gera a conta de cada mês.',
          acao: 'Adicionar primeira conta', acaoId: 'nova-fixa'
        })}</div>`;
      }
      return `<div class="grid grid-auto stagger">${U.sortBy(lista, c => c.diaVencimento, 1).map(cardFixa).join('')}</div>`;
    }

    if (qual === 'pagas') {
      if (!dados.pagasNoPeriodo.length) {
        return `<div class="card">${CF.ui.empty({ icone: 'circle-check', titulo: 'Nenhum pagamento no período', texto: 'Os lançamentos quitados aparecem aqui.' })}</div>`;
      }
      return `<div class="card"><div class="txn-list">
        ${dados.pagasNoPeriodo.slice(0, 60).map(t => `
          <div class="txn-item">
            <span class="txn-ico" style="background:var(--income-soft);color:var(--income)">
              <i data-lucide="check" class="icon"></i></span>
            <div class="txn-main" data-act="ver-txn" data-id="${t.id}">
              <div class="txn-title truncate">${U.esc(t.descricao)}</div>
              <div class="txn-meta"><span>${U.fmtDate(t.data)}</span><span>•</span>
                <span>${U.esc(CF.catalog.categoria(t.categoria, 'despesa').nome)}</span></div>
            </div>
            <div class="txn-value">${U.money(t.valor)}</div>
            <button class="btn btn-ghost btn-sm" data-act="desfazer" data-id="${t.id}">Desfazer</button>
          </div>`).join('')}
      </div></div>`;
    }

    // bancos
    const contas = st.saldoContas();
    if (!contas.length) {
      return `<div class="card">${CF.ui.empty({
        icone: 'landmark', titulo: 'Nenhuma conta bancária cadastrada',
        texto: 'Cadastre suas contas e carteiras para acompanhar o saldo real de cada uma.',
        acao: 'Adicionar conta', acaoId: 'nova-conta-banco'
      })}</div>`;
    }
    return `<div class="grid grid-auto stagger">${contas.map(cardBanco).join('')}</div>`;
  }

  function linhaPagar(t) {
    const cat = CF.catalog.categoria(t.categoria, 'despesa');
    const atrasado = t.data < U.today();
    return `
      <div class="txn-item">
        <span class="txn-ico" style="background:${U.withAlpha(cat.cor, .14)};color:${cat.cor}">
          <i data-lucide="${cat.icone}" class="icon"></i></span>
        <div class="txn-main" data-act="ver-txn" data-id="${t.id}">
          <div class="txn-title truncate">${U.esc(t.descricao)}</div>
          <div class="txn-meta">
            <span class="${atrasado ? 'expense bold' : ''}">${U.fmtDate(t.data)}</span>
            <span>•</span><span>${U.relativeDay(t.data)}</span>
            ${atrasado ? '<span class="badge badge-expense">Atrasado</span>' : ''}
          </div>
        </div>
        <div class="txn-value">${U.money(t.valor)}</div>
        <button class="btn btn-soft btn-sm" data-act="pagar" data-id="${t.id}">
          <i data-lucide="check" class="icon-sm"></i>Pagar</button>
      </div>`;
  }

  function cardFixa(c) {
    const cat = CF.catalog.categoria(c.categoria, 'despesa');
    const pausada = c.status === 'pausada';
    const proximo = U.dayInMonth(U.monthOf(U.today()), c.diaVencimento);
    const proximaData = proximo >= U.today() ? proximo : U.dayInMonth(U.addMonthKey(U.monthOf(U.today()), 1), c.diaVencimento);
    return `
      <div class="card card-hover" style="opacity:${pausada ? .6 : 1}">
        <div class="row-between mb-4">
          <span class="row gap-3">
            <span class="cat-ico" style="width:44px;height:44px;background:${U.withAlpha(cat.cor, .14)};color:${cat.cor}">
              <i data-lucide="${cat.icone}" class="icon-lg"></i></span>
            <span>
              <span class="bold" style="display:block">${U.esc(c.nome)}</span>
              <span class="tiny dim">${U.esc(cat.nome)} · ${U.esc(CF.catalog.recorrencia(c.recorrencia).nome)}</span>
            </span>
          </span>
          <span class="badge ${pausada ? 'badge-warning' : 'badge-income'}">${pausada ? 'Pausada' : 'Ativa'}</span>
        </div>

        <div class="row-between">
          <span class="h2">${U.money(c.valor)}</span>
          <span class="right">
            <span class="tiny dim" style="display:block">Vence dia</span>
            <span class="bold">${c.diaVencimento}</span>
          </span>
        </div>

        <div class="tiny dim mt-2">Próximo vencimento: ${U.fmtDate(proximaData)} (${U.relativeDay(proximaData)})</div>

        <div class="row gap-2 mt-4">
          <button class="btn btn-outline btn-sm grow" data-act="editar-fixa" data-id="${c.id}">
            <i data-lucide="pencil" class="icon-sm"></i>Editar</button>
          <button class="btn btn-ghost btn-sm" data-act="pausar-fixa" data-id="${c.id}" data-tip="${pausada ? 'Reativar' : 'Pausar'}">
            <i data-lucide="${pausada ? 'play' : 'pause'}" class="icon-sm"></i></button>
          <button class="btn btn-ghost btn-sm" data-act="excluir-fixa" data-id="${c.id}" data-tip="Excluir">
            <i data-lucide="trash-2" class="icon-sm"></i></button>
        </div>
      </div>`;
  }

  function cardBanco(c) {
    const tipo = CF.catalog.TIPOS_CONTA.find(t => t.id === c.tipo) || CF.catalog.TIPOS_CONTA[0];
    return `
      <div class="card card-hover">
        <div class="row-between mb-4">
          <span class="row gap-3">
            <span class="cat-ico" style="width:44px;height:44px;background:var(--brand-soft);color:var(--brand)">
              <i data-lucide="${tipo.icone}" class="icon-lg"></i></span>
            <span>
              <span class="bold" style="display:block">${U.esc(c.nome)}</span>
              <span class="tiny dim">${U.esc(c.instituicao || tipo.nome)}</span>
            </span>
          </span>
          ${c.ativo === false ? '<span class="badge">Inativa</span>' : ''}
        </div>
        <div class="tiny dim">Saldo atual</div>
        <div class="h1 ${c.saldo >= 0 ? '' : 'expense'} num">${U.money(c.saldo)}</div>
        <div class="tiny dim mt-2">${U.plural(c.movimentos, 'movimentação registrada', 'movimentações registradas')} · saldo inicial ${U.money(c.saldoInicial)}</div>
        <div class="row gap-2 mt-4">
          <button class="btn btn-outline btn-sm grow" data-act="editar-banco" data-id="${c.id}">
            <i data-lucide="pencil" class="icon-sm"></i>Editar</button>
          <button class="btn btn-ghost btn-sm" data-act="excluir-banco" data-id="${c.id}" data-tip="Excluir">
            <i data-lucide="trash-2" class="icon-sm"></i></button>
        </div>
      </div>`;
  }

  return { titulo: 'Contas', render };
})();
