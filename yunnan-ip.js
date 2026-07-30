(() => {
  document.body.classList.add('ip-yunnan');
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const brand = document.querySelector('.brand');
  if (brand) brand.innerHTML = '<i></i>云南 AI 菌子助手';
  const navCta = document.querySelector('.nav-cta');
  if (navCta) navCta.innerHTML = '进入菌子世界 <span>↗</span>';
  hero.querySelector('.eyebrow').textContent = 'FROM YUNNAN · AI BUSINESS LIFEFORM';
  hero.querySelector('h1').innerHTML = '你的生意很好，<em>只是还没人刷到。</em>';
  hero.querySelector('.hero-copy').textContent = '让 AI 菌子帮你找到客户停下来的 3 秒。它懂一点流量，也懂老板真正想要的是客户。';
  hero.querySelector('.hero-output').innerHTML = '<b>菌灵能力：</b>爆款选题 · 完整口播 · 拍摄镜头 · 引流建议';
  const heroButton = hero.querySelector('.button.primary');
  if (heroButton) heroButton.innerHTML = '🍄 给我整一个爆款 <span>→</span>';
  const copyStack = document.createElement('div');
  copyStack.className = 'hero-copy-stack';
  ['.eyebrow', 'h1', '.hero-copy', '.hero-output', '.hero-actions'].forEach((selector) => {
    const node = hero.querySelector(selector);
    if (node) copyStack.appendChild(node);
  });
  hero.appendChild(copyStack);
  const layer = document.createElement('div');
  layer.innerHTML = '<div class="yunnan-world-bg" aria-hidden="true"></div><div class="yunnan-clouds" aria-hidden="true"></div><div class="yunnan-data-field" aria-hidden="true"></div><div class="yunnan-spores" aria-hidden="true"></div><div class="fungus-being" aria-hidden="true"><img src="ai-fungus-spirit.webp" alt="" /></div><div class="fungus-dialogue">老板，你这个生意有东西噻。</div><div class="world-coordinate">YUNNAN DIGITAL VALLEY · NODE 25.04°N</div>';
  [...layer.children].forEach(child => hero.prepend(child));
  const dataField = hero.querySelector('.yunnan-data-field');
  for (let index = 0; index < 7; index += 1) {
    const thread = document.createElement('i');
    thread.className = 'data-thread';
    thread.style.left = `${18 + index * 12}%`;
    thread.style.bottom = `${-20 - (index % 3) * 18}%`;
    thread.style.animationDelay = `${index * -1.1}s`;
    dataField.appendChild(thread);
  }
  const spores = hero.querySelector('.yunnan-spores');
  for (let index = 0; index < 12; index += 1) {
    const spore = document.createElement('i');
    spore.className = 'spore';
    spore.style.left = `${8 + ((index * 17) % 88)}%`;
    spore.style.top = `${16 + ((index * 23) % 70)}%`;
    spore.style.setProperty('--speed', `${4.8 + (index % 5)}s`);
    spore.style.animationDelay = `${index * -.7}s`;
    spores.appendChild(spore);
  }
  const dialogue = hero.querySelector('.fungus-dialogue');
  const lines = ['老板，你来啦噻。', '这个生意有东西。', '差点让人看见嘛。', '走，给你整个爆款。'];
  let lineIndex = 0;
  setInterval(() => {
    lineIndex = (lineIndex + 1) % lines.length;
    dialogue.animate([{ opacity: .2, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 420, easing: 'ease-out' });
    dialogue.textContent = lines[lineIndex];
  }, 4200);
  const quickTitle = document.querySelector('.quick-head h2');
  const quickKicker = document.querySelector('.quick-head span');
  const quickCopy = document.querySelector('.quick-head p');
  if (quickTitle) quickTitle.textContent = '老板，先选哈你的生意。';
  if (quickKicker) quickKicker.textContent = '进入菌子商业世界';
  if (quickCopy) quickCopy.textContent = '菌子会自动带上行业模板，你只需要补充真实卖点。';
  const presets = [
    ['🍜','餐饮老板','本地餐饮店','餐饮 / 咖啡 / 烘焙'],
    ['☕','咖啡店老板','本地咖啡店','餐饮 / 咖啡 / 烘焙'],
    ['🏡','民宿老板','本地民宿服务','民宿 / 酒店 / 文旅服务'],
    ['💄','美业老板','本地美容美业服务','美业 / 美发 / 美甲'],
    ['🛠','手艺人老板','本地手艺与生活服务','手艺人 / 本地生活服务'],
    ['🚗','汽车老板','本地汽车服务','房产 / 家政 / 汽车'],
  ];
  const select = document.querySelector('#industry');
  presets.forEach((preset, index) => {
    const button = document.querySelectorAll('.industry-chips button')[index];
    if (!button) return;
    if (select && ![...select.options].some(option => option.value === preset[3])) select.add(new Option(preset[3], preset[3]));
    button.dataset.industry = preset[3];
    button.dataset.product = preset[2];
    button.dataset.goal = '吸引附近客户咨询和到店消费';
    button.innerHTML = `<b>${preset[0]}</b><strong>${preset[1]}</strong><small>让菌子帮你炼一条</small>`;
  });
})();
