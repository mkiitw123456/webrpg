import test from 'node:test';
import assert from 'node:assert/strict';
import World from '../server/World.js';
import Casino from '../server/Casino.js';

test('forge growth lasts 350ms then pauses 500ms before another roll; one of ten rolls boosts', () => {
  for(let criticalRoll=0;criticalRoll<10;criticalRoll++) {
    const w=new World(),p=w.connect();p.rpg.gold=10000;
    w.forge.rng=(min,max)=>max===10?criticalRoll:min;
    w.command(p,{type:'forge',item:'wood'},0);w.forge.tick(0);
    const first=p.forge.step, value=p.forge.success;
    assert.equal(first.boosted,criticalRoll===0);
    assert.equal(value,first.base*(criticalRoll===0?2:1));
    w.forge.tick(349);w.forge.tick(350);w.forge.tick(849);
    assert.equal(p.forge.step,first);assert.equal(p.forge.success,value);
    w.forge.tick(850);assert.notEqual(p.forge.step,first);
    assert.equal(p.forge.segments[0].boosted,criticalRoll===0);
  }
});
function riskRun(level, save) {
  const w=new World(),p=w.connect();p.rpg.gold=100000;p.rpg.enhancements.wood=level;
  let draw=0;w.forge.rng=(min,max)=>{
    const part=draw++%3;if(part===1)return 9;
    const topWins=p.forge?.phase==='risk'&&save;
    return (part===0)===topWins?max-1:min;
  };
  w.command(p,{type:'forge',item:'wood'},0);
  let sawRisk=false;
  for(let now=0;now<40000;now+=50){w.forge.tick(now);if(p.forge.phase==='risk')sawRisk=true;}
  return {w,p,sawRisk};
}
test('target +6 is safe; target +7 can preserve equipment or destroy it', () => {
  const safe=riskRun(5,false);assert.equal(safe.sawRisk,false);assert.equal(safe.p.forge.status,'failure');
  const kept=riskRun(6,true);assert.equal(kept.sawRisk,true);assert.equal(kept.p.forge.status,'failure');assert.equal(kept.p.rpg.enhancements.wood,6);
  const broken=riskRun(6,false);assert.equal(broken.p.forge.status,'destroyed');
  assert.equal(broken.p.rpg.inventory.includes('wood'),false);assert.equal(broken.p.rpg.equipment.weapon,null);assert.equal(broken.p.rpg.enhancements.wood,undefined);assert.equal(broken.p.rpg.attack,12);
  const gold=broken.p.rpg.gold;broken.w.forge.tick(50000);assert.equal(broken.p.rpg.gold,gold);
  broken.p.rpg.addItem('wood');broken.p.rpg.equip('wood');assert.equal(broken.p.rpg.attack,12);
});
test('coin confirmation, ten second countdown, toss, exact-once payout and thirty minute retention', () => {
  const w=new World();w.casino=new Casino(w,0,()=>1);
  const a=w.connect(),b=w.connect(),viewer=w.connect();a.rpg.gold=b.rpg.gold=100;
  w.command(a,{type:'coin-create',side:'heads',amount:20},0);const room=[...w.casino.rooms.values()][0];
  assert.throws(()=>w.command(b,{type:'coin-join',id:room.id},1));assert.equal(b.rpg.gold,100);
  w.snapshot(viewer,1);assert.equal(viewer.rpg.gold,0);assert.equal(room.guest,null);
  w.command(b,{type:'coin-join',id:room.id,confirmed:true},1);
  assert.equal(room.status,'countdown');assert.equal(b.rpg.gold,80);
  assert.throws(()=>w.command(viewer,{type:'coin-join',id:room.id,confirmed:true},2));
  w.casino.tick(10000);assert.equal(room.status,'countdown');assert.equal(room.winningSide,undefined);
  w.casino.tick(10001);assert.equal(room.status,'flipping');assert.equal(room.winningSide,'tails');
  w.casino.tick(14000);assert.equal(b.rpg.gold,80);
  w.casino.tick(14001);assert.equal(room.status,'finished');assert.equal(room.winner,b.id);assert.equal(b.rpg.gold,120);
  w.casino.tick(15000);assert.equal(b.rpg.gold,120);
  assert.equal(w.casino.snapshot(viewer).rooms[0].winner,b.id);
  w.command(b,{type:'coin-create',side:'tails',amount:10},15001);
  w.casino.tick(room.removeAt-1);assert.equal(w.casino.rooms.has(room.id),true);
  w.casino.tick(room.removeAt);assert.equal(w.casino.rooms.has(room.id),false);
});
