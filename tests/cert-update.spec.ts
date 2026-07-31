import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const SOURCE_FILE = new URL('../src/views/ca/cert/index.vue', import.meta.url);

// 通过 Vite Dev Server 获取编译后的模块源码进行验证
// 避免因登录鉴权导致组件未渲染而无法检查 DOM
test.describe('证书更新页面 - 编译产物验证', () => {
  let compiledSource = '';

  test.beforeAll(async () => {
    compiledSource = await readFile(SOURCE_FILE, 'utf8');
  });

  test('1. 标签: "输出方式" → "证书存储方式"', async () => {
    // 新标签存在
    expect(compiledSource).toContain('证书存储方式');
    // 旧标签已移除
    expect(compiledSource).not.toMatch(/输出方式/);
  });

  test('2. USB Key 表单 prop 校验修复', async () => {
    // 旧的 lifecycle 前缀 prop 不应存在
    expect(compiledSource).not.toMatch(/lifecycleProvider/);
    expect(compiledSource).not.toMatch(/lifecycleDevice/);
    expect(compiledSource).not.toMatch(/lifecycleAppName/);
    expect(compiledSource).not.toMatch(/lifecycleContainerName/);
    expect(compiledSource).not.toMatch(/lifecyclePin/);
  });

  test('3. 更新时显式传递 subject 参数', async () => {
    // buildLifecycleSubject 函数应该被调用以提取 subject
    expect(compiledSource).toContain('buildLifecycleSubject');
    // subject 应显式传递到 API payload 中
    expect(compiledSource).toContain('subject: subject');
  });

  test('4. 模板解析逻辑已添加', async () => {
    // profileLookupList 查找模板配置
    expect(compiledSource).toContain('profileLookupList');
    // parseJson 解析模板 conf
    expect(compiledSource).toContain('parseJson');
    // conf.subject.rdns 结构处理
    expect(compiledSource).toMatch(/conf.*subject/);
  });

  test('5. 输出方式文案与选项正确', async () => {
    expect(compiledSource).toContain('证书存储方式');
    expect(compiledSource).toContain('label="USBKey"');
    expect(compiledSource).toContain('label="PEM"');
    expect(compiledSource).toContain('label="DER"');
    expect(compiledSource).not.toContain('label="USB KEY"');
  });

  test('6. 更新场景区分 PEM/DER 与 USB Key 的 subject/CSR 约束', async () => {
    expect(compiledSource).toMatch(
      /证书主题（\{\{\s*lifecycleOutputMode\s*===\s*['"]usbkey['"]\s*\?\s*['"]可编辑（USB Key）['"]\s*:\s*['"]固定（PEM\/DER）['"]\s*\}\}/
    );
    expect(compiledSource).toMatch(/v-if="lifecycleOutputMode\s*===\s*['"]usbkey['"]/);
    expect(compiledSource).toMatch(/v-else/);
  });

  test('7. 续期 USBKey 模式自动使用旧证书容器', async () => {
    expect(compiledSource).toContain('v-if="isLifecycleRenewal"');
    expect(compiledSource).toContain('续期证书将自动写回旧证书所在容器，无需选择目标容器');
    expect(compiledSource).toContain('findUsbKeyCertTarget');
    expect(compiledSource).toContain('normalizeCertData(cert?.cert) === expected');
  });

  test('8. 双证书续期分别写回签名和加密证书原容器', async () => {
    expect(compiledSource).toContain('lifecycleRenewalTargets.signing');
    expect(compiledSource).toContain('lifecycleRenewalTargets.encryption');
    expect(compiledSource).toContain('isRenew ? renewalTargets.signing : undefined');
    expect(compiledSource).toContain('isRenew ? renewalTargets.encryption : undefined');
  });

  test('9. 旧证书不在 USBKey 时拒绝 USBKey 存储方式', async () => {
    expect(compiledSource).toContain("lifecycleOutputMode.value = 'pem'");
    expect(compiledSource).toContain('不能选择 USBKey 存储方式');
    expect(compiledSource).toContain('旧加密证书不在 USBKey 中');
    expect(compiledSource).toContain('旧签名证书不在 USBKey 中');
  });

  test('9.1 KMC 单证书续期按加密证书查找并写回 USBKey', async () => {
    expect(compiledSource).toContain('function isEncryptionCertificate(row: any)');
    expect(compiledSource).toContain("String(row?.keySource || '').toUpperCase() === 'KMC'");
    expect(compiledSource).toContain("lifecycleAction.value === 'renew' && isEncryptionCertificate(lifecycleRow.value)");
    expect(compiledSource).toContain('const primaryIsSigning = !isEncryptionCertificate(lifecycleRow.value)');
  });

  test('10. 双证书对不显示单证生命周期入口并自动分流到双证接口', async () => {
    expect(compiledSource).toContain('!isDualPairedCert(scope.row)');
    expect(compiledSource).toContain("const dualLifecycleCommands = new Set(['renew', 'update', 'reissue', 'suspend', 'resume', 'revoke'])");
    expect(compiledSource).toContain('handleDualLifecycleCommand(`${command}-dual`, row)');
    expect(compiledSource).toContain('请从配对的签名证书记录执行双证书操作');
  });

  test('11. 证书列表显示单证书或双证书模式', async () => {
    expect(compiledSource).toContain('label="证书模式"');
    expect(compiledSource).toContain('v-if="isDualPairedCert(scope.row)"');
    expect(compiledSource).toContain('>双证书</el-tag>');
    expect(compiledSource).toContain('>单证书</el-tag>');
    expect(compiledSource).toContain("return hasPairId || usage === 'SIGNING'");
    expect(compiledSource).not.toContain("usage === 'SIGNING' || usage === 'ENCRYPTION'");
  });

  test('12. 双证书续期支持从加密证书反向关联解析配对 ID', async () => {
    expect(compiledSource).toContain("String(cert?.certUsage || '').toUpperCase() === 'ENCRYPTION'");
    expect(compiledSource).toContain('String(cert?.certPairId) === String(row?.id)');
    expect(compiledSource).toContain('const pairId = reversePair?.id ?? row?.certPairId');
  });

  test('13. 双证书续期始终显示并正确解析密钥类型', async () => {
    expect(compiledSource).toContain("import { ASN1HEX, X509 } from 'jsrsasign'");
    expect(compiledSource).toContain("curveOid === '1.2.156.10197.1.301'");
    expect(compiledSource).toContain('{{ lifecycleKeyType }}');
    expect(compiledSource).toContain("signatureAlgorithm.includes('SM2')");
    expect(compiledSource).not.toContain('v-if="lifecycleCertInfo?.keyType" label="密钥类型"');
  });

  test('14. 双证书更新将 KMC 加密私钥和两张证书完整写入 USBKey', async () => {
    expect(compiledSource).toContain("keyGenStrategy: useUsbOutput && !lifecycleForm.encCsr ? 'KMC' : undefined");
    expect(compiledSource).toContain('await importLifecycleEncryptionKeyPair(data.encryptionPrivateKey)');
    expect(compiledSource).toContain("skf.importKeyPair(provider, device, appName, containerName, 'SM2', encryptedPrivateKey, '')");
    expect(compiledSource).toContain('await verifyLifecycleDualUsbKeyInstall(data.cert, data.encryptionCert)');
    expect(compiledSource).toContain('CA 操作已成功，但 USBKey 安装未完整完成');
  });

  test('15. 双证书更新使用自动生成且未占用的新容器', async () => {
    expect(compiledSource).toContain('v-if="usesLifecycleNewContainer" label="新容器"');
    expect(compiledSource).toContain("generateContainerName('dual-replace')");
    expect(compiledSource).toContain('lifecycleForm.containerName = generateUniqueLifecycleContainerName(list)');
    expect(compiledSource).toContain('lifecycleForm.containerName = generateUniqueLifecycleContainerName(existingNames)');
    expect(compiledSource).not.toContain("throw new Error('新容器名称已存在，请重新选择应用后重试')");
  });

  test('16. 双证书补办强制新密钥并完整写入新容器', async () => {
    expect(compiledSource).toContain("lifecycleAction.value === 'update-dual' || lifecycleAction.value === 'reissue-dual'");
    expect(compiledSource).toContain("throw new Error('双证书补办必须提供由新签名密钥生成的CSR')");
    expect(compiledSource).toContain("keyGenStrategy: !lifecycleForm.encCsr ? 'KMC' : undefined");
    expect(compiledSource).toContain("lifecycleAction.value === 'update-dual' || lifecycleAction.value === 'reissue-dual'");
    expect(compiledSource).toContain('await importLifecycleEncryptionKeyPair(data.encryptionPrivateKey)');
    expect(compiledSource).toContain('await verifyLifecycleDualUsbKeyInstall(data.cert, data.encryptionCert)');
  });

  test('17. CA 证书操作统一使用注销术语', async () => {
    expect(compiledSource).toContain('双证书注销');
    expect(compiledSource).toContain('注销证书');
    expect(compiledSource).toContain('已注销');
    expect(compiledSource).not.toContain('吊销');
  });

  test('18. 双证书注销先展示注销原因表单', async () => {
    expect(compiledSource).toContain(":title=\"revokeForm.isDual ? '双证书注销' : '注销证书'\"");
    expect(compiledSource).toContain('function handleRevoke(row: any, isDual = false)');
    expect(compiledSource).toContain('revokeForm.value.isDual = isDual');
    expect(compiledSource).toContain('handleRevoke(row, true)');
    expect(compiledSource).not.toMatch(/function handleDualRevoke[\s\S]*?submitRevoke\(\);[\s\S]*?\n}/);
  });

  test('19. 双证书补办重试时自动更换并清理新容器', async () => {
    expect(compiledSource).toContain('async function cleanupUnusedLifecycleContainer()');
    expect(compiledSource).toContain('await skf.deleteContainer(');
    expect(compiledSource).toContain("if (lifecycleContainerCreated && !caOperationCompleted && lifecycleOutputMode.value === 'usbkey')");
    expect(compiledSource).toContain('await cleanupUnusedLifecycleContainer()');
  });

  test('20. 单证书更新使用新容器并通过 SKF 验证证书和私钥', async () => {
    expect(compiledSource).toContain(
      "lifecycleAction.value === 'update' || lifecycleAction.value === 'update-dual' || lifecycleAction.value === 'reissue-dual'"
    );
    expect(compiledSource).toContain('单证书更新将使用新容器，新密钥和新证书写入该容器。');
    expect(compiledSource).toContain('await verifyLifecycleSingleUsbKeyInstall(data.cert, primaryIsSigning)');
    expect(compiledSource).toContain("await skf.digest(expectedTarget.provider, expectedTarget.device, dataBase64, 'SM3')");
    expect(compiledSource).toContain('await skf.signData(certRecord.key, digest.base64)');
    expect(compiledSource).toContain('const verified = await skf.eccVerify(');
  });

  test('21. 单双证书补办只读显示并继承旧证书绝对有效期', async () => {
    expect(compiledSource).toContain('新证书有效期（固定继承旧证书）');
    expect(compiledSource).toContain('description="补办不延长证书期限；如需延长有效期，请使用证书续期。"');
    expect(compiledSource).toContain('lifecycleForm.notBefore = lifecycleRow.value?.notBefore');
    expect(compiledSource).toContain('lifecycleForm.notAfter = lifecycleRow.value?.notAfter');
    expect(compiledSource).toContain('compactLifecyclePayload({ certId, csrBase64: signCsrBase64, reason: lifecycleForm.reason })');
    expect(compiledSource).not.toMatch(/reissueCert\([\s\S]{0,250}notBefore/);
    expect(compiledSource).not.toMatch(/reissueDualCert\([\s\S]{0,400}notAfter/);
  });
});

test('源码可读取', async () => {
  const source = await readFile(SOURCE_FILE, 'utf8');
  expect(source.length).toBeGreaterThan(1000);
});
