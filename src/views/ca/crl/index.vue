<script setup name="CrlManagement" lang="ts">
import { computed, nextTick, reactive, ref, toRefs } from 'vue';
import { ElMessage } from 'element-plus';
import { getCrl, pageCrl, publishCrl } from '@/api/crl';
import { CrlPublishForm, CrlQuery } from '@/api/crl/types';
import { listRootCa } from '@/api/ca/root';
import { pagePublisher } from '@/api/ca/publisher';
import { parseTime } from '@/utils/ruoyi';

const crlList = ref<any[]>([]);
const rootList = ref<any[]>([]);
const publisherList = ref<any[]>([]);
const publishRecords = ref<any[]>([]);
const loading = ref(true);
const total = ref(0);

const publishDialog = reactive({
  visible: false,
  loading: false
});

const detailDialog = reactive({
  visible: false,
  title: 'CRL详情',
  data: {} as any
});

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as CrlQuery,
  publishForm: {
    crlId: undefined,
    publisherId: undefined
  } as CrlPublishForm
});

const { queryParams, publishForm } = toRefs(data);

function formatCrlType(row: any) {
  return Number(row.deltaCrl) === 1 || row.deltaCrl === true ? '增量CRL' : '全量CRL';
}

function getCrlTagType(row: any) {
  return Number(row.deltaCrl) === 1 || row.deltaCrl === true ? 'warning' : 'success';
}

function formatScopeLabel(scope?: number | string) {
  const scopeValue = Number(scope || 0);
  const scopeMap: Record<number, string> = {
    0: '默认',
    1: '用户证书',
    2: '二级CA'
  };
  return scopeMap[scopeValue] || `Scope ${scopeValue}`;
}

function getRootName(rootId: string | number) {
  const root = rootList.value.find((item: any) => String(item.id) === String(rootId));
  return root?.name || rootId;
}

function getPublisherName(publisherId?: string | number) {
  if (!publisherId) {
    return 'CA关联发布者';
  }
  const publisher = publisherList.value.find((item: any) => item.id === publisherId);
  return publisher?.name || publisherId;
}

function addPublishRecord(record: any) {
  publishRecords.value.unshift({
    time: parseTime(new Date(), '{h}:{i}:{s}'),
    ...record
  });
  publishRecords.value = publishRecords.value.slice(0, 10);
}

const fullCrlCount = computed(() => crlList.value.filter((item) => Number(item.deltaCrl) !== 1 && item.deltaCrl !== true).length);
const deltaCrlCount = computed(() => crlList.value.filter((item) => Number(item.deltaCrl) === 1 || item.deltaCrl === true).length);
const latestCrl = computed(() => {
  return [...crlList.value].sort((a, b) => new Date(b.thisUpdate || 0).getTime() - new Date(a.thisUpdate || 0).getTime())[0];
});

function formatTimeValue(value?: string) {
  if (!value) {
    return '-';
  }
  return parseTime(value) || value;
}

function getFreshness(row: any) {
  if (!row?.nextBefore) {
    return { label: '未知', type: 'info' };
  }
  const nextTime = new Date(row.nextBefore).getTime();
  if (Number.isNaN(nextTime)) {
    return { label: '未知', type: 'info' };
  }
  const diffHours = (nextTime - Date.now()) / 36e5;
  if (diffHours < 0) {
    return { label: '已过期', type: 'danger' };
  }
  if (diffHours <= 24) {
    return { label: '临近到期', type: 'warning' };
  }
  return { label: '有效', type: 'success' };
}

async function loadOptions() {
  try {
    const rootRes = await listRootCa({ pageNum: 1, pageSize: 200 });
    rootList.value = rootRes.data?.rows || rootRes.data?.records || [];
  } catch (_error) {
    rootList.value = [];
  }
  try {
    const publisherRes = await pagePublisher({ pageNum: 1, pageSize: 200, status: '0' });
    publisherList.value = publisherRes.data?.rows || publisherRes.data?.records || [];
  } catch (_error) {
    publisherList.value = [];
  }
}

/** 加载CRL列表 */
async function getList() {
  loading.value = true;
  try {
    const pageNum = Number(queryParams.value.pageNum) || 1;
    const pageSize = Number(queryParams.value.pageSize) || 10;
    const res = await pageCrl({
      ...queryParams.value,
      pageNum,
      pageSize,
      pageIndex: (pageNum - 1) * pageSize
    } as any);
    crlList.value = [];
    total.value = Number(res.data?.total || 0);
    await nextTick();
    crlList.value = res.data?.rows || res.data?.records || [];
  } catch (error) {
  } finally {
    loading.value = false;
  }
}

