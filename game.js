'use strict';

const saveKey = 'money-press-v1';
const upgrades = [
  { id: 'click', title: 'Bigger clicks', description: '+$1 per manual click', base: 10, growth: 1.45 },
  { id: 'finger', title: 'Auto finger', description: 'Clicks once every 1.5 seconds at base speed', base: 25, growth: 1.55 },
  { id: 'speed', title: 'Finger training', description: 'Auto fingers click 20% more often', base: 60, growth: 1.7, requires: 'finger' },
  { id: 'bank', title: 'Bank branch', description: 'Earn $5 per second per branch', base: 150, growth: 1.65 },
  { id: 'press', title: 'Printing press', description: '+$5 per manual click', base: 220, growth: 1.6 },
  { id: 'fingerPower', title: 'Finger strength', description: '+$1 per automatic click', base: 300, growth: 1.7, requires: 'finger' },
  { id: 'vault', title: 'Bank vault', description: '+$3 per second for each branch', base: 450, growth: 1.75, requires: 'bank' },
  { id: 'mint', title: 'Coin mint', description: 'Earn $25 per second per mint', base: 900, growth: 1.7 },
  { id: 'engraving', title: 'Precision engraving', description: '+$20 per manual click', base: 1400, growth: 1.65 },
];

const get = (id) => document.getElementById(id);
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const money = (value) => '$' + (value >= 1e15 ? value.toExponential(2)
  : (value >= 1e6 ? compactFormat : numberFormat).format(value));

function loadGame() {
  const initial = {
    balance: 0,
    v2: false,
    billClicks: 0,
    bankName: 'Money Press Bank',
    levels: Object.fromEntries(upgrades.map(({ id }) => [id, 0])),
    fingerProgress: 0,
    passiveProgress: 0,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(saveKey));
    if (!saved) return initial;
    initial.v2 = saved.v2 === true;
    if (Number.isSafeInteger(saved.billClicks) && saved.billClicks >= 0) {
      initial.billClicks = saved.billClicks;
    }
    for (const key of ['balance', 'fingerProgress', 'passiveProgress']) {
      if (Number.isFinite(saved[key]) && saved[key] >= 0) initial[key] = saved[key];
    }
    if (typeof saved.bankName === 'string' && saved.bankName.trim()) {
      initial.bankName = saved.bankName.trim().slice(0, 32);
    }
    for (const { id } of upgrades) {
      const level = saved.levels?.[id];
      if (Number.isSafeInteger(level) && level >= 0) initial.levels[id] = level;
    }
  } catch {
    // The current session can still run if storage is unavailable.
  }
  return initial;
}

const state = loadGame();
const levels = state.levels;
const clickValue = () => 1 + levels.click + 5 * levels.press + 20 * levels.engraving;
const fingerInterval = () => 1.5 / 1.2 ** levels.speed;
const fingerValue = () => levels.finger * (1 + levels.fingerPower);
const passiveRate = () => levels.bank * (5 + 3 * levels.vault) + 25 * levels.mint;
const price = ({ id, base, growth }) => Math.ceil(base * growth ** levels[id]);
const canBuy = (upgrade) => (!upgrade.requires || levels[upgrade.requires] > 0)
  && Number.isFinite(price(upgrade)) && state.balance >= price(upgrade);

let lastUpdate = performance.now();
function advance(now) {
  const elapsed = (now - lastUpdate) / 1000;
  lastUpdate = now;
  if (levels.finger) {
    state.fingerProgress += elapsed / fingerInterval();
    const clicks = Math.floor(state.fingerProgress + 1e-10);
    state.fingerProgress = Math.max(0, state.fingerProgress - clicks);
    state.balance += clicks * fingerValue();
    if (clicks > 0) animateFingers();
  }
  state.passiveProgress += elapsed * passiveRate();
  const coins = Math.floor(state.passiveProgress);
  state.passiveProgress -= coins;
  state.balance += coins;
}

function saveGame() {
  try {
    localStorage.setItem(saveKey, JSON.stringify(state));
  } catch {
    // Storage can be blocked by browser settings.
  }
}

const rows = upgrades.map((upgrade) => {
  const row = document.createElement('li');
  row.className = 'upgrade';
  const details = document.createElement('div');
  const title = document.createElement('h2');
  const description = document.createElement('p');
  const button = document.createElement('button');
  button.type = 'button';
  details.append(title, description);
  row.append(details, button);
  get('upgrades').append(row);
  button.addEventListener('click', () => {
    advance(performance.now());
    if (!canBuy(upgrade)) return;
    state.balance -= price(upgrade);
    levels[upgrade.id] += 1;
    get('notice').textContent = upgrade.title + ' upgraded to level ' + levels[upgrade.id];
    saveGame();
    render();
  });
  return { upgrade, title, description, button };
});

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function animateFingers() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  get('finger-icons').animate?.([
    { transform: 'translateY(0)' },
    { transform: 'translateY(-.8rem)', offset: .45 },
    { transform: 'translateY(0)' },
  ], { duration: Math.min(240, fingerInterval() * 800) });
}

