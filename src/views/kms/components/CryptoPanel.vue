<template>
  <el-card shadow="never">
    <template #header><h2>密码操作</h2></template>
    <el-empty v-if="!operations.length" description="当前账号没有密码操作权限" />
    <el-form v-else label-position="top" @submit.prevent="submit">
      <el-form-item label="操作"
        ><el-radio-group v-model="operation" :disabled="busy"
          ><el-radio-button v-for="item in operations" :key="item.value" :value="item.value">{{ item.label }}</el-radio-button></el-radio-group
        ></el-form-item
      >
      <el-form-item label="密钥 ID"
        ><el-input v-model="keyId" placeholder="输入完整密钥 ID（UUID）" :disabled="busy" autocomplete="off"
      /></el-form-item>
      <el-form-item v-if="operation === 'data-key'" label="数据密钥规格"
        ><el-select v-model="keySpec" :disabled="busy"
          ><el-option label="SM4（128 位）" value="SM4_128" /><el-option label="AES（256 位）" value="AES_256" /></el-select
      ></el-form-item>
      <el-form-item v-else :label="operation === 'encrypt' ? '明文（Base64，最多 4096 字节）' : '密文（Base64）'"
        ><el-input
          v-model="input"
          type="textarea"
          :rows="4"
          :disabled="busy"
          autocomplete="off"
          :spellcheck="false"
          :placeholder="operation === 'encrypt' ? '输入标准 Base64 编码的明文' : '输入 KMS 返回的 ciphertextBlob'"
      /></el-form-item>
      <el-form-item label="加密上下文（可选）"
        ><el-input
          v-model="context"
          type="textarea"
          :rows="2"
          :disabled="busy"
          placeholder='例如 {"purpose":"orders"}；解密时须与加密一致'
          autocomplete="off"
          :spellcheck="false"
      /></el-form-item>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="notice" />
      <div class="actions">
        <el-button type="primary" native-type="submit" :loading="busy">{{
          operation === 'data-key' ? '生成数据密钥' : operation === 'encrypt' ? '加密' : '解密'
        }}</el-button
        ><el-button @click="clear">清空输入与结果</el-button>
      </div>
    </el-form>
    <section v-if="result" class="result" aria-live="polite">
      <h3>
        操作结果 <el-tag size="small">v{{ result.keyVersion }}</el-tag>
      </h3>
      <p class="identifier">密钥 ID：{{ result.keyId }}</p>
      <template v-if="result.plaintext">
        <div class="result-label">
          <span>{{ operation === 'data-key' ? '明文数据密钥（Base64）' : '明文（Base64）' }}</span
          ><el-button link type="primary" @click="reveal = !reveal">{{ reveal ? '隐藏' : '显示明文' }}</el-button>
        </div>
        <el-input v-if="reveal" :model-value="result.plaintext" readonly type="textarea" :rows="3" autocomplete="off" aria-label="明文结果" />
        <p v-else class="masked" aria-label="明文已隐藏">••••••••••••••••</p>
      </template>
      <template v-if="result.ciphertextBlob"
        ><p>密文（Base64）</p>
        <el-input :model-value="result.ciphertextBlob" readonly type="textarea" :rows="4" aria-label="密文结果"
      /></template>
    </section>
  </el-card>
</template>
<script setup lang="ts" name="KmsCryptoPanel">
import { computed, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';
import auth from '@/plugins/auth';
import { decrypt, encrypt, generateDataKey } from '@/api/kms';
import type { CryptoOperation, CryptoResult, KeyAlgorithm } from '@/api/kms/types';
import { parseEncryptionContext, requireBase64, requireKeyId } from '@/utils/kms';
const props = defineProps<{ selectedKeyId?: string }>();
const definitions = [
  { value: 'encrypt' as const, label: '加密', permission: 'kms:crypto:encrypt' },
  { value: 'decrypt' as const, label: '解密', permission: 'kms:crypto:decrypt' },
  { value: 'data-key' as const, label: '生成数据密钥', permission: 'kms:datakey:generate' }
];
const operations = computed(() => definitions.filter((item) => auth.hasPermi(item.permission)));
const operation = ref<CryptoOperation>(operations.value[0]?.value || 'encrypt');
const keyId = ref(props.selectedKeyId || '');
const keySpec = ref<KeyAlgorithm>('SM4_128');
const input = ref('');
const context = ref('');
const result = ref<CryptoResult>();
const reveal = ref(false);
const busy = ref(false);
const error = ref('');
let generation = 0;
function clear() {
  generation++;
  input.value = '';
  context.value = '';
  result.value = undefined;
  reveal.value = false;
  error.value = '';
}
watch(operation, clear);
watch(
  () => props.selectedKeyId,
  (value) => {
    clear();
    keyId.value = value || '';
  }
);
watch(keyId, clear);
watch(operations, (items) => {
  if (!items.some((item) => item.value === operation.value)) {
    clear();
    operation.value = items[0]?.value || 'encrypt';
  }
});
async function submit() {
  if (busy.value) return;
  clearResult();
  const requestGeneration = ++generation;
  try {
    if (!operations.value.some((item) => item.value === operation.value)) throw new Error('当前账号没有该操作权限');
    const id = requireKeyId(keyId.value);
    const aad = parseEncryptionContext(context.value);
    const data = operation.value === 'data-key' ? '' : requireBase64(input.value, operation.value === 'encrypt' ? 4096 : 8192);
    busy.value = true;
    const response =
      operation.value === 'encrypt'
        ? await encrypt(id, data, aad)
        : operation.value === 'decrypt'
          ? await decrypt(id, data, aad)
          : await generateDataKey(id, keySpec.value, aad);
    if (generation === requestGeneration) result.value = response;
  } catch (failure) {
    if (generation === requestGeneration) error.value = failure instanceof Error ? failure.message : '操作失败，请检查权限、密钥状态或服务可用性';
  } finally {
    busy.value = false;
  }
}
function clearResult() {
  result.value = undefined;
  reveal.value = false;
  error.value = '';
}
onBeforeUnmount(clear);
onDeactivated(clear);
</script>
<style scoped>
h2 {
  margin: 0;
  font-size: 18px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}
.actions .el-button {
  margin-left: 0;
}
.notice {
  margin-bottom: 14px;
}
.result {
  margin-top: 24px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 10px;
}
.result-label {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.masked {
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  letter-spacing: 3px;
}
.identifier {
  overflow-wrap: anywhere;
}
</style>
