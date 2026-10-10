import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture, discard, run, resolve, WIN } from './fixtures.mjs';
import { createAnalyzer, publicPool, bestDiscards } from '../dist/analysis.js';
import { getObservation, discardBan } from '../dist/engine.js';
import { ordinaryRonSafety } from '../dist/safety.js';
import { kindOf, KINDS } from '../dist/tiles.js';
const bank = JSON.parse(fs.readFileSync(new URL('../TRAINING-DRAFTS.json',import.meta.url),'utf8'));
const byId = id => bank.cases.find(c=>c.id===id);
const sorted = values => [...values].sort();

test('題庫草案識別、答案集合、來源與題族隔離：未審核不冒充可用测驗',()=>{
  assert.equal(bank.status,'draft-not-in-runtime'); assert.equal(bank.rulesVersion,'TW16-CLASSIC-v1');
  assert.equal(bank.analyzerVersion,'tw16-evidence-1');
  assert.equal(new Set(bank.cases.map(c=>c.id)).size,bank.cases.length);
  assert.deepEqual(sorted(new Set(bank.cases.map(c=>c.skill))),['claim-cost','dealer-continuation','efficiency','safety-scope']);
  const trainingFamilies=new Set();
  for(const c of bank.cases){
    assert.equal(c.purpose,'training'); assert.equal(c.reviewStatus,'pending-content-review'); trainingFamilies.add(c.familyId);
    assert.ok(c.prompt&&c.derivation&&c.scope&&c.difficulty&&c.references.length);
    assert.equal(new Set(c.choices.map(o=>o.id)).size,c.choices.length);
    assert.ok(c.accepted.length); assert.equal(new Set(c.accepted).size,c.accepted.length);
    assert.ok(c.accepted.every(id=>c.choices.some(o=>o.id===id)));
    for(const ref of c.references)assert.ok(fs.existsSync(new URL(`../${ref.split(':')[0]}`,import.meta.url)),ref);
  }
  assert.ok(bank.assessmentFamilies.every(f=>!trainingFamilies.has(f)));
  assert.equal(byId('C01').familyId,byId('C02').familyId,'同一134遇2的答案曝光不可拆成陌生題族');
});

test('E01五面子只差將：手算3對1與117分母，與分析器交叉核對',()=>{
  const s=fixture({hands:{0:'12z'},melds:{0:['123m','456m','123p','456p','789s'].map(tiles=>({kind:'chi',tiles}))}});
  const o=getObservation(s,0), pool=publicPool(o);pool.counts[KINDS.indexOf('1z')]-=2;
  const choices=createAnalyzer(pool).discards(o.self.concealed.map(kindOf),o.self.melds,['1z','2z'],false);
  const c=byId('E01');
  for(const [id,k] of [['east','1z'],['south','2z']]){
    const actual=choices.find(x=>x.kind===k).analysis;
    assert.equal(actual.shanten,c.expected[id].shanten);assert.equal(actual.improving,c.expected[id].improving);
    assert.equal(actual.total,c.expected.publicPoolTotal);
  }
  assert.deepEqual(c.accepted,['east']);assert.deepEqual(bestDiscards(choices).map(c=>c.kind),['1z']);
});

test('E02四面子固定：丟南留下34與東對，2／5索8張，其餘破壞聽牌',()=>{
  const s=fixture({hands:{0:'34s112z'},melds:{0:['123m','456m','123p','789p'].map(tiles=>({kind:'chi',tiles}))}});
  const o=getObservation(s,0), choices=createAnalyzer(publicPool(o)).discards(o.self.concealed.map(kindOf),o.self.melds,['3s','4s','1z','2z'],false);
  const c=byId('E02'), actual=choices.find(c=>c.kind==='2z').analysis;
  assert.equal(actual.shanten,c.expected.shanten);assert.equal(actual.improving,c.expected.improving);assert.equal(actual.total,c.expected.publicPoolTotal);
  assert.deepEqual(actual.effectiveTiles.map(t=>t.kind),c.expected.effectiveKinds);
  assert.ok(choices.filter(c=>c.kind!=='2z').every(c=>c.analysis.shanten>0));
  assert.deepEqual(c.accepted,['south']);assert.deepEqual(bestDiscards(choices).map(c=>c.kind),['2z']);
});

test('S01／S02獨立字牌與順子枚舉，四見數牌不能當安全證明',()=>{
  for(const id of ['S01','S02']){
    const c=byId(id), counts=Array(34).fill(4);counts[KINDS.indexOf(c.expected.kind)]=0;
    const actual=ordinaryRonSafety({source:'public',counts},c.expected.kind);
    assert.equal(actual.provenSafe,c.expected.provenSafe);
    assert.deepEqual(actual.possibleUses.map(r=>r.needs),c.expected.routes??[]);
  }
  assert.deepEqual(byId('S01').accepted,['ron-safe']);assert.deepEqual(byId('S02').accepted,['unknown']);
});

test('C01／C02順子及吃後禁捨與引擎一致，不把過當另一種吃法',()=>{
  const s=discard(fixture({turn:3,hands:{3:'2m',0:'1345m67m123p456p789s1z'}}),3,'2m');
  const actions=getObservation(s,0).legalActions.filter(a=>a.type==='CHI');
  const pairs=actions.map(a=>a.ownTiles.map(t=>kindOf(t)[0]).sort().join(''));
  assert.deepEqual(sorted(pairs),byId('C01').accepted);
  assert.deepEqual(discardBan(['3m','4m'],'2m'),byId('C02').expected.forbidden);
  assert.deepEqual(byId('C02').accepted,byId('C02').expected.forbidden);
});

test('D02三個真實結算分支驗續莊；D01只接受兩種範圍外反例',()=>{
  const outcomes=[];
  for(const result of ['dealer-win','draw','other-win']){
    let s;
    if(result==='draw'){s=fixture({streak:2,available:0});s=resolve(discard(s,0,kindOf(s.players[0].concealed[0])));assert.equal(s.settlement.source,'draw');}
    else {const winner=result==='dealer-win'?0:1;s=run(fixture({dealer:0,turn:winner,streak:2,hands:{[winner]:WIN}}),winner,'WIN');}
    s=run(s,'engine','NEXT_HAND');if(s.dealer===0){assert.equal(s.streak,3);outcomes.push(result);}else assert.equal(s.streak,0);
  }
  assert.deepEqual(outcomes,byId('D02').expected.keepsDealer);assert.deepEqual(outcomes,byId('D02').accepted);
  assert.deepEqual(byId('D01').accepted,['no','draw']);
});
