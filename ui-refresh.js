(() => {
  const lateStyles = document.createElement('link');
  lateStyles.rel = 'stylesheet';
  lateStyles.href = 'ui-refresh.css?v=4';
  document.head.appendChild(lateStyles);

  const quickStart = document.querySelector('.quick-start');
  const caseStudies = document.querySelector('.case-studies');
  const generator = document.querySelector('#generator');
  const result = document.querySelector('#result');
  const form = document.querySelector('#idea-form');
  const industry = document.querySelector('#industry');
  const offer = document.querySelector('#offer');
  const facts = document.querySelector('#facts');
  const ideas = document.querySelector('#ideas');

  if (caseStudies && generator) caseStudies.after(generator);
  else if (quickStart && generator) quickStart.after(generator);
  if (generator && result) generator.after(result);

  if (industry && !industry.value) {
    industry.value = '餐饮 / 咖啡 / 烘焙';
    industry.dispatchEvent(new Event('change'));
  }

  document.querySelectorAll('.industry-chips button').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.industry-chips button').forEach(item => item.classList.remove('active'));
      chip.classList.add('active');
      if (industry) {
        industry.value = chip.dataset.industry;
        industry.dispatchEvent(new Event('change'));
      }
      if (offer) {
        offer.value = chip.dataset.product || '';
        offer.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (facts) {
        facts.value = `推广目标：${chip.dataset.goal || '吸引本地客户咨询'}\n内容方向：爆款短视频获客\n真实卖点：请补充你的真实价格、工艺、服务或产品特色`;
        facts.dispatchEvent(new Event('input', { bubbles: true }));
      }
      globalThis.BotyrAnalytics?.track('industry_template_selected', {
        template_id: chip.dataset.templateId || 'unknown',
        industry: chip.dataset.industry || 'unknown',
      });
      generator?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => facts?.focus({ preventScroll: true }), 450);
    });
  });

  const syncResultState = () => document.body.classList.toggle('has-result', Boolean(result && !result.classList.contains('hidden')));
  if (result) new MutationObserver(syncResultState).observe(result, { attributes: true, attributeFilter: ['class'] });
  syncResultState();

  document.querySelector('.result-close')?.addEventListener('click', () => {
    result?.classList.add('hidden');
    syncResultState();
    generator?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelector('#regenerate')?.addEventListener('click', () => form?.requestSubmit());
  document.querySelector('#result-wechat')?.addEventListener('click', () => document.querySelector('.wechat-modal')?.classList.add('open'));
  document.querySelector('#upgrade-entry')?.addEventListener('click', () => document.querySelector('.wechat-modal')?.classList.add('open'));
  document.querySelector('#case-contact')?.addEventListener('click', () => document.querySelector('.wechat-modal')?.classList.add('open'));

  const quotaKey = `botyr-free-usage-${new Date().toISOString().slice(0, 10)}`;
  const remainingNode = document.querySelector('#remaining-count');
  const readUsage = () => Math.min(3, Number(localStorage.getItem(quotaKey) || 0));
  const updateRemaining = () => {
    if (remainingNode) remainingNode.textContent = String(Math.max(0, 3 - readUsage()));
  };
  updateRemaining();
  let lastResultSignature = '';
  const updateAnalysis = () => {
    const cards = ideas?.querySelectorAll('.idea-item') || [];
    if (!cards.length) return;
    const signature = cards[0].querySelector('h3')?.textContent || '';
    if (!signature || signature === lastResultSignature) return;
    lastResultSignature = signature;
    localStorage.setItem(quotaKey, String(Math.min(3, readUsage() + 1)));
    updateRemaining();
    const factsLength = document.querySelector('#facts')?.value.trim().length || 0;
    const match = factsLength >= 32 ? '高' : factsLength >= 16 ? '良好' : '基础';
    const viral = factsLength >= 40 ? 'A' : factsLength >= 24 ? 'A−' : 'B+';
    const matchNode = document.querySelector('#match-level');
    const viralNode = document.querySelector('#viral-index');
    if (matchNode) matchNode.textContent = match;
    if (viralNode) viralNode.textContent = viral;
  };
  if (ideas) new MutationObserver(updateAnalysis).observe(ideas, { childList: true, subtree: true });

  ideas?.addEventListener('click', async event => {
    const directionTab = event.target.closest('.direction-tab');
    if (directionTab) {
      const direction = directionTab.dataset.direction;
      ideas.querySelectorAll('.direction-tab').forEach(tab => tab.classList.toggle('active', tab === directionTab));
      ideas.querySelectorAll('.direction-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.direction === direction));
      const title = directionTab.querySelector('span')?.textContent;
      if (title) document.querySelector('#result-title').textContent = title;
      return;
    }
    const item = event.target.closest('.idea-item');
    if (!item) return;
    if (event.target.closest('.idea-summary')) {
      ideas.querySelectorAll('.idea-item').forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.idea-summary')?.setAttribute('aria-expanded', 'false');
        }
      });
    }
    const copyButton = event.target.closest('.copy-script');
    if (copyButton) {
      const text = item.querySelector('.script-copy')?.innerText || '';
      try {
        await navigator.clipboard.writeText(text);
        copyButton.textContent = '已复制';
      } catch {
        copyButton.textContent = '手动复制';
      }
      setTimeout(() => copyButton.textContent = '复制', 1400);
    }
    const editButton = event.target.closest('.edit-script');
    if (editButton) {
      const paragraph = item.querySelector('.script-copy');
      const editing = paragraph?.getAttribute('contenteditable') === 'true';
      paragraph?.setAttribute('contenteditable', String(!editing));
      editButton.textContent = editing ? '编辑' : '保存';
      if (!editing) paragraph?.focus();
    }
  });

  const formButton = form?.querySelector('button[type="submit"]');
  formButton?.addEventListener('click', () => {
    if (!form?.checkValidity()) return;
    formButton.classList.add('is-loading');
  });
  if (formButton) new MutationObserver(() => {
    if (!formButton.disabled) formButton.classList.remove('is-loading');
  }).observe(formButton, { attributes: true, attributeFilter: ['disabled'] });
})();
