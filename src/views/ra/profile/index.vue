<template>
  <div class="p-2">
    <el-card shadow="hover" class="ra-profile-page">
      <template #header>
        <div class="card-header">
          <span>证书模板</span>
          <el-button v-hasPermi="['ra:profile']" icon="Refresh" @click="getList">刷新</el-button>
        </div>
      </template>

      <el-alert
        class="mb-3"
        type="info"
        :closable="false"
        show-icon
        title="自动审核只跳过审核员，不跳过制证员，也不会自动调用 CA。双证书需两侧模板都设为自动审核才会跳过审核。"
      />

      <el-form :model="queryParams" inline class="query-form">
        <el-form-item label="模板名称">
          <el-input v-model="queryParams.name" clearable placeholder="请输入模板名称" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['ra:profile']" type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="profileList" border>
        <el-table-column label="模板名称" prop="name" min-width="180" show-overflow-tooltip />
        <el-table-column label="模板类型" prop="type" width="140" show-overflow-tooltip />
        <el-table-column label="关联根证书" prop="rootNames" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.rootNames || '-' }}</template>
        </el-table-column>
        <el-table-column label="审核策略" min-width="320">
          <template #default="{ row }">
            <el-radio-group
              :model-value="row.approvalMode"
              :disabled="!canSave || savingId === row.id"
              @change="(value: string) => handleApprovalChange(row, value)"
            >
              <el-radio-button value="required">人工审核（需审核员）</el-radio-button>
              <el-radio-button value="optional">自动审核（跳过审核员）</el-radio-button>
            </el-radio-group>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" prop="updateTime" width="180">
          <template #default="{ row }">{{ parseTime(row.updateTime) }}</template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </el-card>
  </div>
</template>

<script setup name="RaProfile" lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { pageRaProfile, saveRaProfileApprovalMode } from '@/api/ra/profile';
import type { RaProfileCO } from '@/api/ra/profile';
import { checkPermi } from '@/utils/permission';

const loading = ref(false);
const savingId = ref<number | string>();
const profileList = ref<RaProfileCO[]>([]);
const total = ref(0);
const canSave = checkPermi(['ra:profile:save']);

const queryParams = reactive({
  name: '',
  pageNum: 1,
  pageSize: 10
});

const unwrap = (response: any) => {
  const body = response?.data ?? response;
  return body?.data ?? body;
};

const getList = () => {
  loading.value = true;
  pageRaProfile(queryParams)
    .then((response) => {
      const data = unwrap(response);
      profileList.value = data?.records ?? data?.rows ?? [];
      total.value = Number(data?.total ?? 0);
    })
    .finally(() => {
      loading.value = false;
    });
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryParams.name = '';
  handleQuery();
};

const handleApprovalChange = (row: RaProfileCO, value: string) => {
  if (value !== 'required' && value !== 'optional') {
    return;
  }
  const previous = row.approvalMode;
  row.approvalMode = value;
  savingId.value = row.id;
  saveRaProfileApprovalMode(row.id, value)
    .then(() => {
      ElMessage.success('审核策略已保存，仅对后续新提交生效');
    })
    .catch(() => {
      row.approvalMode = previous;
    })
    .finally(() => {
      savingId.value = undefined;
    });
};

onMounted(() => {
  getList();
});
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mb-3 {
  margin-bottom: 12px;
}

.query-form {
  margin-bottom: 8px;
}
</style>
