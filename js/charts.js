/* ============================================================
   charts.js — wrappers do Chart.js.
   Cada gráfico é registrado por id do canvas e destruído antes
   de redesenhar, evitando vazamento entre navegações.
   ============================================================ */

CF.charts = (function () {
  const U = CF.utils;
  const registro = new Map();

  const cor = (n) => U.cssVar(n);
  const grid = () => U.cssVar('--border');
  const texto = () => U.cssVar('--text-2');

  function base() {
    if (!window.Chart) return null;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = texto();
    Chart.defaults.animation.duration = 700;
    Chart.defaults.animation.easing = 'easeOutQuart';
    return Chart;
  }

  const tooltipMoeda = {
    backgroundColor: 'rgba(15,23,42,.92)',
    padding: 10,
    cornerRadius: 8,
    titleFont: { weight: '600' },
    displayColors: true,
    boxPadding: 4,
    callbacks: {
      label: (ctx) => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${U.money(ctx.parsed.y ?? ctx.parsed)}`
    }
  };

  function destruir(id) {
    const c = registro.get(id);
    if (c) { c.destroy(); registro.delete(id); }
  }

  function destruirTodos() {
    registro.forEach(c => c.destroy());
    registro.clear();
  }

  function montar(id, config) {
    if (!base()) return null;
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    destruir(id);
    const chart = new Chart(canvas.getContext('2d'), config);
    registro.set(id, chart);
    return chart;
  }

  /* ---------------- Rosca: gastos por categoria ---------------- */
  function rosca(id, dados, opts = {}) {
    if (!dados.length) return null;
    return montar(id, {
      type: 'doughnut',
      data: {
        labels: dados.map(d => d.nome),
        datasets: [{
          data: dados.map(d => U.round2(d.valor)),
          backgroundColor: dados.map(d => d.cor),
          borderColor: U.cssVar('--surface'),
          borderWidth: 3,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: opts.cutout || '68%',
        plugins: {
          legend: { display: opts.legenda !== false, position: 'bottom',
            labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, boxWidth: 8 } },
          tooltip: Object.assign({}, tooltipMoeda, {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                return ` ${ctx.label}: ${U.money(ctx.parsed)} (${U.pct(total ? (ctx.parsed / total) * 100 : 0, 1)})`;
              }
            }
          })
        }
      }
    });
  }

  /* ---------------- Barras: receitas x despesas ---------------- */
  function receitasDespesas(id, serie) {
    return montar(id, {
      type: 'bar',
      data: {
        labels: serie.map(s => s.label),
        datasets: [
          { label: 'Receitas', data: serie.map(s => U.round2(s.receitas)),
            backgroundColor: cor('--income'), borderRadius: 6, maxBarThickness: 28 },
          { label: 'Despesas', data: serie.map(s => U.round2(s.despesas)),
            backgroundColor: cor('--expense'), borderRadius: 6, maxBarThickness: 28 },
          { label: 'Economia', data: serie.map(s => U.round2(s.economia)),
            type: 'line', borderColor: cor('--brand'), backgroundColor: cor('--brand'),
            borderWidth: 2.5, tension: .35, pointRadius: 3, pointHoverRadius: 6, fill: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 14 } },
          tooltip: tooltipMoeda
        },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { border: { display: false }, grid: { color: grid(), drawTicks: false },
               ticks: { callback: (v) => U.moneyShort(v), padding: 8 } }
        }
      }
    });
  }

  /* ---------------- Linha: evolução do saldo ---------------- */
  function evolucaoSaldo(id, serie) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height || 280);
    g.addColorStop(0, U.withAlpha('#6366f1', .28));
    g.addColorStop(1, U.withAlpha('#6366f1', 0));

    return montar(id, {
      type: 'line',
      data: {
        labels: serie.map(s => s.label),
        datasets: [{
          label: 'Saldo', data: serie.map(s => U.round2(s.saldo)),
          borderColor: cor('--brand'), backgroundColor: g,
          borderWidth: 3, tension: .38, fill: true,
          pointRadius: 3, pointHoverRadius: 7,
          pointBackgroundColor: U.cssVar('--surface'), pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltipMoeda },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { border: { display: false }, grid: { color: grid(), drawTicks: false },
               ticks: { callback: (v) => U.moneyShort(v), padding: 8 } }
        }
      }
    });
  }

  /* ---------------- Barras horizontais: ranking ---------------- */
  function ranking(id, dados) {
    if (!dados.length) return null;
    return montar(id, {
      type: 'bar',
      data: {
        labels: dados.map(d => d.nome || d.descricao),
        datasets: [{
          data: dados.map(d => U.round2(d.valor)),
          backgroundColor: dados.map(d => d.cor || cor('--brand')),
          borderRadius: 6, maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltipMoeda },
        scales: {
          x: { border: { display: false }, grid: { color: grid(), drawTicks: false },
               ticks: { callback: (v) => U.moneyShort(v) } },
          y: { grid: { display: false }, border: { display: false } }
        }
      }
    });
  }

  /* ---------------- Barras empilhadas por categoria/mês ---------------- */
  function categoriasPorMes(id, meses, categorias, matriz) {
    return montar(id, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: categorias.map((c, i) => ({
          label: c.nome, data: matriz[i], backgroundColor: c.cor,
          borderRadius: 4, maxBarThickness: 34
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 12 } },
          tooltip: tooltipMoeda
        },
        scales: {
          x: { stacked: true, grid: { display: false }, border: { display: false } },
          y: { stacked: true, border: { display: false }, grid: { color: grid(), drawTicks: false },
               ticks: { callback: (v) => U.moneyShort(v), padding: 8 } }
        }
      }
    });
  }

  return { rosca, receitasDespesas, evolucaoSaldo, ranking, categoriasPorMes, destruir, destruirTodos, montar };
})();
