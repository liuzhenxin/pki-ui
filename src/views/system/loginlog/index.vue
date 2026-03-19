<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="登录地址" prop="ip">
              <el-input v-model="queryParams.ip" placeholder="请输入登录地址" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="用户名称" prop="username">
              <el-input v-model="queryParams.username" placeholder="请输入用户名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="登录状态" prop="status">
              <el-select v-model="queryParams.status" placeholder="登录状态" clearable>
                <el-option label="成功" :value="0" />
                <el-option label="失败" :value="1" />
              </el-select>
            </el-form-item>
            <el-form-item label="登录时间" prop="dateRange">
              <el-date-picker
                v-model="dateRange"
                value-format="YYYY-MM-DD"
                type="daterange"
                range-separator="-"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
              ></el-date-picker>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </transition>

    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Download" @click="handleExport">导出</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="loginLogList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column type="index" label="序号" width="80" align="center" />
        <el-table-column label="访问编号" align="center" prop="id" width="180" />
        <el-table-column label="用户名称" align="center" prop="username" :show-overflow-tooltip="true" />
        <el-table-column label="登录地址" align="center" prop="ip" width="130" :show-overflow-tooltip="true" />
        <el-table-column label="登录地点" align="center" prop="address" :show-overflow-tooltip="true" />
        <el-table-column label="浏览器" align="center" prop="browser" :show-overflow-tooltip="true" />
        <el-table-column label="操作系统" align="center" prop="os" :show-overflow-tooltip="true" />
        <el-table-column label="登录状态" align="center" prop="status" width="100">
          <template #default="scope">
            <el-tag v-if="scope.row.status === 0" type="success">成功</el-tag>
            <el-tag v-else-if="scope.row.status === 1" type="danger">失败</el-tag>
            <el-tag v-else type="info">{{ scope.row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="登录日期" align="center" prop="createTime" width="180" />
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>
  </div>
</template>

<script setup name="LoginLog" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Refresh, Delete, Download } from '@element-plus/icons-vue';
import { list, delLoginLog, exportLoginLog } from '@/api/system/loginlog';
import { LoginLogForm, LoginLogQuery } from '@/api/system/loginlog/types';

const { proxy } = getCurrentInstance() as any;

// 数据定义
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<(string | number)[]>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const loginLogList = ref<any[]>([]);
const dateRange = ref<[Date, Date]>();

const queryFormRef = ref();

// 查询参数
const queryParams = reactive<LoginLogQuery>({
  pageNum: 1,
  pageSize: 10,
  ip: undefined,
  username: undefined,
  status: undefined,
  beginTime: undefined,
  endTime: undefined
});

/** 查询登录日志列表 */
function getList() {
  loading.value = true;
  
  // 处理日期范围
  const query = { ...queryParams };
  if (dateRange.value && dateRange.value.length === 2) {
    query.beginTime = dateRange.value[0];
    query.endTime = dateRange.value[1];
  }
  
  list(query)
    .then((response) => {
      loginLogList.value = response.data.records || response.data.rows || [];
      total.value = response.data.total || 0;
    })
    .finally(() => {
      loading.value = false;
    });
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = undefined;
  queryFormRef.value?.resetFields();
  handleQuery();
}

/** 多选框选中数据 */
function handleSelectionChange(selection: any[]) {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

/** 删除按钮操作 */
function handleDelete(row?: any) {
  const deleteIds = row?.id || ids.value;
  ElMessageBox.confirm('是否确认删除访问编号为"' + deleteIds + '"的数据项？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      return delLoginLog(Array.isArray(deleteIds) ? deleteIds : [deleteIds]);
    })
    .then(() => {
      getList();
      ElMessage.success('删除成功');
    })
    .catch(() => {});
}

/** 导出按钮操作 */
function handleExport() {
  ElMessageBox.confirm('是否确认导出所有登录日志数据项?', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      const query = { ...queryParams };
      if (dateRange.value && dateRange.value.length === 2) {
        query.beginTime = dateRange.value[0];
        query.endTime = dateRange.value[1];
      }
      return exportLoginLog(query);
    })
    .then((response) => {
      proxy.download(response, 'loginlog_' + new Date().getTime() + '.xlsx');
    })
    .catch(() => {});
}

// 初始化
onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.p-2 {
  padding: 8px;
}

.mb-10px {
  margin-bottom: 10px;
}
</style>