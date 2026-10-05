import {writeFileSync} from 'node:fs';
import {createGame,legalActions,getObservation} from '../dist/engine.js';
import {createAnalyzer,publicPool} from '../dist/analysis.js';
import {kindOf} from '../dist/tiles.js';
import {step,fixture} from '../test/fixtures.mjs';
const histogram={}, rows=[];let excluded=0;
for(let i=1;i<=256;i++){
 const seed=Math.imul(i,2654435761)>>>0||1;let s=createGame({seed});
 for(let n=0;n<100&&s.phase!=='awaitDiscard'&&s.phase!=='handResult';n++){
  const a=legalActions(s,'engine')[0];if(!a)throw Error(s.phase);s=step(s,'engine',a);
 }
 if(s.phase!=='awaitDiscard'){excluded++;continue;}
 for(let seat=0;seat<4;seat++){
  if(seat===s.dealer)continue;
  const o=getObservation(s,seat),a=createAnalyzer(publicPool(o)).analyze(o.self.concealed.map(kindOf),o.self.melds,true);
  histogram[a.shanten]=(histogram[a.shanten]||0)+1;
  rows.push({seed,seat,shanten:a.shanten,completed:a.example.completed.length,partials:a.example.partials.length,pair:a.example.pair.length?1:0,improving:a.improving});
 }
}
const sorted=rows.map(x=>x.shanten).sort((a,b)=>a-b),mean=k=>rows.reduce((n,x)=>n+x[k],0)/rows.length;
const cases=[['discardedHonor','123m 456m 123p 456p 789s 1z','1z','1z'],['sujiCounterexample','111p 222p 333s 444s 35m 55z','1m','4m'],['fourVisibleNumber','111p 222p 333s 444s 12m 55z',null,'3m','3333m']].map(([name,hand,old,t,owned])=>{
 let s=fixture({turn:0,hands:{0:owned||t,1:hand},restrictions:old?{1:{lastDiscard:old}}:{}});
 const id=s.players[0].concealed.find(x=>kindOf(x)===t);s=step(s,0,{type:'DISCARD',tileId:id});
 return {name,hand,owned:owned||t,oldDiscard:old,currentDiscard:t,ronLegal:legalActions(s,1).some(a=>a.type==='WIN')};
});
const out={rules:'TW16-CLASSIC-v1',method:'256 mixed fixed seeds; non-dealer E16 after opening flower replacement; no gameplay; example is nearest-target decomposition, not maximum partial count',deals:256,excluded,samples:rows.length,histogram,meanShanten:mean('shanten'),median:sorted[Math.floor(sorted.length*.5)],p75:sorted[Math.floor(sorted.length*.75)],p90:sorted[Math.floor(sorted.length*.9)],meanCompleted:mean('completed'),meanPartials:mean('partials'),meanPair:mean('pair'),counterexamples:cases};
writeFileSync(new URL('../AI-STYLE-BASELINE.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
