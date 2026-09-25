<template>
  <div class="kds-sbox">
    <el-card v-loading="loading">
      <template #header><span>S 盒版本管理</span></template>
      <el-form inline>
        <el-form-item label="设备序列号">
          <el-input v-model="deviceSn" placeholder="MMJ 设备序列号" style="width: 260px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load">查询</el-button>
        </el-form-item>
      </el-form>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" class="mb" />
      <el-alert type="warning" :closable="false" show-icon title="激活与回滚会改变设备运行参数，请确认目标版本。" class="mb" />

      <el-table :data="versions" border size="small">
        <el-table-column prop="version" label="版本" min-width="140" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.state === 'ACTIVE' ? 'success' : row.state === 'PENDING' ? 'warning' : 'info'">
              {{ row.state }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="effectiveTime" label="生效时间" min-width="180" />
        <el-table-column prop="previousVersion" label="上一版本" width="120" />
        <el-table-column label="可回滚" width="90">
          <template #default="{ row }">{{ row.rollbackSupported ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column prop="checksumSha256" label="校验和" min-width="200" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-hasPermi="['kds:sbox:manage']" link type="primary" :disabled="row.state !== 'PENDING'" @click="onActivate(row.version)">
              立即激活
            </el-button>
          </template>
        </el-table-column>
        <template #empty>暂无 S 盒版本</template>
      </el-table>

      <div v-if="channels.length" class="section">
        <div class="section-title">通道回滚（仅上一版本）</div>
        <el-table :data="channels" border size="small">
          <el-table-column prop="channel" label="通道" min-width="160" />
          <el-table-column prop="keyRef" label="当前引用" min-width="200" />
          <el-table-column prop="previous" label="上一版本" min-width="200" />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button v-hasPermi="['kds:sbox:manage']" link type="danger" :disabled="!row.previous" @click="onRollback(row.channel)">
                回滚上一版本
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { activateSBox, getChannelStatus, getSBoxHistory, rollbackChannel } from '@/api/kds/device';
import { toKdsError } from '@/api/kds/client';
import type { ChannelStatus, SBoxVersionView } from '@/types/kds';

const deviceSn = ref('');
const versions = ref<SBoxVersionView[]>([]);
const channelStatus = ref<ChannelStatus>();
const loading = ref(false);
const error = ref('');

const channels = computed(() =>
  Object.entries(channelStatus.value?.channels || {}).map(([channel, keyRef]) => ({
    channel,
    keyRef,
    previous: channelStatus.value?.previous?.[channel] || ''
  }))
);

async function load() {
  if (!deviceSn.value) {
    error.value = '请输入设备序列号';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const history = await getSBoxHistory(deviceSn.value);
    versions.value = history.versions || [];
    channelStatus.value = await getChannelStatus(deviceSn.value);
  } catch (e) {
    error.value = toKdsError(e).message;
    versions.value = [];
    channelStatus.value = undefined;
  } finally {
    loading.value = false;
  }
}

async function onActivate(version: string) {
  try {
    const { value } = await ElMessageBox.prompt(`请输入版本号 ${version} 以确认立即激活`, '安全确认', {
      confirmButtonText: '确认激活',
      cancelButtonText: '取消'
    });
    if (value !== version) {
      ElMessage.warning('确认词与版本号不一致，已取消');
      return;
    }
    const result = await activateSBox(deviceSn.value, version);
    if (result.activated) {
      ElMessage.success('S 盒版本已激活');
    } else {
      ElMessage.info(`版本未激活（当前状态 ${result.state}）`);
    }
    await load();
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(toKdsError(e).message);
    }
  }
}

async function onRollback(channelName: string) {
  try {
    const { value } = await ElMessageBox.prompt(`请输入 ${channelName} 以确认回滚到上一版本`, '安全确认', {
      confirmButtonText: '确认回滚',
      cancelButtonText: '取消'
    });
    if (value !== channelName) {
      ElMessage.warning('确认词与通道名不一致，已取消');
      return;
    }
    const result = await rollbackChannel(deviceSn.value, channelName);
    ElMessage.success(`已回滚到版本 ${result.previousVersion}`);
    await load();
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(toKdsError(e).message);
    }
  }
}
</script>
<style scoped>
.kds-sbox {
  padding: 20px;
}
.mb {
  margin-bottom: 12px;
}
.section {
  margin-top: 20px;
}
.section-title {
  font-weight: 600;
  margin-bottom: 8px;
}
</style>
