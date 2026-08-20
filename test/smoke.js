/**
 * Verificação mínima da camada de dados (roda no Node, sem navegador):
 *   node test/smoke.js
 *
 * Cobre o que quebra silenciosamente: datas sem deslocamento de fuso,
 * parcelamento com centavos exatos, idempotência da geração de
 * lançamentos recorrentes, fatura de cartão e os totais do dashboard.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const raiz = path.join(__dirname, '..');

/* ---- ambiente de navegador mínimo ---- */
const store = new Map();
const ctx = {
  console,
  Intl, Date, Math, JSON, Number, String, Object, Array, Set, Map, Boolean, RegExp, Error, isNaN, parseFloat, parseInt,
  Promise, setTimeout, clearTimeout,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  },
  performance: { now: () => Date.now() },
  requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
  document: {
    documentElement: { style: { getPropertyValue: () => '' }, dataset: {} },
    dispatchEvent: () => {},
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  },
  getComputedStyle: () => ({ getPropertyValue: () => '#6366f1' }),
  CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
  matchMedia: () => ({ matches: false, addEventListener: () => {} })
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

for (const f of ['js/utils.js', 'js/config.js', 'js/catalog.js', 'js/engine.js', 'js/api.js', 'js/store.js']) {
  vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
}

const { CF } = ctx;
const U = CF.utils;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

console.log('\nControle Financeiro — verificação da camada de dados\n');

/* ---------------- datas ---------------- */
teste('datas não deslocam por fuso horário', () => {
  assert.strictEqual(U.fmtDate('2026-08-20'), '20/08/2026');
  assert.strictEqual(U.parseYmd('2026-08-20').getDate(), 20);
  assert.strictEqual(U.monthOf('2026-08-20'), '2026-08');
});

teste('addMonths trava no último dia do mês curto', () => {
  assert.strictEqual(U.addMonths('2026-01-31', 1), '2026-02-28');
  assert.strictEqual(U.addMonths('2026-03-31', -1), '2026-02-28');
  assert.strictEqual(U.addMonths('2026-08-20', 12), '2027-08-20');
});

teste('parseMoney entende o formato brasileiro', () => {
  assert.strictEqual(U.parseMoney('1.234,56'), 1234.56);
  assert.strictEqual(U.parseMoney('R$ 90'), 90);
  assert.strictEqual(U.parseMoney('54,90'), 54.9);
  assert.strictEqual(U.parseMoney('1234.56'), 1234.56);
  assert.strictEqual(U.parseMoney(''), 0);
});

/* ---------------- parcelamento ---------------- */
teste('parcelas somam exatamente o valor total', () => {
  const parcelas = CF.engine.gerarParcelas({
    id: 'COM-TESTE', produto: 'Notebook', valorTotal: 1000, parcelas: 3,
    dataCompra: '2026-01-31', primeiraParcela: '2026-01-31', categoria: 'tecnologia'
  });
  assert.strictEqual(parcelas.length, 3);
  assert.strictEqual(U.round2(U.sum(parcelas, p => p.valor)), 1000);
  assert.strictEqual(parcelas[0].valor, 333.33);
  assert.strictEqual(parcelas[2].valor, 333.34);
  assert.strictEqual(parcelas[1].data, '2026-02-28');
  assert.strictEqual(parcelas[0].descricao, 'Notebook (1/3)');
});

/* ---------------- fatura de cartão ---------------- */
teste('compra após o fechamento cai na fatura seguinte', () => {
  const cartao = { diaFechamento: 20, diaVencimento: 27 };
  assert.strictEqual(CF.engine.faturaDe('2026-08-15', cartao), '2026-08');
  assert.strictEqual(CF.engine.faturaDe('2026-08-25', cartao), '2026-09');
  const datas = CF.engine.datasFatura('2026-09', cartao);
  assert.strictEqual(datas.fechamento, '2026-09-20');
  assert.strictEqual(datas.vencimento, '2026-09-27');
});

teste('vencimento anterior ao fechamento vira o mês', () => {
  const cartao = { diaFechamento: 25, diaVencimento: 5 };
  assert.strictEqual(CF.engine.faturaDe('2026-08-10', cartao), '2026-09');
  const datas = CF.engine.datasFatura('2026-09', cartao);
  assert.strictEqual(datas.fechamento, '2026-08-25');
  assert.strictEqual(datas.vencimento, '2026-09-05');
});

/* ---------------- recorrência idempotente ---------------- */
teste('assinaturas não geram cobrança duplicada', () => {
  const estado = {
    transacoes: [],
    assinaturas: [{
      id: 'ASS-1', nome: 'Netflix', valor: 55.9, categoria: 'streaming',
      periodicidade: 'mensal', status: 'ativa',
      dataInicio: U.addMonths(U.today(), -3), proximaCobranca: U.addMonths(U.today(), -3)
    }],
    contasFixas: []
  };
  const primeira = CF.engine.planejar(estado);
  assert.ok(primeira.length >= 3, 'deveria gerar a cobrança do mês e as futuras');
  const inicioDoMes = U.monthStart(U.monthOf(U.today()));
  assert.ok(primeira.every(t => t.data >= inicioDoMes),
    'não pode inventar cobranças de meses passados');
  estado.transacoes = primeira.map((t, i) => Object.assign({ id: 'TRX-' + i }, t));
  const segunda = CF.engine.planejar(estado);
  assert.strictEqual(segunda.length, 0, 'a segunda passada não pode gerar nada');
});

