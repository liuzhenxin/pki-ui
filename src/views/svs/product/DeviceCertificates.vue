<template>
  <section v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <div class="certificate-toolbar">
      <el-button v-if="manage" type="primary" @click="openCsr">生成证书请求 CSR</el-button>
      <el-button v-if="manage" @click="openImport()">导入公开证书</el-button>
      <el-button @click="load">刷新证书</el-button>
    </div>
    <el-alert title="证书公钥必须与设备密钥一致。已绑定证书轮转时，导入新证书后直接切换绑定，核对用途与影响范围。" :closable="false" />
    <el-table :data="rows" empty-text="暂无设备证书，可先生成 CSR 向 CA 申请证书">
      <el-table-column prop="subject" label="主体" min-width="220" />
      <el-table-column prop="serial" label="序列号" min-width="160" />
      <el-table-column prop="keyId" label="设备密钥标识" min-width="210" />
      <el-table-column label="状态" width="100"
        ><template #default="{ row }">{{
          new Date(row.notAfter).getTime() < Date.now() ? '已过期' : row.status === 'ACTIVE' ? '有效' : '停用'
        }}</template></el-table-column
      >
      <el-table-column prop="notAfter" label="有效期至" min-width="180" />
      <el-table-column label="操作" min-width="220"
        ><template #default="{ row }">
          <el-button link @click="showDetails(row)">详情</el-button>
          <el-button link @click="exportCertificate(row)">下载证书</el-button>
          <el-button v-if="manage" link @click="openImport(row)">替换证书</el-button>
        </template></el-table-column
      >
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="prev, pager, next, total" @current-change="load" />
    <el-dialog v-model="csrDialog" title="生成证书请求 CSR" width="640px">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-form label-width="110px">
        <el-form-item label="设备密钥"
          ><el-select v-model="keyId" style="width: 100%"
            ><el-option
              v-for="key in deviceKeys"
              :key="key.keyId"
              :label="`${key.alias} (${key.algorithm}) · ${key.keyId}`"
              :value="key.keyId" /></el-select
        ></el-form-item>
        <el-form-item label="证书主体 DN"><el-input v-model="subject" maxlength="1024" placeholder="CN=设备名称,O=组织,C=CN" /></el-form-item>
      </el-form>
      <el-alert title="使用已有 SM2 设备密钥签名；下载 CSR 后向 CA 申请证书，再导入返回的公开证书。" :closable="false" />
      <el-input v-if="csrPem" :model-value="csrPem" readonly type="textarea" :rows="7" />
      <template #footer
        ><el-button @click="csrDialog = false">关闭</el-button
        ><el-button v-if="csrPem" @click="download(csrPem, 'svs-device.csr')">下载 CSR</el-button
        ><el-button type="primary" :loading="saving" :disabled="!keyId || !subject.trim()" @click="generateCsr">生成 CSR</el-button></template
      >
    </el-dialog>
    <el-dialog v-model="importDialog" :title="replaceId ? '替换未绑定证书' : '导入公开证书'" width="640px">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-form label-width="110px">
        <el-form-item label="设备密钥"
          ><el-select v-model="keyId" :disabled="!!replaceId" style="width: 100%"
            ><el-option v-for="key in deviceKeys" :key="key.keyId" :label="`${key.alias} · ${key.keyId}`" :value="key.keyId" /></el-select
        ></el-form-item>
        <el-form-item label="证书文件"><input type="file" accept=".pem,.cer,.crt,.der" @change="readCertificate" /></el-form-item>
        <el-form-item label="公开证书"
          ><el-input v-model="certificate" type="textarea" :rows="8" placeholder="PEM 或 Base64 DER；仅公开证书"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="importDialog = false">取消</el-button
        ><el-button type="primary" :loading="saving" :disabled="!keyId || !certificate.trim()" @click="importCertificate">{{
          replaceId ? '校验并替换' : '校验并导入'
        }}</el-button></template
      >
    </el-dialog>
    <el-drawer v-model="detailDialog" title="设备证书详情" size="60%"
      ><el-descriptions :column="1" border
        ><el-descriptions-item v-for="(value, key) in detail" :key="key" :label="labels[key] || key">{{
          value
        }}</el-descriptions-item></el-descriptions
      ></el-drawer
    >
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import * as api from '@/api/svs/certificates';
defineProps<{ manage: boolean }>();
const rows = ref<api.Certificate[]>([]),
  deviceKeys = ref<api.DeviceKey[]>([]),
  page = ref(1),
  total = ref(0);
