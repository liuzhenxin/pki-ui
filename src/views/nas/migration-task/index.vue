<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryFormRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="任务名称" prop="name">
        <el-input v-model="queryParams.name" placeholder="请输入任务名称" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="任务状态" clearable style="width: 240px">
          <el-option label="等待中" value="PENDING" />
          <el-option label="启动中" value="STARTING" />
          <el-option label="运行中" value="RUNNING" />
          <el-option label="停止中" value="STOPPING" />
          <el-option label="已停止" value="STOPPED" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="失败" value="FAILED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['nas:migration:add']">新增任务</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="taskList">
      <el-table-column label="任务名称" align="center" prop="name" :show-overflow-tooltip="true" />
      <el-table-column label="源路径" align="center" prop="sourcePath" :show-overflow-tooltip="true" />
      <el-table-column label="目标路径" align="center" prop="targetPath" :show-overflow-tooltip="true" />
      <el-table-column label="进度" align="center" width="200">
        <template #default="scope">
          <div v-if="scope.row.totalFiles > 0">
            <el-progress 
              :percentage="Math.floor((scope.row.migratedFiles / scope.row.totalFiles) * 100)" 
              :status="scope.row.status === 'COMPLETED' ? 'success' : (scope.row.status === 'FAILED' ? 'exception' : '')"
            />
            <div style="font-size: 12px; color: #909399;">
              {{ scope.row.migratedFiles }} / {{ scope.row.totalFiles }}
            </div>
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" prop="status" width="100">
        <template #default="scope">
          <el-tag :type="getStatusTag(scope.row.status)">{{ getStatusLabel(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width" width="250">
        <template #default="scope">
          <el-button link type="primary" icon="VideoPlay" @click="handleStart(scope.row)" v-if="['PENDING', 'STOPPED', 'FAILED'].includes(scope.row.status)" v-hasPermi="['nas:migration:edit']">启动</el-button>
          <el-button link type="warning" icon="VideoPause" @click="handleStop(scope.row)" v-if="['RUNNING', 'STARTING'].includes(scope.row.status)" v-hasPermi="['nas:migration:edit']">停止</el-button>
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-if="['PENDING', 'STOPPED', 'FAILED'].includes(scope.row.status)" v-hasPermi="['nas:migration:edit']">修改</el-button>
          <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)" v-if="['PENDING', 'STOPPED', 'FAILED', 'COMPLETED'].includes(scope.row.status)" v-hasPermi="['nas:migration:remove']">删除</el-button>
          <el-button link type="info" icon="InfoFilled" @click="handleDetail(scope.row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 添加或修改迁移任务对话框 -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-form ref="taskFormRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="任务名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="源路径" prop="sourcePath">
          <el-input v-model="form.sourcePath" placeholder="请输入源路径 (例如: /data/source)" />
        </el-form-item>
        <el-form-item label="目标路径" prop="targetPath">
          <el-input v-model="form.targetPath" placeholder="请输入目标路径 (例如: /data/target)" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 任务详情对话框 -->
    <el-dialog title="任务详情" v-model="detailOpen" width="700px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="任务名称">{{ detailForm.name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTag(detailForm.status)">{{ getStatusLabel(detailForm.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="源路径">{{ detailForm.sourcePath }}</el-descriptions-item>
        <el-descriptions-item label="目标路径">{{ detailForm.targetPath }}</el-descriptions-item>
        <el-descriptions-item label="进度">
           {{ detailForm.migratedFiles }} / {{ detailForm.totalFiles }} ({{ detailForm.totalFiles > 0 ? Math.floor((detailForm.migratedFiles / detailForm.totalFiles) * 100) : 0 }}%)
        </el-descriptions-item>
        <el-descriptions-item label="最后处理文件">{{ detailForm.lastProcessedFile || '-' }}</el-descriptions-item>
        <el-descriptions-item label="消息/错误">{{ detailForm.message || '-' }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ detailForm.description || '-' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="detailOpen = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="MigrationTask">
import { listTask, getTask, delTask, addTask, updateTask, startTask, stopTask } from "@/api/nas/migrationTask";

const { proxy } = getCurrentInstance();

const taskList = ref([]);
const open = ref(false);
const detailOpen = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const title = ref("");

const data = reactive({
  form: {},
  detailForm: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: undefined,
    status: undefined
  },
  rules: {
    name: [{ required: true, message: "任务名称不能为空", trigger: "blur" }],
    sourcePath: [{ required: true, message: "源路径不能为空", trigger: "blur" }],
    targetPath: [{ required: true, message: "目标路径不能为空", trigger: "blur" }]
  }
});

const { queryParams, form, detailForm, rules } = toRefs(data);

/** 查询迁移任务列表 */
function getList() {
  loading.value = true;
  listTask(queryParams.value).then(response => {
    const data = response.data || {};
    taskList.value = data.records || data.rows || [];
    total.value = data.total || 0;
    loading.value = false;
  }).catch(() => {
    loading.value = false;
  });
}

/** 取消按钮 */
function cancel() {
  open.value = false;
  reset();
}

/** 表单重置 */
function reset() {
  form.value = {
    id: undefined,
    name: undefined,
    description: undefined,
    sourcePath: undefined,
    targetPath: undefined
  };
  proxy.resetForm("taskFormRef");
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm("queryFormRef");
  handleQuery();
}

/** 新增按钮操作 */
function handleAdd() {
  reset();
  open.value = true;
  title.value = "添加迁移任务";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const id = row.id;
  getTask(id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "修改迁移任务";
  });
}

/** 详情按钮操作 */
function handleDetail(row) {
  const id = row.id;
  getTask(id).then(response => {
    detailForm.value = response.data;
    detailOpen.value = true;
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["taskFormRef"].validate(valid => {
    if (valid) {
      if (form.value.id !== undefined) {
        updateTask(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addTask(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功");
          open.value = false;
          getList();
        });
      }
    }
  });
}

/** 删除按钮操作 */
function handleDelete(row) {
  const ids = row.id;
  proxy.$modal.confirm('是否确认删除任务编号为"' + ids + '"的数据项？').then(function() {
    return delTask(ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 启动任务 */
function handleStart(row) {
  proxy.$modal.confirm('是否确认启动任务 "' + row.name + '"？').then(function() {
    return startTask(row.id);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("任务启动中");
  }).catch(() => {});
}

/** 停止任务 */
function handleStop(row) {
  proxy.$modal.confirm('是否确认停止任务 "' + row.name + '"？').then(function() {
    return stopTask(row.id);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("停止请求已发送");
  }).catch(() => {});
}

/** 状态标签类型 */
function getStatusTag(status) {
  const tags = {
    'PENDING': 'info',
    'STARTING': 'warning',
    'RUNNING': '',
    'STOPPING': 'warning',
    'STOPPED': 'danger',
    'COMPLETED': 'success',
    'FAILED': 'danger'
  };
  return tags[status] || 'info';
}

/** 状态文字 */
function getStatusLabel(status) {
  const labels = {
    'PENDING': '等待中',
    'STARTING': '启动中',
    'RUNNING': '运行中',
    'STOPPING': '停止中',
    'STOPPED': '已停止',
    'COMPLETED': '已完成',
    'FAILED': '失败'
  };
  return labels[status] || status;
}

getList();
</script>
