import { updatePool } from './PoolUI.js';
import { coinPanel, updateCoin } from './CoinUI.js';
import { forgePanel, updateForge } from './ForgeUI.js';
import { ITEMS } from '../systems/RPGState.js';
import { forgeRules } from '../shared/progression.js';
import { itemIcon } from '../assets/itemIcons.js';
import { roulettePanel, updateRoulette } from './RouletteUI.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const colors = { red: '#d76a62', black: '#33454c', green: '#70b989' };
const names = { red: '紅色', black: '黑色', green: '綠色', heads: '正面', tails: '反面' };
const palette = ['#78c9d9', '#e6a66d', '#b5a0ec', '#8dca8b', '#e594b0', '#dec977'];
export function workshopPanel(ui) {
  if (ui.scene.room !== 'village') return '<p>請回村莊使用強化工坊與遊戲館。</p>';
  const r = ui.scene.rpg;
  if (ui.panel === 'forge') return forgePanel();
  const tab = ui.casinoTab || 'roulette';
  return `<p class="panel-hint">遊戲內金幣 · 無現金兌換 · 投注立即扣款，結算由伺服器決定。<b id="casino-wallet"></b></p><div class="casino-tabs">${[['roulette','紅黑綠'],['coin','丟硬幣'],['pool','幸運賭池']].map(([id,label]) => `<button data-casino-tab="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</div>
    ${tab === 'roulette' ? roulettePanel() : tab === 'coin' ? coinPanel(ui) : `<div class="casino-stage"><div class="wheel-pointer">▼</div><div id="casino-wheel" class="casino-wheel"></div><strong id="round-clock"></strong></div><div id="pool-shares"></div><p>${tab === 'roulette' ? '每 60 秒一局，最後 5 秒封盤。7 紅／7 黑／1 綠；紅黑總返還 2 倍，綠色 14 倍（皆含本金）。' : '每 60 秒結算，第 48 秒封盤；每局隨機轉動 6.5–11.5 秒，逐漸減速停下。勝率＝你的投入／總池金額；至少 2 位玩家才開獎，否則退款。'}</p><form id="bet-form" class="gift-form"><label>投入金幣<input name="amount" type="number" min="1" max="100000" value="10" required></label>${tab === 'roulette' ? '<label>顏色<select name="color"><option value="red">紅色 · 2×</option><option value="black">黑色 · 2×</option><option value="green">綠色 · 14×</option></select></label>' : ''}<button id="bet-submit" type="submit">確認投入</button></form><p id="my-stake"></p>`}
    <h3>最新結算</h3><div id="casino-history" aria-live="polite"></div>`;
}
export function workshopSubmit(ui, form) {
  const f = new FormData(form), state = ui.scene.snapshot;
  if (form.id === 'forge-form') { ui.forgeItem = f.get('item'); ui.send('forge', { item: ui.forgeItem }); }
  if (form.id === 'coin-form') { ui.coinCreating = true; ui.send('coin-create', { amount: Number(f.get('amount')), side: f.get('side') }); }
  if (form.id === 'bet-form') { const game = ui.casinoTab || 'roulette'; ui.send('casino-bet', { game, id: state?.casino?.[game]?.id, amount: Number(f.get('amount')), color: f.get('color') }); }
}
export function updateWorkshop(ui, now) {
  const root = ui.root, data = ui.scene.snapshot;
  const set = (id, value) => { const e = root.querySelector('#' + id); if (e && e.textContent !== String(value)) e.textContent = value; };
  const html = (id, value) => { const e = root.querySelector('#' + id); if (e && e.innerHTML !== value) e.innerHTML = value; };
  if (ui.panel === 'forge') updateForge(ui, now);
  if (ui.panel !== 'casino' || !data?.casino) return;
  set('casino-wallet', `持有 ${ui.scene.rpg.gold} 金幣`);
  const c = data.casino, tab = ui.casinoTab || 'roulette', me = data.self.id;
  if (tab === 'roulette') { updateRoulette(ui, now); } else if (tab === 'coin') {
    updateCoin(ui, now);
  } else {
    updatePool(ui, now);
  }
  html('casino-history', c.history.filter(h => h.game === tab).slice(0,5).map(h => `<p>${h.game === 'roulette' ? `<span style="color:${colors[h.color]}">●</span> 開出${names[h.color]}` : h.refund ? '人數不足，已退回本局金幣' : `${esc(h.name)} 獲勝${h.side ? ' · ' + names[h.side] : ''} · 獲得 ${h.total} 金幣`}</p>`).join('') || '<p class="panel-hint">等待第一局結算。</p>');
}
