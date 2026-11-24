import { readBookContent } from "../src/catalog.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';
import { previewBookRepair, applyBookRepair, undoBookRepair } from '../src/book-repair.js';
import { previewHeadingRepair, applyHeadingRepair } from '../src/heading-repair.js';
import { previewArchiveCleanup, applyArchiveCleanup } from '../src/paragraph-repair.js';
import { configureMetadataPages, metadataRows } from '../src/metadata-page.js';
import { putDocument, readDocument } from '../src/reader-store.js';
import { saveManagedBook, getManagedBooks } from '../src/library.js';
import { writeBlockPlan } from '../src/writer.js';
import { createImportJob, runImport, cancelImports, enableImports, prepareBookDeletion, deleteManagedBook } from '../src/roam.js';
import { installReader } from '../src/reader.js';
import { publishFeature } from '../src/coexistence.js';

function fixture() {
 const dom = new JSDOM('<body><div class="roam-main"></div></body>',{url:'https://example.test/#/app/Test',pretendToBeVisual:true});
 Object.assign(globalThis,{window:dom.window, document:dom.window.document, indexedDB, MutationObserver:dom.window.MutationObserver});
 let serial=0; const nodes=new Map(), writes=[], queries=[]; const settingsMap=new Map();
 const add=(uid,string,parent=null,extra={})=>{nodes.set(uid,{uid,string,parent,order:[...nodes.values()].filter(n=>n.parent===parent).length,...extra}); return uid;};
 const children=uid=>[...nodes.values()].filter(n=>n.parent===uid).sort((a,b)=>a.order-b.order);
 const ancestors=uid=>{const result=[];let p=nodes.get(uid)?.parent;while(p){result.push(p);p=nodes.get(p)?.parent;}return result;};
 const tree=uid=>{const n=nodes.get(uid);if(!n)return null;return {':block/uid':uid,':block/string':n.string,':block/order':n.order,':block/heading':n.heading||0,':block/open':n.open??true,...(n.title?{':node/title':n.title}:{}),':block/children':children(uid).map(n=>tree(n.uid)),':block/parents':ancestors(uid).map(p=>({':block/uid':p,...(nodes.get(p)?.title?{':node/title':nodes.get(p).title}:{})}))};};
 const refs=uid=>[...nodes.values()].filter(n=>n.string?.includes(`((${uid}))`)).map(n=>[n.uid]);
 const api={util:{generateUID:()=>`u${String(++serial).padStart(8,'0')}`},data:{
  pull:(pattern,[field,id])=>tree(field===':node/title'?[...nodes.values()].find(n=>n.title===id)?.uid:id),
  q:(query,arg)=>{queries.push(query);if(query.includes('starts-with?'))throw Error('Whole-graph prefix query forbidden');if(query.includes('[?targetUid ...]'))return [...new Set(arg.flatMap(uid=>refs(uid).map(r=>r[0])))].map(uid=>[uid]);if(query.includes(':block/refs'))return refs(arg);if(query.includes(':find ?puid ?title'))return [];if(query.includes(':find ?uid ?s'))return [...nodes.values()].filter(n=>!n.title).map(n=>[n.uid,n.string]);throw Error('Unexpected query '+query);},
  block:{
   create:async({location,block})=>{writes.push(['create',block.uid]);add(block.uid,block.string,location['parent-uid'],{...block,order:location.order==='last'?children(location['parent-uid']).length:location.order});},
   update:async({block})=>{assert.ok(nodes.has(block.uid));writes.push(['update',block.uid]);Object.assign(nodes.get(block.uid),block);},
   move:async({location,block})=>{writes.push(['move',block.uid]);Object.assign(nodes.get(block.uid),{parent:location['parent-uid'],order:location.order==='last'?children(location['parent-uid']).length:location.order});},
   delete:async({block})=>{writes.push(['delete',block.uid]);for(const uid of [...nodes.keys()])if(uid===block.uid||ancestors(uid).includes(block.uid))nodes.delete(uid);}
  },page:{create:async({page})=>{writes.push(['page',page.uid]);add(page.uid,'',null,{title:page.title});}}
 },ui:{mainWindow:{getOpenPageOrBlockUid:async()=>'',openPage:async()=>{}},getFocusedBlock:()=>null},file:{upload:async()=>'',delete:async()=>{writes.push(['file-delete']);}}};
 window.roamAlphaAPI=api;
 const ext={settings:{get:key=>settingsMap.get(key),set:async(key,v)=>settingsMap.set(key,v)}};
 add('page00001','',null,{title:'Book'});add('chapter01','Chapter','page00001',{heading:1});add('body00001','Body heading','chapter01',{heading:2});
 const record={id:'book1',pageUid:'page00001',title:'Book',status:'complete',attachments:[],catalog:{version:1,confirmed:true,rootUids:['chapter01'],chapters:[{uid:'chapter01',title:'Chapter',parentUid:null}]}};
 const content=()=>{const items=[];const visit=(uid,parentUid)=>{const node=tree(uid);items.push({uid,text:node[':block/string'],parentUid,node,chapterUid:'chapter01'});for(const c of children(uid))visit(c.uid,uid);};visit('chapter01',null);return {key:'page00001',record,chapters:record.catalog.chapters,nodes:items,byUid:new Map(items.map(n=>[n.uid,n])),pages:new Map([['page00001','Book']]),chapterAliases:new Map(),catalog:record.catalog};};
 return {dom,api,nodes,writes,queries,add,tree,ext,record,content,close:()=>dom.window.close()};
}

