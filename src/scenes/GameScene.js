import { CLASS_SKILLS } from '../shared/classes.js';
import { animatePool } from '../ui/PoolUI.js';
import { animateCoin } from '../ui/CoinUI.js';
import { animateForge } from '../ui/ForgeUI.js';
import Phaser from 'phaser';
import { generateTextures } from '../assets/generateTextures.js';
import { itemIcon } from '../assets/itemIcons.js';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import RPGState, { ITEMS, SKILLS } from '../systems/RPGState.js';
import Controls from '../systems/Controls.js';
import CombatAudio from '../systems/CombatAudio.js';
import GameClient from '../network/GameClient.js';
import GameUI from '../ui/GameUI.js';
import { MONSTERS } from '../shared/progression.js';
import { MAPS } from '../shared/maps.js';
import { mapScenery } from '../assets/mapScenery.js';
import { animateRoulette } from '../ui/RouletteUI.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }
  preload() {
    generateTextures(this);
    for (const id of [...Object.keys(ITEMS), 'potion', 'gold']) this.load.image(`drop-${id}`, itemIcon(id));
  }
  create() {
    this.rpg = new RPGState();
    this.controls = new Controls();
    this.audio = new CombatAudio();
    this.input.keyboard.enabled = false;
    this.room = 'village';
    this.remotePlayers = new Map(); this.monsters = new Map(); this.dropViews = new Map();
    this.mapViews = [];
    this.add.image(0, 0, 'sky').setOrigin(0).setScale(2).setScrollFactor(0).setDepth(-40);
    for (let i = 0; i < 9; i++) this.add.image(i * 360 + 120, 65 + (i % 3) * 35, 'cloud').setScale(2).setScrollFactor(0.2).setDepth(-30);
    this.add.tileSprite(0, 180, 2880, 360, 'hills').setOrigin(0).setTileScale(2).setScrollFactor(0.35).setDepth(-20);
    const animation = (key, frames, frameRate) => {
      if (!this.anims.exists(key)) this.anims.create({ key, frames: frames.map(texture => ({ key: texture })), frameRate, repeat: -1 });
    };
    animation('idle', ['player-0', 'player-1'], 2);
    animation('walk', ['player-0', 'player-2', 'player-0', 'player-3'], 10);
    animation('slime', ['slime-0', 'slime-1'], 4);
    for (const kind of Object.keys(MONSTERS).filter(k => k !== 'slime')) animation(kind, [`${kind}-0`, `${kind}-1`], 5);
    this.platforms = this.physics.add.staticGroup();
    this.player = new Player(this, 140, 449);
    this.physics.add.collider(this.player, this.platforms);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.mapTitle = this.add.text(24, 20, '', { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '22px', color: '#294d45', fontStyle: 'bold' }).setScrollFactor(0).setDepth(10);
    this.mapSubtitle = this.add.text(24, 50, '', { fontSize: '13px', color: '#375e4e' }).setScrollFactor(0).setDepth(10);
    this.selfLabel = this.add.text(140, 408, '冒險者', { fontSize: '12px', color: '#fff6c9', stroke: '#355547', strokeThickness: 3 }).setOrigin(0.5).setDepth(8);
    this.buildMap('village');
    this.ui = new GameUI(this);
    this.client = new GameClient(message => this.receive(message), text => this.ui.message(text));
    this.events.once('shutdown', () => { this.client.destroy(); this.controls.destroy(); this.audio.destroy(); this.ui.destroy(); });
  }
  buildMap(room) {
    this.room = room;
    this.platforms.clear(true, true);
    this.mapViews.forEach(v => v.destroy()); this.mapViews = [];
    for (const collection of [this.monsters, this.dropViews, this.remotePlayers]) { for (const v of collection.values()) this.destroyView(v); collection.clear(); }
    const village = room === 'village', width = village ? 1440 : 2880;
    const mapId = village ? 'village' : this.snapshot?.mapId || 'forest', map = MAPS[mapId];
    this.physics.world.setBounds(0, 0, width, 540);
    this.cameras.main.setBounds(0, 0, width, 540);
    const floor = (x, y, w) => {
      const tile = this.add.tileSprite(x, y, w, 32, mapId === 'cave' ? 'cave-tile' : mapId === 'mushroom' ? 'mushroom-tile' : 'tile').setOrigin(0).setDepth(2);
      this.platforms.add(tile); tile.body.updateFromGameObject();
    };
    floor(0, 476, width);
    this.mapViews.push(this.add.rectangle(0, 508, width, 32, mapId === 'cave' ? 0x313c52 : mapId === 'mushroom' ? 0x72576e : 0x805238).setOrigin(0));
    if (!village) map.ledges.forEach(p => floor(p.x, p.y, p.width));
    mapScenery(this, mapId, width);
    if (village || mapId === 'forest') for (let x = 60; x < width; x += 320) this.mapViews.push(this.add.image(x, 476, 'tree').setOrigin(0.5, 1).setScale(2).setDepth(-10));
    if (mapId !== 'cave') for (let x = 110; x < width; x += 176) this.mapViews.push(this.add.image(x, 477, 'flowers').setOrigin(0.5, 1).setScale(2).setDepth(3));
    this.mapTitle.setText(village ? '小葉村' : map.name + ' · 隊伍副本');
    this.mapTitle.setColor(mapId === 'cave' ? '#d4e9ff' : '#294d45');
    this.mapSubtitle.setColor(mapId === 'cave' ? '#c0d6ec' : '#375e4e');
    this.mapSubtitle.setText(village ? '安全區 · 組隊集合 · 物品贈送' : `獨立狩獵地圖 · ${room.slice(0, 8)} · 選單不會暫停戰鬥`);
    document.getElementById('location-label').textContent = village ? '小葉村 / 冒險者廣場' : map.name + ' / 隊伍專屬副本';
    if (village) {
      const shopNpc=this.add.sprite(300,448,'player-0').setScale(3).setTint(0xa1d6ff).setInteractive({useHandCursor:true});shopNpc.on('pointerdown',()=>this.ui.toggle('shop'));this.mapViews.push(shopNpc,this.add.text(300,385,'裝備商人\n免費新手武器',{fontSize:'12px',color:'#294d45',align:'center'}).setOrigin(0.5));
      this.house(190, '冒險者公會', 0x976047);
      this.house(560, '旅人小屋', 0x608579);
      this.house(800, '幸運葉 · 金幣遊戲館', 0x74608c);
      const casinoDoor = this.add.zone(800, 414, 160, 124).setInteractive({ useHandCursor: true }).setDepth(1);
      casinoDoor.on('pointerdown', () => this.ui.toggle('casino'));
      this.mapViews.push(casinoDoor);
      const npc = this.add.sprite(425, 448, 'player-0').setScale(3).setTint(0xf3cc93).setInteractive({ useHandCursor: true });
      npc.on('pointerdown', () => this.ui.toggle('party'));
      this.mapViews.push(npc, this.add.text(425, 391, '公會嚮導\n點擊組隊', { fontSize: '13px', color: '#315245', align: 'center' }).setOrigin(0.5));
      const gate = this.add.graphics();
      gate.fillStyle(0x54786b).fillRect(990, 306, 90, 170).fillStyle(0xc6d6a2).fillRect(998, 314, 74, 162);
      gate.fillStyle(0x467a78).fillRect(1007, 327, 56, 149).fillStyle(0x91ddc2).fillRect(1015, 337, 40, 139);
      gate.fillStyle(0xe8f7b9).fillRect(1029, 348, 9, 117);
      const zone = this.add.zone(1035, 391, 100, 170).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.ui.toggle('party'));
      this.mapViews.push(gate, zone, this.add.text(1035, 280, '副本傳送門\n隊長帶隊出發', { fontSize: '14px', color: '#315245', align: 'center' }).setOrigin(0.5));
    }
  }
  house(x, name, roofColor) {
    const g = this.add.graphics();
    g.fillStyle(0x74553c).fillRect(x - 82, 360, 164, 116).fillStyle(0xe9d7a7).fillRect(x - 74, 366, 148, 110);
    g.fillStyle(roofColor).fillTriangle(x - 105, 368, x, 288, x + 105, 368);
    g.fillStyle(0xebc995).fillRect(x - 102, 365, 204, 7).fillStyle(0x68543f).fillRect(x - 20, 418, 40, 58);
    for (const offset of [-57, 30]) {
      g.fillStyle(0x678f86).fillRect(x + offset, 389, 29, 29);
      g.fillStyle(0xfaf1c3).fillRect(x + offset + 12, 389, 4, 29).fillRect(x + offset, 401, 29, 4);
    }
    this.mapViews.push(g, this.add.text(x, 344, name, { fontSize: '14px', color: '#fff6cb', stroke: '#56482f', strokeThickness: 3 }).setOrigin(0.5));
  }
  receive(message) {
    if(message.type==='ui-sound'){this.audio.sfx(message.sound);return;}
    if (message.type === 'notice') return this.ui.message(message.text);
    if (message.type === 'state') {
      const previous = this.snapshot;
      this.snapshot = message;
      this.audio.setMusic(message.mapId);
      if(previous&&this.ui.panel==='forge'){
        const f=message.forge,old=previous.forge;
        if(f?.step&&f.step.starts!==old?.step?.starts)this.audio.sfx('step');
        if(f&&f.status!=='running'&&old?.status==='running')this.audio.sfx(f.status);
      }
      Object.assign(this.rpg, message.self.rpg);
      if (this.room !== message.self.room) { this.buildMap(message.self.room); this.ui.close(); }
      if (!previous || previous.self.teleport !== message.self.teleport) {
        this.player.body.reset(message.self.x, message.self.y);
        this.player.setVelocity(0).setAccelerationX(0);
        this.player.lastGrounded = -Infinity; this.player.jumpQueued = -Infinity; this.controls.reset();
      }
      this.dead = this.rpg.hp <= 0;
      this.player.body.enable = !this.dead;
      this.selfLabel.setText(message.self.name);
      this.syncViews(message); this.ui.onSnapshot(); return;
    }
    if (message.room !== this.room) return;
    if (message.type === 'attack' || message.type === 'projectile-hit') {
      if(message.type==='attack')this.attackEffect(message.skill, message.x, message.y, message.direction,message.classId);
      if (message.player === this.client.id) this.player.attackUntil = this.time.now + 230;
      for (const hit of message.hits) this.floatText(hit.x, hit.y - 38, `${hit.damage}`);
      if (message.hits.length && Math.abs(message.x - this.player.x) < 650) this.audio.hit(message.skill);
    }
    if (message.type === 'hurt') {
      this.floatText(message.x, message.y - 36, `-${message.damage}`, '#ff8793');
      if (message.player === this.client.id) { this.player.hurtUntil = this.time.now + 800; this.cameras.main.shake(70, 0.002); }
    }
  }
  destroyView(view) { for (const value of Object.values(view)) if (value?.destroy) value.destroy(); }
  syncViews(state) {
    const reconcile = (collection, values, create, update) => {
      const ids = new Set(values.map(v => v.id));
      for (const [id, view] of collection) if (!ids.has(id)) { this.destroyView(view); collection.delete(id); }
      for (const value of values) { if (!collection.has(value.id)) collection.set(value.id, create(value)); update(collection.get(value.id), value); }
    };
    reconcile(this.remotePlayers, state.peers, p => ({
      sprite: this.add.sprite(p.x, p.y, 'player-0').setScale(3).setDepth(5).setTint(0xb7e9ee),
      label: this.add.text(p.x, p.y - 44, p.name, { fontSize: '12px', color: '#fffadd', stroke: '#345748', strokeThickness: 3 }).setOrigin(0.5).setDepth(8),
      weapon: this.add.graphics().setDepth(6)
    }), (view, p) => {
      view.sprite.setPosition(p.x, p.y).setFlipX(p.flipX).setAlpha(p.hp <= 0 ? 0.35 : 1).play(p.moving ? 'walk' : 'idle', true);
      view.label.setPosition(p.x, p.y - 42).setText(`${p.name} · Lv.${p.level}`);
      view.weapon.clear();
      if (p.weapon) view.weapon.fillStyle(ITEMS[p.weapon]?.color || 0xffffff).fillRect(p.x + (p.flipX ? -23 : 20), p.y - 20, 5, 30).fillStyle(0xd9b974).fillRect(p.x + (p.flipX ? -28 : 15), p.y + 8, 15, 4);
    });
    this.projectileViews ||= new Map();
    reconcile(this.projectileViews,state.projectiles||[],b=>({sprite:this.add.graphics().setDepth(9)}),(v,b)=>{const g=v.sprite;g.clear().setPosition(b.x,b.y).setScale(b.direction,1).fillStyle(b.color);if(b.kind==='arrow'){g.fillRect(-18,-2,32,4).fillTriangle(15,-7,26,0,15,7);}else if(b.kind==='star'){g.fillTriangle(-10,-10,10,10,-10,10).fillTriangle(-10,-10,10,-10,10,10).fillStyle(0xffffff).fillRect(-3,-3,6,6);}else g.fillCircle(0,0,b.kind==='fire'?13:10).fillStyle(0xffffff).fillCircle(-3,-3,4);});
    reconcile(this.monsters, state.enemies.filter(e => e.hp > 0), e => ({ sprite: new Enemy(this, e) }), (view, e) => view.sprite.sync(e));
    reconcile(this.dropViews, state.drops, d => {
      const key = `drop-${d.item || (d.potion ? 'potion' : 'gold')}`;
      return { sprite: this.add.image(d.x, d.y, key).setDepth(8), key,
        label: this.add.text(d.x, d.y - 25, d.item ? ITEMS[d.item].name : '戰利品', { fontSize: '11px', color: '#fff5c4', backgroundColor: '#375443' }).setOrigin(0.5).setDepth(8) };
    }, view => { if (this.textures.exists(view.key)) view.sprite.setTexture(view.key); });
  }
  update(time) {
    if (!this.ui) return;
    animateRoulette(this.ui, this.client?.now || Date.now());
    animateCoin(this.ui, this.client?.now || Date.now());
    animatePool(this.ui, this.client?.now || Date.now());
    animateForge(this.ui, this.client?.now || Date.now());
    for (const panel of ['equipment', 'inventory', 'skills', 'party', 'trade', 'settings', 'forge', 'casino', 'shop']) if (this.controls.just(panel)) this.ui.toggle(panel);
    if (this.controls.just('escape')) this.ui.close();
    if (this.client?.connected && !this.dead) {
      if (!this.ui.panel) {
        this.player.update(time);
        if ((this.controls.down('attack') || this.controls.just('attack')) && time >= (this.nextAttack || 0)) { this.performAction('attack'); this.nextAttack = time + 150; }
        for (const skill of ['wave', 'spin', 'potion']) if (this.controls.just(skill)) this.performAction(skill);
      } else { this.player.setVelocityX(0).setAccelerationX(0).play('idle', true); this.player.drawWeapon(time); }
      if (time >= (this.nextMove || 0)) {
        this.client.send('move', { x: this.player.x, y: this.player.y, flipX: this.player.flipX, moving: Math.abs(this.player.body.velocity.x) > 15 }); this.nextMove = time + 50;
      }
    } else this.player.setVelocity(0).setAccelerationX(0);
    this.selfLabel.setPosition(this.player.x, this.player.y - 43);
    this.controls.endFrame();
    if (time >= (this.nextUI || 0)) { this.ui.update(this.client?.now || Date.now()); this.nextUI = time + 100; }
  }
  weaponColor() { return ITEMS[this.rpg.equipment.weapon]?.color || 0xffffff; }
  performAction(id) {
    if (this.ui?.panel || this.dead || !this.client.connected) return;
    if (id === 'potion') this.client.send('potion');
    else if (this.room === 'village') this.ui.message('村莊是安全區。建立隊伍後，由隊長帶隊進入所選地圖。');
    else {
      this.client.send('move', { x: this.player.x, y: this.player.y, flipX: this.player.flipX, moving: Math.abs(this.player.body.velocity.x) > 15 });
      this.client.send('cast', { skill: id });
    }
  }
  floatText(x, y, message, color = '#fff1a4') {
    const text = this.add.text(x, y, message, { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '23px', fontStyle: 'bold', color, stroke: '#315347', strokeThickness: 4 }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: text, y: y - 55, alpha: 0, duration: 850, onComplete: () => text.destroy() });
  }
  attackEffect(id, x, y, direction,classId='warrior') {
    const g = this.add.graphics().setPosition(x, y).setDepth(9), skill = (CLASS_SKILLS[classId]||SKILLS)[id];
    if (skill?.projectile) {g.destroy();return;}
    if(classId==='mage'&&id==='spin'){g.lineStyle(6,skill.color).strokeEllipse(0,0,850,350);for(let i=-360;i<=360;i+=90)g.fillStyle(0xffffcc,0.6).fillRect(i,-170,12,340);this.tweens.add({targets:g,alpha:0,duration:650,onComplete:()=>g.destroy()});return;}
    if (!skill) { g.destroy(); return; }
    g.lineStyle(id === 'attack' ? 7 : 10, skill.color, 0.95);
    if (id === 'spin') g.strokeEllipse(0, 0, 240, 110).lineStyle(3, 0xffffff, 1).strokeEllipse(0, -6, 200, 90);
    else if (id === 'wave') {
      g.setScale(direction, 1).fillStyle(skill.color, 0.32).fillTriangle(10, -32, 260, 0, 10, 32);
      g.lineStyle(5, 0xeaffdf).lineBetween(20, 0, 250, 0);
      g.lineStyle(7, skill.color).beginPath().arc(65, 0, 46, -1.3, 1.3).strokePath();
    } else {
      g.setScale(direction, 1).beginPath().arc(15, 0, 65, -1.2, 1.2).strokePath();
      g.lineStyle(2, 0xffffff).beginPath().arc(15, 0, 54, -1.2, 1.2).strokePath();
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }
}
