<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElDialog, ElLoading, ElPagination, ElTable, ElTableColumn } from 'element-plus';
import { type AuditPage } from '@/api/csp/console';
import { consoleRequest } from '@/api/csp/gateway';
import { useCspConsoleStore } from '@/store/modules/cspConsole';

const props = defineProps<{ kind: 'auditors' | 'login' | 'operation' }>();
const store = useCspConsoleStore();
const vLoading = ElLoading.directive;
const tables = {
  auditors: { title: '审计员管理', action: 'auditor-list', columns: [{ prop: 'username', label: '账号' }] },
  login: {
    title: '登录日志',
    action: 'login-log-list',
    columns: [
      { prop: 'username', label: '账号' },
      { prop: 'ipAddress', label: 'IP 地址' }
    ]
  },
  operation: {
    title: '操作日志',
    action: 'operation-log-list',
    columns: [
      { prop: 'operator', label: '操作人' },
      { prop: 'moduleName', label: '模块' },
      { prop: 'name', label: '操作' }
    ]
  }
} as const;
const table = computed(() => tables[props.kind]);
const rows = ref<AuditPage['items']>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const dialogOpen = ref(false);
const username = ref('');
const password = ref('');
let latest = 0;

async function load() {
  const request = ++latest;
  error.value = '';
  rows.value = [];
  loading.value = true;
  try {
    const result = await consoleRequest(table.value.action, { page: page.value });
    if (request !== latest) return;
    rows.value = result.items;
    total.value = result.total;
  } catch (failure) {
    if (request === latest) error.value = (failure as Error).message;
  } finally {
    if (request === latest) loading.value = false;
  }
}

watch(
  () => props.kind,
  () => {
    total.value = 0;
    page.value = 1;
    dialogOpen.value = false;
    void load();
  },
  { immediate: true }
);

async function create() {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await consoleRequest('auditor-create', { username: username.value.trim(), password: password.value });
    dialogOpen.value = false;
    page.value = 1;
    await load();
  } catch (failure) {
    error.value = (failure as Error).message;
  } finally {
    password.value = '';
    saving.value = false;
  }
}

async function setStatus(row: AuditPage['items'][number]) {
  if (saving.value || typeof row.id !== 'string' || ![0, 1].includes(Number(row.status))) return;
  saving.value = true;
  error.value = '';
  try {
    await consoleRequest('auditor-status', { id: row.id, status: Number(row.status) === 0 ? 1 : 0 });
    await load();
  } catch (failure) {
    error.value = (failure as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="audit-page" aria-labelledby="audit-title">
    <header>
      <h1 id="audit-title">{{ table.title }}</h1>
      <div class="audit-actions">
        <el-button :disabled="loading || saving" @click="load">刷新</el-button>
        <el-button v-if="kind === 'auditors' && store.secure" type="primary" :disabled="saving" @click="dialogOpen = true">新增审计员</el-button>
      </div>
    </header>
    <p v-if="error && !dialogOpen" role="alert">{{ error }}</p>
    <el-table v-loading="loading" :data="rows" empty-text="暂无记录">
      <el-table-column v-for="column in table.columns" :key="column.prop" v-bind="column" min-width="135" />
      <el-table-column label="状态" min-width="90">
        <template #default="{ row }">
          {{
            row.status == null
              ? '未知'
              : kind === 'auditors'
                ? Number(row.status) === 0
                  ? '启用'
                  : '停用'
                : Number(row.status) === 0
                  ? '成功'
                  : '失败'
          }}
        </template>
      </el-table-column>
      <el-table-column v-if="kind !== 'auditors'" prop="createTime" label="时间" min-width="170" />
      <el-table-column v-else label="操作" min-width="100">
        <template #default="{ row }">
          <el-button text :disabled="saving || row.status == null" @click="setStatus(row)">{{
            Number(row.status) === 0 ? '停用' : '启用'
          }}</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > 20"
      v-model:current-page="page"
      :total="Math.min(total, 40000)"
      :page-size="20"
      :disabled="loading || saving"
      layout="prev, pager, next"
      @current-change="load"
    />
    <el-dialog
      v-model="dialogOpen"
      title="新增审计员"
      width="min(420px, 92vw)"
      :close-on-click-modal="false"
      @closed="
        username = '';
        password = '';
        error = '';
      "
    >
      <form @submit.prevent="create">
        <label class="audit-field">账号 <input v-model="username" autocomplete="off" required maxlength="64" /></label>
        <label class="audit-field"
          >初始密码 <input v-model="password" type="password" autocomplete="new-password" required minlength="12" maxlength="72"
        /></label>
        <p v-if="error" role="alert">{{ error }}</p>
        <el-button native-type="submit" type="primary" :loading="saving">创建账号</el-button>
      </form>
    </el-dialog>
  </section>
</template>

<style scoped>
.audit-page {
  padding: 24px;
}
.audit-page header,
.audit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.audit-page header {
  justify-content: space-between;
  margin-bottom: 16px;
}
.audit-field {
  display: grid;
  gap: 6px;
  margin-bottom: 16px;
}
.audit-field input {
  padding: 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}
.el-pagination {
  margin-top: 16px;
}
</style>
