<template>
  <el-card shadow="never">
    <el-space wrap>
      <input ref="picker" hidden type="file" accept=".zip,application/zip" @change="selectArchive" />
      <el-button :disabled="busy" @click="picker?.click()">选择 PFX 压缩包</el-button>
      <span v-if="archive">{{ archive.name }}</span>
      <el-button type="primary" :disabled="!archive || busy" :loading="checking" @click="runPreview">预检</el-button>
      <el-button type="success" :disabled="!archive || !preview?.eligible || busy" :loading="importing" @click="confirmImport">确认导入</el-button>
    </el-space>
    <el-alert class="legacy-help" title="上传说明" type="info" :closable="false" show-icon>
      <div>上传无需解压密码的 ZIP，包内只放 .pfx 文件。单批最多 50 份，ZIP 不超过 20 MB。</div>
      <div>序列号使用十六进制，须与证书内一致，最后一段填写 PFX 密码。</div>
      <div>支持的文件名格式</div>
      <div><code>证书序列号_域账号_PFX密码.pfx</code></div>
      <div><code>域账号_证书序列号_PFX密码.pfx</code></div>
    </el-alert>

    <el-alert v-if="lastResult" class="legacy-result" type="success" :closable="false" show-icon>
      <template #title
        >导入 {{ lastResult.imported }} 份，补绑 {{ lastResult.rebound }} 份<span v-if="lastResult.repaired">，更新 {{ lastResult.repaired }} 份</span
        ><span v-if="lastResult.batchNo">（批次 {{ lastResult.batchNo }}）</span></template
      >
    </el-alert>

    <template v-if="preview">
      <div class="legacy-summary">
        <span
          >预检共 {{ preview.total }} 份<span v-if="!lastResult">，可写入 {{ preview.eligible }} 份</span></span
        >
        <el-tag v-for="(count, status) in preview.counts" :key="status" effect="plain">{{ statusLabel(status) }} {{ count }}</el-tag>
      </div>
      <el-select v-model="previewFilter" clearable placeholder="全部预检结果" class="legacy-filter" @change="previewPage = 1">
        <el-option v-for="status in Object.keys(preview.counts)" :key="status" :value="status" :label="statusLabel(status)" />
      </el-select>
      <el-table :data="visiblePreviewRows" row-key="number" border>
        <el-table-column prop="number" label="文件顺序" width="96" />
        <el-table-column prop="serial" label="序列号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="account" label="域账号" min-width="130" />
        <el-table-column label="预检结果" width="132">
          <template #default="{ row }">{{ statusLabel(row.status) }}</template>
        </el-table-column>
        <el-table-column prop="message" label="说明" min-width="225" show-overflow-tooltip />
      </el-table>
      <el-pagination
        v-if="filteredPreviewRows.length > previewPageSize"
        v-model:current-page="previewPage"
        :page-size="previewPageSize"
        :total="filteredPreviewRows.length"
        layout="prev, pager, next, total"
      />
    </template>

    <el-divider content-position="left">已导入存量证书</el-divider>
    <el-space wrap class="legacy-filter">
      <el-select v-model="ledgerFilter" clearable placeholder="全部归属" style="width: 160px" @change="filterLedger">
        <el-option v-for="status in ledgerStatuses" :key="status" :value="status" :label="statusLabel(status)" />
      </el-select>
      <el-button :loading="ledgerLoading" @click="loadLedger">刷新</el-button>
    </el-space>
    <el-table v-loading="ledgerLoading" :data="ledgerRows" row-key="id" border empty-text="暂无存量证书">
      <el-table-column prop="account" label="域账号" min-width="115" />
      <el-table-column prop="employeeName" label="员工" min-width="100">
        <template #default="{ row }">{{ row.status === 'UNMATCHED' ? '—' : row.employeeName }}</template>
      </el-table-column>
      <el-table-column prop="serial" label="序列号" min-width="145" show-overflow-tooltip />
      <el-table-column label="归属" width="142">
        <template #default="{ row }">{{ statusLabel(row.status) }}</template>
      </el-table-column>
      <el-table-column prop="notAfter" label="到期日期" width="120">
        <template #default="{ row }">{{ row.notAfter?.slice(0, 10) || '—' }}</template>
      </el-table-column>
      <el-table-column prop="batchNo" label="导入批次" min-width="125" show-overflow-tooltip />
      <el-table-column prop="message" label="说明" min-width="170" show-overflow-tooltip />
    </el-table>
    <el-pagination
      v-if="ledgerTotal > 30"
      v-model:current-page="ledgerPage"
      :page-size="30"
      :total="ledgerTotal"
      layout="prev, pager, next, total"
      @current-change="loadLedger"
    />
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  importLegacyEmployeeCerts,
  pageLegacyEmployeeCerts,
  previewLegacyEmployeeCerts,
  type LegacyImportResult,
  type LegacyLedgerRow,
  type LegacyPreview
} from '@/api/ra/legacyEmployeeCert';

