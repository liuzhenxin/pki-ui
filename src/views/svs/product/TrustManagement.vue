<template>
  <section v-loading="busy">
    <el-alert
      :title="
        mode === 'trust'
          ? '启用的 CA 证书作为信任锚；调用方携带的中间证书仅参与构建链，不自动受信任。'
          : '全局证书验证策略：CRL 或 OCSP 覆盖验证链中的非信任锚证书。状态未知、过期或查询失败均拒绝验证。'
      "
      type="info"
      :closable="false"
    />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-button v-if="manage" type="primary" :disabled="!ready" @click="edit()">{{ mode === 'trust' ? '新增信任锚' : '配置验证策略' }}</el-button>
    <el-table :data="rows" empty-text="尚未配置">
      <el-table-column prop="id" label="标识" />
      <el-table-column label="名称"
        ><template #default="{ row }">{{ row.fields.name || row.id }}</template></el-table-column
      >
      <el-table-column label="状态"
        ><template #default="{ row }">{{ row.fields.enabled === 'true' ? '启用' : '停用' }}</template></el-table-column
      >
      <el-table-column v-if="mode === 'policies'" label="吊销校验"
        ><template #default="{ row }">{{
          row.fields.revocationMode === 'REQUIRED' ? row.fields.revocationSource || 'CRL' : '关闭'
        }}</template></el-table-column
      >
      <el-table-column prop="version" label="版本" />
      <el-table-column label="操作"
        ><template #default="{ row }"
          ><el-button link @click="history(row)">详情与历史</el-button><el-button v-if="manage" link @click="edit(row)">修改</el-button></template
        ></el-table-column
      >
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="prev, pager, next, total" @current-change="load" />
    <el-dialog v-model="dialog" :title="mode === 'trust' ? '信任锚配置' : '全局验证策略'" width="680px">
      <el-form label-width="130px">
        <el-form-item label="标识"><el-input v-model="draft.id" :disabled="draft.version > 0 || mode === 'policies'" maxlength="100" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="draft.fields.name" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="draft.fields.enabled" active-value="true" inactive-value="false" /></el-form-item>
        <template v-if="mode === 'trust'">
          <el-form-item label="公开 CA 证书"
            ><input type="file" accept=".pem,.cer,.crt,.der" @change="readFile($event, 'certificate')" /><el-input
              v-model="draft.fields.certificate"
              type="textarea"
              :rows="6"
              placeholder="PEM 编码公开 CA 证书"
          /></el-form-item>
        </template>
        <template v-else>
          <el-form-item label="吊销校验"
            ><el-select v-model="draft.fields.revocationMode"
              ><el-option label="必须校验" value="REQUIRED" /><el-option label="关闭" value="DISABLED" /></el-select
          ></el-form-item>
          <el-alert
            v-if="draft.fields.revocationMode === 'DISABLED'"
            title="关闭后仍校验证书链及有效期，但不检查吊销状态。"
            type="warning"
            :closable="false"
          />
          <template v-if="draft.fields.revocationMode === 'REQUIRED'">
            <el-form-item label="状态来源"
              ><el-radio-group v-model="draft.fields.revocationSource"
                ><el-radio value="CRL">CRL</el-radio><el-radio value="OCSP">OCSP</el-radio></el-radio-group
              ></el-form-item
            >
            <el-form-item v-if="draft.fields.revocationSource === 'CRL'" label="CRL"
              ><input type="file" accept=".crl,.pem,.der" @change="readFile($event, 'crl')" /><el-input
                v-model="draft.fields.crl"
                type="textarea"
                :rows="5"
                placeholder="Base64 DER，需包含链中各颁发者的完整 CRL"
            /></el-form-item>
            <el-form-item v-else label="OCSP 地址"><el-input v-model="draft.fields.ocspUrl" placeholder="https://ocsp.example.com/" /></el-form-item>
          </template>
          <el-form-item label="历史时间验证"
            ><el-switch v-model="draft.fields.allowHistoricalValidation" active-value="true" inactive-value="false"
          /></el-form-item>
        </template>
        <el-form-item label="变更原因"><el-input v-model="reason" type="textarea" maxlength="500" show-word-limit /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button v-if="manage" type="primary" :loading="saving" :disabled="!valid || saving" @click="save">保存配置</el-button></template
      >
    </el-dialog>
    <el-dialog v-model="historyOpen" title="配置详情与历史" width="700px">
      <pre class="history">{{ versions }}</pre>
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import * as api from '@/api/svs/product';
const props = defineProps<{ mode: 'trust' | 'policies'; manage: boolean }>();
const kind = computed<api.Kind>(() => (props.mode === 'trust' ? 'TRUST_ANCHOR' : 'POLICY'));
const rows = ref<api.Resource[]>([]),
  total = ref(0),
  page = ref(1),
  busy = ref(false),
  ready = ref(false);
