import { api, childrenOf, pull, textOf, uidOf, updateBlock, value } from './graph.js';
import { fingerprint, referencesTo } from './repair-snapshot.js';
import { splitImages } from './image-split.js';

const state = uid => {
  const raw=fingerprint(uid);
  return raw == null ? raw : JSON.stringify(JSON.parse(raw, (key,value) => key === ':block/order' || key === 'order' ? undefined : value));
};
// Keep the text UID, its heading, children, and references. Do not guess how to
// divide annotations, inline formatting, or text interrupted by several images.
export function previewImageRepair(content) {
  const changes=[], skipped=[];
  for (const item of content.nodes) {
    const parts=splitImages(item.text);
    if (!parts.some(p=>p.image) || !parts.some(p=>!p.image)) continue;
    const texts=parts.filter(p=>!p.image);
    if (!item.parentUid || !content.byUid.has(item.parentUid) || texts.length!==1 || /`|\^\^|{{/.test(item.text) || /^(?:\*\*|__)$/.test(texts[0].text.trim())) { skipped.push(item.uid); continue; }
    // Unbalanced emphasis around an image must not become broken Markdown.
    if (['**','__'].some(mark=>texts[0].text.split(mark).length%2===0)) { skipped.push(item.uid); continue; }
    changes.push({uid:item.uid,parentUid:item.parentUid,before:item.text,after:texts[0].text.trim(),parts,expected:state(item.uid)});
  }
  return {changes,skipped};
}
export async function applyImageRepair(plan, record, save) {
  record.steps.images=[]; record.results.images=0;
  for (const change of plan.changes) {
    // Earlier repair steps may change this block. Never apply a new plan.
    if (state(change.uid)!==change.expected) {record.results.skipped++;continue;}
    const entry={...change,created:[],originalAfter:null};
    record.steps.images.push(entry); await save();
    const textIndex=change.parts.findIndex(p=>!p.image);
    for (let i=0;i<change.parts.length;i++) {
      if (!change.parts[i].image) continue;
      const uid=api().util.generateUID(), string=change.parts[i].text;
      const order=value(pull(change.uid),'order')+(i<textIndex?0:1+entry.created.filter(x=>x.after).length);
      entry.created.push({uid,string,after:i>textIndex}); await save();
      await api().data.block.create({location:{'parent-uid':change.parentUid,order},block:{uid,string,heading:0}});
    }
    await updateBlock({uid:change.uid,string:change.after});
    entry.originalAfter=state(change.uid);
    entry.created.forEach(item=>item.expected=state(item.uid));
    record.results.images++; await save();
  }
}
export async function undoImageRepair(record, save) {
  const result={restored:0,skipped:0};
  for (const entry of [...(record.steps.images||[])].reverse()) {
    if (entry.undone) continue;
    const original=pull(entry.uid), existing=entry.created.filter(item=>pull(item.uid));
    const unsafe=!original || (entry.originalAfter ? state(entry.uid)!==entry.originalAfter : ![entry.before,entry.after].includes(textOf(original))) || existing.some(item=>referencesTo(item.uid).length || !childrenOf(pull(entry.parentUid)).some(n=>uidOf(n)===item.uid) || childrenOf(pull(item.uid)).length || (item.expected?state(item.uid)!==item.expected:textOf(pull(item.uid))!==item.string)) || !childrenOf(pull(entry.parentUid)).some(n=>uidOf(n)===entry.uid);
    if(unsafe){result.skipped++;continue;}
    await updateBlock({uid:entry.uid,string:entry.before});
    for(const item of existing.reverse()) await api().data.block.delete({block:{uid:item.uid}});
    entry.undone=true; result.restored++; await save();
  }
  return result;
}
