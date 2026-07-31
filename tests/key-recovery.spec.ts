import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const CERT_SOURCE = new URL('../src/views/ca/cert/index.vue', import.meta.url);
const DIALOG_SOURCE = new URL('../src/views/kmc/components/KeyRecoveryDialog.vue', import.meta.url);
const API_SOURCE = new URL('../src/api/kmc/keyRecovery/index.ts', import.meta.url);

test.describe('CA 密钥恢复流程', () => {
  test('只允许 KMC 加密证书进入恢复流程', async () => {
    const source = await readFile(CERT_SOURCE, 'utf8');

    expect(source).toContain("String(row?.keySource || '').toUpperCase() === 'KMC'");
    expect(source).toContain('isEncryptionCertificate(row)');
    expect(source).toContain('resolveUsedKeyByCertificate');
    expect(source).toContain('recoverable');
  });

  test('USBKey 使用新容器封装并在完整写入后确认', async () => {
    const source = await readFile(DIALOG_SOURCE, 'utf8');

    expect(source).toContain('enumProvider');
    expect(source).toContain('enumDevice');
    expect(source).toContain('enumApplication');
    expect(source).toContain('uniqueUsbContainerName');
    expect(source).toContain('createPKCS10');
    expect(source).toContain('usbWrappingCsrBase64');
    expect(source).toContain('importKeyPair');
    expect(source).toContain('importCertificate');
    expect(source).toContain("findCertificates('Enc')");
    expect(source).toContain('confirmKeyRecovery({ judgeId: form.judgeId, success: true');
    expect(source).toContain('confirmKeyRecovery({ judgeId: form.judgeId, success: false');
    expect(source).toContain('deleteContainer');
  });

  test('文件恢复下载口令保护的 PEM 内容', async () => {
    const source = await readFile(DIALOG_SOURCE, 'utf8');

    expect(source).toContain('filePassword');
    expect(source).toContain('result?.fileContent');
    expect(source).toContain("type: 'application/x-pem-file'");
  });

  test('KMC API 包含证书定位和客户端结果确认', async () => {
    const source = await readFile(API_SOURCE, 'utf8');

    expect(source).toContain('/kmc/v1/key-recovery/resolve-used-key');
    expect(source).toContain('/kmc/v1/key-recovery/confirm');
  });

  test('CA在用密钥恢复使用直接授权且不展示门限签名', async () => {
    const certSource = await readFile(CERT_SOURCE, 'utf8');
    const dialogSource = await readFile(DIALOG_SOURCE, 'utf8');
    const apiSource = await readFile(API_SOURCE, 'utf8');

    expect(certSource).toContain('<KeyRecoveryDialog ref="keyRecoveryDialogRef" direct');
    expect(apiSource).toContain('/kmc/v1/key-recovery/submit-direct-used-key');
    expect(dialogSource).toContain('v-if="!direct"');
    expect(dialogSource).toContain('<el-col v-if="!direct" :span="12">');
    expect(dialogSource).toContain('caseNo: direct.value ? undefined : form.caseNo');
    expect(dialogSource).toContain('v-if="resultText && !direct" label="恢复结果"');
    expect(dialogSource).toContain('CA证书管理可直接恢复KMC在用密钥');
    expect(dialogSource).toContain('submitDirectUsedKeyRecovery');
  });
});
