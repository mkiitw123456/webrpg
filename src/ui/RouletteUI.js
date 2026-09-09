import { REEL, numberColor, reelPosition } from '../shared/roulette.js';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const label = { red: '紅色 · 1–7', green: '綠色 · 0', black: '黑色 · 8–14' };
export function roulettePanel() {
  return `<div class="reel-status" id="reel-status">等待同步…</div><div class="reel-window" aria-label="橫向開獎輪盤"><div class="reel-marker"></div><div class="reel-track" id="reel-track" aria-hidden="true">${Array.from({length: 14}, () => REEL.map(n => `<span class="reel-cell ${numberColor(n)}">${n}</span>`).join('')).join('')}</div></div><div id="reel-history" class="reel-history" aria-label="最近開獎數字"></div>
    <label class="wager-label">下注金額<input id="roulette-amount" type="number" min="1" max="100000" value="10" inputmode="numeric"></label><div class="wager-tools">${[['clear','清空'],['last','上次'],['10','+10'],['100','+100'],['half','½'],['double','×2'],['max','最大']].map(([id,t])=>`<button data-wager="${id}">${t}</button>`).join('')}</div>
    <p class="panel-hint">每分鐘一局 · 第 48 秒封盤 · 轉動時間與力道每局不同 · 倍率含本金</p><div class="bet-columns">${['red','green','black'].map(c=>`<section class="bet-column"><button class="color-bet ${c}" data-bet-color="${c}">${label[c]}<strong>${c==='green'?14:2}×</strong></button><p id="own-${c}"></p><strong id="total-${c}"></strong><div id="players-${c}"></div></section>`).join('')}</div>`;
}
export function rouletteClick(ui, d) {
  const input = ui.root.querySelector('#roulette-amount');
  if (d.wager && input) {
    const old = Number(input.value) || 0, balance = Math.min(100000, ui.scene.rpg.gold);
    input.value = Math.max(0, Math.min(balance, ({clear:0,last:ui.lastWager||10,half:Math.floor(old/2),double:old*2,max:balance})[d.wager] ?? old + Number(d.wager)));
  }
  if (d.betColor && input) {
    const amount = Number(input.value);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > Math.min(100000, ui.scene.rpg.gold)) return ui.message('請輸入餘額範圍內的整數金額（最多 100,000）。');
    ui.lastWager = amount;
    ui.send('casino-bet', { game: 'roulette', id: ui.scene.snapshot?.casino?.roulette.id, color: d.betColor, amount });
  }
}
export function updateRoulette(ui, now) {
  const data = ui.scene.snapshot, r = data?.casino?.roulette;
  if (!r || !ui.root.querySelector('#reel-track')) return;
  const locked = now >= r.ends - 12000;
  const text = (id,s) => { const e=ui.root.querySelector('#'+id); if(e.textContent!==s)e.textContent=s; };
  text('reel-status', !locked ? `開放下注 · ${Math.max(0,Math.ceil((r.ends-12000-now)/1000))} 秒後封盤` : now < (r.spin?.starts || r.ends) ? '已封盤 · 輪盤即將啟動' : '轉動中 · 等待輪盤減速停下');
  for (const color of ['red','green','black']) {
    const bets = r.bets.filter(b=>b.color===color), players = new Map();
    for(const b of bets) { const old=players.get(b.player); players.set(b.player,{name:b.name,amount:(old?.amount||0)+b.amount}); }
    text('own-'+color, `我的下注 ${bets.filter(b=>b.player===data.self.id).reduce((s,b)=>s+b.amount,0)} 金幣`);
    text('total-'+color, `總下注 ${bets.reduce((s,b)=>s+b.amount,0)} 金幣`);
    const html=[...players.values()].sort((a,b)=>b.amount-a.amount).map(p=>`<div class="bettor"><span>${esc(p.name)}</span><b>${p.amount}</b></div>`).join('')||'<p class="panel-hint">尚無玩家下注</p>';
    const list=ui.root.querySelector('#players-'+color); if(list.innerHTML!==html)list.innerHTML=html;
    ui.root.querySelector(`[data-bet-color="${color}"]`).disabled=locked||!ui.scene.client?.connected;
  }
  const history=data.casino.history.filter(h=>h.game==='roulette');
  const html=history.slice(0,10).map(h=>`<span class="result-ball ${h.color}" title="${label[h.color]}">${h.slot}</span>`).join('');
  const target=ui.root.querySelector('#reel-history'); if(target.innerHTML!==html)target.innerHTML=html;
}
export function animateRoulette(ui, now) {
  if(ui.panel!=='casino'||(ui.casinoTab||'roulette')!=='roulette')return;
  const track=ui.root.querySelector('#reel-track'), c=ui.scene.snapshot?.casino;
  if(!track||!c)return;
  const latest=c.history.find(h=>h.game==='roulette');
  const spin=c.roulette.spin || latest?.spin;
  let position=spin ? reelPosition(spin,now) : 0;
  // A closed round can wait before launch; keep the last landed number until launch.
  if(spin && now<spin.starts && latest)position=REEL.indexOf(latest.slot);
  track.style.transform=`translateX(calc(50% - ${(position+15+.5)*64}px))`;
  if(!spin)return;
  const previous=ui.reelClock;
  if(previous && now>=spin.starts && now<spin.ends && previous<spin.starts && ui.reelStartSound!==spin.id) { ui.scene.audio.casino('start'); ui.reelStartSound=spin.id; }
  if(previous && previous<spin.ends && now>=spin.ends && now-spin.ends<1500 && ui.reelEndSound!==spin.id) { ui.scene.audio.casino('settle'); ui.reelEndSound=spin.id; }
  ui.reelClock=now;
}
