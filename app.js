'use strict';
// Zihatec M-BUS Explorer v0.7-dev (JS fallback decoder; WASM integration pending)
// M-BUS / EN 13757-2 UART: 8 data bits, even parity, one stop bit.
const $ = id => document.getElementById(id);
let lang=localStorage.getItem('zihatecExplorerLang')||((navigator.language||'de').startsWith('de')?'de':'en');
if(!['de','en'].includes(lang))lang='de';
const tr=(key)=>window.MbusI18n?.[lang]?.[key]||key;
const localName=name=>lang==='en'?(window.MbusNames?.[name]||name):name;
function applyLanguage(){document.documentElement.lang=lang;$('langDe').classList.toggle('active',lang==='de');$('langEn').classList.toggle('active',lang==='en');$('langDe').setAttribute('aria-pressed',String(lang==='de'));$('langEn').setAttribute('aria-pressed',String(lang==='en'));document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=tr(el.dataset.i18n)});if(!port)status(tr('notConnected'));updateTree();if(activeAddress!==null)showDevice(activeAddress);}

let port=null, reader=null, writer=null, rx=[], pending=null, cancelled=false, busy=false, readTask=null;
let logLines=0;
const devices=new Map();let activeAddress=null;
let allowedPorts=[];let portBusy=false; const frameBits=new Map();
function log(s){const t=new Date().toLocaleTimeString();$('log').textContent+=`[${t}] ${s}\n`;$('log').scrollTop=$('log').scrollHeight;if(++logLines>800){$('log').textContent=$('log').textContent.split('\n').slice(-550).join('\n');logLines=550;}}
function status(s,on=false){$('status').textContent=s;$('status').classList.toggle('on',on)}
function controls(){const on=!!port;$('connect').disabled=on||!allowedPorts.length;$('ports').disabled=on;$('choosePort').disabled=on;$('refreshPorts').disabled=on;$('disconnect').disabled=!on;$('scan').disabled=!on||busy;$('read').disabled=!on||busy;$('reset').disabled=!on||busy;$('stop').disabled=!busy;$('baud').disabled=on;$('configure').disabled=!on||busy||activeAddress===null||!!devices.get(activeAddress)?.imported;$('setAddress').disabled=!on||busy;$('setBaud').disabled=!on||busy;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function notify(frame){if(!pending)return;const p=pending;pending=null;clearTimeout(p.timer);p.resolve(frame)}
function parseRx(){while(rx.length){let b=rx[0];if(b===0xE5){rx.shift();log('RX  E5 (ACK)');notify({kind:'ack',bytes:[0xE5]});continue}if(b===0x10){if(rx.length<5)return;let f=rx.slice(0,5);if(f[4]===0x16&&((f[1]+f[2])&255)===f[3]){rx.splice(0,5);log('RX  '+hex(f));notify({kind:'short',bytes:f});continue}rx.shift();continue}if(b===0x68){if(rx.length<4)return;let n=rx[1];if(rx[2]!==n||rx[3]!==0x68||n>252){rx.shift();continue}let end=n+6;if(rx.length<end)return;let f=rx.slice(0,end);let sum=f.slice(4,4+n).reduce((a,b)=>a+b,0)&255;if(f[end-1]===0x16&&f[end-2]===sum){rx.splice(0,end);log('RX  '+hex(f));notify({kind:'long',bytes:f,data:f.slice(4,4+n)});continue}rx.shift();continue}rx.shift()}}
async function listen(){try{while(port&&reader){const {value,done}=await reader.read();if(done)break;if(value){rx.push(...value);parseRx()}}}catch(e){log('Empfangsfehler: '+e.message)}finally{if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.resolve(null)}}}
function portName(p,index){
 const v=p.getInfo?.()||{};
 const usb=(v.usbVendorId!==undefined)?`USB VID:${v.usbVendorId.toString(16).padStart(4,'0').toUpperCase()} PID:${(v.usbProductId||0).toString(16).padStart(4,'0').toUpperCase()}`:'Serieller Port';
 return `Port ${index+1} · ${usb}`;
}
async function refreshPorts(selectPort=null){
 if(!('serial' in navigator)){log('Web Serial ist in diesem Browser nicht verfügbar.');return}
 try{
  allowedPorts=await navigator.serial.getPorts();
  const selected=selectPort?allowedPorts.indexOf(selectPort):Number($('ports').value);
  $('ports').replaceChildren();
  allowedPorts.forEach((p,i)=>{const opt=document.createElement('option');opt.value=String(i);opt.textContent=portName(p,i);$('ports').append(opt)});
  if(!allowedPorts.length){const opt=document.createElement('option');opt.textContent='Noch kein Port freigegeben';opt.value='';$('ports').append(opt)}
  else $('ports').value=String(selected>=0&&selected<allowedPorts.length?selected:0);
  controls();
 }catch(e){log('Portliste: '+e.message)}
}
async function choosePort(){
 if(!('serial' in navigator)){alert('Web Serial ist in diesem Browser nicht verfügbar.');return}
 try{const selected=await navigator.serial.requestPort();await refreshPorts(selected);log('Schnittstelle freigegeben: '+portName(selected,allowedPorts.indexOf(selected)))}
 catch(e){if(e.name!=='NotFoundError')log('Portauswahl: '+e.message)}
}
async function connect(){
 if(!('serial' in navigator)){alert('Web Serial ist hier nicht verfügbar.');return}
 const index=Number($('ports').value);
 if(!allowedPorts[index]){alert('Bitte zuerst eine serielle Schnittstelle freigeben.');return}
 port=allowedPorts[index];
 try{
  await port.open({baudRate:Number($('baud').value),dataBits:8,stopBits:1,parity:'even',flowControl:'none'});
  reader=port.readable.getReader();writer=port.writable.getWriter();rx=[];readTask=listen();
  status(portName(port,index)+' · '+$('baud').value+' 8E1',true);
  log('Verbindung geöffnet: '+portName(port,index)+', '+$('baud').value+' Baud, 8E1.');controls();
 }catch(e){log('Verbindung fehlgeschlagen: '+e.message);try{if(port?.readable&&!port.readable.locked)await port.close()}catch{}port=null;controls()}
}
async function disconnect(){cancelled=true;if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.resolve(null)}try{await reader?.cancel()}catch{}try{await readTask}catch{}try{reader?.releaseLock()}catch{}reader=null;try{writer?.releaseLock()}catch{}writer=null;try{await port?.close()}catch(e){log('Trennen: '+e.message)}port=null;busy=false;status(tr('notConnected'));log('Verbindung getrennt.');controls()}
function shortFrame(control,address){return [0x10,control,address,(control+address)&255,0x16]}
async function transact(bytes,waitReply=true){if(!writer)throw Error('Keine Verbindung');rx=[];const response=waitReply?new Promise(resolve=>{const timer=setTimeout(()=>{pending=null;resolve(null)},Math.max(100,Number($('timeout').value)||1300));pending={resolve,timer}}):null;log('TX  '+hex(bytes));try{await writer.write(new Uint8Array(bytes))}catch(e){if(pending){clearTimeout(pending.timer);pending=null}throw e}return waitReply?await response:null}
async function resetLink(addr){const r=await transact(shortFrame(0x40,addr));if(r)frameBits.set(addr,0);return r}
async function requestData(addr){const bit=frameBits.get(addr)||0;const r=await transact(shortFrame(bit?0x7B:0x5B,addr));if(r&&r.kind==='long')frameBits.set(addr,bit^1);return r}
function addMeta(key,value){const wrap=document.createElement('div');wrap.className='meta-item';const k=document.createElement('span');k.className='k';k.textContent=key;const v=document.createElement('span');v.className='v';v.textContent=String(value);wrap.append(k,v);$('meterMeta').append(wrap)}
function updateTree(){const tree=$('deviceTree');tree.replaceChildren();$('deviceCount').textContent=String(devices.size);if(!devices.size){const p=document.createElement('p');p.className='muted';p.textContent=tr('noDevices');tree.append(p);return}for(const [addr,entry] of [...devices].sort((a,b)=>a[0]-b[0])){const btn=document.createElement('button');btn.type='button';btn.className='device-node'+(addr===activeAddress?' selected':'');btn.setAttribute('role','treeitem');btn.setAttribute('aria-selected',String(addr===activeAddress));const head=document.createElement('span');head.className='node-head';const dot=document.createElement('span');dot.className='node-bullet';dot.textContent='●';head.append(dot,document.createTextNode(tr('address')+' '+addr));const sub=document.createElement('span');sub.className='node-sub';const d=entry.decoded||{};sub.textContent=[d.manufacturer,d.id,d.medium].filter(Boolean).join(' · ')||'Antwort empfangen';btn.append(head,sub);btn.onclick=()=>{$('configPanel').hidden=true;showDevice(addr);$('address').value=addr;controls()};tree.append(btn)}}
function localizedDetails(v){if(lang==='de')return v;return String(v).replace(/Momentanwert/g,tr('instant')).replace(/Maximum/g,tr('maximum')).replace(/Minimum/g,tr('minimum')).replace(/Fehlerwert/g,tr('error')).replace(/Speicher/g,tr('storage')).replace(/Tarif/g,tr('tariff')).replace(/Einheit (?=\d)/g,tr('subunit')+' ')}
function showDevice(addr){activeAddress=addr;updateTree();controls();const entry=devices.get(addr);$('detailTitle').textContent=tr('device')+' · '+tr('address')+' '+addr;$('address').value=addr;$('records').replaceChildren();$('meterMeta').replaceChildren();$('decodeWarning').hidden=true;$('recordCount').textContent='0';$('exportCsv').disabled=true;
 if(!entry){$('meterInfo').textContent=tr('noAnswer');$('rawFrame').textContent=tr('noFrame');return}
 const d=entry.decoded||{};$('rawFrame').textContent=(entry.frames||[entry.frame]).map((f,i)=>`${tr('frame')} ${i+1}: ${hex(f.bytes||[])}`).join('\n\n');
 if(d.message){$('meterInfo').textContent=d.message;return}
 $('meterInfo').textContent=tr('lastRead')+': '+entry.time.toLocaleTimeString()+' · CI '+hex([d.ci||0]);
 for(const [k,v] of [[tr('primaryAddress'),addr],[tr('manufacturer'),d.manufacturer||'—'],[tr('identification'),d.id||'—'],[tr('medium'),localName(d.medium)||'—'],[tr('version'),d.version??'—'],[tr('access'),d.access??'—'],[tr('status'),d.status===undefined?'—':'0x'+d.status.toString(16).padStart(2,'0')]])addMeta(k,v);
 if(d.warning){$('decodeWarning').textContent=tr('decoderWarning')+': '+d.warning;$('decodeWarning').hidden=false}
 const records=d.records||[];$('recordCount').textContent=String(records.length);$('exportCsv').disabled=records.length===0;$('exportJson').disabled=false;
 if(!records.length){const row=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.className='muted';td.textContent=tr('noRecords');row.append(td);$('records').append(row)}
 for(const r of records){const tr=document.createElement('tr');if(r.unknown)tr.className='unknown';for(const [i,x] of [localName(r.name),r.value,r.unit,localizedDetails(r.details),r.raw].entries()){const td=document.createElement('td');td.textContent=String(x);if(i===1)td.className='value';tr.append(td)}$('records').append(tr)}
}
function render(frame,addr){if(!frame||frame.kind!=='long'){if(addr===activeAddress||activeAddress===null)$('meterInfo').textContent=frame?.kind==='ack'?'ACK statt Messdatentelegramm empfangen.':'Keine Antwort empfangen.';return null}const d=window.MbusDecoder.decode(frame);devices.set(addr,{frame,decoded:d,time:new Date()});showDevice(addr);return d}
function csvExport(){const e=devices.get(activeAddress);if(!e?.decoded?.records?.length)return;const rows=[['Primäradresse','Hersteller','Identifikation','Medium','Messgröße','Wert','Einheit','Funktion/Speicher/Tarif','Rohdaten']];for(const r of e.decoded.records)rows.push([activeAddress,e.decoded.manufacturer||'',e.decoded.id||'',e.decoded.medium||'',r.name,r.value,r.unit,r.details,r.raw]);const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=`zihatec-mbus-${activeAddress}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$('exportCsv').onclick=csvExport;
async function guarded(fn){if(busy)return;busy=true;cancelled=false;controls();try{await fn()}catch(e){log('Fehler: '+e.message);if(!$('configPanel').hidden)$('configResult').textContent='⚠ '+e.message}finally{busy=false;controls()}}
$('connect').onclick=connect;$('choosePort').onclick=choosePort;$('refreshPorts').onclick=()=>refreshPorts();$('disconnect').onclick=disconnect;$('clear').onclick=()=>{$('log').textContent='';logLines=0};$('stop').onclick=()=>{cancelled=true;log('Scan-Abbruch angefordert.');if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.resolve(null)}};
$('reset').onclick=()=>guarded(async()=>{const a=Number($('address').value);if(a<0||a>250)return;const r=await resetLink(a);log(r?'SND_NKE quittiert.':'Keine Antwort auf SND_NKE.')});
async function readComplete(a){
 const frames=[];let all=[],first=null,notice='';const max=25;
 for(let n=0;n<max&&!cancelled;n++){
  const r=await requestData(a);if(!r||r.kind!=='long'){notice=frames.length?'Auslesen unvollständig: Timeout oder unerwartete Antwort.':'Keine gültige Antwort.';break}
  frames.push(r);const d=window.MbusDecoder.decode(r);if(!d){notice='Telegramm nicht dekodierbar.';break}
  if(!first)first=d;
  all.push(...(d.records||[]));
  log(`Adresse ${a}: Telegramm ${n+1}, ${d.records?.length||0} Datensätze${d.more?', weitere angekündigt':''}`);
  if(!d.more){notice=d.warning||'';break}
  if(n===max-1)notice='Sicherheitsgrenze: 25 Folgetelegramme.';
 }
 if(first){first.records=all.map((r,i)=>({...r,index:i+1}));first.warning=notice;devices.set(a,{frame:frames[frames.length-1],frames,decoded:first,time:new Date()});showDevice(a)}
 else if(!frames.length)log('Keine Messdaten von Adresse '+a);
}
$('read').onclick=()=>guarded(async()=>{const a=Number($('address').value);if(!Number.isInteger(a)||a<0||a>250)return;await readComplete(a)});
$('scan').onclick=()=>guarded(async()=>{const from=Number($('from').value),to=Number($('to').value);if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to>250||to<from){alert('Bitte gültigen Adressbereich 0–250 eingeben.');return}$('progress').value=0;let found=0;for(let a=from;a<=to&&!cancelled;a++){const pct=Math.round((a-from)/(to-from+1)*100);$('progress').value=pct;$('scanStatus').textContent=`Prüfe Adresse ${a} / ${to} · Gefunden: ${found}`;await resetLink(a);if(cancelled)break;await sleep(70);const r=await requestData(a);if(r&&r.kind==='long'){found++;const d=window.MbusDecoder.decode(r);devices.set(a,{frame:r,frames:[r],decoded:d,time:new Date()});updateTree();if(activeAddress===null)showDevice(a)}await sleep(70)}$('progress').value=cancelled?$('progress').value:100;$('scanStatus').textContent=`${cancelled?'Abgebrochen':'Fertig'} · ${found} Gerät(e) in diesem Scan gefunden · ${devices.size} insgesamt.`});

// Service telegrams: SND_UD with CI 0x51 for address change, and baud-specific CI.
function longFrame(control,address,ci,payload=[]){const body=[control,address,ci,...payload];return [0x68,body.length,body.length,0x68,...body,body.reduce((a,b)=>a+b,0)&255,0x16]}
function serviceTarget(){const a=activeAddress;if(!port||a===null||!devices.has(a)||devices.get(a).imported||Number($('address').value)!==a)throw Error(tr('selectDevice'));return a}
function configMessage(message){$('configResult').textContent=message;log('CONFIG  '+message)}
function ackOnly(r){return r?.kind==='ack'}
$('configure').onclick=()=>{$('configPanel').hidden=!$('configPanel').hidden; if(!$('configPanel').hidden){$('newAddress').value=activeAddress??1;$('newBaud').value=$('baud').value;$('configResult').textContent=''}};
$('configClose').onclick=()=>{$('configPanel').hidden=true};
async function checkAddressTarget(a){const r=await resetLink(a);if(!ackOnly(r))return false;await sleep(120);const d=await requestData(a);return d?.kind==='long'}
$('setAddress').onclick=()=>guarded(async()=>{
 const old=serviceTarget(),next=Number($('newAddress').value);
 if(!Number.isInteger(next)||next<1||next>250||next===old)throw Error(tr('badAddress'));
 if(!confirm(`${tr('warnConfirm')}\n${old} → ${next}`))return;
 configMessage(`Checking address ${next} …`);
 // Do not overwrite devices on the destination address. ACK alone is not proof of a meter.
 if(devices.has(next)||await checkAddressTarget(next))throw Error(tr('targetOccupied'));
 await resetLink(old);const ack=await transact(longFrame(0x53,old,0x51,[0x01,0x7A,next]));
 if(!ackOnly(ack))throw Error(tr('notAck'));
 await sleep(250);const r=await resetLink(next);const frame=ackOnly(r)?await requestData(next):null;
 if(frame?.kind==='long'){
   const decoded=window.MbusDecoder.decode(frame);
   devices.delete(old);devices.set(next,{frame,frames:[frame],decoded,time:new Date()});
   $('address').value=next;showDevice(next);configMessage(tr('verified'));
 }else configMessage(tr('notVerified'));
});
const baudCI={300:0xB8,600:0xB9,1200:0xBA,2400:0xBB,4800:0xBC,9600:0xBD,19200:0xBE,38400:0xBF};
$('setBaud').onclick=()=>guarded(async()=>{
 const a=serviceTarget(),next=Number($('newBaud').value),old=Number($('baud').value);
 if(!(next in baudCI))throw Error('Unsupported baud');if(next===old)throw Error(tr('sameBaud'));
 if(!confirm(`${tr('warnConfirm')}\n${old} → ${next} Baud`))return;
 await resetLink(a);const ack=await transact(longFrame(0x53,a,baudCI[next]));
 if(!ackOnly(ack))throw Error(tr('notAck'));
 // Device confirms at old rate; close and reopen the SAME permission-granted serial port at new rate.
 configMessage('ACK · '+next+' Baud');
 await disconnect();$('baud').value=String(next);await connect();busy=true;controls();
 if(!port){configMessage(tr('wrongBaud'));return}
 await sleep(250);const reset=await resetLink(a);const frame=ackOnly(reset)?await requestData(a):null;
 if(frame?.kind==='long'){
  devices.set(a,{frame,frames:[frame],decoded:window.MbusDecoder.decode(frame),time:new Date()});showDevice(a);configMessage(tr('verified'));
 } else configMessage(tr('wrongBaud'));
});
for(const [id,code] of [['langDe','de'],['langEn','en']])$(id).addEventListener('click',()=>{lang=code;localStorage.setItem('zihatecExplorerLang',lang);applyLanguage()});
$('aboutOpen').onclick=()=>$('aboutDialog').showModal();$('aboutClose').onclick=()=>$('aboutDialog').close();
$('address').addEventListener('change',()=>{if(Number($('address').value)!==activeAddress){$('configPanel').hidden=true;controls()}});

// v0.7-dev: offline telegram import for repeatable decoder comparisons. Never transmits anything.
function parseImportedHex(source){
 const cleaned=source.replace(/(?:0x)/gi,'').replace(/[\s,;:\-]+/g,'').trim();
 if(!cleaned||cleaned.length%2||!/^[0-9a-f]+$/i.test(cleaned))throw Error(tr('invalidHex'));
 const bytes=Array.from(cleaned.matchAll(/../g),m=>parseInt(m[0],16));
 if(bytes.length>4096)throw Error(tr('tooLong'));
 const frames=[];let offset=0;
 while(offset<bytes.length){
  const b=bytes[offset];
  if(b===0xE5){frames.push({kind:'ack',bytes:[b]});offset++;continue}
  if(b===0x10){const f=bytes.slice(offset,offset+5);if(f.length!==5||f[4]!==0x16||((f[1]+f[2])&255)!==f[3])throw Error(tr('invalidFrame')+' @ '+offset);frames.push({kind:'short',bytes:f});offset+=5;continue}
  if(b===0x68){const n=bytes[offset+1];if(n===undefined||n>252||bytes[offset+2]!==n||bytes[offset+3]!==0x68)throw Error(tr('invalidFrame')+' @ '+offset);const len=n+6,f=bytes.slice(offset,offset+len);if(f.length!==len||f[len-1]!==0x16||f[len-2]!==((f.slice(4,4+n).reduce((a,b)=>a+b,0))&255))throw Error(tr('invalidChecksum')+' @ '+offset);frames.push({kind:'long',bytes:f,data:f.slice(4,4+n)});offset+=len;continue}
  throw Error(tr('invalidFrame')+' @ '+offset);
 }return frames;
}
$('importFrame').onclick=()=>{
 try{
  const frames=parseImportedHex($('importHex').value);const long=frames.filter(f=>f.kind==='long');if(!long.length)throw Error(tr('noLongFrame'));
  const address=Number($('importAddress').value);if(!Number.isInteger(address)||address<0||address>250)throw Error(tr('badImportAddress'));
  const decoded=long.map(f=>window.MbusDecoder.decode(f));
  const first={...decoded[0],records:decoded.flatMap(d=>d?.records||[]),more:false};
  const warnings=decoded.map(d=>d?.warning).filter(Boolean);first.warning=warnings.join(' | ');
  devices.set(address,{frame:long.at(-1),frames:long,decoded:first,time:new Date(),imported:true});
  showDevice(address);$('importResult').textContent=tr('importOk')+': '+long.length+' / '+first.records.length;
  log('IMPORT  '+long.length+' '+tr('frame')+' · '+first.records.length+' records · '+tr('address')+' '+address);
  $('exportJson').disabled=false;
 }catch(e){$('importResult').textContent='⚠ '+e.message;log('IMPORT ERROR  '+e.message)}
};
$('exportJson').onclick=()=>{const e=devices.get(activeAddress);if(!e)return;const data={explorerVersion:'0.7-dev',decoder:window.MbusDecoder.metadata,primaryAddress:activeAddress,imported:!!e.imported,frames:(e.frames||[e.frame]).map(f=>hex(f.bytes)),decoded:e.decoded};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='zihatec-mbus-'+activeAddress+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};

controls();updateTree();applyLanguage();refreshPorts();log('Zihatec M-BUS Explorer v0.7-dev ready.');
