<template>
  <div class="p-2">
    <el-row :gutter="12">
      <el-col :xs="24" :lg="12">
        <el-card shadow="never">
          <template #header>恢复申请</template>
          <el-form :model="submitForm" label-width="120px">
            <el-form-item label="归档密钥ID">
              <el-input v-model="submitForm.archiveKeyId" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Promotion" :loading="loading" v-hasPermi="['sys:keyrecovery:submit']" @click="submitRequest">
                提交恢复申请
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card shadow="never">
          <template #header>审批状态</template>
          <el-form :model="statusForm" label-width="120px">
            <el-form-item label="审批ID">
              <el-input v-model="statusForm.judgeId" />
            </el-form-item>
            <el-form-item>
              <el-button icon="Search" v-hasPermi="['sys:keyrecovery:status']" @click="loadStatus">查询状态</el-button>
              <el-button type="danger" plain icon="Close" v-hasPermi="['sys:keyrecovery:cancel']" @click="cancelRequest">取消申请</el-button>
            </el-form-item>
          </el-form>
          <el-alert v-if="statusResult !== null" :title="statusResult ? '审批已通过' : '审批未通过或仍在处理中'" :type="statusResult ? 'success' : 'warning'" show-icon />
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="mt-3">
      <template #header>恢复密钥</template>
      <el-form :model="recoverForm" label-width="120px" class="recover-form">
        <el-form-item label="归档密钥ID">
          <el-input v-model="recoverForm.archiveKeyId" />
        </el-form-item>
        <el-form-item label="审批ID">
          <el-input v-model="recoverForm.judgeId" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Key" :loading="recoverLoading" v-hasPermi="['sys:keyrecovery:recover']" @click="recoverKey">恢复密钥</el-button>
        </el-form-item>
      </el-form>
      <el-input v-model="recoverResult" type="textarea" :rows="6" readonly placeholder="恢复成功后显示 Base64 密钥数据" />
    </el-card>
  </div>
</template>

<script setup name="KmcKeyRecovery" lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { cancelKeyRecovery, getKeyRecoveryStatus, recoverArchiveKey, submitKeyRecovery } from '@/api/kmc/keyRecovery';
import { unwrapKmcData } from '@/api/kmc/common';

const loading = ref(false);
const recoverLoading = ref(false);
const statusResult = ref<boolean | null>(null);
const recoverResult = ref('');

const submitForm = reactive({ archiveKeyId: '' });
const statusForm = reactive({ judgeId: '' });
const recoverForm = reactive({ archiveKeyId: '', judgeId: '' });

const submitRequest = async () => {
  loading.value = true;
  try {
    const judgeId = unwrapKmcData(await submitKeyRecovery(submitForm.archiveKeyId));
    statusForm.judgeId = String(judgeId ?? '');
    recoverForm.archiveKeyId = submitForm.archiveKeyId;
    recoverForm.judgeId = statusForm.judgeId;
    ElMessage.success(`恢复申请已提交，审批ID：${statusForm.judgeId}`);
  } finally {
    loading.value = false;
  }
};

const loadStatus = async () => {
  statusResult.value = Boolean(unwrapKmcData(await getKeyRecoveryStatus(statusForm.judgeId)));
};

const cancelRequest = async () => {
  await cancelKeyRecovery(statusForm.judgeId);
  ElMessage.success('恢复申请已取消');
  statusResult.value = null;
};

const recoverKey = async () => {
  recoverLoading.value = true;
  try {
    recoverResult.value = String(unwrapKmcData(await recoverArchiveKey(recoverForm.archiveKeyId, recoverForm.judgeId)) ?? '');
    ElMessage.success('密钥恢复成功');
  } finally {
    recoverLoading.value = false;
  }
};
</script>

<style scoped lang="scss">
.mt-3 {
  margin-top: 12px;
}

.recover-form {
  max-width: 640px;
}
</style>

