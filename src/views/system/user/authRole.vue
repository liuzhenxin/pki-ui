<template>
  <div class="p-2">
    <div class="panel">
      <h4 class="panel-title">基本信息</h4>
      <el-form :model="form" :inline="true">
        <el-row :gutter="10">
          <el-col :span="2.5">
            <el-form-item label="用户昵称" prop="nickName">
              <el-input v-model="form.nickName" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="2.5">
            <el-form-item label="登录账号" prop="userName">
              <el-input v-model="form.userName" disabled />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>
    <div class="panel">
      <h4 class="panel-title">角色信息</h4>
      <div>
        <el-table
          ref="tableRef"
          v-loading="loading"
          border
          :row-key="getRowKey"
          :data="roles"
          @row-click="clickRow"
          @selection-change="handleSelectionChange"
        >
          <el-table-column label="序号" width="55" type="index" align="center">
            <template #default="scope">
              <span>{{ scope.$index + 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column type="selection" :reserve-selection="true" :selectable="checkSelectable" width="55"></el-table-column>
          <el-table-column label="角色编号" align="center" prop="roleId" />
          <el-table-column label="角色名称" align="center" prop="roleName" />
          <el-table-column label="权限字符" align="center" prop="roleKey" />
          <el-table-column label="创建时间" align="center" prop="createTime" width="180">
            <template #default="scope">
              <span>{{ proxy.parseTime(scope.row.createTime) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <div></div>
      </div>
    </div>
    <div class="panel">
      <h4 class="panel-title">可操作证书范围</h4>
      <div class="cert-scope">
        <div class="cert-scope-list">
          <div class="cert-scope-toolbar">
            <span>根证书</span>
            <div>
              <el-button size="small" :disabled="scopeLoading || !rootOptions.length" @click="selectAllRoots">全选</el-button>
              <el-button size="small" :disabled="scopeLoading || !rootOptions.length" @click="clearAllRoots">全不选</el-button>
            </div>
          </div>
          <el-table v-loading="scopeLoading" border :data="rootOptions" highlight-current-row @row-click="handleRootRowClick">
            <el-table-column label="授权" align="center" width="90">
              <template #default="scope">
                <el-checkbox v-model="scope.row.authorized" @change="handleRootAuthorizeChange(scope.row)" />
              </template>
            </el-table-column>
            <el-table-column label="根证书名称" prop="name" min-width="180" show-overflow-tooltip />
          </el-table>
        </div>
        <div class="cert-scope-list">
          <div class="cert-scope-toolbar">
            <span>{{ activeRoot?.name || '请选择根证书' }}</span>
            <div>
              <el-button
                size="small"
                :disabled="scopeLoading || !activeRoot || !activeRoot.authorized || !activeProfiles.length"
                @click="selectAllProfiles"
                >全选</el-button
              >
              <el-button
                size="small"
                :disabled="scopeLoading || !activeRoot || !activeRoot.authorized || !activeProfiles.length"
                @click="clearProfiles"
                >全不选</el-button
              >
            </div>
          </div>
          <el-table v-loading="scopeLoading" border :data="activeProfiles" empty-text="请选择根证书后查看模板">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column label="模板名称" prop="name" min-width="180" show-overflow-tooltip />
            <el-table-column label="类型" align="center" width="140">
              <template #default="scope">
                <el-tag v-if="scope.row.type === 'RootCA'" type="danger">根CA</el-tag>
                <el-tag v-else-if="scope.row.type === 'IntermediateCA'" type="warning">中间CA</el-tag>
                <el-tag v-else-if="scope.row.type === 'EndEntity'" type="success">终端实体</el-tag>
                <el-tag v-else>{{ scope.row.type || '-' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="授权状态" align="center" width="130">
              <template #default="scope">
                <el-checkbox v-model="scope.row.authorized" :disabled="!activeRoot?.authorized" @change="handleProfileAuthorizeChange">
                  {{ scope.row.authorized ? '已授权' : '未授权' }}
                </el-checkbox>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
    <div style="text-align: center; margin-left: -120px; margin-top: 30px">
      <el-button type="primary" :loading="submitting" @click="submitForm()">提交</el-button>
      <el-button @click="close()">返回</el-button>
    </div>
  </div>
</template>

<script setup name="AuthRole" lang="ts">
import { RoleVO } from '@/api/system/role/types';
import { getAuthRole as getSystemAuthRole, updateAuthRole as updateSystemAuthRole } from '@/api/system/user';
import { getAuthRole as getRaAuthRole, updateAuthRole as updateRaAuthRole } from '@/api/ra/user';
import { UserForm } from '@/api/system/user/types';
import { getUserCertScopes, listUserCertScopeOptions, saveUserCertScopes } from '@/api/ra/userCertScope';
import type { RaUserCertScopeRoot, RaUserCertScopeSaveRoot } from '@/api/ra/userCertScope';
import { RouteLocationNormalized } from 'vue-router';

const route = useRoute();
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(true);
const scopeLoading = ref(true);
const submitting = ref(false);
const roleIds = ref<Array<string | number>>([]);
const roles = ref<RoleVO[]>([]);
const rootOptions = ref<RaUserCertScopeRoot[]>([]);
const activeRootId = ref<string | number | undefined>(undefined);
const form = ref<Partial<UserForm>>({
  nickName: undefined,
  userName: '',
  userId: undefined
});

const tableRef = ref<ElTableInstance>();
const activeRoot = computed(() => rootOptions.value.find((root) => String(root.id) === String(activeRootId.value)));
const activeProfiles = computed(() => activeRoot.value?.profiles || []);
const backPath = computed(() => {
  const redirect = route.query.redirect;
  if (Array.isArray(redirect)) {
    return redirect[0] || '/system/user';
  }
  return redirect || '/system/user';
});
const isRaAuth = computed(() => String(backPath.value || '').startsWith('/ra'));

/** 单击选中行数据 */
const clickRow = (row: RoleVO) => {
  if (checkSelectable(row)) {
    row.flag = !row.flag;
    tableRef.value?.toggleRowSelection(row, row.flag);
  }
};
/** 多选框选中数据 */
const handleSelectionChange = (selection: RoleVO[]) => {
  roleIds.value = selection.map((item) => item.roleId);
};
/** 保存选中的数据编号 */
const getRowKey = (row: RoleVO): string => {
  return String(row.roleId);
};
/** 检查角色状态 */
const checkSelectable = (row: RoleVO): boolean => {
  return row.status === '0';
};
/** 关闭按钮 */
const close = () => {
  const obj: RouteLocationNormalized = {
    fullPath: '',
    hash: '',
    matched: [],
    meta: undefined,
    name: undefined,
    params: undefined,
    query: undefined,
    redirectedFrom: undefined,
    path: backPath.value
  };
  proxy?.$tab.closeOpenPage(obj);
};
/** 提交按钮 */
const submitForm = async () => {
  const userId = form.value.userId;
  if (!userId || submitting.value) return;
  submitting.value = true;
  try {
    const rIds = roleIds.value.join(',');
    await (isRaAuth.value ? updateRaAuthRole : updateSystemAuthRole)({ userId: userId as string, roleIds: rIds });
    await saveUserCertScopes(userId, buildScopePayload());
    proxy?.$modal.msgSuccess('授权成功');
    close();
  } finally {
    submitting.value = false;
  }
};

const getList = async () => {
  const userId = route.params && route.params.userId;
  if (userId) {
    loading.value = true;
    scopeLoading.value = true;
    try {
      const [res] = await Promise.all([(isRaAuth.value ? getRaAuthRole : getSystemAuthRole)(userId as string), loadScopeOptions(userId as string)]);
      Object.assign(form.value, res.data.user);
      Object.assign(roles.value, res.data.roles);
      await nextTick(() => {
        roles.value.forEach((row) => {
          if (row?.flag) {
            tableRef.value?.toggleRowSelection(row, true);
          }
        });
      });
    } finally {
      loading.value = false;
      scopeLoading.value = false;
    }
  }
};

async function loadScopeOptions(userId: string | number) {
  const [optionsRes, scopesRes] = await Promise.all([listUserCertScopeOptions(), getUserCertScopes(userId)]);
  const selectedMap = new Map<string, Set<string>>();
  (scopesRes.data?.roots || []).forEach((root: RaUserCertScopeSaveRoot) => {
    selectedMap.set(String(root.rootId), new Set((root.profileIds || []).map((profileId) => String(profileId))));
  });
  rootOptions.value = (optionsRes.data || []).map((root) => {
    const selectedProfileIds = selectedMap.get(String(root.id)) || new Set<string>();
    const profiles = (root.profiles || []).map((profile) => ({
      ...profile,
      authorized: selectedProfileIds.has(String(profile.id))
    }));
    return {
      ...root,
      profiles,
      authorized: profiles.some((profile) => profile.authorized)
    };
  });
  activeRootId.value = rootOptions.value.find((root) => root.authorized)?.id || rootOptions.value[0]?.id;
}

function handleRootRowClick(row: RaUserCertScopeRoot) {
  activeRootId.value = row.id;
}

function handleRootAuthorizeChange(root: RaUserCertScopeRoot) {
  root.profiles = (root.profiles || []).map((profile) => ({
    ...profile,
    authorized: !!root.authorized
  }));
  activeRootId.value = root.id;
}

function handleProfileAuthorizeChange() {
  const root = activeRoot.value;
  if (!root) return;
  root.authorized = (root.profiles || []).some((profile) => profile.authorized);
}

function selectAllRoots() {
  rootOptions.value.forEach((root) => {
    root.authorized = true;
    root.profiles = (root.profiles || []).map((profile) => ({ ...profile, authorized: true }));
  });
}

function clearAllRoots() {
  rootOptions.value.forEach((root) => {
    root.authorized = false;
    root.profiles = (root.profiles || []).map((profile) => ({ ...profile, authorized: false }));
  });
}

function selectAllProfiles() {
  const root = activeRoot.value;
  if (!root) return;
  root.authorized = true;
  root.profiles = (root.profiles || []).map((profile) => ({ ...profile, authorized: true }));
}

function clearProfiles() {
  const root = activeRoot.value;
  if (!root) return;
  root.profiles = (root.profiles || []).map((profile) => ({ ...profile, authorized: false }));
  root.authorized = false;
}

function buildScopePayload(): RaUserCertScopeSaveRoot[] {
  return rootOptions.value
    .map((root) => ({
      rootId: root.id,
      profileIds: (root.profiles || []).filter((profile) => profile.authorized).map((profile) => profile.id)
    }))
    .filter((root) => root.profileIds.length > 0);
}

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.cert-scope {
  display: grid;
  grid-template-columns: minmax(240px, 360px) minmax(0, 1fr);
  gap: 16px;
}

.cert-scope-list {
  min-width: 0;
}

.cert-scope-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
  margin-bottom: 8px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .cert-scope {
    grid-template-columns: 1fr;
  }
}
</style>
