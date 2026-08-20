/* ============================================================
   utils.js — helpers puros (datas, moeda, DOM, ids)
   Todas as datas circulam como string ISO "YYYY-MM-DD" para
   evitar deslocamento de fuso horário.
   ============================================================ */

window.CF = window.CF || {};

CF.utils = (function () {

  /* ---------------- Moeda e números ---------------- */

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlCompact = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1
  });
  const dec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const money = (n) => brl.format(Number(n) || 0);
  const moneyShort = (n) => Math.abs(Number(n) || 0) >= 10000 ? brlCompact.format(Number(n) || 0) : brl.format(Number(n) || 0);
  const number = (n) => dec.format(Number(n) || 0);
  const pct = (n, casas = 1) => `${(Number(n) || 0).toFixed(casas).replace('.', ',')}%`;

  /** Converte texto digitado ("1.234,56", "R$ 90", "90.5") em número. */
  function parseMoney(v) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    let s = String(v).replace(/[^\d,.-]/g, '').trim();
    if (!s) return 0;
    const temVirgula = s.includes(',');
    const temPonto = s.includes('.');
    if (temVirgula && temPonto) {
      // formato brasileiro: ponto = milhar, vírgula = decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (temVirgula) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  /* ---------------- Datas ---------------- */

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const pad = (n) => String(n).padStart(2, '0');

  /** Date (local) → "YYYY-MM-DD" */
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  /** "YYYY-MM-DD" → Date local (meia-noite local, sem UTC shift) */
  function parseYmd(s) {
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const m = String(s || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return new Date(NaN);
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  const today = () => ymd(new Date());
  const isValidDate = (s) => !isNaN(parseYmd(s).getTime());

  /** "2026-08-20" → "20/08/2026" */
  function fmtDate(s) {
    if (!s) return '—';
    const d = parseYmd(s);
    if (isNaN(d)) return '—';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  /** "2026-08-20" → "20 ago" */
  function fmtDateShort(s) {
    const d = parseYmd(s);
    if (isNaN(d)) return '—';
    return `${pad(d.getDate())} ${MESES_CURTO[d.getMonth()]}`;
  }

  /** "2026-08-20" → "20 de agosto de 2026" */
  function fmtDateLong(s) {
    const d = parseYmd(s);
    if (isNaN(d)) return '—';
    return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
  }

  function addDays(s, n) {
    const d = parseYmd(s);
    d.setDate(d.getDate() + n);
    return ymd(d);
  }

  /** Soma meses preservando o dia; se o mês destino for curto, usa o último dia. */
  function addMonths(s, n) {
    const d = parseYmd(s);
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(dia, daysInMonth(d.getFullYear(), d.getMonth())));
    return ymd(d);
  }

  const daysInMonth = (ano, mesIdx) => new Date(ano, mesIdx + 1, 0).getDate();

  /** "2026-08-20" → "2026-08" */
  const monthOf = (s) => String(s || '').slice(0, 7);

  /** "2026-08" → "Agosto de 2026" */
  function monthLabel(mk) {
    const [a, m] = String(mk).split('-');
    return `${MESES[+m - 1]} de ${a}`;
  }

  /** "2026-08" → "ago/26" */
  function monthLabelShort(mk) {
    const [a, m] = String(mk).split('-');
    return `${MESES_CURTO[+m - 1]}/${String(a).slice(2)}`;
  }

  function addMonthKey(mk, n) {
    const [a, m] = String(mk).split('-').map(Number);
    const d = new Date(a, m - 1 + n, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  const monthStart = (mk) => `${mk}-01`;
  const monthEnd = (mk) => {
    const [a, m] = String(mk).split('-').map(Number);
    return `${mk}-${pad(daysInMonth(a, m - 1))}`;
  };

  /** Diferença em dias inteiros: destino - origem. */
  function daysBetween(de, ate) {
    const a = parseYmd(de), b = parseYmd(ate);
    return Math.round((b - a) / 86400000);
  }

  const daysUntil = (s) => daysBetween(today(), s);

  /** "hoje", "amanhã", "em 3 dias", "há 2 dias" */
  function relativeDay(s) {
    const n = daysUntil(s);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    if (n > 1) return `em ${n} dias`;
    return `há ${Math.abs(n)} dias`;
  }

  const dowName = (s) => DIAS[parseYmd(s).getDay()];

  /** Data segura para "dia X do mês": se X > dias do mês, usa o último dia. */
  function dayInMonth(mk, dia) {
    const [a, m] = String(mk).split('-').map(Number);
    return `${mk}-${pad(Math.min(Math.max(1, dia | 0), daysInMonth(a, m - 1)))}`;
  }

  /* ---------------- IDs ---------------- */

  let seq = Math.floor(Math.random() * 100);
  /** Gera IDs no padrão PREFIXO-AAAAMMDD-0001 (usado no modo local; o backend gera os seus). */
  function id(prefixo) {
    seq++;
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const n = String((Date.now() % 100000) * 10 + (seq % 10)).slice(-4).padStart(4, '0');
    return `${prefixo}-${stamp}-${n}`;
  }

  /* ---------------- Texto ---------------- */

  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const titleCase = (s) => String(s || '').replace(/\b\p{L}/gu, (c) => c.toUpperCase());

  const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

  /* ---------------- Coleções ---------------- */

  const sum = (arr, fn = (x) => x) => arr.reduce((t, x) => t + (Number(fn(x)) || 0), 0);

  function groupBy(arr, fn) {
    const m = new Map();
    for (const it of arr) {
      const k = fn(it);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it);
    }
    return m;
  }

  const sortBy = (arr, fn, dir = 1) =>
    [...arr].sort((a, b) => {
      const x = fn(a), y = fn(b);
      return x < y ? -dir : x > y ? dir : 0;
    });

  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

  const safePct = (parte, total) => (!total ? 0 : clamp((parte / total) * 100, 0, 100));

  /* ---------------- DOM ---------------- */

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function debounce(fn, ms = 250) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  /** Anima um número de 0 até `to`, escrevendo formatado no elemento. */
  function animateCount(node, to, fmt = money, ms = 620) {
    if (!node) return;
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduz) { node.textContent = fmt(to); return; }
    const from = 0, t0 = performance.now();
    function step(t) {
      const p = clamp((t - t0) / ms, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /** Redesenha os ícones Lucide dentro de um container. */
  function icons(root) {
    if (window.lucide?.createIcons) {
      try { window.lucide.createIcons({ nameAttr: 'data-lucide', root: root || document.body }); }
      catch { window.lucide.createIcons(); }
    }
  }

  /* ---------------- Cores ---------------- */

  /** Cor determinística a partir de um texto (para categorias sem cor definida). */
  function colorFrom(str) {
    let h = 0;
    for (let i = 0; i < String(str).length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return `hsl(${h} 68% 55%)`;
  }

  const withAlpha = (hex, a) => {
    if (!hex?.startsWith('#')) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  return {
    money, moneyShort, number, pct, parseMoney, round2,
    MESES, MESES_CURTO, DIAS, pad, ymd, parseYmd, today, isValidDate,
    fmtDate, fmtDateShort, fmtDateLong, addDays, addMonths, daysInMonth,
    monthOf, monthLabel, monthLabelShort, addMonthKey, monthStart, monthEnd,
    daysBetween, daysUntil, relativeDay, dowName, dayInMonth,
    id, esc, norm, titleCase, initials, plural,
    sum, groupBy, sortBy, clamp, safePct,
    qs, qsa, debounce, animateCount, icons,
    colorFrom, withAlpha, cssVar
  };
})();
