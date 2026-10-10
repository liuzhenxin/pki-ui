<template>
  <main class="svs-page" v-loading="loading">
    <div class="heading">
      <h1>{{ title }}</h1>
      <el-button @click="load">刷新</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-if="page === 'bindings'">
      <SigningBindings ref="bindingPanel" :manage="canWrite" />
    </template>
    <template v-else-if="kind">
      <div class="toolbar">
        <el-button v-if="canWrite" type="primary" @click="edit()">{{ kind === 'AUDIT_OPINION' ? '追加意见' : '新增' }}</el-button
        ><span>变更按当前角色直接执行，并校验对象版本、依赖与变更原因。</span>
      </div>
      <el-table :data="rows" empty-text="暂无记录">
        <el-table-column prop="id" label="标识" min-width="180" />
        <el-table-column label="名称 / 内容" min-width="240"
          ><template #default="{ row }">{{
            row.fields.name || row.fields.opinion || row.fields.subjectId || row.fields.applicationId || row.fields.alias
          }}</template></el-table-column
        >
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column label="状态" width="100"
          ><template #default="{ row }">{{ row.fields.enabled === 'false' ? '停用' : row.fields.status || '有效' }}</template></el-table-column
        >
        <el-table-column label="操作" min-width="230"
          ><template #default="{ row }"
            ><el-button link @click="showHistory(row)">详情与历史</el-button
            ><el-button v-if="kind === 'APPLICATION'" link @click="showDiagnostics(row)">接入检查</el-button
            ><el-button v-if="canWrite && kind !== 'AUDIT_OPINION'" link type="primary" @click="edit(row)">修改</el-button></template
          ></el-table-column
        >
      </el-table>
      <el-pagination v-model:current-page="pageNumber" :total="total" :page-size="20" layout="prev, pager, next, total" @current-change="load" />
    </template>
    <template v-else-if="page === 'approvals'">
      <el-alert title="历史审批只读；未完成申请已终止，不能批准或执行。继续变更请重新读取当前配置后提交。" type="info" :closable="false" />
      <el-table :data="approvalRows" empty-text="暂无历史审批">
        <el-table-column prop="proposed.id" label="对象" min-width="150" /><el-table-column prop="applicant" label="申请人" /><el-table-column
          prop="approver"
          label="审批人"
        /><el-table-column label="状态"
          ><template #default="{ row }">{{ approvalState(row.state) }}</template></el-table-column
        ><el-table-column prop="expiresAt" label="截止时间" min-width="210" />
        <el-table-column label="操作" width="260"
          ><template #default="{ row }"><el-button link @click="approvalDetail(row)">变更详情</el-button></template></el-table-column
        > </el-table
      ><el-pagination v-model:current-page="pageNumber" :total="total" :page-size="20" layout="prev, pager, next, total" @current-change="load" />
    </template>
    <template v-else-if="page === 'audit'">
      <div class="toolbar">
        <el-input v-model="operation" placeholder="操作名称" clearable /><el-select v-model="result" placeholder="结果" clearable
          ><el-option label="成功" value="成功" /><el-option label="失败" value="失败" /></el-select
        ><el-button
          @click="
            pageNumber = 1;
            load();
          "
          >查询</el-button
        ><el-button v-if="has('svs:audit:log:export')" @click="downloadAudit">导出当前筛选</el-button>
      </div>
      <el-table :data="auditRows" empty-text="暂无记录"
        ><el-table-column v-for="column in auditColumns" :key="column.key" :prop="column.key" :label="column.label" min-width="140"
      /></el-table>
      <el-pagination v-model:current-page="pageNumber" :total="total" :page-size="20" layout="prev, pager, next, total" @current-change="load" />
    </template>
    <template v-else-if="page === 'certificates'">
      <DeviceCertificates :manage="has('svs:security:certificate:manage')" />
    </template>
    <template v-else-if="page === 'runtime'">
      <el-descriptions :column="2" border
        ><el-descriptions-item v-for="(value, key) in runtimeData" :key="key" :label="runtimeLabels[key] || key">{{
          value
        }}</el-descriptions-item></el-descriptions
      >
      <el-table v-if="identity?.role === 'SYSADMIN'" :data="metricRows" empty-text="过去24小时暂无调用"
        ><el-table-column prop="operation" label="接口" /><el-table-column prop="result" label="结果" /><el-table-column prop="count" label="次数"
      /></el-table>
    </template>
    <template v-else-if="page === 'backup'"
      ><el-alert title="备份仅包含非敏感应用登记信息。数据库历史、审批和审计的备份恢复由部署运维流程负责。" :closable="false" /><el-button
        type="primary"
        @click="downloadBackup"
        >下载非敏感配置</el-button
      ></template
    >
    <el-dialog v-model="dialog" :title="draft.version ? '修改资源' : '新增资源'" width="640px">
      <el-form label-width="140px" @submit.prevent
        ><el-form-item label="标识"><el-input v-model="draft.id" :disabled="draft.version > 0" maxlength="100" /></el-form-item>
        <el-form-item v-for="field in fields" :key="field.key" :label="field.label">
          <el-select v-if="field.options" v-model="draft.fields[field.key]" style="width: 100%"
            ><el-option
              v-for="option in field.options"
              :key="option"
              :label="option === 'true' ? '启用' : option === 'false' ? '停用' : option"
              :value="option"
          /></el-select>
          <el-input v-else v-model="draft.fields[field.key]" :type="field.multiline ? 'textarea' : 'text'" :rows="4" :placeholder="field.hint" />
        </el-form-item>
        <el-form-item label="变更原因"><el-input v-model="reason" type="textarea" maxlength="500" /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="dialog = false">取消</el-button><el-button :loading="saving" type="primary" @click="save">确认并保存</el-button></template
      >
    </el-dialog>
    <el-drawer v-model="details" title="对象与版本详情" size="60%"
      ><el-descriptions v-for="(item, index) in detailRows" :key="index" :column="1" border
        ><el-descriptions-item v-for="(value, key) in item" :key="key" :label="key">{{ value }}</el-descriptions-item></el-descriptions
      ></el-drawer
    >
  </main>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/utils/request';