test('metadata reads known pages, keeps renamed UIDs after reload, and never scans prefixes',async()=>{
 const f=fixture();await configureMetadataPages(f.ext);await putDocument('progress','book',{position:1});
 const reader=[...f.nodes.values()].find(n=>n.title==='roam/epub-importer/reader');reader.title='My Reading Metadata';
 await configureMetadataPages(f.ext);await putDocument('progress','book',{position:2});assert.deepEqual(readDocument('progress','book'),{position:2});
 await saveManagedBook(f.ext,f.record);assert.equal((await getManagedBooks(f.ext)).length,1);assert.equal(f.queries.length,0);f.close();
});
test('approved repair applies and never mutates its plan',async()=>{
 const f=fixture();f.nodes.get('chapter01').heading=0;const plan=previewBookRepair(f.content(),{links:[],chapters:[{kind:'toc',text:'Chapter',children:[]}]});const snapshot=JSON.stringify(plan);const result=await applyBookRepair(plan);assert.equal(result.results.headings,1);assert.equal(f.nodes.get('chapter01').heading,1);assert.equal(f.nodes.get('body00001').heading,2);assert.equal(JSON.stringify(plan),snapshot);f.close();
});
test('new heading added after preview aborts before any write',async()=>{
 const f=fixture();const plan=previewBookRepair(f.content());f.add('newhead01','My heading','chapter01',{heading:2});await assert.rejects(applyBookRepair(plan),/changed since preview/);assert.equal(f.writes.length,0);assert.equal(f.nodes.get('newhead01').heading,2);f.close();
});
test('heading level edits after preview are preserved',async()=>{
 const f=fixture();f.nodes.get('chapter01').heading=0;const plan=previewHeadingRepair(f.content(),{links:[],chapters:[{kind:'toc',text:'Chapter',children:[]}]});f.nodes.get('chapter01').heading=3;const result=await applyHeadingRepair(plan);assert.deepEqual(result.skipped,['chapter01']);assert.equal(f.nodes.get('chapter01').heading,3);f.close();
});
function footnote(f){f.nodes.delete('body00001');f.add('marker001','[3](((note00001)))','chapter01');f.add('outside01','Read ((marker001))',null);}
test('footnote references are captured in preview and only approved text is rewritten',async()=>{
 const f=fixture();footnote(f);const plan=previewHeadingRepair(f.content());assert.equal(plan.changes[0].referenceChanges[0].uid,'outside01');await applyHeadingRepair(plan);assert.equal(f.nodes.get('outside01').string,'Read ((chapter01))');assert.ok(!f.nodes.has('marker001'));f.close();
});
test('new external footnote reference makes the destructive merge skip',async()=>{
 const f=fixture();footnote(f);const plan=previewHeadingRepair(f.content());f.add('outside02','New ((marker001))');const result=await applyHeadingRepair(plan);assert.deepEqual(result.skipped,['marker001']);assert.equal(f.nodes.get('outside01').string,'Read ((marker001))');assert.ok(f.nodes.has('marker001'));f.close();
});
function archive(f){f.add('archive01','EPUB-READER:paragraph-fragments','body00001');f.add('fragment1','fragment','archive01');f.add('outside01','Read ((fragment1))');}
test('archive cleanup rewrites exactly the previewed reference',async()=>{
 const f=fixture();archive(f);const plan=previewArchiveCleanup(f.content());assert.equal(plan.references,1);const result=await applyArchiveCleanup(plan);assert.deepEqual(result.removed,['archive01']);assert.equal(f.nodes.get('outside01').string,'Read ((body00001))');f.close();
});
test('archive cleanup preserves new refs and changed external text',async()=>{
 for(const kind of ['new','edited']) {const f=fixture();archive(f);const plan=previewArchiveCleanup(f.content());if(kind==='new')f.add('outside02','New ((fragment1))');else f.nodes.get('outside01').string='Edited ((fragment1))';const result=await applyArchiveCleanup(plan);assert.deepEqual(result.skipped,['archive01']);assert.ok(f.nodes.has('fragment1'));f.close();}
});
test('writer stops after in-flight create, and does not start links after cancellation',async()=>{
 const f=fixture(),controller=new AbortController();let waits=0;const job={book:{chapters:[{}]},progress:{},blockPlan:[{uid:'import001',parentUid:'page00001',depth:0,chapterIndex:0,string:'one',finalString:'link'},{uid:'import002',parentUid:'page00001',depth:0,chapterIndex:1,string:'two'}]};
 const create=f.api.data.block.create;f.api.data.block.create=async payload=>{await create(payload);controller.abort();};await assert.rejects(writeBlockPlan(job,f.api,{signal:controller.signal,wait:async()=>{waits++;}}),{name:'AbortError'});assert.equal(waits,0);assert.ok(f.nodes.has('import001'));assert.ok(!f.nodes.has('import002'));assert.ok(!f.writes.some(([type])=>type==='update'));f.close();
});
test('writer also stops between link updates',async()=>{
 const f=fixture(),controller=new AbortController();for(const uid of ['import001','import002'])f.add(uid,'before','page00001');const job={book:{chapters:[{}]},progress:{blockIndex:2},blockPlan:['import001','import002'].map(uid=>({uid,string:'before',finalString:'after'}))};const update=f.api.data.block.update;f.api.data.block.update=async payload=>{await update(payload);controller.abort();};await assert.rejects(writeBlockPlan(job,f.api,{signal:controller.signal,wait:async()=>{}}),{name:'AbortError'});assert.equal(f.nodes.get('import001').string,'after');assert.equal(f.nodes.get('import002').string,'before');f.close();
});
test('full import unload stops subsequent creates and late callbacks',async()=>{
 const f=fixture();enableImports();const job=createImportJob({id:'source',parserVersion:4,assets:[],links:[],chapters:[{text:'First',kind:'toc',children:[{text:'Second'}]}]});const create=f.api.data.block.create;f.api.data.block.create=async payload=>{await create(payload);cancelImports();};await assert.rejects(runImport(job,f.ext),{name:'AbortError'});assert.equal(f.writes.filter(([kind])=>kind==='create').length,1);await assert.rejects(runImport(job,f.ext),/disabled/);f.close();enableImports();
});
test('delete blocks book and attachments for existing and newly-added external refs',async()=>{
 for(const timing of ['before','after']) {const f=fixture();await saveManagedBook(f.ext,f.record);if(timing==='before')f.add('outside01','Read ((body00001))');const plan=await prepareBookDeletion(f.record,f.ext);if(timing==='after')f.add('outside01','Read ((body00001))');f.writes.length=0;await assert.rejects(deleteManagedBook(plan,f.ext),/references from outside/);assert.ok(f.nodes.has('body00001'));assert.equal(f.writes.length,0);f.close();}
});
test('deletion fails closed on reference query failure',async()=>{
 const f=fixture();await saveManagedBook(f.ext,f.record);const plan=await prepareBookDeletion(f.record,f.ext);f.api.data.q=()=>{throw Error('offline');};f.writes.length=0;await assert.rejects(deleteManagedBook(plan,f.ext),/Reference check failed/);assert.equal(f.writes.length,0);f.close();
});
test('unreferenced book deletes its chapters and retains page',async()=>{
 const f=fixture();await saveManagedBook(f.ext,f.record);const plan=await prepareBookDeletion(f.record,f.ext);await deleteManagedBook(plan,f.ext);assert.ok(!f.nodes.has('chapter01'));assert.ok(f.nodes.has('page00001'));f.close();
});
test('Reading Desk publishes feature ownership without touching Folio',()=>{
 const f=fixture();let calls=0,events=0;window.__magQuickMark={cleanup:()=>calls++};window.addEventListener('reading-desk-features-change',()=>events++);publishFeature('mark',true);publishFeature('comments',true);publishFeature('mark',false);assert.equal(calls,0);assert.equal(events,3);f.close();
});
test('shortcut recorder removes its capture listener on close, redraw and unload',async()=>{
 for(const action of ['close','redraw','cleanup']) {
  const f=fixture();const original=f.api.data.q;f.api.data.q=(...args)=>{try{return original(...args);}catch{return [];}};
  f.ext.settings.set('reader-auto-progress',false);let paused=false;
  const controller=installReader(f.ext);controller.setActions({shortcuts:{comboFor:()=>'',pause:value=>{paused=value;},conflicts:()=>[]}});
  await controller.open(f.record,'Settings');const keys=controller.root.querySelector('.rei-shortcut .rei-chip');assert.ok(keys,'shortcut recorder exists');keys.click();assert.equal(paused,true);
  const event=new window.KeyboardEvent('keydown',{key:'Shift',code:'ShiftLeft',cancelable:true});window.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
  if(action==='redraw')controller.root.querySelector('[data-reader-tab="Contents"]').click();else controller[action]();
  assert.equal(paused,false);const after=new window.KeyboardEvent('keydown',{key:'Shift',code:'ShiftLeft',cancelable:true});window.dispatchEvent(after);assert.equal(after.defaultPrevented,false);controller.cleanup();f.close();
 }
});

