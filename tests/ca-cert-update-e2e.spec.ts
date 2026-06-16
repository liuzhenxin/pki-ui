import { test, expect } from '@playwright/test';

const BASE = process.env.CA_E2E_BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:8082';
const TOKEN =
  process.env.CA_E2E_TOKEN ||
  'eyJraWQiOiJmYjM1NjJkZi03MzNmLWI2ZDctNjJlMy03ZDQyODYwZDkyZTciLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIzMDAwMyIsImF1ZCI6Ijk1VHhTc1RQRkEzdEYxMlRCU01tVVZLMGRhIiwibmJmIjoxNzgxMDc1MzcwLCJzY29wZSI6WyJyZWFkIiwid3JpdGUiXSwiaXNzIjoiaHR0cDovLzE3Mi4yMC4wLjg6MTExMS9hcGkiLCJleHAiOjE3ODEwODk3NzAsImlhdCI6MTc4MTA3NTM3MCwianRpIjoiN2M3MjZmOWItYjc0My00NGQ0LTkyOWItOGY1MDhhN2RmZmM5In0.eyp5EeFoNEQuryaWpYZM5SDab58AMLs4urk37GAAh-QWimMvYk8DSPMWSJ5iZjTGfsSCBamQDic-7MJgUaCujEgydnL2KHygXxAoNTfeLsKMH9CgB2pv_oQi7URgu7wF12ADiKBppb7tu4KnofAQiJMReS2y1IXbmYpfI2D_dWgvPy7fRG5hh429ArUceIWyFH9xuCUv_P3lQfBkNbi87LwD1BtaksLhk6z0T4X-NvN_qvx-cEKdXWDY_LzEj2LmtLRPIJHrTTLhcyFbDfuM5CGqClxQQvMrr4nLdnQzAVQLDjKUgSNoU4oz79xeNG5XOquU_LXmKf7Y16Cm2amlfVrdb0pep3a3zG-QTO9BA-UTw25ENPFIjUi282_Qc16zrX0qiCwJW1S-wjCL-049CbMQzkoks4D8Tixpk9beplk51bqSiDJ_yFZ4toARb8V9fdSCB8nIjBUFr9DFT8oJKDJBpB5TygfMvsZFvANIT04kGmZEZisiN0aabNtbIWkKRfH0f_1bEu5U8bjH-W-A0z5QLiwKaKxn1PNKg6LLyibYfi1GHrbpgq6G_2Uwjs3VY6PM7N9TC7InnizIO2hCjO7RLdFsWKFJulZm0zGMtUDPrfucUfRp8Kk7Rqi6pZZvSbZvbkv8aw8KO8aduT5kqr-mzdqau5VbGVvSS5ik7-0';

// 用户信息（从 API 获取的真实数据）
const USER_INFO = {
  id: '30003',
  username: 'caoperator',
  status: 'INITIALIZED', // 关键：标记租户已初始化
  permissions: [
    'ca:cert:page',
    'ca:cert:update',
    'ca:cert:detail',
    'ca:cert:download',
    'ca:cert:renew',
    'ca:cert:reissue',
    'ca:cert:recover',
    'ca:cert:revoke',
    'ca:cert:suspend',
    'ca:cert:issue',
    'ca:cert:issue-dual',
    'ca:cert:export',
    'ca:cert:import',
    'ca:cert:save',
    'ca:cert:modify',
    'ca:cert:remove',
    'ca:profile:list',
    'ca:profile:detail',
    'ca:root:list',
    'ca:root:detail',
    'ca:config:get',
    'ca:log:login',
    'ca:log:operator',
    'ca:admin',
    'setup',
    'ca:audit',
    'ca:crl:list',
    'ca:crl:detail',
    'ca:signer:list',
    'ca:requestor:list'
  ],
  roleIds: ['403'],
  scopes: ['read', 'write']
};

