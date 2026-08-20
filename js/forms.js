/* ============================================================
   forms.js — construtor declarativo de formulários + os
   formulários de cada entidade.

   Um formulário é uma lista de campos; o construtor cuida de
   render, dependências (mostrarSe), validação e leitura.
   ============================================================ */

CF.forms = (function () {
  const U = CF.utils;

  /* ============================================================
     Construtor
     ============================================================ */

  function campoHTML(c, valores) {
    const val = valores[c.nome] ?? c.padrao ?? '';
    const largura = c.largura === 'cheia' ? 'grid-column:1/-1' : '';
    const label = c.label ? `<label class="field-label" for="f-${c.nome}">${U.esc(c.label)}${c.obrigatorio ? ' <span class="req">*</span>' : ''}</label>` : '';
    let controle = '';

    switch (c.tipo) {
      case 'moeda':
        controle = `<div class="input-prefix">
            <span class="prefix">R$</span>
            <input class="input input-money" id="f-${c.nome}" name="${c.nome}" type="text"
                   inputmode="decimal" autocomplete="off" placeholder="0,00"
                   value="${val === '' || val == null ? '' : U.number(val)}">
          </div>`;
        break;

      case 'numero':
        controle = `<input class="input num" id="f-${c.nome}" name="${c.nome}" type="number"
                     inputmode="numeric" ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''}
                     step="${c.step || 1}" value="${U.esc(val)}">`;
        break;

      case 'data':
        controle = `<input class="input" id="f-${c.nome}" name="${c.nome}" type="date" value="${U.esc(val)}">`;
        break;

      case 'select': {
        const ops = typeof c.opcoes === 'function' ? c.opcoes(valores) : c.opcoes;
        controle = `<select class="select" id="f-${c.nome}" name="${c.nome}">
            ${c.vazio ? `<option value="">${U.esc(c.vazio)}</option>` : ''}
            ${ops.map(o => `<option value="${U.esc(o.id)}" ${String(o.id) === String(val) ? 'selected' : ''}>${U.esc(o.nome)}</option>`).join('')}
          </select>`;
        break;
      }

      case 'segmented': {
        const ops = typeof c.opcoes === 'function' ? c.opcoes(valores) : c.opcoes;
        controle = `<div class="segmented full" data-seg="${c.nome}">
            ${ops.map(o => `<button type="button" data-val="${U.esc(o.id)}" class="${String(o.id) === String(val) ? 'is-active' : ''}">${U.esc(o.nome)}</button>`).join('')}
            <input type="hidden" name="${c.nome}" id="f-${c.nome}" value="${U.esc(val)}">
          </div>`;
        break;
      }

      case 'switch':
        controle = `<label class="switch">
            <input type="checkbox" name="${c.nome}" id="f-${c.nome}" ${val ? 'checked' : ''}>
            <span class="switch-track"></span>
            <span class="small">${U.esc(c.textoSwitch || '')}</span>
          </label>`;
        break;

      case 'textarea':
        controle = `<textarea class="textarea" id="f-${c.nome}" name="${c.nome}" rows="3"
                      placeholder="${U.esc(c.placeholder || '')}">${U.esc(val)}</textarea>`;
        break;

      case 'cor': {
        const temas = CF.catalog.CARD_THEMES;
        controle = `<div class="option-grid" data-cores="${c.nome}">
            ${temas.map(t => `<button type="button" class="option-card ${t.id === val ? 'is-active' : ''}" data-val="${t.id}">
              <span style="width:22px;height:22px;border-radius:6px;background:${t.css}"></span>${t.nome}</button>`).join('')}
            <input type="hidden" name="${c.nome}" id="f-${c.nome}" value="${U.esc(val || temas[0].id)}">
          </div>`;
        break;
      }

      case 'nota':
        controle = `<div class="alert" data-nota="${c.nome}">${c.calc ? c.calc(valores) : ''}</div>`;
        break;

      default:
        controle = `<input class="input" id="f-${c.nome}" name="${c.nome}" type="text"
                     autocomplete="off" placeholder="${U.esc(c.placeholder || '')}" value="${U.esc(val)}"
                     ${c.maxlength ? `maxlength="${c.maxlength}"` : ''}>`;
    }

    return `<div class="field" data-campo="${c.nome}" style="${largura}">
      ${label}${controle}
      ${c.hint ? `<span class="field-hint">${U.esc(c.hint)}</span>` : ''}
      <span class="field-error"></span>
    </div>`;
  }

  function formHTML(campos, valores) {
    return `<form class="grid grid-2" id="cf-form" novalidate>
      ${campos.map(c => campoHTML(c, valores)).join('')}
    </form>`;
  }

  /** Lê os valores atuais do formulário já convertidos por tipo. */
  function lerValores(form, campos) {
    const out = {};
    for (const c of campos) {
      if (c.tipo === 'nota') continue;
      const el = form.querySelector(`[name="${c.nome}"]`);
      if (!el) continue;
      if (c.tipo === 'moeda') out[c.nome] = U.parseMoney(el.value);
      else if (c.tipo === 'numero') out[c.nome] = el.value === '' ? null : Number(el.value);
      else if (c.tipo === 'switch') out[c.nome] = el.checked;
      else out[c.nome] = el.value;
    }
    return out;
  }

  function validar(form, campos, valores) {
    let ok = true;
    form.querySelectorAll('.field').forEach(f => f.classList.remove('has-error'));

    for (const c of campos) {
      if (c.tipo === 'nota') continue;
      const wrap = form.querySelector(`[data-campo="${c.nome}"]`);
      if (!wrap || wrap.classList.contains('hidden')) continue;
      const v = valores[c.nome];
      let erro = '';

      if (c.obrigatorio && (v === '' || v == null || (c.tipo === 'moeda' && !v))) {
        erro = c.tipo === 'moeda' ? 'Informe um valor maior que zero.' : 'Campo obrigatório.';
      } else if (c.tipo === 'moeda' && v < 0) {
        erro = 'O valor não pode ser negativo.';
      } else if (c.tipo === 'data' && v && !U.isValidDate(v)) {
        erro = 'Data inválida.';
      } else if (c.valida) {
        erro = c.valida(v, valores) || '';
      }

      if (erro) {
        ok = false;
        wrap.classList.add('has-error');
        wrap.querySelector('.field-error').textContent = erro;
      }
    }
    return ok;
  }

  /**
   * abrir({ titulo, subtitulo, campos, valores, salvarTexto, tamanho, aoSalvar })
   * aoSalvar recebe os valores validados e deve retornar Promise.
   */
  function abrir(opts) {
    const campos = opts.campos;
    let valores = Object.assign({}, ...campos.map(c => ({ [c.nome]: c.padrao ?? '' })), opts.valores || {});

    const modal = CF.ui.abrirModal({
      titulo: opts.titulo,
      subtitulo: opts.subtitulo,
      tamanho: opts.tamanho,
      corpo: formHTML(campos, valores),
      rodape: `
        ${opts.extraRodape || ''}
        <button class="btn btn-ghost" data-modal-close>Cancelar</button>
        <button class="btn btn-primary" data-salvar><i data-lucide="check" class="icon"></i>${U.esc(opts.salvarTexto || 'Salvar')}</button>`
    });

    const form = modal.querySelector('#cf-form');

    /* ---- reatividade ---- */
    function sync() {
      valores = lerValores(form, campos);

      for (const c of campos) {
        const wrap = form.querySelector(`[data-campo="${c.nome}"]`);
        if (!wrap) continue;

        if (c.mostrarSe) wrap.classList.toggle('hidden', !c.mostrarSe(valores));

        // selects com opções dinâmicas
        if (c.tipo === 'select' && typeof c.opcoes === 'function') {
          const sel = wrap.querySelector('select');
          const ops = c.opcoes(valores);
          const assinatura = ops.map(o => o.id).join('|');
          if (sel.dataset.assinatura !== assinatura) {
            sel.dataset.assinatura = assinatura;
            const anterior = sel.value;
            sel.innerHTML = (c.vazio ? `<option value="">${U.esc(c.vazio)}</option>` : '')
              + ops.map(o => `<option value="${U.esc(o.id)}">${U.esc(o.nome)}</option>`).join('');
            sel.value = ops.some(o => String(o.id) === anterior) ? anterior : (c.vazio ? '' : (ops[0]?.id ?? ''));
          }
        }

        if (c.tipo === 'nota' && c.calc) {
          wrap.querySelector('[data-nota]').innerHTML = c.calc(valores);
          U.icons(wrap);
        }
      }

      opts.aoMudar?.(valores, form);
    }

    form.addEventListener('input', sync);
    form.addEventListener('change', sync);

    // grupos segmentados
    form.querySelectorAll('[data-seg]').forEach(seg => {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-val]');
        if (!b) return;
        seg.querySelectorAll('button').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        seg.querySelector('input').value = b.dataset.val;
        sync();
      });
    });

    // seletor de cor
    form.querySelectorAll('[data-cores]').forEach(g => {
      g.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-val]');
        if (!b) return;
        g.querySelectorAll('.option-card').forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active');
        g.querySelector('input').value = b.dataset.val;
        sync();
      });
    });

    // formata campos de moeda ao sair
    form.querySelectorAll('.input-money').forEach(inp => {
      inp.addEventListener('blur', () => {
        const n = U.parseMoney(inp.value);
        inp.value = n ? U.number(n) : '';
      });
    });

    sync();
    U.icons(modal);

    /* ---- salvar ---- */
    const btnSalvar = modal.querySelector('[data-salvar]');

    async function salvar() {
      const v = lerValores(form, campos);
      // limpa campos escondidos para não gravar lixo
      for (const c of campos) {
        const wrap = form.querySelector(`[data-campo="${c.nome}"]`);
        if (wrap?.classList.contains('hidden')) v[c.nome] = c.tipo === 'moeda' || c.tipo === 'numero' ? null : '';
      }
      if (!validar(form, campos, v)) {
        CF.ui.aviso('Revise os campos destacados.');
        return;
      }
      CF.ui.ocupado(btnSalvar, true);
      try {
        await opts.aoSalvar(v);
        CF.ui.fecharModal();
      } catch (e) {
        console.error(e);
        CF.ui.erro(e.message || 'Não foi possível salvar. Tente novamente.');
      } finally {
        CF.ui.ocupado(btnSalvar, false);
      }
    }

    btnSalvar.addEventListener('click', salvar);
    form.addEventListener('submit', (e) => { e.preventDefault(); salvar(); });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); salvar(); }
    });

    return { modal, form, sync };
  }

  /* ============================================================
     Fontes de opções
     ============================================================ */

  const opCategorias = (tipo) => () => CF.catalog.categorias(tipo).map(c => ({ id: c.id, nome: c.nome }));
  const opSubcategorias = (tipoFn) => (v) => {
    const cat = CF.catalog.categoria(v.categoria, typeof tipoFn === 'function' ? tipoFn(v) : tipoFn);
    return (cat.subs || []).map(s => ({ id: s, nome: s }));
  };
  const opCartoes = () => CF.store.state.cartoes.filter(c => c.ativo !== false).map(c => ({ id: c.id, nome: `${c.nome} •••• ${c.final || '----'}` }));
  const opContas = () => CF.store.state.contas.filter(c => c.ativo !== false).map(c => ({ id: c.id, nome: `${c.nome}${c.instituicao && c.instituicao !== '—' ? ' — ' + c.instituicao : ''}` }));
  const opPagamentos = () => CF.catalog.PAGAMENTOS.map(p => ({ id: p.id, nome: p.nome }));
  const opRecorrencias = () => CF.catalog.RECORRENCIAS.map(r => ({ id: r.id, nome: r.nome }));
  const opPeriodicidades = () => CF.catalog.PERIODICIDADES.map(r => ({ id: r.id, nome: r.nome }));

  const usaCartao = (v) => v.formaPagamento === 'credito';

  /* ============================================================
     Formulários por entidade
     ============================================================ */

  /* ---- Transação (despesa / receita) ---- */
  function transacao(tipo, registro, presets = {}) {
    const ed = Boolean(registro);
    const receita = tipo === 'receita';

    const campos = [
      { nome: 'descricao', label: 'Descrição', tipo: 'texto', obrigatorio: true, largura: 'cheia',
        placeholder: receita ? 'Ex.: Salário de agosto' : 'Ex.: Mercado do mês' },
      { nome: 'valor', label: 'Valor', tipo: 'moeda', obrigatorio: true },
      { nome: 'data', label: 'Data', tipo: 'data', obrigatorio: true, padrao: U.today() },
      { nome: 'categoria', label: 'Categoria', tipo: 'select', obrigatorio: true, opcoes: opCategorias(tipo) },
      { nome: 'subcategoria', label: 'Subcategoria', tipo: 'select', vazio: 'Nenhuma', opcoes: opSubcategorias(tipo),
        mostrarSe: (v) => (CF.catalog.categoria(v.categoria, tipo).subs || []).length > 0 },
      { nome: 'formaPagamento', label: receita ? 'Forma de recebimento' : 'Forma de pagamento', tipo: 'select',
        opcoes: opPagamentos, padrao: receita ? 'transferencia' : 'pix' },
      { nome: 'cartaoId', label: 'Cartão', tipo: 'select', vazio: 'Selecione…', opcoes: opCartoes, mostrarSe: usaCartao },
      { nome: 'contaId', label: 'Conta', tipo: 'select', vazio: 'Nenhuma', opcoes: opContas, mostrarSe: (v) => !usaCartao(v) },
      { nome: 'status', label: receita ? 'Já foi recebida?' : 'Já foi paga?', tipo: 'segmented', padrao: 'pago',
        opcoes: [{ id: 'pago', nome: receita ? 'Recebida' : 'Paga' }, { id: 'pendente', nome: 'Ainda não' }] },
      { nome: 'recorrencia', label: 'Recorrência', tipo: 'select', opcoes: opRecorrencias, padrao: 'unica',
        hint: 'Lançamentos futuros são gerados automaticamente.' },
      { nome: 'recorrenciaFim', label: 'Repetir até', tipo: 'data', mostrarSe: (v) => v.recorrencia && v.recorrencia !== 'unica' },
      { nome: 'observacao', label: 'Observação', tipo: 'textarea', largura: 'cheia', placeholder: 'Opcional' }
    ];

    abrir({
      titulo: ed ? `Editar ${receita ? 'receita' : 'despesa'}` : `Nova ${receita ? 'receita' : 'despesa'}`,
      subtitulo: ed ? registro.id : (receita ? 'Registre uma entrada de dinheiro' : 'Registre uma saída de dinheiro'),
      campos,
      valores: Object.assign({ categoria: receita ? 'salario' : 'outros' }, registro || {}, presets),
      salvarTexto: ed ? 'Salvar alterações' : 'Adicionar',
      aoSalvar: async (v) => {
        await CF.store.salvarTransacao(Object.assign({ tipo }, v), registro?.id);
        CF.ui.ok(ed ? 'Lançamento atualizado.' : `${receita ? 'Receita' : 'Despesa'} adicionada com sucesso.`);
      }
    });
  }

  /* ---- Assinatura ---- */
  function assinatura(registro) {
    const ed = Boolean(registro);
    const campos = [
      { nome: 'nome', label: 'Nome do serviço', tipo: 'texto', obrigatorio: true, largura: 'cheia', placeholder: 'Ex.: Netflix' },
      { nome: 'valor', label: 'Valor', tipo: 'moeda', obrigatorio: true },
      { nome: 'periodicidade', label: 'Periodicidade', tipo: 'select', opcoes: opPeriodicidades, padrao: 'mensal' },
      { nome: 'categoria', label: 'Categoria', tipo: 'select', obrigatorio: true, opcoes: opCategorias('despesa'), padrao: 'assinaturas' },
      { nome: 'status', label: 'Status', tipo: 'select', padrao: 'ativa',
        opcoes: CF.catalog.STATUS_ASSINATURA.map(s => ({ id: s.id, nome: s.nome })) },
      { nome: 'formaPagamento', label: 'Forma de pagamento', tipo: 'select', opcoes: opPagamentos, padrao: 'credito' },
      { nome: 'cartaoId', label: 'Cartão', tipo: 'select', vazio: 'Selecione…', opcoes: opCartoes, mostrarSe: usaCartao },
      { nome: 'contaId', label: 'Conta', tipo: 'select', vazio: 'Nenhuma', opcoes: opContas, mostrarSe: (v) => !usaCartao(v) },
      { nome: 'dataInicio', label: 'Data de início', tipo: 'data', obrigatorio: true, padrao: U.today() },
      { nome: 'proximaCobranca', label: 'Próxima cobrança', tipo: 'data', obrigatorio: true, padrao: U.today() },
      { nome: 'observacao', label: 'Observação', tipo: 'textarea', largura: 'cheia', placeholder: 'Opcional' }
    ];

    abrir({
      titulo: ed ? 'Editar assinatura' : 'Nova assinatura',
      subtitulo: ed ? registro.id : 'Serviços recorrentes geram cobranças automaticamente',
      campos,
      valores: registro || {},
      salvarTexto: ed ? 'Salvar alterações' : 'Adicionar assinatura',
      aoSalvar: async (v) => {
        await CF.store.salvarAssinatura(v, registro?.id);
        CF.ui.ok(ed ? 'Assinatura atualizada.' : 'Assinatura adicionada com sucesso.');
      }
    });
  }

  /* ---- Compra (avulsa / parcelada) ---- */
  function compra(registro, tipoInicial) {
    const ed = Boolean(registro);
    const parcelada = (v) => v.tipo === 'parcelada';

    const campos = [
      { nome: 'tipo', label: 'Tipo de compra', tipo: 'segmented', largura: 'cheia', padrao: tipoInicial || 'avulsa',
        opcoes: [{ id: 'avulsa', nome: 'Compra avulsa' }, { id: 'parcelada', nome: 'Compra parcelada' }] },
      { nome: 'produto', label: 'Produto / descrição', tipo: 'texto', obrigatorio: true, largura: 'cheia', placeholder: 'Ex.: Notebook Dell' },
      { nome: 'valorTotal', label: 'Valor total', tipo: 'moeda', obrigatorio: true },
      { nome: 'parcelas', label: 'Quantidade de parcelas', tipo: 'numero', min: 1, max: 72, padrao: 1,
        mostrarSe: parcelada, valida: (v) => (v && v >= 1 ? '' : 'Informe ao menos 1 parcela.') },
      { nome: 'resumoParcelas', tipo: 'nota', largura: 'cheia', mostrarSe: parcelada,
        calc: (v) => {
          const n = Math.max(1, Number(v.parcelas) || 1);
          const total = Number(v.valorTotal) || 0;
          const fim = U.addMonths(v.primeiraParcela || v.dataCompra || U.today(), n - 1);
          return `<i data-lucide="info" class="icon"></i><span><b>${n}x de ${U.money(total / n)}</b> — última parcela em ${U.fmtDate(fim)}.</span>`;
        } },
      { nome: 'dataCompra', label: 'Data da compra', tipo: 'data', obrigatorio: true, padrao: U.today() },
      { nome: 'primeiraParcela', label: 'Primeira parcela', tipo: 'data', padrao: U.today(), mostrarSe: parcelada },
      { nome: 'categoria', label: 'Categoria', tipo: 'select', obrigatorio: true, opcoes: opCategorias('despesa'), padrao: 'compras' },
      { nome: 'loja', label: 'Loja / local', tipo: 'texto', placeholder: 'Ex.: Kabum' },
      { nome: 'formaPagamento', label: 'Forma de pagamento', tipo: 'select', opcoes: opPagamentos, padrao: 'credito' },
      { nome: 'cartaoId', label: 'Cartão', tipo: 'select', vazio: 'Selecione…', opcoes: opCartoes, mostrarSe: usaCartao },
      { nome: 'contaId', label: 'Conta', tipo: 'select', vazio: 'Nenhuma', opcoes: opContas, mostrarSe: (v) => !usaCartao(v) },
      { nome: 'observacao', label: 'Observação', tipo: 'textarea', largura: 'cheia', placeholder: 'Opcional' }
    ];

    abrir({
      titulo: ed ? 'Editar compra' : 'Nova compra',
      subtitulo: ed ? registro.id : 'As parcelas são lançadas automaticamente no extrato',
      campos,
      valores: registro || {},
      salvarTexto: ed ? 'Salvar alterações' : 'Registrar compra',
      aoSalvar: async (v) => {
        const n = v.tipo === 'parcelada' ? Math.max(1, Number(v.parcelas) || 1) : 1;
        const dados = Object.assign({}, v, {
          parcelas: n,
          valorParcela: U.round2((Number(v.valorTotal) || 0) / n),
          primeiraParcela: v.tipo === 'parcelada' ? (v.primeiraParcela || v.dataCompra) : v.dataCompra
        });
        delete dados.resumoParcelas;
        if (ed) await CF.store.atualizarCompra(registro.id, dados);
        else await CF.store.criarCompra(dados);
        CF.ui.ok(ed ? 'Compra atualizada.' : `Compra registrada${n > 1 ? ` em ${n}x` : ''}.`);
      }
    });
  }

  /* ---- Conta fixa ---- */
  function contaFixa(registro) {
    const ed = Boolean(registro);
    const campos = [
      { nome: 'nome', label: 'Nome da conta', tipo: 'texto', obrigatorio: true, largura: 'cheia', placeholder: 'Ex.: Energia elétrica' },
      { nome: 'valor', label: 'Valor', tipo: 'moeda', obrigatorio: true },
      { nome: 'diaVencimento', label: 'Dia do vencimento', tipo: 'numero', min: 1, max: 31, padrao: 10, obrigatorio: true },
      { nome: 'categoria', label: 'Categoria', tipo: 'select', obrigatorio: true, opcoes: opCategorias('despesa'), padrao: 'contas' },
      { nome: 'recorrencia', label: 'Recorrência', tipo: 'select', opcoes: opPeriodicidades, padrao: 'mensal' },
      { nome: 'formaPagamento', label: 'Forma de pagamento', tipo: 'select', opcoes: opPagamentos, padrao: 'boleto' },
      { nome: 'cartaoId', label: 'Cartão', tipo: 'select', vazio: 'Selecione…', opcoes: opCartoes, mostrarSe: usaCartao },
      { nome: 'contaId', label: 'Conta de débito', tipo: 'select', vazio: 'Nenhuma', opcoes: opContas, mostrarSe: (v) => !usaCartao(v) },
      { nome: 'dataInicio', label: 'Início', tipo: 'data', padrao: U.monthStart(U.monthOf(U.today())) },
      { nome: 'dataFim', label: 'Fim (opcional)', tipo: 'data' },
      { nome: 'status', label: 'Status', tipo: 'segmented', padrao: 'ativa',
        opcoes: [{ id: 'ativa', nome: 'Ativa' }, { id: 'pausada', nome: 'Pausada' }] },
      { nome: 'observacao', label: 'Observação', tipo: 'textarea', largura: 'cheia', placeholder: 'Opcional' }
    ];

    abrir({
      titulo: ed ? 'Editar conta fixa' : 'Nova conta fixa',
      subtitulo: ed ? registro.id : 'Gera automaticamente a conta a pagar de cada período',
      campos,
      valores: registro || {},
      salvarTexto: ed ? 'Salvar alterações' : 'Adicionar conta',
      aoSalvar: async (v) => {
        await CF.store.salvarContaFixa(v, registro?.id);
        CF.ui.ok(ed ? 'Conta atualizada.' : 'Conta fixa adicionada.');
      }
    });
  }

  /* ---- Cartão ---- */
  function cartao(registro) {
    const ed = Boolean(registro);
    const campos = [
      { nome: 'nome', label: 'Nome do cartão', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Nubank Ultravioleta' },
      { nome: 'banco', label: 'Banco / emissor', tipo: 'texto', placeholder: 'Ex.: Nubank' },
      { nome: 'limite', label: 'Limite total', tipo: 'moeda', obrigatorio: true },
      { nome: 'final', label: 'Final do cartão', tipo: 'texto', maxlength: 4, placeholder: '0000',
        hint: 'Somente os 4 últimos dígitos. Nunca guarde o número completo nem o CVV.',
        valida: (v) => (!v || /^\d{0,4}$/.test(v) ? '' : 'Use no máximo 4 dígitos.') },
      { nome: 'diaFechamento', label: 'Dia de fechamento', tipo: 'numero', min: 1, max: 31, padrao: 20, obrigatorio: true },
      { nome: 'diaVencimento', label: 'Dia de vencimento', tipo: 'numero', min: 1, max: 31, padrao: 27, obrigatorio: true },
      { nome: 'cor', label: 'Cor do cartão', tipo: 'cor', largura: 'cheia', padrao: 'roxo' },
      { nome: 'ativo', label: 'Cartão ativo', tipo: 'switch', padrao: true, textoSwitch: 'Aparece nas listas e seletores' }
    ];

    abrir({
      titulo: ed ? 'Editar cartão' : 'Novo cartão',
      subtitulo: ed ? registro.id : 'Usado para calcular faturas e limite disponível',
      campos,
      valores: registro || {},
      salvarTexto: ed ? 'Salvar alterações' : 'Adicionar cartão',
      aoSalvar: async (v) => {
        if (ed) await CF.store.atualizar('cartoes', registro.id, v);
        else await CF.store.criar('cartoes', v);
        CF.ui.ok(ed ? 'Cartão atualizado.' : 'Cartão adicionado.');
      }
    });
  }

  /* ---- Conta bancária / carteira ---- */
  function conta(registro) {
    const ed = Boolean(registro);
    const campos = [
      { nome: 'nome', label: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Conta digital' },
      { nome: 'instituicao', label: 'Instituição', tipo: 'texto', placeholder: 'Ex.: Nubank' },
      { nome: 'tipo', label: 'Tipo', tipo: 'select', padrao: 'digital',
        opcoes: CF.catalog.TIPOS_CONTA.map(t => ({ id: t.id, nome: t.nome })) },
      { nome: 'saldoInicial', label: 'Saldo inicial', tipo: 'moeda', hint: 'Saldo no momento em que você começou a usar o sistema.' },
      { nome: 'cor', label: 'Cor', tipo: 'cor', largura: 'cheia', padrao: 'indigo' },
      { nome: 'ativo', label: 'Conta ativa', tipo: 'switch', padrao: true, textoSwitch: 'Entra no cálculo do saldo' }
    ];

    abrir({
      titulo: ed ? 'Editar conta' : 'Nova conta',
      campos,
      valores: registro || {},
      salvarTexto: ed ? 'Salvar alterações' : 'Adicionar conta',
      aoSalvar: async (v) => {
        const dados = Object.assign({}, v, { cor: CF.catalog.cardTheme(v.cor).css });
        if (ed) await CF.store.atualizar('contas', registro.id, dados);
        else await CF.store.criar('contas', dados);
        CF.ui.ok(ed ? 'Conta atualizada.' : 'Conta adicionada.');
      }
    });
  }

  /* ---- Meta ---- */
  function meta(registro) {
    const ed = Boolean(registro);
    const ICONES = ['target', 'plane', 'laptop', 'house', 'car-front', 'graduation-cap', 'shield-check', 'gift', 'heart', 'piggy-bank'];
    const campos = [
      { nome: 'nome', label: 'Nome da meta', tipo: 'texto', obrigatorio: true, largura: 'cheia', placeholder: 'Ex.: Viagem para o Chile' },
      { nome: 'valorMeta', label: 'Valor da meta', tipo: 'moeda', obrigatorio: true },
      { nome: 'valorAtual', label: 'Já guardado', tipo: 'moeda' },
      { nome: 'prazo', label: 'Prazo', tipo: 'data' },
      { nome: 'tipo', label: 'Tipo', tipo: 'select', padrao: 'meta',
        opcoes: [{ id: 'meta', nome: 'Meta' }, { id: 'reserva', nome: 'Reserva de emergência' }] },
      { nome: 'icone', label: 'Ícone', tipo: 'select', padrao: 'target', opcoes: ICONES.map(i => ({ id: i, nome: i })) },
      { nome: 'observacao', label: 'Observação', tipo: 'textarea', largura: 'cheia', placeholder: 'Opcional' }
    ];

    abrir({
      titulo: ed ? 'Editar meta' : 'Nova meta',
      campos,
      valores: registro || {},
      salvarTexto: ed ? 'Salvar alterações' : 'Criar meta',
      aoSalvar: async (v) => {
        const dados = Object.assign({}, v, { cor: registro?.cor || U.colorFrom(v.nome) });
        if (ed) await CF.store.atualizar('metas', registro.id, dados);
        else await CF.store.criar('metas', dados);
        CF.ui.ok(ed ? 'Meta atualizada.' : 'Meta criada.');
      }
    });
  }

  /* ---- Orçamento ---- */
  function orcamento(registro) {
    const ed = Boolean(registro);
    const campos = [
      { nome: 'categoria', label: 'Categoria', tipo: 'select', obrigatorio: true, opcoes: opCategorias('despesa') },
      { nome: 'limite', label: 'Limite mensal', tipo: 'moeda', obrigatorio: true },
      { nome: 'mes', label: 'Aplicar apenas em', tipo: 'texto', placeholder: 'AAAA-MM (vazio = todos os meses)',
        hint: 'Deixe vazio para valer todo mês.',
        valida: (v) => (!v || /^\d{4}-\d{2}$/.test(v) ? '' : 'Use o formato AAAA-MM.') }
    ];

    abrir({
      titulo: ed ? 'Editar orçamento' : 'Novo orçamento',
      tamanho: 'sm',
      campos,
      valores: registro || {},
      salvarTexto: 'Salvar',
      aoSalvar: async (v) => {
        if (ed) await CF.store.atualizar('orcamentos', registro.id, v);
        else await CF.store.criar('orcamentos', v);
        CF.ui.ok('Orçamento salvo.');
      }
    });
  }

  /* ---- Categoria personalizada ---- */
  function categoria(registro) {
    const ed = Boolean(registro);
    const ICONES = ['circle', 'tag', 'coffee', 'utensils', 'car-front', 'house', 'heart-pulse', 'gamepad-2',
      'book', 'dumbbell', 'baby', 'wrench', 'scissors', 'camera', 'music', 'briefcase'];
    const campos = [
      { nome: 'nome', label: 'Nome', tipo: 'texto', obrigatorio: true },
      { nome: 'tipo', label: 'Tipo', tipo: 'segmented', padrao: 'despesa',
        opcoes: [{ id: 'despesa', nome: 'Despesa' }, { id: 'receita', nome: 'Receita' }] },
      { nome: 'icone', label: 'Ícone', tipo: 'select', padrao: 'tag', opcoes: ICONES.map(i => ({ id: i, nome: i })) },
      { nome: 'cor', label: 'Cor (hex)', tipo: 'texto', padrao: '#6366f1', placeholder: '#6366f1',
        valida: (v) => (!v || /^#[0-9a-fA-F]{6}$/.test(v) ? '' : 'Use um hex como #6366f1.') },
      { nome: 'subcategorias', label: 'Subcategorias', tipo: 'texto', largura: 'cheia',
        placeholder: 'Separadas por vírgula', hint: 'Ex.: Espresso, Grãos, Cápsulas' }
    ];

    abrir({
      titulo: ed ? 'Editar categoria' : 'Nova categoria',
      tamanho: 'sm',
      campos,
      valores: registro || {},
      salvarTexto: 'Salvar',
      aoSalvar: async (v) => {
        const dados = Object.assign({}, v, { id: registro?.id || U.norm(v.nome).replace(/\s+/g, '-') });
        if (ed) await CF.store.atualizar('categorias', registro.id, dados);
        else await CF.store.criar('categorias', dados);
        CF.ui.ok('Categoria salva.');
      }
    });
  }

  /* ---- Aporte rápido em meta ---- */
  function aporte(metaRegistro) {
    abrir({
      titulo: `Aporte em ${metaRegistro.nome}`,
      subtitulo: `Guardado: ${U.money(metaRegistro.valorAtual)} de ${U.money(metaRegistro.valorMeta)}`,
      tamanho: 'sm',
      campos: [
        { nome: 'valor', label: 'Valor do aporte', tipo: 'moeda', obrigatorio: true, largura: 'cheia' },
        { nome: 'registrarDespesa', label: 'Lançar como despesa em Investimentos', tipo: 'switch',
          largura: 'cheia', padrao: false, textoSwitch: 'Cria também um lançamento no extrato' }
      ],
      salvarTexto: 'Guardar',
      aoSalvar: async (v) => {
        await CF.store.atualizar('metas', metaRegistro.id, { valorAtual: U.round2(metaRegistro.valorAtual + v.valor) });
        if (v.registrarDespesa) {
          await CF.store.criarTransacao({
            tipo: 'despesa', descricao: `Aporte — ${metaRegistro.nome}`, valor: v.valor,
            categoria: 'investimentos', data: U.today(), formaPagamento: 'transferencia', status: 'pago'
          });
        }
        CF.ui.ok(`${U.money(v.valor)} guardados em ${metaRegistro.nome}.`);
      }
    });
  }

  return {
    abrir, campoHTML, formHTML, lerValores, validar,
    transacao, assinatura, compra, contaFixa, cartao, conta, meta, orcamento, categoria, aporte,
    opCategorias, opCartoes, opContas, opPagamentos, opRecorrencias
  };
})();
