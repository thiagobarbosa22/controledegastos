/* ============================================================
   router.js — roteamento por hash (#/rota)
   ============================================================ */

CF.router = (function () {
  const PADRAO = 'dashboard';
  const ROTAS = ['dashboard', 'transacoes', 'despesas', 'receitas', 'calendario',
    'compras', 'assinaturas', 'cartoes', 'contas', 'metas', 'relatorios', 'configuracoes'];

  let atual = null;
  let limpar = null;
  let redesenhando = false;

  const rotaAtual = () => {
    const r = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROTAS.includes(r) ? r : PADRAO;
  };

  function render() {
    const rota = rotaAtual();
    const view = CF.views[rota];
    const el = document.getElementById('view');
    if (!view || !el) return;

    const trocouDeTela = rota !== atual;
    if (trocouDeTela) {
      limpar?.();
      limpar = null;
      CF.charts.destruirTodos();
      CF.ui.fecharDropdown();
      el.scrollIntoView?.({ block: 'start' });
      window.scrollTo({ top: 0 });
    } else {
      limpar?.();
      limpar = null;
      CF.charts.destruirTodos();
    }

    atual = rota;
    limpar = view.render(el) || null;

    document.title = `${view.titulo} · Controle Financeiro`;
    marcarNav(rota);
  }

  function marcarNav(rota) {
    document.querySelectorAll('[data-route]').forEach(a => {
      a.classList.toggle('is-active', a.dataset.route === rota
        || (rota === 'despesas' && a.dataset.route === 'despesas')
        || (rota === 'receitas' && a.dataset.route === 'receitas'));
    });
  }

  /**
   * Redesenho agendado — várias mutações seguidas geram um render só.
   * O rAF agrupa bem quando a aba está visível, mas não dispara em aba
   * oculta; o timeout é a rede de segurança para o render não ficar preso.
   */
  function agendarRender() {
    if (redesenhando) return;
    redesenhando = true;
    const executar = () => {
      if (!redesenhando) return;
      redesenhando = false;
      render();
    };
    requestAnimationFrame(executar);
    setTimeout(executar, 50);
  }

  function iniciar() {
    if (!location.hash) location.hash = `#/${PADRAO}`;
    window.addEventListener('hashchange', render);
    CF.store.on('change', agendarRender);
    render();
  }

  return { iniciar, render: agendarRender, rotaAtual, ir: (r) => { location.hash = `#/${r}`; } };
})();
