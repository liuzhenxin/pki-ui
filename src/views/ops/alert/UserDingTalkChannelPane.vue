<template>
  <el-card shadow="never">
    <template #header><strong>用户钉钉</strong></template>
    <el-alert v-if="loadFailed" title="无法读取群机器人配置" type="error" :closable="false" show-icon />
    <el-form v-else v-loading="busy" :model="form" label-position="top" :disabled="!loaded || busy" @submit.prevent="save">
      <el-form-item v-if="channels.length > 1" label="群机器人">
        <el-select :model-value="selectedId" @update:model-value="selectChannel">
          <el-option v-for="channel in channels" :key="channel.id" :label="channel.name" :value="channel.id" />
        </el-select>
      </el-form-item>
      <div class="channel-fields">
        <el-form-item label="机器人名称" required><el-input v-model.trim="form.name" /></el-form-item>
        <el-form-item label="Webhook Access Token" :required="!tokenConfigured">
          <el-input
            v-model="form.accessToken"
            :placeholder="tokenConfigured ? '已配置，留空保留' : '填写群机器人 Webhook 的 access_token'"
            type="password"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="加签 Secret">
          <el-input
            v-model="form.secret"
            :placeholder="secretConfigured ? '已配置，留空保留' : '开启机器人加签时填写'"
            type="password"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="备注"><el-input v-model.trim="form.remark" /></el-form-item>
        <el-form-item label="启用通知"><el-switch v-model="form.enabled" /></el-form-item>
      </div>
      <el-button type="primary" native-type="submit" :loading="saving">保存配置</el-button>
    </el-form>
    <el-button v-if="loadFailed" class="reload" :disabled="busy" @click="load">刷新配置</el-button>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { createAlertChannel, getAlertChannels, updateAlertChannel } from '@/api/ops';
import type { AlertChannel, AlertChannelSave } from '@/api/ops/types';

const channels = ref<(AlertChannel & { id: number })[]>([]);
const selectedId = ref<number>();
const form = reactive({ name: '', enabled: false, accessToken: '', secret: '', remark: '' });
const selected = computed(() => channels.value.find((channel) => channel.id === selectedId.value));
const tokenConfigured = computed(() => !!selected.value?.accessToken);
const secretConfigured = computed(() => !!selected.value?.secret);
const loaded = ref(false);
const loadFailed = ref(false);
const loading = ref(false);
const saving = ref(false);
const busy = computed(() => loading.value || saving.value);

function selectChannel(id?: number) {
  selectedId.value = id;
  Object.assign(form, {
    name: selected.value?.name ?? '',
    enabled: selected.value?.enabled ?? false,
    remark: selected.value?.remark ?? '',
    accessToken: '',
    secret: ''
  });
}

async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    channels.value = (await getAlertChannels()).filter((channel): channel is AlertChannel & { id: number } => channel.id != null);
    selectChannel(selected.value?.id ?? channels.value[0]?.id);
    loaded.value = true;
  } catch {
    loaded.value = false;
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!loaded.value || busy.value) return;
  if (!form.name || (!form.accessToken && !tokenConfigured.value)) {
    ElMessage.warning('请填写机器人名称和 Webhook Access Token');
    return;
  }
  const data: AlertChannelSave = { ...form, accessToken: form.accessToken || undefined, secret: form.secret || undefined };
  saving.value = true;
  try {
    const saved = selectedId.value != null ? await updateAlertChannel(selectedId.value, data) : await createAlertChannel(data);
    form.accessToken = '';
    form.secret = '';
    selectedId.value = saved.id;
    await load();
    ElMessage.success('渠道配置已保存');
  } catch {
    // The shared request interceptor reports API errors.
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.channel-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  column-gap: 20px;
}

.reload {
  margin-top: 12px;
}
</style>
