<template>
  <el-dialog v-model="departmentOpen" :title="department.id != null ? '修改部门' : department.pid === '0' ? '新增部门' : '新增下级部门'" width="min(500px, 96vw)" append-to-body>
    <el-form :model="department" label-width="84px" :disabled="saving" @submit.prevent="saveDepartment">
      <el-form-item label="部门名称" required><el-input v-model="department.name" maxlength="64" /></el-form-item>
      <el-form-item label="显示排序" required><el-input-number v-model="department.sort" :min="1" :max="9999" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="departmentOpen = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveDepartment">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="accountOpen" :title="restoringLocalOrigin ? '恢复本地账号' : account.id == null ? '新增申请用户' : '申请用户详情'" width="min(680px, 96vw)" append-to-body
    @closed="account.password = ''">
    <el-alert v-if="restoringLocalOrigin" title="请选择原部门，并核对域账号和邮箱后保存。" type="warning" :closable="false" class="mb12" />
    <el-form :model="account" label-width="84px" :disabled="saving || !canEditAccount" @submit.prevent="saveAccount">
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12">
          <el-form-item label="用户名" required><el-input v-model="account.username" placeholder="请输入用户名" maxlength="30" /></el-form-item>
        </el-col>
        <el-col v-if="account.id == null" :xs="24" :sm="12">
          <el-form-item label="初始密码" required><el-input v-model="account.password" placeholder="请输入初始密码" type="password" show-password maxlength="30" /></el-form-item>
        </el-col>
        <el-col v-if="account.userCategory === 'individual' || domainAccountLocked" :xs="24" :sm="12">
          <el-form-item label="域账号">
            <el-input v-model="domainAccount" placeholder="请输入员工制证使用的域账号" :disabled="account.userCategory !== 'individual'" maxlength="128" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="邮箱"><el-input v-model="account.mail" placeholder="请输入邮箱" maxlength="50" /></el-form-item>
        </el-col>
        <template v-if="account.userCategory === 'individual'">
          <el-col :xs="24" :sm="12"><el-form-item label="工号"><el-input v-model="employeeAttributes.employeeNo" maxlength="64" /></el-form-item></el-col>
          <el-col :xs="24" :sm="12"><el-form-item label="性别"><el-select v-model="employeeAttributes.gender" clearable style="width: 100%"><el-option label="男" value="1" /><el-option label="女" value="2" /></el-select></el-form-item></el-col>
          <el-col :xs="24" :sm="12"><el-form-item label="岗位"><el-input v-model="employeeAttributes.jobName" maxlength="128" /></el-form-item></el-col>
        </template>
        <el-col :xs="24" :sm="12">
          <el-form-item label="所属部门" required>
            <el-tree-select v-model="account.deptId" :data="departments" :props="deptProps" node-key="id" check-strictly
              placeholder="请选择所属部门" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="用户类别" required>
            <el-select v-model="account.userCategory" :disabled="restoringLocalOrigin" style="width: 100%">
              <el-option label="个人用户" value="individual" />
              <el-option label="企业用户" value="organization" />
              <el-option label="设备用户" value="device" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="手机号码"><el-input v-model="account.mobile" placeholder="请输入手机号码" maxlength="11" /></el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="状态">
            <el-select v-model="account.status" style="width: 100%">
              <el-option label="启用" :value="0" /><el-option label="停用" :value="1" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button v-if="canEditAccount && account.id != null && !restoringLocalOrigin" :disabled="saving" @click="resetPassword">重置密码</el-button>
      <el-button v-if="canEditAccount && account.id != null && !restoringLocalOrigin" type="danger" plain :disabled="saving" @click="removeAccount">删除</el-button>
      <el-button @click="accountOpen = false">{{ account.id == null ? '取消' : '关闭' }}</el-button>
      <el-button v-if="canEditAccount" type="primary" :loading="saving" @click="saveAccount">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getDept, modifyDept, saveDept } from '@/api/ra/dept';
import type { RaDeptForm, RaDeptTreeOption } from '@/api/ra/dept/types';
import { addUser, deleteLocalUser, getUser, resetUserPwd, updateUser } from '@/api/ra/user';
import type { UserForm } from '@/api/system/user/types';
import type { FawvwEmployee } from '@/api/ra/employee';
import auth from '@/plugins/auth';

