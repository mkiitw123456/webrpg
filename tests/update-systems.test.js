import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Accounts from '../server/Accounts.js';
import World from '../server/World.js';
import RPGState from '../src/systems/RPGState.js';
import { FORGE_SUCCESS, FORGE_DESTROY, scaledMonster } from '../src/shared/progression.js';

test('accounts reject case-folded duplicates, persist progress, and allow another device after logout',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'leaf-accounts-')),file=join(dir,'save.json');let a;
 try{
  const w=new World();a=new Accounts({file,url:''});await a.init(w);
  const results=await Promise.allSettled([a.credentials({username:'Hero_1',password:'same-password',classId:'mage'},true),a.credentials({username:'hero_1',password:'same-password',classId:'rogue'},true)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  await a.credentials({username:'another',password:'same-password',classId:'archer'},true);
  await assert.rejects(a.credentials({username:'hero_1',password:'wrong-password'},false));
  const token=results.find(r=>r.status==='fulfilled').value.token,p=a.connect(token,Date.now());p.rpg.gold=54321;
  await assert.rejects(a.credentials({username:'hero_1',password:'same-password'},false),/正在/);
  p.rpg.hp=0;await a.save();w.disconnect(p);await a.close();
  const raw=await readFile(file,'utf8');assert.ok(!raw.includes('same-password'));assert.ok(!raw.includes(token));
  const next=new World();a=new Accounts({file,url:''});await a.init(next);
  const session=await a.credentials({username:'HERO_1',password:'same-password'},false);const restored=a.connect(session.token,Date.now());
  assert.equal(restored.id,p.id);assert.equal(restored.rpg.gold,54321);assert.equal(restored.rpg.classId,p.rpg.classId);
  next.tick(Date.now());assert.equal(restored.rpg.hp,restored.rpg.maxHp,'dead characters revive after loading a checkpoint');
 }finally{await a?.close();await rm(dir,{recursive:true,force:true});}
});
test('all 15 enhancement probabilities follow exact integer draw boundaries and finish once',()=>{
 for(let level=0;level<15;level++){
  let successes=0;
  for(let roll=0;roll<100;roll++){
   const w=new World(),p=w.connect();p.rpg.gold=1e9;p.rpg.enhancements.wood=level;let draw=0;
   w.forge.rng=(min,max)=>max===100?(draw++===0?roll:99):Math.floor((min+max-1)/2);
   w.forge.start(p,'wood',0);for(let t=0;t<90000&&p.forge.status==='running';t+=350)w.forge.tick(t);
   assert.notEqual(p.forge.status,'running');if(p.forge.status==='success')successes++;
  }
  assert.equal(successes,FORGE_SUCCESS[level]);
  let destroyed=0;
  if(FORGE_DESTROY[level])for(let roll=0;roll<100;roll++){
   const w=new World(),p=w.connect();p.rpg.gold=1e9;p.rpg.enhancements.wood=level;let draw=0;
   w.forge.rng=(min,max)=>max===100?(draw++===0?99:roll):Math.floor((min+max-1)/2);
   w.forge.start(p,'wood',0);for(let t=0;t<90000&&p.forge.status==='running';t+=350)w.forge.tick(t);if(p.forge.status==='destroyed')destroyed++;
  }
  assert.equal(destroyed,FORGE_DESTROY[level]);
 }
});
function enter(w,p){w.command(p,{type:'party-create'});w.command(p,{type:'dungeon-enter'});return w.instances.get(p.room);}
test('monsters scale from party extrema and rewards grow; shop prevents free gold and locked sales',()=>{
 const w=new World(),p=w.connect(),q=w.connect();p.rpg.level=10;q.rpg.level=20;
 w.command(p,{type:'party-create'});const party=w.parties.get(p.partyId);party.members.push(q.id);q.partyId=party.id;
 w.command(p,{type:'dungeon-enter'});assert.equal(w.instances.get(p.room).enemies[0].level,15);
 const low=scaledMonster('slime',1),high=scaledMonster('slime',20);for(const field of ['hp','exp','gold','dropRate'])assert.ok(high[field]>low[field]);
 w.leave(p);p.rpg.inventory=p.rpg.inventory.filter(id=>id!=='wood');p.rpg.equipment.weapon=null;
 w.command(p,{type:'shop-buy',item:'wood'});assert.equal(p.rpg.gold,0);assert.ok(p.rpg.inventory.includes('wood'));
 assert.throws(()=>w.command(p,{type:'shop-sell',item:'wood'}));
 p.rpg.gold=1000;w.command(p,{type:'shop-buy',item:'iron'});w.command(p,{type:'equip',item:'iron'});assert.throws(()=>w.command(p,{type:'shop-sell',item:'iron'}));
 w.command(p,{type:'unequip',slot:'weapon'});w.command(p,{type:'shop-sell',item:'iron'});assert.ok(p.rpg.gold<1000);assert.ok(!p.rpg.inventory.includes('iron'));
});
test('projectiles hit over time, piercing hits both, ice freezes, miracle attacks both directions',()=>{
 for(const cls of ['archer','rogue','mage']){
  const w=new World(),p=w.connect();p.rpg=new RPGState(cls);const instance=enter(w,p);
  instance.enemies=instance.enemies.slice(0,2);instance.enemies.forEach((e,i)=>{e.x=220+i*100;e.y=449;e.hp=e.maxHp=1000;e.left=e.x;e.right=e.x;});
  p.x=140;p.y=449;const now=Date.now();w.cast(p,cls==='archer'?'spin':'attack',now);assert.equal(instance.enemies[0].hp,1000);
  for(let t=now;t<now+1000;t+=50)w.tick(t,0.05);
  assert.ok(instance.enemies[0].hp<1000);
  assert.equal(instance.enemies[1].hp<1000,cls==='archer');
  if(cls==='mage'){assert.ok(instance.enemies[0].frozenUntil>now);instance.enemies[0].x=100;instance.enemies[1].x=200;const before=instance.enemies.map(e=>e.hp);w.cast(p,'spin',now+5000);assert.ok(instance.enemies.every((e,i)=>e.hp<before[i]));}
 }
});