function renderFingers() {
  const count = levels.finger;
  get('finger-icons').hidden = count === 0;
  const icons = get('finger-icons');
  while (icons.childElementCount < count) {
    const finger = document.createElement('span');
    finger.textContent = '👆';
    icons.append(finger);
  }
  const status = count === 0
    ? 'Unlock your first auto finger for $25'
    : count + (count === 1 ? ' auto finger active' : ' auto fingers active');
  setText(get('finger-count'), status);
}

function render() {
  get('command-panel').hidden = !state.v2 || state.bankName !== 'supaRich';
  renderFingers();
  setText(get('balance'), money(state.balance));
  setText(get('per-click'), money(clickValue()));
  setText(get('per-second'), money(fingerValue() / fingerInterval() + passiveRate()));
  for (const { upgrade, title, description, button } of rows) {
    const { id, requires } = upgrade;
    const name = id === 'bank' ? state.bankName : upgrade.title;
    const locked = requires && !levels[requires];
    const cost = Number.isFinite(price(upgrade)) ? money(price(upgrade)) : 'Max';
    setText(title, name);
    const requirement = requires === 'bank' ? 'a bank branch' : 'an auto finger';
    setText(description, 'Lv. ' + levels[id] + ' · ' + upgrade.description
      + (locked ? ' · Requires ' + requirement : ''));
    setText(button, cost);
    button.setAttribute('aria-label', 'Buy ' + name + ' for ' + cost);
    button.setAttribute('aria-disabled', String(!canBuy(upgrade)));
  }
}

get('bank-name').value = state.bankName;
get('bank-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = get('bank-name').value.trim();
  if (!name) {
    get('bank-name').value = state.bankName;
    return;
  }
  state.bankName = name;
  get('bank-name').value = name;
  get('notice').textContent = 'Bank named ' + name;
  saveGame();
  render();
});

get('bill').addEventListener('click', () => {
  advance(performance.now());
  const gain = clickValue();
  state.balance += gain;
  state.billClicks += 1;
  saveGame();
  render();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const feedback = document.createElement('span');
  feedback.className = 'gain';
  feedback.setAttribute('aria-hidden', 'true');
  feedback.textContent = '+' + money(gain);
  get('bill-area').append(feedback);
  feedback.animate([
    { transform: 'translate(-50%, 0)', opacity: 1 },
    { transform: 'translate(-50%, -3rem)', opacity: 0 },
  ], { duration: 600 }).finished.then(() => feedback.remove());
});

setInterval(() => {
  if (!levels.finger && !passiveRate()) return;
  advance(performance.now());
  render();
}, 100);
setInterval(saveGame, 3000);
window.addEventListener('pagehide', () => {
  advance(performance.now());
  saveGame();
});
render();

const goldBar = get('gold-bar');
let goldTimer;
function scheduleGold() {
  goldTimer = setTimeout(showGold, 15000 + Math.random() * 20000);
}

function showGold() {
  if (!state.v2) return;
  clearTimeout(goldTimer);
  goldBar.style.setProperty('--gold-x', (15 + Math.random() * 70) + '%');
  goldBar.style.setProperty('--gold-y', (18 + Math.random() * 60) + '%');
  goldBar.hidden = false;
  goldTimer = setTimeout(() => {
    goldBar.hidden = true;
    scheduleGold();
  }, 10000);
}

function syncMode() {
  get('v2-mode').checked = state.v2;
  get('online-panel').hidden = !state.v2;
  get('v2-message').hidden = !state.v2;
  get('v2-message').textContent = '';
  clearTimeout(goldTimer);
  goldBar.hidden = true;
  if (state.v2) scheduleGold();
  render();
}

get('v2-mode').addEventListener('change', () => {
  state.v2 = get('v2-mode').checked;
  saveGame();
  syncMode();
});

goldBar.addEventListener('click', () => {
  if (!state.v2 || goldBar.hidden) return;
  clearTimeout(goldTimer);
  goldBar.hidden = true;
  const bonus = Math.max(25, clickValue() * 20);
  state.balance += bonus;
  get('v2-message').textContent = 'Gold bar collected · +' + money(bonus);
  saveGame();
  render();
  scheduleGold();
});

get('command-panel').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || !state.v2 || state.bankName !== 'supaRich') return;
  if (button.id === 'spawn-gold') {
    showGold();
    get('command-status').textContent = 'Gold bar spawned.';
    return;
  }
  advance(performance.now());
  const balance = button.id === 'grant-coins'
    ? state.balance + 10000
    : state.balance * Number(button.dataset.balanceFactor);
  if (!Number.isFinite(balance)) {
    get('command-status').textContent = 'Balance is too large for that command.';
    return;
  }
  state.balance = balance;
  get('command-status').textContent = 'Balance set to ' + money(balance) + '.';
  saveGame();
  render();
});

syncMode();
