<template>
  <AuditTable title="审计员管理" :query="listAuditors">
    <template #toolbar="{ reload }">
      <el-button class="mb-3" type="primary" @click="dialog = true">创建审计员</el-button>
      <el-dialog v-model="dialog" title="创建审计员" width="460px" :close-on-click-modal="!saving" @closed="clear">
        <el-form label-position="top" @submit.prevent="submit(reload)">
          <el-form-item label="用户名">
            <el-input v-model="username" autocomplete="off" maxlength="20" placeholder="5 到 20 位字母或数字，以字母开头" />
          </el-form-item>
          <el-form-item label="初始密码">
            <el-input v-model="password" type="password" autocomplete="new-password" placeholder="至少 12 个字符，最多 72 字节" />
          </el-form-item>
          <el-form-item label="确认密码">
            <el-input v-model="confirmation" type="password" autocomplete="new-password" />
          </el-form-item>
          <el-button :disabled="saving" @click="dialog = false">取消</el-button>
          <el-button :loading="saving" type="primary" native-type="submit">创建</el-button>
        </el-form>
      </el-dialog>
    </template>
    <el-table-column label="用户名" prop="username" min-width="160" />
    <el-table-column label="账号状态" width="120">
      <template #default="{ row }">{{ row.enabled ? '正常' : '锁定' }}</template>
    </el-table-column>
    <el-table-column label="创建时间" prop="createdAt" min-width="185" />
  </AuditTable>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import AuditTable from './AuditTable.vue';
import { createAuditor, listAuditors } from '@/api/ucsp/audit';

const dialog = ref(false);
const saving = ref(false);
const username = ref('');
const password = ref('');
const confirmation = ref('');

const clear = () => {
  username.value = '';
  password.value = '';
  confirmation.value = '';
};

const submit = async (reload: () => void) => {
  if (saving.value) return;
  if (!/^[A-Za-z][A-Za-z0-9]{4,19}$/.test(username.value)) {
    ElMessage.warning('请输入符合规则的用户名');
    return;
  }
  if (password.value.length < 12 || new TextEncoder().encode(password.value).length > 72 || password.value !== confirmation.value) {
    ElMessage.warning('请检查密码长度和两次输入是否一致');
    return;
  }
  saving.value = true;
  try {
    await createAuditor(username.value, password.value);
    dialog.value = false;
    clear();
    ElMessage.success('审计员已创建');
    reload();
  } catch {
    password.value = '';
    confirmation.value = '';
  } finally {
    saving.value = false;
  }
};
</script>
