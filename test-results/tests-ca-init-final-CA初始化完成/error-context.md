# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/ca-init-final.spec.ts >> CA初始化完成
- Location: tests/ca-init-final.spec.ts:14:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('.el-checkbox').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - link "CA 证书认证系统" [ref=e6] [cursor=pointer]:
        - /url: /
        - generic [ref=e7]: CA
        - heading "证书认证系统" [level=1] [ref=e8]
      - menubar [ref=e12]:
        - link "首页" [ref=e14] [cursor=pointer]:
          - /url: /index
          - menuitem "首页" [ref=e15]:
            - img [ref=e16]
            - generic [ref=e18]: 首页
        - menuitem "安全管理" [ref=e20]:
          - generic [ref=e21] [cursor=pointer]:
            - img [ref=e22]
            - generic [ref=e24]: 安全管理
            - img [ref=e26]
        - menuitem "管理员管理" [ref=e29]:
          - generic [ref=e30] [cursor=pointer]:
            - img [ref=e31]
            - generic [ref=e33]: 管理员管理
            - img [ref=e35]
    - generic [ref=e37]:
      - generic [ref=e38]:
        - generic [ref=e39]:
          - img [ref=e41] [cursor=pointer]
          - navigation "面包屑" [ref=e43]:
            - link "首页" [ref=e45]
          - generic [ref=e46]:
            - img [ref=e48] [cursor=pointer]
            - button [ref=e52] [cursor=pointer]:
              - img [ref=e53]
            - button [ref=e57] [cursor=pointer]:
              - img [ref=e58]
              - img [ref=e60]
        - link "首页" [ref=e66] [cursor=pointer]:
          - /url: /index
      - generic [ref=e68]:
        - generic [ref=e71]:
          - img [ref=e74]
          - generic [ref=e76]:
            - heading "证书认证系统" [level=2] [ref=e77]
            - paragraph [ref=e78]: 提供数字证书的全生命周期管理服务，包括证书申请、签发、查询、吊销、更新等，构建可信的网络安全基础环境。
        - generic [ref=e80]:
          - generic [ref=e81]:
            - generic [ref=e84]:
              - generic [ref=e85]:
                - img [ref=e88]
                - generic [ref=e90]:
                  - generic [ref=e91]: 总签发证书
                  - generic [ref=e92]: "0"
              - generic [ref=e94]: 累计签发总量
            - generic [ref=e97]:
              - generic [ref=e98]:
                - img [ref=e101]
                - generic [ref=e104]:
                  - generic [ref=e105]: 有效证书
                  - generic [ref=e106]: "0"
              - generic [ref=e107]:
                - progressbar [ref=e108]:
                  - img [ref=e113]
                - generic [ref=e116]: 占比 0%
            - generic [ref=e119]:
              - generic [ref=e120]:
                - img [ref=e123]
                - generic [ref=e126]:
                  - generic [ref=e127]: 已吊销证书
                  - generic [ref=e128]: "0"
              - generic [ref=e130]: 包含手动吊销及异常证书
            - generic [ref=e133]:
              - generic [ref=e134]:
                - img [ref=e137]
                - generic [ref=e139]:
                  - generic [ref=e140]: 即将过期
                  - generic [ref=e141]: "0"
              - generic [ref=e143]: 未来30天内到期
          - generic [ref=e144]:
            - generic [ref=e148]:
              - generic [ref=e149]: 证书签发趋势
              - radiogroup "radio-group" [ref=e150]:
                - generic [ref=e151]:
                  - radio "近一周" [checked] [ref=e152]
                  - generic [ref=e153] [cursor=pointer]: 近一周
                - generic [ref=e154]:
                  - radio "近一月" [ref=e155]
                  - generic [ref=e156] [cursor=pointer]: 近一月
            - generic [ref=e165]: 算法分布
  - alert [ref=e170]:
    - img [ref=e172]
    - generic [ref=e174]:
      - heading [level=2] [ref=e175]
      - img [ref=e177] [cursor=pointer]
