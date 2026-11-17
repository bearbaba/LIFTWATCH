import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeWorkspace,resolveScreen} from '../web/workspace.js';

const screens=["overview","register","results","review","console"];
const groupNames=["overview","overview","results","register","review","console"];
function classList(initial=[]){
 const set=new Set(initial);
 return {add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x),
   toggle:(x,on)=>on?set.add(x):set.delete(x)};
}
function element(name,link=false){
 const attrs=new Map();
 const el={dataset:{workspaceScreen:name},classList:classList(),
   hidden:false,inert:false,attrs,
   setAttribute:(k,v)=>attrs.set(k,String(v)),
   removeAttribute:k=>attrs.delete(k),
   getAttribute:k=>attrs.get(k)||null,
   get value(){return this._value},set value(v){this._value=v}};
 if(link)el.setAttribute('href','#'+name);
 return el;
}
function setup(hash='#overview'){
 const panels=groupNames.map(name=>element(name));
 const links=screens.map(name=>element(name,true));
 const events={},moves=[],body={dataset:{workspaceScreens:screens.join(',')},classList:classList()};
 const doc={body,querySelectorAll:(selector)=>selector==='[data-workspace-screen]'?panels:links};
 const win={location:{hash},addEventListener:(name,handler)=>events[name]=handler,
   scrollTo:(...args)=>moves.push(args)};
 return {doc,win,panels,links,events,moves,run(){return initializeWorkspace(doc,win)}};
}
test('declared tabs and grouped sections are present in the deployed HTML',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
 assert.match(html,/<nav class="workspace-tabs"/);
 assert.match(html,/src="\.\/workspace\.js"/);
 assert.match(css,/\.workspace-ready \[data-workspace-screen\]:not\(\.workspace-active\)\{display:none!important\}/);
 const names=[...html.matchAll(/data-workspace-screen="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(names,groupNames);
 for(const name of screens)assert.ok(html.includes('href="#'+name+'"'),'missing navigation '+name);
});
test('default overview shows only its own sections and keeps input nodes mounted',()=>{
 const app=setup();app.panels[1].value='I stay mounted';
 const api=app.run();
 assert.equal(api.active,'overview');
 assert.equal(app.doc.body.classList.contains('workspace-ready'),true);
 assert.equal(app.panels.filter(x=>!x.hidden).length,2);
 assert.equal(app.panels[1].value,'I stay mounted');
 for(const p of app.panels){
  assert.equal(p.inert,p.hidden);
  assert.equal(p.attrs.get('aria-hidden'),String(p.hidden));
 }
 assert.equal(app.links[0].getAttribute('aria-current'),'page');
});
test('link hash switches to exactly one visible screen without re-rendering forms',()=>{
 const app=setup();const api=app.run();
 const activePanel=app.panels.find(panel=>panel.dataset.workspaceScreen===screens[2]);
 activePanel.value='Unsaved signed draft text';
 app.win.location.hash='#'+screens[2];
 app.events.hashchange();
 assert.equal(api.active,screens[2]);
 assert.equal(app.panels.filter(x=>!x.hidden).length,1);
 assert.equal(activePanel.value,'Unsaved signed draft text');
 assert.equal(activePanel.hidden,false);
 assert.equal(app.links[2].getAttribute('aria-current'),'page');
 assert.equal(app.links[0].getAttribute('aria-current'),null);
 assert.equal(app.moves.length,1);
});
test('direct deep links, browser back and unknown URLs remain safe',()=>{
 const app=setup('#'+screens.at(-1));const api=app.run();
 assert.equal(api.active,screens.at(-1));
 assert.equal(app.panels.filter(x=>!x.hidden).length,1);
 app.win.location.hash='#overview';app.events.hashchange();
 assert.equal(app.panels.filter(x=>!x.hidden).length,2);
 app.win.location.hash='#not-a-workspace-panel';app.events.hashchange();
 assert.equal(api.active,'overview');
 assert.equal(resolveScreen('#top',screens),'overview');
});
test('without JavaScript, no section is pre-hidden in HTML',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert.ok(!/<section[^>]*data-workspace-screen[^>]*\shidden(?:\s|>)/.test(html));
});

test('community write forms begin empty while read-only Trial #2 evidence remains selected',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 for(const id of ['title','analyst','minArm','minLift','maxErr','cUsers','cWins','tUsers','tWins','cErrors','tErrors']){
  const input=html.match(new RegExp('<input[^>]*id="'+id+'"[^>]*>'));
  assert.ok(input,'missing community field '+id);
  assert.ok(!/\\bvalue=/.test(input[0]),'pre-filled community input '+id);
 }
 for(const id of ['hypothesis','metricDef','population','randomization','note']){
  assert.match(html,new RegExp('<textarea[^>]*id="'+id+'"[^>]*><\\/textarea>'),'expected empty draft field '+id);
 }
 assert.match(html,/<input id="trialId"[^>]*value="2"/);
 assert.match(html,/Watch real-wallet demo/);
 assert.match(html,/VERIFICATION/i);
 assert.ok(!html.includes('value="2500"'),'sample figures should not prefill write forms');
});
