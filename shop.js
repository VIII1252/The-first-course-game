'use strict';


const STRIPE_PUB_KEY = 'pk_test_ЗАМЕНИТЕ_НА_СВОЙ_КЛЮЧ';

const SHOP_PRODUCTS = [
  {
    id: 'pack_blue_steel',
    name: '⚔️ Тёмная Сталь',
    desc: 'Синие тона вашей фракции',
    price: '$0.99',
    stripePrice: 'price_ЗАМЕНИТЕ_1',
    themes: ['skin-blue-steel']
  },
  {
    id: 'pack_emerald',
    name: '🌿 Изумрудная Династия',
    desc: 'Изумрудные тона 2 ИИ',
    price: '$0.99',
    stripePrice: 'price_ЗАМЕНИТЕ_2',
    themes: ['skin-emerald']
  },
  {
    id: 'pack_sunset',
    name: '🔥 Багровая Корона',
    desc: 'Огненные тона 4-го ИИ',
    price: '$0.99',
    stripePrice: 'price_ЗАМЕНИТЕ_3',
    themes: ['skin-sunset']
  },
  {
    id: 'theme_winter',
    name: '❄️ Зимняя Карта',
    desc: 'Снежная палитра местности',
    price: '$1.49',
    stripePrice: 'price_ЗАМЕНИТЕ_4',
    themes: ['theme-winter']
  },
  {
    id: 'theme_desert',
    name: '🏜️ Пустынная Карта',
    desc: 'Песочные тона',
    price: '$1.49',
    stripePrice: 'price_ЗАМЕНИТЕ_5',
    themes: ['theme-desert']
  },
  {
    id: 'bundle_premium',
    name: '👑 Императорский Набор',
    desc: 'Все скины + обе темы',
    price: '$3.99',
    stripePrice: 'price_ЗАМЕНИТЕ_BUNDLE',
    themes: ['skin-blue-steel', 'skin-emerald', 'skin-sunset', 'theme-winter', 'theme-desert']
  }
];

const FREE_THEMES = [
  { class: '', icon: '🌍', label: 'Стандарт' },
  { class: 'theme-winter', icon: '❄️', label: 'Зима' },
  { class: 'theme-desert', icon: '🏜️', label: 'Пустыня' }
];

const FREE_SKINS = [
  { class: 'skin-blue-steel', icon: '⚔️', label: 'Тёмная Сталь' },
  { class: 'skin-emerald', icon: '🌿', label: 'Изумруд' },
  { class: 'skin-sunset', icon: '🔥', label: 'Багровая Корона' }
];

const ALL_COSMETIC_CLASSES = [
  'theme-winter',
  'theme-desert',
  'skin-blue-steel',
  'skin-emerald',
  'skin-sunset'
];

const PROFILE_KEY = 'hexempire_profile_v1';
const profileData = {
  playerName: 'Игрок',
  activeTheme: '',
  activeSkins: []
};
window.profileData = profileData;

function loadProfile() {
  try {
    Object.assign(profileData, JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'));
  } catch {
  }

  if (!profileData.playerName) {
    profileData.playerName = 'Игрок';
  }

  if (!Array.isArray(profileData.activeSkins)) {
    profileData.activeSkins = [];
  }
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));
}

function applyProfile() {
  for (const cosmeticClass of ALL_COSMETIC_CLASSES) {
    document.body.classList.remove(cosmeticClass);
  }

  if (profileData.activeTheme) {
    document.body.classList.add(profileData.activeTheme);
  }

  for (const skin of profileData.activeSkins) {
    document.body.classList.add(skin);
  }
}

function openProfile() {
  loadProfile();
  document.getElementById('profile-name').value = profileData.playerName;
  renderProfileThemePicker();
  renderProfileSkinPicker();
  document.getElementById('profile-modal').classList.add('active');
}

function closeProfile() {
  document.getElementById('profile-modal').classList.remove('active');
}

function renderProfileThemePicker() {
  const wrap = document.getElementById('theme-picker');
  wrap.innerHTML = '';

  for (const theme of FREE_THEMES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-chip' + (profileData.activeTheme === theme.class ? ' active' : '');
    button.dataset.theme = theme.class;
    button.innerHTML = `<div class="tc-icon">${theme.icon}</div><div class="tc-label">${theme.label}</div>`;

    button.addEventListener('click', () => {
      profileData.activeTheme = theme.class;
      renderProfileThemePicker();
      applyProfile();
    });

    wrap.appendChild(button);
  }
}

