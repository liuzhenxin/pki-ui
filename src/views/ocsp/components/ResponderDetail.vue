<template>
  <div v-loading="loading" class="responder-detail">
    <el-button link :icon="ArrowLeft" class="back-link" @click="emit('back')">返回响应者列表</el-button>
    <el-result v-if="error" icon="error" title="无法加载响应者" sub-title="请刷新重试，或确认当前账号的访问权限。">
      <template #extra><el-button @click="load">重新加载</el-button></template>
    </el-result>
    <template v-else-if="responder">
      <header class="detail-heading">
        <div>
          <div class="title-line">
            <h1>{{ responder.name }}</h1>
            <el-tag :type="responder.status === 'ACTIVE' ? 'success' : 'info'">{{ responderStatusLabel(responder.status) }}</el-tag
            ><el-tag :type="routing ? (routing.wouldActivate && routing.responderId === responder.id ? 'success' : 'warning') : 'info'">{{
              routing ? (routing.wouldActivate && routing.responderId === responder.id ? '路由诊断可用' : '路由需检查') : '未执行诊断'
            }}</el-tag>
          </div>
          <p>关联 CA ID：{{ responder.caId }}<span class="separator" />响应者 ID：{{ responder.id }}</p>
        </div>
        <div class="heading-actions">
          <el-button v-hasPermi="['ocsp:responder:save']" type="primary" :icon="Edit" @click="emit('edit', responder)">编辑配置</el-button
          ><el-button :icon="Search" @click="tab = 'diagnostics'">诊断</el-button>
        </div>
      </header>
      <div class="detail-surface">
        <el-tabs v-model="tab">
          <el-tab-pane label="概览" name="overview">
            <div class="summary-grid">
              <section>
                <h2>签名证书信息</h2>
                <dl>
                  <div>
                    <dt>证书主题</dt>
                    <dd>{{ certificate.subject }}</dd>
                  </div>
                  <div>
                    <dt>签名算法</dt>
                    <dd>{{ responder.signerAlgorithm || certificate.algorithm }}</dd>
                  </div>
                  <div>
                    <dt>证书有效期</dt>
                    <dd>{{ certificate.validity }}</dd>
                  </div>
                  <div>
                    <dt>证书序列号</dt>
                    <dd class="mono">{{ certificate.serial }}</dd>
                  </div>
                  <div>
                    <dt>颁发者</dt>
                    <dd>{{ certificate.issuer }}</dd>
                  </div>
                  <div>
                    <dt>时间有效性</dt>
                    <dd>
                      <el-tag :type="certificate.state === '有效期内' ? 'success' : 'warning'" size="small">{{ certificate.state }}</el-tag>
                    </dd>
                  </div>
                </dl>
              </section>
              <section>
                <h2>关联数据源</h2>
                <el-alert v-if="sourceError" type="warning" :closable="false" title="数据源读取失败，当前来源未确认" />
                <dl v-else-if="canReadSource">
                  <div>
                    <dt>配置来源</dt>
                    <dd>{{ sourceScope }}</dd>
                  </div>
                  <div>
                    <dt>数据源名称</dt>
                    <dd>{{ source?.name || '未提供' }}</dd>
                  </div>
                  <div>
                    <dt>数据源类型</dt>
                    <dd>{{ source?.type === 'DB' ? '数据库' : source?.type || '未配置' }}</dd>
                  </div>
                  <div>
                    <dt>配置开关</dt>
                    <dd>{{ source ? (source.enabled === false ? '停用' : '启用') : '-' }}</dd>
                  </div>
                  <div>
                    <dt>权威发布状态</dt>
                    <dd>{{ routing ? (routing.sourcePublished ? '已发布' : '未发布') : '请执行路由诊断' }}</dd>
                  </div>
                  <div>
                    <dt>诊断结果</dt>
                    <dd>{{ routing ? (routing.sourceValidationOk ? '校验通过' : routing.sourceFailureCode || '未通过校验') : '尚未检查' }}</dd>
                  </div>
                </dl>
                <el-empty v-else description="当前账号无数据源查看权限" :image-size="72" />
              </section>
              <section>
                <h2>响应参数配置</h2>
                <dl>
                  <div>
                    <dt>响应有效期</dt>
                    <dd>{{ validityLabel }}</dd>
                  </div>
                  <div>
                    <dt>Nonce 扩展</dt>
                    <dd>{{ responder.nonceEnabled ? '启用' : '关闭' }}</dd>
                  </div>
                  <div>
                    <dt>包含证书链</dt>
                    <dd>{{ responder.includeCerts ? '是' : '否' }}</dd>
                  </div>
                  <div>
                    <dt>响应内容类型</dt>
                    <dd>application/ocsp-response</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h2>其他信息</h2>
                <dl>
                  <div>
                    <dt>签名方式</dt>
                    <dd>{{ signerTypeLabel(responder.signerType) }}</dd>
                  </div>
                  <div>
                    <dt>最后更新</dt>
                    <dd>{{ responder.updateTime || '未提供' }}</dd>
                  </div>
                  <div>
                    <dt>签名策略</dt>
                    <dd>
                      {{
                        responder.signerPolicyOk === undefined
                          ? '未提供校验结果'
                          : responder.signerPolicyOk
                            ? '通过'
                            : responder.signerRejectionCode || '未通过'
                      }}
                    </dd>
                  </div>
                </dl>
                <p class="hint">证书时间有效性不代表签名链验证或实时服务健康。</p>
              </section>
            </div>
            <section class="history-section">
              <div class="section-heading">
                <h2>最近配置变更</h2>
                <el-button v-if="canReadHistory" link type="primary" @click="load">刷新</el-button>
              </div>
              <el-alert v-if="historyError" type="warning" :closable="false" title="配置历史读取失败，请刷新重试" /><el-table
                v-else-if="canReadHistory"
                :data="historyRows"
                class="history-table"
                ><el-table-column prop="createTime" label="时间" min-width="170" /><el-table-column
                  prop="action"
                  label="操作"
                  width="110" /><el-table-column prop="reason" label="变更原因" min-width="240" show-overflow-tooltip /><el-table-column
                  prop="revision"
                  label="版本"
                  width="90" /><el-table-column prop="actorUserId" label="操作人 ID" width="115" /></el-table
              ><el-empty v-else description="当前账号无配置历史查看权限" :image-size="72" />
            </section>
          </el-tab-pane>
          <el-tab-pane label="签名与证书" name="certificate"
            ><section class="tab-section">
              <div class="section-heading">
                <h2>在用签名证书</h2>
                <el-button :disabled="!responder.signerCert" @click="emit('certificate', responder)">查看完整证书</el-button>
              </div>
              <dl>
                <div>
                  <dt>主题</dt>
                  <dd>{{ certificate.subject }}</dd>
                </div>
                <div>
                  <dt>有效期</dt>
                  <dd>{{ certificate.validity }}</dd>
                </div>
                <div>
                  <dt>时间有效性</dt>
                  <dd>{{ certificate.state }}</dd>
                </div>
                <div>
                  <dt>签名方式</dt>
                  <dd>{{ signerTypeLabel(responder.signerType) }}</dd>
                </div>
              </dl>
              <p class="hint">在编辑配置中管理 CSR 与签发证书。私钥、PIN 和口令不在详情中展示。</p>
              <el-button v-hasPermi="['ocsp:responder:save']" type="primary" @click="emit('edit', responder)">管理签名配置与证书</el-button>
            </section></el-tab-pane
          >
          <el-tab-pane label="响应策略" name="policy"
            ><section class="tab-section">
              <h2>基础响应策略</h2>
              <dl>
                <div>
                  <dt>有效期</dt>
                  <dd>{{ validityLabel }}</dd>
                </div>
                <div>
                  <dt>Nonce</dt>
                  <dd>{{ responder.nonceEnabled ? '启用' : '关闭' }}</dd>
                </div>
                <div>
                  <dt>包含证书链</dt>
                  <dd>{{ responder.includeCerts ? '是' : '否' }}</dd>
                </div>
              </dl>
              <h2 class="policy-heading">高级协议扩展</h2>
              <dl>
                <div>
                  <dt>归档截止时间</dt>
                  <dd>
                    {{
                      responder.protocolExtensionPolicy?.archiveCutoffEnabled ? responder.protocolExtensionPolicy.archiveCutoff || '已启用' : '未启用'
                    }}
                  </dd>
                </div>
                <div>
                  <dt>CRL 引用</dt>
                  <dd>{{ responder.protocolExtensionPolicy?.crlReferenceEnabled ? '已启用' : '未启用' }}</dd>
                </div>
                <div>
                  <dt>签名算法协商</dt>
                  <dd>{{ responder.protocolExtensionPolicy?.preferredSignatureEnabled ? '启用' : '关闭' }}</dd>
                </div>
              </dl>
              <el-button v-hasPermi="['ocsp:responder:save']" type="primary" @click="emit('edit', responder)">编辑响应策略</el-button>
            </section></el-tab-pane
          >
          <el-tab-pane label="运行与诊断" name="diagnostics"
            ><section class="tab-section">
              <div class="section-heading">
                <h2>CA 路由诊断</h2>
                <el-button v-hasPermi="['ocsp:source:probe']" :loading="diagnosing" type="primary" @click="diagnose">执行只读诊断</el-button>
              </div>
              <p class="hint">检查此 CA 当前生效来源与签名选择，不修改已发布配置。</p>
              <el-alert v-if="diagnosticError" type="error" :closable="false" title="路由诊断失败，不能判定服务健康" /><el-descriptions
                v-if="routing"
                :column="1"
                border
                ><el-descriptions-item label="当前路由响应者">{{ routing.responderName || '未选择' }}</el-descriptions-item
                ><el-descriptions-item label="配置可激活">{{ routing.wouldActivate ? '是' : '否' }}</el-descriptions-item
                ><el-descriptions-item label="数据源类型">{{ routing.sourceType || '-' }}</el-descriptions-item
                ><el-descriptions-item label="结果">{{ routing.safeMessage || routing.rejectionCode || '-' }}</el-descriptions-item></el-descriptions
              ><el-empty v-else description="尚未执行诊断" :image-size="80" />
            </section>
            <section class="tab-section">
              <h2>证书状态查询</h2>
              <p class="hint">仅查询状态，不生成签名 OCSP 响应，也不写入请求日志。</p>
              <el-form :model="statusForm" @submit.prevent="queryStatus"
                ><el-form-item label="序列号"
                  ><el-input v-model="statusForm.serialNumber" placeholder="十六进制证书序列号" @keyup.enter="queryStatus" /></el-form-item
                ><el-form-item
                  ><el-checkbox v-model="statusForm.bypassCache">绕过缓存</el-checkbox
                  ><el-button v-hasPermi="['ocsp:status']" type="primary" :loading="querying" @click="queryStatus">查询状态</el-button></el-form-item
                ></el-form
              ><el-alert v-if="statusError" type="error" :closable="false" title="查询失败，不能将此结果视为证书 UNKNOWN" /><el-descriptions
                v-if="statusResult"
                :column="1"
                border
                ><el-descriptions-item label="状态">{{ statusResult.status }}</el-descriptions-item
                ><el-descriptions-item label="数据源">{{ statusResult.sourceType || '-' }}</el-descriptions-item
                ><el-descriptions-item label="序列号">{{ statusResult.serialNumber }}</el-descriptions-item
                ><el-descriptions-item label="命中缓存">{{ statusResult.cacheHit ? '是' : '否' }}</el-descriptions-item></el-descriptions
              >
            </section></el-tab-pane
          >
        </el-tabs>
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ArrowLeft, Edit, Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import auth from '@/plugins/auth';
import { getOcspResponder } from '@/api/ocsp/responder';
import { getOcspCaStatusSource } from '@/api/ocsp/caSource';
import { getOcspStatusSource } from '@/api/ocsp/config';
import { pageOcspConfigHistory, previewOcspRouting } from '@/api/ocsp/operations';
import { queryOcspCertStatus } from '@/api/ocsp/status';
import type { OcspResponder, OcspStatusSource, OcspConfigHistory, OcspRoutingPreview, OcspCertStatus } from '@/api/ocsp/types';
import { responderStatusLabel, signerTypeLabel, summarizeOcspCertificate } from '@/utils/ocspPresentation';
const props = defineProps<{ id: number; revision?: number }>();
const emit = defineEmits<{ back: []; edit: [responder: OcspResponder]; certificate: [responder: OcspResponder] }>();
const responder = ref<OcspResponder>();
const loading = ref(false),
  error = ref(false),
  sourceError = ref(false),
  historyError = ref(false);