const error = ref(''),
  dialog = ref(false),
  saving = ref(false),
  reason = ref(''),
  historyOpen = ref(false),
  versions = ref<api.Resource[]>([]);
const draft = ref<api.Resource>({ id: '', kind: 'TRUST_ANCHOR', version: 0, fields: {} });
const valid = computed(() => {
  const f = draft.value.fields;
  if (!props.manage || !ready.value || !draft.value.id.trim() || !reason.value.trim()) return false;
  if (props.mode === 'trust') return !!f.certificate?.trim();
  if (f.revocationMode === 'DISABLED') return true;
  if (f.revocationSource === 'CRL') return !!f.crl?.trim();
  try {
    const url = new URL(f.ocspUrl);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
});
async function load() {
  busy.value = true;
  ready.value = false;
  error.value = '';
  try {
    const data = await api.resources(kind.value, page.value);
    rows.value = data.rows;
    total.value = data.total;
    ready.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '配置加载失败';
  } finally {
    busy.value = false;
  }
}
function edit(row?: api.Resource) {
  if (!props.manage || !ready.value) return;
  const current = row || (props.mode === 'policies' ? rows.value.find((r) => r.id === 'validation') : undefined);
  draft.value = current
    ? { ...current, fields: { ...current.fields } }
    : {
        id: props.mode === 'policies' ? 'validation' : '',
        kind: kind.value,
        version: 0,
        fields: {
          name: '',
          enabled: 'true',
          ...(props.mode === 'policies'
            ? { revocationMode: 'REQUIRED', revocationSource: 'CRL', allowHistoricalValidation: 'false' }
            : { certificate: '' })
        }
      };
  reason.value = '';
  error.value = '';
  dialog.value = true;
}
async function readFile(event: Event, field: 'certificate' | 'crl') {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1048576) throw new Error('文件不得超过 1 MiB');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    if (/PRIVATE KEY/.test(text)) throw new Error('仅接受公开证书或 CRL');
    const pattern =
      field === 'certificate'
        ? /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g
        : /-----BEGIN X509 CRL-----([\s\S]*?)-----END X509 CRL-----/g;
    const blocks = [...text.matchAll(pattern)];
    if (text.includes('-----BEGIN') && (!blocks.length || text.replace(pattern, '').trim())) throw new Error('文件类型不匹配');
    if (field === 'certificate' && blocks.length > 1) throw new Error('每条信任锚记录仅接受一张 CA 证书');
    let binary = '';
    if (blocks.length) {
      for (const block of blocks) binary += atob(block[1].replace(/\s/g, ''));
    } else {
      for (const byte of bytes) binary += String.fromCharCode(byte);
    }
    const encoded = btoa(binary);
    draft.value.fields[field] = field === 'certificate' ? `-----BEGIN CERTIFICATE-----\n${encoded}\n-----END CERTIFICATE-----` : encoded;
    error.value = '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : '文件读取失败';
  } finally {
    input.value = '';
  }
}
async function save() {
  if (!valid.value || saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await api.maintain({ ...draft.value, fields: { ...draft.value.fields } }, reason.value.trim());
    dialog.value = false;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败，请核实配置与当前版本';
  } finally {
    saving.value = false;
  }
}
async function history(row: api.Resource) {
  try {
    versions.value = await api.history(row.kind, row.id);
    historyOpen.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '历史加载失败';
  }
}
onMounted(load);
watch(
  () => props.mode,
  () => {
    page.value = 1;
    dialog.value = false;
    void load();
  }
);
defineExpose({ load });
</script>
<style scoped>
.el-alert {
  margin-bottom: 16px;
}
.history {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 60vh;
  overflow: auto;
}
</style>
