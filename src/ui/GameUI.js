import { CLASSES, shopBuyPrice, shopSellPrice } from '../shared/classes.js';
import { coinClick } from './CoinUI.js';
import { ITEMS, SKILLS } from '../systems/RPGState.js';
import { ACTION_NAMES } from '../systems/Controls.js';
import { MAPS } from '../shared/maps.js';
import { rouletteClick } from './RouletteUI.js';
import { itemIcon } from '../assets/itemIcons.js';
import { workshopPanel, workshopSubmit, updateWorkshop } from './WorkshopUI.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const titles = { equipment: '穿戴裝備', inventory: '背包', skills: '職業技能書', party: '組隊與副本', shop:'武器裝備商店', trade: '物品贈送', forge: '強化工坊', casino: '金幣遊戲館', settings: '按鍵與音效設定' };
const icon = id => `<img class="pixel-icon" src="${itemIcon(id)}" alt="${escape(ITEMS[id]?.name || (id === 'potion' ? '恢復藥水' : '金幣'))}" width="48" height="48">`;

export default class GameUI {
  constructor(scene) {
    this.scene = scene; this.panel = null;
    this.root = document.getElementById('rpg-ui');
    this.root.innerHTML = `
      <div class="status-row">
        <div class="identity"><span class="level-label">LV. <b id="level">1</b> <small id="connection">連線中</small></span><strong id="hero-name">見習劍士</strong><small id="attributes"></small></div>
        <div class="vitals"><div class="meter hp"><i></i><span></span></div><div class="meter mp"><i></i><span></span></div><div class="meter exp"><i></i><span></span></div></div>
        <div class="wallet"><strong id="gold"></strong><small id="quest"></small></div>
      </div>
      <div class="action-row"><div class="hotbar">
        ${Object.entries(scene.rpg.skills).map(([id, s]) => `<button class="skill-button ${id}" data-action="${id}"><kbd data-key="${id}"></kbd><strong>${s.name}</strong><small>${s.mp ? s.mp + ' MP' : '連續普攻'}</small><span class="cooldown"></span></button>`).join('')}
        <button data-action="potion" class="skill-button potion"><kbd data-key="potion"></kbd><strong>恢復藥水</strong><small id="potions"></small></button>
      </div><span class="party-status" id="party-status">村莊集合中</span></div>
      <nav class="menu-buttons" aria-label="冒險選單">${Object.keys(titles).map(id => `<button data-panel="${id}"><kbd data-key="${id}"></kbd> ${titles[id].replace('劍士', '').replace('按鍵與音效設定', '設定')}</button>`).join('')}</nav>
      <div id="social-alert" role="status"></div>
      <div class="message-row"><span id="message" role="status">歡迎來到小葉村，先到組隊介面認識旅人。</span><span id="movement-help"></span></div>
      <div id="rpg-modal" hidden></div>`;
    this.abort = new AbortController();
    this.root.addEventListener('click', event => this.click(event), { signal: this.abort.signal });
    this.root.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.target;
      workshopSubmit(this, form);
      if (form.id === 'rename-form') this.send('name', { name: new FormData(form).get('name') });
      if (form.id === 'gift-form') {
        const values = new FormData(form);
        this.send('trade-offer', { target: values.get('target'), item: values.get('item'), quantity: Number(values.get('quantity')) });
      }
    }, { signal: this.abort.signal });
    this.root.addEventListener('input', event => {
      if(event.target.id==='music-volume')scene.audio.setMusicVolume(Number(event.target.value)/100);
      if (event.target.id === 'sound-volume') {
        scene.audio.setVolume(Number(event.target.value) / 100);
        this.root.querySelector('#volume-value').textContent = `${Math.round(scene.audio.volume * 100)}%`;
      }
    }, { signal: this.abort.signal });
    this.root.addEventListener('change', event => { if (event.target.id === 'destination-map') this.selectedMap = event.target.value; }, { signal: this.abort.signal });
    this.refreshKeys();
  }
  send(type, values) {
    if (!this.scene.client?.send(type, values)) this.message('尚未連上伺服器，請稍候。');
  }
  click(event) {
    const b = event.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;this.scene.audio.sfx('click');
    rouletteClick(this, d);
    coinClick(this, d);
    if(d.buy)this.send('shop-buy',{item:d.buy});
    if(d.sell)this.send('shop-sell',{item:d.sell});
    if(b.hasAttribute('data-logout')){this.scene.client.destroy();sessionStorage.removeItem('little-leaf-session');location.reload();return;}
    if (d.action) this.scene.performAction(d.action);
    if (d.panel) this.toggle(d.panel);
    if (d.forgeItem) { this.forgeItem = d.forgeItem; this.panel = 'forge'; this.renderPanel(); }
    if (d.casinoTab) { this.casinoTab = d.casinoTab; this.renderPanel(); }
    if (d.coinCancel) this.send('coin-cancel', { id: d.coinCancel });
    if (b.hasAttribute('data-close')) this.close();
    if (d.equip) this.send('equip', { item: d.equip });
    if (d.unequip) this.send('unequip', { slot: d.unequip });
    if (d.upgrade) this.send('upgrade', { skill: d.upgrade });
    if (d.command) this.send(d.command, d.command === 'dungeon-enter' ? { mapId: this.root.querySelector('#destination-map')?.value || 'forest' } : undefined);
    if (d.invite) this.send('party-invite', { target: d.invite });
    if (d.inviteAnswer) this.send('party-answer', { id: d.inviteAnswer, accept: d.accept === 'true' });
    if (d.tradeAnswer) this.send('trade-answer', { id: d.tradeAnswer, accept: d.accept === 'true' });
    if (d.cancelTrade) this.send('trade-cancel', { id: d.cancelTrade });
    if (d.gift) { this.giftItem = d.gift; this.panel = 'trade'; this.renderPanel(); }
    if (d.bind) {
      this.scene.controls.reset();
      b.textContent = '請按新按鍵…';
      this.scene.controls.capture = code => {
        if (code === 'Escape') { this.renderPanel(); return; }
        const error = this.scene.controls.set(d.bind, code);
        this.renderPanel(); this.refreshKeys();
        this.root.querySelector('#binding-message').textContent = error || '按鍵已儲存。';
      };
    }
    if (b.hasAttribute('data-reset-keys')) { this.scene.controls.restore(); this.renderPanel(); this.refreshKeys(); }
    if (b.hasAttribute('data-test-audio')) this.scene.audio.hit('attack');
    if (b.type !== 'submit') b.blur();
  }
  message(text) {
    this.root.querySelector('#message').textContent = text;
    const panelMessage = this.root.querySelector('#panel-message');
    if (panelMessage) panelMessage.textContent = text;
  }
  refreshKeys() {
    this.root.querySelectorAll('[data-key]').forEach(e => { e.textContent = this.scene.controls.label(e.dataset.key); });
    this.root.querySelector('#movement-help').textContent = `${this.scene.controls.label('left')} ${this.scene.controls.label('right')} 移動 · ${this.scene.controls.label('jump')} 跳躍`;
  }
  toggle(panel) {
    if (this.panel === panel) return this.close();
    this.scene.controls.capture = null;
    this.scene.controls.reset(); this.panel = panel; this.renderPanel();
  }
  close() { this.panel = null; this.root.querySelector('#rpg-modal').hidden = true; this.scene.input.enabled = true; this.scene.controls.capture = null; this.scene.controls.reset(); }
  onSnapshot() {
    const s = this.scene.snapshot, r = this.scene.rpg;
    for(const [id,skill]of Object.entries(r.skills)){const b=this.root.querySelector('[data-action="'+id+'"]');b.querySelector('strong').textContent=skill.name;b.querySelector('small').textContent=skill.passive?'空中再按跳躍':skill.mp?skill.mp+' MP':'普通攻擊';}
    // 成員位置與 HP 不影響表單，避免快照把使用者正在填的欄位重建。
    const stable = JSON.stringify([r.inventory, r.equipment, r.enhancements, r.potions, r.level, r.ranks, r.skillPoints,
      r.classId, this.panel==='shop'?r.gold:null, s.party && [s.party.id, s.party.leader, s.party.members.map(p => [p.id, p.name, p.online])],
      s.invites, s.trades, s.peers.map(p => [p.id, p.name, p.partyId]), s.self.name, s.self.room]);
    if (stable !== this.panelSignature && this.panel && !['settings', 'forge', 'casino'].includes(this.panel)) this.renderPanel();
    this.panelSignature = stable;
  }
  renderPanel() {
    // DOM dialogs must block world hit targets (NPCs and building entrances).
    this.scene.input.enabled = false;
    const modal = this.root.querySelector('#rpg-modal');
    modal.hidden = false;
    const body = ['forge', 'casino'].includes(this.panel) ? workshopPanel(this) : ({ equipment: () => this.equipment(), inventory: () => this.inventory(), skills: () => this.skills(), party: () => this.party(), shop:()=>this.shop(), trade: () => this.trade(), settings: () => this.settings() })[this.panel]?.() || '';
    modal.innerHTML = `<section class="${this.panel === 'casino' ? 'casino-dialog' : ''}" role="dialog" aria-modal="true" aria-label="${titles[this.panel]}"><div class="panel-heading"><div><small>冒險者手冊 · ${this.scene.room === 'village' ? '村莊安全區' : '副本戰鬥持續進行'}</small><h2>${titles[this.panel]}</h2></div><button data-close aria-label="關閉">關閉 ×</button></div><p id="panel-message" role="status"></p>${body}<p class="panel-hint">Esc 關閉 · 設定儲存在此瀏覽器 · 角色由伺服器管理</p></section>`;
    this.refreshKeys();
    updateWorkshop(this, this.scene.client?.now || Date.now());
  }
  equipment() {
    const s = this.scene.rpg;
    return `<div class="equipment-layout"><div class="paper-doll"><span>見習劍士</span><img class="character-preview" src="${this.scene.textures.get('player-0').getSourceImage().toDataURL()}" alt="劍士角色預覽"><strong>Lv. ${s.level}</strong></div><div class="equipment-slots">${['weapon', 'armor'].map(slot => {
      const id = s.equipment[slot];
      return `<div class="item-row">${id ? icon(id) : '<div class="empty-slot">空</div>'}<div><small>${slot === 'weapon' ? '武器' : '上衣'}</small><strong>${id ? ITEMS[id].name + ' +' + (s.enhancements[id] || 0) : '未穿戴'}</strong><small>${id ? ITEMS[id].description : '從背包選擇裝備'}</small></div>${id ? `<button data-forge-item="${id}">強化</button><button data-unequip="${slot}">卸下</button>` : ''}</div>`;
    }).join('')}<div class="stat-summary"><span>攻擊 <b>${s.attack}</b></span><span>防禦 <b>${s.defense}</b></span><span>生命 <b>${s.maxHp}</b></span><span>魔力 <b>${s.maxMp}</b></span></div></div></div><button class="primary-button" data-panel="inventory">打開背包，挑選裝備</button>`;
  }
  inventory() {
    const s = this.scene.rpg;
    const items = s.inventory.filter(id => !Object.values(s.equipment).includes(id));
    return `<p class="panel-hint">背包只顯示未穿戴的裝備。穿戴後移至裝備介面；卸下後回到背包。</p><div class="item-list">${items.map(id => `<div class="item-row">${icon(id)}<div><strong>${ITEMS[id].name} +${s.enhancements[id] || 0}</strong><small>${ITEMS[id].description}</small></div><button data-equip="${id}">穿戴</button><button data-forge-item="${id}">強化</button><button data-gift="${id}" ${this.scene.room !== 'village' ? 'disabled' : ''}>贈送</button></div>`).join('')}
      <div class="item-row">${icon('potion')}<div><strong>恢復藥水 ×${s.potions}</strong><small>恢復 60 HP 與 30 MP</small></div><button data-gift="potion" ${this.scene.room !== 'village' || !s.potions ? 'disabled' : ''}>贈送</button></div></div>`;
  }
  skills() {
    const s = this.scene.rpg;
    return `<p class="panel-hint">可用技能點 <b>${s.skillPoints}</b> · 每次升級 +1 點</p><div class="item-list">${Object.entries(this.scene.rpg.skills).map(([id, k]) => `<div class="item-row"><kbd data-key="${id}"></kbd><div><strong>${k.name} ${id === 'attack' ? '' : `Lv.${s.ranks[id]} / 5`}</strong><small>${k.passive?'空中再按一次跳躍，向面向方向衝刺；落地重置':Math.round(s.multiplier(id)*100)+'% 傷害 · '+k.mp+' MP · '+k.cooldown/1000+'s 冷卻'}</small></div>${id !== 'attack' && !k.passive ? `<button data-upgrade="${id}" ${!s.skillPoints || s.ranks[id] >= 5 ? 'disabled' : ''}>升級 +1</button>` : ''}</div>`).join('')}</div>`;
  }
  shop() {
    const s=this.scene.rpg;if(this.scene.room!=='village')return '<p>請回村莊交易。</p>';
    return '<p>新手武器免費補領（每款限一件），不怕爆裝後無武器可用。免費武器不可販賣；已穿戴或交易中的物品需先解除。</p><h3>購買 · 持有 '+s.gold+' 金幣</h3>'+Object.entries(ITEMS).filter(([id,item])=>!item.classId||item.classId===s.classId).map(([id,item])=>'<div class="item-row">'+icon(id)+'<div><strong>'+item.name+'</strong><small>'+shopBuyPrice(item)+' 金幣</small></div><button data-buy="'+id+'" '+(s.inventory.includes(id)||s.gold<shopBuyPrice(item)?'disabled':'')+'>'+(item.starter?'免費領取':'購買')+'</button></div>').join('')+'<h3>販賣背包装備</h3>'+s.inventory.filter(id=>!ITEMS[id].starter&&!Object.values(s.equipment).includes(id)).map(id=>'<div class="item-row">'+icon(id)+'<span>'+ITEMS[id].name+' +'+(s.enhancements[id]||0)+'</span><button data-sell="'+id+'">出售 '+shopSellPrice(ITEMS[id],s.enhancements[id]||0)+' 金幣</button></div>').join('');
  }
  party() {
    const data = this.scene.snapshot;
    if (!data) return '<p class="panel-hint">正在連接村莊…</p>';
    const party = data.party, me = data.self, leader = party?.leader === me.id;
    const incoming = data.invites.filter(i => i.to === me.id);
    return `<label class="destination-label">選擇副本地圖<select id="destination-map" ${!leader || this.scene.room !== 'village' ? 'disabled' : ''}>${Object.entries(MAPS).map(([id,m]) => `<option value="${id}" ${this.selectedMap === id ? 'selected' : ''}>${m.name} · ${m.description}</option>`).join('')}</select></label><form id="rename-form" class="inline-form"><label>角色名稱 <input name="name" value="${escape(me.name)}" maxlength="16" required></label><button type="submit" ${this.scene.room !== 'village' ? 'disabled' : ''}>更名</button></form>
      ${incoming.map(i => `<div class="invite-row"><span>${escape(i.fromName)} 邀請你組隊</span><button data-invite-answer="${i.id}" data-accept="true">接受邀請</button><button data-invite-answer="${i.id}" data-accept="false">婉拒</button></div>`).join('')}
      <div class="party-card"><h3>${party ? `我的隊伍 · ${party.members.length} / 4` : '建立你的冒險隊伍'}</h3>${party ? `<div class="member-list">${party.members.map(p => `<div><span>${escape(p.name)} ${p.id === party.leader ? '· 隊長' : '· 隊員'}</span><small>Lv.${p.level}</small></div>`).join('')}</div><div class="party-actions"><button data-command="${this.scene.room === 'village' ? 'dungeon-enter' : 'dungeon-return'}" ${!leader ? 'disabled' : ''}>${this.scene.room === 'village' ? '全隊進入所選地圖' : '全隊返回村莊'}</button><button data-command="party-leave">離開隊伍${this.scene.room !== 'village' ? '並回村' : ''}</button></div>` : '<p>可以單人出發，也可以邀請村莊裡的旅人。</p><button data-command="party-create">建立隊伍</button>'}</div>
      <h3>${this.scene.room === 'village' ? '村莊中的旅人' : '同副本隊員'}</h3><div class="item-list">${data.peers.length ? data.peers.map(p => `<div class="item-row"><div class="traveler-icon">Lv.${p.level}</div><div><strong>${escape(p.name)}</strong><small>${p.partyId ? '已加入隊伍' : '尚未組隊'}</small></div>${this.scene.room === 'village' ? `<button data-invite="${p.id}" ${!leader || p.partyId || party.members.length >= 4 ? 'disabled' : ''}>邀請組隊</button>` : ''}</div>`).join('') : '<p class="panel-hint">目前沒有其他旅人。請朋友用同一伺服器網址開啟遊戲。</p>'}</div>
      <p class="panel-hint">隊長出發時，全隊一起進入專屬副本。其他隊伍看不到你的怪物或戰利品。離線會離隊並回村，隊長離線時自動交接。</p>`;
  }
  trade() {
    const data = this.scene.snapshot, s = this.scene.rpg;
    if (!data) return '<p class="panel-hint">正在連線…</p>';
    const me = data.self, available = s.inventory.filter(id => !Object.values(s.equipment).includes(id));
    if (s.potions) available.push('potion');
    const incoming = data.trades.filter(t => t.to === me.id), outgoing = data.trades.filter(t => t.from === me.id);
    const record = (t, receive) => `<div class="item-row">${icon(t.item)}<div><strong>${ITEMS[t.item]?.name || '恢復藥水'} ×${t.quantity}</strong><small>${receive ? '來自 ' + escape(t.fromName) : '送給 ' + escape(t.toName)}</small></div>${receive ? `<button data-trade-answer="${t.id}" data-accept="true">接受贈送</button><button data-trade-answer="${t.id}" data-accept="false">拒絕</button>` : `<button data-cancel-trade="${t.id}">取消贈送</button>`}</div>`;
    return `<p class="panel-hint">贈送需要對方接受才會移交，60 秒未回覆自動取消。已穿戴裝備不能贈送，同款裝備每人限持有一件。</p>
      ${incoming.length ? '<h3>收到的贈送</h3>' + incoming.map(t => record(t, true)).join('') : ''}
      ${outgoing.length ? '<h3>等待對方接受</h3>' + outgoing.map(t => record(t, false)).join('') : ''}
      <h3>從背包選擇物品</h3><form id="gift-form" class="gift-form"><label>物品<select name="item">${available.map(id => `<option value="${id}" ${id === this.giftItem ? 'selected' : ''}>${ITEMS[id]?.name || '恢復藥水'}</option>`).join('')}</select></label><label>收件人<select name="target" required><option value="">選擇村莊旅人</option>${data.peers.map(p => `<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select></label><label>數量（裝備固定 1 件）<input name="quantity" type="number" min="1" max="99" value="1" required></label><button type="submit" ${this.scene.room !== 'village' || !data.peers.length || !available.length || outgoing.length ? 'disabled' : ''}>送出贈送邀請</button></form>
      ${this.scene.room !== 'village' ? '<p class="panel-hint">請回村莊進行交易。</p>' : ''}`;
  }
  settings() {
    return `<button data-logout>登出帳號</button><label>背景音樂音量<input id="music-volume" type="range" min="0" max="100" value="${Math.round(this.scene.audio.musicVolume*100)}"></label><a href="/audio/CREDITS.md" target="_blank" rel="noopener">音樂與音效來源（CC0）</a><p class="panel-hint">點擊按鍵後按下新鍵。重複按鍵會提示衝突，Esc 固定為關閉／取消。設定會保留在此瀏覽器。</p><div id="binding-message" role="status"></div><div class="binding-grid">${Object.keys(ACTION_NAMES).map(id => `<div><span>${ACTION_NAMES[id]}</span><button data-bind="${id}">${this.scene.controls.label(id)}</button></div>`).join('')}</div><button class="primary-button" data-reset-keys>恢復預設按鍵</button><div class="sound-setting"><label for="sound-volume">音效音量 <b id="volume-value">${Math.round(this.scene.audio.volume * 100)}%</b></label><input id="sound-volume" type="range" min="0" max="100" value="${Math.round(this.scene.audio.volume * 100)}"><button data-test-audio>試聽打擊音效</button><p>包含攻擊命中、輪盤啟動與結算；受傷不播放音效。設為 0% 即靜音。</p></div>`;
  }
  update(now) {
    updateWorkshop(this, now);
    const s = this.scene.rpg, data = this.scene.snapshot, online = this.scene.client?.connected;
    const set = (selector, text) => { const e = this.root.querySelector(selector); if (e.textContent !== String(text)) e.textContent = text; };
    set('#level', s.level); set('#hero-name', (data?.self.name || '見習劍士')+' · '+CLASSES[s.classId]); set('#connection', online ? '● 已連線' : '○ 離線');
    set('#attributes', `攻擊 ${s.attack} / 防禦 ${s.defense}`);
    for (const [key, value, max] of [['hp', s.hp, s.maxHp], ['mp', s.mp, s.maxMp], ['exp', s.exp, s.nextExp]]) {
      this.root.querySelector(`.${key} i`).style.width = `${100 * value / max}%`;
      set(`.${key} span`, `${key.toUpperCase()} ${Math.floor(value)} / ${max}`);
    }
    set('#gold', `${s.gold} 金幣`); set('#quest', s.kills >= 5 ? '草原初戰完成 · 翠葉長劍已獲得' : `草原初戰 ${s.kills} / 5`);
    set('#potions', `剩餘 ${s.potions} 瓶`);
    set('#party-status', data?.party ? `隊伍 ${data.party.members.length} / 4 · ${this.scene.room === 'village' ? '村莊待命' : '專屬副本'}` : `村莊旅人 ${(data?.peers.length || 0) + 1} 人`);
    const invitations = data?.invites.filter(i => i.to === data.self.id).length || 0;
    const gifts = data?.trades.filter(t => t.to === data.self.id).length || 0;
    const alert = `${invitations ? `<button data-panel="party">${invitations} 個組隊邀請，點此查看</button>` : ''}${gifts ? `<button data-panel="trade">${gifts} 筆物品贈送，點此查看</button>` : ''}`;
    if (this.alertHTML !== alert) { this.root.querySelector('#social-alert').innerHTML = alert; this.alertHTML = alert; }
    for (const [id, skill] of Object.entries(s.skills)) {
      const b = this.root.querySelector(`[data-action="${id}"]`), remaining = Math.max(0, s.cooldowns[id] - now);
      b.disabled = !online || !!this.panel || skill.passive || s.hp <= 0 || remaining > 0 || s.mp < skill.mp || now < s.globalCooldown;
      b.querySelector('.cooldown').textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : '';
    }
    this.root.querySelector('[data-action="potion"]').disabled = !online || !!this.panel || !s.potions || s.hp <= 0 || now < s.potionReady;
  }
  destroy() { this.abort.abort(); this.root.innerHTML = ''; }
}
