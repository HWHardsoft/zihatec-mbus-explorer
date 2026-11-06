'use strict';
// Fallback decoder from Zihatec Explorer v0.4.
// This JavaScript fallback is not a WebAssembly implementation.
const hex = bs => [...bs].map(x => x.toString(16).toUpperCase().padStart(2,'0')).join(' ');
// Upgrade seam: replace this decoder module after testing a libmbus WASM build.
function bcd(bytes){
 const digits=[];for(let i=bytes.length-1;i>=0;i--)digits.push((bytes[i]>>4)&15,bytes[i]&15);
 return digits.some(x=>x>9)?'Ungültige BCD: '+hex(bytes):digits.join('').replace(/^0+(?=\d)/,'');
}
function manufacturer(a,b){const v=a|(b<<8);return [10,5,0].map(shift=>{let n=(v>>shift)&31;return n>=1&&n<=26?String.fromCharCode(64+n):'?'}).join('')}
const media={0:'Andere',1:'Öl',2:'Strom',3:'Gas',4:'Wärme',5:'Dampf',6:'Warmwasser',7:'Wasser',8:'Heizkostenverteiler',9:'Druckluft',10:'Kühlung (Vorlauf)',11:'Kühlung (Rücklauf)',12:'Wärme',13:'Wärme/Kühlung',14:'Bus/System',15:'Unbekannt',22:'Kaltwasser'};
function uintValue(raw,little=true){let n=0n;const bytes=little?raw:[...raw].reverse();for(let i=bytes.length-1;i>=0;i--)n=(n<<8n)+BigInt(bytes[i]);return n}
function signedValue(raw){let v=uintValue(raw);if(raw.length&&raw[raw.length-1]&128)v-=1n<<BigInt(raw.length*8);return v}
function scaleValue(value,exponent){if(typeof value==='bigint'){if(exponent>=0)return (value*10n**BigInt(exponent)).toString();const str=value.toString(),neg=str.startsWith('-'),digits=neg?str.slice(1):str,k=-exponent;const padded=digits.padStart(k+1,'0');return (neg?'-':'')+(padded.slice(0,-k)+'.'+padded.slice(-k)).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'')}
 if(typeof value==='number'&&Number.isFinite(value))return Number((value*10**exponent).toPrecision(12)).toString();return String(value)}
