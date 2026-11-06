'use strict';
// Browser adapter for libmbus XML-based WASM ABI. JS fallback remains available.
(function(global){
 const state={engine:'Zihatec JavaScript',version:'0.6',status:'fallback',reason:'libmbus WASM not installed'};
 let native=null;
 const element=(node,name)=>node?.getElementsByTagName(name)[0]?.textContent?.trim()||'';
 // libmbus XML stores engineering-unit scaling in <Unit>, not in <Value>.
 // For example: <Unit>External temperature (1e-2  deg C)</Unit>, <Value>1932</Value>.
 function interpretRecord(unitText,rawValue){
  let name=unitText||'Unbekannt',unit='',value=rawValue;
  const match=/^(.*?)\s*\(([^()]*)\)\s*$/.exec(unitText);
  if(match){
   name=match[1].trim()||unitText;
   const spec=match[2].trim();
   // A scale in libmbus XML is typically 1e-2, 1e-3, 10, 100, etc.
   const scaled=/^(1e[+-]?\d+|10(?:\^\d+)?|100|1000|0\.\d+)\s+(.+)$/i.exec(spec);
   if(scaled){
    const factor=scaled[1].includes('^')?Math.pow(10,Number(scaled[1].split('^')[1])):Number(scaled[1]);
    if(Number.isFinite(factor)&&factor>0&&/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(rawValue)){
     const numeric=Number(rawValue)*factor;
     if(Number.isFinite(numeric)){
      // Avoid 19.319999999999997 when rendering decimal factors.
      const exp=/^1e-(\d+)$/i.exec(scaled[1]);
      value=exp?numeric.toFixed(Math.min(12,Number(exp[1]))).replace(/\.?0+$/,''):String(Number(numeric.toPrecision(12)));
     }
    }
    unit=scaled[2].trim();
   }else unit=spec;
  }
  unit=unit.replace(/deg\s*C/gi,'°C').replace(/deg\s*F/gi,'°F').replace(/m\^3/g,'m³');
  return {name,value,unit};
 }
 function fromXml(xml,base){
  if(typeof DOMParser==='undefined')throw new Error('XML parser unavailable');
  xml=xml.replace(/^\s*<\?xml[^>]*\?>/i,'');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('libmbus XML parse error');
  const root=doc.documentElement;
  if(root.nodeName!=='MBusData')throw new Error('Unexpected libmbus root');
  const error=element(root,'Error');if(error)throw new Error(error);
  const h=root.getElementsByTagName('SlaveInformation')[0];
  const records=[...root.getElementsByTagName('DataRecord')].map((r,i)=>{
   const unitText=element(r,'Unit'),fn=element(r,'Function'),rawValue=element(r,'Value');
   const storage=element(r,'StorageNumber'),tariff=element(r,'Tariff'),dev=element(r,'Device');
   const details=[fn,storage!==''?'Speicher '+storage:'',tariff!==''?'Tarif '+tariff:'',dev!==''?'Einheit '+dev:''].filter(Boolean).join(' · ');
   const interpreted=interpretRecord(unitText,rawValue);
   return {index:i+1,...interpreted,details,raw:rawValue,unknown:!unitText};
  });
  const statusText=element(h,'Status');
  return {...base,id:element(h,'Id')||base.id,manufacturer:element(h,'Manufacturer')||base.manufacturer,
    medium:element(h,'Medium')||base.medium,version:element(h,'Version')||base.version,
    access:element(h,'AccessNumber')||base.access,status:statusText?parseInt(statusText,16):base.status,
    records,warning:base.warning||'',more:base.more};
 }

 const api={apiVersion:1,
  get metadata(){return Object.freeze({engine:state.engine,version:state.version,libmbusIntegrated:!!native})},
  get status(){return Object.freeze({...state})},
  decode(frame){const base=info(frame);if(!native||frame?.kind!=='long')return base;
   try{return fromXml(native.decode(frame.bytes),base)}catch(e){return {...base,warning:[base.warning,'libmbus: '+String(e.message||e)+' — JavaScript fallback'].filter(Boolean).join(' | ')}}
  },
  async loadWasm(factory,version='unverified'){
   try{
    const mod=await factory({locateFile:p=>'./wasm/'+p});
    if(!mod?._malloc||!mod?._free||!mod?.ccall||!mod?.HEAPU8)throw Error('libmbus ABI unavailable');
    const decoder={decode(bytes){const b=Uint8Array.from(bytes);const ptr=mod._malloc(b.length);
     if(!ptr)throw Error('malloc failed');
     try{mod.HEAPU8.set(b,ptr);const result=mod.ccall('zihatec_mbus_xml','string',['number','number'],[ptr,b.length]);
      if(!result||result.startsWith('ERROR:'))throw Error(result||'libmbus rejected telegram');return result;
     }finally{mod._free(ptr)}
    }};
    // An invalid frame must be rejected by the native parser.
    let rejected=false;try{decoder.decode([0])}catch{rejected=true}
    if(!rejected)throw Error('Native self-test failed');
    native=decoder;state.engine='libmbus WebAssembly';state.version=version;state.status='wasm';state.reason='';return true;
   }catch(e){native=null;state.status='fallback';state.reason=String(e.message||e);return false}
  }
 };
 global.MbusDecoder=Object.freeze(api);
})(window);
