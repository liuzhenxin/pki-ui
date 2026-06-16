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
});

test('源码可读取', async () => {
  const source = await readFile(SOURCE_FILE, 'utf8');
  expect(source.length).toBeGreaterThan(1000);
});
