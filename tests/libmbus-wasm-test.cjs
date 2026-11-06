// Run AFTER wasm/build.sh. Tests the actual compiled libmbus WebAssembly.
const assert=require('node:assert/strict');
const path=require('node:path');
const factory=require(path.resolve(__dirname,'../wasm/libmbus.js'));
const bytes=[0x08,0x02,0x72,0x11,0x22,0x33,0x44,0x2D,0x2C,0x01,0x07,0x01,0,0,0,0,0x02,0x65,0x8C,0x07];
const telegram=Uint8Array.from([0x68,bytes.length,bytes.length,0x68,...bytes,bytes.reduce((a,b)=>a+b,0)&255,0x16]);
(async()=>{
 const mod=await factory();
 assert.ok(mod.HEAPU8 instanceof Uint8Array, 'HEAPU8 was not exported by Emscripten');
 const decode=frame=>{
   const ptr=mod._malloc(frame.length);
   assert.ok(ptr,'malloc returned null');
   try{
     mod.HEAPU8.set(frame,ptr);
     return mod.ccall('zihatec_mbus_xml','string',['number','number'],[ptr,frame.length]);
   }finally{mod._free(ptr)}
 };
 const xml=decode(telegram);
 assert.ok(xml.startsWith('<?xml')||xml.includes('<MBusData>'),xml);
 assert.match(xml,/<MBusData>/);
 assert.match(xml,/<DataRecord/);
 assert.match(xml,/<Value>\s*(?:19\.32(?:0+)?|1932)\s*<\/Value>/,`Unexpected 19.32 °C decoding: ${xml}`);
 const corrupt=Uint8Array.from(telegram);
 corrupt[corrupt.length-2]^=0x01;
 assert.match(decode(corrupt),/^ERROR:/);
 assert.match(decode(Uint8Array.of(0x00)),/^ERROR:/);
 console.log('PASS: REAL libmbus WASM decoder, data record, checksum rejection');
 console.log('Decoder XML sample:\n'+xml.slice(0,1500));
})().catch(e=>{console.error(e);process.exitCode=1});
