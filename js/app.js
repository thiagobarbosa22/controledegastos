/* ============================================================
   app.js — inicialização, chrome da aplicação (topbar, tema,
   período, menus) e ações globais.
   ============================================================ */

CF.app = (function () {
  const U = CF.utils;
  const S = () => CF.store;
  let promptInstalacao = null;

  /* ============================================================
     Tema
     ============================================================ */
  function aplicarTema() {
    const pref = CF.config.get('tema');
    const escuro = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#0a0e19' : '#4f46e5');
    const btn = document.getElementById('theme-btn');
    if (btn) {
      btn.innerHTML = `<i data-lucide="${escuro ? 'sun' : 'moon'}" class="icon-lg"></i>`;
      U.icons(btn);
    }
    CF.router?.render();
  }

  function alternarTema() {
    const atual = document.documentElement.dataset.theme;
    CF.config.set({ tema: atual === 'dark' ? 'light' : 'dark' });
    aplicarTema();
  }

  /* ============================================================
     Período
     ============================================================ */
  function atualizarPeriodo() {
    const label = document.querySelector('#period-label span');
    if (label) label.textContent = S().periodoLabel();
  }

  function menuPeriodo(ancora) {
    const st = S();
    const mkAtual = U.monthOf(U.today());
    const meses = [];
    for (let i = 0; i < 12; i++) meses.push(U.addMonthKey(mkAtual, -i));

    CF.ui.dropdown(ancora, [
      { titulo: 'Visualizar por' },
      { label: 'Mês', icone: 'calendar', onClick: () => st.setPeriodo({ tipo: 'mes', mk: st.periodo.mk }) },
      { label: 'Ano', icone: 'calendar-range', onClick: () => st.setPeriodo({ tipo: 'ano', mk: st.periodo.mk }) },
      { label: 'Período personalizado…', icone: 'calendar-cog', onClick: periodoPersonalizado },
      { separador: true },
      { titulo: 'Ir para' },
      { label: 'Mês atual', icone: 'circle-dot', onClick: () => st.setPeriodo({ tipo: 'mes', mk: mkAtual }) },
      ...meses.slice(1, 7).map(mk => ({
        label: U.monthLabel(mk), icone: 'chevron-right',
        onClick: () => st.setPeriodo({ tipo: 'mes', mk })
      }))
    ], { alinhar: 'esquerda' });
  }

  function periodoPersonalizado() {
    const st = S();
    const modal = CF.ui.abrirModal({
      titulo: 'Período personalizado',
      tamanho: 'sm',
      corpo: `
        <div class="grid grid-2">
          <div class="field"><label class="field-label">De</label>
            <input class="input" type="date" id="p-de" value="${st.periodo.de}"></div>
          <div class="field"><label class="field-label">Até</label>
            <input class="input" type="date" id="p-ate" value="${st.periodo.ate}"></div>
        </div>`,
      rodape: `<button class="btn btn-ghost" data-modal-close>Cancelar</button>
               <button class="btn btn-primary" data-ok>Aplicar</button>`
    });
    modal.querySelector('[data-ok]').addEventListener('click', () => {
      const de = modal.querySelector('#p-de').value;
      const ate = modal.querySelector('#p-ate').value;
      if (!de || !ate || de > ate) return CF.ui.aviso('Informe um intervalo válido.');
      st.setPeriodo({ tipo: 'custom', de, ate });
      CF.ui.fecharModal();
    });
  }

  /* ============================================================
     Menu "Adicionar"
     ============================================================ */
  const OPCOES_ADICIONAR = [
    { label: 'Despesa', descricao: 'Uma saída de dinheiro', icone: 'minus-circle', classe: 'qa-expense', acao: () => CF.forms.transacao('despesa') },
    { label: 'Receita', descricao: 'Uma entrada de dinheiro', icone: 'plus-circle', classe: 'qa-income', acao: () => CF.forms.transacao('receita') },
    { label: 'Assinatura', descricao: 'Serviço recorrente', icone: 'repeat', acao: () => CF.forms.assinatura() },
    { label: 'Compra avulsa', descricao: 'Compra à vista', icone: 'shopping-bag', classe: 'qa-info', acao: () => CF.forms.compra(null, 'avulsa') },
    { label: 'Compra parcelada', descricao: 'Gera as parcelas futuras', icone: 'layers', classe: 'qa-info', acao: () => CF.forms.compra(null, 'parcelada') },
    { label: 'Conta fixa', descricao: 'Aluguel, energia, internet…', icone: 'receipt-text', classe: 'qa-warning', acao: () => CF.forms.contaFixa() },
    { label: 'Cartão de crédito', descricao: 'Novo cartão', icone: 'credit-card', acao: () => CF.forms.cartao() },
    { label: 'Meta', descricao: 'Objetivo financeiro', icone: 'target', acao: () => CF.forms.meta() }
  ];

  function menuAdicionar(ancora) {
    if (window.innerWidth <= 760 || !ancora) {
      document.getElementById('fab')?.classList.add('is-open');
      CF.ui.sheet('O que você quer adicionar?',
        OPCOES_ADICIONAR.map(o => ({ ...o, onClick: o.acao })));
      return;
    }
    CF.ui.dropdown(ancora, [
      { titulo: 'Adicionar' },
      ...OPCOES_ADICIONAR.map(o => ({ label: o.label, icone: o.icone, onClick: o.acao }))
    ]);
  }

  /* ============================================================
     Transações — detalhe e menu de ações
     ============================================================ */
  function detalheTransacao(id) {
    const st = S();
    const t = st.state.transacoes.find(x => x.id === id);
    if (!t) return;
    const cat = CF.catalog.categoria(t.categoria, t.tipo);
    const cartao = t.cartaoId ? st.cartao(t.cartaoId) : null;
    const conta = t.contaId ? st.conta(t.contaId) : null;
    const status = st.statusReal(t);
    const receita = t.tipo === 'receita';

    const linha = (rotulo, valor) => valor ? `
      <div class="row-between" style="padding:9px 0;border-bottom:1px solid var(--border)">
        <span class="muted small">${rotulo}</span><span class="bold small right">${valor}</span></div>` : '';

    const modal = CF.ui.abrirModal({
      titulo: t.descricao,
      subtitulo: t.id,
      corpo: `
        <div class="center col gap-2 mb-4">
          <span class="cat-ico" style="width:56px;height:56px;margin:0 auto;background:${U.withAlpha(cat.cor, .14)};color:${cat.cor}">
            <i data-lucide="${cat.icone}" class="icon-xl"></i></span>
          <div class="h1 ${receita ? 'income' : 'expense'}">${receita ? '+' : '−'} ${U.money(t.valor)}</div>
          <div>${CF.ui.badgeStatus(status)}</div>
        </div>
        <div>
          ${linha('Data', U.fmtDateLong(t.data))}
          ${linha('Categoria', U.esc(cat.nome))}
          ${linha('Subcategoria', U.esc(t.subcategoria || ''))}
          ${linha('Tipo', receita ? 'Receita' : 'Despesa')}
          ${linha('Forma de pagamento', U.esc(CF.catalog.pagamento(t.formaPagamento).nome))}
          ${linha('Cartão', cartao ? `${U.esc(cartao.nome)} •••• ${U.esc(cartao.final || '----')}` : '')}
          ${linha('Conta', conta ? U.esc(conta.nome) : '')}
          ${linha('Parcela', t.parcelaTotal > 1 ? `${t.parcelaNum} de ${t.parcelaTotal}` : '')}
          ${linha('Origem', rotuloOrigem(t))}
          ${linha('Recorrência', t.recorrencia && t.recorrencia !== 'unica' ? U.esc(CF.catalog.recorrencia(t.recorrencia).nome) : '')}
          ${linha('Observação', U.esc(t.observacao || ''))}
        </div>`,
      rodape: `
        <button class="btn btn-ghost" data-excluir><i data-lucide="trash-2" class="icon"></i>Excluir</button>
        <button class="btn btn-outline" data-duplicar><i data-lucide="copy" class="icon"></i>Duplicar</button>
        <button class="btn btn-soft" data-status>${t.status === 'pago' ? 'Marcar pendente' : 'Marcar como pago'}</button>
        <button class="btn btn-primary" data-editar><i data-lucide="pencil" class="icon"></i>Editar</button>`
    });

    modal.querySelector('[data-editar]').addEventListener('click', () => {
      CF.ui.fecharModal();
      CF.forms.transacao(t.tipo, t);
    });
    modal.querySelector('[data-duplicar]').addEventListener('click', async () => {
      await st.duplicarTransacao(t.id);
      CF.ui.fecharModal();
      CF.ui.ok('Lançamento duplicado para hoje.');
    });
    modal.querySelector('[data-status]').addEventListener('click', async () => {
      await st.alternarPagamento(t.id);
      CF.ui.fecharModal();
      CF.ui.ok('Status atualizado.');
    });
    modal.querySelector('[data-excluir]').addEventListener('click', () => {
      CF.ui.fecharModal();
      excluirTransacao(t);
    });
  }

  function menuTransacao(ancora, id) {
    const st = S();
    const t = st.state.transacoes.find(x => x.id === id);
    if (!t) return;
    CF.ui.dropdown(ancora, [
      { label: 'Visualizar', icone: 'eye', onClick: () => detalheTransacao(id) },
      { label: 'Editar', icone: 'pencil', onClick: () => CF.forms.transacao(t.tipo, t) },
      { label: 'Duplicar', icone: 'copy', onClick: async () => { await st.duplicarTransacao(id); CF.ui.ok('Lançamento duplicado.'); } },
      { label: t.status === 'pago' ? 'Marcar como pendente' : 'Marcar como pago', icone: 'circle-check',
        onClick: async () => { await st.alternarPagamento(id); CF.ui.ok('Status atualizado.'); } },
      { separador: true },
      { label: 'Excluir', icone: 'trash-2', perigo: true, onClick: () => excluirTransacao(t) }
    ]);
  }

  async function excluirTransacao(t) {
    const derivada = t.origemTipo && t.origemTipo !== 'manual';
    const sim = await CF.ui.confirmar({
      titulo: 'Tem certeza que deseja excluir?',
      texto: `"${t.descricao}" (${U.money(t.valor)}) será removido do extrato.` +
        (derivada ? ' Este lançamento foi gerado automaticamente e pode ser recriado no próximo carregamento — para removê-lo de vez, exclua ou pause a origem.' : ''),
      confirmarTexto: 'Excluir'
    });
    if (!sim) return;
    await S().excluirTransacao(t.id, true);
    CF.ui.ok('Lançamento removido.');
  }

  function rotuloOrigem(t) {
    const mapa = { assinatura: 'Assinatura', contaFixa: 'Conta fixa', compra: 'Compra', recorrencia: 'Recorrência', manual: 'Lançamento manual' };
    return mapa[t.origemTipo] || 'Lançamento manual';
  }

  /* ============================================================
     Comando rápido — "Uber 32 reais"
     ============================================================ */
  function interpretar(texto) {
    const bruto = String(texto || '').trim();
    if (!bruto) return null;

    const numeros = bruto.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);
    const valor = numeros ? U.parseMoney(numeros[1]) : 0;

    let descricao = bruto
      .replace(/r\$\s*/ig, '')
      .replace(numeros ? numeros[0] : '', ' ')
      .replace(/\b(reais|real|conto|pila|pau|de|no|na|em|com|por)\b/ig, ' ')
      .replace(/\b(hoje|ontem|amanha|amanhã)\b/ig, ' ')
      .replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const n = U.norm(bruto);
    const receita = /\b(recebi|salario|salário|receita|entrada|ganhei|freela|freelance|reembolso|rendimento|dividendo)\b/.test(n);
    const tipo = receita ? 'receita' : 'despesa';

    let data = U.today();
    if (/\bontem\b/.test(n)) data = U.addDays(data, -1);
    else if (/\bamanha\b/.test(n)) data = U.addDays(data, 1);
    const dm = bruto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (dm) {
      const ano = dm[3] ? (dm[3].length === 2 ? '20' + dm[3] : dm[3]) : U.today().slice(0, 4);
      data = `${ano}-${U.pad(dm[2])}-${U.pad(dm[1])}`;
    }

    const pago = !/\b(pendente|a pagar|vou pagar|nao paguei|não paguei)\b/.test(n);

    return {
      tipo,
      descricao: U.titleCase(descricao) || (receita ? 'Receita' : 'Despesa'),
      valor,
      data,
      categoria: CF.catalog.sugerirCategoria(bruto, tipo),
      status: pago ? 'pago' : 'pendente'
    };
  }

  function comandoRapido(texto) {
    const p = interpretar(texto);
    if (!p) return;
    if (!p.valor) return CF.ui.aviso('Não identifiquei o valor. Tente algo como “Uber 32 reais”.');
    // o formulário já serve de confirmação antes de salvar
    CF.forms.transacao(p.tipo, null, p);
    CF.ui.toast(`Interpretei: ${p.descricao} · ${U.money(p.valor)} · ${CF.catalog.categoria(p.categoria, p.tipo).nome}`, 'info', 4200);
  }

  /* ============================================================
     Alertas
     ============================================================ */
  function painelAlertas(ancora) {
    const alertas = S().alertas();
    if (!alertas.length) {
      return CF.ui.dropdown(ancora, [{ titulo: 'Alertas' }, { label: 'Tudo em dia. Nenhum alerta.', icone: 'circle-check' }]);
    }
    CF.ui.dropdown(ancora, [
      { titulo: `Alertas (${alertas.length})` },
      ...alertas.slice(0, 8).map(a => ({
        label: a.texto,
        icone: a.icone,
        perigo: a.nivel === 'danger',
        onClick: () => { location.hash = a.rota; }
      }))
    ]);
  }

  function atualizarBadges() {
    const st = S();
    const dot = document.getElementById('alerts-dot');
    if (dot) dot.style.display = st.alertas().some(a => a.nivel === 'danger' || a.nivel === 'warning') ? 'block' : 'none';

    const contadores = {
      assinaturas: st.state.assinaturas.filter(a => a.status === 'ativa').length,
      contasPendentes: st.state.transacoes.filter(t => t.tipo === 'despesa' && t.status !== 'pago' && t.data <= U.addDays(U.today(), 30)).length
    };
    document.querySelectorAll('[data-count]').forEach(el => {
      const v = contadores[el.dataset.count];
      if (v === undefined) return;
      el.textContent = v || '';
      el.style.display = v ? '' : 'none';
    });
  }

  function atualizarStatus() {
    const modo = CF.api.modo();
    const dot = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    if (!dot || !label) return;
    dot.className = 'status-dot' + (modo === 'local' ? ' is-local' : modo === 'offline' ? ' is-off' : '');
    label.textContent = modo === 'remoto' ? 'Planilha conectada'
      : modo === 'offline' ? 'Offline (cache)' : 'Modo local';
    const wrap = document.getElementById('conn-status');
    if (wrap) wrap.dataset.tip = modo === 'remoto' ? 'Dados sincronizados com o Google Sheets'
      : modo === 'offline' ? 'Sem conexão — mostrando o último cache' : 'Dados salvos apenas neste navegador';
  }

  /* ============================================================
     PWA
     ============================================================ */
  function registrarSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('[pwa] SW não registrado', e));
  }

  function instalarPWA() {
    if (!promptInstalacao) {
      return CF.ui.aviso('Use o menu do navegador › "Instalar aplicativo" / "Adicionar à tela inicial".');
    }
    promptInstalacao.prompt();
    promptInstalacao.userChoice.then(({ outcome }) => {
      if (outcome === 'accepted') CF.ui.ok('Aplicativo instalado.');
      promptInstalacao = null;
    });
  }

  /* ============================================================
     Ligações da interface
     ============================================================ */
  function ligarChrome() {
    const st = S();

    document.getElementById('period-prev').addEventListener('click', () => st.moverPeriodo(-1));
    document.getElementById('period-next').addEventListener('click', () => st.moverPeriodo(1));
    document.getElementById('period-label').addEventListener('click', (e) => menuPeriodo(e.currentTarget));

    document.getElementById('theme-btn').addEventListener('click', alternarTema);
    document.getElementById('alerts-btn').addEventListener('click', (e) => painelAlertas(e.currentTarget));
    document.getElementById('add-btn').addEventListener('click', (e) => menuAdicionar(e.currentTarget));
    document.getElementById('fab').addEventListener('click', () => menuAdicionar(null));

    document.getElementById('refresh-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.style.animation = 'spin .8s linear infinite';
      try { await st.carregar(); CF.ui.ok('Dados atualizados.'); }
      catch (err) { CF.ui.erro('Falha ao atualizar: ' + err.message); }
      finally { btn.style.animation = ''; atualizarStatus(); }
    });

    const quick = document.getElementById('quick-input');
    quick.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      comandoRapido(quick.value);
      quick.value = '';
      quick.blur();
    });

    // menu mobile
    document.getElementById('menu-toggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    document.querySelector('.nav-backdrop').addEventListener('click', () => document.body.classList.remove('nav-open'));
    document.querySelectorAll('[data-route]').forEach(a =>
      a.addEventListener('click', () => document.body.classList.remove('nav-open')));

    // tema do sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (CF.config.get('tema') === 'auto') aplicarTema();
    });

    // atalhos de teclado
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); CF.forms.transacao('despesa'); }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); CF.forms.transacao('receita'); }
      if (e.key === '/' ) { e.preventDefault(); document.getElementById('quick-input')?.focus(); }
      if (e.key === 'ArrowLeft' && e.altKey) st.moverPeriodo(-1);
      if (e.key === 'ArrowRight' && e.altKey) st.moverPeriodo(1);
    });

    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstalacao = e; });

    st.on('periodo', atualizarPeriodo);
    st.on('change', atualizarBadges);
  }

  /* ============================================================
     Boot
     ============================================================ */
  async function iniciar() {
    aplicarTema();
    ligarChrome();
    atualizarPeriodo();
    CF.router.iniciar();
    registrarSW();

    try {
      await S().carregar();
      atualizarStatus();
      atualizarBadges();
    } catch (e) {
      console.error(e);
      atualizarStatus();
      CF.ui.erro('Não foi possível carregar os dados: ' + e.message);
      S().state.carregando = false;
      S().emit('change');
    }
  }

  return {
    iniciar, aplicarTema, alternarTema, atualizarStatus, atualizarBadges,
    menuAdicionar, detalheTransacao, menuTransacao, comandoRapido, interpretar,
    instalarPWA, periodoPersonalizado
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  // dá tempo para os scripts com `defer` das CDNs registrarem Chart/lucide
  CF.utils.icons();
  CF.app.iniciar();
});
