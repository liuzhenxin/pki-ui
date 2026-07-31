<template>
  <div class="p-2">
    <!-- 统计信息卡片 -->
    <el-row :gutter="16" class="statistics-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background-color: #409eff">
              <el-icon :size="28"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.total }}</div>
              <div class="stat-label">操作总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background-color: #67c23a">
              <el-icon :size="28"><SuccessFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.success }}</div>
              <div class="stat-label">成功</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background-color: #f56c6c">
              <el-icon :size="28"><CircleCloseFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.fail }}</div>
              <div class="stat-label">失败</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background-color: #e6a23c">
              <el-icon :size="28"><Timer /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics.avgTime }}ms</div>
              <div class="stat-label">平均耗时</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索表单 -->
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px] mt-[16px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="操作人员" prop="operName">
              <el-input v-model="queryParams.operName" placeholder="请输入操作人员" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="系统模块" prop="title">
              <el-input v-model="queryParams.title" placeholder="请输入系统模块" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="操作名称" prop="operationName">
              <el-input v-model="queryParams.operationName" placeholder="请输入操作名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="状态" prop="status">
              <el-select v-model="queryParams.status" placeholder="操作状态" clearable style="width: 200px">
                <el-option v-for="dict in sys_common_status" :key="dict.value" :label="dict.label" :value="dict.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="操作时间" style="width: 308px">
              <el-date-picker
                v-model="dateRange"
                value-format="YYYY-MM-DD HH:mm:ss"
                type="daterange"
                range-separator="-"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </transition>

    <!-- 日志列表 -->
    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <span class="card-header-title">业务日志记录</span>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
        </el-row>
      </template>

      <el-table ref="operLogTableRef" v-loading="loading" :data="operlogList" border :default-sort="defaultSort" @sort-change="handleSortChange">
        <el-table-column label="日志编号" align="center" prop="operId" width="180" />
        <el-table-column label="系统模块" align="center" prop="title" :show-overflow-tooltip="true" min-width="120" />
        <el-table-column label="操作名称" align="center" prop="operationName" min-width="140" :show-overflow-tooltip="true" />
        <el-table-column label="操作人员" align="center" prop="operName" width="110" :show-overflow-tooltip="true" sortable="custom" />
        <el-table-column label="操作地址" align="center" prop="operIp" width="130" :show-overflow-tooltip="true" />
        <el-table-column label="操作状态" align="center" prop="status" width="90">
          <template #default="scope">
            <dict-tag :options="sys_common_status" :value="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作日期" align="center" prop="operTime" width="170" sortable="custom">
          <template #default="scope">
            <span>{{ proxy.parseTime(scope.row.operTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="消耗时间" align="center" prop="costTime" width="100" sortable="custom">
          <template #default="scope">
            <span>{{ scope.row.costTime }}ms</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" align="center" width="80" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="详细" placement="top">
              <el-button link type="primary" icon="View" @click="handleView(scope.row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <!-- 操作日志详细 -->
    <OperInfoDialog ref="operInfoDialogRef" />
  </div>
</template>

<script setup name="CaOperlog" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, onMounted, computed } from 'vue';
import { ElFormInstance, ElTableInstance } from 'element-plus';
import { Document, SuccessFilled, CircleCloseFilled, Timer } from '@element-plus/icons-vue';
import { list } from '@/api/system/operlog';
import { OperLogForm, OperLogQuery, OperLogVO } from '@/api/monitor/operlog/types';
import OperInfoDialog from '@/views/monitor/operlog/oper-info-dialog.vue';

type DateModelType = string | number | Date;

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_oper_type, sys_common_status } = toRefs<any>(proxy?.useDict('sys_oper_type', 'sys_common_status'));

const operlogList = ref<OperLogVO[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const dateRange = ref<[DateModelType, DateModelType]>(['', '']);
const defaultSort = ref<any>({ prop: 'operTime', order: 'descending' });

const operLogTableRef = ref<ElTableInstance>();
const queryFormRef = ref<ElFormInstance>();

// 统计数据
const statistics = reactive({
  total: 0,
  success: 0,
  fail: 0,
  avgTime: 0
});

const data = reactive<PageData<OperLogForm, OperLogQuery>>({
  form: {
    operId: undefined,
    tenantId: undefined,
    title: '',
    operationName: '',
    businessType: 0,
    businessTypes: undefined,
    method: '',
    requestMethod: '',
    operatorType: 0,
    operName: '',
    deptName: '',
    operUrl: '',
    operIp: '',
    operLocation: '',
    operParam: '',
    jsonResult: '',
    status: 0,
    errorMsg: '',
    operTime: '',
    costTime: 0
  },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    operIp: '',
    title: '',
    operationName: '',
    operName: '',
    businessType: '',
    status: '',
    orderByColumn: defaultSort.value.prop,
    isAsc: defaultSort.value.order
  },
  rules: {}
});

const { queryParams } = toRefs(data);

/** 计算统计数据 */
const computeStatistics = (list: OperLogVO[]) => {
  const successCount = list.filter((item) => item.status === 0).length;
  const failCount = list.filter((item) => item.status === 1).length;
  const totalTime = list.reduce((sum, item) => sum + (item.costTime || 0), 0);
  statistics.total = total.value;
  statistics.success = successCount;
  statistics.fail = failCount;
  statistics.avgTime = list.length > 0 ? Math.round(totalTime / list.length) : 0;
};

const buildQuery = () => {
  const query: Record<string, unknown> = {
    pageNum: queryParams.value.pageNum,
    pageSize: queryParams.value.pageSize,
    name: queryParams.value.operationName || undefined,
    moduleName: queryParams.value.title || undefined,
    operator: queryParams.value.operName || undefined,
    status: queryParams.value.status === '' ? undefined : queryParams.value.status
  };
  if (dateRange.value?.[0] && dateRange.value?.[1]) {
    query.beginTime = dateRange.value[0];
    query.endTime = dateRange.value[1];
  }
  return query;
};

const adaptRows = (rows: any[]): OperLogVO[] => {
  return rows.map((row) => ({
    operId: row.id ?? row.operId,
    tenantId: row.tenantId,
    title: row.moduleName ?? row.title,
    operationName: row.name ?? row.operationName ?? '',
    businessType: row.businessType ?? 0,
    businessTypes: row.businessTypes,
    method: row.methodName ?? row.method,
    requestMethod: row.requestType ?? row.requestMethod,
    operatorType: row.operatorType ?? 0,
    operName: row.operator ?? row.operName,
    deptName: row.deptName ?? '',
    operUrl: row.uri ?? row.operUrl,
    operIp: row.ipAddress ?? row.ip ?? row.operIp,
    operLocation: row.address ?? row.operLocation,
    operParam: row.requestParams ?? row.operParam,
    jsonResult: row.jsonResult ?? '',
    status: row.status,
    errorMsg: row.errorMessage ?? row.errorMsg,
    operTime: row.createTime ?? row.operTime,
    costTime: row.costTime ?? 0
  }));
};

/** 查询操作日志 */
const getList = async () => {
  loading.value = true;
  try {
    const res = await list(buildQuery());
    const page = res.data || res;
    operlogList.value = adaptRows(page.records || page.rows || []);
    total.value = page.total || 0;
    computeStatistics(operlogList.value);
  } finally {
    loading.value = false;
  }
};

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};

/** 重置按钮操作 */
const resetQuery = () => {
  dateRange.value = ['', ''];
  queryFormRef.value?.resetFields();
  queryParams.value.pageNum = 1;
  operLogTableRef.value?.sort(defaultSort.value.prop, defaultSort.value.order);
};

/** 排序触发事件 */
const handleSortChange = (column: any) => {
  queryParams.value.orderByColumn = column.prop;
  queryParams.value.isAsc = column.order;
  getList();
};

const operInfoDialogRef = ref<InstanceType<typeof OperInfoDialog>>();

/** 详细按钮操作 */
const handleView = (row: OperLogVO) => {
  operInfoDialogRef.value.openDialog(row);
};

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.statistics-row {
  margin-bottom: 0;
}

.stat-card {
  .stat-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    flex-shrink: 0;
  }

  .stat-info {
    flex: 1;

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #303133;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 13px;
      color: #909399;
      margin-top: 4px;
    }
  }
}

.card-header-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
</style>
