# 技术隐忧

**分析日期：** 2024-05-24

## 技术债

**巨型 Vue 组件：**
- 问题：`src/views/ca/init/index.vue`（2281 行）和 `src/views/ca/profile/form.vue`（1745 行）等组件过于庞大。它们混合了复杂的 PKI 配置逻辑、多步骤向导状态以及大量的内联样式。
- 文件：`src/views/ca/init/index.vue`、`src/views/ca/profile/form.vue`
- 影响：维护成本高，难以测试，且在修改 CA 初始化或模板管理时极易引入回归错误。
- 修复方案：将这些大型组件拆分为更小、功能更集中的子组件。将业务逻辑提取到专用的 composables 或 hooks 中。

**类型安全薄弱（过度使用 Any）：**
- 问题：API 服务定义和组件 props 中广泛使用 `any`，绕过了 TypeScript 的安全优势。
- 文件：`src/api/ca/cert.ts`、`src/api/ca/root.ts`、`src/api/ca/profile.ts`、`src/api/ca/types.ts`
- 影响：重构难度加大，因数据结构不匹配导致运行时错误的风险增加。
- 修复方案：为所有 PKI 相关的数据结构（证书、CA、模板、扩展项）定义完善的 TypeScript 接口并严格应用。

**手动 PKI 解析与格式化：**
- 问题：复杂的 PKI 数据（X509 证书）在计算属性中通过手动字符串操作和低级库调用进行解析和格式化。
- 文件：`src/components/X509Cert/index.vue`
- 影响：复杂度高，可能出现解析错误，且性能下降。
- 修复方案：创建一个专用的 PKI 工具服务或类来处理证书解析和格式化，并考虑将繁重的工作移交给 Web Worker。

## 已知问题

**导入逻辑不完整：**
- 现象：TODO 提示缺少子根证书导入的 API 调用。
- 文件：`src/views/ca/root/index.vue:793`
- 触发：尝试导入二级根证书时。
- 规避措施：未检测到。

## 安全注意事项

**非密码学随机性：**
- 风险：`generateRandomString` 使用了 `Math.random()`，这不适用于生成安全敏感的密钥。
- 文件：`src/utils/crypto.ts`
- 当前缓解：无。
- 建议：使用 `window.crypto.getRandomValues()` 生成用于密钥生成的随机字符串。

**不安全的 AES 模式 (ECB)：**
- 风险：请求/响应加密中使用了 ECB（电子密码本）模式的 AES。ECB 不会隐藏明文中的模式，且容易受到重放攻击和块重组攻击。
- 文件：`src/utils/crypto.ts`
- 当前缓解：基础加密层。
- 建议：切换到更安全的模式，如带有随机初始化向量 (IV) 的 AES-GCM 或 AES-CBC。

**前端私钥存储：**
- 风险：前端环境变量中存储并使用了一个私钥进行解密。这会使任何能访问前端 bundle 的人都能获取该密钥。
- 文件：`src/utils/jsencrypt.ts`、`.env.development`、`.env.production`
- 当前缓解：无（除了该密钥是“前端专用”的）。
- 建议：重新评估前端解密的必要性。如果必须，使用短寿命的会话密钥或更强大的密钥交换协议。

## 性能瓶颈

**主线程密码学操作：**
- 问题：RSA、SM2 和 AES 操作在 UI 主线程上同步执行。
- 文件：`src/utils/request.ts`、`src/utils/crypto.ts`、`src/utils/sm2.ts`、`src/components/X509Cert/index.vue`
- 原因：同步调用 `jsrsasign`、`crypto-js` 和 `sm-crypto` 等库。
- 改进路径：将繁重的密码学操作和大型证书解析任务移交给 Web Workers，以确保 UI 响应。

## 脆弱区域

**CA 初始化向导：**
- 文件：`src/views/ca/init/index.vue`
- 脆弱原因：处理整个 PKI 系统至关重要的首次设置。多步骤逻辑与 UI 紧密耦合。
- 安全修改建议：任何改动后都需要对完整的初始化流程进行详尽的手动测试。
- 测试覆盖：该复杂向导缺乏自动化测试。

**证书模板配置：**
- 文件：`src/views/ca/profile/form.vue`
- 脆弱原因：管理海量的证书扩展项和配置选项。表单逻辑的小变动可能会破坏发送至后端的生成模板配置。
- 安全修改建议：对表单使用数据驱动的方法，并根据 schema 验证最终生成的配置对象。
- 测试覆盖：未检测到。

## 测试覆盖缺口

**PKI 逻辑与工具函数：**
- 未测试项：自定义 PKI 工具、证书解析或请求加密层均无可见测试。
- 文件：`src/utils/crypto.ts`、`src/utils/sm2.ts`、`src/components/X509Cert/index.vue`
- 风险：核心安全或解析逻辑的变动可能引入难以发现的 Bug，除非进行全面的手动重新测试。
- 优先级：高

---

*隐忧审计：2024-05-24*
