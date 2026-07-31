<template>
  <div class="p-2">
    <!-- 搜索表单 -->
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="登录地址" prop="ipAddress">
              <el-input v-model="queryParams.ipAddress" placeholder="请输入登录地址" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="用户名称" prop="username">
              <el-input v-model="queryParams.username" placeholder="请输入用户名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="状态" prop="status">
              <el-select v-model="queryParams.status" placeholder="登录状态" clearable style="width: 200px">
                <el-option v-for="dict in sys_common_status" :key="dict.value" :label="dict.label" :value="dict.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="登录时间" style="width: 308px">
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

    <!-- 登录日志列表 -->
    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <span class="card-header-title">登录日志记录</span>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
        </el-row>
      </template>

      <el-table v-loading="loading" :data="loginLogList" border :default-sort="defaultSort" @sort-change="handleSortChange">
        <el-table-column label="访问编号" align="center" prop="id" width="100" />
        <el-table-column label="用户名称" align="center" prop="username" width="120" :show-overflow-tooltip="true" sortable="custom" />
        <el-table-column label="登录地址" align="center" prop="ipAddress" width="140" :show-overflow-tooltip="true" />
        <el-table-column label="登录地点" align="center" prop="address" width="140" :show-overflow-tooltip="true" />
        <el-table-column label="浏览器" align="center" prop="browser" :show-overflow-tooltip="true" min-width="120" />
        <el-table-column label="操作系统" align="center" prop="os" min-width="120" :show-overflow-tooltip="true" />
        <el-table-column label="登录信息" align="center" min-width="140" :show-overflow-tooltip="true">
          <template #default="scope">
            <span v-if="scope.row.status === 0">登录成功</span>
            <span v-else style="color: #f56c6c">{{ scope.row.errorMessage || '登录失败' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="登录日期" align="center" prop="createTime" width="170" sortable="custom">
          <template #default="scope">
            <span>{{ proxy.parseTime(scope.row.createTime) }}</span>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>
  </div>
</template>

<script setup name="CaLoginLog" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, onMounted } from 'vue';
import { ElFormInstance, ElTableInstance } from 'element-plus';
import { list } from '@/api/system/loginlog';

type DateModelType = string | number | Date;

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const { sys_common_status } = toRefs<any>(proxy?.useDict('sys_common_status'));

const loginLogList = ref<any[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const dateRange = ref<[DateModelType, DateModelType]>(['', '']);
const defaultSort = ref<any>({ prop: 'createTime', order: 'descending' });

const queryFormRef = ref<ElFormInstance>();
const loginLogTableRef = ref<ElTableInstance>();

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    ipAddress: '',
    username: '',
    status: '',
    orderByColumn: defaultSort.value.prop,
    isAsc: defaultSort.value.order
  }
});

const { queryParams } = toRefs(data);

const buildQuery = () => {
  const query: Record<string, unknown> = {
    pageNum: queryParams.value.pageNum,
    pageSize: queryParams.value.pageSize,
    username: queryParams.value.username || undefined,
    ipAddress: queryParams.value.ipAddress || undefined,
    status: queryParams.value.status === '' ? undefined : queryParams.value.status
  };
  if (dateRange.value?.[0] && dateRange.value?.[1]) {
    query.beginTime = dateRange.value[0];
    query.endTime = dateRange.value[1];
  }
  return query;
};

/** 查询登录日志 */
const getList = async () => {
  loading.value = true;
  try {
    const res = await list(buildQuery());
    const page = res.data || res;
    loginLogList.value = page.records || page.rows || [];
    total.value = page.total || 0;
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
  loginLogTableRef.value?.sort(defaultSort.value.prop, defaultSort.value.order);
};

/** 排序触发事件 */
const handleSortChange = (column: any) => {
  queryParams.value.orderByColumn = column.prop;
  queryParams.value.isAsc = column.order;
  getList();
};

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.card-header-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
</style>