function handlePublish(row: any) {
  publishForm.value = {
    crlId: row.id,
    publisherId: undefined
  };
  detailDialog.data = row;
  publishDialog.visible = true;
}

async function submitPublish() {
  if (!publishForm.value.crlId) return;
  publishDialog.loading = true;
  try {
    await publishCrl(publishForm.value);
    addPublishRecord({
      action: '发布CRL',
      crlNo: detailDialog.data?.crlNo || publishForm.value.crlId,
      publisherName: getPublisherName(publishForm.value.publisherId),
      status: '成功',
      message: '已提交发布'
    });
    ElMessage.success('CRL发布成功');
    publishDialog.visible = false;
  } catch (error: any) {
    addPublishRecord({
      action: '发布CRL',
      crlNo: detailDialog.data?.crlNo || publishForm.value.crlId,
      publisherName: getPublisherName(publishForm.value.publisherId),
      status: '失败',
      message: error.response?.data?.msg || error.message || 'CRL发布失败'
    });
    ElMessage.error(error.response?.data?.msg || error.message || 'CRL发布失败');
  } finally {
    publishDialog.loading = false;
  }
}

async function handleDetail(row: any) {
  try {
    const res = await getCrl(row.id);
    detailDialog.data = res.data || row;
  } catch (error) {
    detailDialog.data = row;
  }
  detailDialog.title = `CRL详情 - ${detailDialog.data.crlNo || row.id}`;
  detailDialog.visible = true;
}

loadOptions();
getList();
</script>

