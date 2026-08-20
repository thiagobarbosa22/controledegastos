/**
 * ============================================================
 *  CONTROLE FINANCEIRO PESSOAL — Backend (Google Apps Script)
 *  Google Sheets como banco de dados.
 *
 *  Instalação resumida:
 *   1. Crie uma planilha no Google Sheets.
 *   2. Extensões › Apps Script e cole este arquivo.
 *   3. Execute a função `setup()` uma vez (autorize o acesso).
 *   4. Implantar › Nova implantação › Aplicativo da Web
 *        - Executar como: Eu
 *        - Quem pode acessar: Qualquer pessoa
 *   5. Copie a URL /exec e cole em Configurações no site.
 *
 *  Opcional: em Configurações do projeto › Propriedades do script,
 *  crie a propriedade API_KEY. O site só grava se enviar a mesma chave.
 * ============================================================
 */

/* ------------------------------------------------------------
   Estrutura das abas. A primeira linha de cada aba é o cabeçalho
   e define o nome dos campos usados pela API.
   ------------------------------------------------------------ */
var ABAS = {
  transacoes: {
    nome: 'Transacoes',
    prefixo: 'TRX',
    colunas: ['id', 'tipo', 'descricao', 'valor', 'categoria', 'subcategoria', 'data',
      'formaPagamento', 'contaId', 'cartaoId', 'status', 'observacao',
      'recorrencia', 'recorrenciaFim', 'origemTipo', 'origemId', 'competencia',
      'compraId', 'parcelaNum', 'parcelaTotal', 'criadoEm', 'atualizadoEm']
  },
  assinaturas: {
    nome: 'Assinaturas',
    prefixo: 'ASS',
    colunas: ['id', 'nome', 'valor', 'categoria', 'periodicidade', 'dataInicio',
      'proximaCobranca', 'formaPagamento', 'cartaoId', 'contaId', 'status',
      'observacao', 'criadoEm', 'atualizadoEm']
  },
  compras: {
    nome: 'Compras',
    prefixo: 'COM',
    colunas: ['id', 'tipo', 'produto', 'valorTotal', 'parcelas', 'valorParcela',
      'dataCompra', 'primeiraParcela', 'categoria', 'loja', 'formaPagamento',
      'cartaoId', 'contaId', 'observacao', 'criadoEm', 'atualizadoEm']
  },
  cartoes: {
    nome: 'Cartoes',
    prefixo: 'CAR',
    colunas: ['id', 'nome', 'banco', 'limite', 'diaFechamento', 'diaVencimento',
      'final', 'cor', 'ativo', 'criadoEm', 'atualizadoEm']
  },
  contas: {
    nome: 'Contas',
    prefixo: 'CTA',
    colunas: ['id', 'nome', 'instituicao', 'tipo', 'saldoInicial', 'cor', 'ativo',
      'criadoEm', 'atualizadoEm']
  },
  contasFixas: {
    nome: 'ContasFixas',
    prefixo: 'CTF',
    colunas: ['id', 'nome', 'valor', 'categoria', 'diaVencimento', 'recorrencia',
      'formaPagamento', 'contaId', 'cartaoId', 'dataInicio', 'dataFim', 'status',
      'observacao', 'criadoEm', 'atualizadoEm']
  },
  categorias: {
    nome: 'Categorias',
    prefixo: 'CAT',
    colunas: ['id', 'nome', 'tipo', 'icone', 'cor', 'subcategorias', 'criadoEm', 'atualizadoEm']
  },
  metas: {
    nome: 'Metas',
    prefixo: 'MET',
    colunas: ['id', 'nome', 'valorMeta', 'valorAtual', 'prazo', 'tipo', 'icone',
      'cor', 'observacao', 'criadoEm', 'atualizadoEm']
  },
  orcamentos: {
    nome: 'Orcamentos',
    prefixo: 'ORC',
    colunas: ['id', 'categoria', 'limite', 'mes', 'criadoEm', 'atualizadoEm']
  }
};

var ABA_CONFIG = 'Config';

