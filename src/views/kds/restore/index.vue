<template>
  <div class="kds-restore">
    <el-card v-loading="loading">
      <template #header><span>数据恢复任务</span></template>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" class="mb" />
      <el-alert type="warning" :closable="false" show-icon title="恢复会在维护模式下执行全量导入；失败整体回滚，不可降级。" class="mb" />

      <el-form label-width="140px" class="form">
        <el-form-item label="设备序列号">
          <el-input v-model="form.deviceSn" placeholder="MMJ 设备序列号" />
        </el-form-item>
        <el-form-item label="受控归档引用">
          <el-input v-model="form.backupRef" placeholder="服务器受控归档路径（manifest）" />
        </el-form-item>
        <el-form-item label="二次确认令牌">
          <el-input v-model="form.confirmationToken" placeholder="confirmationToken" />
        </el-form-item>
        <el-form-item label="幂等键">
          <el-input v-model="form.idempotencyKey" placeholder="idempotencyKey" />
        </el-form-item>
        <el-form-item label="确认词">
          <el-input v-model="confirmWord" placeholder="输入 RESTORE 以确认" />
        </el-form-item>
        <el-form-item>
          <el-button v-hasPermi="['kds:restore:manage']" type="primary" :loading="submitting" @click="submit"> 创建恢复任务 </el-button>
        </el-form-item>
      </el-form>

      <el-divider />

      <el-form inline>
        <el-form-item label="任务 ID">
          <el-input v-model="taskId" placeholder="恢复任务 ID" style="width: 320px" />
        </el-form-item>
        <el-form-item>
          <el-button :loading="loading" @click="pollStatus">查询状态</el-button>
        </el-form-item>
      </el-form>

      <template v-if="status">
        <el-alert v-if="status.maintenance" type="warning" :closable="false" show-icon title="导入期间服务处于维护模式。" class="mb" />
        <el-alert v-if="status.rolledBack" type="error" :closable="false" show-icon title="本次恢复已回滚，状态未变更。" class="mb" />
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务 ID">{{ status.taskId }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ status.state }}</el-descriptions-item>
          <el-descriptions-item label="阶段">{{ status.stage }}</el-descriptions-item>
          <el-descriptions-item label="进度">{{ status.progress }}%</el-descriptions-item>
          <el-descriptions-item label="维护模式">{{ status.maintenance ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="已回滚">{{ status.rolledBack ? '是' : '否' }}</el-descriptions-item>
        </el-descriptions>
        <el-progress :percentage="status.progress" :status="status.state === 'FAILED' ? 'exception' : undefined" class="mt" />
        <el-alert v-if="status.message" type="info" :closable="false" :title="status.message" class="mt" />
      </template>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { createRestore, getRestoreStatus } from '@/api/kds/restore';
import { toKdsError } from '@/api/kds/client';
import type { RestoreStatus } from '@/types/kds';

const form = reactive({ deviceSn: '', backupRef: '', confirmationToken: '', idempotencyKey: '' });
const confirmWord = ref('');
const taskId = ref('');
const status = ref<RestoreStatus>();
const loading = ref(false);
const submitting = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  if (confirmWord.value !== 'RESTORE') {
    ElMessage.warning('请输入确认词 RESTORE');
    return;
  }
  if (!form.deviceSn || !form.backupRef || !form.confirmationToken || !form.idempotencyKey) {
    ElMessage.warning('请完整填写恢复参数');
    return;
  }
  submitting.value = true;
  try {
    const result = await createRestore({ ...form });
    taskId.value = result.recoveryId;
    ElMessage.success('恢复任务已创建');
    await pollStatus();
  } catch (e) {
    error.value = toKdsError(e).message;
    ElMessage.error(error.value);
  } finally {
    submitting.value = false;
  }
}

async function pollStatus() {
  if (!taskId.value) {
    ElMessage.warning('请输入任务 ID');
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    status.value = await getRestoreStatus(taskId.value);
  } catch (e) {
    error.value = toKdsError(e).message;
    status.value = undefined;
  } finally {
    loading.value = false;
  }
}
</script>
<style scoped>
.kds-restore {
  padding: 20px;
}
.mb {
  margin-bottom: 12px;
}
.mt {
  margin-top: 12px;
}
.form {
  max-width: 640px;
}
</style>
