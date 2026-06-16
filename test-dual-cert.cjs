// CA Dual Certificate Test Script
// Usage: node test-dual-cert.js
const http = require('http');

const BASE = 'http://127.0.0.1:5555/api-gateway';
const CLIENT_ID = 'e5cd7e4891bf95d1d19206ce24a7b32e';
const BASIC_AUTH = 'Basic OTVUeFNzVFBGQTN0RjEyVEJTTW1VVkswZGE6RnBId0lmdzR3WTkyZE8=';

function post(path, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const options = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    };
    const req = http.request(options, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch(e) { resolve(Buffer.concat(chunks).toString()); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function postForm(path, headers, formData) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const body = new URLSearchParams(formData).toString();
    const options = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), ...headers }
    };
    const req = http.request(options, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch(e) { resolve(Buffer.concat(chunks).toString()); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function get(path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : { 'isToken': 'false' }
    };
    const req = http.request(options, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch(e) { resolve(Buffer.concat(chunks).toString()); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== CA Dual Certificate Test ===\n');

  // Step 1: Get public key
  console.log('1. Getting encryption secrets...');
  const secrets = await get('/auth/v1/secrets');
  if (!secrets.data || !secrets.data.publicKey) {
    console.log('ERROR: Failed to get public key');
    return;
  }
  console.log('   Public key obtained');

  // Step 2: Encrypt credentials using JSEncrypt
  const JSEncrypt = require('./node_modules/jsencrypt/bin/jsencrypt.min.js');
  const j = new JSEncrypt.JSEncrypt();
  j.setPublicKey(secrets.data.publicKey);
  const username = encodeURIComponent(j.encrypt('caoperator'));
  const password = encodeURIComponent(j.encrypt('Qwe123!!'));
  console.log('   Credentials encrypted');

  // Step 3: Get captcha UUID
  const uuid = 'test-' + Date.now();
  console.log('   UUID:', uuid);

  // Step 4: Try login
  console.log('\n2. Logging in...');
  const captchaCodes = ['1234', '0000', '1111', 'abcd', 'qwer', 'test', ''];
  let token = null;

  for (const code of captchaCodes) {
    const result = await postForm('/auth/v1/oauth2/token',
      { 'Authorization': BASIC_AUTH },
      {
        username, password,
        clientId: CLIENT_ID,
        grant_type: 'username_password',
        uuid,
        code,
        tenant_code: ''
      }
    );
    if (result.access_token) {
      token = result.access_token;
      console.log('   Login SUCCESS with code:', code || '(empty)');
      break;
    }
  }

  if (!token) {
    console.log('   Login FAILED - captcha required. Please enter captcha code:');
    // For manual mode: prompt user to enter captcha
    const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    const code = await new Promise(resolve => readline.question('Captcha code: ', resolve));
    readline.close();
    const result = await postForm('/auth/v1/oauth2/token',
      { 'Authorization': BASIC_AUTH },
      { username, password, clientId: CLIENT_ID, grant_type: 'username_password', uuid, code, tenant_code: '' }
    );
    if (result.access_token) {
      token = result.access_token;
      console.log('   Login SUCCESS');
    } else {
      console.log('   Login FAILED:', JSON.stringify(result));
      return;
    }
  }

  // Step 5: Test Certificate APIs
  const authHeader = { 'Authorization': `Bearer ${token}` };
  console.log('\n=== Running Dual Certificate Tests ===\n');

  // Test 1: List certs (check for certUsage column data)
  console.log('3. Testing certificate list API...');
  const certs = await post('/ca/v1/certs/page', authHeader, { pageNum: 1, pageSize: 5 });
  if (certs.data && certs.data.records) {
    const records = certs.data.records;
    console.log(`   Found ${certs.data.total || records.length} certificates`);
    for (const c of records.slice(0, 3)) {
      console.log(`   - ID=${c.id} SN=${c.serialNumber} Status=${c.certStatus} Usage=${c.certUsage || 'N/A'} PairId=${c.certPairId || 'N/A'}`);
      if (c.certUsage === 'SIGNING') {
        console.log('     -> This is a signing cert (dual cert pair detected!)');
      }
      if (c.certUsage === 'ENCRYPTION') {
        console.log('     -> This is an encryption cert (dual cert pair detected!)');
      }
    }
  } else {
    console.log('   ERROR:', JSON.stringify(certs));
  }

  // Test 2: List dual cert profiles
  console.log('\n4. Testing dual cert profile pairs API...');
  const dualProfiles = await post('/ca/v1/profiles/dual-pairs', authHeader, {});
  if (dualProfiles.data && dualProfiles.data.length > 0) {
    console.log(`   Found ${dualProfiles.data.length} dual cert profile pairs:`);
    for (const p of dualProfiles.data) {
      console.log(`   - ${p.pairDisplayName || p.pairName}: sign=${p.signProfile?.name} enc=${p.encProfile?.name}`);
    }
  } else {
    console.log('   No dual cert profile pairs found (may need to run profile init first)');
  }

  // Test 3: List profiles with dual cert metadata
  console.log('\n5. Testing profile list with dual cert categories...');
  const profiles = await post('/ca/v1/profiles/list', authHeader, {});
  if (profiles.data) {
    const dualProfiles = profiles.data.filter(p => p.profileCategory === 'DUAL_SIGN' || p.profileCategory === 'DUAL_ENC');
    console.log(`   Total profiles: ${profiles.data.length}, Dual-cert profiles: ${dualProfiles.length}`);
    for (const p of dualProfiles.slice(0, 4)) {
      console.log(`   - ID=${p.id} Name=${p.name} Category=${p.profileCategory} PairedId=${p.pairedProfileId}`);
    }
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
