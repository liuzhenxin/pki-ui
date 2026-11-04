<template>
  <div class="app-container kms-page">
    <el-alert v-if="!isKms" title="KMS 控制台仅适用于通用密钥管理系统租户" type="warning" :closable="false" show-icon />
    <template v-else>
      <header class="page-header">
        <div>
          <span class="eyebrow">KMS · 通用密钥管理</span>
          <h1>密钥控制台</h1>
          <p>管理主密钥与版本，安全执行数据加解密。</p>
        </div>
        <el-button v-if="can('kms:key:create')" type="primary" icon="Plus" @click="createVisible = true">创建主密钥</el-button>
      </header>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="密钥管理" name="keys">
          <el-card shadow="never" class="query-card">
            <el-form label-position="top" @submit.prevent="lookup">
              <el-form-item label="密钥 ID"
                ><div class="lookup">
                  <el-input
                    v-model="queryId"
                    placeholder="输入完整密钥 ID（UUID）"
                    clearable
                    :disabled="loading || busy"
                    @input="invalidateLookup"
                  /><el-button type="primary" native-type="submit" icon="Search" :disabled="!can('kms:key:detail') || busy" :loading="loading"
                    >查询</el-button
                  >
                </div></el-form-item
              >
            </el-form>
            <p class="muted">使用创建后获得的密钥 ID 查询详情与版本。</p>
            <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
            <el-alert v-if="!can('kms:key:detail')" title="当前账号没有查看密钥权限" type="info" :closable="false" />
          </el-card>
          <KeyDetail v-if="detail" :value="detail" :busy="busy || loading" @action="openAction" @refresh="lookup" />
          <el-card v-else shadow="never"
            ><el-empty :description="error ? '查询未成功，请检查密钥 ID 与访问权限后重试' : '输入密钥 ID 查看详情，或创建新的主密钥'"
          /></el-card>
        </el-tab-pane>
        <el-tab-pane v-if="hasCryptoPermission" label="密码操作" name="crypto"
          ><CryptoPanel v-if="activeTab === 'crypto'" :selected-key-id="detail?.keyId"
        /></el-tab-pane>
      </el-tabs>
      <el-dialog
        v-model="createVisible"
        title="创建主密钥"
        width="min(560px, 94vw)"
        :close-on-click-modal="!creating"
        :close-on-press-escape="!creating"
        :show-close="!creating"
        @closed="resetCreate"
      >
        <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top" @submit.prevent="create">
          <el-form-item label="密钥别名" prop="alias"
            ><el-input v-model="createForm.alias" maxlength="128" placeholder="例如 orders/production" :disabled="creating" />
            <p class="muted">1–128 位字母、数字、斜杠、下划线或连字符。</p></el-form-item
          >
          <el-form-item label="算法" prop="algorithm"
            ><el-select v-model="createForm.algorithm" :disabled="creating"
              ><el-option label="SM4（128 位）" value="SM4_128" /><el-option
                label="AES（256 位，须由当前 Provider 支持）"
                value="AES_256" /></el-select
          ></el-form-item>
          <el-form-item label="用途"><el-input model-value="加密 / 解密" disabled /></el-form-item>
          <el-form-item label="描述"
            ><el-input
              v-model="createForm.description"
              type="textarea"
              maxlength="500"
              show-word-limit
              :disabled="creating"
              placeholder="填写业务用途，不包含密钥材料或密码"
          /></el-form-item>
          <el-alert v-if="createError" :title="createError" type="error" :closable="false" show-icon />
        </el-form>
        <template #footer
          ><el-button :disabled="creating" @click="createVisible = false">取消</el-button
          ><el-button type="primary" :loading="creating" @click="create">创建</el-button></template
        >
      </el-dialog>
      <el-dialog
        v-model="actionVisible"
        :title="actionLabels[selectedAction]"
        width="min(520px, 94vw)"
        :close-on-click-modal="!busy"
        :close-on-press-escape="!busy"
        :show-close="!busy"
      >
        <p class="identifier">密钥：{{ detail?.alias }}（{{ detail?.keyId }}）</p>
        <el-alert :title="actionDescription" :type="selectedAction === 'schedule-deletion' ? 'warning' : 'info'" :closable="false" show-icon />
        <el-form v-if="selectedAction === 'schedule-deletion'" label-position="top" class="deletion-form"
          ><el-form-item label="删除等待期（天）"
            ><el-input-number v-model="deletionDays" :min="7" :max="30" :precision="0" :disabled="busy" /></el-form-item
        ></el-form>
        <el-alert v-if="actionError" :title="actionError" type="error" :closable="false" show-icon class="action-error" />
        <template #footer
          ><el-button :disabled="busy" @click="actionVisible = false">取消</el-button
          ><el-button :type="selectedAction === 'schedule-deletion' ? 'danger' : 'primary'" :loading="busy" @click="runAction"
            >确认{{ actionLabels[selectedAction] }}</el-button
          ></template
        >
      </el-dialog>
    </template>
  </div>
