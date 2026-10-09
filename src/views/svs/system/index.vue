<template>
  <main class="svs-system">
    <div class="heading">
      <div>
        <p class="muted">签名验签服务器 / 系统管理员</p>
        <h1>{{ title }}</h1>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="panel" />
    <el-skeleton v-if="loading && !loaded" :rows="8" animated />
    <template v-else-if="page === 'device'">
      <el-card shadow="never" class="panel">
        <template #header><b>服务器信息</b></template>
        <el-descriptions :column="columns" border>
          <el-descriptions-item v-for="(label, key) in serverLabels" :key="key" :label="label">{{ text(info?.server[key]) }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
      <el-card shadow="never" class="panel">
        <template #header><b>密码设备信息</b></template>
        <el-descriptions :column="columns" border>
          <el-descriptions-item v-for="(label, key) in deviceLabels" :key="key" :label="label">{{ text(info?.device[key]) }}</el-descriptions-item>
          <el-descriptions-item label="设备状态"
            ><el-tag :type="state === 'UP' ? 'success' : 'warning'">{{ stateText }}</el-tag></el-descriptions-item
          >
          <el-descriptions-item label="最近成功通信">{{ date(info?.device.lastSuccessAt) }}</el-descriptions-item>
          <el-descriptions-item label="本次读取时间">{{ date(info?.observedAt) }}</el-descriptions-item>
        </el-descriptions>
        <p class="muted">未接入可信设备信息采集源的字段显示“未获取”；设备状态不代表所有业务配置已就绪。</p>
      </el-card>
      <el-card shadow="never" class="panel"
        ><template #header><b>初始化状态</b></template>
        <span>{{ error || !initialization ? '未知' : initialization.locked ? '已完成' : '未完成' }}</span>
        <el-button link type="primary" @click="router.push('/svs/initialization-info')">查看初始化信息 →</el-button>
      </el-card>
    </template>
    <template v-else-if="page === 'network'">
      <el-alert title="首期仅读取并核验现有网络与服务参数，不修改网卡、网关或白名单。" type="info" show-icon :closable="false" class="panel" />
      <el-card shadow="never" class="panel"
        ><template #header><b>当前网络与服务参数</b></template>
        <el-descriptions :column="1" border>
          <el-descriptions-item v-for="label in networkFields" :key="label" :label="label">{{ text(plan?.deployment[label]) }}</el-descriptions-item>
        </el-descriptions>
        <p class="muted">网关、DNS、NTP、VLAN及网口用途仅在采集结果明确提供时展示，不根据地址推断。</p>
      </el-card>
    </template>
    <template v-else>
      <el-alert
        :title="
          error || !initialization
            ? '初始化状态未知'
            : initialization.locked
              ? '初始化已完成，记录仅供查看。'
              : '初始化尚未完成，请在初始化向导继续。'
        "
        type="info"
        :closable="false"
        class="panel"
      />
      <el-card shadow="never" class="panel"
        ><template #header><b>初始化记录</b></template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="主机类型">{{ plan?.hostType === 'STANDALONE' ? '独立主机' : '未获取' }}</el-descriptions-item>
          <el-descriptions-item label="完成状态">{{
            error || !initialization ? '未知' : initialization.locked ? '已完成' : '未完成'
          }}</el-descriptions-item>
          <el-descriptions-item label="管理员绑定">{{
            initialization?.locked && !error ? 'admin / secadmin / auditor（固定账号）' : '未获取'
          }}</el-descriptions-item>
          <el-descriptions-item label="网络配置">读取并核验现有参数</el-descriptions-item>
          <el-descriptions-item label="设备证书">初始化后由安全管理员维护</el-descriptions-item>
        </el-descriptions>
        <ol>
          <li v-for="step in steps" :key="step">{{ step }}</li>
        </ol>
        <p class="muted">以上为初始化步骤顺序。本页面不重新提交初始化，不改写完成记录。</p>
      </el-card>
    </template>
  </main>
</template>
<script setup lang="ts" name="SvsSystemInformation">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { deviceInformation, type DeviceInformation } from '@/api/svs/system';
import { getSvsInitialization, getSvsInitPlan, type Initialization, type InitPlan } from '@/api/svs/init';
const props = defineProps<{ page: string; title: string }>();
const router = useRouter();
const info = ref<DeviceInformation>();
const initialization = ref<Initialization>();
const plan = ref<InitPlan>();
const loading = ref(false),
  loaded = ref(false),
  error = ref('');
const narrow = ref(false);
const columns = computed(() => (narrow.value ? 1 : 2));
const serverLabels = {
  productName: '产品名称',
  manufacturer: '设备厂商',
  serialNumber: '设备编号',
  model: '主机型号',
  architecture: '处理器架构',
  operatingSystem: '操作系统',
  softwareVersion: '产品软件版本'
} as const;
const deviceLabels = {
  manufacturer: '设备厂商',
  serialNumber: '设备编号',
  model: '设备型号',
  hardwareVersion: '硬件版本',
  firmwareVersion: '固件版本',
  interfaceVersion: '接口版本'
} as const;
const networkFields = ['服务监听地址', '服务监听端口', '后端通信', '管理端口', '网关、DNS、NTP及VLAN', '已启用网卡地址'];
const steps = ['前置检查', '主机类型', '设备初始化', '网络与服务配置', '安全策略', '管理员绑定', '初始化验证', '完成'];
const state = computed(() => (error.value ? 'UNKNOWN' : info.value?.device.state || 'UNKNOWN'));
const stateText = computed(() => ({ UP: '可用', DEGRADED: '降级', DOWN: '不可用', STARTING: '启动中', FAILED: '故障' })[state.value] || '未知');
const text = (value?: string) => (error.value ? '未获取' : value?.trim() || '未获取');
const date = (value?: string | null) => (value && !error.value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未获取');
let alive = true;
let requestId = 0;
async function load() {
  if (loading.value) return;
  const currentRequest = ++requestId;
  const activePage = props.page;
  loading.value = true;
  error.value = '';
  info.value = undefined;
  plan.value = undefined;
  initialization.value = undefined;
  try {
    if (activePage === 'device') {
      const [device, init] = await Promise.all([deviceInformation(), getSvsInitialization()]);
      if (!alive || currentRequest !== requestId) return;
      info.value = device;
      initialization.value = init;
    } else {
      const [deployment, init] = await Promise.all([getSvsInitPlan(), getSvsInitialization()]);
      if (!alive || currentRequest !== requestId) return;
      plan.value = deployment;
      initialization.value = init;
    }
  } catch {
    if (alive && currentRequest === requestId) error.value = '信息读取失败，当前状态未知，请重试';
  } finally {
    if (alive && currentRequest === requestId) {
      loaded.value = true;
      loading.value = false;
    }
  }
}
watch(
  () => props.page,
  () => {
    loading.value = false;
    loaded.value = false;
    load();
  }
);
const resize = () => {
  narrow.value = window.innerWidth < 768;
};
onMounted(() => {
  resize();
  window.addEventListener('resize', resize);
  load();
});
onUnmounted(() => {
  alive = false;
  window.removeEventListener('resize', resize);
});
</script>
<style scoped>
.svs-system {
  padding: 24px;
}
.heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
h1 {
  font-size: 25px;
  margin: 8px 0;
}
.panel {
  margin-bottom: 20px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.8;
}
li {
  padding: 6px 0;
}
@media (max-width: 640px) {
  .svs-system {
    padding: 12px;
  }
  .heading {
    align-items: flex-start;
  }
  h1 {
    font-size: 22px;
  }
}
</style>
