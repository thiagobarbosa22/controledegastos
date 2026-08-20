# Controle Financeiro Pessoal

Aplicação web completa para controlar receitas, despesas, assinaturas, compras
parceladas, cartões de crédito, contas fixas, metas e orçamento — com o **Google
Sheets como banco de dados** e **Google Apps Script como API**.

Funciona no computador e no celular, tem modo claro/escuro e pode ser instalada
como aplicativo (PWA). Sem build, sem npm, sem framework: basta abrir.

---

## Índice

1. [O que o sistema faz](#1-o-que-o-sistema-faz)
2. [Como executar agora (modo local)](#2-como-executar-agora-modo-local)
3. [Conectar sua planilha do Google Sheets](#3-conectar-sua-planilha-do-google-sheets)
4. [Publicar o site gratuitamente](#4-publicar-o-site-gratuitamente)
5. [Instalar como aplicativo (PWA)](#5-instalar-como-aplicativo-pwa)
6. [Estrutura do projeto](#6-estrutura-do-projeto)
7. [Como os dados são modelados](#7-como-os-dados-são-modelados)
8. [API do Apps Script](#8-api-do-apps-script)
9. [Testes](#9-testes)
10. [Segurança e privacidade](#10-segurança-e-privacidade)
11. [Perguntas frequentes e problemas comuns](#11-perguntas-frequentes-e-problemas-comuns)

---

## 1. O que o sistema faz

| Área | O que você consegue fazer |
|---|---|
| **Dashboard** | Saldo atual, receitas, despesas, economia, valores comprometidos, fatura dos cartões e reserva — tudo com comparação com o mês anterior |
| **Movimentações** | Tabela completa com busca, filtros (tipo, categoria, status, cartão, forma de pagamento, faixa de valor), edição, duplicação, exclusão e exportação CSV |
| **Despesas / Receitas** | Cadastro com categoria, subcategoria, conta, cartão, status de pagamento e recorrência (semanal, quinzenal, mensal, bimestral, trimestral, semestral, anual) |
| **Assinaturas** | Custo mensal e anual, próximas cobranças, pausar/reativar, distribuição por categoria. As cobranças entram sozinhas no extrato |
| **Compras** | Compra avulsa ou parcelada. O parcelamento gera as N parcelas futuras, com barra de progresso, total pago, restante e data de conclusão |
| **Cartões** | Cartão visual com limite, utilizado e disponível; fatura atual, anteriores e futuras; fechamento e vencimento; quitar a fatura inteira em um clique |
| **Contas** | Contas a pagar (agrupadas por mês), contas fixas recorrentes, histórico de pagas e contas bancárias/carteiras com saldo real |
| **Calendário** | Mês inteiro com receitas, despesas, contas a pagar, assinaturas e vencimentos de fatura, coloridos por tipo. Clique no dia para ver e lançar |
| **Metas** | Metas com progresso e aporte rápido, reserva de emergência (quantos meses de despesa ela cobre) e orçamento mensal por categoria com alerta amarelo/vermelho |
| **Relatórios** | 30 dias, 3, 6 ou 12 meses, ano atual ou período personalizado: receitas × despesas, evolução do saldo, maiores gastos, detalhamento por categoria, assinaturas, parcelamentos |
| **Alertas** | Contas atrasadas, vencimentos próximos, fatura perto do vencimento, limite do cartão acima de 80%, orçamento estourado e aumento de gasto mensal |
| **Lançamento rápido** | Digite `Uber 32 reais` na barra do topo: o sistema entende descrição, valor, data (`hoje`, `ontem`, `12/08`) e sugere a categoria — e abre o formulário para você confirmar |

Atalhos de teclado: `n` nova despesa · `r` nova receita · `/` foca a barra rápida ·
`Alt + ←/→` muda o mês.

---

## 2. Como executar agora (modo local)

O sistema **já funciona sem planilha**: nesse modo tudo fica salvo no
`localStorage` do próprio navegador. Não há nenhum dado de exemplo embutido — a
primeira tela é um guia de primeiros passos para você cadastrar contas, cartões,
contas fixas e assinaturas.

> No modo local os dados vivem só naquele navegador: limpar o histórico apaga
> tudo, e o celular não enxerga o que foi cadastrado no computador. Para uso de
> verdade, conecte a planilha (seção 3).

Como o projeto usa arquivos separados de CSS e JS, ele precisa ser servido por um
servidor HTTP (abrir o `index.html` com dois cliques também funciona, mas o
service worker e a conexão com o Apps Script exigem `http://` ou `https://`).

```bash
cd controledegastos

# opção 1 — Python (já vem instalado no Linux e no macOS)
python3 -m http.server 8080

# opção 2 — Node
npx serve .

# opção 3 — PHP
php -S localhost:8080
```

Abra <http://localhost:8080>.

Para zerar o que você cadastrou, vá em **Configurações › Apagar todos os dados
locais**.

---

## 3. Conectar sua planilha do Google Sheets

### Passo 1 — Criar a planilha

1. Abra <https://sheets.new> e dê um nome, por exemplo `Controle Financeiro`.

### Passo 2 — Instalar o script

1. Na planilha: **Extensões › Apps Script**.
2. Apague o conteúdo do arquivo `Código.gs` e cole **todo** o conteúdo de
   [`apps-script/Code.gs`](apps-script/Code.gs).
3. Salve (ícone de disquete ou `Ctrl+S`).

### Passo 3 — Criar as abas automaticamente

1. Na barra superior do editor, selecione a função **`setup`**.
2. Clique em **Executar**.
3. O Google vai pedir autorização:
   **Revisar permissões › escolha sua conta › Avançado › Acessar (não seguro) › Permitir**.
   Esse aviso aparece porque o script é seu e não passou por revisão do Google —
   ele só acessa a planilha em que está instalado.
4. Volte à planilha: as abas `Transacoes`, `Assinaturas`, `Compras`, `Cartoes`,
   `Contas`, `ContasFixas`, `Categorias`, `Metas`, `Orcamentos` e `Config` foram
   criadas com os cabeçalhos certos.

### Passo 4 — Publicar a API

1. No editor do Apps Script: **Implantar › Nova implantação**.
2. Clique na engrenagem ao lado de "Selecionar tipo" e escolha **Aplicativo da Web**.
3. Preencha:
   - **Descrição**: `API do controle financeiro`
   - **Executar como**: **Eu** (`seu@gmail.com`)
   - **Quem pode acessar**: **Qualquer pessoa**
4. Clique em **Implantar** e **copie a URL do aplicativo da Web**. Ela termina em
   `/exec`, algo como:
   `https://script.google.com/macros/s/AKfycb.../exec`

> **Por que "Qualquer pessoa"?** O navegador chama a API sem estar logado no
> Google. Quem não tem a URL não consegue chegar até ela, e o passo 6 abaixo
> adiciona uma chave de acesso.

### Passo 5 — Apontar o site para a planilha

1. Abra o site e vá em **Configurações**.
2. Cole a URL em **URL do Web App (Apps Script)**.
3. Clique em **Testar conexão** — deve aparecer `Conexão OK — planilha "…"`.
4. Clique em **Salvar e reconectar**. O indicador na barra lateral muda para
   **Planilha conectada**.

A URL fica salva apenas no `localStorage` do seu navegador; ela não está no
código nem no HTML.

### Passo 6 (opcional, recomendado) — Proteger com uma chave

1. No editor do Apps Script: **Configurações do projeto** (engrenagem) ›
   **Propriedades do script** › **Adicionar propriedade**.
2. Propriedade: `API_KEY` · Valor: uma senha longa qualquer, por exemplo
   `k7Rr-2pQx-91mV-ZzT4`.
3. Salve e faça **Implantar › Gerenciar implantações › editar › Nova versão › Implantar**
   (toda alteração no script só vale depois de publicar uma nova versão).
4. No site, em **Configurações**, informe a mesma chave em **Chave de acesso**
   e salve.

Sem a chave correta, o backend recusa qualquer leitura ou gravação.

### Passo 7 — Levar seus dados do navegador para a planilha (opcional)

Se você já cadastrou coisas no modo local, use
**Configurações › Enviar dados locais para a planilha** depois de conectar.

---

## 4. Publicar o site gratuitamente

O projeto é 100% estático — qualquer hospedagem serve. Três opções gratuitas:

### GitHub Pages

```bash
git init
git add .
git commit -m "controle financeiro"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/controle-financeiro.git
git push -u origin main
```

No repositório: **Settings › Pages › Source: Deploy from a branch › main / (root) › Save**.
Em ~1 minuto o site está em `https://SEU_USUARIO.github.io/controle-financeiro/`.

### Netlify (sem linha de comando)

Acesse <https://app.netlify.com/drop> e arraste a pasta do projeto para a página.
Pronto — você recebe uma URL `https://…netlify.app`.

### Vercel

```bash
npx vercel --prod
```

Escolha "outro/other" como framework e a raiz do projeto como diretório.

> Depois de publicar, abra o site pela URL nova e refaça o passo 5 (a URL da API
> é salva por navegador **e** por domínio).

---

## 5. Instalar como aplicativo (PWA)

Requisito: o site precisa estar em `https://` ou em `localhost`.

- **Android (Chrome)**: menu ⋮ › **Instalar aplicativo** / **Adicionar à tela inicial**.
- **iPhone (Safari)**: botão Compartilhar › **Adicionar à Tela de Início**.
- **Desktop (Chrome/Edge)**: ícone de instalação na barra de endereço, ou
  **Configurações › Instalar** dentro do próprio site.

Instalado, ele abre em tela cheia, com ícone próprio, e o service worker mantém a
interface funcionando offline (os dados continuam precisando de internet quando a
origem é o Google Sheets — sem rede, o app mostra o último cache e avisa
"Offline").

---

## 6. Estrutura do projeto

```
controledegastos/
├── index.html                  Estrutura da página e ordem dos scripts
├── manifest.json               Metadados do PWA
├── sw.js                       Service worker (cache do app shell)
├── README.md
│
├── css/
│   ├── tokens.css              Cores, tipografia, espaçamento, tema claro/escuro
│   ├── base.css                Reset e utilitários
│   ├── components.css          Cards, botões, modais, tabelas, badges, toasts…
│   ├── layout.css              Sidebar, topbar, área de conteúdo, FAB, bottom nav
│   └── responsive.css          Notebook, tablet e celular
│
├── js/
│   ├── utils.js                Datas, moeda, IDs, DOM, formatação pt-BR
│   ├── config.js               Preferências locais (URL da API, tema, nome)
│   ├── catalog.js              Categorias, formas de pagamento, recorrências
│   ├── engine.js               Regras de negócio: recorrência, parcelas, faturas
│   ├── api.js                  Driver local (localStorage) + driver remoto (Apps Script)
│   ├── store.js                Estado, seletores e mutações
│   ├── ui.js                   Modal, toast, confirmação, dropdown, sheet, skeleton
│   ├── forms.js                Construtor de formulários + formulário de cada entidade
│   ├── charts.js               Wrappers do Chart.js
│   ├── router.js               Rotas por hash
│   ├── app.js                  Inicialização, topbar, tema, menus, comando rápido
│   └── views/                  Uma tela por arquivo (dashboard, cartões, metas…)
│
├── apps-script/
│   └── Code.gs                 Backend: CRUD, IDs, validação, chave de acesso
│
├── assets/icons/               Ícones do PWA
└── test/
    ├── smoke.js                Verificação da camada de dados (Node)
    └── e2e.html                Verificação dos fluxos reais no navegador
```

### Como as camadas conversam

```
views/*.js  →  store.js  →  api.js  →  ┬─ localStorage        (modo local)
   ↑             │                     └─ Apps Script → Sheets (modo conectado)
   └─── evento "change" ←──┘
```

As telas nunca falam com a API diretamente: elas leem seletores do `store` e
disparam mutações. Cada mutação grava, atualiza o estado em memória e emite
`change`, o que redesenha a tela atual — por isso salvar uma despesa atualiza,
de uma vez, a lista, o saldo, o gráfico, o orçamento da categoria e a fatura do
cartão.

---

## 7. Como os dados são modelados

### Um único livro-caixa

Toda movimentação vive na aba **`Transacoes`**. "Despesas", "Receitas" e
"Parcelas" são *visões filtradas* dela — não abas paralelas. Isso evita o erro
mais comum nesse tipo de planilha: o mesmo gasto contado duas vezes, em duas
abas, com saldos que não fecham.

`Assinaturas`, `ContasFixas` e `Compras` guardam apenas o **cabeçalho** (o que é,
quanto custa, com que frequência) e **produzem** transações:

| Origem | O que gera | Quando |
|---|---|---|
| Assinatura | uma despesa por cobrança | do mês atual até 2 meses à frente |
| Conta fixa | uma conta a pagar por período | do mês atual até 2 meses à frente |
| Compra parcelada | as N parcelas de uma vez | no momento do cadastro |
| Despesa/receita recorrente | uma cópia por repetição | do mês atual até 2 meses à frente |

Cada transação gerada carrega uma **chave de competência** no formato
`origem:id:AAAA-MM-DD`. Antes de gerar, o sistema confere se a chave já existe —
por isso abrir o site dez vezes no mesmo dia não duplica a conta de luz. O
backend faz a mesma checagem, protegendo contra dois dispositivos abertos ao
mesmo tempo.

O motor **nunca cria lançamentos de meses passados**: contas que você não
registrou não viram dívida retroativa.

### Identificadores

Todo registro tem um ID próprio no formato `PREFIXO-AAAAMMDD-0001` —
`TRX-20260820-0001`, `ASS-20260820-0003`, `COM-20260820-0002`. O número da linha
nunca é usado como identidade, então excluir ou reordenar linhas na planilha não
quebra nada.

### Fatura do cartão

A fatura de uma compra é decidida pelo dia de fechamento: comprou depois do
fechamento, cai na fatura seguinte. Se o dia de vencimento for anterior ao de
fechamento, a fatura vence no mês seguinte ao fechamento. O limite utilizado
considera a fatura aberta **mais todas as parcelas futuras ainda não pagas** —
que é como o limite realmente funciona.

### Abas da planilha

| Aba | Conteúdo |
|---|---|
| `Transacoes` | Livro-caixa único (receitas, despesas, parcelas, cobranças) |
| `Assinaturas` | Serviços recorrentes |
| `Compras` | Cabeçalho das compras avulsas e parceladas |
| `Cartoes` | Cartões de crédito (apelido, limite, fechamento, vencimento, 4 dígitos) |
| `Contas` | Contas bancárias e carteiras, com saldo inicial |
| `ContasFixas` | Contas recorrentes (aluguel, energia, internet…) |
| `Categorias` | Categorias personalizadas (as 18 padrão vivem no código) |
| `Metas` | Metas e reserva de emergência |
| `Orcamentos` | Limite de gasto por categoria |
| `Config` | Metadados da planilha |

Você pode editar valores direto na planilha: o site recarrega tudo no próximo
acesso (ou no botão de atualizar). Só não renomeie as abas nem as colunas do
cabeçalho.

---

## 8. API do Apps Script

Um único endpoint (`POST` com JSON no corpo). O campo `acao` define a operação:

| Ação | Corpo | Retorno |
|---|---|---|
| `ping` | — | nome da planilha |
| `bootstrap` | — | **todas** as entidades de uma vez |
| `criar` | `entidade`, `dados` | registro criado, com ID |
| `criarLote` | `entidade`, `dados[]` | registros criados (ignora competências repetidas) |
| `atualizar` | `entidade`, `id`, `dados` | registro atualizado |
| `excluir` | `entidade`, `id` | `{ id, removido }` |
| `excluirOnde` | `entidade`, `campo`, `valor` | `{ removidos }` |

Entidades válidas: `transacoes`, `assinaturas`, `compras`, `cartoes`, `contas`,
`contasFixas`, `categorias`, `metas`, `orcamentos`.

Exemplo:

```bash
curl -L -X POST 'https://script.google.com/macros/s/SEU_ID/exec' \
  -H 'Content-Type: text/plain;charset=utf-8' \
  -d '{"acao":"criar","apiKey":"SUA_CHAVE","entidade":"transacoes",
       "dados":{"tipo":"despesa","descricao":"iFood","valor":54.9,
                "categoria":"alimentacao","data":"2026-08-20","status":"pago"}}'
```

Resposta:

```json
{ "ok": true, "dados": { "id": "TRX-20260820-0001", "...": "..." }, "erro": null }
```

**Sobre o desempenho.** A tela inteira é montada com **uma única chamada**
(`bootstrap`); os cálculos de dashboard, gráficos e faturas acontecem no
navegador. Gravações atualizam o estado local sem recarregar tudo, e o último
`bootstrap` fica em cache para o app abrir instantaneamente e continuar legível
sem internet.

**Sobre `text/plain`.** O Apps Script não responde à requisição *preflight* do
CORS. Enviar o JSON com `Content-Type: text/plain` mantém a chamada como
"requisição simples" e evita o preflight — o corpo continua sendo JSON.

---

## 9. Testes

```bash
# regras de negócio: datas, parcelas, faturas, recorrência idempotente
node test/smoke.js

# fluxos reais no navegador: modal, validação, salvar, filtrar, excluir,
# parcelamento, troca de tema e renderização de todas as rotas
python3 -m http.server 8080          # em um terminal
# abra http://localhost:8080/test/e2e.html no navegador
```

O `test/e2e.html` carrega a aplicação em um iframe e mostra o resultado de cada
fluxo na própria página.

---

## 10. Segurança e privacidade

- **Nada de credenciais no código.** A URL da API e a chave de acesso são
  digitadas por você em Configurações e ficam no `localStorage` do seu
  navegador. Não há segredo no HTML, no JS ou no repositório.
- **Dados de cartão.** O sistema guarda apenas apelido, banco, limite, datas de
  fechamento/vencimento e os **4 últimos dígitos**. Número completo, CVV e senha
  não têm campo — e o backend recusa mais de 4 dígitos.
- **Validação nos dois lados.** O formulário valida antes de enviar e o
  `Code.gs` valida de novo (obrigatoriedade, número, formato de data, tipo e
  status) antes de gravar.
- **Concorrência.** Toda escrita usa `LockService`, então dois dispositivos
  salvando ao mesmo tempo não corrompem a planilha.
- **A planilha é sua.** Ela fica na sua conta do Google; o site é apenas um
  cliente. Nenhum dado passa por servidor de terceiros.
- **Exclusão pede confirmação** em todos os casos, e o backup completo em JSON
  está a um clique em Configurações.

---

## 11. Perguntas frequentes e problemas comuns

**"Não foi possível conectar" ao testar a URL**
Confira se a URL termina em `/exec` (e não `/dev`), se a implantação está como
**Executar como: Eu** e **Quem pode acessar: Qualquer pessoa**, e se você
executou `setup()` pelo menos uma vez.

**Alterei o `Code.gs` e nada mudou**
O Apps Script serve a *versão publicada*. Faça **Implantar › Gerenciar
implantações › ✏️ › Versão: Nova versão › Implantar**.

**"Chave de acesso inválida"**
A propriedade `API_KEY` do script e o campo em Configurações precisam ser
idênticos — e é preciso publicar uma nova versão depois de criar a propriedade.

**As datas aparecem com um dia a menos**
Não deveria acontecer: as datas circulam como texto `AAAA-MM-DD` e nunca passam
por `new Date("...")` com fuso. Se você digitou datas manualmente na planilha,
confira se a célula está no formato de texto simples.

**Uma cobrança de assinatura apareceu duplicada**
Só acontece se a chave de competência tiver sido alterada na planilha. Apague a
linha duplicada; o sistema não vai recriá-la.

**Apaguei uma parcela e ela voltou**
Parcelas pertencem à compra. Para removê-las de vez, exclua ou edite a compra em
**Compras** — o sistema recria o parcelamento a partir do cabeçalho.

**Quero recomeçar do zero**
Modo local: **Configurações › Apagar todos os dados locais**.
Planilha: no editor do Apps Script, execute a função `limparTudo()`.

**Os gráficos não aparecem**
Chart.js e os ícones vêm de CDN. Sem internet no primeiro carregamento, eles não
são baixados; depois disso o service worker os mantém em cache.

---

Feito para uso pessoal. Sinta-se à vontade para adaptar categorias, cores e
regras — o código está organizado em módulos justamente para isso.
