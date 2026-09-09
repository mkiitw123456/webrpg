import Accounts from './server/Accounts.js';
import World from './server/World.js';
import { defineConfig } from 'vite';
import { attachHub } from './server/hub.js';

export default defineConfig({
  plugins: [{
    name: 'little-leaf-multiplayer',
    async configureServer(server) {
      if (!server.httpServer) return;
      const world=new World(),accounts=new Accounts({file:'.local/accounts.json'});await accounts.init(world);
      const hub = attachHub(server.httpServer,{world,accounts});
      let saving=false;const timer=setInterval(async()=>{if(saving)return;saving=true;try{await accounts.save();world.persistenceError=false;}catch(e){world.persistenceError=true;console.error(e.message);}finally{saving=false;}},2000);
      server.httpServer.once('close',()=>{clearInterval(timer);accounts.close().catch(console.error);});
      server.middlewares.use(hub.http);
      server.httpServer.once('close', () => hub.close());
    },
    async configurePreviewServer(server) {
      const world=new World(),accounts=new Accounts({file:'.local/accounts.json'});await accounts.init(world);
      const hub = attachHub(server.httpServer,{world,accounts});
      let saving=false;const timer=setInterval(async()=>{if(saving)return;saving=true;try{await accounts.save();world.persistenceError=false;}catch(e){world.persistenceError=true;console.error(e.message);}finally{saving=false;}},2000);
      server.httpServer.once('close',()=>{clearInterval(timer);accounts.close().catch(console.error);});
      server.middlewares.use(hub.http);
      server.httpServer.once('close', () => hub.close());
    }
  }]
});
