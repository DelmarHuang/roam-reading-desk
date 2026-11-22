import {catalogFromPlan} from '../src/catalog.js';
import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {zipSync,strToU8} from 'fflate';
import {parseEpub} from '../src/epub.js';import {prepareBlockPlan} from '../src/writer.js';import {styledHeadings} from '../src/epub-headings.js';import {blockTreeChanged} from '../src/dom-changes.js';
function epub(html,{nav=true,ncx=false,css=''}={}){
 const files={'META-INF/container.xml':'<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>', 'book.opf':`<package><metadata><title>Generic fixture</title></metadata><manifest><item id="body" href="body.xhtml" media-type="application/xhtml+xml"/><item id="style" href="style.css" media-type="text/css"/>${nav?'<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>':''}${ncx?'<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>':''}</manifest><spine ${ncx?'toc="ncx"':''}><itemref idref="body"/></spine></package>`,'body.xhtml':`<html><head><link rel="stylesheet" href="style.css"/></head><body>${html}</body></html>`,'style.css':css};
 if(nav)files['nav.xhtml']='<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="body.xhtml#chapter">Chapter</a></li></ol></nav></body></html>';
 if(ncx)files['toc.ncx']='<ncx><navMap><navPoint><navLabel><text>Chapter</text></navLabel><content src="body.xhtml#chapter"/></navPoint></navMap></ncx>';
 return zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])));
}
const setup=()=>{const dom=new JSDOM('');Object.assign(globalThis,{window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser});return dom;};
const plan=book=>{let i=0;return prepareBlockPlan({book,progress:{pageUid:'root'},assetEmbeds:{}},()=>`uid${i++}`);};
for(const options of [{nav:true},{nav:false,ncx:true},{nav:false}])test(`generic EPUB headings with ${JSON.stringify(options)} preserve body hierarchy`,async()=>{
 const dom=setup();const book=await parseEpub(epub('<h1 id="chapter">Chapter</h1><h3>Section</h3><p>Text</p><h5>Subsection</h5><p>More</p><h3>Next section</h3>',options));const blocks=plan(book);
 assert.equal(blocks.find(b=>b.string==='Section').heading,2);assert.equal(blocks.find(b=>b.string==='Subsection').heading,3);assert.equal(blocks.find(b=>b.string==='Next section').heading,2);assert.equal(blocks.filter(b=>b.string==='Chapter').length,1);assert.equal(blocks.find(b=>b.string==='Text').heading,0);dom.window.close();
});
test('ARIA headings work without guessing from bold body text',async()=>{
 const dom=setup();const book=await parseEpub(epub('<h1 id="chapter">Chapter</h1><div role="heading" aria-level="2">Accessible heading</div><p><b>Normal emphasis</b></p>'));const blocks=plan(book);assert.equal(blocks.find(b=>b.string==='Accessible heading').heading,2);assert.equal(blocks.find(b=>b.string.includes('Normal emphasis')).heading,0);dom.window.close();
});
test('stylesheet subheadings are opt-in and partial emphasis is never a heading',async()=>{
 const dom=setup();const input=epub('<h1 id="chapter">Chapter</h1><p>Ordinary text repeated to establish body size.</p><p class="sub">Visual section</p><p><b>Emphasis</b> within body</p><p class="quote">Quotation</p>',{css:'p{font-size:16px}.sub{font-size:1.2em;font-weight:bold}.quote{font-size:16px;font-weight:bold}'});
 const plain=plan(await parseEpub(input));assert.equal(plain.find(b=>b.string==='Visual section').heading,0);
 const inferred=plan(await parseEpub(input,'test.epub',{includeStyledHeadings:true}));assert.equal(inferred.find(b=>b.string==='Visual section').heading,2);assert.equal(inferred.find(b=>b.string==='Quotation').heading,0);assert.equal(inferred.find(b=>b.string.includes('within body')).heading,0);dom.window.close();
});
test('adjacent bold spans in a split chapter title are recognised as the TOC title',async()=>{
 const dom=setup();const book=await parseEpub(epub('<h1 id="chapter"><b>Cha</b><b>pter</b></h1><p>Text</p>'));assert.equal(plan(book).filter(b=>b.heading).length,1);dom.window.close();
});
test('more than three source heading levels retain nested blocks without inventing H4',async()=>{
 const dom=setup();const blocks=plan(await parseEpub(epub('<h1 id="chapter">Chapter</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><p>End</p>')));const four=blocks.find(b=>b.string==='**Four**'),five=blocks.find(b=>b.string==='Five');assert.equal(four.heading,0);assert.equal(five.parentUid,four.uid);dom.window.close();
});
test('image and progress UI mutations do not rescan reading blocks',()=>{
 const dom=setup();const image=document.createElement('img'),label=document.createTextNode('40%'),block=document.createElement('div');block.className='rm-block';block.dataset.blockUid='test';assert.equal(blockTreeChanged([{addedNodes:[image,label],removedNodes:[]}]),false);assert.equal(blockTreeChanged([{addedNodes:[block],removedNodes:[]}]),true);dom.window.close();
});
test('EPUB without TOC or heading tags keeps ordinary paragraphs as body text',async()=>{
 const dom=setup();const blocks=plan(await parseEpub(epub('<p>First paragraph</p><p>Second paragraph</p>',{nav:false})));assert.equal(blocks.filter(b=>b.heading).length,1);assert.equal(blocks.find(b=>b.string==='First paragraph').heading,0);assert.equal(blocks.find(b=>b.string==='Second paragraph').heading,0);dom.window.close();
});
test('book image hints are scoped, respect existing choices and clean up',async()=>{
 const {optimizeBookImages}=await import('../src/book-images.js');const dom=setup();document.body.innerHTML='<main class="roam-main"><div class="rm-block" data-block-uid="book"><img id="a" src="a.png"><img id="b" loading="eager"></div><div class="rm-block" data-block-uid="other"><img id="c"></div></main>';
 const stop=optimizeBookImages({byUid:new Map([['book',{}]])});assert.equal(document.querySelector('#a').getAttribute('loading'),'lazy');assert.equal(document.querySelector('#b').getAttribute('loading'),'eager');assert.equal(document.querySelector('#c').hasAttribute('decoding'),false);
 const next=document.createElement('img');document.querySelector('[data-block-uid="book"]').append(next);await Promise.resolve();assert.equal(next.getAttribute('decoding'),'async');stop();assert.equal(next.hasAttribute('decoding'),false);assert.equal(document.querySelector('#a').hasAttribute('loading'),false);assert.equal(document.querySelector('#b').getAttribute('loading'),'eager');dom.window.close();
});

