<template>
  <div class="p-2">
    <el-card shadow="never" class="mb-3">
      <template #header>密钥池分配测试</template>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="pool-key-form">
        <el-form-item label="分配方式">
          <el-radio-group v-model="mode">
            <el-radio-button value="strategy">按策略ID</el-radio-button>
            <el-radio-button value="type">按算法用途</el-radio-button>
            <el-radio-button value="batch">批量分配</el-radio-button>
            <el-radio-button value="release">释放密钥</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="mode === 'strategy' || mode === 'batch'" label="策略ID" prop="strategyId">
          <el-input v-model="form.strategyId" />
        </el-form-item>
        <el-form-item v-if="mode === 'type'" label="算法类型" prop="algType">
          <el-input v-model="form.algType" placeholder="SM2" />
        </el-form-item>
        <el-form-item v-if="mode === 'type'" label="密钥用途" prop="keyUsage">
          <el-input v-model="form.keyUsage" placeholder="SIGN / ENCRYPT" />
        </el-form-item>
        <el-form-item v-if="mode === 'batch'" label="分配数量" prop="count">
          <el-input-number v-model="form.count" :min="1" :max="100" />
        </el-form-item>
        <el-form-item v-if="mode === 'release'" label="密钥ID" prop="keyId">
          <el-input v-model="form.keyId" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Connection" :loading="loading" v-hasPermi="['kmc:poolkey:allocate', 'kmc:poolkey:batch-allocate', 'kmc:poolkey:release']" @click="submit">
            执行
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>执行结果</template>
      <el-table v-if="Array.isArray(result)" :data="result" border>
        <el-table-column prop="id" label="密钥ID" width="100" />
        <el-table-column prop="strategyId" label="策略ID" width="100" />
        <el-table-column prop="keyType" label="密钥类型" width="120" />
        <el-table-column prop="keyBits" label="位长" width="100" />
        <el-table-column prop="keyStatus" label="状态" width="100" />
        <el-table-column prop="publicKeyBase64" label="公钥" show-overflow-tooltip />
      </el-table>
      <pre v-else class="result-json">{{ resultText }}</pre>
    </el-card>
  </div>
</template>

<script setup name="KmcPoolKey" lang="ts">
import { computed, reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { allocatePoolKey, allocatePoolKeyByType, batchAllocatePoolKey, releasePoolKey } from '@/api/kmc/poolKey';
import { unwrapKmcData } from '@/api/kmc/common';

const mode = ref('strategy');
const formRef = ref<FormInstance>();
const loading = ref(false);
const result = ref<any>(null);

const form = reactive({
  strategyId: '',
  algType: 'SM2',
  keyUsage: 'SIGN',
  count: 1,
  keyId: ''
});

const rules = reactive<FormRules>({
  strategyId: [{ required: true, message: '请输入策略ID', trigger: 'blur' }],
  algType: [{ required: true, message: '请输入算法类型', trigger: 'blur' }],
  keyUsage: [{ required: true, message: '请输入密钥用途', trigger: 'blur' }],
  keyId: [{ required: true, message: '请输入密钥ID', trigger: 'blur' }]
});

const resultText = computed(() => (result.value == null ? '暂无执行结果' : JSON.stringify(result.value, null, 2)));

const submit = async () => {
  if (!formRef.value) {
    return;
  }
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }
  loading.value = true;
  try {
    if (mode.value === 'strategy') {
      result.value = unwrapKmcData(await allocatePoolKey(form.strategyId));
    } else if (mode.value === 'type') {
      result.value = unwrapKmcData(await allocatePoolKeyByType(form.algType, form.keyUsage));
    } else if (mode.value === 'batch') {
      result.value = unwrapKmcData(await batchAllocatePoolKey(form.strategyId, form.count));
    } else {
      result.value = unwrapKmcData(await releasePoolKey(form.keyId));
    }
    ElMessage.success('操作成功');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped lang="scss">
.pool-key-form {
  max-width: 760px;
}

.result-json {
  min-height: 180px;
  margin: 0;
  white-space: pre-wrap;
}
</style>