/* ============================================================
   Setup — execute uma vez
   ============================================================ */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(ABAS).forEach(function (chave) {
    var def = ABAS[chave];
    var aba = ss.getSheetByName(def.nome);
    if (!aba) aba = ss.insertSheet(def.nome);
    aba.getRange(1, 1, 1, def.colunas.length)
      .setValues([def.colunas])
      .setFontWeight('bold')
      .setBackground('#eef2ff');
    aba.setFrozenRows(1);
    // datas e ids como texto puro evitam conversões indesejadas
    aba.getRange(2, 1, aba.getMaxRows() - 1, def.colunas.length).setNumberFormat('@');
    aba.autoResizeColumns(1, Math.min(def.colunas.length, 12));
  });

  var cfg = ss.getSheetByName(ABA_CONFIG);
  if (!cfg) cfg = ss.insertSheet(ABA_CONFIG);
  cfg.getRange(1, 1, 1, 2).setValues([['chave', 'valor']]).setFontWeight('bold').setBackground('#eef2ff');
  cfg.getRange(2, 1, 3, 2).setValues([
    ['versao', '1'],
    ['criadoEm', new Date().toISOString().slice(0, 10)],
    ['sequencia', '0']
  ]);

  // remove a aba padrão vazia, se existir
  var padrao = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (padrao && ss.getSheets().length > 1 && padrao.getLastRow() === 0) ss.deleteSheet(padrao);

  SpreadsheetApp.getUi && Logger.log('Setup concluído: ' + ss.getName());
  return 'ok';
}

/* ============================================================
   Entradas HTTP
   ============================================================ */

function doGet(e) {
  var acao = (e && e.parameter && e.parameter.acao) || 'ping';
  return processar({ acao: acao, apiKey: (e && e.parameter && e.parameter.apiKey) || '' });
}

function doPost(e) {
  var corpo = {};
  try {
    corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return responder(false, null, 'JSON inválido');
  }
  return processar(corpo);
}

function processar(req) {
  try {
    var acao = req.acao || 'ping';

    if (acao !== 'ping' && !chaveValida(req.apiKey)) {
      return responder(false, null, 'Chave de acesso inválida');
    }

    switch (acao) {
      case 'ping':
        return responder(true, { ok: true, planilha: SpreadsheetApp.getActiveSpreadsheet().getName(), versao: 1 });
      case 'bootstrap':
        return responder(true, bootstrap());
      case 'listar':
        return responder(true, ler(req.entidade));
      case 'criar':
        return responder(true, criar(req.entidade, req.dados));
      case 'criarLote':
        return responder(true, criarLote(req.entidade, req.dados));
      case 'atualizar':
        return responder(true, atualizar(req.entidade, req.id, req.dados));
      case 'excluir':
        return responder(true, excluir(req.entidade, req.id));
      case 'excluirOnde':
        return responder(true, excluirOnde(req.entidade, req.campo, req.valor));
      default:
        return responder(false, null, 'Ação desconhecida: ' + acao);
    }
  } catch (err) {
    return responder(false, null, (err && err.message) || String(err));
  }
}

function responder(ok, dados, erro) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: ok, dados: dados || null, erro: erro || null }))
    .setMimeType(ContentService.MimeType.JSON);
}

function chaveValida(enviada) {
  var esperada = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!esperada) return true;           // sem chave configurada = acesso liberado
  return String(enviada || '') === esperada;
}

/* ============================================================
   Operações
   ============================================================ */

function bootstrap() {
  var out = {};
  Object.keys(ABAS).forEach(function (chave) { out[chave] = ler(chave); });
  out.config = lerConfig();
  return out;
}

function def(entidade) {
  var d = ABAS[entidade];
  if (!d) throw new Error('Entidade desconhecida: ' + entidade);
  return d;
}

function aba(entidade) {
  var d = def(entidade);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(d.nome);
  if (!s) {
    s = ss.insertSheet(d.nome);
    s.getRange(1, 1, 1, d.colunas.length).setValues([d.colunas]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}

/** Converte valores da planilha para texto/número previsíveis. */
function normalizar(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (v === null || v === undefined) return '';
  return v;
}

function ler(entidade) {
  var d = def(entidade);
  var s = aba(entidade);
  var ultima = s.getLastRow();
  if (ultima < 2) return [];

  var valores = s.getRange(2, 1, ultima - 1, d.colunas.length).getValues();
  var out = [];
  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];
    if (!linha[0]) continue;                       // linha sem id = ignorada
    var obj = {};
    for (var c = 0; c < d.colunas.length; c++) obj[d.colunas[c]] = normalizar(linha[c]);
    out.push(obj);
  }
  return out;
}

function lerConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(ABA_CONFIG);
  if (!s || s.getLastRow() < 2) return {};
  var valores = s.getRange(2, 1, s.getLastRow() - 1, 2).getValues();
  var out = {};
  valores.forEach(function (l) { if (l[0]) out[l[0]] = normalizar(l[1]); });
  return out;
}

function linhaDe(dados, colunas) {
  return colunas.map(function (c) {
    var v = dados[c];
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return v;
  });
}

function hoje() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** IDs sequenciais no formato PREFIXO-AAAAMMDD-0001. */
function proximoId(prefixo) {
  var props = PropertiesService.getScriptProperties();
  var chave = 'SEQ_' + prefixo;
  var n = Number(props.getProperty(chave) || 0) + 1;
  props.setProperty(chave, String(n));
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  return prefixo + '-' + stamp + '-' + ('0000' + n).slice(-4);
}

function criar(entidade, dados) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = def(entidade);
    var s = aba(entidade);
    var obj = dados || {};
    obj.id = obj.id || proximoId(d.prefixo);
    obj.criadoEm = obj.criadoEm || hoje();
    obj.atualizadoEm = hoje();
    validar(entidade, obj);
    s.appendRow(linhaDe(obj, d.colunas));
    return obj;
  } finally {
    lock.releaseLock();
  }
}

function criarLote(entidade, lista) {
  if (!lista || !lista.length) return [];
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var d = def(entidade);
    var s = aba(entidade);

    // evita duplicar lançamentos derivados já existentes
    var existentes = {};
    if (entidade === 'transacoes') {
      var idx = d.colunas.indexOf('competencia');
      var ultima = s.getLastRow();
      if (ultima > 1) {
        s.getRange(2, idx + 1, ultima - 1, 1).getValues().forEach(function (l) {
          if (l[0]) existentes[l[0]] = true;
        });
      }
    }

    var criados = [];
    var linhas = [];
    for (var i = 0; i < lista.length; i++) {
      var obj = lista[i] || {};
      if (obj.competencia && existentes[obj.competencia]) continue;
      obj.id = obj.id || proximoId(d.prefixo);
      obj.criadoEm = obj.criadoEm || hoje();
      obj.atualizadoEm = hoje();
      validar(entidade, obj);
      if (obj.competencia) existentes[obj.competencia] = true;
      criados.push(obj);
      linhas.push(linhaDe(obj, d.colunas));
    }
    if (linhas.length) {
      s.getRange(s.getLastRow() + 1, 1, linhas.length, d.colunas.length).setValues(linhas);
    }
    return criados;
  } finally {
    lock.releaseLock();
  }
}

function encontrarLinha(s, id) {
  var ultima = s.getLastRow();
  if (ultima < 2) return -1;
  var ids = s.getRange(2, 1, ultima - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function atualizar(entidade, id, patch) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = def(entidade);
    var s = aba(entidade);
    var linha = encontrarLinha(s, id);
    if (linha < 0) throw new Error('Registro não encontrado: ' + id);

    var atuais = s.getRange(linha, 1, 1, d.colunas.length).getValues()[0];
    var obj = {};
    for (var c = 0; c < d.colunas.length; c++) obj[d.colunas[c]] = normalizar(atuais[c]);

    Object.keys(patch || {}).forEach(function (k) {
      if (d.colunas.indexOf(k) >= 0) obj[k] = patch[k];
    });
    obj.id = id;
    obj.atualizadoEm = hoje();
    validar(entidade, obj);

    s.getRange(linha, 1, 1, d.colunas.length).setValues([linhaDe(obj, d.colunas)]);
    return obj;
  } finally {
    lock.releaseLock();
  }
}

function excluir(entidade, id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var s = aba(entidade);
    var linha = encontrarLinha(s, id);
    if (linha > 0) s.deleteRow(linha);
    return { id: id, removido: linha > 0 };
  } finally {
    lock.releaseLock();
  }
}