function renderProfileSkinPicker() {
  const wrap = document.getElementById('skin-picker');
  wrap.innerHTML = '';

  for (const skin of FREE_SKINS) {
    const row = document.createElement('div');
    row.className = 'skin-row' + (profileData.activeSkins.includes(skin.class) ? ' active' : '');
    row.dataset.skin = skin.class;
    row.innerHTML = `<span class="sr-icon">${skin.icon}</span><span class="sr-label">${skin.label}</span><span class="sr-check"></span>`;

    row.addEventListener('click', () => {
      if (profileData.activeSkins.includes(skin.class)) {
        profileData.activeSkins = profileData.activeSkins.filter((item) => item !== skin.class);
      } else {
        profileData.activeSkins.push(skin.class);
      }

      renderProfileSkinPicker();
      applyProfile();
    });

    wrap.appendChild(row);
  }
}

function saveProfileNow() {
  const inputValue = document.getElementById('profile-name').value || '';
  profileData.playerName = inputValue.trim().slice(0, 16) || 'Игрок';

  saveProfile();
  applyProfile();

  if (typeof addLog === 'function') {
    addLog('👤 Профиль сохранён: ' + profileData.playerName, 'system');
  }

  if (typeof drawGrid === 'function') {
    drawGrid();
  }

  if (typeof updateUI === 'function') {
    updateUI();
  }

  closeProfile();
}

const LS_OWNED = 'hexempire_owned';

function getOwned() {
  try {
    return JSON.parse(localStorage.getItem(LS_OWNED) || '[]');
  } catch {
    return [];
  }
}

function setOwned(items) {
  localStorage.setItem(LS_OWNED, JSON.stringify(items));
}

function owns(id) {
  return getOwned().includes(id);
}

function unlock(id) {
  if (!owns(id)) {
    const items = getOwned();
    items.push(id);
    setOwned(items);
  }
}

function isStripeConfigured() {
  return STRIPE_PUB_KEY.startsWith('pk_') && SHOP_PRODUCTS.every((product) => (product.stripePrice || '').startsWith('price_'));
}

