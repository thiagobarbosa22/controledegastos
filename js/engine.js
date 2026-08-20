/* ============================================================
   engine.js — regras de negócio que geram lançamentos.

   Todo lançamento vive em UMA tabela (Transacoes). Assinaturas,
   contas fixas e compras parceladas guardam apenas o cabeçalho e
   *produzem* transações. A geração é idempotente: cada transação
   derivada carrega uma chave `competencia` no formato
   "origem:id:AAAA-MM-DD"; se a chave já existe, não gera de novo.
   ============================================================ */

CF.engine = (function () {
  const u = () => CF.utils;

  const chave = (origemTipo, origemId, data) => `${origemTipo}:${origemId}:${data}`;

  /**
   * Um lançamento derivado já nasce quitado?
   * No débito/pix/dinheiro, sim, assim que a data chega. No crédito, não:
   * ele entra na fatura em aberto e só está pago depois que essa fatura
   * vence — antes disso o dinheiro ainda não saiu da conta.
   */
  function statusInicial(data, cartao) {
    const U = u();
    if (!cartao) return data <= U.today() ? 'pago' : 'pendente';
    return datasFatura(faturaDe(data, cartao), cartao).vencimento < U.today() ? 'pago' : 'pendente';
  }

  /** Fim do horizonte de geração: último dia de (mês atual + `meses`). */
  function horizonte(meses = 2) {
    return u().monthEnd(u().addMonthKey(u().monthOf(u().today()), meses));
  }

  /* ---------------- Assinaturas ---------------- */

  function cobrancasAssinatura(a, existentes, ate, cartoes) {
    const U = u();
    if (a.status !== 'ativa') return [];
    const cartao = a.cartaoId ? (cartoes || []).find(c => c.id === a.cartaoId) : null;
    const passo = CF.catalog.recorrencia(a.periodicidade || 'mensal');
    const novas = [];
    let data = a.proximaCobranca || a.dataInicio || U.today();

    // nunca inventa histórico: avança na cadência até o mês corrente
    const piso = U.monthStart(U.monthOf(U.today()));
    let pulos = 0;
    while (data < piso && pulos++ < 400) {
      data = passo.dias ? U.addDays(data, passo.dias) : U.addMonths(data, passo.meses || 1);
    }

    let guarda = 0;
    while (data <= ate && guarda++ < 400) {
      const k = chave('assinatura', a.id, data);
      if (!existentes.has(k)) {
        novas.push({
          tipo: 'despesa',
          descricao: a.nome,
          valor: Number(a.valor) || 0,
          categoria: a.categoria || 'assinaturas',
          subcategoria: '',
          data,
          formaPagamento: a.formaPagamento || 'credito',
          contaId: a.contaId || '',
          cartaoId: a.cartaoId || '',
          status: statusInicial(data, cartao),
          observacao: '',
          origemTipo: 'assinatura',
          origemId: a.id,
          competencia: k
        });
        existentes.add(k);
      }
      const prox = passo.dias ? U.addDays(data, passo.dias) : U.addMonths(data, passo.meses || 1);
      if (!prox || prox <= data) break;
      data = prox;
    }
    return novas;
  }

  /* ---------------- Contas fixas ---------------- */

  function cobrancasContaFixa(c, existentes, ate) {
    const U = u();
    if (c.status === 'pausada' || c.status === 'cancelada') return [];
    const passo = CF.catalog.recorrencia(c.recorrencia || 'mensal');
    const novas = [];
    // gera a partir do mês corrente (ou do início, se ele for futuro):
    // contas passadas que o usuário nunca registrou não viram dívida
    let mk = U.monthOf(c.dataInicio || U.today());
    const pisoMk = U.monthOf(U.today());
    if (mk < pisoMk) mk = pisoMk;

    let guarda = 0;
    while (guarda++ < 400) {
      const data = passo.dias
        ? U.addDays(c.dataInicio || U.monthStart(mk), (guarda - 1) * passo.dias)
        : U.dayInMonth(mk, Number(c.diaVencimento) || 10);
      if (data > ate) break;
      if (c.dataFim && data > c.dataFim) break;

      const k = chave('contaFixa', c.id, data);
      if (!existentes.has(k)) {
        novas.push({
          tipo: 'despesa',
          descricao: c.nome,
          valor: Number(c.valor) || 0,
          categoria: c.categoria || 'contas',
          subcategoria: '',
          data,
          formaPagamento: c.formaPagamento || 'boleto',
          contaId: c.contaId || '',
          cartaoId: c.cartaoId || '',
          status: 'pendente',
          observacao: '',
          origemTipo: 'contaFixa',
          origemId: c.id,
          competencia: k
        });
        existentes.add(k);
      }
      if (passo.dias) continue;
      mk = U.addMonthKey(mk, passo.meses || 1);
    }
    return novas;
  }

  /* ---------------- Transações recorrentes soltas ---------------- */

  function repeticoesTransacao(t, existentes, ate) {
    const U = u();
    const rec = t.recorrencia;
    if (!rec || rec === 'unica') return [];
    const passo = CF.catalog.recorrencia(rec);
    const novas = [];
    let data = passo.dias ? U.addDays(t.data, passo.dias) : U.addMonths(t.data, passo.meses || 1);

    const piso = U.monthStart(U.monthOf(U.today()));
    let pulos = 0;
    while (data < piso && pulos++ < 400) {
      data = passo.dias ? U.addDays(data, passo.dias) : U.addMonths(data, passo.meses || 1);
    }

    let guarda = 0;
    while (data <= ate && guarda++ < 400) {
      if (t.recorrenciaFim && data > t.recorrenciaFim) break;
      const k = chave('recorrencia', t.id, data);
      if (!existentes.has(k)) {
        novas.push({
          tipo: t.tipo,
          descricao: t.descricao,
          valor: Number(t.valor) || 0,
          categoria: t.categoria,
          subcategoria: t.subcategoria || '',
          data,
          formaPagamento: t.formaPagamento || '',
          contaId: t.contaId || '',
          cartaoId: t.cartaoId || '',
          status: 'pendente',
          observacao: t.observacao || '',
          origemTipo: 'recorrencia',
          origemId: t.id,
          competencia: k
        });
        existentes.add(k);
      }
      const prox = passo.dias ? U.addDays(data, passo.dias) : U.addMonths(data, passo.meses || 1);
      if (!prox || prox <= data) break;
      data = prox;
    }
    return novas;
  }

  /* ---------------- Compras parceladas ---------------- */

  /**
   * Gera as N parcelas de uma compra. Ajusta centavos na última
   * parcela para o somatório bater exatamente com o valor total.
   */
  function gerarParcelas(compra, cartao) {
    const U = u();
    const n = Math.max(1, Number(compra.parcelas) || 1);
    const total = U.round2(Number(compra.valorTotal) || 0);
    const base = U.round2(Math.floor((total / n) * 100) / 100);
    const inicio = compra.primeiraParcela || compra.dataCompra || U.today();
    const linhas = [];

    for (let i = 0; i < n; i++) {
      const ultimo = i === n - 1;
      const valor = ultimo ? U.round2(total - base * (n - 1)) : base;
      const data = U.addMonths(inicio, i);
      linhas.push({
        tipo: 'despesa',
        descricao: n > 1 ? `${compra.produto} (${i + 1}/${n})` : compra.produto,
        valor,
        categoria: compra.categoria || 'compras',
        subcategoria: compra.loja || '',
        data,
        formaPagamento: compra.formaPagamento || (compra.cartaoId ? 'credito' : 'debito'),
        contaId: compra.contaId || '',
        cartaoId: compra.cartaoId || '',
        status: statusInicial(data, compra.cartaoId ? cartao : null),
        observacao: compra.observacao || '',
        origemTipo: 'compra',
        origemId: compra.id,
        compraId: compra.id,
        parcelaNum: i + 1,
        parcelaTotal: n,
        competencia: chave('compra', compra.id, data)
      });
    }
    return linhas;
  }

  /* ---------------- Orquestração ---------------- */

  /**
   * Calcula tudo que falta lançar até o horizonte.
   * Retorna array de transações novas (sem id — o backend atribui).
   */
  function planejar(state, ate) {
    const limite = ate || horizonte(2);
    const existentes = new Set((state.transacoes || []).map(t => t.competencia).filter(Boolean));
    const novas = [];

    for (const a of state.assinaturas || []) novas.push(...cobrancasAssinatura(a, existentes, limite, state.cartoes));
    for (const c of state.contasFixas || []) novas.push(...cobrancasContaFixa(c, existentes, limite));
    for (const t of state.transacoes || []) {
      if (t.recorrencia && t.recorrencia !== 'unica' && t.origemTipo !== 'recorrencia') {
        novas.push(...repeticoesTransacao(t, existentes, limite));
      }
    }
    return novas;
  }

  /* ---------------- Fatura de cartão ---------------- */

  /**
   * Mês de fatura ao qual uma compra pertence.
   * Compra após o fechamento cai na fatura do mês seguinte.
   * Retorna a chave "AAAA-MM" do mês de VENCIMENTO da fatura.
   */
  function faturaDe(dataISO, cartao) {
    const U = u();
    const fech = Number(cartao?.diaFechamento) || 1;
    const venc = Number(cartao?.diaVencimento) || 10;
    const d = U.parseYmd(dataISO);
    let mk = U.monthOf(dataISO);
    if (d.getDate() > fech) mk = U.addMonthKey(mk, 1);
    // vencimento normalmente cai depois do fechamento; se o dia de
    // vencimento for menor, a fatura vence só no mês seguinte
    if (venc <= fech) mk = U.addMonthKey(mk, 1);
    return mk;
  }

  /** Datas de fechamento e vencimento de uma fatura "AAAA-MM". */
  function datasFatura(mk, cartao) {
    const U = u();
    const fech = Number(cartao?.diaFechamento) || 1;
    const venc = Number(cartao?.diaVencimento) || 10;
    const vencimento = U.dayInMonth(mk, venc);
    const mkFech = venc <= fech ? U.addMonthKey(mk, -1) : mk;
    return { fechamento: U.dayInMonth(mkFech, fech), vencimento };
  }

  return { planejar, gerarParcelas, faturaDe, datasFatura, horizonte, chave };
})();
