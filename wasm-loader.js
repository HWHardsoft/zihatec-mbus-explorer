'use strict';
(async()=>{
 const report=()=>{const m=window.MbusDecoder.metadata;
  const label=document.getElementById('decoderRuntime');if(label)label.textContent=m.engine+' '+m.version;
  const d=document.getElementById('decoderVersion');if(d)d.textContent=m.engine+' '+m.version;
 };
 report();
 try{const resp=await fetch('./wasm/libmbus.js',{cache:'no-store'});if(!resp.ok)return;
  const script=document.createElement('script');script.src='./wasm/libmbus.js';
  script.onload=async()=>{if(typeof window.createLibmbusModule==='function'){let version='libmbus';try{const v=await fetch('./wasm/libmbus-commit.txt');if(v.ok)version=(await v.text()).trim().slice(0,12)}catch{}await window.MbusDecoder.loadWasm(window.createLibmbusModule,version)}report()};
  script.onerror=report;document.head.append(script);
 }catch{report()}
})();
