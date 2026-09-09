export default class GameClient {
  constructor(onMessage, onStatus) {
    this.onMessage = onMessage; this.onStatus = onStatus;
    this.closed = false; this.connected = false; this.commands = [];
    this.abort = new AbortController();
    try { this.token = sessionStorage.getItem('little-leaf-session'); } catch { this.token = null; }
    const endpoint = import.meta.env.VITE_GAME_SERVER || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/multiplayer`;
    this.wsURL = endpoint;
    this.httpURL = endpoint.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');
    window.addEventListener('pagehide', () => this.destroy(), { signal: this.abort.signal });
    this.connect();
  }
  receive(message) {
    if(message.type==='auth-error'){this.destroy();sessionStorage.removeItem('little-leaf-session');window.alert(message.text);location.reload();return;}
    if (message.type === 'welcome') {
      this.token = message.token; this.id = message.id;
      try { sessionStorage.setItem('little-leaf-session', this.token); } catch { /* Storage optional. */ }
    }
    if (message.type === 'state') { if(!this.connected)this.onStatus('已連上小葉村。按組隊建立隊伍，或等待朋友加入。');this.connected = true; this.offset = message.now - Date.now(); clearTimeout(this.fallbackTimer); }
    this.onMessage(message);
  }
  connect() {
    if (this.closed) return;
    this.onStatus('正在連接村莊…'); this.mode = 'ws';
    this.ws = new WebSocket(this.wsURL);
    this.ws.onopen = () => this.ws.send(JSON.stringify({ type: 'hello', token: this.token }));
    this.ws.onmessage = event => this.receive(JSON.parse(event.data));
    this.ws.onclose = () => { if (!this.closed && this.mode === 'ws') this.startHTTP(); };
    this.ws.onerror = () => {};
    this.fallbackTimer = setTimeout(() => { if (!this.connected) this.startHTTP(); }, 2000);
  }
  async request(path, data) {
    const response = await fetch(this.httpURL + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(5000)
    });
    const result = await response.json();
    if (!response.ok) {const error=new Error(result.error || '連線暫時中斷');error.status=response.status;throw error;}
    return result;
  }
  async startHTTP() {
    if (this.closed || this.mode === 'http') return;
    this.mode = 'http'; this.connected = false; this.commands = [];
    clearTimeout(this.fallbackTimer); this.ws?.close();
    this.onStatus('正在使用相容同步連接村莊…');
    this.httpConnect();
  }
  async httpConnect() {
    if (this.closed) return;
    try {
      const messages = await this.request('/connect', { token: this.token });
      if (this.closed) return;
      messages.forEach(m => this.receive(m));
      this.onStatus('已連上小葉村。按組隊建立隊伍，或等待朋友加入。');
      this.poll();
    } catch (error) {
      if(error.status===401){this.receive({type:'auth-error',text:error.message});return;}
      console.error('Multiplayer connect:', error.message);
      if (!this.closed) { this.onStatus('無法連接多人伺服器，2 秒後重試。'); this.retry = setTimeout(() => this.httpConnect(), 2000); }
    }
  }
  async poll() {
    if (this.closed) return;
    try {
      const messages = await this.request('/sync', { token: this.token, commands: this.commands.splice(0, 25) });
      if (this.closed) return;
      messages.forEach(m => this.receive(m));
      this.retry = setTimeout(() => this.poll(), 100);
    } catch (error) {
      console.error('Multiplayer sync:', error.message);
      this.connected = false; this.commands = [];
      this.onStatus('連線中斷，正在嘗試恢復。');
      // 保留同一 session 重試，避免延遲回應造成重複角色。
      if (!this.closed) this.retry = setTimeout(async () => {
        try { const messages = await this.request('/sync', { token: this.token, commands: [] }); messages.forEach(m => this.receive(m)); this.poll(); }
        catch { this.httpConnect(); }
      }, 1000);
    }
  }
  get now() { return Date.now() + (this.offset || 0); }
  send(type, values = {}) {
    if (!this.connected || this.closed) return false;
    const command = { ...values, type };
    if (this.mode === 'http') {
      if (type === 'move') {
        const existing = this.commands.findIndex(m => m.type === 'move');
        if (existing >= 0) { this.commands[existing] = command; return true; }
      }
      if (this.commands.length < 25) this.commands.push(command);
      return true;
    }
    if (this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(command)); return true;
  }
  destroy() {
    if (this.closed) return;
    this.closed = true; clearTimeout(this.retry); clearTimeout(this.fallbackTimer); this.abort.abort();
    if (this.mode === 'http' && this.token) fetch(this.httpURL + '/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: this.token }), keepalive: true }).catch(() => {});
    this.ws?.close();
  }
}