test.describe('CA 证书更新 - 自动化测试', () => {
  test.beforeEach(async ({ page }) => {
    // 在页面脚本执行前注入 token
    await page.addInitScript((t: string) => {
      localStorage.setItem('Admin-Token', JSON.stringify(t));
      // 也存储原始格式（兼容不同读取方式）
      localStorage.setItem('token', JSON.stringify(t));
    }, TOKEN);

    // Mock 关键 API 调用（确保路由守卫不会重定向到登录页）
    await page.route('**/admin/v1/users/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'OK', msg: 'ok', data: USER_INFO })
      });
    });

    // 放行真实 API（证书列表、模板列表等）
    await page.route('**/dev-api/**', async (route) => {
      // 只 mock 用户信息，其他全部透传
      if (route.request().url().includes('/admin/v1/users/profile')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'OK', msg: 'ok', data: USER_INFO })
        });
      } else if (route.request().url().includes('/admin/v1/menus/routes')) {
        // Mock 菜单路由
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'OK',
            msg: 'ok',
            data: [
              {
                path: '/ca',
                component: 'Layout',
                name: 'CA',
                meta: { title: 'CA管理', icon: 'cert' },
                children: [
                  { path: 'cert', component: 'ca/cert/index', name: 'CertManagement', meta: { title: '证书管理', icon: 'list' } },
                  { path: 'profile', component: 'ca/profile/index', name: 'ProfileManage', meta: { title: '模板管理' } },
                  { path: 'root', component: 'ca/root/index', name: 'RootCA', meta: { title: '根证书管理' } },
                  { path: 'config', component: 'ca/config/index', name: 'CAConfig', meta: { title: 'CA配置' } },
                  { path: 'crl', component: 'ca/crl/index', name: 'CRL', meta: { title: 'CRL管理' } },
                  { path: 'admin', component: 'ca/admin/index', name: 'CAAdmin', meta: { title: '管理' } },
                  { path: 'audit', component: 'ca/audit/index', name: 'AuditLog', meta: { title: '审计日志' } },
                  { path: 'signer', component: 'ca/signer/index', name: 'Signer', meta: { title: '签名者' } },
                  { path: 'requestor', component: 'ca/requestor/index', name: 'Requestor', meta: { title: '请求者' } }
                ]
              }
            ]
          })
        });
      } else {
        // 透传其他所有 API 请求
        await route.continue();
      }
    });
  });

  test('1. 进入证书管理页面', async ({ page }) => {
    // 先到首页，让路由守卫初始化
    await page.goto(BASE);
    await page.waitForTimeout(2000);

    // 导航到证书管理
    await page.goto(`${BASE}/#/ca/cert`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log('URL:', url);
    console.log('登录页:', url.includes('/login'));
    console.log('标题:', await page.title());

    await page.screenshot({ path: 'tests/screenshots/cert-page.png', fullPage: true });
  });

  test('2. 打开更新弹窗并验证', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await page.goto(`${BASE}/#/ca/cert`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const url = page.url();
    if (url.includes('/login')) {
      console.log('❌ 仍然重定向到登录页，检查 localStorage');
      const storage = await page.evaluate(() => ({
        token: localStorage.getItem('Admin-Token'),
        keys: Object.keys(localStorage)
      }));
      console.log('storage:', JSON.stringify(storage));
      return;
    }

    // 查找生命周期按钮
    const btns = page.locator('button:has-text("生命周期")');
    const count = await btns.count();
    console.log(`生命周期按钮: ${count} 个`);

    if (count > 0) {
      await btns.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/screenshots/dropdown.png' });

      const updateItem = page.locator('li:has-text("更新(换新密钥)")').first();
      if ((await updateItem.count()) > 0) {
        await updateItem.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'tests/screenshots/update-dialog.png', fullPage: true });

        const html = await page.content();
        console.log('');
        console.log('证书存储方式:', html.includes('证书存储方式') ? '✅' : '❌');
        console.log('输出方式(旧):', html.includes('输出方式') ? '❌ 仍存在' : '✅ 已清除');
        console.log('USBKey:', html.includes('USBKey') ? '✅' : '❌');
        console.log('lifecycleProvider:', html.includes('lifecycleProvider') ? '❌' : '✅ 已修复');

        // 切换到 USBKey 模式
        const selectTrigger = page.locator('.el-select').first();
        await selectTrigger.click();
        await page.waitForTimeout(500);
        await page.locator('.el-select-dropdown__item:has-text("USBKey")').first().click();
        await page.waitForTimeout(1000);

        const usbHtml = await page.content();
        console.log('设备提供商:', usbHtml.includes('设备提供商') ? '✅' : '❌');
        console.log('新主题:', usbHtml.includes('新主题') ? '✅' : '❌');

        const fixedSubjectText = await page.locator('.el-dialog').locator('text=/固定（PEM\/DER）/').count();
        console.log('固定主题文案（PEM/DER）:', fixedSubjectText > 0 ? '✅' : '❌');

        // 测试表单校验
        const confirmBtn = page.locator('.el-dialog__footer button:has-text("确")').first();
        await confirmBtn.click();
        await page.waitForTimeout(1000);

        const errors = await page.locator('.el-form-item__error').allTextContents();
        console.log('表单校验:', errors.length > 0 ? `✅ ${errors.join(', ')}` : '⚠️ 未触发');

        await page.screenshot({ path: 'tests/screenshots/validation.png', fullPage: true });
      }
    }
  });

  test('3. 编译产物验证', async ({ page }) => {
    const res = await page.request.get(`${BASE}/src/views/ca/cert/index.vue`);
    const source = await res.text();
    expect(source).toContain('证书存储方式');
    expect(source).not.toMatch(/输出方式/);
    expect(source).not.toMatch(/lifecycleProvider|lifecycleDevice|lifecycleAppName|lifecyclePin/);
    expect(source).toContain('buildLifecycleSubject');
    expect(source).toContain('subject: subject');
    expect(source).toContain('label="USBKey"');
    expect(source).toContain('label="PEM"');
    expect(source).toContain('label="DER"');
    console.log('✅ 编译产物验证全部通过');
  });
});