for(const options of [{nav:true},{nav:false,ncx:true},{nav:false}])test(`import directory is distinct from body heading formatting: ${JSON.stringify(options)}`,async()=>{
 const dom=setup();const book=await parseEpub(epub('<h1 id="chapter">Chapter</h1><h2>Body section</h2><p>Text</p>',options));
 const job={book,blockPlan:plan(book)};const catalog=catalogFromPlan(job);
 assert.equal(job.blockPlan.find(b=>b.string==='Body section').heading,2);
 if(options.nav||options.ncx)assert.deepEqual(catalog.navigation.chapters.map(c=>c.title),['Chapter']);
 else assert.equal(catalog.navigation,undefined);
 dom.window.close();
});

test('mixed image and caption become separate blocks in source order',async()=>{
 const dom=setup();const book=await parseEpub(epub('<h1 id="chapter">Chapter</h1><p><img src="https://example.test/a.jpg"/><b>Caption</b><img src="https://example.test/b.jpg"/></p><p>Next</p>'));
 const blocks=plan(book);const caption=blocks.findIndex(b=>b.string==='**Caption**');assert.ok(caption>0);assert.match(blocks[caption-1].string,/EPUBI|!\[/);assert.match(blocks[caption+1].string,/EPUBI|!\[/);assert.equal(blocks[caption-1].heading,0);assert.equal(blocks[caption+1].heading,0);assert.equal(blocks[caption+2].string,'Next');dom.window.close();
});

test('image splitter retains balanced URL parentheses and leaves malformed syntax intact',async()=>{
 const {splitImages}=await import('../src/image-split.js');const text='![](https://example.test/a(b).png)Caption';assert.deepEqual(splitImages(text).map(p=>p.text),['![](https://example.test/a(b).png)','Caption']);assert.deepEqual(splitImages('![](unfinished'),[{text:'![](unfinished',image:false}]);
});
test('new repair and import messages have all five translations',async()=>{
 const keys=['Book or referenced content changed since preview. Preview the repair again.','For faster importing, keep this Roam window and tab active until the import finishes. Switching to another app or tab may slow it down.','Separate images and text in existing blocks (preview first)','Separate images and text in {0} blocks; keep text IDs and child blocks','{0} complex or chapter-root image blocks were left unchanged.','{0} image/text blocks'];
 for(const code of ['zh','fr','it','de','es']){const {default:messages}=await import(`../src/locales/${code}.js`);for(const key of keys){assert.ok(messages[key],code+': '+key);assert.deepEqual(messages[key].match(/\{\d+\}/g),key.match(/\{\d+\}/g));}}
});
