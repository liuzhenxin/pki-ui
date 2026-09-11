/**
 * 构造配置类接口的提交载荷，剔除服务端自有字段 `tested` / `lastTestTime`。
 *
 * 背景：后端配置 DTO（RadiusConfig / SyslogConfig 等）会返回这两个字段，其中
 * `lastTestTime` 是服务端 `Instant`（序列化格式 `yyyy-MM-dd HH:mm:ss`）。前端在测试成功后
 * 会用 `new Date().toISOString()`（带 `T` / `Z`）覆盖它，若把表单原样回传，后端 Jackson 反序列化
 * 失败，接口直接 400：`JSON parse error: Cannot deserialize value of type java.time.Instant`。
 * 表现是「测试成功后再点测试或保存都失败」（128 实测，pki-ui-ops 3.0.4）。
 *
 * 这两个字段由服务端维护，请求时应始终剔除；本地仍可保留在表单里用于展示测试时间。
 *
 * @param source 表单对象（reactive 代理或普通对象）
 * @returns 可安全提交的载荷（深拷贝，避免与表单共享引用）
 */
export function configPayload<T extends object>(source: T): Omit<T, 'tested' | 'lastTestTime'> {
  const payload = JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
  delete payload.tested;
  delete payload.lastTestTime;
  return payload as Omit<T, 'tested' | 'lastTestTime'>;
}
