/* ============================================================
   store.js — estado da aplicação, seletores e mutações.

   Regra: as telas NUNCA chamam CF.api direto. Elas leem seletores
   e disparam mutações daqui; o store persiste, atualiza o estado
   em memória e emite "change" para quem estiver na tela.
   ============================================================ */

CF.store = (function () {
  const U = CF.utils;

  const state = Object.assign(CF.api.vazio(), { carregando: true });

  /* ---------------- Período selecionado ---------------- */
  const periodo = {
    tipo: 'mes',                     // mes | ano | custom
    mk: U.monthOf(U.today()),
    de: U.monthStart(U.monthOf(U.today())),
    ate: U.monthEnd(U.monthOf(U.today()))
  };

  function setPeriodo(patch) {
    Object.assign(periodo, patch);
    if (periodo.tipo === 'mes') {
      periodo.de = U.monthStart(periodo.mk);
      periodo.ate = U.monthEnd(periodo.mk);
    } else if (periodo.tipo === 'ano') {
      const ano = periodo.mk.slice(0, 4);
      periodo.de = `${ano}-01-01`;
      periodo.ate = `${ano}-12-31`;
    }
    emit('periodo');
    emit('change');
  }

  function moverPeriodo(delta) {
    if (periodo.tipo === 'ano') {
      const ano = Number(periodo.mk.slice(0, 4)) + delta;
      setPeriodo({ mk: `${ano}-${periodo.mk.slice(5)}` });
    } else if (periodo.tipo === 'custom') {
      const dias = U.daysBetween(periodo.de, periodo.ate) + 1;
      setPeriodo({ de: U.addDays(periodo.de, dias * delta), ate: U.addDays(periodo.ate, dias * delta) });
    } else {
      setPeriodo({ mk: U.addMonthKey(periodo.mk, delta) });
    }
  }

  function periodoLabel() {
    if (periodo.tipo === 'ano') return `Ano de ${periodo.mk.slice(0, 4)}`;
    if (periodo.tipo === 'custom') return `${U.fmtDateShort(periodo.de)} – ${U.fmtDateShort(periodo.ate)}`;
    return U.monthLabel(periodo.mk);
  }

  /* ---------------- Eventos ---------------- */
  const ouvintes = new Map();

  function on(evt, fn) {
    if (!ouvintes.has(evt)) ouvintes.set(evt, new Set());
    ouvintes.get(evt).add(fn);
    return () => ouvintes.get(evt).delete(fn);
  }

  function emit(evt, dados) {
    (ouvintes.get(evt) || []).forEach(fn => {
      try { fn(dados); } catch (e) { console.error('[store] ouvinte falhou', evt, e); }
    });
  }

  /* ============================================================
     Carga inicial
     ============================================================ */

  async function carregar() {
    state.carregando = true;
    emit('change');
    const db = await CF.api.bootstrap();
    Object.assign(state, db, { carregando: false });
    normalizar();
    emit('carregado');
    emit('change');
    // materializa assinaturas/contas fixas/recorrências pendentes
    materializar().catch(e => console.warn('[store] materialização falhou', e));
    return state;
  }

  /** Garante tipos corretos vindos da planilha (tudo chega como texto). */
  function normalizar() {
    const num = (v) => (typeof v === 'number' ? v : U.parseMoney(v));
    const bool = (v) => v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1' || v === 'sim';

    state.transacoes.forEach(t => {
      t.valor = num(t.valor);
      t.data = String(t.data || '').slice(0, 10);
      t.tipo = t.tipo || 'despesa';
      t.status = t.status || 'pago';
      t.parcelaNum = t.parcelaNum ? Number(t.parcelaNum) : null;
      t.parcelaTotal = t.parcelaTotal ? Number(t.parcelaTotal) : null;
    });
    state.assinaturas.forEach(a => { a.valor = num(a.valor); });
    state.contasFixas.forEach(c => { c.valor = num(c.valor); c.diaVencimento = Number(c.diaVencimento) || 10; });
    state.cartoes.forEach(c => {
      c.limite = num(c.limite);
      c.diaFechamento = Number(c.diaFechamento) || 1;
      c.diaVencimento = Number(c.diaVencimento) || 10;
      c.ativo = c.ativo === undefined ? true : bool(c.ativo);
    });
    state.contas.forEach(c => { c.saldoInicial = num(c.saldoInicial); c.ativo = c.ativo === undefined ? true : bool(c.ativo); });
    state.compras.forEach(c => {
      c.valorTotal = num(c.valorTotal); c.valorParcela = num(c.valorParcela);
      c.parcelas = Number(c.parcelas) || 1;
    });
    state.metas.forEach(m => { m.valorMeta = num(m.valorMeta); m.valorAtual = num(m.valorAtual); });
    state.orcamentos.forEach(o => { o.limite = num(o.limite); });
  }

  /** Gera as transações derivadas que ainda não existem. */
  async function materializar() {
    const novas = CF.engine.planejar(state);
    if (!novas.length) return 0;
    const criadas = await CF.api.createMany('transacoes', novas);
    state.transacoes.push(...criadas);
    normalizar();
    emit('change');
    return criadas.length;
  }

  /* ============================================================
     Seletores
     ============================================================ */

  const noPeriodo = (t, de = periodo.de, ate = periodo.ate) => t.data >= de && t.data <= ate;

  /** Filtra transações. Todos os campos do filtro são opcionais. */
  function transacoes(f = {}) {
    const de = f.de ?? periodo.de;
    const ate = f.ate ?? periodo.ate;
    const busca = f.busca ? U.norm(f.busca) : '';

    let lista = state.transacoes.filter(t => noPeriodo(t, de, ate));

    if (f.tipo) lista = lista.filter(t => t.tipo === f.tipo);
    if (f.categoria) lista = lista.filter(t => t.categoria === f.categoria);
    if (f.status) lista = lista.filter(t => statusReal(t) === f.status);
    if (f.cartaoId) lista = lista.filter(t => t.cartaoId === f.cartaoId);
    if (f.contaId) lista = lista.filter(t => t.contaId === f.contaId);
    if (f.formaPagamento) lista = lista.filter(t => t.formaPagamento === f.formaPagamento);
    if (f.origemTipo) lista = lista.filter(t => t.origemTipo === f.origemTipo);
    if (f.min != null) lista = lista.filter(t => t.valor >= f.min);
    if (f.max != null) lista = lista.filter(t => t.valor <= f.max);
    if (busca) {
      lista = lista.filter(t =>
        U.norm(t.descricao).includes(busca) ||
        U.norm(CF.catalog.categoria(t.categoria, t.tipo).nome).includes(busca) ||
        U.norm(t.observacao).includes(busca));
    }
    return U.sortBy(lista, t => t.data + (t.criadoEm || ''), -1);
  }

  /**
   * Pendente com data passada vira "atrasado". No crédito o prazo é o
   * vencimento da fatura, não a data da compra: comprar dia 10 não está
   * atrasado no dia 20 se a fatura só vence no mês que vem.
   */
  function statusReal(t) {
    if (t.status === 'pago') return 'pago';
    return dataDeCaixa(t) < U.today() ? 'atrasado' : 'pendente';
  }

  /** Resumo financeiro de um intervalo. */
  function resumo(de = periodo.de, ate = periodo.ate) {
    const lista = state.transacoes.filter(t => noPeriodo(t, de, ate));
    const rec = lista.filter(t => t.tipo === 'receita');
    const des = lista.filter(t => t.tipo === 'despesa');

    const receitas = U.sum(rec, t => t.valor);
    const despesas = U.sum(des, t => t.valor);
    const receitasPagas = U.sum(rec.filter(t => t.status === 'pago'), t => t.valor);
    const despesasPagas = U.sum(des.filter(t => t.status === 'pago'), t => t.valor);
    const pendentes = des.filter(t => t.status !== 'pago');
    const comprometido = U.sum(pendentes, t => t.valor);
    const economia = receitas - despesas;

    return {
      receitas, despesas, receitasPagas, despesasPagas,
      comprometido,
      atrasado: U.sum(pendentes.filter(t => statusReal(t) === 'atrasado'), t => t.valor),
      economia,
      taxaEconomia: receitas ? (economia / receitas) * 100 : 0,
      qtdTransacoes: lista.length,
      qtdPendentes: pendentes.length,
      saldoCaixa: receitasPagas - despesasPagas
    };
  }

  /** O lançamento vai para a fatura de um cartão de crédito? */
  const noCartao = (t) => Boolean(t.cartaoId) || t.formaPagamento === 'credito';

  /**
   * Data em que o dinheiro de um lançamento de cartão realmente sai da conta:
   * o vencimento da fatura que o engloba. Sem cartão cadastrado, cai na
   * própria data do lançamento.
   */
  function dataDeCaixa(t) {
    if (!noCartao(t)) return t.data;
    const c = cartao(t.cartaoId);
    if (!c) return t.data;
    return CF.engine.datasFatura(CF.engine.faturaDe(t.data, c), c).vencimento;
  }

  const liquido = (arr) =>
    U.sum(arr.filter(t => t.tipo === 'receita'), t => t.valor)
    - U.sum(arr.filter(t => t.tipo === 'despesa'), t => t.valor);

  /**
   * Saldo consolidado até uma data (padrão: hoje).
   * Compra no crédito não tira dinheiro da conta na hora: ela compõe a fatura
   * e só reduz o saldo quando essa fatura é paga, no vencimento dela.
   */
  function saldoAte(data = U.today()) {
    const inicial = U.sum(state.contas.filter(c => c.ativo !== false), c => c.saldoInicial);
    const pagas = state.transacoes.filter(t => t.status === 'pago');
    return inicial + liquido(pagas.filter(t => dataDeCaixa(t) <= data));
  }

  const saldoAtual = () => saldoAte(U.today());

  /** Saldo por conta bancária/carteira. */
  function saldoContas() {
    return state.contas.map(c => {
      // o que foi no crédito pertence à fatura do cartão, não a esta conta
      const mov = state.transacoes.filter(t => t.contaId === c.id && t.status === 'pago' && !noCartao(t));
      const saldo = c.saldoInicial + liquido(mov);
      return Object.assign({}, c, { saldo, movimentos: mov.length });
    });
  }

  /** Agrupamento por categoria no intervalo. */
  function porCategoria(tipo = 'despesa', de = periodo.de, ate = periodo.ate) {
    const lista = state.transacoes.filter(t => t.tipo === tipo && noPeriodo(t, de, ate));
    const total = U.sum(lista, t => t.valor);
    const grupos = U.groupBy(lista, t => t.categoria || 'outros');
    const out = [];
    grupos.forEach((itens, catId) => {
      const cat = CF.catalog.categoria(catId, tipo);
      const valor = U.sum(itens, t => t.valor);
      out.push({ id: catId, nome: cat.nome, cor: cat.cor, icone: cat.icone, valor, qtd: itens.length, pct: total ? (valor / total) * 100 : 0 });
    });
    return U.sortBy(out, x => x.valor, -1);
  }

  /** Série dos últimos N meses: receitas, despesas, economia, saldo. */
  function serieMensal(n = 6, ateMk = periodo.tipo === 'mes' ? periodo.mk : U.monthOf(U.today())) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const mk = U.addMonthKey(ateMk, -i);
      const r = resumo(U.monthStart(mk), U.monthEnd(mk));
      out.push({
        mk, label: U.monthLabelShort(mk),
        receitas: r.receitas, despesas: r.despesas, economia: r.economia,
        saldo: saldoAte(U.monthEnd(mk))
      });
    }
    return out;
  }

  /**
   * Ranking dos maiores gastos do período.
   * porItem = true agrupa por descrição (somando as repetições do mesmo
   * gasto, como aluguel de vários meses); false agrupa por categoria.
   */
  function maioresGastos(limite = 5, porItem = false, de = periodo.de, ate = periodo.ate) {
    if (!porItem) return porCategoria('despesa', de, ate).slice(0, limite);

    const lista = state.transacoes.filter(t => t.tipo === 'despesa' && noPeriodo(t, de, ate));
    // "Notebook (3/12)" e "Notebook (4/12)" contam como o mesmo gasto
    const rotulo = (t) => t.descricao.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
    const grupos = U.groupBy(lista, rotulo);
    const out = [];
    grupos.forEach((itens, nome) => {
      out.push({
        nome, descricao: nome,
        valor: U.sum(itens, t => t.valor),
        qtd: itens.length,
        categoria: itens[0].categoria,
        cor: CF.catalog.categoria(itens[0].categoria, 'despesa').cor
      });
    });
    return U.sortBy(out, x => x.valor, -1).slice(0, limite);
  }

  /** Próximos vencimentos (transações pendentes) dentro de N dias. */
  function proximosVencimentos(dias = 30, limite = 8) {
    const hoje = U.today();
    const ate = U.addDays(hoje, dias);
    return U.sortBy(
      state.transacoes.filter(t => t.status !== 'pago' && t.tipo === 'despesa' && t.data <= ate),
      t => t.data, 1
    ).slice(0, limite);
  }

  /* ---------------- Cartões ---------------- */

  const cartao = (id) => state.cartoes.find(c => c.id === id);
  const conta = (id) => state.contas.find(c => c.id === id);

  /** Itens e totais de uma fatura específica. */
  function fatura(cartaoId, mk) {
    const c = cartao(cartaoId);
    if (!c) return null;
    const itens = state.transacoes.filter(t =>
      t.cartaoId === cartaoId && t.tipo === 'despesa' && CF.engine.faturaDe(t.data, c) === mk);
    const datas = CF.engine.datasFatura(mk, c);
    return {
      cartao: c, mk, itens: U.sortBy(itens, t => t.data, -1),
      total: U.sum(itens, t => t.valor),
      fechamento: datas.fechamento,
      vencimento: datas.vencimento,
      fechada: datas.fechamento < U.today(),
      paga: itens.length > 0 && itens.every(t => t.status === 'pago')
    };
  }

  /** Meses de fatura existentes para um cartão (mais recentes primeiro). */
  function faturasDisponiveis(cartaoId) {
    const c = cartao(cartaoId);
    if (!c) return [];
    const set = new Set(state.transacoes
      .filter(t => t.cartaoId === cartaoId && t.tipo === 'despesa')
      .map(t => CF.engine.faturaDe(t.data, c)));
    set.add(CF.engine.faturaDe(U.today(), c));
    return U.sortBy([...set], x => x, -1);
  }

  /** Uso do limite: fatura aberta + parcelas futuras ainda não faturadas. */
  function usoCartao(cartaoId) {
    const c = cartao(cartaoId);
    if (!c) return { utilizado: 0, disponivel: 0, pct: 0 };
    const mkAtual = CF.engine.faturaDe(U.today(), c);
    const naoPagas = state.transacoes.filter(t =>
      t.cartaoId === cartaoId && t.tipo === 'despesa' && t.status !== 'pago' &&
      CF.engine.faturaDe(t.data, c) >= mkAtual);
    const abertaPagas = state.transacoes.filter(t =>
      t.cartaoId === cartaoId && t.tipo === 'despesa' && t.status === 'pago' &&
      CF.engine.faturaDe(t.data, c) === mkAtual);
    const utilizado = U.sum(naoPagas, t => t.valor) + U.sum(abertaPagas, t => t.valor);
    return {
      utilizado,
      disponivel: Math.max(0, c.limite - utilizado),
      pct: U.safePct(utilizado, c.limite),
      faturaAtual: fatura(cartaoId, mkAtual)
    };
  }

  /* ---------------- Compras ---------------- */

  /** Compras com progresso de parcelas calculado a partir do ledger. */
  function comprasComProgresso() {
    return state.compras.map(c => {
      const parcelas = U.sortBy(state.transacoes.filter(t => t.compraId === c.id || (t.origemTipo === 'compra' && t.origemId === c.id)), t => t.data, 1);
      const pagas = parcelas.filter(t => t.status === 'pago');
      const pago = U.sum(pagas, t => t.valor);
      const proxima = parcelas.find(t => t.status !== 'pago');
      return Object.assign({}, c, {
        parcelasGeradas: parcelas.length,
        parcelasPagas: pagas.length,
        pago,
        restante: Math.max(0, c.valorTotal - pago),
        proxima,
        conclusao: parcelas.length ? parcelas[parcelas.length - 1].data : c.dataCompra,
        pct: U.safePct(pago, c.valorTotal),
        quitada: parcelas.length > 0 && pagas.length === parcelas.length
      });
    });
  }

  /* ---------------- Assinaturas ---------------- */

  function assinaturasResumo() {
    const ativas = state.assinaturas.filter(a => a.status === 'ativa');
    const mensal = U.sum(ativas, a => {
      const r = CF.catalog.recorrencia(a.periodicidade || 'mensal');
      const meses = r.meses || (r.dias ? r.dias / 30 : 1);
      return a.valor / (meses || 1);
    });
    return {
      qtd: ativas.length,
      qtdTotal: state.assinaturas.length,
      mensal,
      anual: mensal * 12,
      proximas: U.sortBy(ativas, a => a.proximaCobranca || '9999', 1).slice(0, 5)
    };
  }

  /* ---------------- Orçamentos ---------------- */

  function orcamentoStatus(mk = periodo.tipo === 'mes' ? periodo.mk : U.monthOf(U.today())) {
    const de = U.monthStart(mk), ate = U.monthEnd(mk);
    const relevantes = state.orcamentos.filter(o => !o.mes || o.mes === mk);
    return relevantes.map(o => {
      const gasto = U.sum(state.transacoes.filter(t =>
        t.tipo === 'despesa' && t.categoria === o.categoria && noPeriodo(t, de, ate)), t => t.valor);
      const cat = CF.catalog.categoria(o.categoria, 'despesa');
      const pct = o.limite ? (gasto / o.limite) * 100 : 0;
      return {
        ...o, nome: cat.nome, cor: cat.cor, icone: cat.icone,
        gasto, restante: o.limite - gasto, pct,
        nivel: pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success'
      };
    });
  }

  /* ---------------- Metas e reserva ---------------- */

  function metasComProgresso() {
    return state.metas.map(m => ({
      ...m,
      pct: U.safePct(m.valorAtual, m.valorMeta),
      falta: Math.max(0, m.valorMeta - m.valorAtual),
      diasRestantes: m.prazo ? U.daysUntil(m.prazo) : null
    }));
  }

  function reserva() {
    const alvo = state.metas.find(m => m.tipo === 'reserva');
    const mediaMensal = mediaDespesaMensal(3);
    const atual = alvo?.valorAtual || 0;
    return {
      meta: alvo,
      atual,
      objetivo: alvo?.valorMeta || CF.config.get('reservaMeta'),
      mediaMensal,
      meses: mediaMensal ? atual / mediaMensal : 0,
      pct: U.safePct(atual, alvo?.valorMeta || CF.config.get('reservaMeta'))
    };
  }

  function mediaDespesaMensal(n = 3) {
    const mkAtual = U.monthOf(U.today());
    let total = 0, meses = 0;
    for (let i = 1; i <= n; i++) {
      const mk = U.addMonthKey(mkAtual, -i);
      total += resumo(U.monthStart(mk), U.monthEnd(mk)).despesas;
      meses++;
    }
    return meses ? total / meses : 0;
  }

  /* ---------------- Alertas ---------------- */

  function alertas() {
    const out = [];
    const hoje = U.today();
    const janela = Number(CF.config.get('alertaDiasVencimento')) || 5;

    // contas vencendo / atrasadas
    const pendentes = state.transacoes.filter(t => t.tipo === 'despesa' && t.status !== 'pago');
    const atrasadas = pendentes.filter(t => t.data < hoje);
    if (atrasadas.length) {
      out.push({
        nivel: 'danger', icone: 'alert-triangle',
        texto: `Você tem ${U.plural(atrasadas.length, 'conta atrasada', 'contas atrasadas')} somando ${U.money(U.sum(atrasadas, t => t.valor))}.`,
        rota: '#/contas'
      });
    }
    const proximas = pendentes.filter(t => t.data >= hoje && U.daysUntil(t.data) <= janela);
    if (proximas.length) {
      out.push({
        nivel: 'warning', icone: 'calendar-clock',
        texto: `${U.plural(proximas.length, 'conta vence', 'contas vencem')} nos próximos ${janela} dias (${U.money(U.sum(proximas, t => t.valor))}).`,
        rota: '#/calendario'
      });
    }

    // faturas de cartão
    state.cartoes.filter(c => c.ativo !== false).forEach(c => {
      const uso = usoCartao(c.id);
      const f = uso.faturaAtual;
      if (f && f.total > 0) {
        const dias = U.daysUntil(f.vencimento);
        if (dias >= 0 && dias <= janela) {
          out.push({
            nivel: dias <= 2 ? 'danger' : 'warning', icone: 'credit-card',
            texto: `A fatura do ${c.nome} (${U.money(f.total)}) vence ${U.relativeDay(f.vencimento)}.`,
            rota: '#/cartoes'
          });
        }
      }
      if (uso.pct >= 80) {
        out.push({
          nivel: uso.pct >= 100 ? 'danger' : 'warning', icone: 'gauge',
          texto: `Cartão ${c.nome} está com ${U.pct(uso.pct, 0)} do limite utilizado.`,
          rota: '#/cartoes'
        });
      }
    });

    // assinaturas do dia seguinte
    state.assinaturas.filter(a => a.status === 'ativa' && a.proximaCobranca).forEach(a => {
      const d = U.daysUntil(a.proximaCobranca);
      if (d >= 0 && d <= 1) {
        out.push({
          nivel: 'info', icone: 'repeat',
          texto: `${a.nome} será cobrada ${U.relativeDay(a.proximaCobranca)} (${U.money(a.valor)}).`,
          rota: '#/assinaturas'
        });
      }
    });

    // orçamentos estourados
    orcamentoStatus().forEach(o => {
      if (o.pct >= 80) {
        out.push({
          nivel: o.pct >= 100 ? 'danger' : 'warning', icone: 'chart-pie',
          texto: o.pct >= 100
            ? `Orçamento de ${o.nome} estourado: ${U.money(o.gasto)} de ${U.money(o.limite)}.`
            : `Você usou ${U.pct(o.pct, 0)} do orçamento de ${o.nome}.`,
          rota: '#/metas'
        });
      }
    });

    // variação de gasto
    const mkAtual = U.monthOf(hoje);
    const atual = resumo(U.monthStart(mkAtual), U.monthEnd(mkAtual)).despesas;
    const ant = resumo(U.monthStart(U.addMonthKey(mkAtual, -1)), U.monthEnd(U.addMonthKey(mkAtual, -1))).despesas;
    if (ant > 0 && atual > ant * 1.2) {
      out.push({
        nivel: 'warning', icone: 'trending-up',
        texto: `Seu gasto mensal subiu ${U.pct(((atual - ant) / ant) * 100, 0)} em relação ao mês anterior.`,
        rota: '#/relatorios'
      });
    }

    return out;
  }

  /* ============================================================
     Mutações
     ============================================================ */

  const lista = (ent) => (state[ent] = state[ent] || []);

  async function criar(ent, dados) {
    const novo = await CF.api.create(ent, dados);
    lista(ent).push(novo);
    normalizar();
    emit('change');
    return novo;
  }

  async function atualizar(ent, id, patch) {
    const atualizado = await CF.api.update(ent, id, patch);
    const arr = lista(ent);
    const i = arr.findIndex(x => x.id === id);
    if (i >= 0) arr[i] = Object.assign({}, arr[i], atualizado);
    normalizar();
    emit('change');
    return arr[i];
  }

  async function excluir(ent, id) {
    await CF.api.remove(ent, id);
    state[ent] = lista(ent).filter(x => x.id !== id);
    emit('change');
  }

  /* ---- Transações ---- */

  const criarTransacao = (dados) => criar('transacoes', Object.assign({
    status: 'pago', origemTipo: 'manual', origemId: '', competencia: '',
    subcategoria: '', contaId: '', cartaoId: '', observacao: '', recorrencia: 'unica'
  }, dados));

  async function salvarTransacao(dados, id) {
    const salva = id ? await atualizar('transacoes', id, dados) : await criarTransacao(dados);
    if (dados.recorrencia && dados.recorrencia !== 'unica') await materializar();
    return salva;
  }

  async function excluirTransacao(id, comDerivadas = false) {
    const t = state.transacoes.find(x => x.id === id);
    await excluir('transacoes', id);
    if (comDerivadas && t) {
      const filhas = state.transacoes.filter(x => x.origemTipo === 'recorrencia' && x.origemId === id);
      for (const f of filhas) await excluir('transacoes', f.id);
    }
  }

  const alternarPagamento = (id) => {
    const t = state.transacoes.find(x => x.id === id);
    return atualizar('transacoes', id, { status: t?.status === 'pago' ? 'pendente' : 'pago' });
  };

  function duplicarTransacao(id) {
    const t = state.transacoes.find(x => x.id === id);
    if (!t) return null;
    const copia = Object.assign({}, t);
    delete copia.id; delete copia.criadoEm; delete copia.atualizadoEm;
    copia.competencia = ''; copia.origemTipo = 'manual'; copia.origemId = '';
    copia.parcelaNum = null; copia.parcelaTotal = null; copia.compraId = '';
    copia.data = U.today();
    return criar('transacoes', copia);
  }

  /* ---- Assinaturas ---- */

  async function salvarAssinatura(dados, id) {
    const a = id ? await atualizar('assinaturas', id, dados) : await criar('assinaturas', dados);
    await materializar();
    return a;
  }

  async function excluirAssinatura(id) {
    const futuras = state.transacoes.filter(t =>
      t.origemTipo === 'assinatura' && t.origemId === id && t.status !== 'pago');
    for (const f of futuras) await excluir('transacoes', f.id);
    await excluir('assinaturas', id);
  }

  /* ---- Contas fixas ---- */

  async function salvarContaFixa(dados, id) {
    const c = id ? await atualizar('contasFixas', id, dados) : await criar('contasFixas', dados);
    await materializar();
    return c;
  }

  async function excluirContaFixa(id) {
    const futuras = state.transacoes.filter(t =>
      t.origemTipo === 'contaFixa' && t.origemId === id && t.status !== 'pago');
    for (const f of futuras) await excluir('transacoes', f.id);
    await excluir('contasFixas', id);
  }

  /* ---- Compras ---- */

  /** Cria a compra e já lança todas as parcelas no ledger. */
  async function criarCompra(dados) {
    const compra = await criar('compras', dados);
    const parcelas = CF.engine.gerarParcelas(compra, cartao(compra.cartaoId));
    const criadas = await CF.api.createMany('transacoes', parcelas);
    state.transacoes.push(...criadas);
    normalizar();
    emit('change');
    return compra;
  }

  async function excluirCompra(id) {
    const parcelas = state.transacoes.filter(t => t.compraId === id || (t.origemTipo === 'compra' && t.origemId === id));
    for (const p of parcelas) await excluir('transacoes', p.id);
    await excluir('compras', id);
  }

  /** Regera as parcelas depois de editar a compra. */
  async function atualizarCompra(id, dados) {
    const antigas = state.transacoes.filter(t => t.compraId === id || (t.origemTipo === 'compra' && t.origemId === id));
    const pagasPorNumero = new Set(antigas.filter(t => t.status === 'pago').map(t => t.parcelaNum));
    for (const p of antigas) await excluir('transacoes', p.id);
    const compra = await atualizar('compras', id, dados);
    const novas = CF.engine.gerarParcelas(compra, cartao(compra.cartaoId)).map(p =>
      pagasPorNumero.has(p.parcelaNum) ? Object.assign(p, { status: 'pago' }) : p);
    const criadas = await CF.api.createMany('transacoes', novas);
    state.transacoes.push(...criadas);
    normalizar();
    emit('change');
    return compra;
  }

  /* ---- Cartões / contas / metas / orçamentos ---- */

  /** Ao excluir um cartão, os lançamentos ficam sem cartão (não somem). */
  async function excluirCartao(id) {
    for (const t of state.transacoes.filter(t => t.cartaoId === id)) {
      await atualizar('transacoes', t.id, { cartaoId: '' });
    }
    for (const a of state.assinaturas.filter(a => a.cartaoId === id)) {
      await atualizar('assinaturas', a.id, { cartaoId: '' });
    }
    await excluir('cartoes', id);
  }

  /** Ao excluir uma conta, os lançamentos ficam sem conta vinculada. */
  async function excluirConta(id) {
    for (const t of state.transacoes.filter(t => t.contaId === id)) {
      await atualizar('transacoes', t.id, { contaId: '' });
    }
    await excluir('contas', id);
  }

  return {
    state, periodo, setPeriodo, moverPeriodo, periodoLabel,
    on, emit, carregar, materializar, normalizar,

    // seletores
    transacoes, statusReal, resumo, saldoAtual, saldoAte, saldoContas,
    porCategoria, serieMensal, maioresGastos, proximosVencimentos,
    cartao, conta, fatura, faturasDisponiveis, usoCartao,
    comprasComProgresso, assinaturasResumo, orcamentoStatus,
    metasComProgresso, reserva, mediaDespesaMensal, alertas,

    // mutações genéricas
    criar, atualizar, excluir,

    // mutações específicas
    criarTransacao, salvarTransacao, excluirTransacao, alternarPagamento, duplicarTransacao,
    salvarAssinatura, excluirAssinatura,
    salvarContaFixa, excluirContaFixa,
    criarCompra, atualizarCompra, excluirCompra,
    excluirCartao, excluirConta
  };
})();
