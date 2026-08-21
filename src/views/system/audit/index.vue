<template>
  <div class="p-2">
    <el-card shadow="hover">
      <template #header>
        <div class="flex items-center justify-between">
          <span>审计完整性校验</span>
          <span class="text-sm font-normal text-gray-500">校验当前租户登录日志 / 操作日志的审计哈希链完整性</span>
        </div>
      </template>

      <el-form :inline="true">
        <el-form-item label="日志类型">
          <el-select v-model="verifyForm.logType" placeholder="请选择日志类型" style="width: 180px">
            <el-option label="登录日志" value="LOGIN" />
            <el-option label="操作日志" value="OPERATE" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" :loading="verifyLoading" @click="handleVerify">执行校验</el-button>
        </el-form-item>
      </el-form>

      <el-alert v-if="verifyResult" :type="verifyResult.valid ? 'success' : 'error'" :closable="false" class="mt-2">
        <div>
          <p class="mb-1">
            <el-tag :type="verifyResult.valid ? 'success' : 'danger'" size="small">
              {{ verifyResult.valid ? '哈希链完整' : '哈希链存在断裂' }}
            </el-tag>
            <span class="ml-2">校验记录数：{{ verifyResult.checkedCount ?? 0 }}</span>
            <span class="ml-2">断裂记录数：{{ verifyResult.brokenCount ?? 0 }}</span>
          </p>
          <template v-if="!verifyResult.valid && verifyResult.firstBrokenId != null">
            <p class="mt-1">首个断裂记录 ID：{{ verifyResult.firstBrokenId }}</p>
            <p class="break-all">预期哈希：{{ verifyResult.firstBrokenExpectedHash }}</p>
            <p class="break-all">实际哈希：{{ verifyResult.firstBrokenActualHash }}</p>
          </template>
        </div>
      </el-alert>
    </el-card>

    <el-card shadow="hover" class="mt-10px">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <span class="font-semibold">校验记录</span>
          </el-col>
          <el-col :span="6" class="flex justify-end">
            <el-select v-model="queryParams.logType" placeholder="日志类型" clearable style="width: 140px" @change="handleQuery">
              <el-option label="登录日志" value="LOGIN" />
              <el-option label="操作日志" value="OPERATE" />
            </el-select>
            <el-select v-model="queryParams.valid" placeholder="完整性" clearable style="width: 120px; margin-left: 8px" @change="handleQuery">
              <el-option label="完整" :value="1" />
              <el-option label="断裂" :value="0" />
            </el-select>
          </el-col>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="recordList">
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column label="日志类型" align="center" prop="logType" width="110">
          <template #default="scope">
            <el-tag v-if="scope.row.logType === 'LOGIN'" type="primary">登录日志</el-tag>
            <el-tag v-else-if="scope.row.logType === 'OPERATE'" type="warning">操作日志</el-tag>
            <span v-else>{{ scope.row.logType }}</span>
          </template>
        </el-table-column>
        <el-table-column label="校验记录数" align="center" prop="checkedCount" width="110" />
        <el-table-column label="断裂记录数" align="center" prop="brokenCount" width="110" />
        <el-table-column label="完整性" align="center" prop="valid" width="100">
          <template #default="scope">
            <el-tag v-if="scope.row.valid === 1" type="success">完整</el-tag>
            <el-tag v-else-if="scope.row.valid === 0" type="danger">断裂</el-tag>
            <el-tag v-else type="info">{{ scope.row.valid }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="首个断裂记录ID" align="center" prop="firstBrokenId" width="140">
          <template #default="scope">
            <span>{{ scope.row.firstBrokenId ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="校验时间" align="center" prop="createTime" width="180" />
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>
  </div>
</template>

<script setup name="AuditVerify" lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { verifyAudit, pageVerifyRecord } from '@/api/system/audit';
import { AuditVerifyResult, AuditVerifyRecord, AuditVerifyRecordQuery } from '@/api/system/audit/types';
import { useUserStore } from '@/store/modules/user';

const userStore = useUserStore();
const currentTenantId = userStore.tenantId;

const verifyLoading = ref(false);
const verifyResult = ref<AuditVerifyResult>();
const verifyForm = reactive<{ logType: 'LOGIN' | 'OPERATE' }>({
  logType: 'LOGIN'
});

const loading = ref(true);
const total = ref(0);
const recordList = ref<AuditVerifyRecord[]>([]);

const queryParams = reactive<AuditVerifyRecordQuery>({
  pageNum: 1,
  pageSize: 10,
  logType: undefined,
  valid: undefined,
  tenantId: currentTenantId
});

/** 执行审计完整性校验 */
function handleVerify() {
  verifyLoading.value = true;
  verifyAudit({ logType: verifyForm.logType, tenantId: currentTenantId })
    .then((response) => {
      verifyResult.value = response.data;
      ElMessage.success('校验完成');
      getList();
    })
    .finally(() => {
      verifyLoading.value = false;
    });
}

/** 查询审计校验记录列表 */
function getList() {
  loading.value = true;
  pageVerifyRecord(queryParams)
    .then((response) => {
      recordList.value = response.data.records || [];
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

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.p-2 {
  padding: 8px;
}

.mt-10px {
  margin-top: 10px;
}

.break-all {
  word-break: break-all;
}
</style>
