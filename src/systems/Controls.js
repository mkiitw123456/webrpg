export const DEFAULT_BINDINGS = {
  left: 'ArrowLeft', right: 'ArrowRight', jump: 'Space', attack: 'KeyJ', wave: 'KeyK', spin: 'KeyL',
  potion: 'KeyR', equipment: 'KeyE', inventory: 'KeyI', skills: 'KeyC', party: 'KeyP', trade: 'KeyT', settings: 'KeyO', forge: 'KeyF', casino: 'KeyB', shop:'KeyM'
};
export const ACTION_NAMES = {
  left: '向左移動', right: '向右移動', jump: '跳躍', attack: '普攻', wave: '翠葉劍氣', spin: '旋風斬',
  potion: '恢復藥水', equipment: '穿戴裝備', inventory: '背包', skills: '技能書', party: '組隊與副本', trade: '物品贈送', settings: '按鍵與音效設定', forge: '強化工坊', casino: '金幣遊戲館',shop:'武器裝備商店'
};
export function keyLabel(code) { return ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space' })[code] || code.replace(/^Key|^Digit/, ''); }
export function rebind(bindings, action, code) {
  if (!Object.hasOwn(DEFAULT_BINDINGS, action) || !/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space)$/.test(code)) return { error: '請使用英文字母、數字、方向鍵或空白鍵；Esc 保留為關閉。' };
  const conflict = Object.keys(bindings).find(id => id !== action && bindings[id] === code);
  if (conflict) return { error: `此按鍵已用於「${ACTION_NAMES[conflict]}」，請先修改該操作。` };
  return { bindings: { ...bindings, [action]: code } };
}
export default class Controls {
  constructor() {
    this.bindings = { ...DEFAULT_BINDINGS };
    try {
      const saved = JSON.parse(localStorage.getItem('little-leaf-keys'));
      if (saved && Object.entries(saved).every(([id, code]) => typeof code === 'string' && !rebind(saved, id, code).error)) {
        const merged = { ...saved };
        for (const [id, code] of Object.entries(DEFAULT_BINDINGS)) if (!merged[id]) {
          merged[id] = [code, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').map(c => /[0-9]/.test(c) ? 'Digit' + c : 'Key' + c)].find(c => !Object.values(merged).includes(c));
        }
        this.bindings = merged;
      }
    } catch { /* Use defaults for invalid storage. */ }
    this.held = new Set(); this.pressed = new Set(); this.released = new Set();
    this.abort = new AbortController();
    window.addEventListener('keydown', event => {
      if (event.target.closest?.('input,select,textarea') || event.ctrlKey || event.metaKey || event.altKey) return;
      if (this.capture) {
        event.preventDefault();
        if (!event.repeat) { const callback = this.capture; this.capture = null; callback(event.code); }
        return;
      }
      if (Object.values(this.bindings).includes(event.code) || event.code === 'Escape') {
        event.preventDefault();
        if (!this.held.has(event.code)) this.pressed.add(event.code);
        this.held.add(event.code);
      }
    }, { signal: this.abort.signal });
    window.addEventListener('keyup', event => { this.held.delete(event.code); this.released.add(event.code); }, { signal: this.abort.signal });
    window.addEventListener('blur', () => this.reset(), { signal: this.abort.signal });
  }
  label(id) { return keyLabel(this.bindings[id]); }
  down(id) { return this.held.has(this.bindings[id]); }
  just(id) { const code = id === 'escape' ? 'Escape' : this.bindings[id]; return this.pressed.delete(code); }
  up(id) { return this.released.delete(this.bindings[id]); }
  endFrame() { this.pressed.clear(); this.released.clear(); }
  reset() { this.held.clear(); this.endFrame(); }
  set(action, code) {
    const result = rebind(this.bindings, action, code);
    if (result.error) return result.error;
    this.bindings = result.bindings; this.save(); this.reset(); return null;
  }
  restore() { this.bindings = { ...DEFAULT_BINDINGS }; this.save(); this.reset(); }
  save() { try { localStorage.setItem('little-leaf-keys', JSON.stringify(this.bindings)); } catch { /* Session changes still work. */ } }
  destroy() { this.abort.abort(); }
}
