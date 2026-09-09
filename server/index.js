import Accounts from './Accounts.js';
import World from './World.js';
import { createServer } from 'node:http';
import { attachHub } from './hub.js';

if(process.env.NODE_ENV==='production'&&!process.env.DATABASE_URL)throw Error('正式伺服器必須設定 DATABASE_URL');
const world=new World(),accounts=new Accounts();await accounts.init(world);
let saving=false;const saveTimer=setInterval(async()=>{if(saving)return;saving=true;try{await accounts.save();world.persistenceError=false;}catch(e){world.persistenceError=true;console.error('Save failed:',e.message);}finally{saving=false;}},2000);
const server = createServer((req, res) => {
  hub.http(req, res, () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'Little Leaf multiplayer', status: 'ok' }));
  });
});
const hub = attachHub(server, { world, accounts, origins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean) });
const port = Number(process.env.PORT || 8787);
server.listen(port, '0.0.0.0', () => console.log(`Little Leaf multiplayer listening on ${port}`));
const shutdown = async () => { clearInterval(saveTimer);hub.close();server.close();try{await accounts.close();}catch(e){console.error(e.message);} };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
