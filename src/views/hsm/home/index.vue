<template>
  <div class="hsm-page">
    <HsmPageHeader title="产品概览" description="查看初始化记录与设备 UKey 身份，进入密码机管理工作台。">
      <el-button :loading="loading" @click="refresh">刷新概览</el-button>
    </HsmPageHeader>
    <div v-loading="loading" class="hsm-metrics">
      <el-card
        ><div class="hsm-metric-label">初始化记录</div>
        <div class="hsm-metric-value">{{ initError ? '查询失败' : canInit ? initializationLabel(initialization?.state) : '无查询权限' }}</div>
        <div class="hsm-muted">服务端保存的进度</div></el-card
      >
      <el-card
        ><div class="hsm-metric-label">主机 UKey 连接</div>
        <div class="hsm-metric-value">
          {{ ukeyError ? '查询失败' : !canUkeys ? '无查询权限' : !ukeys ? '尚未查询' : ukeys.hostAvailable ? '可访问' : '不可访问' }}
        </div>
        <div class="hsm-muted">密码机主机 USB 插接</div></el-card
      >
      <el-card
        ><div class="hsm-metric-label">已任命管理员 / 操作员</div>
        <div class="hsm-metric-value">{{ ukeys ? `${activeCount('ADMINISTRATOR')} / ${activeCount('OPERATOR')}` : '— / —' }}</div>
        <div class="hsm-muted">
          {{ ukeys ? `配置 ${ukeys.configuration.administrators} / ${ukeys.configuration.operators} 把` : '各支持 3 或 5 把，分别配置' }}
        </div></el-card
      >
      <el-card
        ><div class="hsm-metric-label">设备身份授权</div>
        <div class="hsm-metric-value">{{ ukeys ? (ukeys.authorization ? '已授权' : '未授权') : '未知' }}</div>
        <div class="hsm-muted">{{ ukeys?.authorization ? `有效期至 ${ukeys.authorization.expiresAt}` : '平台登录与设备身份独立' }}</div></el-card
      >
    </div>
    <el-alert
      v-if="initError || ukeyError"
      class="hsm-section"
      :title="[initError, ukeyError].filter(Boolean).join('；')"
      type="error"
      show-icon
      :closable="false"
    />
    <div class="hsm-grid hsm-section">
      <el-card>
        <template #header><span class="hsm-section-title">管理入口</span></template>
        <div v-if="canInit" class="hsm-list-row">
          <div>
            <strong>初始化状态</strong>
            <p class="hsm-muted">查看批次与进度，证书可在后续启用 SSL 时配置。</p>
          </div>
          <el-button type="primary" plain @click="router.push('/hsm/initialization')">查看</el-button>
        </div>
        <div v-if="canUkeys" class="hsm-list-row">
          <div>
            <strong>UKey 身份</strong>
            <p class="hsm-muted">管理员与操作员任命、PIN 登录和遗失替换。</p>
          </div>
          <el-button type="primary" plain @click="router.push('/hsm/ukeys')">管理</el-button>
        </div>
        <div v-if="canUkeys" class="hsm-list-row">
          <div>
            <strong>身份审计</strong>
            <p class="hsm-muted">查询最近的任命、登录、撤销等身份操作。</p>
          </div>
          <el-button type="primary" plain @click="router.push('/hsm/audit')">查看</el-button>
        </div>
        <el-empty v-if="!canInit && !canUkeys" description="当前账号尚未获得 HSM 页面查询权限" />
      </el-card>
      <el-card>
        <template #header><span class="hsm-section-title">功能开放情况</span></template>
        <div v-for="item in pending" :key="item.title" class="hsm-list-row">
          <div>
            <strong>{{ item.title }}</strong>
            <p class="hsm-muted">{{ item.description }}</p>
          </div>
          <el-tag type="info">未开放</el-tag>
        </div>
      </el-card>
    </div>
    <el-card class="hsm-section"
      ><template #header><span class="hsm-section-title">设备身份规则</span></template>
      <p class="hsm-muted">管理员和操作员数量可分别设为 3 或 5 把，任命与登录由单人完成。备份与恢复按 m of n 门限收集管理员密钥分量。</p>
      <p class="hsm-muted">
        服务器启动要求主机插有已认证操作员 UKey，任意一名操作员即可操作；启动后拔出不停止运行，重启后需重新认证。启停控制尚待接入。
      </p>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import auth from '@/plugins/auth';
import { getInitializationStatus, type InitializationStatus } from '@/api/hsm/initialization';
import { getUkeyStatus, type UkeyStatus, type UkeyRole } from '@/api/hsm/ukeys';
import { initializationLabel } from '@/utils/hsmPresentation';
import HsmPageHeader from '../components/HsmPageHeader.vue';
import '../styles/product.css';

const router = useRouter();
const canInit = auth.hasPermi('hsm:init:view');
const canUkeys = auth.hasPermi('hsm:ukey:view');
const initialization = ref<InitializationStatus | null>(null);
const ukeys = ref<UkeyStatus | null>(null);
const initError = ref('');
const ukeyError = ref('');
const loading = ref(false);
const pending = [
  { title: '初始化执行', description: '设备授权与审批验证完成后开放。' },
  { title: '密钥生命周期', description: '密钥生成、导入、删除接口尚未接入。' },
  { title: '备份与恢复', description: '管理员 UKey 分量读写与门限恢复尚未接入。' },
  { title: '服务启停与 SSL', description: '操作员授权启停及通信证书配置尚未接入。' }
];
const activeCount = (role: UkeyRole) => ukeys.value?.bindings.filter((binding) => binding.role === role && binding.active).length || 0;
async function refresh() {
  if (loading.value) return;
  loading.value = true;
  initialization.value = null;
  ukeys.value = null;
  initError.value = '';
  ukeyError.value = '';
  try {
    await Promise.all([
      canInit
        ? getInitializationStatus()
            .then((response) => {
              initialization.value = response.data;
            })
            .catch(() => {
              initError.value = '初始化状态查询失败';
            })
        : Promise.resolve(),
      canUkeys
        ? getUkeyStatus()
            .then((response) => {
              ukeys.value = response.data;
            })
            .catch(() => {
              ukeyError.value = 'UKey 身份查询失败';
            })
        : Promise.resolve()
    ]);
  } finally {
    loading.value = false;
  }
}
onMounted(refresh);
</script>
