import { CLASSES } from '../shared/classes.js';
export function serverEndpoint() {return import.meta.env.VITE_GAME_SERVER || `${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/multiplayer`;}
export async function loginScreen() {
  // Login is explicit on every page load; passwords are never stored locally.
  sessionStorage.removeItem('little-leaf-session');
  return new Promise(resolve=>{
    const root=document.createElement('div');root.className='auth-screen';
    root.innerHTML=`<form class="auth-card"><small>LITTLE LEAF · 小葉物語</small><h1>回到你的冒險</h1><p>使用同一組帳號，在不同裝置繼續旅程。</p><label>帳號<input name="username" autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+" required placeholder="3～24 個英數字或底線"></label><label>密碼<input name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required placeholder="至少 8 個字元"></label><label class="register-only" hidden>初始職業<select name="classId">${Object.entries(CLASSES).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><p class="auth-status" role="status"></p><button type="submit">登入遊戲</button><button type="button" class="auth-switch">沒有帳號？建立帳號</button><p>帳號不分大小寫且不可重複。每個帳號一位角色，同時間只能在一個裝置遊玩。</p></form>`;
    document.body.append(root);let register=false;
    const form=root.querySelector('form'),status=root.querySelector('.auth-status'),submit=root.querySelector('[type=submit]');
    root.querySelector('.auth-switch').onclick=()=>{register=!register;root.querySelector('.register-only').hidden=!register;submit.textContent=register?'建立帳號並進入':'登入遊戲';root.querySelector('.auth-switch').textContent=register?'已有帳號？返回登入':'沒有帳號？建立帳號';status.textContent='';};
    form.onsubmit=async event=>{
      event.preventDefault();submit.disabled=true;status.textContent='連接中，免費主機首次喚醒可能需要約一分鐘…';
      try {
        const endpoint=serverEndpoint().replace(/^ws:/,'http:').replace(/^wss:/,'https:');
        const response=await fetch(endpoint+'/auth/'+(register?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form))),signal:AbortSignal.timeout(90000)});
        const result=await response.json();if(!response.ok)throw Error(result.error||'登入失敗');
        sessionStorage.setItem('little-leaf-session',result.token);form.reset();root.remove();resolve();
      }catch(e){status.textContent=e.message;}finally{submit.disabled=false;}
    };
  });
}