```

# Test source

```ts
  1  | import { test } from '@playwright/test';
  2  | import { execSync } from 'child_process';
  3  | 
  4  | function getCaptchaCode(uuid: string): string {
  5  |   try {
  6  |     const result = execSync(
  7  |       `docker exec liuzx-redis redis-cli -a 'Qwe123!!' GET "auth:username-password:captcha:${uuid}" 2>/dev/null`,
  8  |       { encoding: 'utf8', timeout: 5000 }
  9  |     ).trim().replace(/"/g, '');
  10 |     return result;
  11 |   } catch { return ''; }
  12 | }
  13 | 
  14 | test('CA初始化完成', async ({ page }) => {
  15 |   let captchaUuid = '';
  16 |   page.on('response', async resp => {
  17 |     const url = resp.url();
  18 |     if (url.includes('captchas/') && !url.includes('init') && resp.status() === 200) {
  19 |       const match = url.match(/captchas\/([a-f0-9-]+)/);
  20 |       if (match) captchaUuid = match[1];
  21 |     }
  22 |   });
  23 |   
  24 |   // 登录
  25 |   await page.goto('http://127.0.0.1:8088/');
  26 |   await page.waitForLoadState('networkidle');
  27 |   await page.waitForTimeout(2000);
  28 |   await page.locator('.el-select').first().click();
  29 |   await page.waitForTimeout(500);
  30 |   await page.locator('.el-select-dropdown__item:has-text("证书认证系统")').first().click();
  31 |   await page.waitForTimeout(800);
  32 |   await page.locator('input[placeholder="用户名"]').fill('admin');
  33 |   await page.locator('input[placeholder="密码"]').fill('Qwe123!!');
  34 |   const code = getCaptchaCode(captchaUuid);
  35 |   await page.locator('input[placeholder="验证码"]').fill(code || 'test');
  36 |   await page.locator('button:has-text("登 录")').first().click();
  37 |   await page.waitForTimeout(4000);
  38 |   console.log('✅ 登录');
  39 |   
  40 |   if (!page.url().includes('ca/init')) {
  41 |     await page.goto('http://127.0.0.1:8088/ca/init');
  42 |     await page.waitForLoadState('networkidle');
  43 |     await page.waitForTimeout(3000);
  44 |   }
  45 |   
  46 |   // 步骤1: 协议
> 47 |   await page.locator('.el-checkbox').first().click();
     |                                              ^ Error: locator.click: Test timeout of 60000ms exceeded.
  48 |   await page.waitForTimeout(500);
  49 |   await page.locator('button:has-text("下一步"):not(.is-disabled)').first().click();
  50 |   await page.waitForTimeout(3000);
  51 |   console.log('✅ 步骤1: 协议 -> 步骤2');
  52 |   
  53 |   // 步骤2: 全选模板
  54 |   await page.locator('.el-table__header-wrapper .el-checkbox').first().click();
  55 |   await page.waitForTimeout(500);
  56 |   await page.locator('button:has-text("下一步"):not(.is-disabled)').first().click();
  57 |   await page.waitForTimeout(5000);
  58 |   
  59 |   // 检查当前步骤
  60 |   const steps = await page.locator('.el-step__title.is-process').first().textContent().catch(() => '?');
  61 |   console.log('当前步骤:', steps);
  62 |   
  63 |   await page.screenshot({ path: '/tmp/ca-init-current.png', fullPage: true });
  64 |   
  65 |   const body = await page.locator('body').innerText();
  66 |   // 只显示步骤之后的文本
  67 |   const idx = body.indexOf('完成');
  68 |   if (idx > 0) {
  69 |     console.log('页面内容(从"完成"后):', body.substring(idx, idx + 300));
  70 |   }
  71 |   
  72 |   // 尝试找到签名者表单
  73 |   const signerBtn = page.locator('button:has-text("新增签名者")').first();
  74 |   if (await signerBtn.isVisible().catch(() => false)) {
  75 |     console.log('✅ 进入步骤3: 创建签名者');
  76 |   } else {
  77 |     console.log('页面按钮:', (await page.locator('button').allTextContents()).filter(t => t.trim()).slice(0, 10).join(' | '));
  78 |   }
  79 | });
  80 | 
```