/* =========================================
   Calculator — App Logic
   ========================================= */

'use strict';

// ── State ─────────────────────────────────
const state = {
  current:     '0',    // number being typed
  previous:    null,   // previous operand
  operator:    null,   // pending operator
  justEvaled:  false,  // did we just press =?
  history:     [],     // [ { expr, result } ]
};

// ── DOM refs ──────────────────────────────
const $result   = document.getElementById('result');
const $expr     = document.getElementById('expression');
const $histList = document.getElementById('history-list');

// ── Helpers ───────────────────────────────

/** Format number for display — max 10 sig figs, trim trailing zeros */
function fmt(n) {
  if (!isFinite(n)) return n > 0 ? '∞' : n < 0 ? '−∞' : 'Error';
  if (isNaN(n)) return 'Error';
  const s = parseFloat(n.toPrecision(10)).toString();
  // Convert scientific notation to a readable form if possible
  if (s.includes('e')) {
    const [coef, exp] = s.split('e');
    const e = parseInt(exp, 10);
    if (Math.abs(e) <= 14) {
      // Show full decimal representation
      return parseFloat(n.toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 10 });
    }
    return `${parseFloat(parseFloat(coef).toPrecision(5))}e${exp}`;
  }
  return s;
}

/** Perform the pending calculation */
function calculate(a, op, b) {
  const x = parseFloat(a), y = parseFloat(b);
  switch (op) {
    case '+': return x + y;
    case '−': return x - y;
    case '×': return x * y;
    case '÷': return y === 0 ? NaN : x / y;
    default:  return y;
  }
}

/** Update the display */
function updateDisplay() {
  $result.textContent = state.current;
  $expr.textContent   = state.previous !== null
    ? `${fmt(parseFloat(state.previous))} ${state.operator}`
    : '';

  // Micro-animation on result change
  $result.classList.remove('update');
  void $result.offsetWidth; // reflow trigger
  $result.classList.add('update');
}

/** Highlight active operator button */
function syncOpHighlight() {
  document.querySelectorAll('.btn-op').forEach(btn => {
    btn.classList.toggle('active',
      state.operator !== null && btn.dataset.op === state.operator && !state.justEvaled
    );
  });
}