test('Desk without current page still lists and opens registered books',async()=>{
 const f=fixture();await saveManagedBook(f.ext,f.record);const q=f.api.data.q;f.api.data.q=(...args)=>{try{return q(...args);}catch{return [];}};
 const controller=installReader(f.ext);await controller.open();
 const selector=controller.root.querySelector('select');assert.ok([...selector.options].some(o=>o.textContent==='Book'));assert.equal(selector.selectedOptions[0].textContent,'All Books');
 controller.cleanup();f.close();
});
test('all tabs retain scroll on refresh; editing does not replace a repair preview',async()=>{
 const f=fixture();const q=f.api.data.q;f.api.data.q=(...args)=>{try{return q(...args);}catch{return [];}};
 const controller=installReader(f.ext);await controller.open(f.record,'Settings');
 for(const tab of ['Contents','Annotations','Questions','Notes','Settings']) {
  controller.root.querySelector(`[data-reader-tab="${tab}"]`).click();const body=controller.root.querySelector('.rei-reader-body');body.scrollTop=140;await controller.refresh();assert.equal(body.scrollTop,140,tab);
 }
 [...controller.root.querySelectorAll('button')].find(b=>b.textContent==='Repair This Book').click();
 const body=controller.root.querySelector('.rei-reader-body'), preview=body.querySelector('details');body.scrollTop=220;
 const input=document.createElement('textarea');input.className='rm-block-input';document.body.append(input);input.dispatchEvent(new window.FocusEvent('focusout',{bubbles:true}));
 await new Promise(resolve=>setTimeout(resolve,1550));assert.equal(body.querySelector('details'),preview);assert.equal(body.scrollTop,220);
 controller.cleanup();f.close();
});
test('source repair preserves IDs, ignores ambiguous titles and leaves manual headings alone',async()=>{
 const f=fixture();f.nodes.get('body00001').heading=0;f.add('manual001','My own heading','chapter01',{heading:3});
 const source={links:[],chapters:[{kind:'toc',text:'Chapter',children:[{kind:'heading',text:'Body heading',rank:2,children:[]}]}]};
 const plan=previewBookRepair(f.content(),source);assert.ok(plan.headings.changes.some(c=>c.uid==='body00001'&&c.after.heading===2));
 await applyBookRepair(plan);assert.equal(f.nodes.get('body00001').heading,2);assert.equal(f.nodes.get('manual001').heading,3);assert.ok(!f.writes.some(([kind])=>kind==='move'||kind==='delete'));
 f.nodes.get('body00001').heading=0;f.add('duplicate','Body heading','chapter01');assert.ok(!previewHeadingRepair(f.content(),source).changes.some(c=>c.uid==='body00001'));f.close();
});
test('deletion preview gives source page and text for a blocked reference',async()=>{
 const f=fixture();f.add('otherpage','',null,{title:'Reading notes'});f.add('outside01','Quote ((body00001))','otherpage');await saveManagedBook(f.ext,f.record);const plan=await prepareBookDeletion(f.record,f.ext);
 assert.deepEqual(plan.externalReferences,[{uid:'outside01',text:'Quote ((body00001))',page:{uid:'otherpage',title:'Reading notes'}}]);f.close();
});
test('writer batches timer yields but checks cancellation before each write',async()=>{
 const f=fixture(),waits=[];const job={book:{chapters:[{}]},progress:{},blockPlan:Array.from({length:23},(_,i)=>({uid:`import${i}`,parentUid:'page00001',depth:1,order:i,chapterIndex:0,string:`text${i}`}))};
 await writeBlockPlan(job,f.api,{wait:async ms=>waits.push(ms)});assert.equal(f.writes.length,23);assert.deepEqual(waits,[650,650,195]);f.close();
});
test('Resume reuses already uploaded image hashes',async()=>{
 const f=fixture();enableImports();let uploads=0;f.api.file.upload=async()=>{uploads++;return 'https://example.test/image.png';};
 const job=createImportJob({id:'imagesource',parserVersion:4,assets:[{id:'i0',hash:'same',path:'image.png',bytes:new Uint8Array([1]),mediaType:'image/png'}],links:[],chapters:[{kind:'toc',text:'Image chapter',children:[{text:'⟦EPUBI:i0⟧'}]}]});
 job.attachments=[{hash:'same',url:'https://example.test/already.png'}];await runImport(job,f.ext);assert.equal(uploads,0);assert.ok(job.blockPlan.some(n=>n.string.includes('already.png')));f.close();
});
test('a user heading visible in Contents is not normalized as an imported chapter',()=>{
 const f=fixture();f.add('manual002','Personal heading','chapter01',{heading:3});const content=f.content();content.chapters=[...content.chapters,{uid:'manual002',title:'Personal heading',parentUid:'chapter01'}];assert.ok(!previewHeadingRepair(content).changes.some(c=>c.uid==='manual002'));f.close();
});
test('source repair stays stable after file selection is cleared despite a stale catalog',async()=>{
 const f=fixture();f.record.catalog.headings=true;
 f.add('section01','Section','chapter01');f.nodes.get('body00001').parent='section01';
 f.record.catalog.chapters.push({uid:'body00001',title:'Body heading',parentUid:'chapter01'});
 const source={links:[],chapters:[{kind:'toc',text:'Chapter',children:[{kind:'heading',text:'Section',children:[{kind:'heading',text:'Body heading',children:[]}]}]}]};
 const plan=previewBookRepair(f.content(),source);assert.equal(plan.headings.counts.chapters,2);
 await applyBookRepair(plan);assert.equal(f.nodes.get('section01').heading,2);assert.equal(f.nodes.get('body00001').heading,3);
 assert.equal(previewBookRepair(f.content()).headings.counts.chapters,0);
 assert.equal(previewBookRepair(f.content(),source).headings.counts.chapters,0);
 const reloaded=readBookContent(JSON.parse(JSON.stringify(f.record)));
 assert.equal(reloaded.chapters.find(c=>c.uid==='body00001').parentUid,'section01');
 assert.ok(reloaded.chapters.some(c=>c.uid==='section01'));
 assert.equal(previewBookRepair(reloaded).headings.counts.chapters,0);f.close();
});
test('a changed in-scope paragraph blocks a nonempty approved source repair before writing',async()=>{
 const f=fixture();f.nodes.get('chapter01').heading=0;
 const plan=previewBookRepair(f.content(),{links:[],chapters:[{kind:'toc',text:'Chapter',children:[]}]});assert.ok(plan.total>0);
 f.nodes.get('body00001').string+=' second test';f.writes.length=0;
 await assert.rejects(applyBookRepair(plan),/changed since preview/);assert.equal(f.writes.length,0);assert.equal(f.nodes.get('chapter01').heading,0);f.close();
});