</template>
<script setup lang="ts" name="KmsConsole">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { useUserStore } from '@/store/modules/user';
import auth from '@/plugins/auth';
import { changeKeyState, createKey, describeKey } from '@/api/kms';
import type { CreateKeyRequest, KeyAction, KeyDetail as KeyDetailValue } from '@/api/kms/types';
import { actionLabels, canRunAction, requireKeyId } from '@/utils/kms';
import KeyDetail from './components/KeyDetail.vue';
import CryptoPanel from './components/CryptoPanel.vue';
const userStore = useUserStore();
const isKms = computed(() => String(userStore.tenantId || localStorage.getItem('tenantId')) === '2');
const can = auth.hasPermi;
const hasCryptoPermission = computed(() => auth.hasPermiOr(['kms:crypto:encrypt', 'kms:crypto:decrypt', 'kms:datakey:generate']));
const activeTab = ref('keys');
const queryId = ref('');
const detail = ref<KeyDetailValue>();
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const createVisible = ref(false);
const creating = ref(false);
const createError = ref('');
const createFormRef = ref<FormInstance>();
const initialForm = (): CreateKeyRequest => ({ alias: '', algorithm: 'SM4_128', keyUsage: 'ENCRYPT_DECRYPT', description: '' });
const createForm = reactive(initialForm());
const createRules: FormRules = { alias: [{ required: true, pattern: /^[A-Za-z0-9/_-]{1,128}$/, message: '请输入合法的密钥别名', trigger: 'blur' }] };
const selectedAction = ref<KeyAction>('rotate');
const actionVisible = ref(false);
const deletionDays = ref(7);
const actionError = ref('');
let generation = 0;
let alive = true;
const messages: Record<KeyAction, string> = {
  rotate: '轮换将创建新版本。历史版本保留用于解密，新的加密操作使用当前版本。',
  enable: '启用后，符合权限要求的应用可以使用该密钥执行密码操作。',
  disable: '停用后，该密钥将不能用于密码操作。',
  'schedule-deletion': '安排删除后立即停止密码操作。等待期为 7–30 天，到期后销毁全部版本；销毁不可撤销。',
  'cancel-deletion': '取消删除后恢复为停用状态，需要另行启用才能执行密码操作。'
};
const actionDescription = computed(() => messages[selectedAction.value]);
const message = (failure: unknown) => (failure instanceof Error ? failure.message : '请求失败，请检查访问权限或服务可用性');
function invalidateLookup() {
  generation++;
  detail.value = undefined;
  error.value = '';
}
async function lookup() {
  if (loading.value || busy.value || !isKms.value || !can('kms:key:detail')) return;
  const token = ++generation;
  detail.value = undefined;
  error.value = '';
  try {
    const id = requireKeyId(queryId.value);
    loading.value = true;
    const value = await describeKey(id);
    if (alive && token === generation) detail.value = value;
  } catch (failure) {
    if (alive && token === generation) error.value = message(failure);
  } finally {
    loading.value = false;
  }
}
function resetCreate() {
  Object.assign(createForm, initialForm());
  createError.value = '';
  createFormRef.value?.clearValidate();
}
async function create() {
  if (creating.value || !isKms.value || !can('kms:key:create')) return;
  if (!(await createFormRef.value?.validate().catch(() => false)) || creating.value) return;
  creating.value = true;
  createError.value = '';
  try {
    const value = await createKey({ ...createForm });
    if (!alive || !isKms.value) return;
    invalidateLookup();
    queryId.value = value.keyId;
    createVisible.value = false;
    activeTab.value = 'keys';
    ElMessage.success('主密钥已创建，请保存密钥 ID');
    if (can('kms:key:detail')) await lookup();
  } catch (failure) {
    if (alive) createError.value = message(failure);
  } finally {
    creating.value = false;
  }
}
function openAction(action: KeyAction) {
  if (!detail.value || busy.value || !can(`kms:key:${action}`) || !canRunAction(detail.value.state, action)) return;
  selectedAction.value = action;
  deletionDays.value = 7;
  actionError.value = '';
  actionVisible.value = true;
}
async function runAction() {
  const key = detail.value;
  const action = selectedAction.value;
  if (busy.value || !key || !isKms.value || !can(`kms:key:${action}`) || !canRunAction(key.state, action)) return;
  busy.value = true;
  actionError.value = '';
  try {
    const value = await changeKeyState(key.keyId, action, deletionDays.value);
    if (!alive || !isKms.value) return;
    detail.value = { ...key, ...value };
    actionVisible.value = false;
    ElMessage.success(`${actionLabels[action]}成功`);
  } catch (failure) {
    if (alive) actionError.value = message(failure);
  } finally {
    busy.value = false;
  }
}
watch(isKms, () => {
  generation++;
  detail.value = undefined;
  createVisible.value = false;
  actionVisible.value = false;
});
onBeforeUnmount(() => {
  alive = false;
  generation++;
});
</script>
<style scoped>
.kms-page {
  max-width: 1320px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin: 8px 0 22px;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--el-color-primary);
}
h1 {
  font-size: 26px;
  margin: 8px 0;
}
.page-header p,
.muted {
  color: var(--el-text-color-secondary);
}
.query-card {
  margin: 14px 0 18px;
}
.lookup {
  display: flex;
  gap: 12px;
  width: 100%;
}
.lookup .el-input {
  flex: 1;
}
.muted {
  font-size: 13px;
  margin: 8px 0;
}
.identifier {
  overflow-wrap: anywhere;
}
.deletion-form,
.action-error {
  margin-top: 18px;
}
@media (max-width: 600px) {
  .lookup {
    flex-wrap: wrap;
  }
  .lookup .el-input {
    flex-basis: 100%;
  }
  .page-header {
    align-items: flex-start;
  }
  h1 {
    font-size: 22px;
  }
}
</style>
