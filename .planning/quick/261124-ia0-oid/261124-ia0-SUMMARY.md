---
status: complete
---

# 证书模板主题字段 OID 可读名称

- CA、RA 模板编辑与共享详情组件使用同一份主题字段字典。优先按 OID 识别，兼容字段简称及旧模板格式。
- 已有字段在下拉框中保留可读名称和 OID。自定义字段显示模板描述或原 OID，保存时保留字段标识和已有描述。
- 字典包含 38 个唯一 OID，与后端 `SubjectDnSpec` 核对无缺项。
- Vitest 48 项、Playwright 2 项、改动文件 ESLint、CA 和 RA 的生产构建以及 `git diff --check` 均通过。Playwright 通过模拟接口运行。效期回归用例等待保存后返回完成，再重新打开模板。
