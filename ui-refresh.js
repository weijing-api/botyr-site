(() => {
  const lateStyles = document.createElement('link');
  lateStyles.rel = 'stylesheet';
  lateStyles.href = 'ui-refresh.css?v=1';
  document.head.appendChild(lateStyles);

  const quickStart = document.querySelector('.quick-start');
  const generator = document.querySelector('#generator');
  const result = document.querySelector('#result');
  const form = document.querySelector('#idea-form');
  const industry = document.querySelector('#industry');
  const ideas = document.querySelector('#ideas');

  if (quickStart && generator) quickStart.after(generator);
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
      generator?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => document.querySelector('#offer')?.focus({ preventScroll: true }), 450);
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

  ideas?.addEventListener('click', async event => {
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
