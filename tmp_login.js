const { execSync } = require('child_process');
const JSEncrypt = require('jsencrypt');

const publicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApesV0cwa8Xw8xBxU3X6mwL+G4OehdVEhA35HpLK/wsZlzLAC0h9zgFn0knbPknq25KghnjDkiAGQXXlL5cP9o0xqniOAe0GhfeoAl07WoYpUf7bB1Rz3UGn2k3e00MSQcqsIa/f3RU1px7ZR8EDcO8h9KU9JlO2Yd6Pmr9B9q0jCLaPvA1geToZ7sZInvztVxQv+IPvxeHkmArOiDrux1QknlN1S1b+DRsPcRhv73vVu8lcOp6OyGA70sITxhnFZIZH1ecp44Zy9nkTNPhQMaK++n/J050bmmQ/I4FU4yIsza4DRnQWSviXE4hVn0qb1/qaVFOUd01CM60LaFLUTwQIDAQAB';
const enc = new JSEncrypt();
enc.setPublicKey(publicKey);

const uuid = '8bac4a38-0418-4d4f-8794-f339002d104b';
const code = 'mQgC';
const username = encodeURIComponent(enc.encrypt('caoperator'));
const password = encodeURIComponent(enc.encrypt('Qwe123!!'));

const params = [
  `username=${username}`,
  `password=${password}`,
  'clientId=e5cd7e4891bf95d1d19206ce24a7b32e',
  'tenant_code=ca',
  'authorization_code=ca',
  `uuid=${uuid}`,
  `captcha=${code}`,
  'grant_type=username_password'
];

const cmd = [
  'curl -s -X POST "http://127.0.0.1/prod-api/auth/v1/oauth2/token"',
  "-H 'Authorization: Basic OTVUeFNzVFBGQTN0RjEyVEJTTW1VVkswZGE6RnBId0lmdzR3WTkyZE8='",
  "-H 'Content-Type: application/x-www-form-urlencoded;charset=UTF-8'",
  `--data-raw '${params.join('&')}'`
].join(' ');

const out = execSync(cmd, { encoding: 'utf8' });
console.log(out);
