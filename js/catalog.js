/* ============================================================
   catalog.js — catálogos fixos: categorias, formas de pagamento,
   recorrências, status e paletas.
   Categorias personalizadas do usuário vivem na planilha e são
   mescladas por CF.catalog.categorias().
   ============================================================ */

CF.catalog = (function () {

  /* ---- Categorias padrão de despesa ---- */
  const DESPESA = [
    { id: 'moradia',       nome: 'Moradia',       icone: 'house',            cor: '#6366f1', subs: ['Aluguel', 'Condomínio', 'IPTU', 'Manutenção', 'Móveis'] },
    { id: 'alimentacao',   nome: 'Alimentação',   icone: 'utensils',         cor: '#f97316', subs: ['Restaurantes', 'Delivery', 'Lanches', 'Café'] },
    { id: 'mercado',       nome: 'Mercado',       icone: 'shopping-cart',    cor: '#22c55e', subs: ['Supermercado', 'Feira', 'Açougue', 'Padaria'] },
    { id: 'transporte',    nome: 'Transporte',    icone: 'car-front',        cor: '#0ea5e9', subs: ['Uber', 'Combustível', 'Ônibus', 'Estacionamento', 'Manutenção'] },
    { id: 'saude',         nome: 'Saúde',         icone: 'heart-pulse',      cor: '#ef4444', subs: ['Plano de saúde', 'Farmácia', 'Consultas', 'Exames', 'Dentista'] },
    { id: 'educacao',      nome: 'Educação',      icone: 'graduation-cap',   cor: '#8b5cf6', subs: ['Faculdade', 'Cursos', 'Livros', 'Material'] },
    { id: 'lazer',         nome: 'Lazer',         icone: 'party-popper',     cor: '#ec4899', subs: ['Cinema', 'Bares', 'Eventos', 'Jogos'] },
    { id: 'streaming',     nome: 'Streaming',     icone: 'monitor-play',     cor: '#e11d48', subs: ['Vídeo', 'Música', 'Games'] },
    { id: 'compras',       nome: 'Compras',       icone: 'shopping-bag',     cor: '#14b8a6', subs: ['Presentes', 'Casa', 'Diversos'] },
    { id: 'tecnologia',    nome: 'Tecnologia',    icone: 'cpu',              cor: '#3b82f6', subs: ['Eletrônicos', 'Softwares', 'Acessórios'] },
    { id: 'roupas',        nome: 'Roupas',        icone: 'shirt',            cor: '#a855f7', subs: ['Vestuário', 'Calçados', 'Acessórios'] },
    { id: 'viagens',       nome: 'Viagens',       icone: 'plane',            cor: '#06b6d4', subs: ['Passagens', 'Hospedagem', 'Passeios'] },
    { id: 'assinaturas',   nome: 'Assinaturas',   icone: 'repeat',           cor: '#f43f5e', subs: ['Serviços', 'Apps', 'Nuvem'] },
    { id: 'contas',        nome: 'Contas',        icone: 'receipt-text',     cor: '#64748b', subs: ['Energia', 'Água', 'Internet', 'Telefone', 'Gás'] },
    { id: 'investimentos', nome: 'Investimentos', icone: 'chart-line',       cor: '#10b981', subs: ['Renda fixa', 'Ações', 'Cripto', 'Reserva'] },
    { id: 'impostos',      nome: 'Impostos',      icone: 'landmark',         cor: '#78716c', subs: ['IR', 'Taxas', 'Multas'] },
    { id: 'pets',          nome: 'Pets',          icone: 'paw-print',        cor: '#f59e0b', subs: ['Ração', 'Veterinário', 'Banho'] },
    { id: 'outros',        nome: 'Outros',        icone: 'circle-ellipsis',  cor: '#94a3b8', subs: [] }
  ];

  /* ---- Categorias padrão de receita ---- */
  const RECEITA = [
    { id: 'salario',       nome: 'Salário',       icone: 'banknote',        cor: '#059669', subs: ['Mensal', '13º', 'Férias', 'Bônus'] },
    { id: 'freelance',     nome: 'Freelance',     icone: 'laptop',          cor: '#0ea5e9', subs: [] },
    { id: 'venda',         nome: 'Venda',         icone: 'tag',             cor: '#8b5cf6', subs: [] },
    { id: 'rendimentos',   nome: 'Investimentos', icone: 'trending-up',     cor: '#10b981', subs: ['Dividendos', 'Juros', 'Resgate'] },
    { id: 'reembolso',     nome: 'Reembolso',     icone: 'undo-2',          cor: '#f59e0b', subs: [] },
    { id: 'renda-extra',   nome: 'Renda extra',   icone: 'sparkles',        cor: '#ec4899', subs: [] },
    { id: 'presente',      nome: 'Presente',      icone: 'gift',            cor: '#f43f5e', subs: [] },
    { id: 'outros-rec',    nome: 'Outros',        icone: 'circle-ellipsis', cor: '#94a3b8', subs: [] }
  ];

  /* ---- Formas de pagamento ---- */
  const PAGAMENTOS = [
    { id: 'pix',       nome: 'Pix',              icone: 'zap' },
    { id: 'debito',    nome: 'Débito',           icone: 'credit-card' },
    { id: 'credito',   nome: 'Cartão de crédito', icone: 'credit-card' },
    { id: 'dinheiro',  nome: 'Dinheiro',         icone: 'banknote' },
    { id: 'boleto',    nome: 'Boleto',           icone: 'barcode' },
    { id: 'transferencia', nome: 'Transferência', icone: 'arrow-left-right' },
    { id: 'vale',      nome: 'Vale / benefício', icone: 'ticket' }
  ];

  /* ---- Recorrências ---- */
  const RECORRENCIAS = [
    { id: 'unica',        nome: 'Única',        meses: 0 },
    { id: 'semanal',      nome: 'Semanal',      dias: 7 },
    { id: 'quinzenal',    nome: 'Quinzenal',    dias: 14 },
    { id: 'mensal',       nome: 'Mensal',       meses: 1 },
    { id: 'bimestral',    nome: 'Bimestral',    meses: 2 },
    { id: 'trimestral',   nome: 'Trimestral',   meses: 3 },
    { id: 'semestral',    nome: 'Semestral',    meses: 6 },
    { id: 'anual',        nome: 'Anual',        meses: 12 }
  ];

  const PERIODICIDADES = RECORRENCIAS.filter(r => r.id !== 'unica' && r.id !== 'quinzenal');

  /* ---- Status ---- */
  const STATUS_TXN = [
    { id: 'pago',      nome: 'Pago',      classe: 'badge-income' },
    { id: 'pendente',  nome: 'Pendente',  classe: 'badge-warning' },
    { id: 'atrasado',  nome: 'Atrasado',  classe: 'badge-expense' }
  ];

  const STATUS_ASSINATURA = [
    { id: 'ativa',     nome: 'Ativa',     classe: 'badge-income' },
    { id: 'pausada',   nome: 'Pausada',   classe: 'badge-warning' },
    { id: 'cancelada', nome: 'Cancelada', classe: 'badge' }
  ];

  /* ---- Tipos de conta bancária / carteira ---- */
  const TIPOS_CONTA = [
    { id: 'corrente',  nome: 'Conta corrente', icone: 'landmark' },
    { id: 'poupanca',  nome: 'Poupança',       icone: 'piggy-bank' },
    { id: 'digital',   nome: 'Conta digital',  icone: 'smartphone' },
    { id: 'carteira',  nome: 'Carteira',       icone: 'wallet' },
    { id: 'investimento', nome: 'Investimento', icone: 'chart-line' }
  ];

  /* ---- Gradientes para cartões de crédito ---- */
  const CARD_THEMES = [
    { id: 'roxo',    nome: 'Roxo',    css: 'linear-gradient(135deg,#8a05be,#5b0a86)' },
    { id: 'laranja', nome: 'Laranja', css: 'linear-gradient(135deg,#ff7a18,#ea580c)' },
    { id: 'azul',    nome: 'Azul',    css: 'linear-gradient(135deg,#2563eb,#0ea5e9)' },
    { id: 'preto',   nome: 'Preto',   css: 'linear-gradient(135deg,#1f2937,#020617)' },
    { id: 'verde',   nome: 'Verde',   css: 'linear-gradient(135deg,#059669,#065f46)' },
    { id: 'vermelho', nome: 'Vermelho', css: 'linear-gradient(135deg,#e11d48,#881337)' },
    { id: 'dourado', nome: 'Dourado', css: 'linear-gradient(135deg,#b45309,#78350f)' },
    { id: 'indigo',  nome: 'Índigo',  css: 'linear-gradient(135deg,#4f46e5,#312e81)' }
  ];

  /* ---- Palavras-chave → categoria (lançamento rápido) ---- */
  const PALAVRAS = {
    transporte: ['uber', '99', 'taxi', 'gasolina', 'combustivel', 'posto', 'onibus', 'metro', 'estacionamento', 'pedagio'],
    alimentacao: ['ifood', 'rappi', 'restaurante', 'lanche', 'almoco', 'jantar', 'pizza', 'hamburguer', 'cafe', 'padaria', 'bar'],
    mercado: ['mercado', 'supermercado', 'compras do mes', 'carrefour', 'assai', 'atacadao', 'feira', 'hortifruti'],
    moradia: ['aluguel', 'condominio', 'iptu', 'energia', 'luz', 'agua', 'gas'],
    saude: ['farmacia', 'remedio', 'medico', 'consulta', 'dentista', 'exame', 'plano de saude', 'academia'],
    streaming: ['netflix', 'spotify', 'disney', 'hbo', 'max', 'prime video', 'youtube premium', 'deezer', 'crunchyroll'],
    tecnologia: ['notebook', 'celular', 'fone', 'monitor', 'teclado', 'mouse', 'chatgpt', 'github', 'icloud', 'google one'],
    educacao: ['faculdade', 'curso', 'livro', 'apostila', 'mensalidade'],
    lazer: ['cinema', 'show', 'ingresso', 'jogo', 'steam', 'viagem'],
    contas: ['internet', 'telefone', 'celular plano', 'vivo', 'claro', 'tim', 'oi'],
    roupas: ['roupa', 'camisa', 'calca', 'tenis', 'sapato', 'shopping'],
    pets: ['racao', 'petshop', 'veterinario']
  };

  const PALAVRAS_RECEITA = {
    salario: ['salario', 'pagamento', 'holerite'],
    freelance: ['freela', 'freelance', 'projeto', 'servico'],
    venda: ['venda', 'vendi'],
    rendimentos: ['dividendo', 'rendimento', 'juros', 'resgate'],
    reembolso: ['reembolso', 'estorno', 'devolucao']
  };

  /* ---------------- API do catálogo ---------------- */

  /** Categorias do tipo informado, já mescladas com as personalizadas do store. */
  function categorias(tipo) {
    const base = tipo === 'receita' ? RECEITA : DESPESA;
    const extra = (CF.store?.state?.categorias || []).filter(c => c.tipo === (tipo || 'despesa'));
    const ids = new Set(base.map(c => c.id));
    return base.concat(extra.filter(c => !ids.has(c.id)).map(c => ({
      id: c.id, nome: c.nome, icone: c.icone || 'circle', cor: c.cor || CF.utils.colorFrom(c.nome),
      subs: (c.subcategorias || '').split(',').map(s => s.trim()).filter(Boolean),
      custom: true
    })));
  }

  function categoria(id, tipo) {
    const lista = categorias(tipo);
    return lista.find(c => c.id === id)
      || (tipo === 'receita' ? RECEITA : DESPESA).find(c => c.id === id)
      || { id: id || 'outros', nome: id ? CF.utils.titleCase(id) : 'Outros', icone: 'circle-ellipsis', cor: '#94a3b8', subs: [] };
  }

  const pagamento = (id) => PAGAMENTOS.find(p => p.id === id) || { id, nome: id ? CF.utils.titleCase(id) : '—', icone: 'wallet' };
  const recorrencia = (id) => RECORRENCIAS.find(r => r.id === id) || RECORRENCIAS[0];
  const cardTheme = (id) => CARD_THEMES.find(t => t.id === id) || CARD_THEMES[0];

  /** Avança uma data conforme a recorrência. */
  function proximaData(dataISO, recId) {
    const r = recorrencia(recId);
    if (r.dias) return CF.utils.addDays(dataISO, r.dias);
    if (r.meses) return CF.utils.addMonths(dataISO, r.meses);
    return null;
  }

  /** Sugere categoria a partir da descrição. */
  function sugerirCategoria(texto, tipo) {
    const t = CF.utils.norm(texto);
    const mapa = tipo === 'receita' ? PALAVRAS_RECEITA : PALAVRAS;
    for (const [cat, palavras] of Object.entries(mapa)) {
      if (palavras.some(p => t.includes(p))) return cat;
    }
    return tipo === 'receita' ? 'outros-rec' : 'outros';
  }

  return {
    DESPESA, RECEITA, PAGAMENTOS, RECORRENCIAS, PERIODICIDADES,
    STATUS_TXN, STATUS_ASSINATURA, TIPOS_CONTA, CARD_THEMES,
    categorias, categoria, pagamento, recorrencia, cardTheme,
    proximaData, sugerirCategoria
  };
})();