function vifInfo(vif,vifes){
 const c=vif&127, x=vifes.length?(vifes[0]&127):-1;
 const range=(lo,hi,name,unit,exp)=>c>=lo&&c<=hi?{name,unit,exp:exp(c)}:null;
 if(c===0x7D){
  const names={8:'Zugriffsnummer',9:'Medium',10:'Hersteller',11:'Parametersatz',12:'Modell / Version',13:'Hardwareversion',14:'Firmwareversion',15:'Softwareversion',16:'Kundenstandort',17:'Kundennummer',23:'Fehlerflags',24:'Fehlermaske',26:'Digitale Ausgänge',27:'Digitale Eingänge',28:'Baudrate',29:'Antwortverzögerung',30:'Wiederholungen',32:'Erster zyklischer Speicher',33:'Letzter zyklischer Speicher',34:'Größe Speicherblock',96:'Resetzähler',97:'Summenzähler',98:'Steuersignal'};
  if(x>=0x40&&x<=0x4f)return {name:'Spannung',unit:'V',exp:x-0x40-9};
  if(x>=0x50&&x<=0x5f)return {name:'Strom',unit:'A',exp:x-0x50-12};
  return {name:names[x]||'VIF-Erweiterung FD',unit:names[x]?'':'FD '+hex(vifes),exp:0,unknown:!names[x],digital:x===26||x===27};
 }
 if(c===0x7B){
  if(x>=0x58&&x<=0x5b)return {name:'Vorlauftemperatur',unit:'°F',exp:x-0x5b};
  if(x>=0x5c&&x<=0x5f)return {name:'Rücklauftemperatur',unit:'°F',exp:x-0x5f};
  if(x>=0x60&&x<=0x63)return {name:'Temperaturdifferenz',unit:'°F',exp:x-0x63};
  if(x>=0x64&&x<=0x67)return {name:'Außentemperatur',unit:'°F',exp:x-0x67};
  if(x>=0x74&&x<=0x77)return {name:'Temperaturgrenze',unit:'°C',exp:x-0x77};
  return {name:'VIF-Erweiterung FB',unit:'FB '+hex(vifes),exp:0,unknown:true};
 }
 let r=range(0,7,'Energie','Wh',v=>v-3)||range(8,15,'Energie','J',v=>v-3)||range(16,23,'Volumen','m³',v=>v-22)||range(24,31,'Masse','kg',v=>v-27)||range(40,47,'Leistung','W',v=>v-43)||range(48,55,'Leistung','J/h',v=>v-51)||range(56,63,'Volumenstrom','m³/h',v=>v-62)||range(64,71,'Volumenstrom','m³/min',v=>v-71)||range(72,79,'Volumenstrom','m³/s',v=>v-81)||range(80,87,'Massenstrom','kg/h',v=>v-83)||range(88,91,'Vorlauftemperatur','°C',v=>v-91)||range(92,95,'Rücklauftemperatur','°C',v=>v-95)||range(96,99,'Temperaturdifferenz','K',v=>v-99)||range(100,103,'Außentemperatur','°C',v=>v-103)||range(104,107,'Druck','bar',v=>v-107);
 if(c>=32&&c<=39){const steps=['s','min','h','d'];r={name:c<36?'Einschaltdauer':'Betriebszeit',unit:steps[c&3],exp:0}}
 if(c===108)r={name:'Datum',unit:'',date:2};
 if(c===109)r={name:'Datum/Uhrzeit',unit:'',date:4};
 if(c===110)r={name:'Heizkostenverteiler',unit:'Einheiten',exp:0};
 if(c===111)r={name:'Dimensionsloser Wert',unit:'',exp:0};
 if(c>=112&&c<=115)r={name:'Mittelungsdauer',unit:['s','min','h','d'][c-112],exp:0};
 if(c>=116&&c<=119)r={name:'Aktualitätsdauer',unit:['s','min','h','d'][c-116],exp:0};
 if(c===120)r={name:'Fabrikationsnummer',unit:'',exp:0};
 if(c===121)r={name:'Identifikation',unit:'',exp:0};
 if(c===122)r={name:'Primäradresse',unit:'',exp:0};
 return r||{name:'Nicht dekodierte VIF-Kennung',unit:'VIF '+hex([vif,...vifes]),exp:0,unknown:true};
}
function decodeDate(raw){if(raw.length<2)return 'Ungültiges Datum';const day=raw[0]&31,month=raw[1]&15,year=((raw[0]>>5)&7)+((raw[1]>>4)&15)*8+2000;return `${String(day).padStart(2,'0')}.${String(month).padStart(2,'0')}.${year}`}
function decodeDateTime(raw){if(raw.length<4)return 'Ungültiger Zeitstempel';return `${decodeDate(raw.slice(2,4))} ${String(raw[1]&63).padStart(2,'0')}:${String(raw[0]&63).padStart(2,'0')}`}
function decodeRecords(data){const items=[];let i=0,warning='';
 while(i<data.length&&items.length<150){
  if(data[i]===0x2F){i++;continue}
  if(data[i]===0x0F||data[i]===0x1F){warning=data[i]===0x1F?'Weitere Telegramme vom Zähler angekündigt (DIF 1F).':'Herstellerspezifische Zusatzdaten vorhanden.';return {items,warning,more:data[i]===0x1F}}
  const start=i,dif=data[i++];const difes=[];let ext=dif;
  while(ext&128){if(i>=data.length||difes.length>=10){warning='Unvollständige DIF-Erweiterung.';return {items,warning}}ext=data[i++];difes.push(ext)}
  if(i>=data.length){warning='VIF fehlt.';break}
  let vif=data[i++],vifes=[];
  let customVif='';if((vif&127)===0x7C){if(i>=data.length){warning='Klartext-VIF ohne Längenangabe.';break}const l=data[i++];if(i+l>data.length){warning='Klartext-VIF unvollständig.';break}customVif=data.slice(i,i+l).map(b=>String.fromCharCode(b)).reverse().join('');i+=l;}
  ext=vif;while(ext&128){if(i>=data.length||vifes.length>=10){warning='Unvollständige VIF-Erweiterung.';return {items,warning}}ext=data[i++];vifes.push(ext)}
  const kind=dif&15,lengths={0:0,1:1,2:2,3:3,4:4,5:4,6:6,7:8,9:1,10:2,11:3,12:4,14:6};
  if(!(kind in lengths)&&kind!==13){warning='Sonder-DIF '+hex([dif])+' nicht unterstützt.';break}
  let n=lengths[kind]||0;let lvar=null;if(kind===13){if(i>=data.length)break;lvar=data[i++];if(lvar<0xC0)n=lvar;else if(lvar<=0xDF)n=(lvar&15);else if(lvar<=0xEF)n=(lvar&15);else {warning='Reserviertes oder unbekanntes LVAR.';break}if(n>data.length-i){warning='Variabler Datensatz unvollständig.';break}}
  if(i+n>data.length){warning='Datensatz unvollständig.';break}
  const raw=data.slice(i,i+n);i+=n;
  let numeric=null,display='—';
  if(kind>=1&&kind<=4||kind===6||kind===7){numeric=signedValue(raw)}
  else if(kind===5){numeric=new DataView(Uint8Array.from(raw).buffer).getFloat32(0,true)}
  else if((kind>=9&&kind<=12)||kind===14){display=bcd(raw);if(/^\d+$/.test(display))numeric=BigInt(display)}
  else if(kind===13){if(lvar<=0xBF)display=raw.map(b=>b>=32&&b<=126?String.fromCharCode(b):'.').reverse().join('');else if(lvar<=0xDF){display=bcd(raw);if(lvar>=0xD0)display='-'+display;if(/^-?\d+$/.test(display))numeric=BigInt(display)}else {numeric=(lvar<=0xEF)?signedValue(raw):null;display=numeric===null?'—':String(numeric)}}
  const meta=customVif?{name:customVif,unit:'',exp:0}:vifInfo(vif,vifes);
  if(meta.unknown){display=numeric!==null?String(numeric):display}if(meta.digital&&numeric!==null)display='0b'+uintValue(raw).toString(2).padStart(raw.length*8,'0')
  if(meta.date===2)display=decodeDate(raw);
  else if(meta.date===4)display=decodeDateTime(raw);
  else if(numeric!==null&&!meta.unknown&&!meta.digital)display=scaleValue(numeric,meta.exp||0);
  let storage=(dif>>6)&1,tariff=0,subunit=0;
  difes.forEach((d,j)=>{storage+=(d&15)*2**(1+4*j);tariff+=((d>>4)&3)*2**(2*j);subunit+=((d>>6)&1)*2**j});
  const modes=['Momentanwert','Maximum','Minimum','Fehlerwert'];
  items.push({index:items.length+1,name:meta.name,value:display,unit:meta.unit,details:`${modes[(dif>>4)&3]} · Speicher ${storage} · Tarif ${tariff}${subunit?' · Einheit '+subunit:''}`,raw:hex(raw),dif,vif,start,unknown:meta.unknown});
 }
 return {items,warning};
}
function info(frame){
 if(!frame||frame.kind!=='long')return null;
 const d=frame.data,ci=d[2];
 if(ci===0x72&&d.length>=15){const h=d.slice(3,15),decoded=decodeRecords(d.slice(15));return {ci,id:bcd(h.slice(0,4)),manufacturer:manufacturer(h[4],h[5]),version:h[6],medium:media[h[7]]||'Medium '+h[7],access:h[8],status:h[9],records:decoded.items,warning:decoded.warning,more:!!decoded.more}}
 if(ci===0x76)return {ci,records:[],message:'CI 76 (Big-Endian): Rohtelegramm empfangen; eine zuverlässige vollständige Interpretation ist noch nicht implementiert.'};
 if(ci===0x73||ci===0x77)return {ci,records:[],message:'Festes M-BUS-Datenformat (CI '+hex([ci])+'): Decoder folgt; Hexdaten im Monitor verfügbar.'};
 return {ci,records:[],message:'Telegramm empfangen, Datenformat CI '+hex([ci])+' wird noch nicht unterstützt.'};
}
