<template>
  <div>
    <div class="pane-actions">
      <div>
        <h3>菜单显示配置</h3>
        <p>按服务粒度配置平台服务监控菜单是否显示 · 保存后立即生效</p>
      </div>
      <el-space>
        <el-button v-hasPermi="['ops:platform-service:edit']" type="primary" :loading="saving" @click="save">保存</el-button>
      </el-space>
    </div>

    <el-alert type="info" :closable="false" show-icon class="tip-alert">
      <template #title>
        <div>
          <p>· <b>应用服务监控</b>菜单显示由「Crypto/CA/KMC/RA/OCSP」任一启用控制（任一启用则显示）</p>
          <p>· 关闭全部服务开关后，「应用服务监控」菜单从平台服务目录隐藏；重新打开即恢复</p>
        </div>
      </template>
    </el-alert>

    <el-table v-loading="loading" :data="config.items" border>
      <el-table-column label="服务" min-width="140">
        <template #default="{ row }">
          <b>{{ row.name }}</b>
          <span class="ops-code">{{ row.serviceCode }}</span>
        </template>
      </el-table-column>
      <el-table-column label="服务编码" prop="serviceCode" min-width="140" show-overflow-tooltip />
      <el-table-column label="菜单显示" width="120" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.menuEnabled" :disabled="!proxy?.$auth.hasPermi('ops:platform-service:edit')" />
        </template>
      </el-table-column>
      <el-table-column label="排序" prop="sort" width="80" align="center" />
      <el-table-column label="说明" min-width="240">
        <template #default="{ row }">
          <span>{{ menuHint(row.serviceCode) }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup name="OpsMenuDisplayConfigPane" lang="ts">
import { getPlatformServiceMenuConfig, savePlatformServiceMenuConfig } from '@/api/ops';
import type { PlatformServiceMenuConfig } from '@/api/ops/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const loading = ref(false);
const saving = ref(false);
const config = reactive<PlatformServiceMenuConfig>({ items: [] });

const menuHint = (code: string) => {
  const hints: Record<string, string> = {
    crypto: '应用服务监控显示条件之一',
    ca: '应用服务监控显示条件之一',
    kmc: '应用服务监控显示条件之一',
    ra: '应用服务监控显示条件之一',
    ocsp: '应用服务监控显示条件之一'
  };
  return hints[code] || '';
};

const load = async () => {
  loading.value = true;
  try {
    const res = await getPlatformServiceMenuConfig();
    config.items = res?.data?.items || [];
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  saving.value = true;
  try {
    await savePlatformServiceMenuConfig(JSON.parse(JSON.stringify(config)));
    ElMessage.success('菜单显示配置已保存');
    await load();
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<style scoped lang="scss">
.pane-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  h3 {
    margin: 0;
    color: #1d3557;
  }

  p {
    margin: 4px 0 0;
    color: #6c757d;
    font-size: 13px;
  }
}

.tip-alert {
  margin-bottom: 14px;

  p {
    margin: 2px 0;
  }
}

.ops-code {
  display: block;
  margin-top: 3px;
  color: #6c757d;
  font-size: 12px;
}
</style>
