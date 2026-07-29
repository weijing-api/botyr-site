(() => {
  const container = document.querySelector('#case-library');
  if (!container) return;

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const metric = (value, suffix = '') => Number.isFinite(value)
    ? `${Number(value).toLocaleString('zh-CN')}${suffix}`
    : '待核验';

  const renderCase = item => {
    const verified = item.status === 'product_verified';
    return `<article class="case-card${verified ? ' verified' : ' pending'}" data-case-id="${escapeHTML(item.id)}">
      <div class="case-card-top">
        <span class="case-icon">${escapeHTML(item.icon)}</span>
        <div><small>${escapeHTML(item.industry)}</small><b>${escapeHTML(item.status_label)}</b></div>
      </div>
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.summary)}</p>
      <dl>
        <div><dt>播放量</dt><dd>${metric(item.metrics?.plays)}</dd></div>
        <div><dt>咨询人数</dt><dd>${metric(item.metrics?.leads)}</dd></div>
        <div><dt>生成方案</dt><dd>${metric(item.metrics?.plans_generated, ' 条')}</dd></div>
      </dl>
      ${verified ? '<span class="case-source">✓ 已核验产品生成流程</span>' : '<button class="case-submit" type="button">提交真实案例</button>'}
    </article>`;
  };

  fetch('data/cases.json?v=1')
    .then(response => {
      if (!response.ok) throw new Error('案例数据加载失败');
      return response.json();
    })
    .then(data => {
      const cases = Array.isArray(data.cases) ? data.cases : [];
      container.innerHTML = cases.length
        ? cases.map(renderCase).join('')
        : '<p class="case-loading">真实案例正在征集中。</p>';
      globalThis.BotyrCaseLibrary = {
        schemaVersion: data.schema_version,
        updatedAt: data.updated_at,
        cases,
      };
    })
    .catch(() => {
      container.innerHTML = '<p class="case-loading">案例暂时无法加载，请稍后刷新。</p>';
    });

  container.addEventListener('click', event => {
    if (!event.target.closest('.case-submit')) return;
    globalThis.BotyrAnalytics?.track('case_submission_click', {
      case_id: event.target.closest('.case-card')?.dataset.caseId || 'unknown',
    });
    document.querySelector('.wechat-modal')?.classList.add('open');
  });
})();