const loading = ref(false),
  saving = ref(false),
  error = ref(''),
  csrDialog = ref(false),
  importDialog = ref(false),
  detailDialog = ref(false);
const keyId = ref(''),
  subject = ref(''),
  csrPem = ref(''),
  certificate = ref(''),
  replaceId = ref(''),
  detail = ref<Record<string, string>>({});
const labels: Record<string, string> = {
  subject: '主体',
  issuer: '颁发者',
  serial: '序列号',
  notBefore: '有效期起',
  notAfter: '有效期至',
  algorithm: '签名算法',
  fingerprint: '公钥 SHA-256 指纹',
  keyId: '设备密钥标识',
  version: '版本',
  status: '状态'
};
const message = (e: unknown) => {
  const data = (e as { response?: { data?: { message?: string; Status?: { Msg?: string } } } })?.response?.data;
  return data?.message || data?.Status?.Msg || (e instanceof Error ? e.message : '操作失败，请检查权限或设备状态');
};
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [certs, keys] = await Promise.all([api.list(page.value), api.keys()]);
    rows.value = certs.rows;
    total.value = Number(certs.total);
    deviceKeys.value = keys;
  } catch (e) {
    error.value = message(e);
  } finally {
    loading.value = false;
  }
}
function openCsr() {
  error.value = '';
  keyId.value = deviceKeys.value[0]?.keyId || '';
  csrPem.value = '';
  csrDialog.value = true;
}
function openImport(row?: api.Certificate) {
  error.value = '';
  replaceId.value = row?.id || '';
  keyId.value = row?.keyId || deviceKeys.value[0]?.keyId || '';
  certificate.value = '';
  importDialog.value = true;
}
async function generateCsr() {
  saving.value = true;
  error.value = '';
  csrPem.value = '';
  try {
    csrPem.value = (await api.csr(keyId.value, subject.value.trim())).csr;
    ElMessage.success('CSR 已生成并通过签名验证');
  } catch (e) {
    error.value = message(e);
  } finally {
    saving.value = false;
  }
}
async function importCertificate() {
  if (certificate.value.includes('PRIVATE KEY')) {
    error.value = '仅允许公开证书';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    await api.upload(keyId.value, certificate.value, replaceId.value);
    importDialog.value = false;
    ElMessage.success('公钥匹配校验通过，证书已保存');
    await load();
  } catch (e) {
    error.value = message(e);
  } finally {
    saving.value = false;
  }
}
async function readCertificate(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 65535) {
    error.value = '证书文件不能超过64KB';
    return;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  if (text.includes('PRIVATE KEY')) {
    error.value = '仅允许公开证书';
    return;
  }
  certificate.value = text.includes('-----BEGIN') ? text : btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
}
async function showDetails(row: api.Certificate) {
  try {
    const { certificate: _, ...fields } = await api.details(row.id);
    detail.value = { ...fields, keyId: row.keyId, version: String(row.version), status: row.status };
    detailDialog.value = true;
  } catch (e) {
    error.value = message(e);
  }
}
async function exportCertificate(row: api.Certificate) {
  try {
    download((await api.details(row.id)).certificate, 'svs-device.cer');
  } catch (e) {
    error.value = message(e);
  }
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
onMounted(load);
</script>
<style scoped>
.certificate-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.el-alert {
  margin-bottom: 16px;
}
</style>