<template>
  <div class="p-2 crl-page">
    <el-row :gutter="12" class="mb-10px">
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="metric-tile">
          <div class="metric-label">根CA数量</div>
          <div class="metric-value">{{ rootList.length }}</div>
          <div class="metric-note">{{ rootList.length }} 个可用根CA</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="metric-tile">
          <div class="metric-label">CRL记录</div>
          <div class="metric-value">{{ total }}</div>
          <div class="metric-note">当前列表记录总数</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="metric-tile">
          <div class="metric-label">本页类型</div>
          <div class="metric-value">{{ fullCrlCount }} / {{ deltaCrlCount }}</div>
          <div class="metric-note">全量 / 增量</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="metric-tile">
          <div class="metric-label">最新CRL</div>
          <div class="metric-value">{{ latestCrl?.crlNo || '-' }}</div>
          <div class="metric-note">{{ latestCrl ? formatTimeValue(latestCrl.thisUpdate) : '暂无签发记录' }}</div>
        </div>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header>
        <div class="table-toolbar">
          <div class="toolbar-actions">
            <span class="toolbar-note">CRL 由根证书管理中的 CRL 配置和签发线程生成</span>
          </div>
          <el-button icon="Refresh" @click="getList">刷新</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="crlList" stripe>
        <el-table-column label="CRL编号" prop="crlNo" min-width="150" :show-overflow-tooltip="true">
          <template #default="scope">
            <span class="mono-text">{{ scope.row.crlNo || scope.row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="根CA" prop="rootId" min-width="180" :show-overflow-tooltip="true">
          <template #default="scope">{{ getRootName(scope.row.rootId) }}</template>
        </el-table-column>
        <el-table-column label="类型" prop="deltaCrl" width="110">
          <template #default="scope">
            <el-tag :type="getCrlTagType(scope.row)" effect="light">{{ formatCrlType(scope.row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="范围" prop="crlScope" width="110">
          <template #default="scope">{{ formatScopeLabel(scope.row.crlScope) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="scope">
            <el-tag :type="getFreshness(scope.row).type" effect="plain">{{ getFreshness(scope.row).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="本次更新" prop="thisUpdate" width="170">
          <template #default="scope">{{ formatTimeValue(scope.row.thisUpdate) }}</template>
        </el-table-column>
        <el-table-column label="下次更新" prop="nextBefore" width="170">
          <template #default="scope">{{ formatTimeValue(scope.row.nextBefore) }}</template>
        </el-table-column>
        <el-table-column label="Base CRL" prop="baseCrlNo" width="120">
          <template #default="scope">{{ scope.row.baseCrlNo || '-' }}</template>
        </el-table-column>
        <el-table-column label="SHA1 指纹" prop="sha1" min-width="220" :show-overflow-tooltip="true">
          <template #default="scope">
            <span class="mono-text">{{ scope.row.sha1 || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="130" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-button link type="primary" icon="View" @click="handleDetail(scope.row)" v-hasPermi="['ca:crl:detail']">详情</el-button>
            <el-button link type="success" icon="Promotion" @click="handlePublish(scope.row)" v-hasPermi="['ca:crl:publish']">发布</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无CRL记录，请在根证书管理中配置并启动CRL签发线程" />
        </template>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <el-card class="mt-10px" shadow="never">
      <template #header>
        <div class="card-header">
          <span>本次操作记录</span>
          <el-button link type="primary" :disabled="publishRecords.length === 0" @click="publishRecords = []">清空</el-button>
        </div>
      </template>
      <el-table :data="publishRecords" size="small" empty-text="暂无本次操作记录">
        <el-table-column label="时间" prop="time" width="110" />
        <el-table-column label="操作" prop="action" width="120" />
        <el-table-column label="CRL编号" prop="crlNo" width="130" />
        <el-table-column label="发布目标" prop="publisherName" min-width="180" show-overflow-tooltip />
        <el-table-column label="结果" prop="status" width="90">
          <template #default="scope">
            <el-tag :type="scope.row.status === '成功' ? 'success' : 'danger'">{{ scope.row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="说明" prop="message" min-width="220" show-overflow-tooltip />
      </el-table>
    </el-card>

    <el-dialog v-model="publishDialog.visible" title="发布CRL" width="560px" append-to-body>
      <el-form :model="publishForm" label-width="120px">
        <el-form-item label="CRL编号">
          <el-input :model-value="detailDialog.data?.crlNo || publishForm.crlId" disabled />
        </el-form-item>
        <el-form-item label="目标发布者">
          <el-select v-model="publishForm.publisherId" placeholder="不选择则发布到CA关联发布者" clearable filterable style="width: 100%">
            <el-option v-for="item in publisherList" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="publishDialog.loading" @click="submitPublish">发 布</el-button>
          <el-button @click="publishDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="detailDialog.visible" :title="detailDialog.title" size="760px" append-to-body>
      <el-descriptions :column="2" border class="detail-descriptions">
        <el-descriptions-item label="CRL编号">{{ detailDialog.data?.crlNo }}</el-descriptions-item>
        <el-descriptions-item label="根CA">{{ getRootName(detailDialog.data?.rootId) }}</el-descriptions-item>
        <el-descriptions-item label="CRL类型">{{ formatCrlType(detailDialog.data || {}) }}</el-descriptions-item>
        <el-descriptions-item label="CRL Scope">{{ formatScopeLabel(detailDialog.data?.crlScope) }}</el-descriptions-item>
        <el-descriptions-item label="本次更新时间">{{ formatTimeValue(detailDialog.data?.thisUpdate) }}</el-descriptions-item>
        <el-descriptions-item label="下次更新时间">{{ formatTimeValue(detailDialog.data?.nextBefore) }}</el-descriptions-item>
        <el-descriptions-item label="Base CRL编号">{{ detailDialog.data?.baseCrlNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="SHA1">{{ detailDialog.data?.sha1 }}</el-descriptions-item>
      </el-descriptions>
      <el-input class="mt-10px crl-content" :model-value="detailDialog.data?.crl" type="textarea" :rows="18" readonly placeholder="暂无CRL内容" />
    </el-drawer>

  </div>
</template>

<style scoped lang="scss">
.crl-page {
  .metric-tile {
    min-height: 96px;
    padding: 16px;
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 6px;
  }

  .metric-label {
    color: #909399;
    font-size: 13px;
  }

  .metric-value {
    margin-top: 8px;
    color: #303133;
    font-size: 22px;
    font-weight: 600;
    line-height: 28px;
    word-break: break-all;
  }

  .metric-note {
    margin-top: 8px;
    color: #909399;
    font-size: 12px;
  }

  .table-toolbar,
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .toolbar-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mono-text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 12px;
  }

  .detail-descriptions {
    margin-bottom: 12px;
  }

  .crl-content {
    :deep(textarea) {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      font-size: 12px;
      line-height: 1.6;
    }
  }
}
</style>
