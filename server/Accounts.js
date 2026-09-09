import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import pg from 'pg';
import RPGState from '../src/systems/RPGState.js';
import { CLASSES } from '../src/shared/classes.js';
const scrypt=promisify(scryptCallback);
export default class Accounts {
  constructor({url=process.env.DATABASE_URL,file=process.env.SAVE_FILE||'.local/accounts.json'}={}) {this.url=url;this.file=file;this.sessions=new Map();this.queue=Promise.resolve();this.attempts=new Map();}
  async init(world) {
    this.world=world;
    if(this.url){
      this.pool=new pg.Pool({connectionString:this.url,max:2,connectionTimeoutMillis:15000});
      await this.pool.query('CREATE TABLE IF NOT EXISTS rpg_accounts (id uuid PRIMARY KEY, username text UNIQUE NOT NULL, password_hash text NOT NULL, salt text NOT NULL, class_id text NOT NULL)');
      await this.pool.query('CREATE TABLE IF NOT EXISTS rpg_checkpoint (id integer PRIMARY KEY CHECK(id=1), epoch bigint NOT NULL DEFAULT 0, data jsonb NOT NULL)');
      const {rows}=await this.pool.query("INSERT INTO rpg_checkpoint(id,epoch,data) VALUES(1,1,'{}') ON CONFLICT(id) DO UPDATE SET epoch=rpg_checkpoint.epoch+1 RETURNING epoch,data");
      this.epoch=rows[0].epoch;this.restore(rows[0].data);
    } else {
      await mkdir(dirname(this.file),{recursive:true});
      try {const data=JSON.parse(await readFile(this.file,'utf8'));this.localAccounts=data.accounts||[];this.restore(data.world||{});}catch(e){if(e.code!=='ENOENT')throw e;this.localAccounts=[];}
    }
  }
  restore(data) {
    const w=this.world;
    for(const saved of data.players||[]){const rpg=Object.assign(new RPGState(saved.rpg.classId),saved.rpg);const p={...saved,rpg,online:false,token:randomBytes(24).toString('hex'),partyId:null,room:'village',x:140,y:449,flipX:false,moving:false,hurtUntil:0,reviveAt:0,disconnectedAt:Date.now()};w.players.set(p.id,p);}
    if(data.casino){const {roulette,pool,rooms,history}=data.casino;if(roulette)w.casino.roulette=roulette;if(pool)w.casino.pool=pool;w.casino.history=history||[];w.casino.rooms=new Map(rooms||[]);}
    // Unmatched reservations are refunded on restart, matched rounds resume.
    for(const p of w.players.values())w.casino.disconnect(p);
  }
  checkpoint() {
    const w=this.world;
    return {players:[...w.players.values()].filter(p=>p.account).map(p=>({id:p.id,account:true,name:p.name,rpg:p.rpg,forge:p.forge,teleport:0})),casino:{roulette:w.casino.roulette.bets.length?w.casino.roulette:null,pool:w.casino.pool.bets.length?w.casino.pool:null,rooms:[...w.casino.rooms],history:w.casino.history}};
  }
  serialize(fn) {const next=this.queue.then(fn);this.queue=next.catch(()=>{});return next;}
  save() {return this.serialize(async()=>{
    const data=this.checkpoint(), serialized=JSON.stringify(data);if(this.lastSave===serialized)return;
    if(this.pool){const result=await this.pool.query('UPDATE rpg_checkpoint SET data=$1 WHERE id=1 AND epoch=$2',[JSON.stringify(data),this.epoch]);if(!result.rowCount)throw Error('此程序已由新部署取代');}
    else {await writeFile(this.file+'.tmp',JSON.stringify({accounts:this.localAccounts,world:data}));await rename(this.file+'.tmp',this.file);}
    this.lastSave=serialized;
  });}
  async credentials({username,password,classId},register) {
    username=typeof username==='string'?username.trim().toLowerCase():'';
    if(!/^[a-z0-9_]{3,24}$/.test(username))throw Error('帳號請使用 3～24 個英數字或底線（不分大小寫）。');
    if(typeof password!=='string'||password.length<8||password.length>128)throw Error('密碼請使用 8～128 個字元。');
    if(register&&!Object.hasOwn(CLASSES,classId))throw Error('請選擇職業。');
    const salt=randomBytes(16).toString('hex');
    if(register){
      const password_hash=(await scrypt(password,salt,64)).toString('hex'),account={id:randomUUID(),username,password_hash,salt,class_id:classId};
      if(this.pool){try{await this.pool.query('INSERT INTO rpg_accounts(id,username,password_hash,salt,class_id) VALUES($1,$2,$3,$4,$5)',Object.values(account));}catch(e){if(e.code==='23505')throw Error('此帳號已被使用。');throw e;}}
      else await this.serialize(async()=>{if(this.localAccounts.some(a=>a.username===username))throw Error('此帳號已被使用。');this.localAccounts.push(account);await writeFile(this.file+'.tmp',JSON.stringify({accounts:this.localAccounts,world:this.checkpoint()}));await rename(this.file+'.tmp',this.file);});
      return this.session(account);
    }
    const account=this.pool?(await this.pool.query('SELECT * FROM rpg_accounts WHERE username=$1',[username])).rows[0]:this.localAccounts.find(a=>a.username===username);
    const actual=await scrypt(password,account?.salt||salt,64);
    if(!account||!timingSafeEqual(actual,Buffer.from(account.password_hash,'hex')))throw Error('帳號或密碼不正確。');
    return this.session(account);
  }
  session(account) {
    const existing=this.world.players.get(account.id);if(existing?.online)throw Error('此帳號正在遊戲中，請先從另一個裝置登出。');
    const token=randomBytes(32).toString('hex');
    for(const [t,s]of this.sessions)if(s.account.id===account.id)this.sessions.delete(t);
    this.sessions.set(token,{account,expires:Date.now()+86400000});return {token};
  }
  connect(token,now) {
    const session=this.sessions.get(token);if(!session||session.expires<now)throw Error('登入已失效，請重新登入。');
    const w=this.world,a=session.account;let p=w.players.get(a.id);
    if(p?.online)throw Error('此帳號已在另一個連線使用。');
    if(!p){p=w.connect(null,now);w.players.delete(p.id);w.tokens.delete(p.token);p.id=a.id;p.account=true;p.name=a.username;p.rpg=new RPGState(a.class_id);w.players.set(p.id,p);}
    w.tokens.delete(p.token);p.token=token;w.tokens.set(token,p.id);p.online=true;p.moveAt=now;return p;
  }
  async auth(path,m,ip) {
    const now=Date.now();for(const[k,v]of this.attempts)if(v.until<now)this.attempts.delete(k);
    const attempts=this.attempts.get(ip)||{count:0,until:now+60000};this.attempts.set(ip,attempts);
    if(++attempts.count>15||this.attempts.size>5000)throw Error('登入嘗試過於頻繁，請稍後再試。');
    return this.credentials(m,path.endsWith('/register'));
  }
  async close(){await this.save();await this.pool?.end();}
}