import * as api from '@/api/svs/product';
import DeviceCertificates from './DeviceCertificates.vue';
import SigningBindings from './SigningBindings.vue';
const props = defineProps<{ page: string; title: string; mutable: boolean }>();
const bindingPanel = ref<{ load: () => Promise<void> } | null>(null);
interface Field {
  key: string;
  label: string;
  hint?: string;
  options?: string[];
  multiline?: boolean;
}
const configuration: Record<string, { kind: api.Kind; permission: string; fields: Field[] }> = {
  applications: {
    kind: 'APPLICATION',
    permission: 'svs:system:application:manage',
    fields: [
      { key: 'name', label: '应用名称' },
      { key: 'description', label: '说明' },
      { key: 'clientId', label: '平台可信客户端', hint: '变更前需停用现有接口授权，再由安全管理员重新授权' }
    ]
  },
  grants: {
    kind: 'GRANT',
    permission: 'svs:security:policy:manage',
    fields: [
      { key: 'applicationId', label: '应用标识' },
      { key: 'operations', label: '接口授权', hint: 'Sign,Verify,Query 等，以逗号分隔' },
      { key: 'expiresAt', label: '授权截止时间', hint: 'ISO 8601，例如 2027-01-01T00:00:00Z' }
    ]
  },
  keys: {
    kind: 'KEY_REFERENCE',
    permission: 'svs:security:key:manage',
    fields: [
      { key: 'alias', label: '设备公钥引用', hint: '部署时配置的公开引用名' },
      { key: 'algorithm', label: '算法', options: ['SM2', 'RSA'] },
      { key: 'fingerprint', label: '公钥 SHA-256 指纹' }
    ]
  },
  bindings: {
    kind: 'BINDING',
    permission: 'svs:security:policy:manage',
    fields: [
      { key: 'applicationId', label: '应用标识' },
      { key: 'keyId', label: 'KeyId' },
      { key: 'certificateId', label: '证书标识' }
    ]
  },
  trust: {
    kind: 'TRUST_ANCHOR',
    permission: 'svs:security:policy:manage',
    fields: [
      { key: 'name', label: '名称' },
      { key: 'certificate', label: 'CA 公开证书', multiline: true }
    ]
  },
  policies: {
    kind: 'POLICY',
    permission: 'svs:security:policy:manage',
    fields: [
      { key: 'name', label: '策略名称' },
      { key: 'revocationMode', label: '吊销校验', options: ['REQUIRED', 'DISABLED'] },
      { key: 'allowHistoricalValidation', label: '允许参考历史时间', options: ['false', 'true'] },
      { key: 'revocationSource', label: '吊销来源', options: ['CRL', 'OCSP'] },
      { key: 'ocspUrl', label: 'OCSP HTTPS 地址' },
      { key: 'crl', label: 'CRL（Base64 DER）', multiline: true }
    ]
  },
  roles: {
    kind: 'ROLE_BINDING',
    permission: 'svs:security:user:manage',
    fields: [
      { key: 'subjectId', label: '平台用户名' },
      { key: 'role', label: '产品角色', options: ['SYSADMIN', 'SECADMIN', 'AUDITOR'] }
    ]
  },
  opinions: {
    kind: 'AUDIT_OPINION',
    permission: 'svs:audit:opinion:manage',
    fields: [
      { key: 'auditId', label: '审计记录标识' },
      { key: 'opinion', label: '意见', multiline: true },
      { key: 'status', label: '跟踪状态', options: ['OPEN', 'FOLLOWING', 'CLOSED'] }
    ]
  }
};
const kind = computed(() => configuration[props.page]?.kind);
const fields = computed(() => {
  const selected = configuration[props.page];
  return selected
    ? [...selected.fields, ...(selected.kind === 'AUDIT_OPINION' ? [] : [{ key: 'enabled', label: '状态', options: ['true', 'false'] }])]
    : [];
});
const identity = ref<api.Session>();
const has = (permission: string) => identity.value?.permissions.includes(permission) === true;
const canWrite = computed(() => props.page !== 'roles' && props.mutable && has(configuration[props.page]?.permission || ''));
const loading = ref(false),
  saving = ref(false),
  dialog = ref(false),
  details = ref(false);
