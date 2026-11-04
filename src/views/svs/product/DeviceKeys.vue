<template>
  <div class="p-2" v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="mb-3" />
    <el-card shadow="never" class="mb-3">
      <el-alert
        title="仅展示已配置目录中的签名密钥。停用 KeyId 引用不会销毁设备密钥；公钥读取成功不代表应用已获授权。"
        type="info"
        :closable="false"
      />
      <el-form :inline="true" class="mt-3" @submit.prevent="search">
        <el-form-item :label="mode === 'keys' ? 'KeyId / 别名' : '设备别名'"
          ><el-input v-model="query" clearable placeholder="输入标识或别名"
        /></el-form-item>
        <el-form-item label="算法"
          ><el-select v-model="algorithm" clearable style="width: 130px"
            ><el-option label="SM2" value="SM2" /><el-option label="RSA" value="RSA" /></el-select
        ></el-form-item>
        <el-form-item><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
      </el-form>
    </el-card>
    <el-card shadow="never">
      <template #header
        ><div class="heading">
          <span>{{ titles[mode] }}</span>
          <div>
            <el-button v-if="mode === 'keys' && manage" type="primary" :disabled="!ready" @click="edit()">登记 KeyId</el-button
            ><el-button :disabled="loading" @click="load">刷新</el-button>
          </div>
        </div></template
      >
      <el-table v-if="mode === 'device-keys'" :data="devices" border empty-text="暂无已配置设备密钥">
        <el-table-column prop="alias" label="设备别名" min-width="160" /><el-table-column prop="algorithm" label="算法" width="90" />
        <el-table-column label="用途" width="80"><template #default>签名</template></el-table-column>
        <el-table-column label="公钥读取" width="150"
          ><template #default="{ row }"
            ><el-tag :type="row.state === 'READABLE' ? 'success' : 'danger'">{{ states[row.state] || '未知' }}</el-tag></template
          ></el-table-column
        >
        <el-table-column prop="fingerprint" label="公钥 SHA-256 指纹" min-width="230" show-overflow-tooltip />
        <el-table-column label="关联引用" width="130"
          ><template #default="{ row }"
            >{{ row.referenceIds.length }}<el-tag v-if="row.referenceMismatch" type="danger">不匹配</el-tag></template
          ></el-table-column
        >
        <el-table-column label="操作" min-width="240"
          ><template #default="{ row }"
            ><el-button link @click="detail = row">详情</el-button
            ><el-button v-if="manage" link type="primary" :disabled="row.state !== 'READABLE' || !ready" @click="register(row)">登记引用</el-button
            ><el-button link @click="goAssociations(row.alias)">关联查询</el-button></template
          ></el-table-column
        >
      </el-table>
      <el-table v-else-if="mode === 'keys'" :data="shownKeys" border empty-text="暂无 KeyId 引用">
        <el-table-column prop="id" label="KeyId" min-width="240" show-overflow-tooltip /><el-table-column
          prop="fields.alias"
          label="设备别名"
          min-width="150"
        /><el-table-column prop="fields.algorithm" label="算法" width="90" />
        <el-table-column prop="fields.fingerprint" label="登记指纹" min-width="200" show-overflow-tooltip />
        <el-table-column label="引用状态" width="110"
          ><template #default="{ row }"
            ><el-tag :type="row.fields.enabled === 'true' ? 'success' : 'info'">{{
              row.fields.enabled === 'true' ? '启用' : '停用'
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column prop="version" label="版本" width="75" /><el-table-column label="操作" min-width="210"
          ><template #default="{ row }"
            ><el-button v-if="manage" link type="primary" :disabled="!ready" @click="edit(row)">维护引用</el-button
            ><el-button link @click="showHistory(row)">历史</el-button
            ><el-button link @click="goAssociations(row.fields.alias)">关联查询</el-button></template
          ></el-table-column
        >
      </el-table>
      <el-table v-else :data="shownAssociations" border empty-text="暂无密钥关联">
        <el-table-column prop="alias" label="设备别名" min-width="130" /><el-table-column
          prop="key.id"
          label="KeyId"
          min-width="210"
          show-overflow-tooltip
        />
        <el-table-column label="引用状态" width="95"
          ><template #default="{ row }">{{ row.key.fields.enabled === 'true' ? '启用' : '停用' }}</template></el-table-column
        >
        <el-table-column label="应用" min-width="130"
          ><template #default="{ row }">{{
            row.application?.fields.name || row.application?.id || (row.binding ? '应用缺失' : '未关联')
          }}</template></el-table-column
        >
        <el-table-column label="绑定状态" width="100"
          ><template #default="{ row }">{{
            !row.binding ? '未绑定' : row.binding.fields.enabled === 'true' ? '启用' : '停用'
          }}</template></el-table-column
        >
        <el-table-column label="签名证书" min-width="220"
          ><template #default="{ row }"
            >{{ row.certificate?.subject || (row.binding ? '证书缺失' : '未绑定') }}
            <div v-if="row.certificate">{{ row.certificate.serial }} / {{ row.certificate.status }} / {{ row.certificate.notAfter }}</div></template
          ></el-table-column
        >
        <el-table-column label="版本（引用/绑定/证书）" min-width="150"
          ><template #default="{ row }"
            >{{ row.key.version }} / {{ row.binding?.version ?? '—' }} / {{ row.certificate?.version ?? '—' }}</template
          ></el-table-column
        >
        <el-table-column label="操作" width="110"
          ><template #default
            ><el-button v-if="manage" link type="primary" @click="router.push('/svs/bindings')">签名绑定</el-button></template
          ></el-table-column
        >
      </el-table>
      <el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="total, prev, pager, next" @current-change="pageChanged" />
    </el-card>
    <el-dialog :model-value="!!detail" title="设备密钥详情" width="650px" @close="detail = null"
      ><el-descriptions v-if="detail" :column="1" border
        ><el-descriptions-item label="别名">{{ detail.alias }}</el-descriptions-item
        ><el-descriptions-item label="算法">{{ detail.algorithm }}</el-descriptions-item
        ><el-descriptions-item label="公钥读取">{{ states[detail.state] || '未知' }}</el-descriptions-item
        ><el-descriptions-item label="当前指纹"
          ><span class="break">{{ detail.fingerprint || '不可用' }}</span></el-descriptions-item
        ><el-descriptions-item label="读取时间">{{ detail.observedAt }}</el-descriptions-item
        ><el-descriptions-item label="关联 KeyId"
          ><span class="break">{{ detail.referenceIds.join(', ') || '未登记' }}</span></el-descriptions-item
        ></el-descriptions
      ></el-dialog
    >
    <el-dialog v-model="dialog" title="KeyId 引用登记与维护" width="680px">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-form label-width="130px" class="mt-3"
        ><el-form-item label="KeyId"><el-input v-model="draft.id" :disabled="draft.version > 0" /></el-form-item>
        <el-form-item label="设备密钥"
          ><el-select v-model="draft.fields.alias" :disabled="draft.version > 0" filterable style="width: 100%" @change="selectAlias"
            ><el-option
              v-for="d in options"
              :key="d.alias"
              :label="`${d.alias} (${d.algorithm})`"
              :value="d.alias"
              :disabled="d.state !== 'READABLE'" /></el-select
        ></el-form-item>
        <el-form-item label="算法"><el-input v-model="draft.fields.algorithm" disabled /></el-form-item
        ><el-form-item label="公钥指纹"><el-input v-model="draft.fields.fingerprint" type="textarea" disabled /></el-form-item>
        <el-form-item label="引用启用"><el-switch v-model="draft.fields.enabled" active-value="true" inactive-value="false" /></el-form-item
        ><el-form-item label="变更原因"><el-input v-model="reason" type="textarea" maxlength="500" show-word-limit /></el-form-item> </el-form
      ><el-alert title="已有引用目标不在此处替换。需要更换密钥时，登记新 KeyId 并切换签名证书绑定。" type="info" :closable="false" />
      <template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button v-if="manage" type="primary" :disabled="!valid || saving" :loading="saving" @click="save">保存引用</el-button></template
      >
    </el-dialog>
    <el-dialog v-model="historyOpen" title="引用配置历史" width="650px">
      <pre class="break">{{ historyRows }}</pre>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import * as api from '@/api/svs/product';
