/* ============================================================
   views/cartoes.js — cartões de crédito e faturas
   ============================================================ */

CF.views = CF.views || {};

CF.views.cartoes = (function () {
  const U = CF.utils;
  const S = () => CF.store;

  let selecionado = null;
  let faturaMk = null;

  function render(el) {
    const st = S();
    if (st.state.carregando) { el.innerHTML = CF.ui.skeleton.pagina(); U.icons(el); return; }

    const cartoes = st.state.cartoes;
    if (!cartoes.length) {
      el.innerHTML = `
        <div class="view-head"><div><div class="view-title">Cartões</div>
          <div class="view-sub">Controle limites e faturas</div></div></div>
        <div class="card">${CF.ui.empty({
          icone: 'credit-card', titulo: 'Você ainda não cadastrou nenhum cartão',
          texto: 'Cadastre seus cartões para acompanhar faturas, limite disponível e parcelamentos. Guardamos apenas o apelido e os 4 últimos dígitos.',
          acao: 'Adicionar primeiro cartão', acaoId: 'novo'
        })}</div>`;
      U.icons(el);
      return CF.ui.acoes(el, { novo: () => CF.forms.cartao() });
    }

    if (!selecionado || !cartoes.some(c => c.id === selecionado)) selecionado = cartoes[0].id;
    const cartaoAtual = st.cartao(selecionado);
    const disponiveis = st.faturasDisponiveis(selecionado);
    if (!faturaMk || !disponiveis.includes(faturaMk)) faturaMk = CF.engine.faturaDe(U.today(), cartaoAtual);
    const f = st.fatura(selecionado, faturaMk);
    const uso = st.usoCartao(selecionado);

    const limiteTotal = U.sum(cartoes.filter(c => c.ativo !== false), c => c.limite);
    const usadoTotal = U.sum(cartoes.filter(c => c.ativo !== false), c => st.usoCartao(c.id).utilizado);

    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">Cartões</div>
          <div class="view-sub">${U.plural(cartoes.length, 'cartão cadastrado', 'cartões cadastrados')}</div>
        </div>
        <button class="btn btn-primary" data-act="novo"><i data-lucide="plus" class="icon"></i>Novo cartão</button>
      </div>

      <div class="grid grid-3 mb-4 stagger">
        ${CF.ui.metric({ label: 'Limite total', icone: 'gauge', valor: U.money(limiteTotal),
          rodape: `<span class="dim">${U.plural(cartoes.filter(c => c.ativo !== false).length, 'cartão ativo', 'cartões ativos')}</span>` })}
        ${CF.ui.metric({ label: 'Limite utilizado', variante: 'expense', icone: 'trending-up',
          valor: `<span class="expense">${U.money(usadoTotal)}</span>`,
          rodape: `<span class="badge ${usadoTotal / (limiteTotal || 1) >= .8 ? 'badge-expense' : 'badge-warning'}">${U.pct(U.safePct(usadoTotal, limiteTotal), 0)} do limite</span>` })}
        ${CF.ui.metric({ label: 'Limite disponível', variante: 'income', icone: 'wallet',
          valor: `<span class="income">${U.money(Math.max(0, limiteTotal - usadoTotal))}</span>`,
          rodape: `<span class="dim">somando todos os cartões</span>` })}
      </div>

      <div class="section">
        <div class="section-head"><div class="section-title">Seus cartões</div></div>
        <div class="grid grid-auto stagger">${cartoes.map(cardVisual).join('')}</div>
      </div>

      <div class="section card">
        <div class="card-header wrap">
          <div>
            <div class="card-title">Fatura — ${U.esc(cartaoAtual.nome)}</div>
            <div class="card-sub">
              Fecha em ${U.fmtDate(f.fechamento)} · vence em ${U.fmtDate(f.vencimento)}
              ${f.fechada ? '<span class="badge badge-warning">Fechada</span>' : '<span class="badge badge-info">Aberta</span>'}
              ${f.paga && f.fechada && f.itens.length ? '<span class="badge badge-income">Paga</span>' : ''}
            </div>
          </div>
          <div class="row gap-2 wrap">
            <select class="select" id="sel-cartao" style="width:auto">
              ${cartoes.map(c => `<option value="${c.id}" ${c.id === selecionado ? 'selected' : ''}>${U.esc(c.nome)}</option>`).join('')}
            </select>
            <select class="select" id="sel-fatura" style="width:auto">
              ${disponiveis.map(mk => `<option value="${mk}" ${mk === faturaMk ? 'selected' : ''}>${U.monthLabel(mk)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="grid grid-4 mb-4">
          <div><div class="tiny dim">Total da fatura</div><div class="h2 expense num">${U.money(f.total)}</div></div>
          <div><div class="tiny dim">Lançamentos</div><div class="h2 num">${f.itens.length}</div></div>
          <div><div class="tiny dim">Fechamento</div><div class="h3">${U.fmtDateShort(f.fechamento)}</div></div>
          <div><div class="tiny dim">Vencimento</div><div class="h3">${U.fmtDateShort(f.vencimento)}</div></div>
        </div>

        ${f.itens.length ? `
          <div class="row gap-2 mb-4 wrap">
            <button class="btn btn-soft btn-sm" data-act="pagar-fatura"><i data-lucide="check-check" class="icon-sm"></i>Marcar fatura como paga</button>
            <span class="badge">Assinaturas: ${U.money(U.sum(f.itens.filter(t => t.origemTipo === 'assinatura'), t => t.valor))}</span>
            <span class="badge">Parcelamentos: ${U.money(U.sum(f.itens.filter(t => t.parcelaTotal > 1), t => t.valor))}</span>
            <span class="badge">Avulsos: ${U.money(U.sum(f.itens.filter(t => t.origemTipo === 'manual' && !(t.parcelaTotal > 1)), t => t.valor))}</span>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Origem</th><th class="col-value">Valor</th><th>Status</th></tr></thead>
              <tbody>
                ${f.itens.map(t => `
                  <tr data-act="ver-txn" data-id="${t.id}" style="cursor:pointer">
                    <td class="num small">${U.fmtDate(t.data)}</td>
                    <td class="bold">${U.esc(t.descricao)}</td>
                    <td><span class="row gap-2">${CF.ui.catIcon(t.categoria, 'despesa')}
                      <span class="small">${U.esc(CF.catalog.categoria(t.categoria, 'despesa').nome)}</span></span></td>
                    <td class="small muted">${rotuloOrigem(t)}</td>
                    <td class="col-value expense">${U.money(t.valor)}</td>
                    <td>${CF.ui.badgeStatus(S().statusReal(t))}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`
        : CF.ui.empty({ icone: 'receipt', titulo: 'Fatura sem lançamentos', texto: 'Nenhuma compra caiu nesta fatura ainda.' })}
      </div>`;

    U.icons(el);

    el.querySelector('#sel-cartao')?.addEventListener('change', (e) => {
      selecionado = e.target.value; faturaMk = null; S().emit('change');
    });
    el.querySelector('#sel-fatura')?.addEventListener('change', (e) => {
      faturaMk = e.target.value; S().emit('change');
    });

    return CF.ui.acoes(el, {
      novo: () => CF.forms.cartao(),
      selecionar: (b) => { selecionado = b.dataset.id; faturaMk = null; S().emit('change'); },
      editar: (b) => CF.forms.cartao(st.cartao(b.dataset.id)),
      'ver-txn': (b) => CF.app.detalheTransacao(b.dataset.id),
      'pagar-fatura': async () => {
        const pendentes = f.itens.filter(t => t.status !== 'pago');
        if (!pendentes.length) return CF.ui.aviso('Todos os lançamentos desta fatura já estão pagos.');
        const sim = await CF.ui.confirmar({
          titulo: 'Marcar fatura como paga?',
          texto: `${U.plural(pendentes.length, 'lançamento será marcado', 'lançamentos serão marcados')} como pagos, totalizando ${U.money(U.sum(pendentes, t => t.valor))}.`,
          confirmarTexto: 'Marcar como paga', perigo: false, icone: 'check-check'
        });
        if (!sim) return;
        for (const t of pendentes) await st.atualizar('transacoes', t.id, { status: 'pago' });
        CF.ui.ok('Fatura quitada.');
      },
      menu: (b) => {
        const c = st.cartao(b.dataset.id);
        CF.ui.dropdown(b, [
          { label: 'Ver fatura', icone: 'receipt', onClick: () => { selecionado = c.id; faturaMk = null; S().emit('change'); } },
          { label: 'Editar', icone: 'pencil', onClick: () => CF.forms.cartao(c) },
          { separador: true },
          { label: 'Excluir', icone: 'trash-2', perigo: true, onClick: async () => {
            const sim = await CF.ui.confirmar({
              titulo: 'Excluir cartão?',
              texto: `"${c.nome}" será removido. Os lançamentos ficam no extrato, mas sem cartão vinculado.`,
              confirmarTexto: 'Excluir'
            });
            if (sim) { await S().excluirCartao(c.id); selecionado = null; CF.ui.ok('Cartão removido.'); }
          } }
        ]);
      }
    });
  }

  function cardVisual(c) {
    const uso = S().usoCartao(c.id);
    const tema = CF.catalog.cardTheme(c.cor);
    return `
      <div>
        <div class="creditcard" style="background:${tema.css}" data-act="selecionar" data-id="${c.id}">
          <div class="cc-row">
            <div>
              <div class="cc-brand">${U.esc(c.nome)}</div>
              <div class="cc-bank">${U.esc(c.banco || '')}</div>
            </div>
            <div class="cc-chip"></div>
          </div>
          <div class="cc-digits">•••• ${U.esc(c.final || '••••')}</div>
          <div>
            <div class="cc-row" style="margin-bottom:6px">
              <div><div class="cc-label">Utilizado</div><div class="cc-value">${U.money(uso.utilizado)}</div></div>
              <div class="right"><div class="cc-label">Disponível</div><div class="cc-value">${U.money(uso.disponivel)}</div></div>
            </div>
            ${CF.ui.progresso(uso.pct)}
          </div>
        </div>
        <div class="row-between mt-2" style="padding:0 4px">
          <span class="tiny dim" style="white-space:nowrap">Fecha ${c.diaFechamento} · vence ${c.diaVencimento}</span>
          <span class="row gap-1">
            ${c.id === selecionado ? '<span class="badge badge-brand">Selecionado</span>' : ''}
            <button class="btn-icon" data-act="menu" data-id="${c.id}" aria-label="Ações">
              <i data-lucide="ellipsis-vertical" class="icon"></i></button>
          </span>
        </div>
      </div>`;
  }

  function rotuloOrigem(t) {
    if (t.parcelaTotal > 1) return `Parcela ${t.parcelaNum}/${t.parcelaTotal}`;
    if (t.origemTipo === 'assinatura') return 'Assinatura';
    if (t.origemTipo === 'contaFixa') return 'Conta fixa';
    if (t.origemTipo === 'recorrencia') return 'Recorrente';
    if (t.origemTipo === 'compra') return 'Compra';
    return 'Avulso';
  }

  return { titulo: 'Cartões', render };
})();
