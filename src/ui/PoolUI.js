import { poolShares, poolAngle } from '../shared/pool.js';
const palette = ['#78c9d9','#e6a66d','#b5a0ec','#8dca8b','#e594b0','#dec977'];
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function displayed(ui, now) {
  const c=ui.scene.snapshot?.casino;if(!c)return null;
  const latest=c.history.find(h=>h.game==='pool');
  return latest?.spin && now-latest.at<5000 ? {round:latest,result:true} : {round:c.pool,result:false};
}
export function updatePool(ui, now) {
  const view=displayed(ui,now), root=ui.root, wheel=root.querySelector('#casino-wheel');if(!view||!wheel)return;
  const current=ui.scene.snapshot.casino.pool, {round:r,result}=view, list=poolShares(r.bets), total=list.reduce((s,b)=>s+b.amount,0);
  let angle=0;
  const stops=list.map((b,i)=>{const start=angle;angle+=b.amount/total*360;return `${palette[i%palette.length]} ${start}deg ${angle}deg`;});
  wheel.style.background=stops.length?`conic-gradient(${stops.join(',')})`:'#52665e';
  const html=list.map((b,i)=>`<span class="pool-share" style="border-color:${palette[i%palette.length]}">${esc(b.name)} · ${(100*b.amount/total).toFixed(1)}% · ${b.amount} 金幣</span>`).join('')||'<p class="panel-hint">投入金幣後顯示每位玩家的勝率。</p>';
  const shares=root.querySelector('#pool-shares');if(shares.innerHTML!==html)shares.innerHTML=html;
  const locked=now>=current.ends-12000;
  const text=result?`本局勝者：${r.name} · ${r.total} 金幣` : !locked?`開放下注 · ${Math.max(0,Math.ceil((current.ends-12000-now)/1000))} 秒後封盤`:!r.spin?'人數不足 · 等待退款':now<r.spin.starts?'已封盤 · 即將轉動':'轉動中 · 逐漸減速';
  root.querySelector('#round-clock').textContent=text;
  root.querySelector('#bet-submit').disabled=locked||!ui.scene.client?.connected;
  root.querySelector('#my-stake').textContent=`本局已投入 ${current.bets.filter(b=>b.player===ui.scene.snapshot.self.id).reduce((s,b)=>s+b.amount,0)} 金幣 · 總池 ${current.bets.reduce((s,b)=>s+b.amount,0)} 金幣${result?'（輪盤正在展示上一局結果）':''}`;
  animatePool(ui,now);
}
export function animatePool(ui,now) {
  if(ui.panel!=='casino'||ui.casinoTab!=='pool')return;
  const wheel=ui.root.querySelector('#casino-wheel'), view=displayed(ui,now);if(!wheel||!view)return;
  wheel.style.transform=`rotate(${poolAngle(view.round.spin,now)}deg)`;
}