teste('assinatura pausada não gera cobrança', () => {
  const estado = {
    transacoes: [],
    assinaturas: [{ id: 'ASS-2', nome: 'Pausada', valor: 10, periodicidade: 'mensal',
      status: 'pausada', dataInicio: U.addMonths(U.today(), -2), proximaCobranca: U.addMonths(U.today(), -2) }],
    contasFixas: []
  };
  assert.strictEqual(CF.engine.planejar(estado).length, 0);
});

/* ---------------- store ---------------- */
teste('a aplicação começa sem nenhum dado embutido', async () => {
  await CF.store.carregar();
  for (const ent of ['transacoes', 'assinaturas', 'compras', 'cartoes', 'contas', 'contasFixas', 'metas', 'orcamentos']) {
    assert.strictEqual(CF.store.state[ent].length, 0, `${ent} deveria começar vazio`);
  }
});

teste('store grava e os totais fecham', async () => {
  const hoje = U.today();

  await CF.store.criar('contas', { nome: 'Conta teste', saldoInicial: 1000, ativo: true });
  const cartao = await CF.store.criar('cartoes', {
    nome: 'Cartão teste', limite: 5000, diaFechamento: 28, diaVencimento: 5, final: '1234', ativo: true
  });
  await CF.store.criarTransacao({ tipo: 'receita', descricao: 'Salário', valor: 5000, categoria: 'salario', data: hoje, status: 'pago' });
  await CF.store.criarTransacao({ tipo: 'despesa', descricao: 'Mercado', valor: 300, categoria: 'mercado', data: hoje, status: 'pago' });
  await CF.store.criarCompra({
    tipo: 'parcelada', produto: 'Notebook', valorTotal: 4800, parcelas: 12, valorParcela: 400,
    dataCompra: hoje, primeiraParcela: hoje, categoria: 'tecnologia',
    formaPagamento: 'credito', cartaoId: cartao.id
  });

  const r = CF.store.resumo();
  assert.strictEqual(U.round2(r.receitas), 5000);
  assert.strictEqual(U.round2(r.despesas), 700, 'mercado 300 + parcela 400');
  assert.strictEqual(U.round2(r.economia), U.round2(r.receitas - r.despesas));

  // saldo = inicial + recebido - pago em conta.
  // a parcela no crédito NÃO entra: ela está na fatura aberta, que ainda não venceu
  assert.strictEqual(U.round2(CF.store.saldoAtual()), 5700);

  // e a parcela da fatura aberta não é "atrasada" só porque a compra já passou
  const parcela = CF.store.state.transacoes.find(t => t.cartaoId === cartao.id);
  assert.strictEqual(parcela.status, 'pendente', 'compra no crédito não nasce paga');
  assert.strictEqual(CF.store.statusReal(parcela), 'pendente');

  const cats = CF.store.porCategoria('despesa');
  assert.ok(Math.abs(U.sum(cats, c => c.pct) - 100) < 0.5, 'os percentuais devem somar 100%');

  // limite comprometido: a parcela paga da fatura aberta + as 11 futuras
  const uso = CF.store.usoCartao(cartao.id);
  assert.strictEqual(U.round2(uso.utilizado), 4800);
  assert.strictEqual(U.round2(uso.disponivel), 200);

  const compra = CF.store.comprasComProgresso()[0];
  assert.strictEqual(compra.parcelasGeradas, 12);
  assert.strictEqual(U.round2(compra.pago), 0, 'nada foi pago até a fatura vencer');
  assert.strictEqual(U.round2(compra.restante), 4800);
});

teste('a fatura só reduz o saldo depois de quitada', async () => {
  const cartao = CF.store.state.cartoes[0];
  const antes = CF.store.saldoAtual();
  const f = CF.store.fatura(cartao.id, CF.engine.faturaDe(U.today(), cartao));

  assert.ok(f.total > 0, 'a fatura aberta precisa ter lançamentos');
  assert.strictEqual(U.round2(CF.store.saldoAte(U.addDays(f.vencimento, -1))), U.round2(antes),
    'antes do vencimento o dinheiro ainda está na conta');

  for (const t of f.itens) await CF.store.atualizar('transacoes', t.id, { status: 'pago' });

  assert.strictEqual(U.round2(CF.store.saldoAte(f.vencimento)), U.round2(antes - f.total),
    'quitada, a fatura sai do saldo no vencimento');
  assert.strictEqual(U.round2(CF.store.saldoAtual()), U.round2(antes),
    'e continua fora do saldo de hoje, que é anterior ao vencimento');
});

teste('excluir a compra remove todas as parcelas', async () => {
  const compra = CF.store.comprasComProgresso()[0];
  await CF.store.excluirCompra(compra.id);
  assert.strictEqual(CF.store.state.compras.length, 0);
  assert.strictEqual(CF.store.state.transacoes.filter(t => t.compraId === compra.id).length, 0);
});

/* ---------------- comando rápido ---------------- */
teste('sugestão de categoria por palavra-chave', () => {
  assert.strictEqual(CF.catalog.sugerirCategoria('Uber para o trabalho', 'despesa'), 'transporte');
  assert.strictEqual(CF.catalog.sugerirCategoria('iFood jantar', 'despesa'), 'alimentacao');
  assert.strictEqual(CF.catalog.sugerirCategoria('Netflix', 'despesa'), 'streaming');
  assert.strictEqual(CF.catalog.sugerirCategoria('Salário de agosto', 'receita'), 'salario');
});

(async () => {
  let passou = 0;
  for (const [nome, fn] of testes) {
    try {
      await fn();
      passou++;
      console.log('  ✓ ' + nome);
    } catch (e) {
      console.error('  ✗ ' + nome + '\n    ' + e.message);
      process.exitCode = 1;
    }
  }
  console.log(`\n${passou}/${testes.length} verificações concluídas.\n`);
})();
