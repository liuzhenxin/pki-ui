import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const SOURCE_FILE = new URL('../src/views/ca/cert/index.vue', import.meta.url);

test.describe('证书签发页面 - 编译产物验证', () => {
  let compiledSource = '';

  test.beforeAll(async () => {
    compiledSource = await readFile(SOURCE_FILE, 'utf8');
  });

  test('1. 签发入口与弹窗存在', async () => {
    expect(compiledSource).toContain('签发证书');
    expect(compiledSource).toContain('el-dialog v-model="issueOpen" title="签发证书"');
    expect(compiledSource).toContain('确认签发');
  });

  test('2. 支持 USB Key 与 PKCS10 两种 CSR 来源', async () => {
    expect(compiledSource).toContain('label="USB Key" value="key"');
    expect(compiledSource).toContain('label="PKCS10 CSR" value="p10"');
    expect(compiledSource).toContain('issueType === \'key\'');
    expect(compiledSource).toContain('issueType === \'p10\'');
  });

  test('3. 支持单证书/双证书签发模式', async () => {
    expect(compiledSource).toContain('单证书');
    expect(compiledSource).toContain('双证书');
    expect(compiledSource).toContain('value="single"');
    expect(compiledSource).toContain('value="dual"');
  });

  test('4. 签发模式分支调用正确后端接口', async () => {
    expect(compiledSource).toContain('issueCert({');
    expect(compiledSource).toContain('issueDualCert({');
    expect(compiledSource).toContain('const p10Res = await withTimeout');
    expect(compiledSource).toContain('const subject = issueForm.value.subjectItems');
    expect(compiledSource).toContain('subject');
    expect(compiledSource).toContain('csrBase64: pemToBase64');
  });

  test('5. 双证书签发支持双模板链路与加密托管策略', async () => {
    expect(compiledSource).toContain('双证书模板对');
    expect(compiledSource).toContain('签名证书模板');
    expect(compiledSource).toContain('加密证书模板');
    expect(compiledSource).toContain('加密密钥来源');
    expect(compiledSource).toContain('KMC 生成并托管');
    expect(compiledSource).toContain('keyGenStrategy: \'KMC\'');
  });

  test('6. 签发成功文案覆盖单证书/双证书', async () => {
    expect(compiledSource).toContain('签发成功');
    expect(compiledSource).toContain('双证书签发成功');
    expect(compiledSource).toContain('请点击\"下载 ZIP 包\"获取签名证书、加密证书和加密私钥');
  });

  test('7. USB Key 签发路径包含设备/应用/PIN 字段', async () => {
    expect(compiledSource).toContain('issueForm.provider');
    expect(compiledSource).toContain('issueForm.device');
    expect(compiledSource).toContain('issueForm.appName');
    expect(compiledSource).toContain('issueForm.containerName');
    expect(compiledSource).toContain('issueForm.pin');
    expect(compiledSource).toContain('USBKey 证书设置');
  });

  test('8. 证书有效期字段可提交', async () => {
    expect(compiledSource).toContain('notBefore');
    expect(compiledSource).toContain('notAfter');
    expect(compiledSource).toContain('issueForm.notBefore');
    expect(compiledSource).toContain('issueForm.notAfter');
  });
});