import * as certApi from '@/api/svs/certificates';
import { listDeviceKeys, type DeviceKeyRow } from '@/api/svs/deviceKeys';
const props = defineProps<{ mode: 'device-keys' | 'keys' | 'key-associations'; manage: boolean }>();
const route = useRoute(),
  router = useRouter();
const titles = { 'device-keys': '设备密钥列表', keys: 'KeyId 引用', 'key-associations': '密钥关联' };
const states: Record<string, string> = {
  READABLE: '读取成功',
  UNSUPPORTED: '算法不支持',
  INVALID_CONFIGURATION: '目录配置无效',
  UNAVAILABLE: '公钥不可用'
};
const loading = ref(false),
  ready = ref(false),
  error = ref(''),
  page = ref(1),
  directoryTotal = ref(0),
  query = ref(String(route.query.alias || '')),
  algorithm = ref('');
const devices = ref<DeviceKeyRow[]>([]),
  options = ref<DeviceKeyRow[]>([]),
  keys = ref<api.Resource[]>([]),
  bindings = ref<api.Resource[]>([]),
  applications = ref<api.Resource[]>([]),
  certificates = ref<certApi.Certificate[]>([]);
const dialog = ref(false),
  saving = ref(false),
  reason = ref(''),
  detail = ref<DeviceKeyRow | null>(null),
  historyOpen = ref(false),
  historyRows = ref<api.Resource[]>([]);
