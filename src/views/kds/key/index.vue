<template>
  <div class="app-container kds-page kds-key">
    <KdsPageHeader title="密钥与通道快照" description="查询设备的密钥版本计数、通道绑定和待生效版本；页面仅展示受控引用。" />
    <el-card v-loading="loading" shadow="hover" class="kds-panel">
      <template #header><div class="kds-panel__header"><span>设备查询</span></div></template>
      <el-form inline class="kds-filter-form">
        <el-form-item label="设备序列号">
          <el-input v-model="deviceSn" placeholder="MMJ 设备序列号" style="width: 260px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" :loading="loading" @click="load">查询</el-button>
        </el-form-item>
      </el-form>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" class="mb" />
      <el-alert type="info" :closable="false" show-icon title="仅展示受控引用与版本元数据，不包含密钥明文或包装密文。" class="mb" />

      <div v-if="snapshot" class="section">
        <div class="section-title">状态计数</div>
        <el-space wrap>
          <el-tag v-for="(count, state) in snapshot.stateCounts" :key="state">{{ state }}: {{ count }}</el-tag>
          <span v-if="Object.keys(snapshot.stateCounts).length === 0" class="empty">无密钥版本</span>
        </el-space>
      </div>

      <div v-if="snapshot" class="section">
        <div class="section-title">通道绑定</div>
        <el-table :data="channelRows" border size="small">
          <el-table-column prop="channel" label="通道" min-width="160" />
          <el-table-column prop="keyRef" label="密钥引用" min-width="200" />
          <template #empty>无通道绑定</template>
        </el-table>
      </div>

      <div v-if="snapshot" class="section">
        <div class="section-title">待生效版本</div>
        <el-table :data="snapshot.pending" border size="small">
          <el-table-column prop="keyId" label="密钥" min-width="160" />
          <el-table-column prop="version" label="版本" width="120" />
          <el-table-column prop="channelName" label="通道" min-width="160" />
          <template #empty>无待生效版本</template>
        </el-table>
      </div>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { getKeySnapshot } from '@/api/kds/device';
import { toKdsError } from '@/api/kds/client';
import type { KeySnapshot } from '@/types/kds';
import KdsPageHeader from '@/views/kds/components/KdsPageHeader.vue';

const deviceSn = ref('');
const snapshot = ref<KeySnapshot>();
const loading = ref(false);
const error = ref('');

const channelRows = computed(() => Object.entries(snapshot.value?.channels || {}).map(([channel, keyRef]) => ({ channel, keyRef })));

async function load() {
  if (!deviceSn.value) {
    error.value = '请输入设备序列号';
    snapshot.value = undefined;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    snapshot.value = await getKeySnapshot(deviceSn.value);
  } catch (e) {
    error.value = toKdsError(e).message;
    snapshot.value = undefined;
  } finally {
    loading.value = false;
  }
}
</script>
<style scoped>
.mb {
  margin-bottom: 12px;
}
.section {
  margin-top: 16px;
}
.section-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.empty {
  color: var(--el-text-color-secondary);
}
</style>
<style src="../styles/page.css"></style>
