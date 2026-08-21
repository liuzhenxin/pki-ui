<template>
  <div class="app-container fawvw-employee-page">
    <el-row :gutter="16">
      <el-col :xs="24" :sm="24" :md="6" :lg="5" :xl="4">
        <el-card shadow="never" class="org-panel">
          <template #header>
            <div class="panel-header">
              <span>组织科室</span>
              <el-tag size="small" type="info" effect="plain">{{ summary.departments || 0 }}</el-tag>
            </div>
          </template>
          <el-input v-model="orgKeyword" placeholder="搜索部门" prefix-icon="Search" clearable />
          <el-tree
            ref="orgTreeRef"
            class="org-tree"
            node-key="id"
            :data="orgTreeData"
            :props="orgTreeProps"
            :expand-on-click-node="false"
            :filter-node-method="filterOrgNode"
            highlight-current
            default-expand-all
            @node-click="handleOrgClick"
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="18" :lg="19" :xl="20">
        <div class="summary-strip">
          <div class="metric">
            <span class="metric-label">员工总数</span>
            <strong>{{ summary.totalEmployees || 0 }}</strong>
          </div>
          <div class="metric">
            <span class="metric-label">在职员工</span>
            <strong>{{ summary.activeEmployees || 0 }}</strong>
          </div>
          <div class="metric">
            <span class="metric-label">外方员工</span>
            <strong>{{ summary.foreignEmployees || 0 }}</strong>
          </div>
          <div class="metric wide">
            <span class="metric-label">最近同步</span>
            <strong>{{ syncText }}</strong>
          </div>
          <el-tag type="warning" effect="plain">演示数据</el-tag>
        </div>

        <el-card shadow="never" class="employee-panel">
          <el-form :model="queryParams" inline class="query-form">
            <el-form-item label="关键词">
              <el-input v-model="queryParams.keyword" clearable placeholder="姓名/域账号/工号" style="width: 210px" @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="域账号">
              <el-input v-model="queryParams.domainAccount" clearable placeholder="请输入域账号" style="width: 180px" @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="员工类型">
              <el-select v-model="queryParams.employeeTypeId" clearable placeholder="全部类型" style="width: 150px">
                <el-option label="正式员工" value="REGULAR" />
                <el-option label="合同制员工" value="CONTRACTOR" />
                <el-option label="外方员工" value="EXPAT" />
              </el-select>
            </el-form-item>
            <el-form-item label="外方">
              <el-select v-model="queryParams.foreignFlag" clearable placeholder="全部" style="width: 120px">
                <el-option label="是" :value="true" />
                <el-option label="否" :value="false" />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="queryParams.status" clearable placeholder="全部状态" style="width: 120px">
                <el-option label="在职" value="A" />
                <el-option label="离职" value="I" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>

          <el-row :gutter="10" class="mb8 toolbar-row">
            <el-col :span="1.5">
              <el-button v-hasPermi="['ra:employee:sync']" type="primary" plain icon="Refresh" :loading="syncing" @click="handleSync">立即同步</el-button>
            </el-col>
            <el-col :span="1.5">
              <el-button v-hasPermi="['ra:employee:config']" plain icon="Setting" @click="openConfig">同步配置</el-button>
            </el-col>
            <el-col :span="1.5">
              <el-button plain icon="Clock" @click="openLogs">同步记录</el-button>
            </el-col>
            <el-col :span="1.5">
              <el-button v-hasPermi="['ra:employee:export']" type="success" plain icon="Download" @click="handleExport">导出</el-button>
            </el-col>
            <right-toolbar v-model:showSearch="showSearch" @queryTable="loadEmployees" />
          </el-row>

          <el-table v-loading="loading" :data="employeeList" border stripe class="employee-table" empty-text="暂无员工数据">
            <el-table-column label="姓名" prop="cnName" min-width="130" fixed show-overflow-tooltip />
            <el-table-column label="性别" prop="genderName" width="76" align="center" />
            <el-table-column label="工号" prop="employeeNo" min-width="112" show-overflow-tooltip />
            <el-table-column label="域账号" prop="domainAccount" min-width="120" show-overflow-tooltip />
            <el-table-column label="邮箱" prop="email" min-width="210" show-overflow-tooltip />
            <el-table-column label="入职时间" prop="enterTime" width="116" align="center" />
            <el-table-column label="职级/职别" prop="jobGrade" width="110" align="center" />
            <el-table-column label="岗位" prop="jobName" min-width="140" show-overflow-tooltip />
            <el-table-column label="科室" prop="departmentName" min-width="130" show-overflow-tooltip />
            <el-table-column label="外方" width="82" align="center">
              <template #default="{ row }">
                <el-tag :type="row.foreignFlag ? 'warning' : 'info'" effect="plain">{{ row.foreignFlag ? '是' : '否' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="经理级别" prop="managerLevel" width="110" align="center" />
            <el-table-column label="员工类型" prop="employeeTypeName" width="118" show-overflow-tooltip />
            <el-table-column label="状态" width="86" align="center">
              <template #default="{ row }">
                <el-tag :type="row.sourceStatus === 'A' ? 'success' : 'danger'" effect="plain">{{ row.sourceStatusName || row.employeeStatus }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="80" align="center">
              <template #default="{ row }">
                <el-tooltip content="详情" placement="top">
                  <el-button link type="primary" icon="View" @click="openDetail(row)" />
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>

          <pagination
            v-show="total > 0"
            v-model:page="queryParams.pageNum"
            v-model:limit="queryParams.pageSize"
            :total="total"
            @pagination="loadEmployees"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-drawer v-model="detailOpen" title="员工详情" size="520px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="姓名">{{ detail.cnName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="域账号">{{ detail.domainAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="工号">{{ detail.employeeNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="生日">{{ detail.birthday || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detail.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="部门路径">{{ detail.departmentNamePath || '-' }}</el-descriptions-item>
        <el-descriptions-item label="岗位">{{ detail.jobName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="职级/职别">{{ detail.jobGrade || '-' }}</el-descriptions-item>
        <el-descriptions-item label="员工类型">{{ detail.employeeTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="经理级别">{{ detail.managerLevel || '-' }}</el-descriptions-item>
        <el-descriptions-item label="自然人识别键">
          <span class="identity-key">{{ detail.identityKey || '-' }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-dialog v-model="configOpen" title="同步配置" width="520px" append-to-body>
      <el-form :model="syncConfig" label-width="100px">
        <el-form-item label="自动同步">
          <el-switch v-model="syncConfig.enabled" />
        </el-form-item>
        <el-form-item label="同步方式">
          <el-radio-group v-model="syncConfig.scheduleType">
            <el-radio-button value="DAILY">每日</el-radio-button>
            <el-radio-button value="HOURLY">按小时</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="syncConfig.scheduleType === 'DAILY'" label="每日时间">
          <el-time-picker v-model="dailyTimeValue" value-format="HH:mm:ss" format="HH:mm:ss" placeholder="选择时间" style="width: 180px" />
        </el-form-item>
        <el-form-item v-else label="小时间隔">
          <el-input-number v-model="syncConfig.intervalHours" :min="1" :max="24" controls-position="right" />
        </el-form-item>
        <el-form-item label="分页大小">
          <el-input-number v-model="syncConfig.pageSize" :min="100" :max="1000" :step="100" controls-position="right" />
        </el-form-item>
        <el-form-item label="数据源">
          <el-tag type="warning" effect="plain">{{ syncConfig.sourceMode }}</el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configOpen = false">取消</el-button>
        <el-button type="primary" :loading="savingConfig" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logsOpen" title="同步记录" width="860px" append-to-body>
      <el-table v-loading="logsLoading" :data="syncLogs" border>
        <el-table-column label="任务号" prop="taskNo" min-width="160" show-overflow-tooltip />
        <el-table-column label="触发方式" prop="triggerType" width="110" />
        <el-table-column label="状态" prop="status" width="96" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'SUCCESS' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'" effect="plain">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="组织" prop="totalOrgs" width="80" align="right" />
        <el-table-column label="员工" prop="totalEmployees" width="90" align="right" />
        <el-table-column label="新增" prop="createdCount" width="80" align="right" />
        <el-table-column label="更新" prop="updatedCount" width="80" align="right" />
        <el-table-column label="完成时间" prop="finishTime" min-width="160">
          <template #default="{ row }">{{ parseTime(row.finishTime) || '-' }}</template>
        </el-table-column>
      </el-table>
      <pagination
        v-show="logsTotal > 0"
        v-model:page="logQuery.pageNum"
        v-model:limit="logQuery.pageSize"
        :total="logsTotal"
        @pagination="loadLogs"
      />
    </el-dialog>
  </div>
</template>

<script setup name="RaEmployee" lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import FileSaver from 'file-saver';
import {
  exportFawvwEmployees,
  FawvwEmployee,
  FawvwEmployeeQuery,
  FawvwEmployeeSummary,
  FawvwOrgNode,
  FawvwSyncConfig,
  FawvwSyncLog,
  getFawvwEmployee,
  getFawvwEmployeeSummary,
  getFawvwOrgTree,
  getFawvwSyncConfig,
  pageFawvwEmployees,
  pageFawvwSyncLogs,
  saveFawvwSyncConfig,
  syncFawvwEmployees
} from '@/api/ra/employee';

const ALL_ORG_ID = '__ALL__';

const loading = ref(false);
const syncing = ref(false);
const savingConfig = ref(false);
const logsLoading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const logsTotal = ref(0);
const orgKeyword = ref('');
const detailOpen = ref(false);
const configOpen = ref(false);
const logsOpen = ref(false);
const employeeList = ref<FawvwEmployee[]>([]);
const syncLogs = ref<FawvwSyncLog[]>([]);
const orgTree = ref<FawvwOrgNode[]>([]);
const detail = ref<Partial<FawvwEmployee>>({});
const orgTreeRef = ref<any>();
const summary = reactive<FawvwEmployeeSummary>({
  totalEmployees: 0,
  activeEmployees: 0,
  foreignEmployees: 0,
  departments: 0,
  demoEnabled: true
});
const syncConfig = reactive<FawvwSyncConfig>({
  enabled: true,
  scheduleType: 'DAILY',
  dailyTime: '02:00:00',
  intervalHours: 24,
  pageSize: 1000,
  sourceMode: 'MOCK'
});
const queryParams = reactive<FawvwEmployeeQuery>({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  domainAccount: '',
  departmentId: '',
  employeeTypeId: '',
  foreignFlag: null,
  status: ''
});
const logQuery = reactive({
  pageNum: 1,
  pageSize: 10,
  status: ''
});

const orgTreeProps = { label: 'label', children: 'children' };
const orgTreeData = computed<FawvwOrgNode[]>(() => [
  {
    id: ALL_ORG_ID,
    label: '全部部门',
    depth: 0,
    childCount: orgTree.value.length,
    children: orgTree.value
  }
]);
const dailyTimeValue = computed({
  get: () => syncConfig.dailyTime || '02:00:00',
  set: (value: string) => {
    syncConfig.dailyTime = value || '02:00:00';
  }
});
const syncText = computed(() => {
  if (!summary.latestSyncTime) {
    return '未同步';
  }
  const totalText = summary.latestSyncEmployees ? ` / ${summary.latestSyncEmployees}人` : '';
  return `${summary.latestSyncStatus || '-'}${totalText}`;
});

watch(orgKeyword, (value) => {
  orgTreeRef.value?.filter(value);
});

const unwrap = (response: any) => {
  const body = response?.data ?? response;
  return body?.data ?? body;
};

const loadSummary = () => {
  getFawvwEmployeeSummary().then((response) => {
    Object.assign(summary, unwrap(response) || {});
  });
};

const loadOrgTree = () => {
  getFawvwOrgTree().then((response) => {
    orgTree.value = unwrap(response) || [];
  });
};

const loadEmployees = () => {
  loading.value = true;
  pageFawvwEmployees(queryParams)
    .then((response) => {
      const page = unwrap(response) || {};
      employeeList.value = page.records || page.rows || [];
      total.value = Number(page.total || 0);
    })
    .finally(() => {
      loading.value = false;
    });
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  loadEmployees();
};

const resetQuery = () => {
  queryParams.keyword = '';
  queryParams.domainAccount = '';
  queryParams.departmentId = '';
  queryParams.employeeTypeId = '';
  queryParams.foreignFlag = null;
  queryParams.status = '';
  orgTreeRef.value?.setCurrentKey(ALL_ORG_ID);
  handleQuery();
};

const filterOrgNode = (value: string, data: FawvwOrgNode) => {
  if (!value) {
    return true;
  }
  return data.label?.includes(value) || data.path?.includes(value);
};

const handleOrgClick = (node: FawvwOrgNode) => {
  queryParams.departmentId = node.id === ALL_ORG_ID ? '' : node.id;
  handleQuery();
};

const openDetail = (row: FawvwEmployee) => {
  detail.value = row;
  detailOpen.value = true;
  getFawvwEmployee(row.id).then((response) => {
    detail.value = unwrap(response) || row;
  });
};

const handleSync = () => {
  syncing.value = true;
  syncFawvwEmployees()
    .then((response) => {
      const log = unwrap(response) as FawvwSyncLog;
      ElMessage.success(`同步完成：${log?.totalEmployees || 0} 名员工`);
      loadSummary();
      loadOrgTree();
      loadEmployees();
    })
    .finally(() => {
      syncing.value = false;
    });
};

const openConfig = () => {
  getFawvwSyncConfig().then((response) => {
    Object.assign(syncConfig, unwrap(response) || syncConfig);
    configOpen.value = true;
  });
};

const saveConfig = () => {
  savingConfig.value = true;
  saveFawvwSyncConfig(syncConfig)
    .then((response) => {
      Object.assign(syncConfig, unwrap(response) || syncConfig);
      ElMessage.success('同步配置已保存');
      configOpen.value = false;
      loadSummary();
    })
    .finally(() => {
      savingConfig.value = false;
    });
};

const openLogs = () => {
  logsOpen.value = true;
  loadLogs();
};

const loadLogs = () => {
  logsLoading.value = true;
  pageFawvwSyncLogs(logQuery)
    .then((response) => {
      const page = unwrap(response) || {};
      syncLogs.value = page.records || page.rows || [];
      logsTotal.value = Number(page.total || 0);
    })
    .finally(() => {
      logsLoading.value = false;
    });
};

const handleExport = () => {
  exportFawvwEmployees(queryParams).then((response: any) => {
    const blob = response?.data instanceof Blob ? response.data : response;
    FileSaver.saveAs(blob, `fawvw_employees_${new Date().getTime()}.csv`);
  });
};

onMounted(() => {
  loadSummary();
  loadOrgTree();
  loadEmployees();
});
</script>

<style scoped lang="scss">
.fawvw-employee-page {
  .org-panel,
  .employee-panel {
    border-radius: 6px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-weight: 600;
  }

  .org-tree {
    margin-top: 12px;
    max-height: calc(100vh - 230px);
    overflow: auto;
  }

  .summary-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(120px, 1fr)) auto;
    gap: 10px;
    align-items: stretch;
    margin-bottom: 12px;
  }

  .metric {
    min-height: 58px;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    background: var(--el-bg-color);
  }

  .metric-label {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 18px;
  }

  .metric strong {
    display: block;
    margin-top: 4px;
    font-size: 20px;
    line-height: 24px;
    color: var(--el-text-color-primary);
  }

  .metric.wide strong {
    font-size: 15px;
  }

  .query-form {
    margin-bottom: 4px;
  }

  .toolbar-row {
    display: flex;
    align-items: center;
  }

  .employee-table {
    width: 100%;
  }

  .identity-key {
    display: inline-block;
    max-width: 360px;
    word-break: break-all;
    font-family: Consolas, Monaco, monospace;
    font-size: 12px;
  }
}

@media (max-width: 1200px) {
  .fawvw-employee-page {
    .summary-strip {
      grid-template-columns: repeat(2, minmax(140px, 1fr));
    }
  }
}
</style>