/** Add an entry to history */
function pushHistory(expr, result) {
  state.history.unshift({ expr, result });
  if (state.history.length > 5) state.history.pop();

  const li = document.createElement('li');
  li.className = 'history-item';
  li.innerHTML = `${escHtml(expr)} <span>= ${escHtml(result)}</span>`;
  $histList.prepend(li);
  if ($histList.children.length > 5) $histList.lastChild.remove();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Actions ───────────────────────────────

const actions = {

  digit(d) {
    if (state.justEvaled) {
      state.current    = d === '0' ? '0' : d;
      state.previous   = null;
      state.operator   = null;
      state.justEvaled = false;
    } else if (state.current === '0' && d !== '.') {
      state.current = d;
    } else if (state.current.length < 15) {
      state.current += d;
    }
    updateDisplay();
    syncOpHighlight();
  },

  dot() {
    if (state.justEvaled) {
      state.current    = '0.';
      state.previous   = null;
      state.operator   = null;
      state.justEvaled = false;
    } else if (!state.current.includes('.')) {
      state.current += '.';
    }
    updateDisplay();
  },

  op(operator) {
    const curr = parseFloat(state.current);

    if (state.operator && !state.justEvaled) {
      // Chain: evaluate previous first
      const result = calculate(state.previous, state.operator, state.current);
      state.previous = fmt(result);
      state.current  = fmt(result);
    } else {
      state.previous = fmt(curr);
    }

    state.operator   = operator;
    state.justEvaled = false;
    // Next digit will replace current
    state.current = state.previous;
    // Flag so next digit input starts fresh
    state._awaitingSecond = true;

    updateDisplay();
    syncOpHighlight();
  },

  equals() {
    if (state.operator === null || state.previous === null) return;

    const expr   = `${fmt(parseFloat(state.previous))} ${state.operator} ${fmt(parseFloat(state.current))}`;
    const result = calculate(state.previous, state.operator, state.current);
    const resStr = fmt(result);

    pushHistory(expr, resStr);

    state.current    = resStr;
    state.previous   = null;
    state.operator   = null;
    state.justEvaled = true;
    state._awaitingSecond = false;

    updateDisplay();
    syncOpHighlight();
  },

  clear() {
    state.current    = '0';
    state.previous   = null;
    state.operator   = null;
    state.justEvaled = false;
    state._awaitingSecond = false;
    updateDisplay();
    syncOpHighlight();
    document.getElementById('btn-ac').textContent = 'AC';
  },

  sign() {
    const n = parseFloat(state.current);
    if (n === 0) return;
    state.current = fmt(-n);
    updateDisplay();
  },

  percent() {
    const n = parseFloat(state.current);
    state.current = fmt(n / 100);
    updateDisplay();
  },
};

// Override digit to handle "awaiting second operand"
const _origDigit = actions.digit.bind(actions);
actions.digit = function(d) {
  if (state._awaitingSecond) {
    state.current = d === '0' ? '0' : d;
    state._awaitingSecond = false;
    updateDisplay();
    syncOpHighlight();
    return;
  }
  _origDigit(d);
};

// ── Event listeners ───────────────────────

document.getElementById('buttons').addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;

  const { action, op, digit } = btn.dataset;

  if (!action) return;

  switch (action) {
    case 'digit':   actions.digit(digit);   break;
    case 'dot':     actions.dot();          break;
    case 'op':      actions.op(op);         break;
    case 'equals':  actions.equals();       break;
    case 'clear':   actions.clear();        break;
    case 'sign':    actions.sign();         break;
    case 'percent': actions.percent();      break;
  }

  // After any digit/dot, change AC→C (clear current only)
  const acBtn = document.getElementById('btn-ac');
  if (state.current !== '0' || state.operator) {
    acBtn.textContent = 'C';
  } else {
    acBtn.textContent = 'AC';
  }
});

// ── Keyboard support ──────────────────────
document.addEventListener('keydown', e => {
  // Prevent default for calculator keys to avoid scrolling etc.
  if ('0123456789.+-*/=Enter Backspace Escape%'.includes(e.key)) {
    e.preventDefault();
  }

  if (e.key >= '0' && e.key <= '9') { actions.digit(e.key); }
  else if (e.key === '.')  { actions.dot(); }
  else if (e.key === '+')  { actions.op('+'); }
  else if (e.key === '-')  { actions.op('−'); }
  else if (e.key === '*')  { actions.op('×'); }
  else if (e.key === '/')  { actions.op('÷'); }
  else if (e.key === '=' || e.key === 'Enter') { actions.equals(); }
  else if (e.key === 'Backspace') { backspace(); }
  else if (e.key === 'Escape')    { actions.clear(); }
  else if (e.key === '%')         { actions.percent(); }

  // Flash corresponding button
  flashKey(e.key);
});

function backspace() {
  if (state.justEvaled || state.current.length === 1 || state.current === '-0') {
    state.current = '0';
  } else {
    state.current = state.current.slice(0, -1) || '0';
  }
  updateDisplay();
}

function flashKey(key) {
  const map = {
    '0':'btn-0','1':'btn-1','2':'btn-2','3':'btn-3','4':'btn-4',
    '5':'btn-5','6':'btn-6','7':'btn-7','8':'btn-8','9':'btn-9',
    '.':'btn-dot','+':'btn-add','-':'btn-sub','*':'btn-mul',
    '/':'btn-div','=':'btn-eq','Enter':'btn-eq','Escape':'btn-ac',
    '%':'btn-pct',
  };
  const id = map[key];
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 150);
}

// ── Init ──────────────────────────────────
updateDisplay();
