import { ITEMS } from '../systems/RPGState.js';
import { forgeRules } from '../shared/progression.js';
import { itemIcon } from '../assets/itemIcons.js';
export function forgePanel() {
  return `<p class="panel-hint">每段跑動 0.35 秒，再停留 0.5 秒。成功進度每次有 10% 機率加倍，亮藍色區段代表大強化。最高 +15；目標 +7 起，失敗後進入保留／爆裝競速。兩條每段獨立擲值，先滿者決定結果；標示為大量競速校準的長期機率，爆裝率是失敗後的條件機率。</p><form id="forge-form" class="gift-form"><label>選擇裝備<select name="item" id="forge-item"></select></label><div id="forge-preview"></div><button type="submit" id="forge-start">開始強化</button></form><div class="forge-race"><strong id="forge-status" role="status"></strong><p id="forge-step-label"></p><div class="race-label"><span id="success-label">成功 · 藍色</span><span id="success-number">0%</span></div><div class="race-track"><i id="success-bar"></i></div><div class="race-label"><span id="failure-label">失敗 · 橘色</span><span id="failure-number">0%</span></div><div class="race-track failure"><i id="failure-bar"></i></div></div>`;
}
export function updateForge(ui, now) {
  const root=ui.root, select=root.querySelector('#forge-item'); if(!select)return;
  const r=ui.scene.rpg, f=ui.scene.snapshot?.forge;
  const signature=JSON.stringify([r.inventory,r.enhancements]);
  if(select.dataset.signature!==signature) {
    const old=select.value||ui.forgeItem;
    select.innerHTML=r.inventory.map(id=>`<option value="${id}" ${old===id?'selected':''}>${ITEMS[id].name} +${r.enhancements[id]||0} · 品階 ${ITEMS[id].level}</option>`).join('');
    select.dataset.signature=signature;
  }
  const item=select.value, level=r.enhancements[item]||0, rules=item?forgeRules(ITEMS[item],level):null;
  const running=f?.status==='running', risk=f?.phase==='risk'; select.disabled=running;
  root.querySelector('#forge-start').disabled=!ui.scene.client?.connected||running||!item||level>=15||r.gold<rules?.cost;
  const preview=item?`<img class="pixel-icon" src="${itemIcon(item)}" alt="${ITEMS[item].name}"><span>+${level} → +${Math.min(15,level+1)} · ${rules.cost} 金幣 · 持有 ${r.gold}<br>長期成功率約 ${rules.successRate}% · 失敗後爆裝率 ${rules.destroyRate}%<br>${rules.destroyRate?'失敗後以第二輪進度條顯示爆裝判定':'本次沒有爆裝風險'}</span>`:'<p>沒有可強化的裝備。</p>';
  if(root.querySelector('#forge-preview').innerHTML!==preview)root.querySelector('#forge-preview').innerHTML=preview;
  const text=f?`${ITEMS[f.item].name} +${f.level} · ${running?(risk?'爆裝判定中':f.pendingRisk?'強化失敗，即將進入爆裝判定':'強化中') : f.status==='success'?'強化成功！+'+(f.level+1):f.status==='destroyed'?'爆裝！裝備已損毀':'強化失敗，保留裝備'}（消耗 ${f.cost} 金幣）`:'等待開始';
  if(root.querySelector('#forge-status').textContent!==text)root.querySelector('#forge-status').textContent=text;
  root.querySelector('.forge-race').classList.toggle('risk',!!risk);
  root.querySelector('#success-label').textContent=risk?'保留裝備 · 橘色':'成功 · 藍色';
  root.querySelector('#failure-label').textContent=risk?'爆裝 · 紅色':'失敗 · 橘色';
  const segments=(f?.segments||[]).map(s=>`<span class="forge-segment ${s.boosted?'boosted':''}" style="left:${s.from}%;width:${s.to-s.from}%"></span>`).join('');
  const bar=root.querySelector('#success-bar');if(bar.innerHTML!==segments)bar.innerHTML=segments;
  animateForge(ui,now);
}
export function animateForge(ui, now) {
  if(ui.panel!=='forge')return;
  const root=ui.root, f=ui.scene.snapshot?.forge, bar=root.querySelector('#success-bar');if(!bar)return;
  const t=f?.step?Math.max(0,Math.min(1,(now-f.step.starts)/(f.step.ends-f.step.starts))):1;
  for(const [key,from] of [['success','fromSuccess'],['failure','fromFailure']]) {
    const value=f?.step ? f.step[from]+(f[key]-f.step[from])*t : f?.[key]||0;
    root.querySelector('#'+key+'-bar').style.clipPath=`inset(0 ${100-value}% 0 0)`;
    root.querySelector('#'+key+'-number').textContent=Math.round(value)+'%';
  }
  root.querySelector('#forge-step-label').textContent=f?.status==='running'?(f.step?.boosted?'大強化 ×2！ · ':'')+(t<1?'進度增加中…':'停留 0.5 秒，等待下一次擲值'):'每級武器攻擊 +3／防具防禦 +2';
}