const tab = ref('overview');
const source = ref<OcspStatusSource | null>(null),
  sourceScope = ref('');
const historyRows = ref<OcspConfigHistory[]>([]);
const routing = ref<OcspRoutingPreview>();
const diagnosing = ref(false),
  diagnosticError = ref(false),
  querying = ref(false),
  statusError = ref(false);
const statusResult = ref<OcspCertStatus>();
const statusForm = reactive({ serialNumber: '', bypassCache: false });
const canReadSource = computed(() => auth.hasPermi('ocsp:source'));
const canReadHistory = computed(() => auth.hasPermi('ocsp:config'));
const certificate = computed(() => summarizeOcspCertificate(responder.value?.signerCert));
const validityLabel = computed(() => {
  const value = responder.value?.responseValidity;
  return value === undefined ? '未提供' : value % 60 === 0 ? `${value / 60} 分钟` : `${value} 秒`;
});
let generation = 0;
onBeforeUnmount(() => {
  generation++;
});
const load = async () => {
  const current = ++generation;
  loading.value = true;
  responder.value = undefined;
  error.value = false;
  sourceError.value = false;
  historyError.value = false;
  source.value = null;
  sourceScope.value = '';
  historyRows.value = [];
  routing.value = undefined;
  statusResult.value = undefined;
  diagnosticError.value = false;
  statusError.value = false;
  diagnosing.value = false;
  querying.value = false;
  try {
    const detail = await getOcspResponder(props.id);
    if (current !== generation) return;
    responder.value = detail;
    await Promise.allSettled([
      (async () => {
        if (!canReadSource.value) return;
        try {
          const configured = await getOcspCaStatusSource(detail.caId);
          const effective = configured || (await getOcspStatusSource());
          if (current !== generation) return;
          source.value = effective;
          sourceScope.value = configured ? '按 CA 配置' : '默认来源';
        } catch {
          if (current === generation) sourceError.value = true;
        }
      })(),
      (async () => {
        if (!canReadHistory.value) return;
        try {
          const page = await pageOcspConfigHistory({ pageNum: 1, pageSize: 5, targetType: 'RESPONDER', targetKey: detail.name });
          if (current === generation) historyRows.value = page.records || [];
        } catch {
          if (current === generation) historyError.value = true;
        }
      })()
    ]);
  } catch {
    if (current === generation) {
      error.value = true;
      responder.value = undefined;
    }
  } finally {
    if (current === generation) loading.value = false;
  }
};
const diagnose = async () => {
  if (!responder.value || !auth.hasPermi('ocsp:source:probe')) return;
  const current = generation;
  diagnosing.value = true;
  diagnosticError.value = false;
  routing.value = undefined;
  try {
    const result = await previewOcspRouting({ caId: responder.value.caId });
    if (current === generation) routing.value = result;
  } catch {
    if (current === generation) diagnosticError.value = true;
  } finally {
    if (current === generation) diagnosing.value = false;
  }
};
const queryStatus = async () => {
  if (!responder.value || !auth.hasPermi('ocsp:status') || querying.value) return;
  const serialNumber = statusForm.serialNumber.trim();
  if (!serialNumber) return ElMessage.warning('请输入证书序列号');
  const current = generation;
  querying.value = true;
  statusError.value = false;
  statusResult.value = undefined;
  try {
    const result = await queryOcspCertStatus({ caId: responder.value.caId, serialNumber, bypassCache: statusForm.bypassCache });
    if (current === generation) statusResult.value = result;
  } catch {
    if (current === generation) statusError.value = true;
  } finally {
    if (current === generation) querying.value = false;
  }
};
watch(
  () => [props.id, props.revision],
  () => {
    statusForm.serialNumber = '';
    tab.value = 'overview';
    load();
  },
  { immediate: true }
);
</script>
<style scoped>
.responder-detail {
  padding: 12px 8px;
  color: var(--el-text-color-primary);
}
.back-link {
  margin-bottom: 20px;
}
.detail-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin: 0 16px 28px;
}
.title-line {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
}
h1 {
  font-size: 28px;
  line-height: 1.4;
  margin: 0;
  font-weight: 650;
}
.detail-heading p {
  color: var(--el-text-color-secondary);
  margin: 12px 0 0;
}
.separator {
  display: inline-block;
  height: 12px;
  width: 1px;
  background: var(--el-border-color);
  margin: 0 18px;
}
.heading-actions {
  display: flex;
  gap: 12px;
}
.heading-actions :deep(.el-button + .el-button) {
  margin: 0;
}
.detail-surface {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 0 24px 24px;
}
.detail-surface :deep(.el-tabs__item) {
  height: 56px;
  font-size: 15px;
  padding: 0 24px;
}
.detail-surface :deep(.el-tabs__header) {
  margin-bottom: 30px;
}
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 56px;
  row-gap: 28px;
}
.summary-grid section:nth-child(even) {
  border-left: 1px solid var(--el-border-color-extra-light);
  padding-left: 28px;
  margin-left: -28px;
}
h2 {
  font-size: 17px;
  margin: 0 0 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-weight: 600;
}
dl {
  margin: 0;
}
dl > div {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 18px;
  margin-bottom: 16px;
  line-height: 1.6;
}
dt {
  color: var(--el-text-color-secondary);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.mono {
  font-family: ui-monospace, Consolas, monospace;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.history-section {
  margin-top: 32px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 16px 20px;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.section-heading h2 {
  border: 0;
  padding: 0;
  margin: 0;
}
.history-table :deep(th) {
  background: var(--el-fill-color-light);
}
.tab-section {
  max-width: 900px;
  margin-bottom: 32px;
}
.policy-heading {
  margin-top: 32px;
}
.tab-section :deep(.el-form) {
  max-width: 650px;
}
.tab-section :deep(.el-checkbox) {
  margin-right: 18px;
}
@media (max-width: 1000px) {
  .summary-grid {
    column-gap: 32px;
  }
  dl > div {
    grid-template-columns: 115px minmax(0, 1fr);
    gap: 12px;
  }
  .summary-grid section:nth-child(even) {
    padding-left: 16px;
    margin-left: -16px;
  }
}
@media (max-width: 760px) {
  .responder-detail {
    padding: 4px 0;
  }
  .detail-heading {
    margin: 0 0 20px;
    flex-direction: column;
  }
  .title-line h1 {
    width: 100%;
    font-size: 24px;
  }
  .detail-surface {
    padding: 0 16px 16px;
  }
  .summary-grid {
    grid-template-columns: 1fr;
  }
  .summary-grid section:nth-child(even) {
    border: 0;
    padding: 0;
    margin: 0;
  }
  .detail-surface :deep(.el-tabs__item) {
    padding: 0 14px;
    font-size: 14px;
  }
  .history-section {
    padding: 14px;
  }
  .heading-actions {
    flex-wrap: wrap;
  }
}
</style>
