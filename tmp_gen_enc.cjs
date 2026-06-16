const JSEncrypt = require('jsencrypt');
const [pub, username, password] = process.argv.slice(2);
const enc = new JSEncrypt();
enc.setPublicKey(pub);
console.log(encodeURIComponent(enc.encrypt(username)));
console.log(encodeURIComponent(enc.encrypt(password)));