const props = defineProps<{ departments: RaDeptTreeOption[]; allowLocalRecovery?: boolean }>();
const emit = defineEmits<{ departmentsChanged: []; accountsChanged: [deletedId?: string | number] }>();
const departmentOpen = ref(false);
const accountOpen = ref(false);
const restoringLocalOrigin = ref(false);
const saving = ref(false);
const department = reactive<RaDeptForm>({});
const account = reactive<UserForm>({ username: '', password: '', status: 0, roleIds: [], postIds: [] });
const domainAccount = ref('');
const domainAccountLocked = ref(false);
const employeeAttributes = reactive({ employeeNo: '', gender: '', jobName: '' });
const deptProps = { value: 'id', label: 'name', children: 'children' };
const canEditAccount = computed(() => restoringLocalOrigin.value ? props.allowLocalRecovery === true : auth.hasPermi('ra:user'));

async function openDepartment(deptId: string, edit = false) {
  if (edit) {
    const { data } = await getDept(deptId);
    if (!data) return;
    Object.assign(department, { id: data.id, pid: data.pid, name: data.name, sort: data.sort });
  } else {
    Object.assign(department, { id: undefined, pid: deptId, name: '', sort: 1 });
  }
  departmentOpen.value = true;
}

async function saveDepartment() {
  if (saving.value) return;
  const name = department.name?.trim();
  if (!name || department.pid == null || !department.sort) {
    ElMessage.warning('请填写部门名称和排序');
    return;
  }
  saving.value = true;
  try {
    await (department.id == null ? saveDept : modifyDept)({ ...department, name });
    departmentOpen.value = false;
    emit('departmentsChanged');
    ElMessage.success('部门已保存');
  } finally {
    saving.value = false;
  }
}

async function openAccount(deptId?: string, userId?: string | number, employee?: FawvwEmployee, restoreLocalOrigin = false) {
  const user = userId == null ? undefined : (await getUser(userId)).data;
  if ((userId != null || restoreLocalOrigin) && !user?.id) return;
  restoringLocalOrigin.value = restoreLocalOrigin;
  Object.assign(account, {
    id: user?.id, deptId: restoreLocalOrigin ? undefined : user?.deptId == null ? deptId : String(user.deptId), username: user?.username || '',
    password: '', mail: user?.mail || '', mobile: user?.mobile || '', status: Number(user?.status ?? 0),
    userCategory: user?.userCategory || 'individual'
  });
  domainAccount.value = user?.domainAccount || '';
  domainAccountLocked.value = Boolean(user?.domainAccount);
  Object.assign(employeeAttributes, { employeeNo: employee?.employeeNo || '', gender: employee?.gender || '', jobName: employee?.jobName || '' });
  accountOpen.value = true;
}

async function saveAccount() {
  if (saving.value || !canEditAccount.value) return;
  const username = account.username.trim();
  if (!account.deptId || username.length < 2 || (account.id == null && account.password.length < 6)) {
    ElMessage.warning(restoringLocalOrigin.value ? '请选择原部门' : '请选择部门，填写用户名和初始密码');
    return;
  }
  if (domainAccountLocked.value && account.userCategory === 'individual' && !domainAccount.value.trim()) {
    ElMessage.warning('已关联的域账号不能清空');
    return;
  }
  if (account.id != null && Number(account.status) !== 0) {
    if (!await ElMessageBox.confirm('确认保存为停用状态？该账号将不能发起新申请。', '确认停用').then(() => true, () => false)) return;
  }
  saving.value = true;
  try {
    await (account.id == null ? addUser : updateUser)(
      { ...account, username },
      account.userCategory === 'individual' ? domainAccount.value.trim() || undefined : undefined,
      {
        ...(account.userCategory === 'individual' ? employeeAttributes : {}),
        ...(restoringLocalOrigin.value ? { restoreLocalOrigin: true } : {})
      }
    );
    accountOpen.value = false;
    emit('accountsChanged');
    ElMessage.success(restoringLocalOrigin.value ? '本地账号已恢复' : '申请用户已保存');
  } finally {
    account.password = '';
    saving.value = false;
  }
}

async function resetPassword() {
  const id = account.id;
  if (id == null) return;
  const input = await ElMessageBox.prompt('请输入新密码', '重置密码', {
    inputType: 'password', inputPattern: /^.{6,30}$/, inputErrorMessage: '密码长度必须介于 6 和 30 之间',
    closeOnClickModal: false
  }).catch(() => null);
  if (!input) return;
  await resetUserPwd(id, input.value);
  ElMessage.success('密码已重置');
}

async function removeAccount() {
  const id = account.id;
  if (id == null || saving.value) return;
  saving.value = true;
  try {
    const confirmed = await ElMessageBox.confirm(
      '将永久删除该本地用户及员工档案，已签发的证书不会删除。确认继续？', '删除本地用户',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    ).then(() => true, () => false);
    if (!confirmed) return;
    await deleteLocalUser(id);
    accountOpen.value = false;
    emit('accountsChanged', id);
    ElMessage.success('本地用户已删除');
  } finally {
    saving.value = false;
  }
}

defineExpose({ openAccount, openDepartment });
</script>