const draft = ref<api.Resource>({ id: '', kind: 'KEY_REFERENCE', version: 0, fields: {} });
const filteredKeys = computed(() =>
  keys.value.filter(
    (k) =>
      (!query.value || k.id.includes(query.value) || k.fields.alias?.includes(query.value)) &&
      (!algorithm.value || k.fields.algorithm === algorithm.value)
  )
);
const shownKeys = computed(() => filteredKeys.value.slice((page.value - 1) * 20, page.value * 20));
const associations = computed(() =>
  filteredKeys.value.flatMap((key) => {
    const linked = bindings.value.filter((b) => b.fields.keyId === key.id);
    const related = linked.map((binding) => ({
      alias: key.fields.alias,
      key,
      binding,
      application: applications.value.find((a) => a.id === binding.fields.applicationId),
      certificate: certificates.value.find((c) => c.id === binding.fields.certificateId)
    }));
    const standalone = certificates.value
      .filter((c) => c.keyId === key.id && !linked.some((b) => b.fields.certificateId === c.id))
      .map((certificate) => ({ alias: key.fields.alias, key, binding: undefined, application: undefined, certificate }));
    return related.length || standalone.length
      ? [...related, ...standalone]
      : [{ alias: key.fields.alias, key, binding: undefined, application: undefined, certificate: undefined }];
  })
);
const shownAssociations = computed(() => associations.value.slice((page.value - 1) * 20, page.value * 20));
const total = computed(() =>
  props.mode === 'device-keys' ? directoryTotal.value : props.mode === 'keys' ? filteredKeys.value.length : associations.value.length
);
const selected = computed(() => options.value.find((d) => d.alias === draft.value.fields.alias));
const valid = computed(
  () =>
    props.manage &&
    ready.value &&
    /^[A-Za-z0-9_-]{32}$/.test(draft.value.id) &&
    !!reason.value.trim() &&
    (draft.value.version > 0 || (selected.value?.state === 'READABLE' && selected.value.fingerprint === draft.value.fields.fingerprint))
);
async function allResources(kind: api.Kind) {
  const rows: api.Resource[] = [];
  for (let p = 1; ; p++) {
    const data = await api.resources(kind, p);
    rows.push(...data.rows);
    if (rows.length >= data.total || !data.rows.length) return rows;
  }
}
async function allDevices() {
  const rows: DeviceKeyRow[] = [];
  for (let p = 1; ; p++) {
    const data = await listDeviceKeys(p);
    rows.push(...data.rows);
    if (rows.length >= data.total || !data.rows.length) return rows;
  }
}
async function allCertificates() {
  const rows: certApi.Certificate[] = [];
  for (let p = 1; ; p++) {
    const data = await certApi.list(p);
    rows.push(...data.rows);
    if (rows.length >= data.total || !data.rows.length) return rows;
  }
}
async function load() {
  loading.value = true;
  ready.value = false;
  error.value = '';
  try {
    if (props.mode === 'device-keys') {
      const data = await listDeviceKeys(page.value, query.value, algorithm.value);
      devices.value = data.rows;
      directoryTotal.value = data.total;
    } else if (props.mode === 'keys') {
      const [k, d] = await Promise.all([allResources('KEY_REFERENCE'), allDevices()]);
      keys.value = k;
      options.value = d;
    } else {
      const [k, b, a, c] = await Promise.all([
        allResources('KEY_REFERENCE'),
        allResources('BINDING'),
        allResources('APPLICATION'),
        allCertificates()
      ]);
      keys.value = k;
      bindings.value = b;
      applications.value = a;
      certificates.value = c;
    }
    ready.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '数据加载失败';
  } finally {
    loading.value = false;
  }
}
function search() {
  page.value = 1;
  if (props.mode === 'device-keys') void load();
}
function reset() {
  query.value = '';
  algorithm.value = '';
  search();
}
function pageChanged() {
  if (props.mode === 'device-keys') void load();
}
function register(row: DeviceKeyRow) {
  void router.push({ path: '/svs/keys', query: { alias: row.alias, register: '1' } });
}
function goAssociations(alias: string) {
  void router.push({ path: '/svs/key-associations', query: { alias } });
}
function edit(row?: api.Resource) {
  if (!props.manage || !ready.value) return;
  draft.value = row
    ? { ...row, fields: { ...row.fields } }
    : {
        id: crypto.randomUUID().replace(/-/g, ''),
        kind: 'KEY_REFERENCE',
        version: 0,
        fields: { alias: '', algorithm: '', fingerprint: '', enabled: 'true' }
      };
  reason.value = '';
  error.value = '';
  dialog.value = true;
  if (!row && typeof route.query.alias === 'string') {
    draft.value.fields.alias = route.query.alias;
    selectAlias(route.query.alias);
  }
}
function selectAlias(alias: string) {
  const d = options.value.find((x) => x.alias === alias);
  draft.value.fields.algorithm = d?.algorithm || '';
  draft.value.fields.fingerprint = d?.fingerprint || '';
}
async function save() {
  if (!valid.value || saving.value) return;
  saving.value = true;
  try {
    await ElMessageBox.confirm(
      `KeyId：${draft.value.id}\n设备别名：${draft.value.fields.alias}\n引用：${draft.value.fields.enabled === 'true' ? '启用' : '停用'}；此操作不销毁设备密钥。`,
      '确认维护密钥引用',
      { type: 'warning' }
    );
    if (!props.manage || !ready.value) return;
    await api.maintain({ ...draft.value, fields: { ...draft.value.fields } }, reason.value.trim());
    dialog.value = false;
    ElMessage.success('引用已保存');
    await load();
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') error.value = e instanceof Error ? e.message : '保存失败，请核实当前版本';
  } finally {
    saving.value = false;
  }
}
async function showHistory(row: api.Resource) {
  try {
    historyRows.value = await api.history('KEY_REFERENCE', row.id);
    historyOpen.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '历史加载失败';
  }
}
async function initialize() {
  page.value = 1;
  query.value = String(route.query.alias || '');
  dialog.value = false;
  await load();
  if (props.mode === 'keys' && route.query.register === '1' && ready.value) edit();
}
onMounted(initialize);
watch(() => [props.mode, route.query.alias, route.query.register], initialize);
defineExpose({ load });
</script>
<style scoped>
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.break {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