test('image captions do not hide real source headings or become headings themselves',async()=>{
 const f=fixture(); f.record.catalog.headings=true;
 f.nodes.get('body00001').heading=0;
 f.add('caption01','![](https://example.test/image.jpg)**Body heading**','chapter01');
 f.add('subhead01','Subheading','body00001',{heading:3});
 const source={links:[],chapters:[{kind:'toc',text:'Chapter',children:[
  {kind:'paragraph',text:'⟦EPUBI:i0⟧**Body heading**',children:[]},
  {kind:'toc',text:'Body heading',children:[{kind:'heading',text:'Subheading',children:[]}]}
 ]}]};
 const plan=previewBookRepair(f.content(),source);
 assert.deepEqual(plan.headings.changes.map(c=>c.uid),['body00001']);
 await applyBookRepair(plan);
 assert.equal(f.nodes.get('caption01').heading,undefined);
 const outline=readBookContent(f.record).chapters;
 assert.equal(outline.find(c=>c.uid==='body00001').parentUid,'chapter01');
 assert.equal(outline.find(c=>c.uid==='subhead01').parentUid,'body00001');
 assert.equal(previewBookRepair(f.content(),source).headings.counts.chapters,0);
 // Two actual text headings remain ambiguous and must never be guessed.
 f.nodes.get('body00001').heading=0; f.add('another01','Body heading','chapter01');
 assert.ok(!previewBookRepair(f.content(),source).headings.changes.some(c=>c.uid==='body00001'));
 f.close();
});

