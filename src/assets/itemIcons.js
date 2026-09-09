import { ITEMS } from '../systems/RPGState.js';
import { coinIcon } from './coinIcon.js';

const cache = new Map();
export function itemIcon(id) {
  if (id === 'gold') return coinIcon('heads');
  if (cache.has(id)) return cache.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const c = canvas.getContext('2d');
  const r = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  const item = ITEMS[id];
  if(item?.classId==='archer') {
    const color='#'+item.color.toString(16).padStart(6,'0');for(let y=3;y<29;y++){const x=10+Math.round(Math.sin((y-3)/26*Math.PI)*10);r(x,y,3,1,color);}r(11,3,1,26,'#f1ead1');r(6,15,20,2,'#896b40');r(24,13,3,6,'#e7f8e6');
  } else if(item?.classId==='mage') {r(14,10,4,20,'#94724b');r(9,4,14,10,'#325b77');r(11,3,10,10,'#a5e4ff');r(13,4,3,5,'#ffffff');
  } else if(item?.classId==='rogue') {r(6,12,17,14,'#816795');r(8,13,13,9,'#c2a3de');r(20,6,3,15,'#e3eff5');r(24,9,3,15,'#adbac9');
  } else if (item?.slot === 'weapon') {
    const color = '#' + item.color.toString(16).padStart(6, '0');
    r(14, 2, 5, 21, '#365345'); r(15, 3, 3, 18, color);
    r(15, 3, 1, 17, id === 'wood' ? '#e1b77c' : '#f3ffef');
    r(9, 21, 15, 3, '#e6b65c'); r(14, 24, 5, 6, '#684735');
    r(14, 29, 5, 2, '#deb65c');
    if (id === 'leaf') { r(18, 7, 6, 3, '#77c980'); r(20, 4, 4, 3, '#b9e797'); r(13, 10, 2, 7, '#5a9562'); }
    if (id === 'iron') { r(13, 5, 2, 13, '#82a6b0'); r(15, 22, 3, 2, '#73bed5'); }
    if (id === 'copper') { r(11, 5, 4, 15, '#ad603e'); r(18, 5, 4, 15, '#e69762'); r(11, 5, 2, 14, '#f9c08d'); }
    if (id === 'crystal') { r(11, 6, 4, 12, '#53a4d0'); r(18, 6, 4, 12, '#80dbfa'); r(12, 11, 9, 3, '#e0fdff'); r(15, 21, 4, 4, '#bc94ee'); }
  } else if (item?.slot === 'armor') {
    r(9, 5, 15, 23, '#3f5946'); r(4, 7, 7, 10, '#3f5946'); r(23, 7, 6, 10, '#3f5946');
    const color = id === 'vest' ? '#8d7150' : id === 'shirt' ? '#e0c89e' : '#' + item.color.toString(16).padStart(6, '0');
    r(10, 6, 13, 20, color); r(5, 8, 5, 7, color); r(23, 8, 5, 7, color);
    r(14, 5, 5, 5, '#3f5946'); r(11, 11, 2, 13, id === 'vest' ? '#bda371' : '#fff0c7');
    if (id === 'vest') { r(10, 18, 13, 4, '#5b4936'); r(16, 18, 4, 4, '#e0c77e'); r(20, 8, 2, 8, '#c3b17a'); }
    if (id === 'moon') { r(10, 25, 13, 4, '#786aaf'); r(16, 12, 4, 5, '#fff0ba'); r(18, 12, 3, 3, color); }
    if (id === 'plate') { r(4, 6, 7, 5, '#eef3d6'); r(23, 6, 6, 5, '#eef3d6'); r(10, 17, 13, 2, '#59677c'); r(10, 23, 13, 2, '#59677c'); }
  } else if (id === 'potion') {
    r(12, 3, 9, 5, '#a98556'); r(13, 8, 7, 5, '#e5f3d2'); r(8, 13, 17, 15, '#3c665b');
    r(9, 13, 15, 14, '#b8ddc7'); r(10, 18, 13, 8, '#d57978'); r(11, 14, 2, 9, '#fff1dc');
    r(14, 19, 5, 2, '#ffe7be'); r(16, 17, 1, 6, '#ffe7be');
  } else {
    r(8, 7, 16, 18, '#c79445'); r(10, 8, 12, 14, '#ffe18c'); r(15, 11, 2, 9, '#b5833f');
  }
  const uri = canvas.toDataURL('image/png'); cache.set(id, uri); return uri;
}
