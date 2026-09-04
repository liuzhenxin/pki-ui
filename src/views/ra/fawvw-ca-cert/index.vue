<template>
  <div class="app-container fawvw-ca-cert-page">
    <el-card shadow="never" class="query-card">
      <el-form :model="queryParams" inline>
        <el-form-item label="关键词">
          <el-input v-model="queryParams.keyword" clearable placeholder="名称、主题、序列号、指纹" style="width: 230px" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书类型">
          <el-select v-model="queryParams.certificateType" clearable placeholder="全部" style="width: 130px">
            <el-option label="根证书" value="ROOT" />
            <el-option label="中间证书" value="INTERMEDIATE" />
          </el-select>
        </el-form-item>
        <el-form-item label="有效期状态">
          <el-select v-model="queryParams.validityStatus" clearable placeholder="全部" style="width: 140px">
            <el-option label="有效" value="VALID" />
            <el-option label="30天内到期" value="EXPIRING" />
            <el-option label="已过期" value="EXPIRED" />
            <el-option label="未生效" value="NOT_YET_VALID" />
          </el-select>
        </el-form-item>
        <el-form-item label="管理状态">
          <el-select v-model="queryParams.managementStatus" clearable placeholder="全部" style="width: 120px">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-row :gutter="10" class="mb8 toolbar-row">
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:fawvw-ca-cert:sync']" plain icon="RefreshRight" @click="handleSync">同步当前RA证书</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:fawvw-ca-cert:import']" type="primary" plain icon="Upload" @click="importOpen = true">导入证书</el-button>
        </el-col>
        <right-toolbar v-model:showSearch="showSearch" @queryTable="loadList" />
      </el-row>

      <el-alert
        title="本页面是 FAW-VW 独立证书台账：同步仅读取当前 RA 根证书和证书链；导入和维护不会影响平台管理员的 CA 管理。"
        type="info"
        :closable="false"
        show-icon
        class="mb12"
      />

      <el-table v-loading="loading" :data="rows" border stripe empty-text="暂无根证书或中间证书记录">
        <el-table-column label="证书名称" prop="displayName" min-width="190" show-overflow-tooltip />
        <el-table-column label="类型" width="100" align="center">
          <template #default="{ row }"
            ><el-tag :type="row.certificateType === 'ROOT' ? 'danger' : 'warning'" effect="plain">{{
              row.certificateType === 'ROOT' ? '根证书' : '中间证书'
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="序列号" prop="serialNumber" min-width="170" show-overflow-tooltip />
        <el-table-column label="颁发者" prop="issuerDn" min-width="180" show-overflow-tooltip />
        <el-table-column label="到期时间" prop="notAfter" width="166" align="center"
          ><template #default="{ row }">{{ dateTime(row.notAfter) }}</template></el-table-column
        >
        <el-table-column label="有效期" width="112" align="center"
          ><template #default="{ row }"
            ><el-tag :type="validityTag(row.validityStatus)" effect="light">{{ row.validityStatusName }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="来源" width="100" align="center"
          ><template #default="{ row }">{{ row.sourceType === 'RA_SYNC' ? 'RA同步' : '手工导入' }}</template></el-table-column
        >
        <el-table-column label="管理状态" width="100" align="center"
          ><template #default="{ row }"
            ><el-tag :type="row.managementStatus === 'ACTIVE' ? 'success' : 'info'" effect="plain">{{
              row.managementStatus === 'ACTIVE' ? '启用' : '停用'
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="操作" fixed="right" width="112" align="center">
          <template #default="{ row }">
            <el-tooltip content="详情" placement="top"><el-button link type="primary" icon="View" @click="openDetail(row)" /></el-tooltip>
            <el-tooltip content="维护" placement="top"
              ><el-button v-hasPermi="['ra:fawvw-ca-cert:edit']" link type="primary" icon="Edit" @click="openEdit(row)"
            /></el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="loadList" />
    </el-card>

    <el-dialog v-model="importOpen" title="导入根证书及中间证书链" width="650px" append-to-body @closed="resetImport">
      <el-alert
        title="根证书文件必须是一张自签名 CA 证书；证书链可选，链中的中间证书会自动关联到该根证书。单个文件最大 5MB。"
        type="info"
        :closable="false"
        show-icon
        class="mb12"
      />
      <el-form label-width="110px">
        <el-form-item label="根证书文件" required>
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".cer,.crt,.pem"
            :on-change="(file: any) => (rootFile = file.raw)"
            :on-remove="() => (rootFile = undefined)"
            ><el-button icon="Upload">选择文件</el-button></el-upload
          >
        </el-form-item>
        <el-form-item label="证书链文件">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".cer,.crt,.pem"
            :on-change="(file: any) => (chainFile = file.raw)"
            :on-remove="() => (chainFile = undefined)"
            ><el-button icon="Upload">选择证书链</el-button></el-upload
          >
        </el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="importOpen = false">取消</el-button
        ><el-button type="primary" :loading="importing" @click="handleImport">导入</el-button></template
      >
    </el-dialog>

    <el-drawer v-model="detailOpen" title="证书详情" size="680px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="证书名称">{{ detail.displayName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书类型">{{ detail.certificateType === 'ROOT' ? '根证书' : '中间证书' }}</el-descriptions-item>
        <el-descriptions-item label="主题">{{ detail.subjectDn || '-' }}</el-descriptions-item>
        <el-descriptions-item label="颁发者">{{ detail.issuerDn || '-' }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ detail.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="SHA-256指纹">{{ detail.fingerprint || '-' }}</el-descriptions-item>
        <el-descriptions-item label="有效期">{{ dateTime(detail.notBefore) }} 至 {{ dateTime(detail.notAfter) }}</el-descriptions-item>
        <el-descriptions-item label="来源">{{ detail.sourceType === 'RA_SYNC' ? '当前RA同步' : '手工导入' }}</el-descriptions-item>
        <el-descriptions-item label="管理状态">{{ detail.managementStatus === 'ACTIVE' ? '启用' : '停用' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-drawer v-model="editOpen" title="维护证书管理信息" size="560px" append-to-body>
      <el-alert
        title="主题、序列号和有效期由证书文件解析，只读展示，避免台账信息与证书本体不一致。"
        type="info"
        :closable="false"
        show-icon
        class="mb12"
      />
      <el-form label-width="95px">
        <el-form-item label="证书名称"><el-input v-model="editForm.displayName" maxlength="200" show-word-limit /></el-form-item>
        <el-form-item label="管理状态"
          ><el-radio-group v-model="editForm.managementStatus"
            ><el-radio value="ACTIVE">启用</el-radio><el-radio value="DISABLED">停用</el-radio></el-radio-group
          ></el-form-item
        >
        <el-form-item label="备注"><el-input v-model="editForm.remark" type="textarea" :rows="4" maxlength="1000" show-word-limit /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="editOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button></template
      >
    </el-drawer>
  </div>
</template>

<script setup name="FawvwCaCert" lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  FawvwCaCertificate,
  FawvwCaCertQuery,
  getFawvwCaCertificate,
  importFawvwCaCertificate,
  pageFawvwCaCertificates,
  syncFawvwCaCertificates,
  updateFawvwCaCertificate
} from '@/api/ra/fawvwCaCert';

const rows = ref<FawvwCaCertificate[]>([]);
const loading = ref(false);
const total = ref(0);
const showSearch = ref(true);
const importOpen = ref(false);
const importing = ref(false);
const detailOpen = ref(false);
const editOpen = ref(false);
const saving = ref(false);
const detail = ref<Partial<FawvwCaCertificate>>({});
const rootFile = ref<File>();
const chainFile = ref<File>();
const editForm = reactive({
  id: undefined as string | number | undefined,
  displayName: '',
  managementStatus: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
  remark: ''
});
const queryParams = reactive<FawvwCaCertQuery>({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  certificateType: '',
  validityStatus: '',
  managementStatus: ''
});

function unwrap<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

async function loadList() {
  loading.value = true;
  try {
    const page = unwrap<any>(await pageFawvwCaCertificates(queryParams));
    rows.value = page.records || page.rows || [];
    total.value = Number(page.total || 0);
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNum = 1;
  loadList();
}
function resetQuery() {
  Object.assign(queryParams, {
    pageNum: 1,
    pageSize: queryParams.pageSize,
    keyword: '',
    certificateType: '',
    validityStatus: '',
    managementStatus: ''
  });
  loadList();
}
function resetImport() {
  rootFile.value = undefined;
  chainFile.value = undefined;
}

async function handleSync() {
  await ElMessageBox.confirm('同步仅读取当前 RA 的根证书和证书链，不会修改 CA 管理数据。确认同步？', '同步当前RA证书', { type: 'warning' });
  const result = unwrap<any>(await syncFawvwCaCertificates());
  ElMessage.success(
    `同步完成：根证书 ${result.rootCount || 0} 个，中间证书 ${result.intermediateCount || 0} 个${result.invalidCount ? `，${result.invalidCount} 条证书链解析失败` : ''}`
  );
  loadList();
}

async function handleImport() {
  if (!rootFile.value) {
    ElMessage.warning('请选择根证书文件');
    return;
  }
  const data = new FormData();
  data.append('rootCertificate', rootFile.value);
  if (chainFile.value) data.append('certificateChain', chainFile.value);
  importing.value = true;
  try {
    const result = unwrap<any>(await importFawvwCaCertificate(data));
    ElMessage.success(`导入成功，已关联 ${result.intermediateCount || 0} 张中间证书`);
    importOpen.value = false;
    loadList();
  } finally {
    importing.value = false;
  }
}

async function openDetail(row: FawvwCaCertificate) {
  detail.value = unwrap<FawvwCaCertificate>(await getFawvwCaCertificate(row.id));
  detailOpen.value = true;
}
function openEdit(row: FawvwCaCertificate) {
  Object.assign(editForm, { id: row.id, displayName: row.displayName, managementStatus: row.managementStatus, remark: row.remark || '' });
  editOpen.value = true;
}
async function saveEdit() {
  if (!editForm.id || !editForm.displayName.trim()) {
    ElMessage.warning('请输入证书名称');
    return;
  }
  saving.value = true;
  try {
    await updateFawvwCaCertificate(editForm as any);
    ElMessage.success('证书管理信息已保存');
    editOpen.value = false;
    loadList();
  } finally {
    saving.value = false;
  }
}
function dateTime(value?: string) {
  return value ? String(value).replace('T', ' ').slice(0, 19) : '-';
}
function validityTag(status?: string) {
  return ({ VALID: 'success', EXPIRING: 'warning', EXPIRED: 'danger', NOT_YET_VALID: 'info' } as Record<string, string>)[status || ''] || 'info';
}

onMounted(loadList);
</script>

<style scoped lang="scss">
.fawvw-ca-cert-page {
  .query-card {
    margin-bottom: 12px;
  }
  .toolbar-row {
    align-items: center;
  }
}
</style>
