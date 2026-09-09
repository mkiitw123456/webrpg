// 200,000 independent races per calibration step; 350 ms linear growth,
// stop both bars at the first crossing, and include the 10% double increment.
// These are speed ratios, NOT selected outcomes or progress-dependent caps.
const upgrade = {100:0.15,95:0.790538,90:0.844603,85:0.883488,80:0.917478,75:0.948256,70:0.977262,65:1.005883,60:1.034222,50:1.092059,40:1.156511,30:1.232826,20:1.333479,10:1.498128,5:1.663058};
const risk = {90:0.796943,85:0.830494,80:0.858746,75:0.884401,70:0.908441};
export function raceIncrement(rules, isRisk, rng) {
  const base = 4 + 16 * rng(0,1000000) / 1000000;
  const critical = rng(0,10) === 0;
  const boosted = !isRisk && critical;
  const scale = isRisk ? risk[100-rules.destroyRate] : upgrade[rules.successRate];
  if(!Number.isFinite(scale))throw Error('Unsupported forge probability');
  const failure = (4 + 16 * rng(0,1000000) / 1000000) * scale;
  return {base,boosted,success:base*(boosted?2:1),failure};
}
export function advanceRace(success,failure,a,b) {
  const topTime=(100-success)/a,bottomTime=(100-failure)/b;
  const fraction=Math.min(1,topTime,bottomTime);
  const crossed=success+a>=100-1e-10||failure+b>=100-1e-10;
  const outcome= crossed?(topTime<=bottomTime?'top':'bottom'):null;
  return {success:outcome==='top'?100:Math.min(100,success+a*fraction),failure:outcome==='bottom'?100:Math.min(100,failure+b*fraction),outcome};
}
