<template>
  <div class="tsa-page">
    <div class="page-header">
      <div>
        <h1>TSA 时间戳服务</h1>
        <p>监控 RFC 3161 服务、密码卡和 TSA 证书状态</p>
      </div>
      <el-button type="primary" :loading="store.loading" @click="store.refresh">刷新</el-button>
    </div>
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon class="mb16" />
    <el-row :gutter="16">
      <el-col v-for="item in statuses" :key="item.label" :xs="24" :sm="8">
        <el-card
          ><el-statistic :title="item.label" :value="item.value" /><el-tag :type="tagType(item.value)">{{ item.value }}</el-tag></el-card
        >
      </el-col>
    </el-row>
    <el-card class="mt16">
      <template #header
        ><div class="card-header">
          <span>TSA 证书</span
          ><el-button v-hasPermi="['tsa:certificate:manage']" type="primary" :disabled="store.health?.hsm === 'DOWN'">导入证书</el-button>
        </div></template
      >
      <el-table v-loading="store.loading" :data="store.certificates">
        <template #empty><el-empty description="暂无 TSA 证书" /></template>
        <el-table-column prop="subject" label="证书主题" min-width="220" />
        <el-table-column prop="policyOid" label="策略 OID" width="180" />
        <el-table-column prop="keyReferenceMasked" label="密钥引用（脱敏）" width="180" />
        <el-table-column prop="notAfter" label="有效期至" width="180" />
        <el-table-column prop="status" label="状态" width="110"
          ><template #default="{ row }"
            ><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="操作" width="180"
          ><template #default="{ row }"
            ><el-button
              v-hasPermi="['tsa:certificate:manage']"
              link
              type="primary"
              :disabled="store.health?.hsm === 'DOWN' || row.status === 'ACTIVE'"
              @click="activate(row.id)"
              >启用</el-button
            ><el-button v-hasPermi="['tsa:certificate:manage']" link type="warning" :disabled="store.health?.hsm === 'DOWN'" @click="rotate(row.id)"
              >轮换</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </el-card>
  </div>
</template>

<script setup name="TsaDashboard" lang="ts">
import { computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { activateTsaCertificate, rotateTsaCertificate } from '@/api/tsa';
import { useTsaStore } from '@/store/modules/tsa';

const store = useTsaStore();
const statuses = computed(() => [
  { label: '服务状态', value: store.health?.service || 'DOWN' },
  { label: 'HSM / 密码卡', value: store.health?.hsm || 'DOWN' },
  { label: 'RFC 3161 协议', value: store.health?.protocol || 'DOWN' }
]);
const tagType = (status: string) => (status === 'UP' ? 'success' : status === 'DEGRADED' ? 'warning' : 'danger');
const activate = async (id: string) => {
  await ElMessageBox.confirm('确认启用该 TSA 证书？');
  await activateTsaCertificate(id);
  ElMessage.success('证书已启用');
  await store.refresh();
};
const rotate = async (id: string) => {
  await ElMessageBox.confirm('轮换将切换活动签名证书，是否继续？', '安全确认', { type: 'warning' });
  await rotateTsaCertificate(id);
  ElMessage.success('证书轮换完成');
  await store.refresh();
};
onMounted(store.refresh);
</script>

<style scoped lang="scss">
.tsa-page {
  padding: 20px;
}
.page-header,
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-header {
  margin-bottom: 20px;
}
.page-header h1 {
  margin: 0 0 6px;
}
.page-header p {
  margin: 0;
  color: var(--el-text-color-secondary);
}
.mt16 {
  margin-top: 16px;
}
.mb16 {
  margin-bottom: 16px;
}
</style>
