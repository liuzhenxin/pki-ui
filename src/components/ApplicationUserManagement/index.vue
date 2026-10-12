<template>
  <div class="application-users">
    <el-card v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="mb-4" />
      <el-form inline @submit.prevent="load">
        <el-form-item label="用户名"><el-input v-model="username" clearable /></el-form-item>
        <el-form-item><el-button native-type="submit">查询</el-button><el-button @click="load">刷新权限</el-button></el-form-item>
        <el-form-item
          ><el-button v-if="context?.actions.includes('CREATE_USER')" type="primary" @click="openCreate">新增用户</el-button></el-form-item
        >
      </el-form>
      <el-table :data="users" border>
        <el-table-column prop="username" label="用户名" min-width="140" />
        <el-table-column prop="mobile" label="手机" min-width="120" />
        <el-table-column prop="mail" label="邮箱" min-width="160" />
        <el-table-column label="状态" width="80"
          ><template #default="{ row }">{{ Number(row.status) === 0 ? '正常' : '停用' }}</template></el-table-column
        >
        <el-table-column label="操作" min-width="340"
          ><template #default="{ row }">
            <el-button v-for="action in actionsFor(row.id)" :key="action" link type="primary" @click="openAction(row, action)">{{
              labels[action]
            }}</el-button>
          </template></el-table-column
        >
      </el-table>
      <pagination v-model:page="pageNum" v-model:limit="pageSize" :total="total" @pagination="load" />
    </el-card>
    <el-dialog
      destroy-on-close
      v-model="visible"
      :title="labels[action]"
      width="min(560px, 94vw)"
      :close-on-click-modal="false"
      @closed="clearSecrets"
    >
      <el-alert
        v-if="action === 'CREATE_USER' || action === 'ASSIGN_ROLES'"
        title="候选范围以当前权限为准；提交时将再次核验。"
        type="info"
        :closable="false"
        class="mb-4"
      />
      <el-form label-width="90px" @submit.prevent="submit">
        <el-form-item label="用户名"><el-input v-model="form.username" :disabled="action !== 'CREATE_USER'" /></el-form-item>
        <template v-if="action === 'CREATE_USER' || action === 'UPDATE_PROFILE'">
          <el-form-item label="手机"><el-input v-model="form.mobile" /></el-form-item>
          <el-form-item label="邮箱"><el-input v-model="form.mail" /></el-form-item>
        </template>
        <el-form-item v-if="action === 'CREATE_USER' || action === 'RESET_PASSWORD'" label="密码"
          ><el-input v-model="form.password" type="password" show-password autocomplete="new-password"
        /></el-form-item>
        <el-form-item v-if="action === 'SET_STATUS'" label="状态"
          ><el-radio-group v-model="form.status"
            ><el-radio :value="0">正常</el-radio><el-radio :value="1">停用</el-radio></el-radio-group
          ></el-form-item
        >
        <el-form-item v-if="action === 'CREATE_USER' || action === 'ASSIGN_ROLES'" label="角色">
          <el-select v-model="form.roleIds" multiple :multiple-limit="dialogContext?.multiRoleEnabled ? 0 : 1" placeholder="请选择当前可授予角色">
            <el-option v-for="role in candidates" :key="role.id" :value="String(role.id)" :label="role.name" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="action === 'CREATE_USER'" label="部门"
          ><el-select v-model="form.deptId" placeholder="请选择允许部门"
            ><el-option v-for="dept in departments" :key="dept" :value="dept" :label="dept" /></el-select
        ></el-form-item>
        <el-form-item v-if="action === 'BIND_CERTIFICATE'" label="公开证书"
          ><input aria-label="公开证书" type="file" accept=".pem,.crt,.cer" @change="selectCertificate"
        /></el-form-item>
        <el-alert v-if="action === 'DELETE_USER'" title="删除后无法继续使用该账号，请确认目标。" type="warning" :closable="false" />
      </el-form>
      <template #footer
        ><el-button @click="visible = false">取消</el-button
        ><el-button type="primary" :loading="saving" :disabled="!canSubmit" @click="submit">确认</el-button></template
      >
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/utils/request';
import {
  getApplicationAuthorizationContext,
  listAssignableRoles,
  submitUserAction,
  type ApplicationAuthorizationContext
} from '@/api/system/applicationAuthorization';
import { allowedCreateDepartments, canSubmitUserAction } from '@/utils/applicationAuthorization';
const labels: Record<string, string> = {
  CREATE_USER: '新增用户',
  UPDATE_PROFILE: '修改资料',
  SET_STATUS: '修改状态',
  RESET_PASSWORD: '重置密码',
  UNLOCK_LOGIN: '解锁登录',
  DELETE_USER: '删除用户',
  ASSIGN_ROLES: '修改角色',
  BIND_CERTIFICATE: '绑定证书'
};
const certificate = ref<File>();
const context = ref<ApplicationAuthorizationContext>();
const rowContexts = ref<Record<string, ApplicationAuthorizationContext>>({});
const dialogContext = ref<ApplicationAuthorizationContext>();
const users = ref<Record<string, any>[]>([]);
const roles = ref<{ id: string; name: string }[]>([]);
const loading = ref(false),
  saving = ref(false),
  visible = ref(false),
  error = ref('');
