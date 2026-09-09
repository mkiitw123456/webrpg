// Both sides share the same minted gold rim; only the engraved emblem differs.
const cache = new Map();
export function drawCoin(c, side = 'heads') {
  const r = (x,y,w,h,color) => { c.fillStyle=color; c.fillRect(x,y,w,h); };
  const disc = (radius, color, dy=0) => {
    for(let y=0;y<32;y++) for(let x=0;x<32;x++) if((x-15.5)**2+(y-15.5-dy)**2<=radius**2) r(x,y,1,1,color);
  };
  c.imageSmoothingEnabled=false;
  disc(14.8,'#69431f',1); disc(14.4,'#bc8130'); disc(13.2,'#ffe39a'); disc(11.8,'#be8736'); disc(10.5,'#efbd57');
  for(const [x,y] of [[8,4],[15,2],[23,5],[27,12],[26,22],[18,27],[7,25],[3,16]]) r(x,y,2,2,'#fff0b8');
  r(9,7,9,1,'#ffe799'); r(6,10,1,8,'#ffe799'); r(13,25,8,1,'#9c682a');
  const leaf = ['...........##','.......######','.....########','...#########.','..##########.','.###########.','.##########..','##########...','#########....','.#######.....','..####.......'];
  const star = ['......#......','.....###.....','.....###.....','....#####....','#############','.###########.','..#########..','...#######...','...#######...','..####.####..','..###...###..','.##.......##.'];
  const rows=side==='heads'?leaf:star, ink=side==='heads'?'#90722b':'#986129';
  rows.forEach((row,y)=>[...row].forEach((p,x)=>{if(p==='#')r(x+9,y+10,1,1,'#ffe7a0');}));
  rows.forEach((row,y)=>[...row].forEach((p,x)=>{if(p==='#')r(x+8,y+9,1,1,ink);}));
  if(side==='heads') { for(let i=0;i<10;i++)r(9+i,21-i,1,2,'#edc96a');r(8,22,2,3,'#90722b'); }
  else { r(14,13,3,6,'#dba14b');r(12,15,7,2,'#dba14b');r(15,13,1,3,'#ffe599'); }
}
export function coinIcon(side='heads') {
  if(!cache.has(side)) { const canvas=document.createElement('canvas');canvas.width=canvas.height=32;drawCoin(canvas.getContext('2d'),side);cache.set(side,canvas.toDataURL('image/png')); }
  return cache.get(side);
}
