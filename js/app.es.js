// SPPIGOT app logic — Spanish version
(function () {
  'use strict';

  // ---------- i18n labels ----------
  const T = {
    select: '— Seleccione —',
    notApplicable: '— No aplica —',
    skip: '— Omitir —',
    yes: 'Sí',
    no: 'No',
    na: 'N/A',
    unknown: 'Desconocido',
    high: 'Alto',
    medium: 'Medio',
    low: 'Bajo',
    highPriority: 'Alta Prioridad',
    lowPriority: 'Baja Prioridad',
    pollutantsOfConcern: 'Contaminantes de interés',
    p2Opportunities: 'Oportunidades de P2',
    q1: '1. ¿Su gobierno tiene control sobre esta operación?',
    q2: '2. ¿Qué tan importante es esta operación como fuente de contaminación en su comunidad?',
    inResponseTo: 'En respuesta a',
    actionsShownSingular: 'acción mostrada',
    actionsShownPlural: 'acciones mostradas',
    of: 'de',
    emptyAssessment: 'Ninguna operación se clasificó como alta prioridad. Aún puede revisar las acciones recomendadas o modificar sus respuestas de evaluación inicial.',
    emptyResults: 'Aún no hay acciones recomendadas. O ninguna operación fue clasificada como alta prioridad, o todas las respuestas de evaluación fueron Sí / N/A / omitidas. Intente revisar sus respuestas.',
    emptyFiltered: 'Ninguna acción coincide con los filtros actuales. Intente eliminar o cambiar sus selecciones de filtro.',
    confirmReset: '¿Empezar de nuevo? Sus respuestas se borrarán.',
    answerLabels: {
      'Sí': 'Sí', 'No': 'No', 'N/A': 'N/A', 'Desconocido': 'Desconocido'
    }
  };

  const ANSWER_OPTIONS = ['Sí', 'No', 'N/A', 'Desconocido'];
  const IMPORTANCE_OPTIONS = ['Alto', 'Medio', 'Bajo'];

  const STEP_ORDER = ['intro', 'screening', 'assessment', 'results'];

  const state = {
    screening: {},
    assessment: {},
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
    if (r.control !== 'Sí') return 'low';
    if (r.importance === 'Alto' || r.importance === 'Medio') return 'high';
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
        <p class="op-meta"><strong>${T.pollutantsOfConcern}:</strong> ${escapeHtml(op.pollutants)}</p>
        <p class="op-meta"><strong>${T.p2Opportunities}:</strong> ${escapeHtml(op.opportunities)}</p>
        <div class="op-questions">
          <div>
            <label>${T.q1}</label>
            <select data-op="${escapeAttr(op.name)}" data-field="control">
              <option value="">${T.select}</option>
              ${ANSWER_OPTIONS.map(o => `<option ${r.control===o?'selected':''}>${o}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>${T.q2}</label>
            <select data-op="${escapeAttr(op.name)}" data-field="importance" ${importanceDisabled?'disabled':''}>
              <option value="">${importanceDisabled ? T.notApplicable : T.select}</option>
              ${IMPORTANCE_OPTIONS.map(o => `<option ${importanceValue===o?'selected':''}>${o}</option>`).join('')}
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
        renderScreening();
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
        <span class="badge badge-${p}">${p === 'high' ? T.highPriority : T.lowPriority}</span>
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
      container.innerHTML = `<div class="empty-state">${T.emptyAssessment}</div>`;
      return;
    }

    highOps.forEach(op => {
      const qs = SPPIGOT_DATA.questions
        .map((q, idx) => ({ q, idx }))
        .filter(x => x.q.operation === op.name);

      const wrap = document.createElement('div');
      wrap.className = 'assessment-op';
      wrap.innerHTML = `
        <h3>${escapeHtml(op.name)} <span class="badge badge-high">${T.highPriority}</span></h3>
        ${qs.map(({ q, idx }) => {
          const v = state.assessment[idx] || '';
          return `<div class="q-row">
            <div class="q-text">${escapeHtml(q.question)}</div>
            <select data-qidx="${idx}">
              <option value="">${T.skip}</option>
              ${ANSWER_OPTIONS.map(o => `<option ${v===o?'selected':''}>${o}</option>`).join('')}
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
    const out = [];
    SPPIGOT_DATA.questions.forEach((q, idx) => {
      if (priorityFor(q.operation) !== 'high') return;
      const ans = state.assessment[idx];
      if (ans === 'No' || ans === 'Desconocido') {
        out.push({ q, idx, answer: ans });
      }
    });
    return out;
  }

  // Strip "Previene la contaminación por " prefix and any trailing " pollution"-style suffix
  // for shorter chip labels.
  function shortPollutantLabel(s) {
    return s.replace(/^Previene la contaminación por\s+/i, '')
            .replace(/^Previene\s+/i, '');
  }

  function renderFilters() {
    const pollutants = SPPIGOT_DATA.pollutantBenefits;
    const benefits = SPPIGOT_DATA.otherBenefits;

    const pol = document.getElementById('filter-pollutants');
    pol.innerHTML = pollutants.map(p =>
      `<span class="chip ${state.filters.pollutants.has(p)?'active':''}" data-kind="pollutants" data-val="${escapeAttr(p)}">${escapeHtml(shortPollutantLabel(p))}</span>`
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
      `${filtered.length} ${T.of} ${actions.length} ${actions.length === 1 ? T.actionsShownSingular : T.actionsShownPlural}`;

    if (actions.length === 0) {
      container.innerHTML = `<div class="empty-state">${T.emptyResults}</div>`;
      return;
    }

    const byOp = {};
    filtered.forEach(a => {
      (byOp[a.q.operation] = byOp[a.q.operation] || []).push(a);
    });

    if (Object.keys(byOp).length === 0) {
      container.innerHTML = `<div class="empty-state">${T.emptyFiltered}</div>`;
      return;
    }

    container.innerHTML = SPPIGOT_DATA.operations
      .filter(op => byOp[op.name])
      .map(op => {
        const items = byOp[op.name].map(a => {
          const polTags = a.q.benefits
            .filter(b => SPPIGOT_DATA.pollutantBenefits.includes(b))
            .map(b => `<span class="tag">${escapeHtml(shortPollutantLabel(b))}</span>`)
            .join('');
          const benTags = a.q.benefits
            .filter(b => SPPIGOT_DATA.otherBenefits.includes(b))
            .map(b => `<span class="tag tag-benefit">${escapeHtml(b)}</span>`)
            .join('');
          return `<div class="action-card">
            <p class="q-context">${T.inResponseTo}: ${escapeHtml(a.q.question)} <em>(${escapeHtml(a.answer)})</em></p>
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
    if (!confirm(T.confirmReset)) return;
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
