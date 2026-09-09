import { coinIcon } from '../assets/coinIcon.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const sideName = side => side === 'heads' ? '葉紋正面' : '星紋反面';
const coinImage = (side, cls = 'coin-icon') => `<img class="${cls}" src="${coinIcon(side)}" alt="${sideName(side)}" width="96" height="96">`;
const opposite = side => side === 'heads' ? 'tails' : 'heads';
const stateName = s => ({waiting:'等待加入',countdown:'10 秒倒數',flipping:'拋幣中',finished:'已結束'})[s];
export function coinPanel(ui) {
  return `<p class="coin-my-id">你的 ID：${esc(ui.scene.snapshot?.self.id || '連線中')}</p><div class="coin-design-legend">${coinImage('heads','coin-list-icon')} 葉紋正面 ${coinImage('tails','coin-list-icon')} 星紋反面 · 小葉村金幣</div><div id="coin-lobby"><div id="coin-summary" class="coin-summary"></div><form id="coin-form" class="coin-create"><label>每人投入金幣<input name="amount" type="number" min="1" max="100000" value="10" required></label><label>我的硬幣面<select name="side"><option value="heads">葉紋正面</option><option value="tails">星紋反面</option></select></label><button type="submit">建立硬幣房間</button></form><p class="panel-hint">Join 後需再次確認才會扣款。View 免費觀戰。雙方投入相同金額，勝率各 50%；完成的局保留 30 分鐘。</p><div class="coin-list-heading"><span>玩家／硬幣面</span><span>獎池與狀態</span><span>操作</span></div><div id="coin-rooms"></div></div><div id="coin-detail" hidden></div>`;
}
export function coinClick(ui, d) {
  if (d.coinView || d.coinJoin) { ui.coinRoom = d.coinView || d.coinJoin; ui.coinConfirm = !!d.coinJoin; ui.coinDetailSignature = null; }
  if (d.coinBack) { ui.coinRoom = null; ui.coinConfirm = false; }
  if (d.coinConfirm) {
    const r = ui.scene.snapshot?.casino?.rooms.find(r => r.id === d.coinConfirm);
    if (!r || r.status !== 'waiting') return ui.message('房間已被加入或已取消。');
    ui.coinConfirm = false;
    ui.send('coin-join', { id: r.id, confirmed: true });
  }
  if (d.coinDecline) { ui.coinConfirm = false; }
}
function playerCard(id, name, side, me, amount, winner) {
  return `<div class="coin-player ${winner === id ? 'winner' : ''}"><span class="side-badge ${side}">${sideName(side)}</span><div class="coin-avatar ${side}">${coinImage(side)}</div><strong>${esc(name || '等待玩家')}</strong><code>${id ? 'ID: ' + esc(id) : '空位'}</code>${id === me ? '<small>這是你</small>' : ''}<p>${amount} 金幣 · 50%</p>${winner === id ? '<b>勝者</b>' : ''}</div>`;
}
export function updateCoin(ui, now) {
  const c = ui.scene.snapshot?.casino, root = ui.root;
  if (!c || !root.querySelector('#coin-lobby')) return;
  const me = ui.scene.snapshot.self.id;
  if (ui.coinCreating) { const created = c.rooms.find(r => r.owner === me && r.status === 'waiting'); if (created) { ui.coinRoom = created.id; ui.coinCreating = false; ui.coinConfirm = false; } }
  const lobby = root.querySelector('#coin-lobby'), detail = root.querySelector('#coin-detail');
  lobby.hidden = !!ui.coinRoom; detail.hidden = !ui.coinRoom;
  if (!ui.coinRoom) {
    const html = `<span>可加入 <b>${c.rooms.filter(r=>r.status==='waiting').length}</b></span><span>進行中 <b>${c.rooms.filter(r=>['countdown','flipping'].includes(r.status)).length}</b></span><span>30 分鐘紀錄 <b>${c.rooms.filter(r=>r.status==='finished').length}</b></span>`;
    if(root.querySelector('#coin-summary').innerHTML !== html)root.querySelector('#coin-summary').innerHTML = html;
    const list = [...c.rooms].sort((a,b)=>b.created-a.created).map(r => `<div class="coin-list-row"><div><strong>${coinImage(r.side,'coin-list-icon')} ${esc(r.name)} <small>${sideName(r.side)}</small></strong><small>${r.owner.slice(0,8)} ${r.owner===me?'· 你':''}</small><strong>${r.guest ? 'vs ' + esc(r.guestName) + ' · ' + sideName(opposite(r.side)) : '等待對手'}</strong></div><div><b>${r.amount * (r.guest ? 2 : 1)} 金幣</b><small>${stateName(r.status)}${r.status==='finished'?' · '+sideName(r.winningSide)+'勝出':''}</small></div><div class="coin-row-actions">${r.status==='waiting'&&r.owner!==me?`<button data-coin-join="${r.id}">Join 加入</button>`:''}<button data-coin-view="${r.id}">View 查看</button>${r.status==='waiting'&&r.owner===me?`<button data-coin-cancel="${r.id}">取消退款</button>`:''}</div></div>`).join('') || '<p>目前沒有房間，建立第一間吧。</p>';
    if(root.querySelector('#coin-rooms').innerHTML!==list)root.querySelector('#coin-rooms').innerHTML=list;
    return;
  }
  const r = c.rooms.find(r=>r.id===ui.coinRoom);
  if (!r) { const text='<button data-coin-back="true">返回清單</button><p>房間已取消、逾時或已超過 30 分鐘保留時間。</p>'; if(detail.innerHTML!==text)detail.innerHTML=text; return; }
  const signature = JSON.stringify([r.id,r.status,r.guest,r.winner,ui.coinConfirm]);
  if(ui.coinDetailSignature!==signature || !detail.querySelector('.coin-arena')) {
    ui.coinDetailSignature=signature;
    detail.innerHTML = `<button data-coin-back="true">← 返回房間清單</button><p class="panel-hint">局號 ${r.id} · 獎池 ${r.amount * 2} 金幣</p><div class="coin-arena">${playerCard(r.owner,r.name,r.side,me,r.amount,r.winner)}<div class="coin-stage"><div id="coin-countdown"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="countdown-track" cx="50" cy="50" r="45"/><circle id="coin-ring" cx="50" cy="50" r="45"/></svg><strong id="coin-seconds"></strong></div><div id="coin-flight" class="coin-flight"><div id="toss-coin" class="toss-coin"><div class="coin-face heads">${coinImage('heads')}</div><div class="coin-face tails">${coinImage('tails')}</div></div></div><strong id="coin-stage-label" role="status"></strong></div>${playerCard(r.guest,r.guestName,opposite(r.side),me,r.amount,r.winner)}</div>${ui.coinConfirm&&r.status==='waiting'?`<div class="coin-confirm" role="alertdialog" aria-label="確認加入硬幣局"><h3>確認加入這一局？</h3><p>投入 ${r.amount} 金幣，選擇${sideName(opposite(r.side))}。確認後立即扣款，配對後無法取消。</p><button data-coin-confirm="${r.id}">確認加入 · ${r.amount} 金幣</button><button data-coin-decline="true">暫不加入</button></div>`:r.status==='waiting'?`<p>等待另一位玩家確認加入。</p>${r.owner!==me?`<button data-coin-join="${r.id}">Join 加入此局</button>`:`<button data-coin-cancel="${r.id}">取消房間並退款</button>`}`:''}<p class="coin-result">${r.status==='finished'?`${esc(r.winner===r.owner?r.name:r.guestName)} 獲勝 · ${sideName(r.winningSide)}朝上 · 獲得 ${r.amount*2} 金幣`:'同一局的參與者與觀眾同步觀看。'}</p>`;
  }
  animateCoin(ui, now);
}
export function animateCoin(ui, now) {
  if(ui.panel!=='casino'||ui.casinoTab!=='coin'||!ui.coinRoom)return;
  const r=ui.scene.snapshot?.casino?.rooms.find(r=>r.id===ui.coinRoom), root=ui.root;
  const ring=root.querySelector('#coin-countdown'), flight=root.querySelector('#coin-flight'), label=root.querySelector('#coin-stage-label');
  if(!r||!ring)return;
  const countdown=r.status==='countdown' && now<r.tossStarts, tossing=r.status==='flipping'||(r.status==='countdown'&&now>=r.tossStarts);
  ring.hidden=!countdown; flight.hidden=!(tossing||r.status==='finished');
  let text=r.status==='waiting'?'等待對手':countdown?'即將拋幣':r.status==='finished'?sideName(r.winningSide)+'朝上':'硬幣拋出…';
  if(label.textContent!==text)label.textContent=text;
  if(countdown) {
    const seconds=Math.max(0,(r.tossStarts-now)/1000);
    root.querySelector('#coin-seconds').textContent=seconds.toFixed(1);
    root.querySelector('#coin-ring').style.strokeDashoffset=String(283*(1-seconds/10));
  }
  if(tossing||r.status==='finished') {
    const t=r.status==='finished'?1:Math.max(0,Math.min(1,(now-r.tossStarts)/(r.ends-r.tossStarts)));
    const angle=(7*360+(r.winningSide==='tails'?180:0))*(1-(1-t)**3);
    root.querySelector('#toss-coin').style.transform=`translateY(${-Math.sin(Math.PI*t)*95}px) rotateY(${angle}deg)`;
  }
}
