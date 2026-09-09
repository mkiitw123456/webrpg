export const CLASSES = { warrior:'劍士', archer:'弓箭手', mage:'法師', rogue:'盜賊' };
export const STARTER = {warrior:'wood',archer:'bow',mage:'staff',rogue:'claw'};
export const CLASS_SKILLS = {
  archer: {
    attack:{name:'普通射箭',mp:0,cooldown:450,range:480,height:65,multiplier:1,color:0xc6f28c,projectile:'arrow',speed:700,count:1},
    wave:{name:'二連箭',mp:10,cooldown:1600,range:500,height:65,multiplier:0.95,color:0x9bffd3,projectile:'arrow',speed:760,count:2},
    spin:{name:'貫穿箭',mp:18,cooldown:3200,range:900,height:75,multiplier:2.1,color:0xffd68c,projectile:'arrow',speed:900,count:1,pierce:true}
  },
  rogue: {
    attack:{name:'普通投擲',mp:0,cooldown:380,range:420,height:65,multiplier:1,color:0xe4d7ff,projectile:'star',speed:800,count:1},
    wave:{name:'二連鏢',mp:10,cooldown:1400,range:460,height:65,multiplier:1,color:0xc8adff,projectile:'star',speed:850,count:2},
    spin:{name:'二段跳',mp:0,cooldown:0,range:0,height:0,multiplier:0,color:0xc8adff,passive:true}
  },
  mage: {
    attack:{name:'冰凍術',mp:0,cooldown:650,range:400,height:85,multiplier:1.15,color:0xa5edff,projectile:'ice',speed:550,count:1,freeze:1800},
    wave:{name:'火球',mp:12,cooldown:1700,range:560,height:90,multiplier:2,color:0xff995e,projectile:'fire',speed:500,count:1},
    spin:{name:'奇蹟',mp:28,cooldown:4500,range:430,height:360,multiplier:2.6,color:0xffffc0,area:true}
  }
};
export function shopBuyPrice(item) {return item.starter ? 0 : 60*(item.level||1)**2;}
export function shopSellPrice(item, level=0) {return item.starter ? 0 : Math.floor(shopBuyPrice(item)*0.3)+level*15;}