const username = ref(''),
  pageNum = ref(1),
  pageSize = ref(10),
  total = ref(0),
  action = ref('');
const form = reactive({ id: '', username: '', mobile: '', mail: '', password: '', status: 0, roleIds: [] as string[], deptId: '' });
const candidateIds = computed(() =>
  action.value === 'CREATE_USER'
    ? [...new Set(dialogContext.value?.createCandidates.map((item) => item.roleId) ?? [])]
    : (dialogContext.value?.assignableRoleIds ?? [])
);
const candidates = computed(() => roles.value.filter((role) => candidateIds.value.includes(String(role.id))));
const departments = computed(() => (dialogContext.value ? allowedCreateDepartments(dialogContext.value, form.roleIds) : []));
const canSubmit = computed(
  () =>
    canSubmitUserAction(dialogContext.value, action.value, form.roleIds, form.deptId) &&
    ((action.value !== 'CREATE_USER' && action.value !== 'RESET_PASSWORD') || form.password.length > 0) &&
    (action.value !== 'CREATE_USER' || form.username.trim().length > 0) &&
    (action.value !== 'BIND_CERTIFICATE' || !!certificate.value)
);
watch(departments, (ids) => {
  if (!ids.includes(form.deptId)) form.deptId = '';
});
function actionsFor(id: string) {
  return (rowContexts.value[String(id)]?.actions ?? []).filter((name) => name !== 'CREATE_USER' && name in labels);
}
function selectCertificate(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  certificate.value = file && file.size > 0 && file.size <= 1024 * 1024 ? file : undefined;
  if (file && !certificate.value) {
    input.value = '';
    ElMessage.error('请选择 1 MB 以内的公开证书');
  }
}
function clearSecrets() {
  form.password = '';
  certificate.value = undefined;
}
async function load() {
  context.value = undefined;
  rowContexts.value = {};
  loading.value = true;
  error.value = '';
  try {
    const current = await getApplicationAuthorizationContext();
    if (current.mode !== 'ENFORCE') throw new Error('授权模式已变化，请重新打开页面');
    const response = await request({
      url: '/admin/v1/users/page',
      method: 'post',
      data: { pageNum: pageNum.value, pageSize: pageSize.value, username: username.value || undefined, params: {} }
    });
    const records = response.data?.records ?? response.data?.rows ?? [];
    const entries = await Promise.all(
      records.map(async (row: Record<string, any>) => {
        try {
          return [String(row.id), await getApplicationAuthorizationContext(String(row.id))] as const;
        } catch {
          return [String(row.id), undefined] as const;
        }
      })
    );
    users.value = records;
    total.value = Number(response.data?.total ?? 0);
    rowContexts.value = Object.fromEntries(entries.filter((entry) => entry[1] !== undefined)) as Record<string, ApplicationAuthorizationContext>;
    context.value = current;
  } catch {
    users.value = [];
    total.value = 0;
    error.value = '无法读取当前管理权限，操作已关闭。请刷新后重试。';
  } finally {
    loading.value = false;
  }
}
async function openCreate() {
  try {
    dialogContext.value = undefined;
    const current = await getApplicationAuthorizationContext();
    if (!current.actions.includes('CREATE_USER')) throw new Error('denied');
    roles.value = await listAssignableRoles();
    Object.assign(form, { id: '', username: '', mobile: '', mail: '', password: '', roleIds: [], deptId: '' });
    dialogContext.value = current;
    action.value = 'CREATE_USER';
    visible.value = true;
  } catch {
    await load();
    ElMessage.error('当前没有可用的创建权限，请刷新后重试');
  }
}
async function openAction(row: Record<string, any>, selected: string) {
  try {
    dialogContext.value = undefined;
    const current = await getApplicationAuthorizationContext(String(row.id));
    if (!current.actions.includes(selected)) throw new Error('denied');
    roles.value = selected === 'ASSIGN_ROLES' ? await listAssignableRoles() : [];
    Object.assign(form, {
      id: String(row.id),
      username: row.username,
      mobile: row.mobile ?? '',
      mail: row.mail ?? '',
      password: '',
      status: Number(row.status),
      roleIds: (row.roleIds ?? []).map(String),
      deptId: ''
    });
    dialogContext.value = current;
    action.value = selected;
    visible.value = true;
  } catch {
    await load();
    ElMessage.error('当前权限已变化，请刷新后重试');
  }
}
async function submit() {
  if (!canSubmit.value || saving.value) return;
  saving.value = true;
  try {
    await submitUserAction(action.value, action.value === 'BIND_CERTIFICATE' ? { id: form.id, file: certificate.value } : form);
    visible.value = false;
    ElMessage.success('操作成功');
    await load();
  } catch {
    visible.value = false;
    dialogContext.value = undefined;
    ElMessage.error('操作未完成，请刷新当前权限后重新操作');
    await load();
  } finally {
    clearSecrets();
    saving.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.application-users {
  padding: 16px;
}
:deep(.el-select) {
  width: 100%;
}
@media (max-width: 640px) {
  .application-users {
    padding: 8px;
  }
}
</style>
