<template>
  <div class="p-2 ra-dept-page">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="部门名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入部门名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </transition>

    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <el-button v-hasPermi="['sys:dept:save', 'ra:dept']" type="primary" plain icon="Plus" @click="handleAdd()">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="info" plain icon="Sort" @click="toggleAllDepartments">展开/折叠</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
        </el-row>
      </template>

      <el-table
        v-loading="loading"
        :data="departmentRows"
        row-key="id"
        border
      >
        <el-table-column label="部门名称" min-width="220">
          <template #default="{ row }">
            <div class="flex min-w-0 items-center gap-1" :style="{ paddingInlineStart: Math.min(row.depth * 16, 120) + 'px' }">
              <el-button v-if="row.hasChildren" class="w-5 shrink-0" link :icon="row.expanded ? 'ArrowDown' : 'ArrowRight'"
                :aria-expanded="row.expanded" :aria-label="row.expanded ? '折叠下级部门' : '展开下级部门'" @click="toggleDepartment(row.id)" />
              <span v-else class="w-5 shrink-0" aria-hidden="true" />
              <span class="truncate" :title="row.dept.name">{{ row.dept.name }}</span>
              <el-tag v-if="row.dept.organization" size="small" class="shrink-0">独立机构</el-tag>
              <el-tag v-if="!row.dept.writable" type="info" size="small" class="shrink-0">只读</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="dept.sort" align="center" label="排序" width="90" />
        <el-table-column label="创建时间" align="center" prop="createTime" width="180">
          <template #default="{ row }">
            <span>{{ proxy?.parseTime(row.dept.createTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column fixed="right" align="center" label="操作" :width="applicantPath ? 232 : 150">
          <template #default="{ row }">
            <el-button v-if="applicantPath" link type="primary" icon="User" @click="openDepartmentApplicants(row.dept)">申请用户</el-button>
            <el-tooltip v-if="row.dept.writable" content="修改" placement="top">
              <el-button v-hasPermi="['sys:dept:modify', 'ra:dept']" link type="primary" icon="Edit" @click="handleUpdate(row.dept)" />
            </el-tooltip>
            <el-tooltip v-if="row.dept.writable" content="新增下级" placement="top">
              <el-button v-hasPermi="['sys:dept:save', 'ra:dept']" link type="primary" icon="Plus" @click="handleAdd(row.dept)" />
            </el-tooltip>
            <el-tooltip v-if="row.dept.writable && !row.dept.organization" content="删除" placement="top">
              <el-button v-hasPermi="['sys:dept:remove', 'ra:dept']" link type="primary" icon="Delete" @click="handleDelete(row.dept)" />
            </el-tooltip>
            <el-tooltip v-if="isRaAdmin && row.dept.organization" content="机构 CA 和模板" placement="top">
              <el-button link type="primary" icon="CircleCheck" @click="openScope(row.dept)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-if="departmentTotal > departmentPageSize" v-model:page="departmentPage" :limit="departmentPageSize"
        :total="departmentTotal" layout="total, prev, pager, next" />
    </el-card>

    <el-dialog v-model="dialog.visible" :title="dialog.title" destroy-on-close append-to-body width="560px">
      <el-form ref="deptFormRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="上级部门" prop="pid">
          <el-tree-select
            v-model="form.pid"
            :data="deptOptions"
            :disabled="parentLocked"
            :props="{ value: 'id', label: 'name', children: 'children' } as any"
            value-key="id"
            placeholder="请选择上级部门"
            check-strictly
          />
        </el-form-item>
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入部门名称" maxlength="64" />
        </el-form-item>
        <el-form-item v-if="isRaAdmin" label="独立机构">
          <el-checkbox v-model="form.organization" :disabled="organizationLocked">将此部门设为独立机构</el-checkbox>
        </el-form-item>
        <el-form-item label="显示排序" prop="sort">
          <el-input-number v-model="form.sort" controls-position="right" :min="1" :max="9999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog v-model="scopeDialog" :title="`机构证书授权 · ${scopeDepartment?.name || ''}`" width="640px" append-to-body>
      <el-form v-loading="scopeLoading" label-position="top">
        <el-form-item v-for="root in scopeRoots" :key="String(root.id)" :label="root.name">
          <el-checkbox-group v-model="selectedProfiles[String(root.id)]">
            <el-checkbox v-for="profile in root.profiles" :key="String(profile.id)" :value="String(profile.id)">{{ profile.name }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-empty v-if="!scopeLoading && !scopeRoots.length" description="暂无可授权的证书模板" />
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="scopeSaving" :disabled="scopeLoading || !scopeReady" @click="submitScope">保存</el-button>
        <el-button @click="scopeDialog = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaDept" lang="ts">
import { useRaListRefreshOnReturn } from '@/hooks/useRaListRefreshOnReturn';
import { getDept, listDeptSelectTree, listDeptTree, modifyDept, removeDept, saveDept } from '@/api/ra/dept';
import { RaDeptForm, RaDeptQuery, RaDeptTreeOption, RaDeptVO, writableRaDepartments } from '@/api/ra/dept/types';

import { getAssignableRaRoles } from '@/api/ra/adminUser';
import { getOrganizationCertScopes, listUserCertScopeOptions, saveOrganizationCertScopes } from '@/api/ra/userCertScope';
import type { RaUserCertScopeRoot } from '@/api/ra/userCertScope';
import { useUserStore } from '@/store/modules/user';
import { useRouter } from 'vue-router';
import { shallowRef } from 'vue';
import { applicantDirectoryPath } from '@/utils/fawvwEmployeeNavigation';
import { usePagedDepartmentTree } from '@/hooks/usePagedDepartmentTree';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const router = useRouter();
const applicantPath = computed(() => applicantDirectoryPath(router));

function openDepartmentApplicants(row: RaDeptVO) {
  if (applicantPath.value && row.id != null) void router.push({ path: applicantPath.value, query: { deptId: String(row.id) } });
}

const isRaAdmin = ref(false);
const organizationLocked = ref(false);
const parentLocked = ref(false);
const scopeDialog = ref(false);
const scopeLoading = ref(false);
const scopeSaving = ref(false);
const scopeReady = ref(false);
const scopeDepartment = ref<RaDeptVO>();
const scopeRoots = ref<RaUserCertScopeRoot[]>([]);
const selectedProfiles = ref<Record<string, string[]>>({});

async function openScope(row: RaDeptVO) {
  if (row.id == null) return;
  scopeDepartment.value = row;
  scopeDialog.value = true;
  scopeLoading.value = true;
  scopeReady.value = false;
  scopeRoots.value = [];
  selectedProfiles.value = {};
  try {
    const [options, current] = await Promise.all([listUserCertScopeOptions(), getOrganizationCertScopes(row.id)]);
    const selected = new Map((current.data || []).map((scope) => [String(scope.rootId), new Set(scope.profileIds.map(String))]));
    scopeRoots.value = options.data || [];
    selectedProfiles.value = Object.fromEntries(
      scopeRoots.value.map((root) => {
        const allowed = selected.get(String(root.id));
        return [String(root.id), root.profiles.map((profile) => String(profile.id)).filter((id) => allowed?.has(id))];
      })
    );
    scopeReady.value = true;
  } finally {
    scopeLoading.value = false;
  }
}

async function submitScope() {
  const id = scopeDepartment.value?.id;
  if (id == null || !scopeReady.value || scopeSaving.value) return;
  scopeSaving.value = true;
  try {
    const roots = scopeRoots.value
      .map((root) => ({ rootId: String(root.id), profileIds: selectedProfiles.value[String(root.id)] || [] }))
      .filter((root) => root.profileIds.length > 0);
    await saveOrganizationCertScopes(id, roots);
    proxy?.$modal.msgSuccess('机构证书授权已保存');
    scopeDialog.value = false;
  } finally {
    scopeSaving.value = false;
  }
}

const deptList = shallowRef<RaDeptVO[]>([]);
const {
  rows: departmentRows, page: departmentPage, total: departmentTotal, pageSize: departmentPageSize,
  toggle: toggleDepartment, toggleAll: toggleAllDepartments, reset: resetDepartmentTree
} = usePagedDepartmentTree(deptList, (dept) => dept.id);
const deptOptions = ref<RaDeptTreeOption[]>([]);
const loading = ref(false);
const showSearch = ref(true);

const dialog = reactive<DialogOption>({
  visible: false,
  title: ''
});

const queryFormRef = ref<ElFormInstance>();
const deptFormRef = ref<ElFormInstance>();

const initFormData: RaDeptForm = {
  id: undefined,
  pid: undefined,
  name: undefined,
  sort: 1
};

const data = reactive<PageData<RaDeptForm, RaDeptQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 100,
    name: undefined
  },
  rules: {
    pid: [{ required: true, message: '上级部门不能为空', trigger: 'change' }],
    name: [{ required: true, message: '部门名称不能为空', trigger: 'blur' }],
    sort: [{ required: true, message: '显示排序不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

const unwrapData = <T,>(res: any, fallback: T): T => {
  return (res?.data ?? fallback) as T;
};

const normalizeTree = <T extends RaDeptVO | RaDeptTreeOption>(list?: T[]): T[] => {
  return (list || []).map((item) => {
    const children = normalizeTree((item.children || []) as T[]);
    return {
      ...item,
      children: children.length > 0 ? children : undefined
    };
  });
};

const filterDeptTree = (list: RaDeptTreeOption[], excludeId?: number | string): RaDeptTreeOption[] => {
  return list
    .filter((item) => String(item.id) !== String(excludeId))
    .map((item) => ({
      ...item,
      children: item.children ? filterDeptTree(item.children, excludeId) : undefined
    }));
};

const getFirstDeptId = (list: RaDeptTreeOption[]): number | string | undefined => {
  return list[0]?.id;
};

const getList = async () => {
  loading.value = true;
  try {
    const res = await listDeptTree({ name: queryParams.value.name });
    deptList.value = unwrapData<RaDeptVO[]>(res, []);
  } finally {
    loading.value = false;
  }
};

const loadDeptOptions = async (excludeId?: number | string) => {
  const res = await listDeptSelectTree();
  const options = filterDeptTree(normalizeTree(writableRaDepartments(unwrapData<RaDeptTreeOption[]>(res, []))), excludeId);
  deptOptions.value = options;
  return getFirstDeptId(options);
};

const cancel = () => {
  reset();
  dialog.visible = false;
};

const reset = () => {
  form.value = { ...initFormData };
  organizationLocked.value = false;
  parentLocked.value = false;
  deptFormRef.value?.resetFields();
};

const handleQuery = () => {
  resetDepartmentTree(Boolean(queryParams.value.name?.trim()));
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};

const handleAdd = async (row?: RaDeptVO) => {
  reset();
  const defaultDeptId = await loadDeptOptions();
  form.value.organization = isRaAdmin.value ? false : undefined;
  form.value.pid = row?.id ?? defaultDeptId;
  if (!form.value.pid) {
    proxy?.$modal.msgWarning('当前账号未绑定可管理部门');
    return;
  }
  dialog.visible = true;
  dialog.title = '新增下级部门';
};

const handleUpdate = async (row: RaDeptVO) => {
  reset();
  await loadDeptOptions(row.id);
  const res = await getDept(row.id as number | string);
  const detail = unwrapData<RaDeptVO>(res, row);
  organizationLocked.value = row.organization === true;
  parentLocked.value = row.movable === false;
  form.value = {
    id: detail.id,
    pid: detail.pid,
    name: detail.name,
    organization: isRaAdmin.value ? row.organization === true : undefined,
    sort: detail.sort ?? 1
  };
  dialog.visible = true;
  dialog.title = '修改部门';
};

const submitForm = () => {
  deptFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    const payload: RaDeptForm = {
      id: form.value.id,
      pid: form.value.pid,
      name: form.value.name,
      sort: form.value.sort ?? 1
    };
    if (payload.id) {
      await modifyDept(payload);
      proxy?.$modal.msgSuccess('修改成功');
    } else {
      await saveDept(payload);
      proxy?.$modal.msgSuccess('新增成功');
    }
    dialog.visible = false;
    await getList();
  });
};

const handleDelete = async (row: RaDeptVO) => {
  await proxy?.$modal.confirm(`是否确认删除部门"${row.name}"？`);
  await removeDept([row.id as number | string]);
  proxy?.$modal.msgSuccess('删除成功');
  await getList();
};

onMounted(async () => {
  if (useUserStore().permissions.includes('ra:admin')) {
    isRaAdmin.value = (await getAssignableRaRoles()).some((role) => role.roleId === '507');
  }
  getList();
});
useRaListRefreshOnReturn(getList);
</script>
