import test from 'node:test';
import assert from 'node:assert/strict';
import {raceIncrement,advanceRace} from '../src/shared/forgeRace.js';
import {FORGE_SUCCESS,FORGE_DESTROY,forgeRules} from '../src/shared/progression.js';
import {horizontalVelocity,doubleJumpVelocity} from '../src/shared/movement.js';
import World from '../server/World.js';
import {ITEMS} from '../src/systems/RPGState.js';

test('independent races match every target rate, including conditional destruction',t=>{
  let seed=927435;
  const rng=(min,max)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return min+Math.floor(seed/4294967296*(max-min));};
  const rates=[];
  for(let level=0;level<15;level++)for(const risk of [false,true]){
    if(risk&&!FORGE_DESTROY[level])continue;
    const rules=forgeRules(ITEMS.wood,level);let wins=0;
    for(let trial=0;trial<100000;trial++){
      let a=0,b=0;
      for(let step=0;step<100;step++){
        const inc=raceIncrement(rules,risk,rng),next=advanceRace(a,b,inc.success,inc.failure);
        assert.ok(next.success>a&&next.failure>b,'both bars advance without caps');
        a=next.success;b=next.failure;
        if(next.outcome){wins+=next.outcome==='top'?1:0;break;}
        assert.ok(step<99,'race must finish');
      }
    }
    const actual=wins/1000,target=risk?100-FORGE_DESTROY[level]:FORGE_SUCCESS[level];
    assert.ok(Math.abs(actual-target)<0.75,`${level+1} risk=${risk}: ${actual} vs ${target}`);
    if(!risk)rates.push(actual.toFixed(2));
  }
  t.diagnostic('Success % for +1…+15: '+rates.join(', '));
});
test('93% failure bar keeps moving and can win against 40% success',()=>{
  const w=new World(),p=w.connect();p.rpg.gold=100000;p.rpg.enhancements.wood=6;
  w.forge.start(p,'wood',0);p.forge.success=40;p.forge.failure=93;
  w.forge.rng=(min,max)=>max-1;w.forge.tick(0);
  assert.equal(p.forge.failure,100);assert.equal(p.forge.step.outcome,'bottom');
  assert.ok(p.forge.success<50);
  w.forge.tick(350);assert.equal(p.forge.pendingRisk,true);
});
test('air momentum decays continuously at 30, 60, and 120 fps, with controlled reversal',()=>{
  const launch=doubleJumpVelocity(250,1);assert.equal(launch,490);
  assert.equal(doubleJumpVelocity(-250,-1),-490);
  assert.ok(doubleJumpVelocity(500,1)>=500);
  for(const fps of [30,60,120]){
    let v=launch;
    for(let frame=0;frame<fps/2;frame++){
      const next=horizontalVelocity(v,1,false,1/fps);
      assert.ok(v-next<=260/fps+1e-9);v=next;
    }
    assert.ok(Math.abs(v-360)<1e-8,'no timed 250 speed clamp');
    assert.ok(horizontalVelocity(v,0,false,1/fps)>v-7,'releasing direction preserves air momentum');
    assert.ok(horizontalVelocity(v,-1,false,1/fps)<v,'opposite input brakes');
  }
});
