<template>
  <div class="kds-audit">
    <el-card v-loading="loading">
      <template #header><span>审计与证据</span></template>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" class="mb" />

      <div class="section">
        <div class="section-title">审计链</div>
        <el-form inline>
          <el-form-item label="开始时间">
            <el-date-picker v-model="range.start" type="datetime" placeholder="开始时间" />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-date-picker v-model="range.end" type="datetime" placeholder="结束时间" />
          </el-form-item>
          <el-form-item>
            <el-button v-hasPermi="['kds:audit:export']" type="primary" :loading="loading" @click="onExport"> 导出审计 </el-button>
            <el-button v-hasPermi="['kds:audit:view']" :loading="loading" @click="onVerify">校验审计链</el-button>
          </el-form-item>
        </el-form>
        <el-descriptions v-if="verification" :column="3" border class="mt">
          <el-descriptions-item label="校验条数">{{ verification.checkedCount }}</el-descriptions-item>
          <el-descriptions-item label="断裂条数">{{ verification.brokenCount }}</el-descriptions-item>
          <el-descriptions-item label="结果">{{ verification.valid ? '完整' : '异常' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <el-divider />

      <div class="section">
        <div class="section-title">证据注册表</div>
        <el-form v-hasPermi="['kds:evidence:manage']" inline>
          <el-form-item label="类型">
            <el-input v-model="evidence.type" placeholder="如 DRILL" style="width: 160px" />
          </el-form-item>
          <el-form-item label="引用">
            <el-input v-model="evidence.reference" placeholder="受控引用" style="width: 240px" />
          </el-form-item>
          <el-form-item label="环境">
            <el-input v-model="evidence.environment" placeholder="如 onsite" style="width: 140px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="onRegister">登记证据</el-button>
          </el-form-item>
        </el-form>

        <el-form inline class="mt">
          <el-form-item label="类型过滤">
            <el-input v-model="queryType" placeholder="留空为全部" style="width: 200px" />
          </el-form-item>
          <el-form-item>
            <el-button :loading="loading" @click="onQuery">查询证据</el-button>
          </el-form-item>
        </el-form>

        <el-table :data="evidences" border size="small" class="mt">
          <el-table-column prop="evidenceId" label="证据 ID" min-width="200" />
          <el-table-column prop="type" label="类型" width="120" />
          <el-table-column prop="reference" label="引用" min-width="200" />
          <el-table-column prop="sha256" label="SHA-256" min-width="220" />
          <el-table-column prop="occurredAt" label="时间" min-width="180" />
          <el-table-column prop="operator" label="操作者" width="160" />
          <el-table-column prop="environment" label="环境" width="120" />
          <template #empty>暂无证据记录</template>
        </el-table>
        <el-alert type="info" :closable="false" show-icon title="证据仅保存引用与摘要；文件内容不经前端展示。" class="mt" />
      </div>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { exportAudit, verifyAudit } from '@/api/kds/audit';
import { queryEvidence, registerEvidence } from '@/api/kds/ops';
import { toKdsError } from '@/api/kds/client';
import type { EvidenceSummary } from '@/types/kds';

const range = reactive<{ start?: Date; end?: Date }>({});
const evidence = reactive<{ type: string; reference: string; environment: string }>({
  type: '',
  reference: '',
  environment: ''
});
const queryType = ref('');
const evidences = ref<EvidenceSummary[]>([]);
const verification = ref<{ checkedCount: number; brokenCount: number; valid: boolean }>();
const loading = ref(false);
const error = ref('');

function millis(): { startTime: number; endTime: number } | undefined {
  if (!range.start || !range.end) {
    error.value = '请选择起止时间';
    return undefined;
  }
  return { startTime: range.start.getTime(), endTime: range.end.getTime() };
}

async function onExport() {
  const payload = millis();
  if (!payload) return;
  loading.value = true;
  error.value = '';
  try {
    await exportAudit(payload);
    ElMessage.success('审计导出已受理');
  } catch (e) {
    error.value = toKdsError(e).message;
    ElMessage.error(error.value);
  } finally {
    loading.value = false;
  }
}

async function onVerify() {
  const payload = millis();
  if (!payload) return;
  loading.value = true;
  error.value = '';
  try {
    verification.value = await verifyAudit(payload);
  } catch (e) {
    error.value = toKdsError(e).message;
    verification.value = undefined;
  } finally {
    loading.value = false;
  }
}

async function onRegister() {
  if (!evidence.type || !evidence.reference) {
    ElMessage.warning('请填写类型与引用');
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await registerEvidence({ ...evidence });
    ElMessage.success('证据已登记');
    evidence.reference = '';
    await onQuery();
  } catch (e) {
    error.value = toKdsError(e).message;
    ElMessage.error(error.value);
  } finally {
    loading.value = false;
  }
}

async function onQuery() {
  loading.value = true;
  error.value = '';
  try {
    const result = await queryEvidence({ type: queryType.value || undefined, limit: 50 });
    evidences.value = result.items || [];
  } catch (e) {
    error.value = toKdsError(e).message;
    evidences.value = [];
  } finally {
    loading.value = false;
  }
}
</script>
<style scoped>
.kds-audit {
  padding: 20px;
}
.mb {
  margin-bottom: 12px;
}
.mt {
  margin-top: 12px;
}
.section-title {
  font-weight: 600;
  margin-bottom: 8px;
}
</style>
