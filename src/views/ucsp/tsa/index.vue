<template>
  <div class="p-2">
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <div class="tsa-heading">
          <div>
            <h2>时间戳资源池</h2>
            <p>测试 RFC 3161 端点，组建资源池，再发布供应用授权的时间戳服务。</p>
          </div>
          <el-button icon="Refresh" @click="reload">刷新</el-button>
        </div>
      </template>
      <el-alert v-if="loadFailed" title="配置读取失败，请刷新后重试。" type="error" :closable="false" show-icon />
      <el-tabs v-else v-model="tab">
        <el-tab-pane name="endpoints" label="TSA 端点">
          <el-button v-hasPermi="[write]" class="mb-3" type="primary" icon="Plus" @click="editEndpoint()">新增端点</el-button>
          <el-table :data="directory.endpoints" empty-text="暂无端点">
            <el-table-column prop="name" label="名称" min-width="160" />
            <el-table-column prop="configRef" label="连接配置" min-width="150" />
            <el-table-column label="状态" width="130">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? (row.healthy ? 'success' : 'warning') : 'info'">
                  {{ row.enabled ? (row.healthy ? '验证通过' : '需测试') : '已停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="155">
              <template #default="{ row }">
                <el-button v-hasPermi="[write]" link type="primary" @click="editEndpoint(row)">编辑</el-button>
                <el-button v-hasPermi="[write]" link type="primary" :disabled="!row.enabled" @click="openProbe(row)">连接测试</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="pools" label="资源池">
          <el-button v-hasPermi="[write]" class="mb-3" type="primary" icon="Plus" @click="editPool()">新建资源池</el-button>
          <el-table :data="directory.pools" empty-text="暂无资源池">
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column label="池内端点" min-width="190">
              <template #default="{ row }">{{ row.members.map(endpointName).join('、') }}</template>
            </el-table-column>
            <el-table-column label="调用配额" width="170">
              <template #default="{ row }">{{ row.maxRequests }} 次 / {{ row.windowSeconds }} 秒</template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template #default="{ row }">
                <el-button v-hasPermi="[write]" link type="primary" @click="editPool(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="services" label="时间戳服务">
          <el-button v-hasPermi="[write]" class="mb-3" type="primary" icon="Plus" @click="editService()">新建服务</el-button>
          <el-table :data="directory.services" empty-text="暂无服务">
            <el-table-column prop="name" label="服务名称" min-width="135" />
            <el-table-column prop="objectId" label="业务对象标识" min-width="135" />
            <el-table-column label="资源池" min-width="125">
              <template #default="{ row }">{{ directory.pools.find((pool) => pool.id === row.poolId)?.name || row.poolId }}</template>
            </el-table-column>
            <el-table-column label="路由" min-width="175">
              <template #default="{ row }">
                {{ endpointName(row.primary) }}{{ row.backup ? ' / ' + endpointName(row.backup) : '（单端点）' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="92">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已启用' : '已停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template #default="{ row }">
                <el-button v-hasPermi="[write]" link type="primary" @click="editService(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="dialogOpen" :title="dialogTitle" width="min(580px, calc(100vw - 32px))" :close-on-click-modal="false">
      <el-form v-if="dialog === 'endpoint'" label-position="top" @submit.prevent="submit">
        <el-form-item label="端点名称" required><el-input v-model="endpoint.name" maxlength="120" /></el-form-item>
        <el-form-item label="部署连接配置" required>
          <el-select v-model="endpoint.configRef" placeholder="选择已部署的连接配置" no-data-text="尚无可用部署配置">
            <el-option v-for="configuration in directory.configurationRefs" :key="configuration" :label="configuration" :value="configuration" />
          </el-select>
          <div class="tsa-help">连接地址、信任证书和可选认证凭据由部署配置提供。</div>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="endpoint.enabled" /></el-form-item>
      </el-form>

      <el-form v-if="dialog === 'pool'" label-position="top" @submit.prevent="submit">
        <el-form-item label="资源池名称" required><el-input v-model="pool.name" maxlength="120" /></el-form-item>
        <el-form-item label="池内端点" required>
          <el-select v-model="pool.members" multiple :multiple-limit="32" placeholder="选择已启用端点">
            <el-option v-for="option in directory.endpoints" :key="option.id!" :label="option.name" :value="option.id!" :disabled="!option.enabled" />
          </el-select>
        </el-form-item>
        <div class="tsa-fields">
          <el-form-item label="窗口内调用上限" required><el-input-number v-model="pool.maxRequests" :min="1" :max="2147483647" /></el-form-item>
          <el-form-item label="窗口长度（秒）" required><el-input-number v-model="pool.windowSeconds" :min="1" :max="86400" /></el-form-item>
        </div>
      </el-form>

      <el-form v-if="dialog === 'service'" label-position="top" @submit.prevent="submit">
        <el-form-item label="服务名称" required><el-input v-model="service.name" maxlength="120" /></el-form-item>
        <el-form-item label="资源池" required>
          <el-select v-model="service.poolId" placeholder="选择时间戳资源池" @change="clearRoute">
            <el-option v-for="option in directory.pools" :key="option.id!" :label="option.name" :value="option.id!" />
          </el-select>
        </el-form-item>
        <el-form-item label="路由方式">
          <el-radio-group v-model="routeMode" @change="service.backup = null">
            <el-radio-button value="single">单端点</el-radio-button>
            <el-radio-button value="backup">主备</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <div class="tsa-fields">
          <el-form-item :label="routeMode === 'backup' ? '主端点' : '服务端点'" required>
            <el-select v-model="service.primary" placeholder="选择已验证端点" @change="service.backup = null">
              <el-option v-for="option in routeEndpoints" :key="option.id!" :label="option.name" :value="option.id!" :disabled="!option.healthy" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="routeMode === 'backup'" label="备端点" required>
            <el-select v-model="service.backup" placeholder="选择已验证端点">
              <el-option
                v-for="option in routeEndpoints"
                :key="option.id!"
                :label="option.name"
                :value="option.id!"
                :disabled="!option.healthy || option.configRef === routeEndpoints.find((item) => item.id === service.primary)?.configRef"
              />
            </el-select>
          </el-form-item>
        </div>
        <div class="tsa-fields">
          <el-form-item label="摘要算法">
            <el-select v-model="service.algorithm"> <el-option label="SHA-256" value="SHA256" /><el-option label="SM3" value="SM3" /> </el-select>
          </el-form-item>
          <el-form-item label="业务对象标识" required><el-input v-model="service.objectId" maxlength="128" /></el-form-item>
        </div>
        <el-form-item label="时间戳策略 OID" :required="routeMode === 'backup'">
          <el-input
            v-model="service.policyOid"
            maxlength="128"
            :placeholder="routeMode === 'backup' ? '主备共同验证的策略 OID' : '留空时使用端点默认策略'"
          />
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="service.enabled" /></el-form-item>
      </el-form>

      <el-form v-if="dialog === 'probe'" label-position="top" @submit.prevent="submit">
        <el-form-item label="测试端点"><el-input :model-value="endpoint.name" readonly /></el-form-item>
        <el-form-item label="摘要算法">
          <el-select v-model="probeAlgorithm"> <el-option label="SHA-256" value="SHA256" /><el-option label="SM3" value="SM3" /> </el-select>
        </el-form-item>
        <el-form-item label="时间戳策略 OID"><el-input v-model="probePolicy" maxlength="128" placeholder="留空时使用端点默认策略" /></el-form-item>
        <el-alert v-if="verifiedPolicy" type="success" :title="'验证通过，返回策略 OID ' + verifiedPolicy" :closable="false" show-icon />
      </el-form>

      <el-alert v-if="actionError" :title="actionError" type="error" :closable="false" show-icon />
      <template #footer>
        <el-button :disabled="submitting" @click="dialogOpen = false">{{ verifiedPolicy ? '关闭' : '取消' }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">{{ dialog === 'probe' ? '发起测试' : '保存' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="UcspTimestampPool">
import { ElMessage } from 'element-plus';
import { getDirectory, saveEndpoint, savePool, saveService, testEndpoint } from '@/api/ucsp/tsa';
import type { Algorithm, Directory, Endpoint, Pool, TimestampService } from '@/api/ucsp/tsa';

const write = 'ucsp:tsa:write';
const directory = ref<Directory>({ endpoints: [], pools: [], services: [], configurationRefs: [] });
const tab = ref('endpoints');
const loading = ref(false);
const loadFailed = ref(false);
const submitting = ref(false);
const dialogOpen = ref(false);
const dialog = ref<'endpoint' | 'pool' | 'service' | 'probe'>('endpoint');
const actionError = ref('');
const verifiedPolicy = ref('');
const probeAlgorithm = ref<Algorithm>('SHA256');
const probePolicy = ref('');
const routeMode = ref<'single' | 'backup'>('single');

const newEndpoint = (): Endpoint => ({ id: null, version: 0, name: '', configRef: '', enabled: true, healthy: false });
const newPool = (): Pool => ({ id: null, version: 0, name: '', members: [], maxRequests: 100, windowSeconds: 60 });
const newService = (): TimestampService => ({
  id: null,
  version: 0,
  name: '',
  poolId: '',
  primary: '',
  backup: null,
  algorithm: 'SHA256',
  objectId: '',
  policyOid: null,
  enabled: true
});
const endpoint = ref(newEndpoint());
const pool = ref(newPool());
const service = ref(newService());
const routeEndpoints = computed(() => {
  const members = directory.value.pools.find((item) => item.id === service.value.poolId)?.members || [];
  return directory.value.endpoints.filter((item) => item.enabled && item.id && members.includes(item.id));
});
const dialogTitle = computed(() => {
  if (dialog.value === 'probe') return 'RFC 3161 连接测试';
  if (dialog.value === 'pool') return pool.value.id ? '编辑时间戳资源池' : '新建时间戳资源池';
  if (dialog.value === 'service') return service.value.id ? '编辑时间戳服务' : '新建时间戳服务';
  return endpoint.value.id ? '编辑 TSA 端点' : '新增 TSA 端点';
});

const endpointName = (id: string) => directory.value.endpoints.find((item) => item.id === id)?.name || id;

const reload = async () => {
  loading.value = true;
  loadFailed.value = false;
  try {
    const response = await getDirectory();
    if (!response.data) throw new Error('directory missing');
    directory.value = response.data;
  } catch {
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
};
const open = (type: typeof dialog.value) => {
  dialog.value = type;
  actionError.value = '';
  verifiedPolicy.value = '';
  dialogOpen.value = true;
};
const editEndpoint = (item?: Endpoint) => {
  endpoint.value = item ? { ...item } : newEndpoint();
  open('endpoint');
};
const openProbe = (item: Endpoint) => {
  endpoint.value = { ...item };
  probeAlgorithm.value = 'SHA256';
  probePolicy.value = '';
  open('probe');
};
const editPool = (item?: Pool) => {
  pool.value = item ? { ...item, members: [...item.members] } : newPool();
  open('pool');
};
const editService = (item?: TimestampService) => {
  service.value = item ? { ...item } : newService();
  routeMode.value = item?.backup ? 'backup' : 'single';
  open('service');
};
const clearRoute = () => {
  service.value.primary = '';
  service.value.backup = null;
};

const validationError = () => {
  if (dialog.value === 'endpoint' && (!endpoint.value.name.trim() || !endpoint.value.configRef)) return '请填写端点名称并选择连接配置。';
  if (dialog.value === 'pool' && (!pool.value.name.trim() || !pool.value.members.length || !pool.value.maxRequests || !pool.value.windowSeconds))
    return '请填写资源池名称、池内端点和配额。';
  if (dialog.value === 'service') {
    const value = service.value;
    if (!value.name.trim() || !value.poolId || !value.primary || !/^[A-Za-z0-9_.-]{1,128}$/.test(value.objectId))
      return '请填写服务名称、资源池、端点和业务对象标识。对象标识支持英文字母、数字、点、下划线和连字符。';
    if (routeMode.value === 'backup' && (!value.backup || !value.policyOid?.trim())) return '请指定备端点及主备共同验证的策略 OID。';
  }
  return '';
};

const submit = async () => {
  if (submitting.value) return;
  actionError.value = validationError();
  if (actionError.value) return;
  submitting.value = true;
  verifiedPolicy.value = '';
  try {
    if (dialog.value === 'probe' && endpoint.value.id) {
      const result = await testEndpoint(endpoint.value.id, endpoint.value.version, probeAlgorithm.value, probePolicy.value);
      verifiedPolicy.value = result.data || '';
    } else {
      if (dialog.value === 'endpoint') await saveEndpoint(endpoint.value);
      if (dialog.value === 'pool') await savePool(pool.value);
      if (dialog.value === 'service') await saveService(service.value);
      dialogOpen.value = false;
      ElMessage.success('配置已保存');
    }
    await reload();
  } catch {
    actionError.value =
      dialog.value === 'probe' ? '测试失败。请检查端点状态、部署连接配置、摘要算法和策略。' : '保存失败。请检查端点测试、池成员或配置版本后重试。';
  } finally {
    submitting.value = false;
  }
};

onMounted(reload);
</script>

<style scoped>
.tsa-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tsa-heading h2 {
  margin: 0 0 0.25rem;
  font-size: 1.125rem;
  font-weight: 600;
}

.tsa-heading p,
.tsa-help {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.tsa-help {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
}

.tsa-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr));
  gap: 0 1rem;
}

.el-select {
  width: 100%;
}
</style>
