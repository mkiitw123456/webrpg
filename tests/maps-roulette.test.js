import test from 'node:test';
import assert from 'node:assert/strict';
import World from '../server/World.js';
import Casino from '../server/Casino.js';
import { MAPS } from '../src/shared/maps.js';
import { REEL, numberColor, reelPosition } from '../src/shared/roulette.js';
test('leader selects themed instance with matching habitats, players and isolated rooms', () => {
  const w = new World();
  for (const [mapId,map] of Object.entries(MAPS)) {
    const a=w.connect(), b=w.connect();
    w.command(a,{type:'party-create'}); w.command(a,{type:'party-invite',target:b.id});
    w.command(b,{type:'party-answer',id:[...w.invites.keys()][0],accept:true});
    assert.throws(()=>w.command(b,{type:'dungeon-enter',mapId}));
    assert.throws(()=>w.command(a,{type:'dungeon-enter',mapId:'__proto__'}));
    w.command(a,{type:'dungeon-enter',mapId});
    assert.equal(a.room,b.room); const instance=w.instances.get(a.room);
    assert.equal(w.snapshot(b,0).mapId,mapId);
    assert.ok(instance.enemies.every(e=>map.kinds.includes(e.kind)));
    instance.enemies.forEach((e,i)=>assert.equal(e.y,map.habitats[i].y-(e.kind === 'slime' ? 16 : 28)));
    assert.deepEqual(instance.enemies.map(e=>e.left),map.habitats.map(h=>h.x+26));
  }
  assert.equal(w.instances.size,3);
});
test('roulette locks before revealing the motion target and settles the displayed number once', () => {
  const w=new World(); w.casino=new Casino(w,0,()=>12); const p=w.connect(); p.rpg.gold=100;
  const id=w.casino.roulette.id;
  w.command(p,{type:'casino-bet',game:'roulette',id,color:'black',amount:10},47999);
  w.casino.tick(47999); assert.equal(w.casino.snapshot(p).roulette.spin,undefined);
  w.casino.tick(48000); const spin=w.casino.roulette.spin;
  assert.equal(spin.slot,12); assert.ok(spin.starts>=48500&&spin.starts<=53500);
  assert.throws(()=>w.command(p,{type:'casino-bet',game:'roulette',id,color:'black',amount:10},48000));
  assert.equal(p.rpg.gold,90); w.casino.tick(59999); assert.equal(p.rpg.gold,90);
  w.casino.tick(60000); assert.equal(p.rpg.gold,110);
  const result=w.casino.history.find(h=>h.game==='roulette'); assert.equal(result.slot,12); assert.equal(result.color,'black');
  assert.equal(reelPosition(result.spin,60000)%15,REEL.indexOf(result.slot));
});
test('reel moves forward, slows smoothly to exact target, and varying impulse changes its path', () => {
  for (const slot of REEL) {
    const spin={slot,fromSlot:9,starts:1000,ends:10000,turns:7,power:3.5};
    assert.equal(reelPosition(spin,0),REEL.indexOf(9));
    assert.equal(reelPosition(spin,10000),105+REEL.indexOf(slot));
    assert.ok(reelPosition(spin,6000)>reelPosition(spin,5000));
    assert.ok(reelPosition(spin,9900)-reelPosition(spin,9800)<reelPosition(spin,2000)-reelPosition(spin,1900));
    assert.equal(reelPosition(spin,20000),reelPosition(spin,10000));
    assert.notEqual(reelPosition(spin,4000),reelPosition({...spin,turns:9,ends:11500},4000));
  }
  assert.equal(REEL.filter(n=>numberColor(n)==='red').length,7);
  assert.equal(REEL.filter(n=>numberColor(n)==='black').length,7);
});
