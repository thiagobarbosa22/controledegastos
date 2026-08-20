/* ============================================================
   views/metas.js — metas financeiras, reserva e orçamento mensal
   ============================================================ */

CF.views = CF.views || {};

CF.views.metas = (function () {
  const U = CF.utils;
  const S = () => CF.store;
  let aba = 'metas';

  function render(el) {
    const st = S();
    if (st.state.carregando) { el.innerHTML = CF.ui.skeleton.pagina(); U.icons(el); return; }

    const metas = st.metasComProgresso();
    const res = st.reserva();
    const orcamentos = st.orcamentoStatus();
    const totalGuardado = U.sum(metas, m => m.valorAtual);
    const totalMetas = U.sum(metas, m => m.valorMeta);

    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">Metas e orçamento</div>
          <div class="view-sub">Objetivos financeiros, reserva de emergência e limites por categoria</div>
        </div>
        <div class="row gap-2">
          <button class="btn btn-outline" data-act="novo-orcamento"><i data-lucide="wallet-cards" class="icon"></i>Novo orçamento</button>
          <button class="btn btn-primary" data-act="nova-meta"><i data-lucide="plus" class="icon"></i>Nova meta</button>
        </div>
      </div>

      <!-- Reserva de emergência -->
      <div class="card mb-4" style="background:var(--brand-gradient);border:none;color:#fff;box-shadow:var(--sh-brand)">
        <div class="row-between wrap gap-4">
          <div class="row gap-4">
            <span class="metric-ico" style="width:52px;height:52px;background:rgba(255,255,255,.18);color:#fff">
              <i data-lucide="shield-check" class="icon-xl"></i></span>
            <div>
              <div style="opacity:.85;font-size:var(--fs-sm)">Reserva de emergência</div>
              <div class="h1">${U.money(res.atual)}</div>
              <div style="opacity:.85;font-size:var(--fs-sm)">
                Meta: ${U.money(res.objetivo)} · gasto médio mensal ${U.money(res.mediaMensal)}
              </div>
            </div>
          </div>
          <div class="right">
            <div class="h1">${res.meses.toFixed(1).replace('.', ',')}</div>
            <div style="opacity:.85;font-size:var(--fs-sm)">${res.meses === 1 ? 'mês' : 'meses'} de despesas cobertos</div>
          </div>
        </div>
        <div class="mt-4" style="--bg-alt:rgba(255,255,255,.25)">
          <div class="progress progress-lg" style="background:rgba(255,255,255,.25)">
            <div class="progress-bar" style="width:${res.pct}%;background:#fff"></div>
          </div>
          <div class="row-between mt-2" style="opacity:.85;font-size:var(--fs-xs)">
            <span>${U.pct(res.pct, 0)} da meta</span>
            <span>Faltam ${U.money(Math.max(0, res.objetivo - res.atual))}</span>
          </div>
        </div>
        ${res.meta ? `<button class="btn btn-sm mt-4" style="background:rgba(255,255,255,.2);color:#fff"
          data-act="aporte" data-id="${res.meta.id}"><i data-lucide="plus" class="icon-sm"></i>Fazer aporte</button>` : ''}
      </div>

      <div class="tabs mb-4">
        <button class="tab ${aba === 'metas' ? 'is-active' : ''}" data-act="aba" data-val="metas">
          Metas <span class="badge">${metas.length}</span></button>
        <button class="tab ${aba === 'orcamento' ? 'is-active' : ''}" data-act="aba" data-val="orcamento">
          Orçamento mensal <span class="badge">${orcamentos.length}</span></button>
      </div>

      ${aba === 'metas' ? `
        <div class="grid grid-3 mb-4">
          ${CF.ui.metric({ label: 'Total guardado', variante: 'income', icone: 'piggy-bank', valor: `<span class="income">${U.money(totalGuardado)}</span>` })}
          ${CF.ui.metric({ label: 'Soma das metas', icone: 'target', valor: U.money(totalMetas) })}
          ${CF.ui.metric({ label: 'Progresso geral', variante: 'info', icone: 'trending-up',
            valor: U.pct(U.safePct(totalGuardado, totalMetas), 0),
            rodape: CF.ui.progresso(U.safePct(totalGuardado, totalMetas)) })}
        </div>
        ${metas.length ? `<div class="grid grid-auto stagger">${metas.map(cardMeta).join('')}</div>`
          : `<div class="card">${CF.ui.empty({
              icone: 'target', titulo: 'Você ainda não criou nenhuma meta',
              texto: 'Defina objetivos como viagem, reserva de emergência ou uma compra grande e acompanhe o progresso.',
              acao: 'Criar primeira meta', acaoId: 'nova-meta'
            })}</div>`}
      ` : `
        ${orcamentos.length ? `
          <div class="grid grid-2 stagger">${orcamentos.map(cardOrcamento).join('')}</div>`
          : `<div class="card">${CF.ui.empty({
              icone: 'wallet-cards', titulo: 'Nenhum orçamento definido',
              texto: 'Defina um limite de gastos por categoria. O sistema avisa quando você se aproximar do teto.',
              acao: 'Criar primeiro orçamento', acaoId: 'novo-orcamento'
            })}</div>`}
      `}`;

    U.icons(el);

    return CF.ui.acoes(el, {
      aba: (b) => { aba = b.dataset.val; S().emit('change'); },
      'nova-meta': () => CF.forms.meta(),
      'novo-orcamento': () => CF.forms.orcamento(),
      'editar-meta': (b) => CF.forms.meta(st.state.metas.find(m => m.id === b.dataset.id)),
      'editar-orcamento': (b) => CF.forms.orcamento(st.state.orcamentos.find(o => o.id === b.dataset.id)),
      aporte: (b) => CF.forms.aporte(st.state.metas.find(m => m.id === b.dataset.id)),
      'excluir-meta': async (b) => {
        const m = st.state.metas.find(x => x.id === b.dataset.id);
        const sim = await CF.ui.confirmar({ titulo: 'Excluir meta?', texto: `"${m.nome}" será removida.`, confirmarTexto: 'Excluir' });
        if (!sim) return;
        await st.excluir('metas', m.id);
        CF.ui.ok('Meta removida.');
      },
      'excluir-orcamento': async (b) => {
        const o = st.state.orcamentos.find(x => x.id === b.dataset.id);
        const sim = await CF.ui.confirmar({ titulo: 'Excluir orçamento?', texto: `O limite de ${CF.catalog.categoria(o.categoria, 'despesa').nome} será removido.`, confirmarTexto: 'Excluir' });
        if (!sim) return;
        await st.excluir('orcamentos', o.id);
        CF.ui.ok('Orçamento removido.');
      }
    });
  }

  function cardMeta(m) {
    const cor = m.cor || '#6366f1';
    const concluida = m.pct >= 100;
    return `
      <div class="card card-hover">
        <div class="row-between mb-4">
          <span class="row gap-3">
            <span class="cat-ico" style="width:44px;height:44px;background:${U.withAlpha(cor, .14)};color:${cor}">
              <i data-lucide="${m.icone || 'target'}" class="icon-lg"></i></span>
            <span>
              <span class="bold" style="display:block">${U.esc(m.nome)}</span>
              <span class="tiny dim">${m.tipo === 'reserva' ? 'Reserva de emergência' : 'Meta'}${m.prazo ? ` · até ${U.fmtDate(m.prazo)}` : ''}</span>
            </span>
          </span>
          ${concluida ? '<span class="badge badge-income">Concluída</span>' : ''}
        </div>

        <div class="row-between mb-2">
          <span class="h2">${U.money(m.valorAtual)}</span>
          <span class="muted small">de ${U.money(m.valorMeta)}</span>
        </div>
        ${CF.ui.progresso(m.pct, concluida ? 'success' : '', true)}
        <div class="row-between mt-2 tiny">
          <span class="dim">${U.pct(m.pct, 0)} alcançado</span>
          <span class="dim">Faltam ${U.money(m.falta)}</span>
        </div>
        ${m.diasRestantes != null && !concluida ? `
          <div class="tiny dim mt-2">
            ${m.diasRestantes >= 0
              ? `${U.plural(m.diasRestantes, 'dia restante', 'dias restantes')} · guarde ${U.money(m.falta / Math.max(1, Math.ceil(m.diasRestantes / 30)))} por mês`
              : '<span class="expense">Prazo vencido</span>'}
          </div>` : ''}

        <div class="row gap-2 mt-4">
          <button class="btn btn-primary btn-sm grow" data-act="aporte" data-id="${m.id}">
            <i data-lucide="plus" class="icon-sm"></i>Guardar</button>
          <button class="btn btn-outline btn-sm" data-act="editar-meta" data-id="${m.id}" data-tip="Editar">
            <i data-lucide="pencil" class="icon-sm"></i></button>
          <button class="btn btn-ghost btn-sm" data-act="excluir-meta" data-id="${m.id}" data-tip="Excluir">
            <i data-lucide="trash-2" class="icon-sm"></i></button>
        </div>
      </div>`;
  }

  function cardOrcamento(o) {
    return `
      <div class="card card-hover">
        <div class="row-between mb-4">
          <span class="row gap-3">
            ${CF.ui.catIcon(o.categoria, 'despesa')}
            <span>
              <span class="bold" style="display:block">${U.esc(o.nome)}</span>
              <span class="tiny dim">${o.mes ? U.monthLabel(o.mes) : 'Todos os meses'}</span>
            </span>
          </span>
          <span class="badge ${o.nivel === 'danger' ? 'badge-expense' : o.nivel === 'warning' ? 'badge-warning' : 'badge-income'}">
            ${U.pct(o.pct, 0)}</span>
        </div>

        <div class="grid grid-3 mb-4">
          <div><div class="tiny dim">Limite</div><div class="bold num">${U.money(o.limite)}</div></div>
          <div><div class="tiny dim">Utilizado</div><div class="bold num expense">${U.money(o.gasto)}</div></div>
          <div><div class="tiny dim">Restante</div>
            <div class="bold num ${o.restante < 0 ? 'expense' : 'income'}">${U.money(o.restante)}</div></div>
        </div>

        ${CF.ui.progresso(o.pct, o.nivel, true)}

        <div class="row gap-2 mt-4">
          <button class="btn btn-outline btn-sm grow" data-act="editar-orcamento" data-id="${o.id}">
            <i data-lucide="pencil" class="icon-sm"></i>Editar limite</button>
          <button class="btn btn-ghost btn-sm" data-act="excluir-orcamento" data-id="${o.id}" data-tip="Excluir">
            <i data-lucide="trash-2" class="icon-sm"></i></button>
        </div>
      </div>`;
  }

  return { titulo: 'Metas', render };
})();
