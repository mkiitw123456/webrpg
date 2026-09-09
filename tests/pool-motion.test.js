import test from 'node:test';
import assert from 'node:assert/strict';
import World from '../server/World.js';
import Casino, { weightedWinner } from '../server/Casino.js';
import { poolAngle, poolShares } from '../src/shared/pool.js';

test('pool locks before motion is revealed and lands inside the paid winner sector, including interleaved bets', () => {
  for (const ticket of [0,39,40,59,60,99]) {
    const w=new World(); w.casino=new Casino(w,0,(min,max)=>max===100?ticket:0);
    const a=w.connect(),b=w.connect();a.rpg.gold=b.rpg.gold=1000;
    const id=w.casino.pool.id;
    for(const [p,amount] of [[a,40],[b,20],[a,40]])w.command(p,{type:'casino-bet',game:'pool',id,amount},0);
    w.casino.tick(47999);assert.equal(w.casino.pool.spin,undefined);
    w.casino.tick(48000);const r=w.casino.pool,spin=r.spin;
    assert.throws(()=>w.command(a,{type:'casino-bet',game:'pool',id,amount:1},48000));
    assert.equal(spin.winner,weightedWinner(r.bets,ticket));
    assert.ok(spin.ends-spin.starts>=6500&&spin.ends-spin.starts<=11500);
    assert.ok(spin.turns>=6&&spin.turns<=10);
    assert.ok(spin.targetAngle>(spin.winner===a.id?0:288));
    assert.ok(spin.targetAngle<(spin.winner===a.id?288:360));
    assert.equal(poolShares(r.bets).length,2);
    const finish=poolAngle(spin,60000);
    assert.ok(Math.abs((360-finish%360)%360-spin.targetAngle)<1e-8);
    w.casino.tick(59999);assert.equal(a.rpg.gold+b.rpg.gold,1900);
    w.casino.tick(60000);assert.equal(a.rpg.gold+b.rpg.gold,2000);
    const history=w.casino.history.find(h=>h.game==='pool');
    assert.equal(poolAngle(history.spin,60001),finish);
    assert.equal(history.winner,spin.winner);
    w.casino.tick(60001);assert.equal(a.rpg.gold+b.rpg.gold,2000);
  }
});
test('pool angular velocity tapers to zero and varying force and duration changes the path', () => {
  const spin={starts:1000,ends:10000,turns:8,power:3.7,targetAngle:310};
  assert.equal(poolAngle(spin,0),0);
  assert.ok(poolAngle(spin,5000)>poolAngle(spin,4000));
  assert.ok(poolAngle(spin,9900)-poolAngle(spin,9800)<poolAngle(spin,2000)-poolAngle(spin,1900));
  assert.ok(poolAngle(spin,10000)-poolAngle(spin,9999)<0.0001);
  assert.equal(poolAngle(spin,10000),poolAngle(spin,20000));
  assert.notEqual(poolAngle(spin,4000),poolAngle({...spin,ends:12000,turns:10},4000));
});
