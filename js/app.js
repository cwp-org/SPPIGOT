// SPPIGOT app logic
(function () {
  'use strict';

  const STEP_ORDER = ['intro', 'screening', 'assessment', 'results'];

  // State
  const state = {
    screening: {},      // { opName: { control: 'Yes'|'No'|'N/A'|'Unknown', importance: 'High'|'Medium'|'Low' } }
    assessment: {},     // { questionIndex: 'Yes'|'No'|'N/A'|'Unknown' }
    filters: {
      pollutants: new Set(),
      benefits: new Set(),
    },
  };

  // ---------- Navigation ----------
  function goToStep(step) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + step).classList.add('active');
    document.querySelectorAll('.stepper .step').forEach(li => {
      const s = li.dataset.step;
      li.classList.remove('active', 'done');
      const stepIdx = STEP_ORDER.indexOf(step);
      const liIdx = STEP_ORDER.indexOf(s);
      if (liIdx < stepIdx) li.classList.add('done');
      if (liIdx === stepIdx) li.classList.add('active');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(btn.dataset.go));
  });

  // ---------- Screening ----------
  function priorityFor(op) {
    const r = state.screening[op] || {};
    if (r.control !== 'Yes') return 'low';
    if (r.importance === 'High' || r.importance === 'Medium') return 'high';
    return 'low';
  }

  function renderScreening() {
    const container = document.getElementById('screening-list');
    container.innerHTML = '';
    SPPIGOT_DATA.operations.forEach(op => {
      const card = document.createElement('div');
      card.className = 'op-card';
      const r = state.screening[op.name] || {};
      const importanceDisabled = r.control === 'No' || r.control === 'N/A';
      const importanceValue = importanceDisabled ? '' : (r.importance || '');

      card.innerHTML = `
        <h3>${escapeHtml(op.name)}</h3>
        <p class="op-meta">${escapeHtml(op.description)}</p>
        <p class="op-meta"><strong>Pollutants of concern:</strong> ${escapeHtml(op.pollutants)}</p>
        <p class="op-meta"><strong>P2 opportunities:</strong> ${escapeHtml(op.opportunities)}</p>
        <div class="op-questions">
          <div>
            <label>1. Does your government have control over this operation?</label>
            <select data-op="${escapeAttr(op.name)}" data-field="control">
              <option value="">— Select —</option>
              ${['Yes','No','N/A','Unknown'].map(o => `<option ${r.control===o?'selected':''}>${o}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>2. How important is this operation as a pollution source in your community?</label>
            <select data-op="${escapeAttr(op.name)}" data-field="importance" ${importanceDisabled?'disabled':''}>
              <option value="">${importanceDisabled ? '— Not applicable —' : '— Select —'}</option>
              ${['High','Medium','Low'].map(o => `<option ${importanceValue===o?'selected':''}>${o}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const op = e.target.dataset.op;
        const field = e.target.dataset.field;
        if (!state.screening[op]) state.screening[op] = {};
        state.screening[op][field] = e.target.value;
        if (field === 'control' && (e.target.value === 'No' || e.target.value === 'N/A')) {
          state.screening[op].importance = '';
        }
        renderScreening(); // refresh disabled state
      });
    });
  }

  // ---------- Priority summary + Assessment ----------
  function renderPrioritySummary() {
    const container = document.getElementById('priority-summary');
    const items = SPPIGOT_DATA.operations.map(op => {
      const p = priorityFor(op.name);
      return `<div class="summary-item">
        <span>${escapeHtml(op.name)}</span>
        <span class="badge badge-${p}">${p === 'high' ? 'High Priority' : 'Low Priority'}</span>
      </div>`;
    }).join('');
    container.innerHTML = `<div class="summary-grid">${items}</div>`;
  }

  function renderAssessment() {
    renderPrioritySummary();
    const container = document.getElementById('assessment-list');
    container.innerHTML = '';
    const highOps = SPPIGOT_DATA.operations.filter(op => priorityFor(op.name) === 'high');

    if (highOps.length === 0) {
      container.innerHTML = `<div class="empty-state">
        No operations were ranked as high priority. You can still review recommended actions, or
        revise your screening responses.
      </div>`;
      return;
    }

    highOps.forEach(op => {
      const qs = SPPIGOT_DATA.questions
        .map((q, idx) => ({ q, idx }))
        .filter(x => x.q.operation === op.name);

      const wrap = document.createElement('div');
      wrap.className = 'assessment-op';
      wrap.innerHTML = `
        <h3>${escapeHtml(op.name)} <span class="badge badge-high">High Priority</span></h3>
        ${qs.map(({ q, idx }) => {
          const v = state.assessment[idx] || '';
          return `<div class="q-row">
            <div class="q-text">${escapeHtml(q.question)}</div>
            <select data-qidx="${idx}">
              <option value="">— Skip —</option>
              ${['Yes','No','N/A','Unknown'].map(o => `<option ${v===o?'selected':''}>${o}</option>`).join('')}
            </select>
          </div>`;
        }).join('')}
      `;
      container.appendChild(wrap);
    });

    container.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.qidx, 10);
        state.assessment[idx] = e.target.value;
      });
    });
  }

  // ---------- Results ----------
  function getRecommendedActions() {
    // Actions for No or Unknown answers in high-priority operations.
    const out = [];
    SPPIGOT_DATA.questions.forEach((q, idx) => {
      if (priorityFor(q.operation) !== 'high') return;
      const ans = state.assessment[idx];
      if (ans === 'No' || ans === 'Unknown') {
        out.push({ q, idx, answer: ans });
      }
    });
    return out;
  }

  function renderFilters() {
    const pollutants = SPPIGOT_DATA.pollutantBenefits;
    const benefits = SPPIGOT_DATA.otherBenefits;

    const pol = document.getElementById('filter-pollutants');
    pol.innerHTML = pollutants.map(p =>
      `<span class="chip ${state.filters.pollutants.has(p)?'active':''}" data-kind="pollutants" data-val="${escapeAttr(p)}">${escapeHtml(p.replace(/^Prevents /,'').replace(/ pollution$/,''))}</span>`
    ).join('');

    const ben = document.getElementById('filter-benefits');
    ben.innerHTML = benefits.map(b =>
      `<span class="chip ${state.filters.benefits.has(b)?'active':''}" data-kind="benefits" data-val="${escapeAttr(b)}">${escapeHtml(b)}</span>`
    ).join('');

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const kind = chip.dataset.kind;
        const val = chip.dataset.val;
        if (state.filters[kind].has(val)) state.filters[kind].delete(val);
        else state.filters[kind].add(val);
        renderResults();
      });
    });
  }

  function passesFilter(action) {
    const polFilter = state.filters.pollutants;
    const benFilter = state.filters.benefits;
    if (polFilter.size === 0 && benFilter.size === 0) return true;
    const tags = new Set(action.q.benefits);
    // OR across selected filters: action passes if it matches at least one selected pollutant OR at least one selected benefit.
    for (const p of polFilter) if (tags.has(p)) return true;
    for (const b of benFilter) if (tags.has(b)) return true;
    return false;
  }

  function renderResults() {
    renderFilters();
    const container = document.getElementById('results-list');
    const actions = getRecommendedActions();
    const filtered = actions.filter(passesFilter);

    document.getElementById('filter-count').textContent =
      `${filtered.length} of ${actions.length} action${actions.length === 1 ? '' : 's'} shown`;

    if (actions.length === 0) {
      container.innerHTML = `<div class="empty-state">
        No recommended actions yet. Either no operations were ranked high priority, or all
        assessment answers were Yes / N/A / skipped. Try revising your responses.
      </div>`;
      return;
    }

    // Group by operation.
    const byOp = {};
    filtered.forEach(a => {
      (byOp[a.q.operation] = byOp[a.q.operation] || []).push(a);
    });

    if (Object.keys(byOp).length === 0) {
      container.innerHTML = `<div class="empty-state">
        No actions match the current filters. Try removing or changing your filter selections.
      </div>`;
      return;
    }

    container.innerHTML = SPPIGOT_DATA.operations
      .filter(op => byOp[op.name])
      .map(op => {
        const items = byOp[op.name].map(a => {
          const polTags = a.q.benefits
            .filter(b => SPPIGOT_DATA.pollutantBenefits.includes(b))
            .map(b => `<span class="tag">${escapeHtml(b.replace(/^Prevents /,'').replace(/ pollution$/,''))}</span>`)
            .join('');
          const benTags = a.q.benefits
            .filter(b => SPPIGOT_DATA.otherBenefits.includes(b))
            .map(b => `<span class="tag tag-benefit">${escapeHtml(b)}</span>`)
            .join('');
          return `<div class="action-card">
            <p class="q-context">In response to: ${escapeHtml(a.q.question)} <em>(${escapeHtml(a.answer)})</em></p>
            <p class="a-text">${escapeHtml(a.q.action)}</p>
            <div class="tag-row">${polTags}${benTags}</div>
          </div>`;
        }).join('');
        return `<div class="result-op">
          <h3>${escapeHtml(op.name)}</h3>
          ${items}
        </div>`;
      }).join('');
  }

  // ---------- Wire up ----------
  document.getElementById('screening-next').addEventListener('click', () => {
    renderAssessment();
    goToStep('assessment');
  });

  document.getElementById('assessment-next').addEventListener('click', () => {
    renderResults();
    goToStep('results');
  });

  document.getElementById('filter-clear').addEventListener('click', () => {
    state.filters.pollutants.clear();
    state.filters.benefits.clear();
    renderResults();
  });

  document.getElementById('print-pdf').addEventListener('click', () => {
    window.print();
  });

  document.getElementById('restart').addEventListener('click', () => {
    if (!confirm('Start over? Your responses will be cleared.')) return;
    state.screening = {};
    state.assessment = {};
    state.filters.pollutants.clear();
    state.filters.benefits.clear();
    renderScreening();
    goToStep('intro');
  });

  // ---------- Helpers ----------
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---------- Init ----------
  renderScreening();
})();