function loadStripe() {
  return new Promise((resolve, reject) => {
    if (window.Stripe) {
      resolve(window.Stripe(STRIPE_PUB_KEY));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => resolve(window.Stripe(STRIPE_PUB_KEY));
    script.onerror = () => reject(new Error('Не удалось загрузить Stripe.js'));
    document.head.appendChild(script);
  });
}

async function buyProduct(id) {
  const product = SHOP_PRODUCTS.find((item) => item.id === id);
  if (!product) {
    return;
  }

  if (owns(id)) {
    addLog('Этот предмет уже куплен.', 'system');
    return;
  }

  if (!isStripeConfigured()) {
    showStripeHint();
    return;
  }

  addLog(`Открываю Stripe Checkout для «${product.name}»…`, 'system');

  try {
    const stripe = await loadStripe();
    const baseUrl = window.location.href.split('?')[0].split('#')[0];
    const result = await stripe.redirectToCheckout({
      lineItems: [{ price: product.stripePrice, quantity: 1 }],
      mode: 'payment',
      successUrl: baseUrl + '?purchased=' + encodeURIComponent(id),
      cancelUrl: baseUrl + '?canceled=1'
    });

    if (result && result.error) {
      addLog('Ошибка Stripe: ' + result.error.message, 'error');
    }
  } catch (error) {
    addLog('Stripe: ' + error.message, 'error');
  }
}

function demoUnlock(id) {
  unlock(id);
  const product = SHOP_PRODUCTS.find((item) => item.id === id);
  addLog('🎮 Демо-покупка (бесплатно): ' + (product?.name || id), 'system');

  if (typeof openShop === 'function') {
    openShop();
  }
}

function handleReturnFromStripe() {
  const params = new URLSearchParams(window.location.search);
  const purchased = params.get('purchased');
  const canceled = params.get('canceled');
  const cleanUrl = window.location.pathname;

  if (purchased && SHOP_PRODUCTS.some((product) => product.id === purchased)) {
    unlock(purchased);
    addLog('✅ Покупка успешна: ' + (SHOP_PRODUCTS.find((product) => product.id === purchased)?.name || purchased), 'system');
    window.history.replaceState({}, '', cleanUrl);
    return true;
  }

  if (canceled) {
    addLog('Оплата отменена.', 'system');
    window.history.replaceState({}, '', cleanUrl);
  }

  return false;
}

function showStripeHint() {
  const modal = document.getElementById('shop-modal');
  const grid = document.getElementById('shop-grid');
  if (!grid || !modal) {
    return;
  }

  grid.innerHTML = `
    <div class="shop-hint-card">
      <h3>🔧 Stripe не настроен</h3>
      <p>Чтобы принимать оплату, нужно:</p>
      <ol>
        <li>Создайте аккаунт на <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener">dashboard.stripe.com/register</a></li>
        <li>Скопируйте <b>Publishable key</b> (<code>pk_test_…</code>)</li>
        <li>Создайте товары и скопируйте <code>price_…</code> ID</li>
        <li>Откройте <code>shop.js</code> и впишите свои значения</li>
      </ol>
      <p><b>А пока</b> — темы и скины доступны бесплатно в <b>👤 Профиль</b>.</p>
    </div>
  `;

  modal.classList.add('active');
  refreshOwnedList();
}

function openShop() {
  const modal = document.getElementById('shop-modal');
  const grid = document.getElementById('shop-grid');
  if (!modal || !grid) {
    return;
  }

  if (!isStripeConfigured()) {
    showStripeHint();
    return;
  }

  grid.innerHTML = '';

  for (const product of SHOP_PRODUCTS) {
    const card = document.createElement('div');
    card.className = 'shop-card' + (owns(product.id) ? ' owned' : '');
    card.innerHTML = `
      <div class="shop-preview"></div>
      <div class="shop-info">
        <div class="shop-name">${product.name}</div>
        <div class="shop-desc">${product.desc}</div>
      </div>
      <div class="shop-action">
        ${owns(product.id)
          ? '<div class="shop-owned">✓ Куплено</div>'
          : `<button class="btn btn-primary shop-buy">${product.price}</button>`}
      </div>
    `;

    if (!owns(product.id)) {
      card.querySelector('.shop-buy').addEventListener('click', () => buyProduct(product.id));
    }

    grid.appendChild(card);
  }

  modal.classList.add('active');
  refreshOwnedList();

  if (typeof addLog === 'function') {
    addLog('🛒 Магазин открыт.', 'system');
  }
}

function closeShop() {
  document.getElementById('shop-modal')?.classList.remove('active');
}

function refreshOwnedList() {
  const wrap = document.getElementById('shop-owned-list');
  if (!wrap) {
    return;
  }

  const owned = getOwned();
  if (!owned.length) {
    wrap.innerHTML = '<span>Покупок пока нет (все темы бесплатны в Профиле)</span>';
    return;
  }

  wrap.innerHTML = '<span>Куплено: ' + owned.map((id) => SHOP_PRODUCTS.find((product) => product.id === id)?.name || id).join(', ') + '</span>';
}

function resetOwned() {
  if (!confirm('Сбросить все покупки в этом браузере?')) {
    return;
  }

  localStorage.removeItem(LS_OWNED);

  if (typeof addLog === 'function') {
    addLog('🛒 Все покупки сброшены.', 'system');
  }

  openShop();
}

function initShop() {
  document.getElementById('profile-btn')?.addEventListener('click', openProfile);
  document.getElementById('profile-close')?.addEventListener('click', closeProfile);
  document.getElementById('profile-save')?.addEventListener('click', saveProfileNow);
  document.getElementById('profile-shop-link')?.addEventListener('click', () => {
    closeProfile();
    openShop();
  });
  document.getElementById('shop-btn')?.addEventListener('click', openShop);
  document.getElementById('shop-close')?.addEventListener('click', closeShop);
  document.getElementById('shop-reset')?.addEventListener('click', resetOwned);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeProfile();
      closeShop();
    }
  });

  document.getElementById('shop-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'shop-modal') {
      closeShop();
    }
  });

  document.getElementById('profile-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'profile-modal') {
      closeProfile();
    }
  });

  loadProfile();
  applyProfile();
  handleReturnFromStripe();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShop);
} else {
  initShop();
}