test('legacy catalogs without a headings flag refresh repaired titles and preserve root scope',()=>{
 const f=fixture();f.record.catalog.source='legacy';
 // Old snapshot omitted this section and attached its subsection to the root.
 f.add('subhead02','Subsection','body00001',{heading:3});
 f.record.catalog.chapters.push({uid:'subhead02',title:'Subsection',parentUid:'chapter01'});
 f.nodes.get('chapter01').heading=0; // Linked roots remain chapters without H1.
 f.add('outside01','Outside heading','page00001',{heading:1});
 const saved=JSON.stringify(f.record.catalog);
 let content=readBookContent(f.record);
 assert.equal(content.chapters.find(c=>c.uid==='body00001').parentUid,'chapter01');
 assert.equal(content.chapters.find(c=>c.uid==='subhead02').parentUid,'body00001');
 assert.equal(content.byUid.get('subhead02').chapterUid,'subhead02');
 assert.ok(!content.byUid.has('outside01'));
 // Read-only refresh follows edits/Undo as well; never migrates stored scope.
 f.nodes.get('body00001').heading=0;
 content=readBookContent(f.record);
 assert.ok(!content.chapters.some(c=>c.uid==='body00001'));
 assert.equal(content.chapters.find(c=>c.uid==='subhead02').parentUid,'chapter01');
 assert.equal(JSON.stringify(f.record.catalog),saved);assert.equal(f.writes.length,0);
 f.close();
});


