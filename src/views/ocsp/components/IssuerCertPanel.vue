<template>
  <el-card shadow="never">
    <el-alert
      title="登记签发目标证书的 CA 公钥证书，用于识别 OCSP 请求中的签发者。密钥轮换时请先登记新证书并验证，再移除旧记录。"
      type="info"
      :closable="false"
      show-icon
      class="mb16"
    />
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="CA ID" required>
        <el-input v-model="caId" inputmode="numeric" placeholder="输入完整 CA ID" :disabled="busy" @input="clearResults" />
      </el-form-item>
      <el-button :loading="loading" :disabled="busy" @click="load">查询登记记录</el-button>
    </el-form>
    <el-alert v-if="loadError" title="签发者证书读取失败，当前登记状态未知" type="error" :closable="false" show-icon class="mt16" />
    <el-table v-if="queriedCaId" v-loading="loading" :data="rows" border class="mt16">
      <el-table-column prop="subjectDn" label="证书主体" min-width="180" show-overflow-tooltip />
      <el-table-column prop="fingerprint" label="证书指纹" min-width="220" show-overflow-tooltip />
      <el-table-column prop="hashAlgorithm" label="请求哈希算法" width="140" />
      <el-table-column label="状态" width="90"
        ><template #default="{ row }">{{ row.enabled === true ? '启用' : row.enabled === false ? '停用' : '未知' }}</template></el-table-column
      >
      <el-table-column label="操作" width="100"
        ><template #default="{ row }"
          ><el-button v-hasPermi="['ocsp:source:save']" link type="danger" :disabled="busy" @click="remove(row)">删除记录</el-button></template
        ></el-table-column
      >
    </el-table>
    <template v-if="queriedCaId">
      <el-form label-position="top" class="mt16" @submit.prevent>
        <el-form-item label="CA 签发者证书 PEM">
          <el-input v-model="certificatePem" type="textarea" :rows="7" placeholder="粘贴 PEM 格式的 CA 公钥证书，不要包含私钥" />
        </el-form-item>
        <el-button v-hasPermi="['ocsp:source:save']" type="primary" :loading="busy" @click="enroll">登记证书</el-button>
      </el-form>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { listOcspIssuerCerts, removeOcspIssuerCert, saveOcspIssuerCert, type OcspIssuerCert } from '@/api/ocsp/issuerCert';
import { normalizeOcspCaId } from '@/utils/ocspIdentifier';

const props = defineProps<{ initialCaId?: string }>();
const caId = ref(props.initialCaId || '');
const queriedCaId = ref('');
const certificatePem = ref('');
const rows = ref<OcspIssuerCert[]>([]);
const loading = ref(false);
const busy = ref(false);
const loadError = ref(false);
let generation = 0;

const clearResults = () => {
  generation++;
  loading.value = false;
  queriedCaId.value = '';
  rows.value = [];
  certificatePem.value = '';
  loadError.value = false;
};

const load = async () => {
  let id: string;
  try {
    id = normalizeOcspCaId(caId.value);
  } catch (error: any) {
    clearResults();
    ElMessage.error(error.message);
    return;
  }
  const requestGeneration = ++generation;
  queriedCaId.value = '';
  rows.value = [];
  loading.value = true;
  loadError.value = false;
  try {
    const result = await listOcspIssuerCerts(id);
    if (requestGeneration !== generation) return;
    rows.value = result || [];
    queriedCaId.value = id;
  } catch {
    if (requestGeneration === generation) loadError.value = true;
  } finally {
    if (requestGeneration === generation) loading.value = false;
  }
};

const enroll = async () => {
  const pem = certificatePem.value.trim();
  if (!queriedCaId.value || caId.value.trim() !== queriedCaId.value || !pem || /PRIVATE KEY/i.test(pem)) {
    ElMessage.error('请先查询正确的 CA ID，并仅输入不含私钥的 PEM 证书');
    return;
  }
  busy.value = true;
  try {
    await saveOcspIssuerCert(queriedCaId.value, pem);
    certificatePem.value = '';
    ElMessage.success('登记完成，请检查两种哈希记录');
    await load();
  } catch {
    ElMessage.error('登记未完成，请重新查询记录，确认实际登记状态');
    await load();
  } finally {
    busy.value = false;
  }
};

const remove = async (row: OcspIssuerCert) => {
  let id: string;
  try {
    id = normalizeOcspCaId(row.id);
    if (!queriedCaId.value || caId.value.trim() !== queriedCaId.value || normalizeOcspCaId(row.caId) !== queriedCaId.value)
      throw new Error('CA ID 不匹配');
  } catch {
    ElMessage.error('证书记录或 CA ID 无效，请重新查询');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `删除 ${row.hashAlgorithm || '未知算法'} 的签发者身份记录可能导致该 CA 的对应 OCSP 请求无法路由。请确认替代证书已验证。`,
      '确认删除单条哈希记录',
      { type: 'warning' }
    );
  } catch {
    return;
  }
  if (!queriedCaId.value || caId.value.trim() !== queriedCaId.value || normalizeOcspCaId(row.caId) !== queriedCaId.value) {
    ElMessage.error('CA 已更改，请重新查询');
    return;
  }
  busy.value = true;
  try {
    await removeOcspIssuerCert(id);
    ElMessage.success('记录已删除');
    await load();
  } finally {
    busy.value = false;
  }
};

onMounted(() => {
  if (caId.value) void load();
});
</script>

<style scoped>
.mt16 {
  margin-top: 16px;
}
.mb16 {
  margin-bottom: 16px;
}
</style>
