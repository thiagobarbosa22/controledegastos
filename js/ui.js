/* ============================================================
   ui.js — blocos visuais reutilizáveis: modal, toast, confirmação,
   dropdown, bottom sheet, skeleton, empty state e fragmentos HTML.
   ============================================================ */

CF.ui = (function () {
  const U = CF.utils;
  const raiz = () => document.getElementById('modal-root');

  /* ============================================================
     Toast
     ============================================================ */
  const ICONES_TOAST = { success: 'circle-check', error: 'circle-x', warning: 'triangle-alert', info: 'info' };

  function toast(msg, tipo = 'success', ms = 3200) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast is-${tipo}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <i data-lucide="${ICONES_TOAST[tipo] || 'info'}" class="icon toast-ico"></i>
      <span class="toast-msg grow">${U.esc(msg)}</span>`;
    root.appendChild(el);
    U.icons(el);
    const fechar = () => {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 200);
    };
    el.addEventListener('click', fechar);
    setTimeout(fechar, ms);
    return fechar;
  }

  const ok = (m) => toast(m, 'success');
  const erro = (m) => toast(m, 'error', 4600);
  const aviso = (m) => toast(m, 'warning', 4000);

  /* ============================================================
     Modal
     ============================================================ */
  let modalAberto = null;

  /**
   * abrirModal({ titulo, subtitulo, corpo, rodape, tamanho, aoAbrir, aoFechar })
   * `corpo` e `rodape` são strings HTML.
   */
  function abrirModal(opts) {
    fecharModal(true);
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal ${opts.tamanho ? 'modal-' + opts.tamanho : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <div class="h3">${U.esc(opts.titulo || '')}</div>
            ${opts.subtitulo ? `<div class="card-sub">${U.esc(opts.subtitulo)}</div>` : ''}
          </div>
          <button class="btn-icon" data-modal-close aria-label="Fechar"><i data-lucide="x" class="icon"></i></button>
        </div>
        <div class="modal-body">${opts.corpo || ''}</div>
        ${opts.rodape === null ? '' : `<div class="modal-foot">${opts.rodape || `
          <button class="btn btn-ghost" data-modal-close>Fechar</button>`}</div>`}
      </div>`;

    raiz().appendChild(backdrop);
    document.body.classList.add('modal-open');
    U.icons(backdrop);

    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) fecharModal(); });
    backdrop.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', () => fecharModal()));

    modalAberto = { el: backdrop, aoFechar: opts.aoFechar };
    setTimeout(() => {
      const foco = backdrop.querySelector('[autofocus], input, select, textarea, button');
      if (foco && window.innerWidth > 760) foco.focus();
    }, 60);
    opts.aoAbrir?.(backdrop.querySelector('.modal'));
    return backdrop.querySelector('.modal');
  }

  function fecharModal(imediato) {
    if (!modalAberto) return;
    const { el, aoFechar } = modalAberto;
    modalAberto = null;
    document.body.classList.remove('modal-open');
    if (imediato) { el.remove(); }
    else {
      el.classList.add('modal-closing');
      setTimeout(() => el.remove(), 160);
    }
    aoFechar?.();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { fecharModal(); fecharDropdown(); fecharSheet(); }
  });

  /* ============================================================
     Confirmação
     ============================================================ */
  function confirmar({ titulo = 'Tem certeza?', texto = '', confirmarTexto = 'Confirmar', perigo = true, icone = 'triangle-alert' }) {
    return new Promise((resolve) => {
      let decidido = false;
      const m = abrirModal({
        titulo,
        tamanho: 'sm',
        corpo: `
          <div class="row gap-4" style="align-items:flex-start">
            <div class="metric-ico ${perigo ? 'is-expense' : ''}" style="${perigo ? 'background:var(--expense-soft);color:var(--expense)' : ''}">
              <i data-lucide="${icone}" class="icon-lg"></i>
            </div>
            <div class="grow"><p class="muted small">${U.esc(texto)}</p></div>
          </div>`,
        rodape: `
          <button class="btn btn-ghost" data-no>Cancelar</button>
          <button class="btn ${perigo ? 'btn-danger' : 'btn-primary'}" data-yes>${U.esc(confirmarTexto)}</button>`,
        aoFechar: () => { if (!decidido) resolve(false); }
      });
      m.querySelector('[data-no]').addEventListener('click', () => { decidido = true; fecharModal(); resolve(false); });
      m.querySelector('[data-yes]').addEventListener('click', () => { decidido = true; fecharModal(); resolve(true); });
    });
  }

  /* ============================================================
     Dropdown / menu contextual
     ============================================================ */
  let dropAberto = null;

  /**
   * dropdown(ancora, itens, opts)
   * itens: [{ label, icone, onClick, perigo, separador, titulo }]
   */
  function dropdown(ancora, itens, opts = {}) {
    fecharDropdown();
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.innerHTML = itens.map(it => {
      if (it.separador) return '<div class="dropdown-sep"></div>';
      if (it.titulo) return `<div class="dropdown-label">${U.esc(it.titulo)}</div>`;
      return `<button class="dropdown-item ${it.perigo ? 'is-danger' : ''}" data-idx="${itens.indexOf(it)}">
        ${it.icone ? `<i data-lucide="${it.icone}" class="icon"></i>` : ''}
        <span class="grow">${U.esc(it.label)}</span>
        ${it.atalho ? `<span class="tiny dim">${U.esc(it.atalho)}</span>` : ''}
      </button>`;
    }).join('');

    document.body.appendChild(menu);
    menu.style.position = 'fixed';
    menu.style.visibility = 'hidden';
    U.icons(menu);

    const r = ancora.getBoundingClientRect();
    const larg = menu.offsetWidth, alt = menu.offsetHeight;
    let left = opts.alinhar === 'esquerda' ? r.left : r.right - larg;
    let top = r.bottom + 8;
    left = U.clamp(left, 8, window.innerWidth - larg - 8);
    if (top + alt > window.innerHeight - 8) top = Math.max(8, r.top - alt - 8);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-idx]');
      if (!btn) return;
      const it = itens[Number(btn.dataset.idx)];
      fecharDropdown();
      it.onClick?.();
    });

    setTimeout(() => document.addEventListener('mousedown', foraDoDrop), 0);
    dropAberto = menu;
    return menu;
  }

  function foraDoDrop(e) { if (dropAberto && !dropAberto.contains(e.target)) fecharDropdown(); }

  function fecharDropdown() {
    if (!dropAberto) return;
    dropAberto.remove();
    dropAberto = null;
    document.removeEventListener('mousedown', foraDoDrop);
  }

  /* ============================================================
     Bottom sheet (mobile)
     ============================================================ */
  let sheetAberto = null;

  function sheet(titulo, itens) {
    fecharSheet();
    const bd = document.createElement('div');
    bd.className = 'sheet-backdrop';
    bd.innerHTML = `
      <div class="sheet">
        <div class="sheet-handle"></div>
        ${titulo ? `<div class="h3 mb-4">${U.esc(titulo)}</div>` : ''}
        <div class="col gap-2">
          ${itens.map((it, i) => `
            <button class="quick-action ${it.classe || ''}" data-idx="${i}"
                    style="flex-direction:row;justify-content:flex-start;gap:14px;padding:14px">
              <span class="qa-ico"><i data-lucide="${it.icone || 'circle'}" class="icon-lg"></i></span>
              <span class="grow" style="text-align:left">
                <span class="bold" style="display:block">${U.esc(it.label)}</span>
                ${it.descricao ? `<span class="tiny dim">${U.esc(it.descricao)}</span>` : ''}
              </span>
              <i data-lucide="chevron-right" class="icon dim"></i>
            </button>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(bd);
    U.icons(bd);
    bd.addEventListener('click', (e) => {
      if (e.target === bd) return fecharSheet();
      const btn = e.target.closest('[data-idx]');
      if (!btn) return;
      const it = itens[Number(btn.dataset.idx)];
      fecharSheet();
      it.onClick?.();
    });
    sheetAberto = bd;
  }

  function fecharSheet() {
    if (!sheetAberto) return;
    sheetAberto.remove();
    sheetAberto = null;
    document.getElementById('fab')?.classList.remove('is-open');
  }

  /* ============================================================
     Fragmentos HTML
     ============================================================ */

  const skeleton = {
    cards: (n = 4) => `<div class="grid grid-4">${'<div class="skeleton sk-card"></div>'.repeat(n)}</div>`,
    chart: () => '<div class="skeleton sk-chart"></div>',
    linhas: (n = 6) => `<div class="card">${'<div class="skeleton sk-line" style="width:100%"></div>'.repeat(n)}</div>`,
    pagina: () => `
      <div class="skeleton sk-title"></div>
      ${skeleton.cards(4)}
      <div class="grid" style="grid-template-columns:2fr 1fr;margin-top:24px">
        ${skeleton.chart()}${skeleton.chart()}
      </div>`
  };

  function empty({ icone = 'inbox', titulo, texto = '', acao, acaoId = 'empty-action' }) {
    return `
      <div class="empty">
        <div class="empty-ico"><i data-lucide="${icone}" class="icon-xl"></i></div>
        <div class="empty-title">${U.esc(titulo)}</div>
        ${texto ? `<p class="empty-text">${U.esc(texto)}</p>` : ''}
        ${acao ? `<button class="btn btn-primary mt-2" data-act="${acaoId}">
          <i data-lucide="plus" class="icon"></i>${U.esc(acao)}</button>` : ''}
      </div>`;
  }

  /** Ícone colorido de categoria. */
  function catIcon(catId, tipo, tamanho = '') {
    const c = CF.catalog.categoria(catId, tipo);
    return `<span class="cat-ico ${tamanho}" style="background:${U.withAlpha(c.cor, .14) || c.cor};color:${c.cor}">
      <i data-lucide="${c.icone}" class="icon"></i></span>`;
  }

  function badgeStatus(status) {
    const s = CF.catalog.STATUS_TXN.find(x => x.id === status) || CF.catalog.STATUS_TXN[0];
    return `<span class="badge ${s.classe} badge-dot">${s.nome}</span>`;
  }

  function progresso(pct, nivel = '', grande = false) {
    return `<div class="progress ${nivel ? 'is-' + nivel : ''} ${grande ? 'progress-lg' : ''}">
      <div class="progress-bar" style="width:${U.clamp(pct, 0, 100)}%"></div></div>`;
  }

  /** Variação percentual com seta e cor. */
  function variacao(atual, anterior, inverter = false) {
    if (!anterior) return '<span class="tiny dim">sem base de comparação</span>';
    const delta = ((atual - anterior) / Math.abs(anterior)) * 100;
    const positivo = inverter ? delta < 0 : delta > 0;
    const cor = Math.abs(delta) < 0.5 ? 'dim' : positivo ? 'income' : 'expense';
    const seta = delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'minus';
    return `<span class="${cor} row gap-1" style="display:inline-flex">
      <i data-lucide="${seta}" class="icon-sm"></i>
      <span class="small bold">${delta > 0 ? '+' : ''}${U.pct(delta, 1)}</span>
    </span>`;
  }

  /** Linha de transação para listas compactas. */
  function txnRow(t, opts = {}) {
    const cat = CF.catalog.categoria(t.categoria, t.tipo);
    const receita = t.tipo === 'receita';
    const status = CF.store.statusReal(t);
    return `
      <div class="txn-item" data-act="ver-txn" data-id="${t.id}">
        <span class="txn-ico" style="background:${U.withAlpha(cat.cor, .14)};color:${cat.cor}">
          <i data-lucide="${cat.icone}" class="icon"></i></span>
        <div class="txn-main">
          <div class="txn-title truncate">${U.esc(t.descricao)}</div>
          <div class="txn-meta">
            <span>${cat.nome}</span>
            <span>•</span>
            <span>${U.fmtDateShort(t.data)}</span>
            ${status !== 'pago' ? `<span class="badge ${status === 'atrasado' ? 'badge-expense' : 'badge-warning'}">${status === 'atrasado' ? 'Atrasado' : 'Pendente'}</span>` : ''}
            ${t.parcelaTotal > 1 ? `<span class="badge">${t.parcelaNum}/${t.parcelaTotal}</span>` : ''}
          </div>
        </div>
        <div class="txn-value ${receita ? 'income' : 'expense'}">
          ${receita ? '+' : '−'} ${U.money(t.valor)}
        </div>
        ${opts.menu === false ? '' : `<button class="btn-icon" data-act="menu-txn" data-id="${t.id}" aria-label="Ações">
          <i data-lucide="ellipsis-vertical" class="icon"></i></button>`}
      </div>`;
  }

  /** Cartão de métrica do dashboard. */
  function metric({ label, valor, icone, variante = '', rodape = '', hero = false, id = '' }) {
    return `
      <div class="card metric ${hero ? 'metric-hero' : ''} ${variante ? 'is-' + variante : ''} card-hover">
        <div class="metric-top">
          <span class="metric-label">${U.esc(label)}</span>
          <span class="metric-ico"><i data-lucide="${icone}" class="icon-lg"></i></span>
        </div>
        <div class="metric-value" ${id ? `data-count="${id}"` : ''}>${valor}</div>
        <div class="metric-foot">${rodape}</div>
      </div>`;
  }

  /* ============================================================
     Delegação de eventos por [data-act]
     ============================================================ */

  /**
   * Registra ações da tela atual. Retorna função de limpeza.
   * mapa: { 'nome-da-acao': (el, ev) => {} }
   */
  function acoes(container, mapa) {
    const handler = (ev) => {
      const alvo = ev.target.closest('[data-act]');
      if (!alvo || !container.contains(alvo)) return;
      const fn = mapa[alvo.dataset.act];
      if (!fn) return;
      ev.preventDefault();
      ev.stopPropagation();
      fn(alvo, ev);
    };
    container.addEventListener('click', handler);
    return () => container.removeEventListener('click', handler);
  }

  /** Estado de carregamento em botões de formulário. */
  function ocupado(btn, ativo, textoOcupado = 'Salvando…') {
    if (!btn) return;
    if (ativo) {
      btn.dataset.textoOriginal = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span>${textoOcupado}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.textoOriginal) btn.innerHTML = btn.dataset.textoOriginal;
      U.icons(btn);
    }
  }

  return {
    toast, ok, erro, aviso,
    abrirModal, fecharModal, confirmar,
    dropdown, fecharDropdown, sheet, fecharSheet,
    skeleton, empty, catIcon, badgeStatus, progresso, variacao, txnRow, metric,
    acoes, ocupado
  };
})();
