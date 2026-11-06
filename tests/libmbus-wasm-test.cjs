// Run AFTER wasm/build.sh. Tests the real compiled libmbus WebAssembly.
const assert = require('node:assert/strict');
const path = require('node:path');
const factory = require(path.resolve(__dirname, '../wasm/libmbus.js'));

// Wired M-Bus RSP_UD (CI=72):
// C=08, A=02, CI=72, ID=44332211, manufacturer=2C2D,
// version=01, medium=07, access=01, status=00, signature=0000,
// DIF=02 (16-bit int), VIF=65 (return temperature, 0.01 deg C),
// value=0x078C=1932 -> 19.32 deg C.
// Variable header after CI is exactly 12 bytes, not 13.
const payload = [
  0x08,0x02,0x72,
  0x11,0x22,0x33,0x44,
  0x2D,0x2C,
  0x01,0x07,0x01,0x00,0x00,0x00,
  0x02,0x65,0x8C,0x07
];
const checksum = payload.reduce((sum, byte) => (sum + byte) & 0xFF, 0);
const telegram = Uint8Array.from([0x68,payload.length,payload.length,0x68,...payload,checksum,0x16]);

(async () => {
  const mod = await factory();
  assert.ok(mod.HEAPU8 instanceof Uint8Array, 'HEAPU8 was not exported');
  const decode = frame => {
    const ptr = mod._malloc(frame.length);
    assert.ok(ptr, 'malloc returned null');
    try {
      mod.HEAPU8.set(frame, ptr);
      return mod.ccall('zihatec_mbus_xml', 'string', ['number','number'], [ptr,frame.length]);
    } finally { mod._free(ptr); }
  };
  const xml = decode(telegram);
  console.log('VALID TELEGRAM:', Array.from(telegram, b=>b.toString(16).padStart(2,'0')).join(' '));
  console.log('LIBMBUS RESPONSE:', xml.slice(0, 3000));
  assert.ok(!xml.startsWith('ERROR:'), `libmbus rejected test frame: ${xml}`);
  assert.match(xml, /<MBusData>/);
  assert.match(xml, /<DataRecord/);
  assert.match(xml, /<Value>\s*(?:19\.32(?:0+)?|1932)\s*<\/Value>/, `Unexpected temperature: ${xml}`);
  const corrupt=Uint8Array.from(telegram);
  corrupt[corrupt.length-2] ^= 0x01;
  assert.match(decode(corrupt), /^ERROR:/, 'Corrupt checksum must be rejected');
  assert.match(decode(Uint8Array.of(0x00)), /^ERROR:/, 'Invalid frame must be rejected');
  console.log('PASS: real libmbus WASM, measurement decoded, invalid checksums rejected');
})().catch(error=>{console.error(error);process.exitCode=1;});
