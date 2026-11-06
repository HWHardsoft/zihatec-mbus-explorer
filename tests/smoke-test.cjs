// Run: node tests/smoke-test.cjs
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const root=path.resolve(__dirname,'..');
const context={window:{},console,Uint8Array,DataView,BigInt,TextDecoder};vm.createContext(context);
for(const f of ['decoder.js','decoder-api.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
assert.strictEqual(context.window.MbusDecoder.metadata.libmbusIntegrated,false);
const data=[0x08,0x02,0x72, 0x11,0x22,0x33,0x44,0x2D,0x2C,0x01,0x07,0x01,0x00,0x00,0x00, 0x02,0x65,0x8C,0x07];
const frame=[0x68,data.length,data.length,0x68,...data,data.reduce((a,b)=>a+b,0)&255,0x16];
const res=context.window.MbusDecoder.decode({kind:'long',bytes:frame,data});
assert.strictEqual(res.records.length,1);assert.strictEqual(res.records[0].value,'19.32');assert.strictEqual(res.records[0].unit,'°C');
assert.strictEqual(res.id,'44332211');
console.log('PASS decoder API, synthetic frame, 19.32 °C');
