import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { adminHTTP } from '../server/admin.js';
test('admin requires secret, omits sessions, validates balance and detects stale edits', async () => {
  const saved=process.env.ADMIN_TOKEN; process.env.ADMIN_TOKEN='a'.repeat(40);
  const world={players:new Map([['one',{id:'one',name:'Test',token:'private',online:true,rpg:{gold:10}}]])};
  const server=createServer((req,res)=>adminHTTP(world,req,res));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  const headers={Authorization:'Bearer '+'a'.repeat(40),'Content-Type':'application/json'};
  try {
    assert.equal((await fetch(url+'/admin/players')).status,401);
    const players=await (await fetch(url+'/admin/players',{headers})).json(); assert.equal(players[0].token,undefined);
    const post=body=>fetch(url+'/admin/gold',{method:'POST',headers,body:JSON.stringify(body)});
    assert.equal((await post({id:'one',gold:-1,previousGold:10})).status,400);
    assert.equal((await post({id:'one',gold:500,previousGold:9})).status,409);
    assert.equal((await post({id:'one',gold:500,previousGold:10})).status,200);
    assert.equal(world.players.get('one').rpg.gold,500);
    delete process.env.ADMIN_TOKEN; assert.equal((await fetch(url+'/admin/players',{headers})).status,401);
  } finally { if(saved===undefined)delete process.env.ADMIN_TOKEN;else process.env.ADMIN_TOKEN=saved; await new Promise(r=>server.close(r)); }
});
