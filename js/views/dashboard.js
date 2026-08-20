/* ============================================================
   views/dashboard.js — visão geral do mês
   ============================================================ */

CF.views = CF.views || {};

CF.views.dashboard = (function () {
  const U = CF.utils;
  const S = () => CF.store;

  function saudacao() {
    const h = new Date().getHours();
    const nome = CF.config.get('nome');
    const parte = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    return nome ? `${parte}, ${nome}!` : `${parte}!`;
  }

  /** Primeiro acesso: sem nenhum dado, um dashboard zerado não ajuda. */
  function vazio(st) {
    return !st.state.transacoes.length && !st.state.contas.length &&
           !st.state.cartoes.length && !st.state.assinaturas.length;
  }

  const PASSOS = [
    { icone: 'landmark', titulo: 'Cadastre suas contas', texto: 'Conta corrente, conta digital ou carteira, com o saldo que você tem hoje. É a base do seu saldo real.', acao: 'nova-conta-banco', botao: 'Adicionar conta' },
    { icone: 'credit-card', titulo: 'Adicione seus cartões', texto: 'Apelido, limite e os dias de fechamento e vencimento. Só isso — nada de número completo ou CVV.', acao: 'novo-cartao', botao: 'Adicionar cartão' },
    { icone: 'receipt-text', titulo: 'Cadastre as contas fixas', texto: 'Aluguel, energia, internet, faculdade. Cadastra uma vez e a conta de cada mês entra sozinha.', acao: 'nova-conta', botao: 'Adicionar conta fixa' },
    { icone: 'repeat', titulo: 'Liste suas assinaturas', texto: 'Netflix, Spotify, academia. O sistema soma o custo mensal e anual e avisa antes de cada cobrança.', acao: 'nova-assinatura', botao: 'Adicionar assinatura' }
  ];

  function renderPrimeiroAcesso(el) {
    const conectado = CF.config.remoto();
    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="greeting-title">Bem-vindo!</div>
          <div class="greeting-sub">Seu controle financeiro está vazio. Leva uns 5 minutos para deixá-lo pronto.</div>
        </div>
      </div>

      <div class="alert ${conectado ? 'is-success' : 'is-warning'} mb-4">
        <i data-lucide="${conectado ? 'circle-check' : 'triangle-alert'}" class="icon"></i>
        <span class="grow">
          ${conectado
            ? 'Planilha do Google Sheets conectada — tudo que você cadastrar fica salvo lá.'
            : 'Seus dados estão salvos <b>apenas neste navegador</b>. Conecte sua planilha do Google Sheets para acessar de qualquer aparelho e não perder nada.'}
        </span>
        ${conectado ? '' : '<button class="btn btn-sm btn-soft" data-act="ir" data-rota="#/configuracoes">Conectar planilha</button>'}
      </div>

      <div class="section">
        <div class="section-head"><div class="section-title">Primeiros passos</div></div>
        <div class="grid grid-2 stagger">
          ${PASSOS.map((p, i) => `
            <div class="card card-hover">
              <div class="row gap-3 mb-4">
                <span class="metric-ico"><i data-lucide="${p.icone}" class="icon-lg"></i></span>
                <div class="grow">
                  <div class="row gap-2">
                    <span class="badge badge-brand">Passo ${i + 1}</span>
                  </div>
                  <div class="card-title mt-2">${U.esc(p.titulo)}</div>
                </div>
              </div>
              <p class="muted small">${p.texto}</p>
              <button class="btn btn-primary btn-sm mt-4" data-act="${p.acao}">
                <i data-lucide="plus" class="icon-sm"></i>${U.esc(p.botao)}</button>
            </div>`).join('')}
        </div>
      </div>

      <div class="section card">
        <div class="card-header">
          <div>
            <div class="card-title">Já quer lançar alguma coisa?</div>
            <div class="card-sub">Você não precisa seguir a ordem — comece por onde preferir.</div>
          </div>
        </div>
        <div class="quick-actions">
          <button class="quick-action qa-expense" data-act="nova-despesa">
            <span class="qa-ico"><i data-lucide="minus-circle" class="icon-lg"></i></span>Despesa</button>
          <button class="quick-action qa-income" data-act="nova-receita">
            <span class="qa-ico"><i data-lucide="plus-circle" class="icon-lg"></i></span>Receita</button>
          <button class="quick-action" data-act="nova-assinatura">
            <span class="qa-ico"><i data-lucide="repeat" class="icon-lg"></i></span>Assinatura</button>
          <button class="quick-action qa-info" data-act="nova-compra">
            <span class="qa-ico"><i data-lucide="shopping-bag" class="icon-lg"></i></span>Compra</button>
          <button class="quick-action qa-warning" data-act="nova-meta">
            <span class="qa-ico"><i data-lucide="target" class="icon-lg"></i></span>Meta</button>
        </div>
      </div>`;

    U.icons(el);

    return CF.ui.acoes(el, {
      'nova-conta-banco': () => CF.forms.conta(),
      'novo-cartao': () => CF.forms.cartao(),
      'nova-conta': () => CF.forms.contaFixa(),
      'nova-assinatura': () => CF.forms.assinatura(),
      'nova-despesa': () => CF.forms.transacao('despesa'),
      'nova-receita': () => CF.forms.transacao('receita'),
      'nova-compra': () => CF.forms.compra(),
      'nova-meta': () => CF.forms.meta(),
      ir: (b) => { location.hash = b.dataset.rota; }
    });
  }

  function render(el) {
    const st = S();
    if (st.state.carregando) { el.innerHTML = CF.ui.skeleton.pagina(); U.icons(el); return; }
    if (vazio(st)) return renderPrimeiroAcesso(el);

    const p = st.periodo;
    const r = st.resumo();
    const mkAnterior = U.addMonthKey(p.mk, -1);
    const rAnterior = st.resumo(U.monthStart(mkAnterior), U.monthEnd(mkAnterior));
    const saldo = st.saldoAtual();
    const saldoAnterior = st.saldoAte(U.monthEnd(mkAnterior));
    const categorias = st.porCategoria('despesa');
    const serie = st.serieMensal(6);
    const vencimentos = st.proximosVencimentos(30, 5);
    const ultimas = st.transacoes({}).slice(0, 6);
    const alertas = st.alertas().slice(0, 2);
    const orcamentos = U.sortBy(st.orcamentoStatus(), o => o.pct, -1).slice(0, 3);
    const res = st.reserva();

    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="greeting-title">${U.esc(saudacao())}</div>
          <div class="greeting-sub">Aqui está sua situação financeira em <b>${U.esc(st.periodoLabel())}</b>.</div>
        </div>
        <div class="row gap-2">
          <button class="btn btn-outline" data-act="relatorio"><i data-lucide="chart-column" class="icon"></i>Relatórios</button>
          <button class="btn btn-primary" data-act="add"><i data-lucide="plus" class="icon"></i>Adicionar</button>
        </div>
      </div>

      ${alertas.length ? `<div class="col gap-2 mb-4">
        ${alertas.map(a => `
          <div class="alert is-${a.nivel === 'danger' ? 'danger' : a.nivel === 'warning' ? 'warning' : ''}"
               data-act="ir" data-rota="${a.rota}" style="cursor:pointer">
            <i data-lucide="${a.icone}" class="icon"></i>
            <span class="grow">${U.esc(a.texto)}</span>
            <i data-lucide="chevron-right" class="icon dim"></i>
          </div>`).join('')}
      </div>` : ''}

      <!-- ======= Cards principais ======= -->
      <div class="grid grid-4 stagger">
        ${CF.ui.metric({
          label: 'Saldo atual', hero: true, icone: 'wallet',
          valor: `<span data-count="saldo">${U.money(saldo)}</span>`,
          rodape: `${CF.ui.variacao(saldo, saldoAnterior)}<span style="opacity:.8">vs. mês anterior</span>`
        })}
        ${CF.ui.metric({
          label: 'Receitas do período', variante: 'income', icone: 'arrow-down-left',
          valor: `<span class="income" data-count="receitas">${U.money(r.receitas)}</span>`,
          rodape: `${CF.ui.variacao(r.receitas, rAnterior.receitas)}<span class="dim">vs. mês anterior</span>`
        })}
        ${CF.ui.metric({
          label: 'Despesas do período', variante: 'expense', icone: 'arrow-up-right',
          valor: `<span class="expense" data-count="despesas">${U.money(r.despesas)}</span>`,
          rodape: `${CF.ui.variacao(r.despesas, rAnterior.despesas, true)}<span class="dim">vs. mês anterior</span>`
        })}
        ${CF.ui.metric({
          label: 'Economia do período', variante: r.economia >= 0 ? 'info' : 'expense', icone: 'piggy-bank',
          valor: `<span class="${r.economia >= 0 ? 'income' : 'expense'}" data-count="economia">${U.money(r.economia)}</span>`,
          rodape: `<span class="badge ${r.taxaEconomia >= 20 ? 'badge-income' : r.taxaEconomia >= 0 ? 'badge-warning' : 'badge-expense'}">
                     ${U.pct(r.taxaEconomia, 1)} da renda</span>`
        })}
      </div>

      <div class="grid grid-3 mt-4 stagger">
        ${CF.ui.metric({
          label: 'Valores comprometidos', variante: 'warning', icone: 'lock',
          valor: U.money(r.comprometido),
          rodape: `<span class="dim">${U.plural(r.qtdPendentes, 'lançamento pendente', 'lançamentos pendentes')}</span>`
        })}
        ${CF.ui.metric({
          label: 'Fatura dos cartões', icone: 'credit-card',
          valor: U.money(U.sum(st.state.cartoes.filter(c => c.ativo !== false), c => st.usoCartao(c.id).faturaAtual?.total || 0)),
          rodape: `<span class="dim">${U.plural(st.state.cartoes.filter(c => c.ativo !== false).length, 'cartão ativo', 'cartões ativos')}</span>`
        })}
        ${CF.ui.metric({
          label: 'Reserva de emergência', variante: 'income', icone: 'shield-check',
          valor: U.money(res.atual),
          rodape: `<span class="dim">cobre ${res.meses.toFixed(1).replace('.', ',')} ${res.meses === 1 ? 'mês' : 'meses'} de despesas</span>`
        })}
      </div>

      <!-- ======= Ações rápidas ======= -->
      <div class="section mt-6">
        <div class="section-head">
          <div class="section-title">Ações rápidas</div>
          <span class="tiny dim">Registre em poucos cliques</span>
        </div>
        <div class="quick-actions">
          <button class="quick-action qa-expense" data-act="nova-despesa">
            <span class="qa-ico"><i data-lucide="minus-circle" class="icon-lg"></i></span>Despesa</button>
          <button class="quick-action qa-income" data-act="nova-receita">
            <span class="qa-ico"><i data-lucide="plus-circle" class="icon-lg"></i></span>Receita</button>
          <button class="quick-action" data-act="nova-assinatura">
            <span class="qa-ico"><i data-lucide="repeat" class="icon-lg"></i></span>Assinatura</button>
          <button class="quick-action qa-info" data-act="nova-compra">
            <span class="qa-ico"><i data-lucide="shopping-bag" class="icon-lg"></i></span>Compra</button>
          <button class="quick-action qa-warning" data-act="nova-conta">
            <span class="qa-ico"><i data-lucide="receipt-text" class="icon-lg"></i></span>Conta</button>
        </div>
      </div>

      <!-- ======= Gráficos ======= -->
      <div class="section grid" style="grid-template-columns:1.6fr 1fr;align-items:start">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Evolução financeira</div>
              <div class="card-sub">Receitas, despesas e economia dos últimos 6 meses</div>
            </div>
            <button class="btn btn-ghost btn-sm" data-act="relatorio">Ver mais<i data-lucide="arrow-right" class="icon-sm"></i></button>
          </div>
          <div class="chart-box"><canvas id="ch-evolucao"></canvas></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Gastos por categoria</div>
              <div class="card-sub">${U.esc(st.periodoLabel())}</div>
            </div>
          </div>
          ${categorias.length ? `
            <div class="chart-box"><canvas id="ch-categorias"></canvas></div>
            <div class="legend mt-4">
              ${categorias.slice(0, 5).map(c => `
                <div class="legend-item">
                  <span class="legend-swatch" style="background:${c.cor}"></span>
                  <span class="grow truncate">${U.esc(c.nome)}</span>
                  <span class="dim small">${U.pct(c.pct, 0)}</span>
                  <span class="bold small num">${U.money(c.valor)}</span>
                </div>`).join('')}
            </div>` : CF.ui.empty({
              icone: 'chart-pie', titulo: 'Sem gastos no período',
              texto: 'Adicione uma despesa para ver a distribuição por categoria.',
              acao: 'Adicionar despesa', acaoId: 'nova-despesa'
            })}
        </div>
      </div>

      <!-- ======= Listas ======= -->
      <div class="section grid grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Próximas contas</div>
              <div class="card-sub">Vencimentos dos próximos 30 dias</div>
            </div>
            <button class="btn btn-ghost btn-sm" data-act="ir" data-rota="#/calendario">Calendário</button>
          </div>
          ${vencimentos.length ? `<div class="txn-list">${vencimentos.map(t => linhaVencimento(t)).join('')}</div>`
            : CF.ui.empty({ icone: 'calendar-check', titulo: 'Nada a pagar por enquanto', texto: 'Você não tem contas pendentes nos próximos 30 dias.' })}
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Últimas movimentações</div>
              <div class="card-sub">${U.plural(S().transacoes({}).length, 'lançamento no período', 'lançamentos no período')}</div>
            </div>
            <button class="btn btn-ghost btn-sm" data-act="ir" data-rota="#/transacoes">Ver todas</button>
          </div>
          ${ultimas.length ? `<div class="txn-list">${ultimas.map(t => CF.ui.txnRow(t, { menu: false })).join('')}</div>`
            : CF.ui.empty({
                icone: 'receipt', titulo: 'Nenhuma movimentação',
                texto: 'Comece registrando sua primeira despesa ou receita.',
                acao: 'Adicionar despesa', acaoId: 'nova-despesa'
              })}
        </div>
      </div>

      <!-- ======= Orçamento e metas ======= -->
      <div class="section grid grid-2">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Orçamento do mês</div>
            <button class="btn btn-ghost btn-sm" data-act="ir" data-rota="#/metas">Gerenciar</button>
          </div>
          ${orcamentos.length ? `<div class="col gap-4">
            ${orcamentos.map(o => `
              <div>
                <div class="row-between mb-4" style="margin-bottom:6px">
                  <span class="row gap-2">${CF.ui.catIcon(o.categoria, 'despesa')}<span class="bold">${U.esc(o.nome)}</span></span>
                  <span class="small ${o.nivel === 'danger' ? 'expense' : o.nivel === 'warning' ? 'text-warning' : 'muted'} num">
                    ${U.money(o.gasto)} / ${U.money(o.limite)}</span>
                </div>
                ${CF.ui.progresso(o.pct, o.nivel)}
              </div>`).join('')}
          </div>` : CF.ui.empty({
            icone: 'wallet-cards', titulo: 'Nenhum orçamento definido',
            texto: 'Defina limites por categoria para controlar melhor seus gastos.',
            acao: 'Criar orçamento', acaoId: 'novo-orcamento'
          })}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Metas em andamento</div>
            <button class="btn btn-ghost btn-sm" data-act="ir" data-rota="#/metas">Ver todas</button>
          </div>
          ${st.metasComProgresso().length ? `<div class="col gap-4">
            ${U.sortBy(st.metasComProgresso(), m => m.pct, -1).slice(0, 3).map(m => `
              <div>
                <div class="row-between" style="margin-bottom:6px">
                  <span class="row gap-2">
                    <span class="cat-ico" style="background:${U.withAlpha(m.cor || '#6366f1', .14)};color:${m.cor || '#6366f1'}">
                      <i data-lucide="${m.icone || 'target'}" class="icon"></i></span>
                    <span class="bold">${U.esc(m.nome)}</span>
                  </span>
                  <span class="small muted num">${U.money(m.valorAtual)} / ${U.money(m.valorMeta)}</span>
                </div>
                ${CF.ui.progresso(m.pct, m.pct >= 100 ? 'success' : '')}
              </div>`).join('')}
          </div>` : CF.ui.empty({
            icone: 'target', titulo: 'Nenhuma meta criada',
            texto: 'Defina um objetivo financeiro e acompanhe o progresso.',
            acao: 'Criar primeira meta', acaoId: 'nova-meta'
          })}
        </div>
      </div>`;

    U.icons(el);

    /* ---- gráficos ---- */
    CF.charts.receitasDespesas('ch-evolucao', serie);
    if (categorias.length) CF.charts.rosca('ch-categorias', categorias.slice(0, 8), { legenda: false });

    /* ---- contadores animados ---- */
    U.animateCount(el.querySelector('[data-count="saldo"]'), saldo);
    U.animateCount(el.querySelector('[data-count="receitas"]'), r.receitas);
    U.animateCount(el.querySelector('[data-count="despesas"]'), r.despesas);
    U.animateCount(el.querySelector('[data-count="economia"]'), r.economia);

    /* ---- ações ---- */
    return CF.ui.acoes(el, {
      add: (b) => CF.app.menuAdicionar(b),
      'nova-despesa': () => CF.forms.transacao('despesa'),
      'nova-receita': () => CF.forms.transacao('receita'),
      'nova-assinatura': () => CF.forms.assinatura(),
      'nova-compra': () => CF.forms.compra(),
      'nova-conta': () => CF.forms.contaFixa(),
      'nova-meta': () => CF.forms.meta(),
      'novo-orcamento': () => CF.forms.orcamento(),
      relatorio: () => { location.hash = '#/relatorios'; },
      ir: (b) => { location.hash = b.dataset.rota; },
      'ver-txn': (b) => CF.app.detalheTransacao(b.dataset.id),
      pagar: async (b) => {
        await S().alternarPagamento(b.dataset.id);
        CF.ui.ok('Conta marcada como paga.');
      }
    });
  }

  function linhaVencimento(t) {
    const cat = CF.catalog.categoria(t.categoria, 'despesa');
    const dias = U.daysUntil(t.data);
    const atrasado = dias < 0;
    return `
      <div class="txn-item">
        <span class="txn-ico" style="background:${U.withAlpha(cat.cor, .14)};color:${cat.cor}">
          <i data-lucide="${cat.icone}" class="icon"></i></span>
        <div class="txn-main" data-act="ver-txn" data-id="${t.id}">
          <div class="txn-title truncate">${U.esc(t.descricao)}</div>
          <div class="txn-meta">
            <span class="uppercase ${atrasado ? 'expense' : dias <= 3 ? 'text-warning' : ''}">${U.fmtDateShort(t.data)}</span>
            <span>•</span><span>${U.relativeDay(t.data)}</span>
          </div>
        </div>
        <div class="txn-value">${U.money(t.valor)}</div>
        <button class="btn btn-sm btn-soft" data-act="pagar" data-id="${t.id}">Pagar</button>
      </div>`;
  }

  return { titulo: 'Dashboard', render };
})();
