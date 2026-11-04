<template>
  <div class="application-roles">
    <el-card v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-alert v-else-if="context && !context.customRoleEnabled" title="当前应用未启用自定义角色" type="info" :closable="false" />
      <el-form inline @submit.prevent="load">
        <el-form-item label="角色名称"><el-input v-model="name" clearable /></el-form-item>
        <el-form-item><el-button native-type="submit">查询</el-button><el-button @click="load">刷新权限</el-button></el-form-item>
        <el-form-item
          ><el-button v-if="context?.actions.includes('CREATE_ROLE')" type="primary" @click="openCreate">新增角色草稿</el-button></el-form-item
        >
      </el-form>
      <el-table :data="roles" border>
        <el-table-column prop="name" label="角色名称" min-width="160" />
        <el-table-column prop="sort" label="排序" width="90" />
        <el-table-column label="操作" min-width="180"
          ><template #default="{ row }">
            <el-button v-for="action in actionsFor(row.id)" :key="action" link type="primary" @click="open(row, action)">{{
              labels[action]
            }}</el-button>
          </template></el-table-column
        >
      </el-table>
      <pagination v-model:page="pageNum" v-model:limit="pageSize" :total="total" @pagination="load" />
    </el-card>
    <el-dialog v-model="visible" :title="labels[action]" width="min(520px,94vw)" :close-on-click-modal="false">
      <el-alert v-if="action === 'CREATE_ROLE'" title="新角色保存为草稿，发布后才可分配给用户。" type="info" :closable="false" />
      <el-alert v-if="action === 'DELETE_ROLE'" title="确认删除此角色？服务器将重新检查绑定和保护关系。" type="warning" :closable="false" />
      <el-form v-else label-width="90px" @submit.prevent="submit">
        <el-form-item label="角色名称"><el-input v-model="form.name" maxlength="100" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" :max="2147483647" /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="visible = false">取消</el-button
        ><el-button type="primary" :loading="saving" :disabled="!allowed" @click="submit">确认</el-button></template
      >
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/utils/request';
import {
  getApplicationAuthorizationContext,
  getApplicationRoleContext,
  submitRoleAction,
  type ApplicationAuthorizationContext
} from '@/api/system/applicationAuthorization';
const labels: Record<string, string> = { CREATE_ROLE: '新增角色草稿', UPDATE_ROLE_METADATA: '修改资料', DELETE_ROLE: '删除角色' };
const context = ref<ApplicationAuthorizationContext>(),
  dialogContext = ref<ApplicationAuthorizationContext>();
const rowContexts = ref<Record<string, ApplicationAuthorizationContext>>({});
const roles = ref<{ id: string; name: string; sort: number }[]>([]);
const loading = ref(false),
  saving = ref(false),
  visible = ref(false),
  error = ref(''),
  name = ref(''),
  action = ref('');
const pageNum = ref(1),
  pageSize = ref(10),
  total = ref(0);
const form = reactive({ id: '', name: '', sort: 0 });
const allowed = computed(
  () =>
    dialogContext.value?.mode === 'ENFORCE' &&
    dialogContext.value.customRoleEnabled &&
    dialogContext.value.actions.includes(action.value) &&
    (action.value === 'DELETE_ROLE' || form.name.trim().length > 0)
);
function actionsFor(id: string) {
  return (rowContexts.value[String(id)]?.actions ?? []).filter((a) => a in labels);
}
async function load() {
  context.value = undefined;
  rowContexts.value = {};
  loading.value = true;
  error.value = '';
  try {
    const current = await getApplicationAuthorizationContext();
    if (current.mode !== 'ENFORCE') throw new Error('mode');
    if (!current.customRoleEnabled) {
      context.value = current;
      roles.value = [];
      total.value = 0;
      return;
    }
    const response = await request({
      url: '/admin/v1/roles/page',
      method: 'post',
      data: { pageNum: pageNum.value, pageSize: pageSize.value, name: name.value || undefined, params: {} }
    });
    const records = response.data?.records ?? [];
    const entries = await Promise.all(
      records.map(async (row: { id: string }) => {
        try {
          return [String(row.id), await getApplicationRoleContext(String(row.id))] as const;
        } catch {
          return [String(row.id), undefined] as const;
        }
      })
    );
    roles.value = records;
    total.value = Number(response.data?.total ?? 0);
    context.value = current;
    rowContexts.value = Object.fromEntries(entries.filter((e) => e[1])) as Record<string, ApplicationAuthorizationContext>;
  } catch {
    roles.value = [];
    total.value = 0;
    error.value = '无法读取当前角色权限，操作已关闭。请刷新后重试。';
  } finally {
    loading.value = false;
  }
}
async function openCreate() {
  try {
    dialogContext.value = undefined;
    const current = await getApplicationAuthorizationContext();
    if (current.mode !== 'ENFORCE' || !current.customRoleEnabled || !current.actions.includes('CREATE_ROLE')) throw new Error('denied');
    Object.assign(form, { id: '', name: '', sort: 0 });
    dialogContext.value = current;
    action.value = 'CREATE_ROLE';
    visible.value = true;
  } catch {
    await load();
    ElMessage.error('当前没有创建角色权限');
  }
}
async function open(row: { id: string; name: string; sort: number }, selected: string) {
  try {
    dialogContext.value = undefined;
    const current = await getApplicationRoleContext(String(row.id));
    if (!current.actions.includes(selected)) throw new Error('denied');
    Object.assign(form, { id: String(row.id), name: row.name, sort: row.sort });
    dialogContext.value = current;
    action.value = selected;
    visible.value = true;
  } catch {
    await load();
    ElMessage.error('当前角色权限已变化');
  }
}
async function submit() {
  if (!allowed.value || saving.value) return;
  saving.value = true;
  try {
    await submitRoleAction(action.value, form);
    visible.value = false;
    ElMessage.success('操作成功');
    await load();
  } catch {
    visible.value = false;
    dialogContext.value = undefined;
    ElMessage.error('操作未完成，请刷新权限后重新操作');
    await load();
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.application-roles {
  padding: 16px;
}
@media (max-width: 640px) {
  .application-roles {
    padding: 8px;
  }
}
</style>
