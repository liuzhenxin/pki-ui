<template>
  <div class="app-container kds-page kds-destruction">
    <KdsPageHeader title="应急销毁" description="仅在已确认的安全事件中执行不可逆销毁，并跟踪每个受控步骤的结果。">
      <template #actions><el-button icon="Refresh" :loading="loading" @click="refresh">刷新状态</el-button></template>
    </KdsPageHeader>
    <el-card v-loading="loading" shadow="hover" class="kds-panel destruction-panel">
      <template #header><div class="kds-panel__header"><span>销毁控制</span><el-tag type="danger" effect="dark">高风险操作</el-tag></div></template>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" class="mb" />
      <el-alert type="error" :closable="false" show-icon title="销毁不可逆：将失效 HSM 密钥与引用并进入只读安全态。仅在确认事件下执行。" class="mb" />

      <el-descriptions v-if="status" :column="2" border class="mb">
        <el-descriptions-item label="当前状态">{{ status.state }}</el-descriptions-item>
        <el-descriptions-item label="是否完成">{{ status.completed ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="报告 ID">{{ status.taskId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审计关联">{{ status.auditId || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-table v-if="status && status.steps.length" :data="status.steps" border size="small" class="mb">
        <el-table-column prop="name" label="步骤" min-width="200" />
        <el-table-column label="结果" width="100">
          <template #default="{ row }">
            <el-tag :type="row.completed ? 'success' : 'danger'">{{ row.completed ? '完成' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="elapsedMillis" label="耗时(ms)" width="120" />
      </el-table>

      <div v-if="destroyed" class="readonly">
        <el-alert type="warning" :closable="false" show-icon title="服务已进入销毁后只读安全态：仅允许销毁幂等重试与状态查询。" />
      </div>

      <el-form v-else label-width="120px" class="form">
        <el-form-item label="确认词">
          <el-input v-model="confirmWord" placeholder="输入 DESTROY 以确认" />
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['kds:destruction:execute']" type="danger" icon="Delete" :loading="submitting" @click="execute">执行应急销毁</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { executeDestruction, getDestructionStatus } from '@/api/kds/ops';
import { toKdsError } from '@/api/kds/client';
import type { DestructionStatus } from '@/types/kds';
import KdsPageHeader from '@/views/kds/components/KdsPageHeader.vue';

const status = ref<DestructionStatus>();
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
const confirmWord = ref('');

const destroyed = computed(() => status.value?.state === 'COMPLETED');

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    status.value = await getDestructionStatus();
  } catch (e) {
    error.value = toKdsError(e).message;
    status.value = undefined;
  } finally {
    loading.value = false;
  }
}

async function execute() {
  if (confirmWord.value !== 'DESTROY') {
    ElMessage.warning('请输入确认词 DESTROY');
    return;
  }
  submitting.value = true;
  try {
    await executeDestruction(confirmWord.value);
    ElMessage.success('销毁已执行');
    confirmWord.value = '';
    await refresh();
  } catch (e) {
    ElMessage.error(toKdsError(e).message);
  } finally {
    submitting.value = false;
  }
}

onMounted(refresh);
</script>
<style scoped>
.mb {
  margin-bottom: 12px;
}
.form {
  max-width: 560px;
}
.readonly {
  margin-top: 12px;
}
</style>
<style src="../styles/page.css"></style>
