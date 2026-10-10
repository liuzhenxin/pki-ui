<template>
  <section v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <div class="toolbar">
      <el-button v-if="manage" type="primary" :disabled="loading || !dataReady" @click="edit()">绑定签名证书</el-button>
      <el-button :disabled="loading" @click="load">刷新绑定</el-button>
    </div>
    <el-table :data="rows" empty-text="暂无签名证书绑定，请先登记应用并导入签名证书">
      <el-table-column label="应用" min-width="200"
        ><template #default="{ row }">{{ applicationName(row.fields.applicationId) }}</template></el-table-column
      >
      <el-table-column label="签名证书" min-width="230"
        ><template #default="{ row }">{{ certificateName(row.fields.certificateId) }}</template></el-table-column
      >
      <el-table-column prop="fields.keyId" label="设备密钥引用" min-width="220" />
      <el-table-column label="状态" width="100"
        ><template #default="{ row }">{{ row.fields.enabled === 'true' ? '启用' : '停用' }}</template></el-table-column
      >
      <el-table-column prop="version" label="版本" width="80" />
      <el-table-column v-if="manage" label="操作" width="140"
        ><template #default="{ row }"><el-button link :disabled="!dataReady" @click="edit(row)">修改绑定</el-button></template></el-table-column
      >
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="prev, pager, next, total" @current-change="load" />
    <el-dialog v-model="dialog" :title="draft.version ? '修改签名证书绑定' : '绑定签名证书'" width="680px" :close-on-click-modal="false">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-form label-width="120px" @submit.prevent>
        <el-form-item label="应用">
          <el-select v-model="draft.fields.applicationId" filterable :disabled="draft.version > 0" style="width: 100%">
            <el-option
              v-for="app in applications"
              :key="app.id"
              :value="app.id"
              :label="`${app.fields.name || app.id} · ${app.id}`"
              :disabled="app.fields.enabled !== 'true'"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="签名证书">
          <el-select v-model="draft.fields.certificateId" filterable style="width: 100%" @change="selectCertificate">
            <el-option
              v-for="cert in certificates"
              :key="cert.id"
              :value="cert.id"
              :label="`${cert.subject} · ${cert.serial}`"
              :disabled="!available(cert)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="设备密钥引用"><el-input :model-value="draft.fields.keyId" readonly /></el-form-item>
        <el-form-item label="状态"
          ><el-select v-model="draft.fields.enabled"><el-option label="启用" value="true" /><el-option label="停用" value="false" /></el-select
        ></el-form-item>
        <el-form-item label="变更原因"><el-input v-model="reason" type="textarea" maxlength="500" show-word-limit :rows="3" /></el-form-item>
      </el-form>
      <el-alert title="提交时校验证书用途、有效期及设备公钥。切换绑定后，该应用的签名请求将使用所选证书和密钥。" :closable="false" />
      <template #footer
        ><el-button :disabled="saving" @click="dialog = false">取消</el-button
        ><el-button type="primary" :loading="saving" :disabled="!ready" @click="save">保存绑定</el-button></template
      >
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import * as product from '@/api/svs/product';
import * as certificateApi from '@/api/svs/certificates';
const props = defineProps<{ manage: boolean }>();
const rows = ref<product.Resource[]>([]),
  applications = ref<product.Resource[]>([]),
  certificates = ref<certificateApi.Certificate[]>([]),
  keys = ref<product.Resource[]>([]);
const page = ref(1),
  total = ref(0),
  loading = ref(false),
  saving = ref(false),
  dialog = ref(false),
  error = ref(''),
  reason = ref('');
const empty = (): product.Resource => ({
  id: '',
  kind: 'BINDING',
  version: 0,
  fields: { applicationId: '', certificateId: '', keyId: '', enabled: 'true' }
});
const draft = ref(empty());
const dataReady = ref(false);
const message = (e: unknown) => (e instanceof Error ? e.message : '操作失败，请刷新后重试');
function applicationName(id: string) {
  return applications.value.find((a) => a.id === id)?.fields.name || id;
}
function certificateName(id: string) {
  const cert = certificates.value.find((c) => c.id === id);
  return cert ? `${cert.subject} · ${cert.serial}` : id;
}
function available(cert: certificateApi.Certificate) {
  return (
    cert.status === 'ACTIVE' &&
    new Date(cert.notAfter).getTime() > Date.now() &&
    keys.value.some((key) => key.id === cert.keyId && key.fields.enabled === 'true')
  );
}
const ready = computed(
  () =>
    props.manage &&
    dataReady.value &&
    !loading.value &&
    !!draft.value.fields.applicationId &&
    !!draft.value.fields.certificateId &&
    !!draft.value.fields.keyId &&
    !!reason.value.trim()
);
async function allResources(kind: product.Kind) {
  const result: product.Resource[] = [];
  for (let n = 1; ; n++) {
    const data = await product.resources(kind, n, 100);
    result.push(...data.rows);
    if (result.length >= Number(data.total)) return result;
    if (!data.rows.length) throw new Error('列表已变化，请刷新后重试');
  }
}
async function allCertificates() {
  const result: certificateApi.Certificate[] = [];
  for (let n = 1; ; n++) {
    const data = await certificateApi.list(n);
    result.push(...data.rows);
    if (result.length >= Number(data.total)) return result;
    if (!data.rows.length) throw new Error('证书列表已变化，请刷新后重试');
  }
}
async function load() {
  dataReady.value = false;
  loading.value = true;
  error.value = '';
  try {
    const [bindings, apps, certs, references] = await Promise.all([
      product.resources('BINDING', page.value),
      allResources('APPLICATION'),
      allCertificates(),
      allResources('KEY_REFERENCE')
    ]);
    rows.value = bindings.rows;
    total.value = Number(bindings.total);
    applications.value = apps;
    certificates.value = certs;
    keys.value = references;
    dataReady.value = true;
  } catch (e) {
    error.value = message(e);
  } finally {
    loading.value = false;
  }
}
function edit(row?: product.Resource) {
  if (!props.manage || !dataReady.value) return;
  draft.value = row ? { ...row, fields: { ...row.fields } } : { ...empty(), id: crypto.randomUUID() };
  reason.value = '';
  error.value = '';
  dialog.value = true;
}
function selectCertificate(id: string) {
  draft.value.fields.keyId = certificates.value.find((c) => c.id === id)?.keyId || '';
}
async function save() {
  if (!ready.value || saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await product.maintain({ ...draft.value, fields: { ...draft.value.fields } }, reason.value.trim());
    dialog.value = false;
    ElMessage.success('签名证书绑定已保存');
    await load();
  } catch (e) {
    error.value = message(e);
  } finally {
    saving.value = false;
  }
}
defineExpose({ load });
onMounted(load);
</script>
<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.el-alert {
  margin-bottom: 16px;
}
</style>
