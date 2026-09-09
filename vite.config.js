import { defineConfig } from 'vite';
import { attachHub } from './server/hub.js';

export default defineConfig({
  plugins: [{
    name: 'little-leaf-multiplayer',
    configureServer(server) {
      if (!server.httpServer) return;
      const hub = attachHub(server.httpServer);
      server.middlewares.use(hub.http);
      server.httpServer.once('close', () => hub.close());
    },
    configurePreviewServer(server) {
      const hub = attachHub(server.httpServer);
      server.middlewares.use(hub.http);
      server.httpServer.once('close', () => hub.close());
    }
  }]
});
