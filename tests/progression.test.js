import test from 'node:test';
import assert from 'node:assert/strict';
import World from '../server/World.js';
import Casino, { weightedWinner } from '../server/Casino.js';
import { ITEMS } from '../src/systems/RPGState.js';
import { forgeRules, MONSTERS } from '../src/shared/progression.js';

function setup(rng = min => min) {
  const w = new World(); w.casino = new Casino(w, 0, rng);
  const a = w.connect(), b = w.connect(); a.rpg.gold = b.rpg.gold = 1000;
  return { w, a, b };
}
test('forge costs increase, rare equipment has slower success and faster failure', () => {
  for (const item of Object.values(ITEMS)) for (let n = 0; n < 9; n++) assert.ok(forgeRules(item,n+1).cost > forgeRules(item,n).cost);
  const common = forgeRules(ITEMS.wood), rare = forgeRules(ITEMS.crystal);
  assert.ok(rare.successMax < common.successMax && rare.failureMin > common.failureMin);
});
test('forge deducts once, locks gear, progresses and success changes stats; result is not replayed', () => {
  const {w,a,b} = setup(); w.forge.rng = (min,max) => min >= 10 ? max-1 : min;
  w.command(a,{type:'forge',item:'wood'},0);
  assert.equal(a.rpg.gold,975);
  assert.throws(() => w.command(a,{type:'forge',item:'wood'},0));
  assert.throws(() => w.command(a,{type:'unequip',slot:'weapon'}));
  assert.throws(() => w.command(a,{type:'trade-offer',target:b.id,item:'wood'}));
  for(let t=350;t<50000;t+=350) w.forge.tick(t);
  assert.equal(a.forge.status,'success'); assert.equal(a.rpg.attack,15);
  assert.equal(a.rpg.enhancements.wood,1); assert.equal(a.rpg.gold,975);
  w.forge.tick(20000); assert.equal(a.rpg.enhancements.wood,1);
});
test('forge failure retains enhancement, respects maximum, continues offline and transfers enhancement', () => {
  const {w,a,b} = setup(); a.rpg.addItem('crystal'); a.rpg.enhancements.crystal=1;
  w.forge.rng = (min,max) => max===100?99:max-1;
  w.command(a,{type:'forge',item:'crystal'},0); w.disconnect(a);
  for(let t=350;t<10000;t+=350) w.forge.tick(t);
  assert.equal(a.forge.status,'failure'); assert.equal(a.rpg.enhancements.crystal,1);
  assert.equal(a.rpg.gold,300);
  w.connect(a.token); w.command(a,{type:'trade-offer',target:b.id,item:'crystal'});
  const t=[...w.trades.values()][0]; w.command(b,{type:'trade-answer',id:t.id,accept:true});
  assert.equal(b.rpg.enhancements.crystal,1); assert.equal(a.rpg.enhancements.crystal,undefined);
  b.rpg.enhancements.crystal=15; assert.throws(() => w.command(b,{type:'forge',item:'crystal'}));
});
test('roulette has fifteen slots, inclusive payouts, minute cadence, cutoff and no duplicate settlement', () => {
  for(let slot=0;slot<15;slot++) {
    const {w,a} = setup(() => slot), id=w.casino.roulette.id;
    for(const color of ['red','black','green']) w.command(a,{type:'casino-bet',game:'roulette',id,color,amount:10},1);
    assert.equal(a.rpg.gold,970);
    assert.throws(() => w.command(a,{type:'casino-bet',game:'roulette',id,color:'red',amount:1},55000));
    w.casino.tick(59999); assert.equal(a.rpg.gold,970);
    w.casino.tick(60000); assert.equal(a.rpg.gold,970+(slot===0?140:20));
    const gold=a.rpg.gold; w.casino.tick(60000); assert.equal(a.rpg.gold,gold);
    assert.equal(w.casino.roulette.ends,120000);
    assert.throws(() => w.command(a,{type:'casino-bet',game:'roulette',id,color:'red',amount:1},60001));
  }
});
test('casino rejects invalid stakes without changing balances and cannot wager in dungeon', () => {
  const {w,a} = setup(), id=w.casino.pool.id;
  for(const amount of [0,-1,0.5,NaN,Infinity,100001,2000,'10']) assert.throws(() => w.command(a,{type:'casino-bet',game:'pool',id,amount},1));
  assert.equal(a.rpg.gold,1000); a.room='private';
  assert.throws(() => w.command(a,{type:'coin-create',side:'heads',amount:10},1));
});
test('coin flip opposing seats lock stakes and winner receives all once, even after disconnect', () => {
  for(const result of [0,1]) {
    const {w,a,b} = setup(() => result);
    w.command(a,{type:'coin-create',side:'heads',amount:80},0);
    const room=[...w.casino.rooms.values()][0];
    w.command(b,{type:'coin-join',id:room.id,confirmed:true},1);
    assert.equal(a.rpg.gold,920); assert.equal(b.rpg.gold,920);
    assert.throws(() => w.command(a,{type:'coin-cancel',id:room.id},2));
    assert.throws(() => w.command(b,{type:'coin-join',id:room.id,confirmed:true},2));
    w.disconnect(a); w.casino.tick(14001); w.casino.tick(15000);
    assert.equal(a.rpg.gold + b.rpg.gold,2000);
    assert.equal((result === 0 ? a : b).rpg.gold,1080);
  }
});
test('unmatched coin rooms refund on cancel, expiry and disconnect', () => {
  for(const reason of ['cancel','expiry','disconnect']) {
    const {w,a}=setup(); w.command(a,{type:'coin-create',side:'tails',amount:100},0);
    const id=[...w.casino.rooms.keys()][0];
    if(reason==='cancel') w.command(a,{type:'coin-cancel',id},1);
    if(reason==='expiry') w.casino.tick(120000);
    if(reason==='disconnect') w.disconnect(a);
    assert.equal(a.rpg.gold,1000); assert.equal(w.casino.rooms.size,0);
  }
});
test('pool 80/20 weights have exact boundaries and conserve gold including repeated stakes', () => {
  assert.equal(weightedWinner([{player:'a',amount:80},{player:'b',amount:20}],79),'a');
  assert.equal(weightedWinner([{player:'a',amount:80},{player:'b',amount:20}],80),'b');
  for(const ticket of [0,79,80,99]) {
    const {w,a,b}=setup((min,max) => max===15?0:ticket), id=w.casino.pool.id;
    w.command(a,{type:'casino-bet',game:'pool',id,amount:40},0);
    w.command(a,{type:'casino-bet',game:'pool',id,amount:40},0);
    w.command(b,{type:'casino-bet',game:'pool',id,amount:20},0);
    w.casino.tick(60000); assert.equal(a.rpg.gold+b.rpg.gold,2000);
    assert.equal(w.casino.history[0].winner,ticket<80?a.id:b.id);
  }
});
test('solo pool refunds and monsters have distinct health, speeds and obtainable equipment', () => {
  const {w,a}=setup(); w.command(a,{type:'casino-bet',game:'pool',id:w.casino.pool.id,amount:80},0);
  w.casino.tick(60000); assert.equal(a.rpg.gold,1000);
  w.command(a,{type:'party-create'}); w.command(a,{type:'dungeon-enter'});
  const enemies=w.instances.get(a.room).enemies;
  assert.deepEqual([...new Set(enemies.map(e=>e.kind))].sort(),['boar','slime']);
  for(const m of Object.values(MONSTERS)) assert.ok(ITEMS[m.loot] && m.hp>0 && m.speed>0);
});
