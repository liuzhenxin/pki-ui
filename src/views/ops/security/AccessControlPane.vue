<template>
  <div>
    <div class="pane-actions">
      <div>
        <h3>管理界面访问控制</h3>
        <el-space>
          <el-tag :type="form.enabled ? 'success' : 'info'">{{ form.enabled ? '已启用' : '未启用' }}</el-tag>
          <el-tag v-if="currentIp.clientIp" :type="currentIp.inAllowList ? 'success' : 'warning'" effect="plain">
            当前 IP {{ currentIp.clientIp }} {{ currentIp.inAllowList ? '已在名单中' : '不在名单中' }}
          </el-tag>
        </el-space>
      </div>
      <el-button v-hasPermi="['ops:security:access:edit']" type="primary" :loading="saving" @click="save">保存</el-button>
    </div>

    <el-form v-loading="loading" label-position="top">
      <section class="band switch-band">
        <div>
          <strong>启用 IP 白名单</strong>
          <p>关闭后所有客户端均可访问管理 API；启用后仅白名单 IP 可调用 `/api-gateway/**`。</p>
        </div>
        <el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="关闭" />
      </section>

      <section class="band">
        <div class="server-title">
          <h4>白名单</h4>
          <el-button v-hasPermi="['ops:security:access:edit']" :disabled="form.entries.length >= 200" @click="addRow">添加地址</el-button>
        </div>
        <p class="hint">支持 IPv4 / IPv6 单地址与 CIDR，最多 200 条。单地址保存时自动补 /32 或 /128。</p>
        <el-table :data="form.entries" border>
          <el-table-column label="地址 / CIDR" min-width="220">
            <template #default="{ row, $index }">
              <el-input v-model.trim="row.cidr" placeholder="192.168.1.0/24" @blur="validateRow($index)" />
              <p v-if="rowErrors[$index]" class="row-error">{{ rowErrors[$index] }}</p>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="180">
            <template #default="{ row }">
              <el-input v-model.trim="row.remark" maxlength="128" placeholder="可选" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" align="center">
            <template #default="{ $index }">
              <el-button v-hasPermi="['ops:security:access:edit']" link type="danger" @click="removeRow($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { getAccessControlConfig, getAccessControlCurrentIp, saveAccessControlConfig } from '@/api/ops';
import type { AccessControlConfig, AccessControlCurrentIp } from '@/api/ops/types';

const defaults = (): AccessControlConfig => ({ enabled: false, entries: [] });
const form = reactive<AccessControlConfig>(defaults());
const currentIp = reactive<AccessControlCurrentIp>({ clientIp: '', inAllowList: false, source: '' });
const rowErrors = reactive<Record<number, string>>({});
const loading = ref(false);
const saving = ref(false);

const ipv4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const ipv6 = /:/;
const isValidCidr = (value: string) => {
  const raw = value.trim();
  if (!raw) return false;
  const [addr, prefix] = raw.split('/');
  if (!addr || raw.split('/').length > 2) return false;
  const v4 = ipv4.test(addr);
  const v6 = !v4 && ipv6.test(addr);
  if (!v4 && !v6) return false;
  if (prefix == null || prefix === '') return true;
  if (!/^\d+$/.test(prefix)) return false;
  const n = Number(prefix);
  return v4 ? n >= 0 && n <= 32 : n >= 0 && n <= 128;
};

const validateRow = (index: number) => {
  const cidr = form.entries[index]?.cidr?.trim() || '';
  if (!cidr) {
    rowErrors[index] = '';
    return true;
  }
  if (!isValidCidr(cidr)) {
    rowErrors[index] = '非法 IPv4 / IPv6 或 CIDR';
    return false;
  }
  rowErrors[index] = '';
  return true;
};

const addRow = () => {
  if (form.entries.length >= 200) return;
  form.entries.push({ cidr: '', remark: '' });
};

const removeRow = (index: number) => {
  form.entries.splice(index, 1);
  delete rowErrors[index];
};

const load = async () => {
  loading.value = true;
  try {
    const [configResponse, ipResponse] = await Promise.all([getAccessControlConfig(), getAccessControlCurrentIp()]);
    Object.assign(form, defaults(), configResponse.data || {});
    form.entries = (form.entries || []).map((item) => ({ cidr: item.cidr || '', remark: item.remark || '' }));
    Object.assign(currentIp, ipResponse.data || {});
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  let valid = true;
  form.entries.forEach((item, index) => {
    if (item.cidr?.trim() && !validateRow(index)) {
      valid = false;
    }
  });
  if (!valid) return;
  const entries = form.entries.filter((item) => item.cidr?.trim());
  if (form.enabled && entries.length < 1) {
    ElMessage.warning('启用访问控制前至少添加 1 条白名单');
    return;
  }
  let payload: AccessControlConfig = {
    enabled: form.enabled,
    entries: entries.map((item) => ({ cidr: item.cidr.trim(), remark: (item.remark || '').trim() }))
  };
  const alreadyListed =
    currentIp.inAllowList ||
    payload.entries.some((item) => item.cidr === currentIp.clientIp || item.cidr === `${currentIp.clientIp}/32` || item.cidr === `${currentIp.clientIp}/128`);
  if (form.enabled && currentIp.clientIp && !alreadyListed) {
    try {
      await ElMessageBox.confirm(
        `当前客户端 IP ${currentIp.clientIp} 不在名单中，保存后你将无法继续访问。是否自动加入并保存？`,
        '确认保存',
        { type: 'warning', confirmButtonText: '自动加入并保存', cancelButtonText: '取消' }
      );
      payload = {
        ...payload,
        entries: [...payload.entries, { cidr: currentIp.clientIp, remark: '保存时自动加入' }]
      };
    } catch {
      return;
    }
  }
  saving.value = true;
  try {
    await saveAccessControlConfig(payload);
    ElMessage.success('访问控制配置已保存');
    await load();
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<style scoped lang="scss">
.pane-actions,
.switch-band,
.server-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.band {
  padding: 22px 24px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
.band h4 {
  margin: 0 0 18px;
}
.band p,
.hint {
  margin: 5px 0;
  color: #64748b;
  font-size: 13px;
}
.row-error {
  margin: 4px 0 0;
  color: #dc2626;
  font-size: 12px;
}
@media (max-width: 680px) {
  .pane-actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
