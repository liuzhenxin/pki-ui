<template>
  <div class="app-container ocsp-page">
    <el-card shadow="hover" class="mb16">
      <div class="card-header">
        <span>CA 数据源（按 CA 独立配置，未配置的 CA 使用默认数据源）</span>
        <div>
          <el-button icon="Refresh" @click="getList">刷新</el-button>
          <el-button v-hasPermi="['ocsp:source:save']" type="primary" plain icon="Plus" @click="openEdit()">新建</el-button>
        </div>
      </div>
    </el-card>

    <RoutingHistoryPanel />
    <CanaryPanel />

    <el-card shadow="hover">
      <el-alert
        v-if="probeResult"
        :title="probeResult.ok ? '探测成功' : '探测失败（仍可保存）'"
        :type="probeResult.ok ? 'success' : 'error'"
        :description="probeResult.message"
        show-icon
        :closable="false"
        class="mb16"
      />
      <el-table v-loading="loading" :data="rows" border>
        <template #empty>
          <el-empty description="暂无 CA 数据源配置" />
        </template>
        <el-table-column prop="caId" label="CA ID" width="90" />
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 'LDAP' ? 'warning' : 'primary'" size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled === false ? 'info' : 'success'" size="small">{{ row.enabled === false ? '停用' : '启用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="hasDbSource" label="证书表 / 归档表" min-width="200">
          <template #default="{ row }">
            <span v-if="row.type === 'DB'"
              >{{ row.db?.certTable || '-' }}<span v-if="row.db?.archiveCertTable"> / {{ row.db.archiveCertTable }}</span></span
            >
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column v-if="hasLdapSource" label="LDAP 地址" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.type === 'LDAP'">{{ row.ldap?.url || '-' }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" min-width="160" />
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button v-hasPermi="['ocsp:source:save']" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-hasPermi="['ocsp:source:probe']" link type="success" :loading="probingCaId === row.caId" @click="probe(row.caId)"
              >探测</el-button
            >
            <el-button v-hasPermi="['ocsp:source:save']" link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="editVisible" :title="form.caId ? `编辑 CA ${form.caId} 数据源` : '新建 CA 数据源'" size="760px">
      <el-form :model="form" label-width="150px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="CA ID" required>
              <el-input-number
                v-model="form.caId"
                :min="1"
                :disabled="editing"
                controls-position="right"
                class="w-full"
                placeholder="对应 CA 根 CA ID"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="名称">
              <el-input v-model="form.name" placeholder="留空按 CA-{id} 命名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="数据源类型">
          <el-segmented v-model="form.type" :options="['DB', 'LDAP']" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-divider content-position="left">DB（只读直连 CA 库）</el-divider>
        <el-button v-if="form.type === 'DB'" size="small" plain @click="fillCaDbTemplate">填入 CA 默认模板(ca_cert/ca_archive_cert)</el-button>
        <template v-if="form.type === 'DB'">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="连接 URL" required>
                <el-input v-model="form.db.url" placeholder="jdbc:mysql://host:3306/lcloud_ca" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="用户名" required>
                <el-input v-model="form.db.username" placeholder="只读账号" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="密码引用" required>
            <el-input v-model="form.db.passwordRef" placeholder="环境变量名，如 ocsp/ca/10/db-password" />
          </el-form-item>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="证书表">
                <el-input v-model="form.db.certTable" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="归档证书表">
                <el-input v-model="form.db.archiveCertTable" placeholder="吊销记录移入的表，如 ca_archive_cert；空=不查" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="序列号字段">
                <el-input v-model="form.db.serialNumberColumn" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="CA 字段">
                <el-input v-model="form.db.caIdColumn" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="状态字段">
                <el-input v-model="form.db.statusColumn" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="是否吊销字段">
                <el-input v-model="form.db.isRevokedColumn" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="吊销时间字段">
                <el-input v-model="form.db.revocationTimeColumn" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="吊销原因字段">
                <el-input v-model="form.db.revocationReasonColumn" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="生效时间字段">
                <el-input v-model="form.db.notBeforeColumn" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="失效时间字段">
                <el-input v-model="form.db.notAfterColumn" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="删除标识字段">
                <el-input v-model="form.db.delFlagColumn" placeholder="空=不过滤" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>
        <el-divider v-else content-position="left">LDAP / AD</el-divider>
        <template v-if="form.type === 'LDAP'">
          <el-form-item label="LDAP 地址" required>
            <el-input v-model="form.ldap.url" placeholder="ldap://ad.example.com:389 或 ldaps://..." />
          </el-form-item>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="Base DN" required>
                <el-input v-model="form.ldap.baseDn" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="Bind DN" required>
                <el-input v-model="form.ldap.bindDn" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="密码引用" required>
            <el-input v-model="form.ldap.passwordRef" placeholder="环境变量名" />
          </el-form-item>
          <el-form-item label="搜索过滤器" required>
            <el-input
              v-model="form.ldap.searchFilter"
              placeholder="(&(objectClass=pkiCertificate)(certificateSerialNumber={serialNumber})(caId={caId}))"
            />
          </el-form-item>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="序列号属性">
                <el-input v-model="form.ldap.serialNumberAttribute" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="CA 属性">
                <el-input v-model="form.ldap.caIdAttribute" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="状态属性">
                <el-input v-model="form.ldap.statusAttribute" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="吊销时间属性">
                <el-input v-model="form.ldap.revocationTimeAttribute" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="吊销原因属性">
                <el-input v-model="form.ldap.revocationReasonAttribute" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="连接超时(ms)">
                <el-input-number v-model="form.ldap.connectTimeout" :min="0" controls-position="right" class="w-full" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="读取超时(ms)">
                <el-input-number v-model="form.ldap.readTimeout" :min="0" controls-position="right" class="w-full" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button v-hasPermi="['ocsp:source:probe']" :loading="probing" :disabled="!form.caId" @click="probe(form.caId!)">保存前探测</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup name="OcspCaSource" lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { listOcspCaStatusSources, probeOcspCaStatusSource, removeOcspCaStatusSource, saveOcspCaStatusSource } from '@/api/ocsp/caSource';
import RoutingHistoryPanel from '@/views/ocsp/components/RoutingHistoryPanel.vue';
import CanaryPanel from '@/views/ocsp/components/CanaryPanel.vue';
import type { OcspProbe, OcspStatusSource } from '@/api/ocsp/types';

const CA_DB_TEMPLATE = {
  certTable: 'ca_cert',
  archiveCertTable: 'ca_archive_cert',
  serialNumberColumn: 'serial_number',
  caIdColumn: 'root_id',
  statusColumn: 'cert_status',
  isRevokedColumn: 'is_revoked',
  revocationTimeColumn: 'revocation_time',
  revocationReasonColumn: 'revocation_reason',
  notBeforeColumn: 'not_before',
  notAfterColumn: 'not_after',
  delFlagColumn: 'del_flag'
};

const loading = ref(false);
const saving = ref(false);
const probing = ref(false);
const probingCaId = ref<number | null>(null);
const rows = ref<OcspStatusSource[]>([]);
const editVisible = ref(false);
const editing = ref(false);
const probeResult = ref<OcspProbe | null>(null);
const hasDbSource = computed(() => rows.value.some((row) => row.type === 'DB'));
const hasLdapSource = computed(() => rows.value.some((row) => row.type === 'LDAP'));

const defaultDb = () => ({ ...CA_DB_TEMPLATE });
const defaultLdap = () => ({
  url: '',
  baseDn: '',
  bindDn: '',
  passwordRef: '',
  searchFilter: '(&(objectClass=pkiCertificate)(certificateSerialNumber={serialNumber})(caId={caId}))',
  serialNumberAttribute: 'certificateSerialNumber',
  caIdAttribute: 'caId',
  statusAttribute: 'certificateStatus',
  revocationTimeAttribute: 'revocationTime',
  revocationReasonAttribute: 'revocationReason',
  connectTimeout: 3000,
  readTimeout: 5000
});

const newForm = () => ({
  caId: undefined as number | undefined,
  name: '',
  type: 'DB' as 'DB' | 'LDAP',
  enabled: true,
  db: defaultDb(),
  ldap: defaultLdap()
});
const form = reactive<OcspStatusSource & { db: any; ldap: any }>(newForm());

const getList = async () => {
  loading.value = true;
  try {
    rows.value = (await listOcspCaStatusSources()) || [];
  } finally {
    loading.value = false;
  }
};

const openEdit = (row?: OcspStatusSource) => {
  editing.value = !!row;
  Object.assign(form, newForm());
  if (row) {
    Object.assign(form, row);
    form.db = { ...defaultDb(), ...(row.db || {}) };
    form.ldap = { ...defaultLdap(), ...(row.ldap || {}) };
    form.enabled = row.enabled ?? true;
  }
  probeResult.value = null;
  editVisible.value = true;
};

const fillCaDbTemplate = () => {
  Object.assign(form.db, { ...defaultDb(), url: form.db.url, username: form.db.username, passwordRef: form.db.passwordRef });
};

const validateForm = (): string => {
  if (!form.caId || form.caId <= 0) {
    return '请输入 CA ID';
  }
  if (form.type === 'DB') {
    if (!form.db.url || !form.db.username || !form.db.passwordRef) {
      return 'DB 数据源必须配置连接 URL、用户名和密码引用';
    }
  } else {
    if (!form.ldap.url || !form.ldap.baseDn || !form.ldap.bindDn || !form.ldap.passwordRef || !form.ldap.searchFilter) {
      return 'LDAP 数据源必须配置 URL、Base DN、Bind DN、密码引用和搜索过滤器';
    }
  }
  return '';
};

const submit = async () => {
  const error = validateForm();
  if (error) {
    ElMessage.error(error);
    return;
  }
  saving.value = true;
  try {
    await saveOcspCaStatusSource(form);
    ElMessage.success('保存成功');
    editVisible.value = false;
    probeResult.value = null;
    await getList();
  } finally {
    saving.value = false;
  }
};

const probe = async (caId: number) => {
  if (!caId) {
    return;
  }
  probing.value = true;
  probingCaId.value = caId;
  try {
    const result = await probeOcspCaStatusSource(caId);
    probeResult.value = result;
    if (!result.ok) {
      ElMessage.warning(result.message || '探测失败');
    }
  } finally {
    probing.value = false;
    probingCaId.value = null;
  }
};

const remove = async (row: OcspStatusSource) => {
  await ElMessageBox.confirm(`确认删除 CA ${row.caId} 的数据源？删除后该 CA 回退使用默认数据源。`, '删除确认', {
    type: 'warning'
  });
  await removeOcspCaStatusSource(row.caId!);
  ElMessage.success('已删除');
  await getList();
};

onMounted(getList);
</script>

<style scoped>
.ocsp-page {
  padding: 16px;
}
.mb16 {
  margin-bottom: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.w-full {
  width: 100%;
}
</style>