const picker = ref<HTMLInputElement>();
const archive = ref<File>();
const preview = ref<LegacyPreview>();
const lastResult = ref<LegacyImportResult>();
const checking = ref(false);
const importing = ref(false);
const busy = computed(() => checking.value || importing.value);
const previewFilter = ref('');
const previewPage = ref(1);
const previewPageSize = 30;
const ledgerFilter = ref('');
const ledgerPage = ref(1);
const ledgerLoading = ref(false);
const ledgerRows = ref<LegacyLedgerRow[]>([]);
const ledgerTotal = ref(0);
const ledgerStatuses = ['READY', 'LEFT', 'UNMATCHED', 'INACTIVE'];
let ledgerRequest = 0;
const labels: Record<string, string> = {
  READY: '已匹配员工',
  LEFT: '已有离职档案',
  UNMATCHED: '员工归属待核对',
  REVIEW: '待核对归属',
  INACTIVE: '停用或在职待确认',
  EXISTING: '已有证书',
  REPAIR: '更新证书文件',
  INVALID: '文件异常',
  CONFLICT: '序列号冲突',
  ISSUER: '签发 CA 待配置'
};

const statusLabel = (status: string) => labels[status] || status;
const filteredPreviewRows = computed(() => {
  const rows = preview.value?.rows || [];
  return previewFilter.value ? rows.filter((row) => row.status === previewFilter.value) : rows;
});
const visiblePreviewRows = computed(() => {
  const offset = (previewPage.value - 1) * previewPageSize;
  return filteredPreviewRows.value.slice(offset, offset + previewPageSize);
});

function selectArchive(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!/\.zip$/i.test(file.name) || file.size > 20 * 1024 * 1024) {
    ElMessage.warning('请选择 20 MB 以内的 ZIP 文件');
    return;
  }
  archive.value = file;
  preview.value = undefined;
  lastResult.value = undefined;
}

async function runPreview() {
  if (!archive.value || busy.value) return;
  checking.value = true;
  preview.value = undefined;
  lastResult.value = undefined;
  previewFilter.value = '';
  previewPage.value = 1;
  try {
    const response = await previewLegacyEmployeeCerts(archive.value);
    preview.value = response.data;
  } catch {
    // The request interceptor displays the server's error.
  } finally {
    checking.value = false;
  }
}

async function confirmImport() {
  const file = archive.value;
  const result = preview.value;
  if (!file || !result?.eligible || busy.value) return;
  importing.value = true;
  try {
    await ElMessageBox.confirm(`本批将写入或补绑 ${result.eligible} 份证书。离职和待核对记录可在下方筛选。`, '确认导入员工存量证书', {
      confirmButtonText: '确认导入',
      cancelButtonText: '取消',
      type: 'warning'
    });
    const response = await importLegacyEmployeeCerts(file, result.token);
    lastResult.value = response.data;
    archive.value = undefined;
    ledgerFilter.value = '';
    ledgerPage.value = 1;
    await loadLedger();
  } catch {
    // Cancel keeps the preview available. The request interceptor handles API errors.
  } finally {
    importing.value = false;
  }
}

async function loadLedger() {
  const id = ++ledgerRequest;
  ledgerLoading.value = true;
  try {
    const response = await pageLegacyEmployeeCerts(ledgerPage.value, ledgerFilter.value);
    if (id === ledgerRequest) {
      ledgerRows.value = response.data?.records || [];
      ledgerTotal.value = Number(response.data?.total || 0);
    }
  } catch {
    // The request interceptor displays the server's error.
  } finally {
    if (id === ledgerRequest) ledgerLoading.value = false;
  }
}

function filterLedger() {
  ledgerPage.value = 1;
  void loadLedger();
}

onMounted(loadLedger);
</script>

<style scoped>
.legacy-help {
  color: var(--el-text-color-secondary);
  margin: 12px 0 16px;
}

.legacy-result,
.legacy-filter,
.legacy-summary {
  margin-bottom: 12px;
}

.legacy-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.el-pagination {
  margin-top: 12px;
}
</style>
