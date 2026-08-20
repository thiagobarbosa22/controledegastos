/* ============================================================
   views/configuracoes.js — conexão com a planilha, preferências,
   categorias personalizadas e gestão de dados.
   ============================================================ */

CF.views = CF.views || {};

CF.views.configuracoes = (function () {
  const U = CF.utils;
  const S = () => CF.store;

  function render(el) {
    const cfg = CF.config.get();
    const st = S();
    const conectado = CF.config.remoto();
    const totais = {
      transacoes: st.state.transacoes.length,
      assinaturas: st.state.assinaturas.length,
      compras: st.state.compras.length,
      cartoes: st.state.cartoes.length,
      contas: st.state.contas.length,
      contasFixas: st.state.contasFixas.length,
      metas: st.state.metas.length,
      orcamentos: st.state.orcamentos.length,
      categorias: st.state.categorias.length
    };

    el.innerHTML = `
      <div class="view-head">
        <div>
          <div class="view-title">Configurações</div>
          <div class="view-sub">Conexão com a planilha, preferências e gestão de dados</div>
        </div>
      </div>

      <!-- ======= Conexão ======= -->
      <div class="card mb-4">
        <div class="card-header">
          <div>
            <div class="card-title">Banco de dados</div>
            <div class="card-sub">Google Sheets via Google Apps Script</div>
          </div>
          <span class="badge ${conectado ? 'badge-income' : 'badge-warning'} badge-dot">
            ${conectado ? 'Planilha conectada' : 'Modo local (navegador)'}</span>
        </div>

        <div class="grid grid-2">
          <div class="field" style="grid-column:1/-1">
            <label class="field-label">URL do Web App (Apps Script)</label>
            <input class="input" id="cfg-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${U.esc(cfg.apiUrl)}">
            <span class="field-hint">Publique o script como Web App e cole a URL aqui. Ela fica salva apenas neste dispositivo.</span>
          </div>
          <div class="field">
            <label class="field-label">Chave de acesso (opcional)</label>
            <input class="input" id="cfg-key" type="password" autocomplete="off" placeholder="••••••••" value="${U.esc(cfg.apiKey)}">
            <span class="field-hint">Se você definiu API_KEY no Code.gs, informe o mesmo valor.</span>
          </div>
          <div class="field">
            <label class="field-label">Seu nome (saudação)</label>
            <input class="input" id="cfg-nome" type="text" placeholder="Ex.: Thiago" value="${U.esc(cfg.nome)}">
          </div>
        </div>

        <div class="row gap-2 mt-4 wrap">
          <button class="btn btn-primary" data-act="salvar-conexao"><i data-lucide="save" class="icon"></i>Salvar e reconectar</button>
          <button class="btn btn-outline" data-act="testar"><i data-lucide="plug" class="icon"></i>Testar conexão</button>
          ${conectado ? `<button class="btn btn-ghost" data-act="desconectar"><i data-lucide="unplug" class="icon"></i>Voltar ao modo local</button>` : ''}
        </div>

        <div class="alert mt-4">
          <i data-lucide="shield" class="icon"></i>
          <span>Nenhuma senha, token privado ou número completo de cartão é armazenado. A URL e a chave ficam
          apenas no <code>localStorage</code> deste navegador e nunca são enviadas para terceiros.</span>
        </div>
      </div>

      <!-- ======= Preferências ======= -->
      <div class="card mb-4">
        <div class="card-header"><div class="card-title">Preferências</div></div>
        <div class="grid grid-2">
          <div class="field">
            <label class="field-label">Tema</label>
            <select class="select" id="cfg-tema">
              <option value="auto" ${cfg.tema === 'auto' ? 'selected' : ''}>Automático (sistema)</option>
              <option value="light" ${cfg.tema === 'light' ? 'selected' : ''}>Claro</option>
              <option value="dark" ${cfg.tema === 'dark' ? 'selected' : ''}>Escuro</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">Avisar sobre vencimentos com</label>
            <select class="select" id="cfg-alerta">
              ${[3, 5, 7, 10, 15].map(d => `<option value="${d}" ${Number(cfg.alertaDiasVencimento) === d ? 'selected' : ''}>${d} dias de antecedência</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- ======= Categorias ======= -->
      <div class="card mb-4">
        <div class="card-header">
          <div>
            <div class="card-title">Categorias personalizadas</div>
            <div class="card-sub">As categorias padrão do sistema continuam sempre disponíveis</div>
          </div>
          <button class="btn btn-outline btn-sm" data-act="nova-categoria"><i data-lucide="plus" class="icon-sm"></i>Nova categoria</button>
        </div>
        ${st.state.categorias.length ? `
          <div class="row gap-2 wrap">
            ${st.state.categorias.map(c => `
              <span class="chip" data-act="editar-categoria" data-id="${c.id}" style="cursor:pointer">
                <span class="legend-swatch" style="background:${c.cor || '#6366f1'}"></span>
                ${U.esc(c.nome)}
                <i data-lucide="pencil" class="icon-sm dim"></i>
              </span>`).join('')}
          </div>`
          : '<p class="muted small">Nenhuma categoria personalizada. As 18 categorias padrão já cobrem a maioria dos casos.</p>'}
      </div>

      <!-- ======= Dados ======= -->
      <div class="card mb-4">
        <div class="card-header">
          <div>
            <div class="card-title">Seus dados</div>
            <div class="card-sub">${Object.entries(totais).map(([k, v]) => `${v} ${k}`).join(' · ')}</div>
          </div>
        </div>

        <div class="grid grid-2 gap-3">
          <button class="quick-action" data-act="exportar-json" style="flex-direction:row;justify-content:flex-start;gap:14px">
            <span class="qa-ico"><i data-lucide="download" class="icon-lg"></i></span>
            <span style="text-align:left"><b style="display:block">Exportar backup</b>
              <span class="tiny dim">Baixa um arquivo JSON com tudo</span></span>
          </button>
          <button class="quick-action qa-info" data-act="importar-json" style="flex-direction:row;justify-content:flex-start;gap:14px">
            <span class="qa-ico"><i data-lucide="upload" class="icon-lg"></i></span>
            <span style="text-align:left"><b style="display:block">Importar backup</b>
              <span class="tiny dim">Restaura a partir de um JSON</span></span>
          </button>
          <button class="quick-action qa-warning" data-act="enviar-planilha" style="flex-direction:row;justify-content:flex-start;gap:14px">
            <span class="qa-ico"><i data-lucide="cloud-upload" class="icon-lg"></i></span>
            <span style="text-align:left"><b style="display:block">Enviar dados locais para a planilha</b>
              <span class="tiny dim">Copia o que está no navegador para o Google Sheets</span></span>
          </button>
          <button class="quick-action qa-expense" data-act="limpar" style="flex-direction:row;justify-content:flex-start;gap:14px">
            <span class="qa-ico"><i data-lucide="trash-2" class="icon-lg"></i></span>
            <span style="text-align:left"><b style="display:block">Apagar todos os dados locais</b>
              <span class="tiny dim">Recomeça do zero neste navegador</span></span>
          </button>
        </div>

        ${!conectado ? `
          <div class="alert is-warning mt-4">
            <i data-lucide="triangle-alert" class="icon"></i>
            <span>Seus dados estão salvos <b>apenas neste navegador</b>. Limpar o histórico do navegador
            apaga tudo. Conecte sua planilha do Google Sheets acima para não depender deste dispositivo.</span>
          </div>` : ''}
      </div>

      <!-- ======= Aplicativo ======= -->
      <div class="card">
        <div class="card-header"><div class="card-title">Aplicativo</div></div>
        <div class="col gap-3">
          <div class="row-between">
            <div><div class="bold small">Instalar como aplicativo</div>
              <div class="tiny dim">Adicione à tela inicial e abra sem a barra do navegador</div></div>
            <button class="btn btn-outline btn-sm" data-act="instalar"><i data-lucide="smartphone" class="icon-sm"></i>Instalar</button>
          </div>
          <div class="row-between">
            <div><div class="bold small">Recarregar dados</div>
              <div class="tiny dim">Busca tudo novamente da origem</div></div>
            <button class="btn btn-outline btn-sm" data-act="recarregar"><i data-lucide="refresh-cw" class="icon-sm"></i>Recarregar</button>
          </div>
          <div class="row-between">
            <div><div class="bold small">Origem atual dos dados</div>
              <div class="tiny dim">${conectado ? 'Google Sheets (Apps Script)' : 'Navegador (localStorage)'}
                ${CF.api.erro() ? ` · último erro: ${U.esc(CF.api.erro())}` : ''}</div></div>
            <span class="badge ${conectado ? 'badge-income' : 'badge-warning'}">${CF.api.modo()}</span>
          </div>
        </div>
      </div>

      <input type="file" id="arquivo-json" accept="application/json" class="hidden">`;

    U.icons(el);

    /* ---- preferências reagem na hora ---- */
    el.querySelector('#cfg-tema').addEventListener('change', (e) => {
      CF.config.set({ tema: e.target.value });
      CF.app.aplicarTema();
      CF.ui.ok('Tema atualizado.');
    });
    el.querySelector('#cfg-alerta').addEventListener('change', (e) => {
      CF.config.set({ alertaDiasVencimento: Number(e.target.value) });
      CF.ui.ok('Preferência salva.');
    });

    const arquivo = el.querySelector('#arquivo-json');
    arquivo.addEventListener('change', async () => {
      const f = arquivo.files[0];
      if (!f) return;
      try {
        const dados = JSON.parse(await f.text());
        const sim = await CF.ui.confirmar({
          titulo: 'Importar backup?',
          texto: 'Os dados atuais do modo local serão substituídos pelo conteúdo do arquivo.',
          confirmarTexto: 'Importar', perigo: true
        });
        if (!sim) return;
        await CF.api.local.importar(dados);
        await S().carregar();
        CF.ui.ok('Backup importado.');
      } catch (e) {
        CF.ui.erro('Arquivo inválido: ' + e.message);
      } finally {
        arquivo.value = '';
      }
    });

    return CF.ui.acoes(el, {
      'salvar-conexao': async (b) => {
        const url = el.querySelector('#cfg-url').value.trim();
        if (url && !/^https:\/\/script\.google\.com\//.test(url)) {
          return CF.ui.aviso('A URL deve começar com https://script.google.com/');
        }
        CF.config.set({
          apiUrl: url,
          apiKey: el.querySelector('#cfg-key').value.trim(),
          nome: el.querySelector('#cfg-nome').value.trim()
        });
        CF.ui.ocupado(b, true, 'Conectando…');
        try {
          await S().carregar();
          CF.app.atualizarStatus();
          CF.ui.ok(url ? 'Conectado à planilha.' : 'Preferências salvas.');
        } catch (e) {
          CF.ui.erro('Falha ao conectar: ' + e.message);
        } finally {
          CF.ui.ocupado(b, false);
        }
      },

      testar: async (b) => {
        const url = el.querySelector('#cfg-url').value.trim();
        if (!url) return CF.ui.aviso('Informe a URL do Web App primeiro.');
        CF.ui.ocupado(b, true, 'Testando…');
        const anterior = CF.config.get('apiUrl');
        CF.config.set({ apiUrl: url, apiKey: el.querySelector('#cfg-key').value.trim() });
        try {
          const r = await CF.api.remoto.ping();
          CF.ui.ok(`Conexão OK — planilha "${r?.planilha || 'conectada'}".`);
        } catch (e) {
          CF.config.set({ apiUrl: anterior });
          CF.ui.erro('Não foi possível conectar: ' + e.message);
        } finally {
          CF.ui.ocupado(b, false);
        }
      },

      desconectar: async () => {
        const sim = await CF.ui.confirmar({
          titulo: 'Voltar ao modo local?',
          texto: 'O sistema passa a usar os dados salvos neste navegador. Sua planilha continua intacta.',
          confirmarTexto: 'Voltar ao modo local', perigo: false, icone: 'unplug'
        });
        if (!sim) return;
        CF.config.set({ apiUrl: '' });
        await S().carregar();
        CF.app.atualizarStatus();
        CF.ui.ok('Modo local ativado.');
      },

      'nova-categoria': () => CF.forms.categoria(),
      'editar-categoria': (b) => CF.forms.categoria(st.state.categorias.find(c => c.id === b.dataset.id)),

      'exportar-json': () => {
        const dados = {
          transacoes: st.state.transacoes, assinaturas: st.state.assinaturas,
          compras: st.state.compras, cartoes: st.state.cartoes, contas: st.state.contas,
          contasFixas: st.state.contasFixas, categorias: st.state.categorias,
          metas: st.state.metas, orcamentos: st.state.orcamentos,
          exportadoEm: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup-financeiro-${U.today()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        CF.ui.ok('Backup gerado.');
      },

      'importar-json': () => el.querySelector('#arquivo-json').click(),

      'enviar-planilha': async (b) => {
        if (!CF.config.remoto()) return CF.ui.aviso('Configure e salve a URL da planilha primeiro.');
        const sim = await CF.ui.confirmar({
          titulo: 'Enviar dados locais para a planilha?',
          texto: 'Todos os registros salvos neste navegador serão adicionados à planilha. Registros já existentes podem ser duplicados.',
          confirmarTexto: 'Enviar', perigo: false, icone: 'cloud-upload'
        });
        if (!sim) return;
        CF.ui.ocupado(b, true, 'Enviando…');
        try {
          const dbLocal = await CF.api.local.bootstrap();
          let n = 0;
          for (const ent of Object.keys(CF.api.ENTIDADES)) {
            const linhas = dbLocal[ent] || [];
            if (!linhas.length) continue;
            await CF.api.remoto.createMany(ent, linhas);
            n += linhas.length;
          }
          await S().carregar();
          CF.ui.ok(`${n} registros enviados para a planilha.`);
        } catch (e) {
          CF.ui.erro('Falha ao enviar: ' + e.message);
        } finally {
          CF.ui.ocupado(b, false);
        }
      },

      limpar: async () => {
        const sim = await CF.ui.confirmar({
          titulo: 'Apagar todos os dados locais?',
          texto: 'Tudo que você cadastrou neste navegador será apagado. Sua planilha, se estiver conectada, não é afetada. Esta ação não pode ser desfeita.',
          confirmarTexto: 'Apagar tudo'
        });
        if (!sim) return;
        await CF.api.local.reset();
        await S().carregar();
        CF.ui.ok('Dados apagados. Comece cadastrando suas contas e cartões.');
      },

      instalar: () => CF.app.instalarPWA(),
      recarregar: async () => { await S().carregar(); CF.ui.ok('Dados recarregados.'); }
    });
  }

  return { titulo: 'Configurações', render };
})();