function excluirOnde(entidade, campo, valor) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var d = def(entidade);
    var s = aba(entidade);
    var idx = d.colunas.indexOf(campo);
    if (idx < 0) throw new Error('Campo inexistente: ' + campo);
    var ultima = s.getLastRow();
    if (ultima < 2) return { removidos: 0 };

    var valores = s.getRange(2, 1, ultima - 1, d.colunas.length).getValues();
    var n = 0;
    // de baixo para cima para os índices não mudarem
    for (var i = valores.length - 1; i >= 0; i--) {
      if (String(valores[i][idx]) === String(valor)) { s.deleteRow(i + 2); n++; }
    }
    return { removidos: n };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   Validação — o frontend valida, o backend confirma
   ============================================================ */

function validar(entidade, obj) {
  var exigir = function (campo, msg) {
    if (obj[campo] === '' || obj[campo] === null || obj[campo] === undefined) throw new Error(msg);
  };
  var numero = function (campo) {
    if (obj[campo] === '' || obj[campo] === undefined || obj[campo] === null) return;
    var n = Number(String(obj[campo]).replace(',', '.'));
    if (isNaN(n)) throw new Error('Valor numérico inválido em "' + campo + '"');
    obj[campo] = n;
  };
  var data = function (campo) {
    if (!obj[campo]) return;
    var v = normalizar(obj[campo]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new Error('Data inválida em "' + campo + '": ' + v);
    obj[campo] = v;
  };

  switch (entidade) {
    case 'transacoes':
      exigir('descricao', 'Descrição é obrigatória');
      exigir('data', 'Data é obrigatória');
      numero('valor'); numero('parcelaNum'); numero('parcelaTotal');
      data('data'); data('recorrenciaFim');
      if (Number(obj.valor) < 0) throw new Error('O valor não pode ser negativo');
      if (obj.tipo !== 'receita' && obj.tipo !== 'despesa') obj.tipo = 'despesa';
      if (['pago', 'pendente'].indexOf(obj.status) < 0) obj.status = 'pago';
      break;
    case 'assinaturas':
      exigir('nome', 'Nome da assinatura é obrigatório');
      numero('valor'); data('dataInicio'); data('proximaCobranca');
      break;
    case 'compras':
      exigir('produto', 'Produto é obrigatório');
      numero('valorTotal'); numero('parcelas'); numero('valorParcela');
      data('dataCompra'); data('primeiraParcela');
      break;
    case 'cartoes':
      exigir('nome', 'Nome do cartão é obrigatório');
      numero('limite'); numero('diaFechamento'); numero('diaVencimento');
      if (obj.final && !/^\d{0,4}$/.test(String(obj.final))) throw new Error('Use no máximo os 4 últimos dígitos do cartão');
      break;
    case 'contas':
      exigir('nome', 'Nome da conta é obrigatório');
      numero('saldoInicial');
      break;
    case 'contasFixas':
      exigir('nome', 'Nome da conta é obrigatório');
      numero('valor'); numero('diaVencimento');
      data('dataInicio'); data('dataFim');
      break;
    case 'metas':
      exigir('nome', 'Nome da meta é obrigatório');
      numero('valorMeta'); numero('valorAtual'); data('prazo');
      break;
    case 'orcamentos':
      exigir('categoria', 'Categoria é obrigatória');
      numero('limite');
      break;
    case 'categorias':
      exigir('nome', 'Nome da categoria é obrigatório');
      break;
  }
  return obj;
}

/* ============================================================
   Utilitários manuais (execute pelo editor, se precisar)
   ============================================================ */

/** Apaga TODOS os dados das abas, mantendo os cabeçalhos. */
function limparTudo() {
  Object.keys(ABAS).forEach(function (chave) {
    var s = aba(chave);
    var ultima = s.getLastRow();
    if (ultima > 1) s.deleteRows(2, ultima - 1);
  });
  return 'ok';
}

/** Teste rápido do fluxo completo, útil após a instalação. */
function testar() {
  var t = criar('transacoes', {
    tipo: 'despesa', descricao: 'Teste de integração', valor: 12.34,
    categoria: 'outros', data: hoje(), status: 'pago'
  });
  Logger.log('criado: ' + t.id);
  atualizar('transacoes', t.id, { valor: 56.78 });
  Logger.log('total de transações: ' + ler('transacoes').length);
  excluir('transacoes', t.id);
  Logger.log('teste concluído com sucesso');
  return 'ok';
}
