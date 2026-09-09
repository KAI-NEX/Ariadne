'use strict';
(async function () {
  const toast = document.getElementById('vi-toast');
  let timer;
  function announce(text) { toast.textContent = text; clearTimeout(timer); timer = setTimeout(() => { toast.textContent = ''; }, 3500); }
  const response = await fetch('/vi/manifest.json', {cache: 'no-cache'});
  if (!response.ok) throw new Error('VI manifest unavailable');
  const spec = await response.json();
  const preferred = ['canvas','surface','ink','action','text-secondary','line','focus','processing','error','warning','brand-accent','brand-thread'];
  const colors = document.getElementById('vi-colors');
  for (const name of preferred) {
    const t = spec.tokens.find(t => t.name === '--vi-' + name);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'vi-swatch';
    button.setAttribute('aria-label', `复制 ${t.label} ${t.name}`);
    const swatch = document.createElement('span'); swatch.className = 'vi-swatch-color'; swatch.style.backgroundColor = `var(${t.name})`;
    const label = document.createElement('b'); label.textContent = t.label;
    const code = document.createElement('code'); code.textContent = t.name;
    const value = document.createElement('small'); value.textContent = t.value.toUpperCase();
    button.append(swatch, label, code, value);
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(`var(${t.name})`); announce(`已复制 var(${t.name})`); }
      catch { announce(`请复制：var(${t.name})`); }
    });
    colors.append(button);
  }
  const iconGrid = document.getElementById('vi-icons');
  for (const icon of spec.icons) {
    const card = document.createElement('article'); card.className = 'vi-icon-card';
    card.dataset.search = `${icon.name} ${icon.label} ${icon.usage}`.toLowerCase();
    const image = document.createElement('span'); image.className = 'vi-icon'; image.dataset.icon = icon.name; image.setAttribute('aria-hidden', 'true');
    const label = document.createElement('h3'); label.textContent = icon.label;
    const code = document.createElement('code'); code.textContent = `${icon.name} / ${icon.stroke}`;
    const desc = document.createElement('p'); desc.textContent = icon.usage;
    card.append(image, label, code, desc); iconGrid.append(card);
  }
  document.getElementById('icon-search').addEventListener('input', event => {
    const q = event.target.value.trim().toLowerCase(); let visible = 0;
    for (const card of iconGrid.children) { card.hidden = !card.dataset.search.includes(q); if (!card.hidden) visible++; }
    document.getElementById('icon-empty').classList.toggle('hidden', visible > 0);
  });
  const toggle = document.getElementById('grid-toggle');
  toggle.addEventListener('click', () => {
    const shown = document.body.classList.toggle('vi-show-grid');
    toggle.setAttribute('aria-pressed', String(shown)); toggle.textContent = shown ? '隐藏网格' : '显示网格';
  });
  document.querySelector('.vi-grid-ruler').replaceChildren(...Array.from({length:12}, (_, i) => {
    const cell = document.createElement('span'); cell.textContent = String(i + 1).padStart(2, '0'); return cell;
  }));
  const send = document.getElementById('demo-send');
  function busy(active) {
    window.AriadneProcessingIndicator.set(document.getElementById('demo-processing'), {active, copy: active ? '正在处理 · 视觉演示' : '', state: active ? 'ACTIVE' : 'IDLE'});
    window.AriadneProcessingIndicator.setButton(send, {active, label:'演示等待中'});
    send.disabled = active;
  }
  document.getElementById('state-demo').addEventListener('click', () => busy(true));
  document.getElementById('state-reset').addEventListener('click', () => { busy(false); announce('已恢复初始状态'); });
  document.getElementById('demo-composer').addEventListener('submit', event => { event.preventDefault(); busy(true); announce('仅演示等待状态；点击恢复初始状态可复位'); });
  for (const button of document.querySelectorAll('[data-demo-icon]')) button.addEventListener('click', () => announce('这是图标样本；热区与焦点沿用产品组件'));
  document.documentElement.dataset.viReady = 'true';
})().catch(error => {
  document.getElementById('vi-toast').textContent = '视觉资源未载入，请刷新后重试。';
  console.error(error);
});
