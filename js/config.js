/* ============================================================
   config.js — preferências locais do usuário (localStorage)
   Nenhuma credencial fica no código: a URL da API e a chave são
   informadas pelo usuário na tela de Configurações.
   ============================================================ */

CF.config = (function () {
  const KEY = 'cf:config';

  const padrao = {
    apiUrl: '',            // URL do Web App do Google Apps Script
    apiKey: '',            // chave compartilhada opcional (validada no backend)
    tema: 'auto',          // auto | light | dark
    nome: '',              // usado na saudação do dashboard
    ocultarValores: false,
    inicioSemana: 0,
    alertaDiasVencimento: 5,
    reservaMeta: 20000
  };

  let atual = carregar();

  function carregar() {
    try {
      return Object.assign({}, padrao, JSON.parse(localStorage.getItem(KEY) || '{}'));
    } catch {
      return { ...padrao };
    }
  }

  function get(k) { return k ? atual[k] : { ...atual }; }

  function set(patch) {
    atual = Object.assign({}, atual, patch);
    try { localStorage.setItem(KEY, JSON.stringify(atual)); } catch {}
    document.dispatchEvent(new CustomEvent('cf:config', { detail: { ...atual } }));
    return { ...atual };
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch {}
    atual = { ...padrao };
    return { ...atual };
  }

  /** Há backend remoto configurado? */
  const remoto = () => Boolean(atual.apiUrl && /^https:\/\//.test(atual.apiUrl));

  return { get, set, reset, remoto, padrao };
})();
