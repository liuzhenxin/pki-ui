<template>
  <div class="app-container ocsp-page">
    <el-card shadow="hover" class="mb16">
      <el-form :inline="true" :model="query">
        <el-form-item label="时间">
          <el-date-picker
            v-model="timeRange"
            type="datetimerange"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="序列号">
          <el-input v-model="query.certSerialNumber" clearable />
        </el-form-item>
        <el-form-item label="证书状态">
          <el-select v-model="query.certStatus" clearable style="width: 140px">
            <el-option label="GOOD" value="GOOD" />
            <el-option label="REVOKED" value="REVOKED" />
            <el-option label="UNKNOWN" value="UNKNOWN" />
          </el-select>
        </el-form-item>
        <el-form-item label="响应状态">
          <el-input v-model="query.responseStatus" clearable style="width: 160px" />
        </el-form-item>
        <el-form-item label="CA ID">
          <el-input-number v-model="query.caId" :min="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="响应者">
          <el-input-number v-model="query.responderId" :min="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="客户端 IP">
          <el-input v-model="query.clientIp" clearable />
        </el-form-item>
        <el-form-item label="Nonce">
          <el-select v-model="query.hasNonce" clearable style="width: 120px">
            <el-option label="有" :value="true" />
            <el-option label="无" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          <el-button v-hasPermi="['ocsp:log:export']" type="success" plain icon="Download" @click="handleExport">导出 CSV</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="hover">
      <el-table v-loading="loading" :data="rows" border>
        <template #empty>
          <el-empty description="暂无请求日志" />
        </template>
        <el-table-column prop="requestTime" label="请求时间" min-width="170" />
        <el-table-column prop="certSerialNumber" label="序列号" min-width="140" />
        <el-table-column prop="certStatus" label="证书状态" width="110" />
        <el-table-column prop="responseStatus" label="响应状态" width="150" />
        <el-table-column prop="caId" label="CA ID" width="90" />
        <el-table-column prop="responderId" label="响应者" width="90" />
        <el-table-column prop="clientIp" label="客户端 IP" min-width="130" />
        <el-table-column label="耗时(ms)" width="100">
          <template #default="{ row }">{{ durationMs(row) }}</template>
        </el-table-column>
        <el-table-column label="Nonce" width="80">
          <template #default="{ row }">{{ row.hasNonce ? '有' : '无' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="total > 0" v-model:page="query.pageNum" v-model:limit="query.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <el-drawer v-model="detailVisible" title="请求日志详情" size="480px">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="请求时间">{{ detail.requestTime }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ detail.certSerialNumber }}</el-descriptions-item>
        <el-descriptions-item label="证书状态">{{ detail.certStatus }}</el-descriptions-item>
        <el-descriptions-item label="响应状态">{{ detail.responseStatus }}</el-descriptions-item>
        <el-descriptions-item label="CA ID">{{ detail.caId }}</el-descriptions-item>
        <el-descriptions-item label="响应者">{{ detail.responderId }}</el-descriptions-item>
        <el-descriptions-item label="客户端 IP">{{ detail.clientIp || '-' }}</el-descriptions-item>
        <el-descriptions-item label="User-Agent">{{ detail.userAgent || '-' }}</el-descriptions-item>
        <el-descriptions-item label="Nonce">{{ detail.hasNonce ? '有' : '无' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup name="OcspRequestLog" lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { exportOcspRequestLogs, getOcspRequestLog, pageOcspRequestLogs } from '@/api/ocsp/log';
import type { OcspRequestLog, OcspRequestLogPageQry } from '@/api/ocsp/types';

const loading = ref(false);
const rows = ref<OcspRequestLog[]>([]);
const total = ref(0);
const detailVisible = ref(false);
const detail = ref<OcspRequestLog | null>(null);
const timeRange = ref<string[]>([]);
const query = reactive<OcspRequestLogPageQry>({
  pageNum: 1,
  pageSize: 20,
  certSerialNumber: '',
  certStatus: '',
  responseStatus: '',
  clientIp: '',
  hasNonce: null
});

const buildQry = (): OcspRequestLogPageQry => ({
  ...query,
  requestTimeFrom: timeRange.value?.[0],
  requestTimeTo: timeRange.value?.[1]
});

const durationMs = (row: OcspRequestLog) => {
  if (!row.requestTime || !row.responseTime) {
    return '-';
  }
  return Math.max(0, new Date(row.responseTime).getTime() - new Date(row.requestTime).getTime());
};

const getList = async () => {
  loading.value = true;
  try {
    const page = await pageOcspRequestLogs(buildQry());
    rows.value = page?.records || [];
    total.value = page?.total || 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  query.pageNum = 1;
  getList();
};

const resetQuery = () => {
  timeRange.value = [];
  query.certSerialNumber = '';
  query.certStatus = '';
  query.responseStatus = '';
  query.clientIp = '';
  query.hasNonce = null;
  query.caId = undefined;
  query.responderId = undefined;
  handleQuery();
};

const openDetail = async (id: number) => {
  detail.value = await getOcspRequestLog(id);
  detailVisible.value = true;
};

const handleExport = async () => {
  const blob = (await exportOcspRequestLogs(buildQry())) as unknown as Blob;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ocsp-request-logs.csv';
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已导出');
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
</style>