test('original directory preview applies exactly, survives refresh, excludes body headings and supports Undo',async()=>{
 const f=fixture();f.record.catalog.source='legacy';
 f.add('subhead03','Body-only heading','body00001',{heading:3});
 const source={tocSource:'ncx',toc:[{text:'Chapter'}],links:[],chapters:[{kind:'toc',text:'Chapter',children:[{kind:'toc',text:'Body heading',children:[{kind:'heading',text:'Body-only heading',children:[]}]}]}]};
 const plan=previewBookRepair(f.content(),source);
 assert.equal(plan.counts.navigation,2);
 const snapshot=JSON.stringify(plan);
 const result=await applyBookRepair(plan);
 assert.equal(JSON.stringify(plan),snapshot);
 let content=readBookContent(f.record);
 assert.deepEqual(content.chapters.map(c=>c.uid),['chapter01','body00001']);
 assert.equal(content.byUid.get('subhead03').chapterUid,'body00001');
 assert.equal(f.nodes.get('subhead03').heading,3);
 assert.equal(previewBookRepair(content,source).total,0);
 assert.equal(previewBookRepair(content).total,0);
 await undoBookRepair(result.key);
 content=readBookContent(f.record);
 assert.ok(content.chapters.some(c=>c.uid==='subhead03'));
 f.close();
});

test('changed content invalidates directory-only preview before any write',async()=>{
 const f=fixture();const source={tocSource:'nav',toc:[{}],links:[],chapters:[{kind:'toc',text:'Chapter',children:[]}]};
 const plan=previewBookRepair(f.content(),source);assert.equal(plan.counts.navigation,1);
 f.nodes.get('body00001').string='User edit';
 await assert.rejects(applyBookRepair(plan),/changed since preview/);assert.equal(f.writes.length,0);f.close();
});

test('ambiguous original directory entries do not replace the existing directory',()=>{
 const f=fixture();f.add('duplicate','Body heading','chapter01');
 const source={tocSource:'nav',toc:[{}],links:[],chapters:[{kind:'toc',text:'Chapter',children:[{kind:'toc',text:'Body heading',children:[]}]}]};
 const plan=previewBookRepair(f.content(),source);assert.equal(plan.counts.navigation,0);assert.deepEqual(plan.navigation.unmatched,['Body heading']);f.close();
});

test('directory matching uses source parent and child structure for repeated title text',()=>{
 const f=fixture();f.add('caption02','**Body heading**','chapter01');f.add('repeat001','Body heading','body00001',{heading:3});
 const source={tocSource:'ncx',toc:[{}],links:[],chapters:[{kind:'toc',text:'Chapter',children:[{kind:'toc',text:'Body heading',children:[{kind:'heading',text:'Body heading',children:[]}]}]}]};
 const plan=previewBookRepair(f.content(),source);
 assert.equal(plan.counts.navigation,2);assert.equal(plan.navigation.after.chapters[1].uid,'body00001');f.close();
});

test('source-confirmed sole duplicate title is merged into TOC entry with body IDs and Undo preserved',async()=>{
 const f=fixture();f.nodes.get('body00001').heading=0;
 f.add('repeat002','Body heading','body00001',{heading:2});
 f.add('para00001','Opening paragraph','repeat002');f.add('para00002','Next paragraph','repeat002');
 const source={tocSource:'ncx',toc:[{}],links:[],chapters:[{kind:'toc',text:'Chapter',children:[{kind:'toc',text:'Body heading',children:[{kind:'paragraph',text:'Opening paragraph'},{kind:'paragraph',text:'Next paragraph'}]}]}]};
 const plan=previewBookRepair(f.content(),source);
 assert.ok(plan.headings.changes.some(c=>c.uid==='body00001'&&c.type==='chapter'&&c.after.heading===2));
 assert.ok(plan.headings.changes.some(c=>c.uid==='repeat002'&&c.type==='duplicate'));
 const result=await applyBookRepair(plan);
 assert.equal(f.nodes.get('body00001').heading,2);assert.ok(!f.nodes.has('repeat002'));
 assert.equal(f.nodes.get('para00001').parent,'body00001');assert.equal(f.nodes.get('para00002').parent,'body00001');
 assert.equal(previewBookRepair(f.content(),source).total,0);
 await undoBookRepair(result.key);assert.equal(f.nodes.get('body00001').heading,0);assert.equal(f.nodes.get('para00001').parent,'repeat002');assert.equal(f.nodes.get('repeat002').heading,2);
 f.add('external1','((repeat002))','page00001');
 assert.ok(!previewBookRepair(f.content(),source).headings.changes.some(c=>c.uid==='repeat002'&&c.type==='duplicate'));
 f.close();
});

