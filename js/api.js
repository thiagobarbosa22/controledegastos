/* ============================================================
   api.js — camada de dados.

   Dois drivers com a MESMA interface:
     • local   → localStorage (modo demo / offline)
     • remoto  → Google Apps Script (Google Sheets como banco)

   Toda a aplicação fala só com CF.api, nunca com o driver.
   ============================================================ */

CF.api = (function () {

  const ENTIDADES = {
    transacoes:  { aba: 'Transacoes',  prefixo: 'TRX' },
    assinaturas: { aba: 'Assinaturas', prefixo: 'ASS' },
    compras:     { aba: 'Compras',     prefixo: 'COM' },
    cartoes:     { aba: 'Cartoes',     prefixo: 'CAR' },
    contas:      { aba: 'Contas',      prefixo: 'CTA' },
    contasFixas: { aba: 'ContasFixas', prefixo: 'CTF' },
    categorias:  { aba: 'Categorias',  prefixo: 'CAT' },
    metas:       { aba: 'Metas',       prefixo: 'MET' },
    orcamentos:  { aba: 'Orcamentos',  prefixo: 'ORC' }
  };

  const VAZIO = () => ({
    transacoes: [], assinaturas: [], compras: [], cartoes: [], contas: [],
    contasFixas: [], categorias: [], metas: [], orcamentos: [], config: {}
  });

  const CACHE_KEY = 'cf:cache';
  let modo = 'local';
  let ultimoErro = null;

  /* ============================================================
     Driver local — localStorage
     ============================================================ */
  const local = (function () {
    const KEY = 'cf:db';
    let db = null;

    function carregar() {
      if (db) return db;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) { db = Object.assign(VAZIO(), JSON.parse(raw)); return db; }
      } catch (e) { console.warn('[api] cache local inválido', e); }
      db = VAZIO();
      salvar();
      return db;
    }

    function salvar() {
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch (e) { console.warn('[api] falha ao gravar localStorage', e); }
    }

    const lista = (ent) => (carregar()[ent] = carregar()[ent] || []);

    return {
      nome: 'local',
      async bootstrap() { return JSON.parse(JSON.stringify(carregar())); },
      async create(ent, obj) {
        const novo = Object.assign({}, obj, {
          id: obj.id || CF.utils.id(ENTIDADES[ent].prefixo),
          criadoEm: obj.criadoEm || CF.utils.today(),
          atualizadoEm: CF.utils.today()
        });
        lista(ent).push(novo);
        salvar();
        return novo;
      },
      async createMany(ent, arr) {
        const criados = [];
        for (const o of arr) criados.push(await this.create(ent, o));
        return criados;
      },
      async update(ent, id, patch) {
        const arr = lista(ent);
        const i = arr.findIndex(x => x.id === id);
        if (i < 0) throw new Error(`Registro ${id} não encontrado`);
        arr[i] = Object.assign({}, arr[i], patch, { id, atualizadoEm: CF.utils.today() });
        salvar();
        return arr[i];
      },
      async remove(ent, id) {
        const arr = lista(ent);
        const i = arr.findIndex(x => x.id === id);
        if (i >= 0) arr.splice(i, 1);
        salvar();
        return { id };
      },
      async removeWhere(ent, campo, valor) {
        const arr = lista(ent);
        const restantes = arr.filter(x => x[campo] !== valor);
        const n = arr.length - restantes.length;
        carregar()[ent] = restantes;
        salvar();
        return { removidos: n };
      },
      async reset() {
        db = VAZIO();
        salvar();
        return JSON.parse(JSON.stringify(db));
      },
      async importar(dados) {
        db = Object.assign(VAZIO(), dados);
        salvar();
        return JSON.parse(JSON.stringify(db));
      }
    };
  })();

  /* ============================================================
     Driver remoto — Google Apps Script
     ============================================================ */
  const remoto = (function () {

    async function chamar(acao, payload = {}, tentativa = 0) {
      const url = CF.config.get('apiUrl');
      if (!url) throw new Error('URL da API não configurada');

      const corpo = JSON.stringify(Object.assign({ acao, apiKey: CF.config.get('apiKey') || '' }, payload));

      try {
        const resp = await fetch(url, {
          method: 'POST',
          // text/plain evita o preflight CORS que o Apps Script não responde
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: corpo,
          redirect: 'follow'
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        if (json.ok === false) throw new Error(json.erro || 'Erro no servidor');
        return json.dados;
      } catch (e) {
        // uma nova tentativa cobre o cold start do Apps Script
        if (tentativa < 1) return chamar(acao, payload, tentativa + 1);
        throw e;
      }
    }

    return {
      nome: 'remoto',
      bootstrap: () => chamar('bootstrap'),
      create: (ent, obj) => chamar('criar', { entidade: ent, dados: obj }),
      createMany: (ent, arr) => chamar('criarLote', { entidade: ent, dados: arr }),
      update: (ent, id, patch) => chamar('atualizar', { entidade: ent, id, dados: patch }),
      remove: (ent, id) => chamar('excluir', { entidade: ent, id }),
      removeWhere: (ent, campo, valor) => chamar('excluirOnde', { entidade: ent, campo, valor }),
      ping: () => chamar('ping'),
      chamar
    };
  })();

  /* ============================================================
     Fachada
     ============================================================ */

  const driver = () => (CF.config.remoto() ? remoto : local);

  function salvarSnapshot(db) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ em: Date.now(), db })); } catch {}
  }

  function lerSnapshot() {
    try {
      const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return raw?.db || null;
    } catch { return null; }
  }

  async function bootstrap() {
    const d = driver();
    modo = d.nome;
    ultimoErro = null;
    try {
      const db = Object.assign(VAZIO(), await d.bootstrap());
      if (d.nome === 'remoto') salvarSnapshot(db);
      return db;
    } catch (e) {
      ultimoErro = e.message || String(e);
      const cache = lerSnapshot();
      if (cache) { modo = 'offline'; return Object.assign(VAZIO(), cache); }
      throw e;
    }
  }

  const wrap = (metodo) => async (...args) => {
    const r = await driver()[metodo](...args);
    return r;
  };

  return {
    ENTIDADES,
    bootstrap,
    create: wrap('create'),
    createMany: wrap('createMany'),
    update: wrap('update'),
    remove: wrap('remove'),
    removeWhere: wrap('removeWhere'),
    local,
    remoto,
    salvarSnapshot,
    modo: () => modo,
    erro: () => ultimoErro,
    vazio: VAZIO
  };
})();