const error = ref(''),
  reason = ref(''),
  operation = ref(''),
  result = ref('');
const pageNumber = ref(1),
  total = ref(0);
const rows = ref<api.Resource[]>([]),
  approvalRows = ref<api.Approval[]>([]),
  auditRows = ref<api.AuditRow[]>([]);
const runtimeData = ref<Record<string, unknown>>({}),
  metricRows = ref<Record<string, unknown>[]>([]),
  detailRows = ref<Record<string, unknown>[]>([]);
const runtimeLabels: Record<string, string> = {
  state: '设备状态',
  code: '状态代码',
  message: '说明',
  deviceState: '设备状态',
  reasonCode: '状态代码',
  reason: '说明'
};
const auditColumns = [
  { key: 'id', label: '记录标识' },
  { key: 'time', label: '时间' },
  { key: 'user', label: '操作人' },
  { key: 'operation', label: '操作' },
  { key: 'result', label: '结果' },
  { key: 'objectName', label: '对象' },
  { key: 'message', label: '说明' }
];
const draft = ref<api.Resource>({ id: '', kind: 'APPLICATION', version: 0, fields: {} });
function edit(row?: api.Resource) {
  draft.value = row
    ? structuredClone(row)
    : {
        id: kind.value === 'POLICY' ? 'validation' : kind.value === 'KEY_REFERENCE' ? crypto.randomUUID().replaceAll('-', '') : '',
        kind: kind.value!,
        version: 0,
        fields: kind.value === 'AUDIT_OPINION' ? {} : { enabled: 'true' }
      };
  reason.value = '';
  dialog.value = true;
}
async function load() {
  loading.value = true;
  error.value = '';
  try {
    identity.value = await api.session();
    if (props.page === 'bindings') await bindingPanel.value?.load();
    if (kind.value && props.page !== 'bindings') {
      const data = await api.resources(kind.value, pageNumber.value);
      rows.value = data.rows;
      total.value = data.total;
    } else if (props.page === 'approvals') {
      const data = await api.approvals(pageNumber.value);
      approvalRows.value = data.rows;
      total.value = data.total;
    } else if (props.page === 'audit') {
      const data = await api.audit(pageNumber.value, operation.value, result.value);
      auditRows.value = data.rows;
      total.value = data.total;
    } else if (props.page === 'runtime') {
      runtimeData.value = await api.runtime();
      if (identity.value.role === 'SYSADMIN') metricRows.value = (await api.metrics()).counts;
    }
  } catch {
    error.value = '加载失败，请检查权限或服务状态后重试。';
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (!draft.value.id || !reason.value.trim()) {
    ElMessage.warning('请填写标识和变更原因');
    return;
  }
  try {
    await ElMessageBox.confirm(`确认提交 ${draft.value.id} 的配置变更？保存后立即生效。`, '变更确认');
  } catch {
    return;
  }
  saving.value = true;
  try {
    await api.maintain(draft.value, reason.value.trim());
    ElMessage.success('保存成功');
    dialog.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
async function showDiagnostics(row: api.Resource) {
  detailRows.value = [await api.diagnostics(row.id)];
  details.value = true;
}
async function showHistory(row: api.Resource) {
  const versions = await api.history(row.kind, row.id);
  detailRows.value = versions.map((version) => ({ 标识: version.id, 版本: version.version, ...version.fields }));
  details.value = true;
}
const approvalState = (state: string) =>
  (
    ({ PENDING: '待审批（历史）', APPROVED: '已批准（历史）', CANCELLED: '已终止（迁移）', EXECUTED: '已执行', REJECTED: '已拒绝' }) as Record<
      string,
      string
    >
  )[state] || state;
async function approvalDetail(row: api.Approval) {
  const versions = await api.history(row.proposed.kind, row.proposed.id);
  const current = versions.find((version) => version.version === row.proposed.version);
  detailRows.value = [
    { 变更阶段: '申请时原值', 版本: row.proposed.version, ...(current?.fields || { 状态: '新建对象' }) },
    {
      变更阶段: '申请变更值',
      对象: row.proposed.id,
      对象版本: row.proposed.version,
      申请人: row.applicant,
      审批人: row.approver,
      原因: row.reason,
      状态: row.state,
      有效期: row.expiresAt,
      ...row.proposed.fields
    }
  ];
  details.value = true;
}
function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
async function downloadAudit() {
  download(await api.exportAudit(operation.value, result.value), 'svs-audit.csv');
}
async function downloadBackup() {
  download(new Blob([JSON.stringify(await api.backup(), null, 2)], { type: 'application/json' }), 'svs-public-config.json');
}
watch(
  () => props.page,
  () => {
    pageNumber.value = 1;
    void load();
  }
);
onMounted(async () => {
  if (props.page === 'audit') {
    operation.value = typeof route.query.operation === 'string' ? route.query.operation : '';
    result.value = typeof route.query.result === 'string' ? route.query.result : '';
  }
  await load();
  if (props.page === 'approvals' && typeof route.query.id === 'string') {
    try {
      const requested = await api.approval(route.query.id);
      if (!approvalRows.value.some((row) => row.id === requested.id)) approvalRows.value.unshift(requested);
      await approvalDetail(requested);
    } catch {
      error.value = '无法读取该申请，请检查权限或申请状态。';
    }
  }
});
</script>
<style scoped>
.svs-page {
  padding: 20px;
  font-size: 14px;
}
.heading,
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.heading {
  justify-content: space-between;
}
h1 {
  font-size: 20px;
  margin: 0;
}
.toolbar > .el-input,
.toolbar > .el-select {
  width: 180px;
}
.toolbar > span {
  color: var(--el-text-color-secondary);
}
.el-pagination,
.el-descriptions,
.el-alert {
  margin-bottom: 16px;
}
.el-pagination {
  margin-top: 16px;
}
</style>
