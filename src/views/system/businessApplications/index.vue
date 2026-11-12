<template>
  <div class="app-container">
    <h2>业务应用接入</h2>
    <el-alert title="登记仅创建调用身份；使用 CSP 密码能力还需单独授予能力、密钥权限及配额。" type="info" :closable="false" />
    <div v-if="allowed">
      <p>
        <el-button type="primary" :disabled="busy" @click="openRegistration">登记业务应用</el-button
        ><el-button :disabled="busy" @click="load">刷新</el-button>
      </p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-table v-loading="loading" :data="rows" empty-text="暂无业务应用登记">
        <el-table-column prop="name" label="应用名称" />
        <el-table-column prop="applicationId" label="客户端 ID" min-width="280" />
        <el-table-column prop="ownerUserId" label="CSP 负责人 ID" />
        <el-table-column label="状态"
          ><template #default="{ row }">{{ row.status === 'ACTIVE' ? '有效' : '已停用' }}</template></el-table-column
        >
        <el-table-column prop="credentialVersion" label="凭据版本" />
        <el-table-column label="操作" width="200"
          ><template #default="{ row }"
            ><el-button :disabled="busy || row.status !== 'ACTIVE'" link @click="rotate(row)">轮换凭据</el-button
            ><el-button :disabled="busy || row.status !== 'ACTIVE'" link type="danger" @click="suspend(row)">停用</el-button></template
          ></el-table-column
        >
      </el-table>
      <p>显示最近 100 个登记。停用后不可恢复；轮换不会撤销已签发的访问令牌。</p>
    </div>
    <el-alert v-else title="需要业务应用接入管理权限及平台管理员身份。" type="warning" :closable="false" />
    <el-dialog v-model="registration" title="登记业务应用" :close-on-click-modal="false" :show-close="!busy" :close-on-press-escape="!busy">
      <el-form label-width="130px" @submit.prevent="register">
        <el-form-item label="应用名称"><el-input v-model="name" maxlength="200" :disabled="attempted" /></el-form-item>
        <el-form-item label="CSP 负责人 ID"><el-input v-model="owner" :disabled="attempted" /></el-form-item>
        <p v-if="attempted">重试将沿用同一登记请求。结果不确定时，请先刷新列表核对；不会重复返回明文凭据。</p>
        <el-button type="primary" native-type="submit" :loading="busy">{{ attempted ? '重试原请求' : '登记' }}</el-button>
      </el-form>
    </el-dialog>
    <el-dialog
      v-model="credentialVisible"
      title="保存客户端凭据"
      :close-on-click-modal="false"
      @closed="
        secret = '';
        clientId = '';
      "
    >
      <el-alert title="凭据只展示一次，关闭后无法找回。请保存至受控秘密管理系统。" type="warning" :closable="false" />
      <p>客户端 ID：{{ clientId }}</p>
      <el-input :model-value="secret" readonly aria-label="一次性客户端凭据" />
      <template #footer><el-button @click="credentialVisible = false">已保存，关闭</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useUserStore } from '@/store/modules/user';
import {
  listBusinessApplications,
  registerBusinessApplication,
  rotateBusinessApplication,
  suspendBusinessApplication
} from '@/api/system/businessApplications';
import type { BusinessApplication, Credential } from '@/api/system/businessApplications';
const user = useUserStore();
const allowed = computed(() => user.permissions.includes('sys:business-application:manage') || user.permissions.includes('*:*:*'));
const rows = ref<BusinessApplication[]>([]);
const loading = ref(false),
  busy = ref(false),
  registration = ref(false),
  credentialVisible = ref(false),
  attempted = ref(false);
const error = ref(''),
  name = ref(''),
  owner = ref(''),
  secret = ref(''),
  clientId = ref('');
let requestId = '';
async function load() {
  if (!allowed.value) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await listBusinessApplications();
    rows.value = response.data;
  } catch {
    rows.value = [];
    error.value = '无法加载登记，请检查权限、服务状态后重试。';
  } finally {
    loading.value = false;
  }
}
function openRegistration() {
  if (!attempted.value) {
    name.value = '';
    owner.value = '';
    requestId = crypto.randomUUID();
  }
  registration.value = true;
}
function reveal(value: Credential) {
  if (value.clientSecret) {
    clientId.value = value.application.applicationId;
    secret.value = value.clientSecret;
    credentialVisible.value = true;
  } else ElMessage.info('登记已存在，凭据不重复返回；如未保存，请明确执行轮换。');
}
async function register() {
  if (busy.value) return;
  if (!name.value.trim() || !/^[1-9][0-9]*$/.test(owner.value)) {
    ElMessage.warning('请输入应用名称和有效的 CSP 负责人 ID');
    return;
  }
  busy.value = true;
  attempted.value = true;
  try {
    const response = await registerBusinessApplication({ requestId, name: name.value.trim(), ownerUserId: owner.value });
    reveal(response.data);
    registration.value = false;
    attempted.value = false;
    await load();
  } catch {
    ElMessage.error('登记未确认，请刷新核对或使用原请求重试。');
  } finally {
    busy.value = false;
  }
}
async function mutate(row: BusinessApplication, rotateSecret: boolean) {
  if (busy.value) return;
  try {
    await ElMessageBox.confirm(rotateSecret ? '轮换后旧凭据无法申请新令牌，继续？' : '停用后后续机器调用将被拒绝，且不可恢复，继续？', row.name);
  } catch {
    return;
  }
  busy.value = true;
  try {
    const response = await (rotateSecret ? rotateBusinessApplication(row) : suspendBusinessApplication(row));
    if (rotateSecret) reveal(response.data);
    await load();
  } catch {
    ElMessage.error('操作未确认，请刷新核对状态，勿自动重复轮换。');
    await load();
  } finally {
    busy.value = false;
  }
}
const rotate = (row: BusinessApplication) => mutate(row, true);
const suspend = (row: BusinessApplication) => mutate(row, false);
onMounted(load);
onBeforeUnmount(() => {
  secret.value = '';
  clientId.value = '';
});
</script>
