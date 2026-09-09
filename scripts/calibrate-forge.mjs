// Offline calibration only. Production never simulates or selects a winner in advance.
// Match the independent, uniformly distributed increments in forgeRace.js.
const samples = Number(process.argv[2] || 200000);
function probability(scale, boost) {
  let seed=3819281,wins=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<samples;i++){
    let a=0,b=0;
    while(a<100&&b<100){
      const da=4+16*random(),critical=random()<0.1,db=(4+16*random())*scale;
      const top=da*(boost&&critical?2:1);
      if(a+top>=100||b+db>=100){if((100-a)/top<(100-b)/db)wins++;break;}
      a+=top;b+=db;
    }
  }
  return wins/samples;
}
for(const boost of [true,false]){
  const table={};
  for(const rate of boost?[95,90,85,80,75,70,65,60,50,40,30,20,10,5]:[90,85,80,75,70]){
    let low=0.2,high=2.5;
    for(let j=0;j<17;j++){const mid=(low+high)/2;if(probability(mid,boost)>rate/100)low=mid;else high=mid;}
    table[rate]=+((low+high)/2).toFixed(6);
  }
  console.log(boost?'UPGRADE':'RISK',JSON.stringify(table));
}
