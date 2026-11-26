<template>
  <section aria-label="服务器 CPU 资源">
    <el-button :loading="loading" @click="load">刷新资源</el-button>
    <el-alert
      v-if="initialCode && !loading && !failed && !resources.some((item) => item.code === initialCode)"
      title="该历史资源当前未登记"
      type="info"
      :closable="false"
    />
    <el-alert v-if="failed" type="error" title="资源读取失败" :closable="false" />
    <el-table v-else :data="resources" empty-text="暂无服务器资源" v-loading="loading">
      <el-table-column label="服务器"
        ><template #default="{ row }">{{ row.name || row.code }}</template></el-table-column
      >
      <el-table-column label="资源标识" prop="code" />
      <el-table-column label="采样状态"
        ><template #default="{ row }">{{ statuses[row.sampleStatus] }}</template></el-table-column
      >
      <el-table-column label="最近采样"
        ><template #default="{ row }">{{ row.sampledAt ? dateTimeText(row.sampledAt) : '—' }}</template></el-table-column
      >
      <el-table-column label="当前 CPU 告警" prop="activeCount" />
      <el-table-column label="操作"
        ><template #default="{ row }"><el-button link type="primary" @click="show(row)">详情</el-button></template></el-table-column
      >
    </el-table>
    <el-drawer v-model="visible" size="min(650px, 96vw)" :title="selected?.code + ' · CPU 资源详情'">
      <template v-if="selected">
        <p>最近采样 CPU 使用率　{{ selected.usage == null ? '—' : selected.usage + '%' }} · {{ statuses[selected.sampleStatus] }}</p>
        <strong>监控条件</strong>
        <template v-if="selected.condition">
          <p>{{ conditionOrigins[selected.condition.origin] }}</p>
          <p>
            触发 ≥ {{ selected.condition.triggerPercent }}% 持续 {{ selected.condition.triggerSeconds }} 秒；恢复 ≤
            {{ selected.condition.recoveryPercent }}% 持续 {{ selected.condition.recoverySeconds }} 秒
          </p>
        </template>
        <p v-else>尚未配置 CPU 条件</p>
        <el-button link type="primary" @click="$emit('conditions')">查看告警条件</el-button>
        <IncidentTemplateRulePane :key="selected.code" :resource="selected" />
        <el-button link type="primary" @click="$emit('rules', selected.code)">查看通知规则</el-button>
        <el-button link type="primary" @click="$emit('channels')">配置通知渠道</el-button>
        <h4>最近 CPU 告警</h4>
        <p v-if="historyLoading">正在读取</p>
        <el-button v-else-if="historyFailed" @click="show(selected)">读取失败，重试</el-button>
        <p v-else-if="!history.length">暂无记录</p>
        <ul v-else>
          <li v-for="item in history" :key="item.id">
            <el-button link type="primary" @click="$emit('incident', item.id)"
              >{{ dateTimeText(item.openedAt) }} · {{ item.title }} · {{ item.recoveredAt ? '已恢复' : '当前告警' }}</el-button
            >
          </li>
        </ul>
      </template>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import { conditionOrigins, getCpuIncidents, getCpuResources, type CpuResource } from '@/api/ops/alertResources';
import type { AlertIncident } from '@/api/ops';
import { dateTimeText } from '@/views/ops/utils';
import IncidentTemplateRulePane from './IncidentTemplateRulePane.vue';
const props = defineProps<{ initialCode?: string }>();
defineEmits<{ rules: [code: string]; channels: []; conditions: []; incident: [id: string] }>();
const statuses: Record<string, string> = { CURRENT: '采样正常', MISSING: '尚无采样', STALE: '采样已中断', NO_CPU: '缺少有效 CPU 指标' };
const resources = ref<CpuResource[]>([]);
const selected = ref<CpuResource>();
const history = ref<AlertIncident[]>([]);
const visible = ref(false);
const loading = ref(false);
const failed = ref(false);
const historyLoading = ref(false);
const historyFailed = ref(false);
async function load() {
  loading.value = true;
  failed.value = false;
  try {
    resources.value = await getCpuResources();
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
let sequence = 0;
async function show(row: CpuResource) {
  const current = ++sequence;
  selected.value = row;
  visible.value = true;
  historyLoading.value = true;
  historyFailed.value = false;
  try {
    const items = await getCpuIncidents(row.code);
    if (sequence === current) history.value = items;
  } catch {
    if (sequence === current) historyFailed.value = true;
  } finally {
    if (sequence === current) historyLoading.value = false;
  }
}
async function showInitial() {
  const row = resources.value.find((item) => item.code === props.initialCode);
  if (row) await show(row);
}
onMounted(async () => {
  await load();
  await showInitial();
});
watch(() => props.initialCode, showInitial);
</script>
