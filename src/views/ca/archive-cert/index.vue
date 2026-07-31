<template>
  <div class="app-container archive-cert-page">
    <el-form :model="queryParams" ref="queryForm" :inline="true" v-show="showSearch" label-width="82px">
      <el-form-item label="证书主题" prop="subject">
        <el-input v-model="queryParams.subject" placeholder="请输入证书主题" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="序列号" prop="serialNumber">
        <el-input v-model="queryParams.serialNumber" placeholder="请输入序列号" clearable style="width: 220px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="归档原因" prop="archiveReason">
        <el-select v-model="queryParams.archiveReason" placeholder="请选择归档原因" clearable style="width: 160px">
          <el-option label="已过期" value="EXPIRED" />
          <el-option label="已注销" value="REVOKED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" :disabled="multiple" @click="handleExport" v-hasPermi="['ca:archive-cert:export']">
          导出
        </el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="archiveCertList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="序列号" align="center" prop="serialNumber" width="150" :show-overflow-tooltip="true" />
      <el-table-column label="颁发者" align="center" prop="issuer" min-width="180" :show-overflow-tooltip="true" />
      <el-table-column label="主题" align="center" prop="subject" min-width="220" :show-overflow-tooltip="true" />
      <el-table-column label="证书类型" align="center" prop="certType" width="120">
        <template #default="scope">
          <el-tag type="info">{{ getCertTypeLabel(scope.row.certType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="归档原因" align="center" prop="archiveReason" width="110">
        <template #default="scope">
          <el-tag :type="scope.row.archiveReason === 'REVOKED' ? 'danger' : 'warning'">{{ getArchiveReasonLabel(scope.row.archiveReason) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="归档时间" align="center" prop="archiveTime" width="170" />
      <el-table-column label="有效期结束" align="center" prop="notAfter" width="170" />
      <el-table-column label="操作" align="center" width="160" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="handleView(scope.row)" v-hasPermi="['ca:archive-cert:detail']">详情</el-button>
          <el-button link type="primary" icon="Download" @click="handleDownload(scope.row)" v-hasPermi="['ca:archive-cert:download']">下载</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog v-model="showDetail" title="归档证书详情" width="60%" append-to-body>
      <X509Cert v-if="showDetail" :certPem="currentCertPem" />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showDetail = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ArchiveCertManagement" lang="ts">
import { ComponentInternalInstance, getCurrentInstance, onMounted, reactive, ref, toRefs } from 'vue';
import { ElMessage } from 'element-plus';
import { X509 } from 'jsrsasign';
import X509Cert from '@/components/X509Cert/index.vue';
import { exportArchiveCert, pageArchiveCert } from '@/api/ca/archiveCert';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const archiveCertList = ref<any[]>([]);
const ids = ref<Array<string | number>>([]);
const multiple = ref(true);
const showDetail = ref(false);
const currentCertPem = ref('');

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    subject: undefined as string | undefined,
    serialNumber: undefined as string | undefined,
    archiveReason: undefined as string | undefined
  }
});

const { queryParams } = toRefs(data);

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  proxy?.resetForm('queryForm');
  handleQuery();
}

function handleSelectionChange(selection: any[]) {
  ids.value = selection.map((item) => item.id);
  multiple.value = !selection.length;
}

function handleView(row: any) {
  currentCertPem.value = row.cert || '';
  showDetail.value = true;
}

function handleDownload(row: any) {
  const pem = row.cert || '';
  if (!pem) {
    ElMessage.error('证书内容为空');
    return;
  }
  downloadPem(pem, row.serialNumber || 'archive-cert');
}

function downloadPem(pem: string, filename: string) {
  const blob = new Blob([pem], { type: 'application/x-pem-file' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = `${filename}.crt`;
  link.click();
  window.URL.revokeObjectURL(link.href);
}

async function handleExport() {
  try {
    const res = await exportArchiveCert({
      ...queryParams.value,
      ids: ids.value
    });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(new Blob([res]));
    link.download = `archive_certs_${Date.now()}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(link.href);
  } catch (error) {
    ElMessage.error('导出失败');
  }
}

async function getList() {
  loading.value = true;
  try {
    const pageNum = Number(queryParams.value.pageNum) || 1;
    const pageSize = Number(queryParams.value.pageSize) || 10;
    const res = await pageArchiveCert({
      ...queryParams.value,
      pageNum,
      pageSize,
      pageIndex: (pageNum - 1) * pageSize
    });
    const rawList = res.data?.rows || res.data?.records || [];
    total.value = res.data?.total || 0;
    archiveCertList.value = rawList.map((item: any) => {
      const info = parseCertInfo(item.cert);
      return {
        ...item,
        ...info,
        subject: formatDn(item.subject || info?.subject),
        serialNumber: item.serialNumber || info?.serialNumber,
        notAfter: item.notAfter || info?.notAfter
      };
    });
  } catch (error) {
    ElMessage.error('获取归档证书列表失败');
  } finally {
    loading.value = false;
  }
}

function parseCertInfo(certPem: string) {
  if (!certPem) return null;
  const x509 = new X509();
  try {
    x509.readCertPEM(certPem);
    return {
      issuer: formatDn(x509.getIssuerString()),
      subject: formatDn(x509.getSubjectString()),
      notAfter: formatX509Date(x509.getNotAfter()),
      serialNumber: x509.getSerialNumberHex().toUpperCase()
    };
  } catch {
    return null;
  }
}

function formatX509Date(zStr: string): string {
  if (!zStr) return '-';
  try {
    let y;
    let m;
    let d;
    let h;
    let min;
    let s;
    if (zStr.length === 13) {
      y = '20' + zStr.substring(0, 2);
      m = parseInt(zStr.substring(2, 4)) - 1;
      d = zStr.substring(4, 6);
      h = zStr.substring(6, 8);
      min = zStr.substring(8, 10);
      s = zStr.substring(10, 12);
    } else {
      y = zStr.substring(0, 4);
      m = parseInt(zStr.substring(4, 6)) - 1;
      d = zStr.substring(6, 8);
      h = zStr.substring(8, 10);
      min = zStr.substring(10, 12);
      s = zStr.substring(12, 14);
    }
    const date = new Date(Date.UTC(Number(y), m, Number(d), Number(h), Number(min), Number(s)));
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return zStr;
  }
}

function formatDn(value?: string) {
  if (!value) return '-';
  const text = String(value).trim();
  if (!text) return '-';
  if (text.startsWith('/')) {
    return text
      .slice(1)
      .split('/')
      .filter(Boolean)
      .join(',');
  }
  return text.replace(/\s*,\s*/g, ',');
}

function getCertTypeLabel(certType?: string) {
  switch (certType) {
    case 'RootCA':
    case 'ROOT_CA':
      return '根CA';
    case 'SubCA':
    case 'IntermediateCA':
    case 'SUB_CA':
      return '子CA';
    case 'EndEntity':
    case 'END_ENTITY':
      return '终端实体';
    default:
      return certType || '-';
  }
}

function getArchiveReasonLabel(reason?: string) {
  if (reason === 'REVOKED') return '已注销';
  if (reason === 'EXPIRED') return '已过期';
  return reason || '-';
}

onMounted(() => {
  getList();
});
</script>

<style scoped>
.archive-cert-page :deep(.el-table .cell) {
  line-height: 1.4;
}
</style>