test('image split is opt-in, keeps text UID/children/refs and is undoable',async()=>{
 const f=fixture();f.nodes.get('body00001').string='![](https://example.test/a.jpg)**Caption**![](https://example.test/b.jpg)';f.add('child0001','Child note','body00001');f.add('ref000001','((body00001))');
 assert.equal(previewBookRepair(f.content()).counts.images,0);
 const plan=previewBookRepair(f.content(),null,{splitImages:true});assert.equal(plan.counts.images,1);
 const result=await applyBookRepair(plan);assert.equal(result.results.images,1);assert.equal(f.nodes.get('body00001').string,'**Caption**');assert.equal(f.nodes.get('child0001').parent,'body00001');assert.equal(f.nodes.get('ref000001').string,'((body00001))');
 const undo=await undoBookRepair(result.key);assert.equal(undo.skipped,0);assert.equal(f.nodes.get('body00001').string,plan.images.changes[0].before);assert.ok(result.steps.images[0].created.every(item=>!f.nodes.has(item.uid)));f.close();
});
test('image split Undo protects newly referenced or edited image blocks',async()=>{
 for(const kind of ['reference','edit','child']){const f=fixture();f.nodes.get('body00001').string='![](https://example.test/a.jpg)Caption';const result=await applyBookRepair(previewBookRepair(f.content(),null,{splitImages:true}));const image=result.steps.images[0].created[0].uid;
 if(kind==='reference')f.add('newref001',`((${image}))`);else if(kind==='edit')f.nodes.get(image).string+=' edited';else f.add('newchild1','note',image);
 const undo=await undoBookRepair(result.key);assert.equal(undo.skipped,1);assert.ok(f.nodes.has(image));assert.equal(f.nodes.get('body00001').string,'Caption');f.close();}
});
test('stale image split rejects all writes with an identifiable error',async()=>{
 const f=fixture();f.nodes.get('body00001').string='![](https://example.test/a.jpg)Caption';const plan=previewBookRepair(f.content(),null,{splitImages:true});f.nodes.get('body00001').string+=' changed';await assert.rejects(applyBookRepair(plan),{code:'STALE_REPAIR_PREVIEW'});assert.equal(f.writes.length,0);f.close();
});

test('multiple image splits preserve sibling order with real insertion shifts and Undo',async()=>{
 const f=fixture();const create=f.api.data.block.create,del=f.api.data.block.delete;
 f.api.data.block.create=async payload=>{const order=payload.location.order,parent=payload.location['parent-uid'];if(typeof order==='number')for(const n of f.nodes.values())if(n.parent===parent&&n.order>=order)n.order++;await create(payload);};
 f.api.data.block.delete=async payload=>{const n=f.nodes.get(payload.block.uid),parent=n?.parent,order=n?.order;await del(payload);for(const item of f.nodes.values())if(item.parent===parent&&item.order>order)item.order--;};
 const first='![](https://example.test/a)First![](https://example.test/b)',second='![](https://example.test/c)Second';
 f.nodes.get('body00001').string=first;f.add('body00002',second,'chapter01');
 const result=await applyBookRepair(previewBookRepair(f.content(),null,{splitImages:true}));assert.equal(result.results.images,2);
 const order=()=>[...f.nodes.values()].filter(n=>n.parent==='chapter01').sort((a,b)=>a.order-b.order).map(n=>n.string);
 assert.deepEqual(order(),['![](https://example.test/a)','First','![](https://example.test/b)','![](https://example.test/c)','Second']);
 const undo=await undoBookRepair(result.key);assert.equal(undo.skipped,0);assert.deepEqual(order(),[first,second]);f.close();
});
test('interrupted image split retains an undo journal',async()=>{
 const f=fixture();const before='![](https://example.test/a)Caption![](https://example.test/b)';f.nodes.get('body00001').string=before;
 const create=f.api.data.block.create;let count=0;f.api.data.block.create=async payload=>{if(payload.block.string==='![](https://example.test/b)')throw Error('Interrupted');await create(payload);};
 await assert.rejects(applyBookRepair(previewBookRepair(f.content(),null,{splitImages:true})),/Interrupted/);
 const {latestBookRepair}=await import('../src/book-repair.js');const record=latestBookRepair(f.content());assert.ok(record.steps.images.length);const undo=await undoBookRepair(record.key);assert.equal(undo.skipped,0);assert.equal(f.nodes.get('body00001').string,before);assert.ok(record.steps.images[0].created.every(item=>!f.nodes.has(item.uid)));f.close();
});

