<template>
  <main class="svs-init-page">
    <h1>签名验签服务器初始化</h1>
    <el-alert title="绑定已有平台账号：一个系统管理员、两个安全管理员和一个审计员。两名安全管理员权限相同，每笔操作由不同账号申请和审批，禁止自审批。账号和口令由平台管理。" type="info" :closable="false" />
    <el-card v-loading="loading" shadow="never">
      <p>产品租户：9 / svs</p>
      <p>平台租户检查：{{ state?.platformTenantValid ? '通过' : '未通过' }}</p>
      <p>密码设备检查：{{ state?.deviceReady ? '通过' : '未通过' }}</p>
      <el-form label-width="140px" @submit.prevent="complete">
        <el-form-item v-for="(label, index) in labels" :key="label" :label="label"
          ><el-input v-model="users[index]" autocomplete="off" maxlength="100"
        /></el-form-item>
        <el-button :loading="loading" @click="load">重新检查</el-button>
        <el-button type="primary" :loading="saving" :disabled="!state?.platformTenantValid || !state?.deviceReady || state?.locked" @click="complete"
          >校验角色并锁定初始化</el-button
        >
      </el-form>
      <p v-if="state?.locked">初始化已完成并锁定。</p>
      <el-button v-if="state?.locked" @click="router.replace('/svs/runtime')">进入管理台</el-button>
    </el-card>
  </main>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getSvsInitialization, completeSvsInitialization, type Initialization } from '@/api/svs/init';
const router = useRouter();
const state = ref<Initialization>();
const loading = ref(false);
const saving = ref(false);
const labels = ['系统管理员', '安全管理员 1', '安全管理员 2', '审计员'];
const roles = ['SYSADMIN', 'SECADMIN', 'SECADMIN', 'AUDITOR'];
const users = ref(['', '', '', '']);
async function load() {
  loading.value = true;
  try {
    state.value = await getSvsInitialization();
  } finally {
    loading.value = false;
  }
}
async function complete() {
  const names = users.value.map((name) => name.trim());
  if (names.some((name) => !/^[A-Za-z0-9_-]{1,100}$/.test(name)) || new Set(names).size !== 4) {
    ElMessage.warning('请填写四个不同的平台用户名');
    return;
  }
  saving.value = true;
  try {
    await completeSvsInitialization(Object.fromEntries(names.map((name, index) => [name, roles[index]])));
    ElMessage.success('初始化已锁定');
    await load();
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.svs-init-page {
  padding: 20px;
}
h1 {
  font-size: 20px;
}
.el-card {
  margin-top: 16px;
}
</style>
