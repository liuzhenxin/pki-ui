<template>
  <div class="p-2">
    <el-card shadow="never" class="mb-3">
      <template #header>密钥池测试</template>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="pool-key-form">
        <el-form-item label="测试动作">
          <el-radio-group v-model="mode">
            <el-radio-button value="generate">生成备用密钥</el-radio-button>
            <el-radio-button value="strategy">按策略分配</el-radio-button>
            <el-radio-button value="type">按算法分配</el-radio-button>
            <el-radio-button value="batch">批量分配</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="mode !== 'type'" label="密钥策略" prop="strategyId">
          <el-select v-model="form.strategyId" filterable placeholder="请选择密钥池策略" style="width: 100%" @change="handleStrategyChange">
            <el-option
              v-for="item in strategyOptions"
              :key="item.id"
              :label="formatStrategyLabel(item)"
              :value="item.id"
              :disabled="Number(item.status) !== 1"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="mode === 'type'" label="算法类型" prop="algType">
          <el-select v-model="form.algType" placeholder="请选择算法类型" style="width: 100%">
            <el-option label="SM2" value="SM2" />
            <el-option label="RSA 2048" value="RSA2048" />
            <el-option label="RSA 4096" value="RSA4096" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="mode === 'type'" label="密钥用途" prop="keyUsage">
          <el-input v-model="form.keyUsage" disabled />
        </el-form-item>
        <el-form-item v-if="mode === 'generate'" label="生成数量" prop="count">
          <el-input-number v-model="form.count" :min="1" :max="1000" controls-position="right" />
        </el-form-item>
        <el-form-item v-if="mode === 'batch'" label="分配数量" prop="count">
          <el-input-number v-model="form.count" :min="1" :max="100" />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :icon="mode === 'generate' ? 'Plus' : 'Connection'"
            :loading="loading"
            v-hasPermi="['kmc:poolwatermark:generate', 'kmc:poolkey:allocate', 'kmc:poolkey:batch-allocate']"
            @click="submit"
          >
            {{ mode === 'generate' ? '生成备用密钥' : '执行' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>执行结果</template>
      <el-table v-if="Array.isArray(result)" :data="result" border>
        <el-table-column prop="id" label="在用密钥ID" width="120" />
        <el-table-column prop="strategyId" label="策略ID" width="100" />
        <el-table-column prop="keyType" label="密钥类型" width="120" />
        <el-table-column prop="keyBits" label="位长" width="100" />
        <el-table-column label="状态" width="140">
          <template #default>已转入在用密钥</template>
        </el-table-column>
        <el-table-column prop="publicKeyBase64" label="公钥" show-overflow-tooltip />
      </el-table>
      <el-descriptions v-else-if="result && typeof result === 'object' && result.actualCount !== undefined" border :column="2">
        <el-descriptions-item label="策略ID">{{ result.strategyId }}</el-descriptions-item>
        <el-descriptions-item label="请求数量">{{ result.requestedCount }}</el-descriptions-item>
        <el-descriptions-item label="实际生成">{{ result.actualCount }}</el-descriptions-item>
        <el-descriptions-item label="执行结果">
          <el-tag :type="result.success ? 'success' : 'danger'">{{ result.success ? '成功' : '失败' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item v-if="result.failureReason" label="失败原因" :span="2">{{ result.failureReason }}</el-descriptions-item>
      </el-descriptions>
      <pre v-else class="result-json">{{ resultText }}</pre>
    </el-card>
  </div>
</template>

<script setup name="KmcPoolKey" lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { allocatePoolKey, allocatePoolKeyByType, batchAllocatePoolKey } from '@/api/kmc/poolKey';
import { generatePoolKeys } from '@/api/kmc/poolWatermark';
import { listPoolStrategy } from '@/api/kmc/poolStrategy';
import type { PoolStrategyVO } from '@/api/kmc/poolStrategy/types';
import { readKmcPage, unwrapKmcData } from '@/api/kmc/common';

const mode = ref('generate');
const formRef = ref<FormInstance>();
const loading = ref(false);
const result = ref<any>(null);
const strategyOptions = ref<PoolStrategyVO[]>([]);

const form = reactive({
  strategyId: '',
  algType: 'SM2',
  keyUsage: 'ENCRYPT',
  count: 1
});

const rules = reactive<FormRules>({
  strategyId: [{ required: true, message: '请选择密钥策略', trigger: 'change' }],
  algType: [{ required: true, message: '请选择算法类型', trigger: 'change' }],
  keyUsage: [{ required: true, message: '请输入密钥用途', trigger: 'blur' }],
  count: [{ required: true, message: '请输入数量', trigger: 'change' }]
});

const resultText = computed(() => (result.value == null ? '暂无执行结果' : JSON.stringify(result.value, null, 2)));

const formatStrategyLabel = (item: PoolStrategyVO) => {
  const statusText = Number(item.status) === 1 ? '启用' : '停用';
  return `${item.algType} / ${item.keyUsage || 'ENCRYPT'} / 低${item.lowWatermark} 高${item.highWatermark} / ${statusText}`;
};

const loadStrategies = async () => {
  const res = await listPoolStrategy({ pageNum: 1, pageSize: 100, status: 1 } as any);
  strategyOptions.value = readKmcPage<PoolStrategyVO>(res).records;
  if (!form.strategyId && strategyOptions.value.length > 0) {
    form.strategyId = String(strategyOptions.value[0].id);
    handleStrategyChange(form.strategyId);
  }
};

const handleStrategyChange = (strategyId: string | number) => {
  const strategy = strategyOptions.value.find((item) => String(item.id) === String(strategyId));
  if (strategy) {
    form.algType = strategy.algType;
    form.keyUsage = strategy.keyUsage || 'ENCRYPT';
  }
};

watch(mode, () => {
  result.value = null;
});

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
    if (mode.value === 'generate') {
      result.value = unwrapKmcData(await generatePoolKeys(form.strategyId, form.count));
      if (result.value?.success === false) {
        ElMessage.error(result.value.failureReason || '生成备用密钥失败');
        return;
      }
    } else if (mode.value === 'strategy') {
      result.value = unwrapKmcData(await allocatePoolKey(form.strategyId));
    } else if (mode.value === 'type') {
      result.value = unwrapKmcData(await allocatePoolKeyByType(form.algType, form.keyUsage));
    } else if (mode.value === 'batch') {
      result.value = unwrapKmcData(await batchAllocatePoolKey(form.strategyId, form.count));
    }
    ElMessage.success('操作成功');
  } finally {
    loading.value = false;
  }
};

onMounted(loadStrategies);
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