test('panel resize supports drag, keyboard, reopen persistence and viewport bounds',async()=>{
 const f=fixture();const q=f.api.data.q;f.api.data.q=(...args)=>{try{return q(...args);}catch{return [];}};
 const controller=installReader(f.ext);await controller.open();
 const host=document.getElementById('reading-desk-panel');
 host.getBoundingClientRect=()=>({left:100,top:54,width:parseFloat(host.style.width)||410,height:parseFloat(controller.root.querySelector('.rei-reader').style.height)||600});
 const grip=controller.root.querySelector('.rei-resize-handle');
 const event={button:0,pointerId:1,clientX:510,clientY:654,preventDefault(){},stopPropagation(){}};
 grip.onpointerdown(event);grip.onpointermove({...event,clientX:610,clientY:704});grip.onpointerup();
 assert.equal(host.style.width,'510px');assert.equal(controller.root.querySelector('.rei-reader').style.height,'650px');
 grip.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(host.style.width,'520px');
 controller.close();await controller.open();assert.equal(document.getElementById('reading-desk-panel').style.width,'520px');assert.equal(controller.root.querySelector('.rei-reader').style.height,'650px');
 Object.defineProperty(window,'innerWidth',{value:280,configurable:true});Object.defineProperty(window,'innerHeight',{value:260,configurable:true});window.dispatchEvent(new window.Event('resize'));
 assert.equal(document.getElementById('reading-desk-panel').style.width,'256px');assert.equal(controller.root.querySelector('.rei-reader').style.height,'236px');
 controller.cleanup();assert.equal(document.getElementById('reading-desk-panel'),null);f.close();
});

test('link finalization preserves edits, highlights, missing and already-finalized blocks on Resume',async()=>{
 const f=fixture();const texts=['original','edited','^^original^^','final'];
 texts.forEach((s,i)=>f.add('link'+i,s,'chapter01'));
 const plan=[...texts.map((_,i)=>({uid:'link'+i,string:'original',finalString:'final'})),{uid:'missing',string:'original',finalString:'final'}];
 const job={book:{chapters:[]},progress:{blockIndex:plan.length},blockPlan:plan};
 await writeBlockPlan(job,f.api,{wait:async()=>{}});
 assert.deepEqual(texts.map((_,i)=>f.nodes.get('link'+i).string),['final','edited','^^original^^','final']);
 assert.deepEqual(f.writes,[['update','link0']]);assert.equal(job.progress.linkIndex,5);f.close();
});

test('Remove Images rechecks live URLs and retains ledger for files not deleted',async()=>{
 const {prepareImageRemoval,removeBookImages}=await import('../src/roam.js');
 for(const scenario of ['unused','edited','inside-link','new-outside','scan-error','scan-null','delete-error']){
  const f=fixture(),url='https://example.test/picture.jpg';
  f.record.attachments=[{url,hash:'abc'}];f.nodes.get('body00001').string='![]('+url+')';
  await saveManagedBook(f.ext,f.record);const plan=await prepareImageRemoval(f.record,f.ext);
  if(scenario==='edited')f.nodes.get('body00001').string+=' my edit';
  if(scenario==='inside-link')f.add('plainlink',url,'chapter01');
  if(scenario==='new-outside')f.add('outside',url,'page00001');
  const q=f.api.data.q;f.api.data.q=(query,...args)=>{
   if(query.includes(':find ?uid ?s')){
    if(scenario==='scan-error')throw Error('offline');
    if(scenario==='scan-null')return null;
   }return q(query,...args);
  };
  if(scenario==='delete-error')f.api.file.delete=async()=>{throw Error('storage');};
  const result=await removeBookImages(plan,f.ext);
  assert.equal(result.filesDeleted,scenario==='unused'?1:0,scenario);
  const saved=(await getManagedBooks(f.ext))[0];
  assert.equal(saved.attachments.length,scenario==='unused'?0:1,scenario);
  if(scenario==='edited')assert.ok(f.nodes.get('body00001').string.includes('my edit'));
  f.close();
 }
});

test('new block references after Remove Images preview preserve the target UID',async()=>{
 const {prepareImageRemoval,removeBookImages}=await import('../src/roam.js');const f=fixture();
 f.nodes.get('body00001').string='![](https://example.test/img)';
 await saveManagedBook(f.ext,f.record);const plan=await prepareImageRemoval(f.record,f.ext);
 f.add('outside','((body00001))');await removeBookImages(plan,f.ext);
 assert.ok(f.nodes.has('body00001'));assert.equal(f.nodes.get('outside').string,'((body00001))');f.close();
});

test('Delete Book retains attachment referenced while chapter deletion was running',async()=>{
 const f=fixture(),url='https://example.test/img';f.record.attachments=[{url,hash:'a'}];
 await saveManagedBook(f.ext,f.record);const plan=await prepareBookDeletion(f.record,f.ext);
 const del=f.api.data.block.delete;f.api.data.block.delete=async args=>{await del(args);f.add('lateurl',url,'page00001');};
 const result=await deleteManagedBook(plan,f.ext);
 assert.equal(result.deletedAttachments,0);assert.equal(result.preservedAttachments,1);
 assert.ok(!f.writes.some(([op])=>op==='file-delete'));f.close();
});
