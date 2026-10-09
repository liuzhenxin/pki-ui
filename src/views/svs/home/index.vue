<template>
  <main class="svs-home">
    <div class="home-heading">
      <div>
        <p class="product-label">签名验签服务器 / {{ roleName }}</p>
        <h1>{{ title }}</h1>
        <p class="muted">{{ description }}</p>
      </div>
      <el-button :loading="loading" @click="load">刷新数据</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="notice" />
    <template v-if="identity">
      <el-alert
        v-if="identity.role === 'SECADMIN'"
        title="安全配置由当前账号按职责直接提交，保存前核对影响范围与变更原因。"
        type="warning"
        :closable="false"
        show-icon
        class="notice"
      />
      <el-skeleton v-if="loading && !data" :rows="6" animated />
      <template v-else>
        <div class="cards">
          <el-card v-for="card in cards" :key="card.label" shadow="never"
            ><div class="muted">{{ card.label }}</div>
            <div class="card-value" :class="card.tone">{{ card.value }}</div>
            <div class="footnote">{{ card.note }}</div></el-card
          >
        </div>
        <div class="home-grid">
          <div>
            <el-card shadow="never" class="panel"
              ><template #header
                ><div class="panel-heading">
                  <b>{{ listTitle }}</b
                  ><el-button link type="primary" :disabled="!allowed(mainPath)" @click="go(mainPath)">查看全部 →</el-button>
                </div></template
              >
              <div v-if="!ready(mainSection)" class="failure">
                <span>{{ sectionMessage(mainSection) }}</span
                ><el-button link type="primary" @click="load">重试</el-button>
              </div>
              <el-table v-else :data="mainRows" :empty-text="emptyText">
                <el-table-column label="事项 / 对象" min-width="170"
                  ><template #default="{ row }">{{ row.name || row.objectId || row.operation || row.id }}</template></el-table-column
                >
                <el-table-column label="说明" min-width="200"
                  ><template #default="{ row }">{{ rowDescription(row) }}</template></el-table-column
                >
                <el-table-column label="状态" width="110"
                  ><template #default="{ row }"
                    ><el-tag :type="tagType(row)">{{ stateText(row) }}</el-tag></template
                  ></el-table-column
                >
                <el-table-column label="操作" width="130"
                  ><template #default="{ row }"
                    ><el-button link type="primary" @click="openRow(row)">{{
                      identity.role === 'SYSADMIN' ? '查看应用' : identity.role === 'SECADMIN' ? '查看授权' : '查看审计记录'
                    }}</el-button></template
                  ></el-table-column
                >
              </el-table>
            </el-card>
            <el-card v-if="identity.role === 'SYSADMIN'" shadow="never" class="panel"
              ><template #header><b>24 小时调用结果</b></template>
              <div v-if="!ready('calls')" class="failure">{{ sectionMessage('calls') }}</div>
              <el-table v-else :data="data?.sections.calls?.data.counts || []" empty-text="最近24小时暂无调用"
                ><el-table-column prop="operation" label="接口" /><el-table-column prop="result" label="结果" /><el-table-column
                  prop="count"
                  label="次数"
              /></el-table>
              <p class="footnote">按接口及结果统计；非成功结果需进一步区分业务验签不通过与技术故障。</p></el-card
            >
            <el-card v-else-if="identity.role === 'SECADMIN'" shadow="never" class="panel"
              ><template #header><b>证书与授权提醒</b></template>
              <div v-if="!ready('certificates')" class="failure">{{ sectionMessage('certificates') }}</div>
              <template v-else
                ><div v-for="row in certificateRows" :key="row.id" class="status-row">
                  <div>
                    {{ row.subject }}
                    <p class="footnote">{{ expiry(row.notAfter) }}</p>
                  </div>
                  <el-button link type="primary" @click="go('/svs/certificates')">查看证书</el-button>
                </div>
                <p v-if="!certificateRows.length" class="muted">暂无已过期或30天内到期的启用证书</p></template
              >
              <div v-if="!ready('grants')" class="failure">{{ sectionMessage('grants') }}</div>
              <template v-else
                ><div v-for="row in grantRows" :key="row.id" class="status-row">
                  <div>
                    应用 {{ row.applicationId }}
                    <p class="footnote">授权{{ expiry(row.expiresAt) }}</p>
                  </div>
                  <el-button link type="primary" @click="go('/svs/grants')">查看授权</el-button>
                </div>
                <p v-if="!grantRows.length" class="muted">暂无已过期或7天内到期的启用授权</p></template
              >
            </el-card>
            <el-card v-else shadow="never" class="panel"
              ><template #header><b>审计关注</b></template>
              <p>优先核对权限拒绝、公钥错配和敏感配置变更，结合对象版本与配置变更记录分析。</p>
              <p class="footnote">失败与拒绝按日志结果字段分别统计；管理活动包括直接配置变更、证书维护和账号迁移。审计意见数量不代表异常闭环。</p>
              <el-button v-if="allowed('/svs/approvals')" @click="go('/svs/approvals')">追溯历史审批记录</el-button></el-card
            >
          </div>
          <div>
            <el-card shadow="never" class="panel"
              ><template #header><b>常用入口</b></template>
              <div class="quick">
                <el-button v-for="link in quickLinks" :key="link.path" @click="go(link.path)">{{ link.label }} →</el-button>
              </div></el-card
            >
            <el-card shadow="never" class="panel"
              ><template #header
                ><div class="panel-heading"><b>服务状态</b><span class="muted">只读</span></div></template
              >
              <div class="status-row">
                <span>首页服务响应</span><el-tag :type="error ? 'warning' : 'success'">{{ error ? '未知' : '正常' }}</el-tag>
              </div>
              <div class="status-row">
                <span>密码设备</span><el-tag :type="deviceState === 'UP' ? 'success' : 'warning'">{{ deviceText }}</el-tag>
              </div>
              <div class="status-row"><span>初始化</span><el-tag type="info">已完成</el-tag></div>
              <p class="footnote">
                最近数据获取：{{ data ? date(data.updatedAt) : '尚未获取' }}<br />最近成功刷新：{{ lastSuccess ? date(lastSuccess) : '尚未成功' }}
              </p>
              <el-button v-if="allowed('/svs/runtime')" link type="primary" @click="go('/svs/runtime')">查看运行详情 →</el-button></el-card
            >
          </div>
        </div>
        <p class="footnote">
          {{ identity.role === 'SECADMIN' ? '证书及授权按当前有效期计算' : '统计范围：最近24小时' }} · 数据每60秒刷新，页面隐藏时暂停 ·
          {{ identity.username }}
        </p>
      </template>
    </template>
  </main>
</template>
<script setup lang="ts" name="SvsHome">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import * as home from '@/api/svs/home';
import { session, menus, type Session, type Menu } from '@/api/svs/product';
const router = useRouter();
const identity = ref<Session>();
const data = ref<home.HomeSummary>();
const error = ref('');
const loading = ref(false);
const paths = ref<string[]>([]);
const lastSuccess = ref('');
let timer: ReturnType<typeof setInterval> | undefined;
let alive = true;
const roleName = computed(
  () => ({ SYSADMIN: '系统管理员', SECADMIN: '安全管理员', AUDITOR: '审计管理员' })[identity.value?.role || ''] || '身份校验中'
);
const title = computed(() => ({ SYSADMIN: '运行工作台', SECADMIN: '安全工作台', AUDITOR: '审计工作台' })[identity.value?.role || ''] || '首页');
const description = computed(
  () =>
    ({
      SYSADMIN: '关注服务是否可用，及时定位调用与接入问题。',
      SECADMIN: '处理安全变更与资源配置，关注证书及授权有效期。',
      AUDITOR: '追溯直接操作与历史变更，记录异常分析和审计意见。'
    })[identity.value?.role || ''] || '正在校验平台身份'
);
const allowed = (path: string) => paths.value.includes(path);
const go = (path: string, query?: Record<string, string>) => {
  if (allowed(path)) router.push({ path, query });
};
const ready = (name: string) => !error.value && data.value?.sections[name]?.ready === true;
const value = (section: string, key: keyof home.HomeData) => (ready(section) ? (data.value?.sections[section].data[key] ?? '未知') : '未知');
const sectionMessage = (name: string) => error.value || data.value?.sections[name]?.message || '数据尚未获取';
const card = (label: string, section: string, key: keyof home.HomeData, note: string, tone = '') => ({
  label,
  value: value(section, key),
  note,
  tone
});
const deviceState = computed(() => String(value('runtime', 'deviceState')));
const deviceText = computed(() => ({ UP: '可用', DEGRADED: '降级', DOWN: '不可用', STARTING: '启动中' })[deviceState.value] || '未知');
const cards = computed(() =>
  identity.value?.role === 'SYSADMIN'
    ? [
        { label: '密码设备', value: deviceText.value, note: '设备状态与服务运行详情分开检查', tone: deviceState.value === 'UP' ? 'good' : 'warn' },
        card('24 小时调用', 'calls', 'total', '统计范围：最近24小时'),
        card('非成功调用', 'calls', 'failed', '含业务验签不通过及技术失败', 'warn'),
        card('接入应用', 'applications', 'total', '已登记应用总数')
      ]
    : identity.value?.role === 'SECADMIN'
      ? [
          card('密钥引用', 'keys', 'total', '已登记的设备公钥引用'),
          card('启用接口授权', 'grants', 'total', '已启用授权数量，需关注有效期'),
          card('30 天内到期证书', 'certificates', 'expiring', `已过期：${value('certificates', 'expired')} 张`, 'warn'),
          card('有效签名绑定', 'grants', 'validBindings', '启用绑定、有效证书及设备公钥匹配')
        ]
      : [
          card('24 小时失败事件', 'audit', 'failed', '日志结果为失败', 'warn'),
          card('24 小时拒绝事件', 'audit', 'rejected', '日志结果为拒绝', 'warn'),
          card('24 小时管理活动', 'audit', 'activities', '配置、证书维护及迁移事件'),
          card('审计意见', 'opinions', 'total', '已记录意见总数')
        ]
);
const mainSection = computed(() => (identity.value?.role === 'SYSADMIN' ? 'applications' : identity.value?.role === 'SECADMIN' ? 'grants' : 'audit'));
const mainPath = computed(() =>
  identity.value?.role === 'SYSADMIN' ? '/svs/applications' : identity.value?.role === 'SECADMIN' ? '/svs/grants' : '/svs/audit'
);
const listTitle = computed(() =>
  identity.value?.role === 'SYSADMIN' ? '接入应用' : identity.value?.role === 'SECADMIN' ? '授权有效期提醒' : '最近失败与拒绝事件'
);
const emptyText = computed(() =>
  identity.value?.role === 'SYSADMIN'
    ? '暂无接入应用，可从常用入口登记'
    : identity.value?.role === 'SECADMIN'
      ? '暂无已过期或7天内到期的启用授权'
      : '最近24小时暂无失败或拒绝事件'
);
const mainRows = computed(() => {
  if (!ready(mainSection.value)) return [];
  const section = data.value?.sections[mainSection.value]?.data;
  return section?.rows || [];
});
const certificateRows = computed(() => (ready('certificates') ? data.value?.sections.certificates.data.rows || [] : []));
const grantRows = computed(() => (ready('grants') ? data.value?.sections.grants.data.rows || [] : []));
const quickLinks = computed(() =>
  (identity.value?.role === 'SYSADMIN'
    ? [
        ['接入应用', 'applications'],
        ['运行状态', 'runtime'],
        ['配置备份', 'backup'],
        ['历史审批记录', 'approvals']
      ]
    : identity.value?.role === 'SECADMIN'
      ? [
          ['签名证书 / CSR', 'certificates'],
          ['接口授权', 'grants'],
          ['签名资源绑定', 'bindings'],
          ['证书校验策略', 'policies']
        ]
      : [
          ['日志查询 / 导出', 'audit'],
          ['历史审批记录', 'approvals'],
          ['追加审计意见', 'opinions']
        ]
  )
    .map(([label, page]) => ({ label, path: '/svs/' + page }))
    .filter((link) => allowed(link.path))
);
const date = (v?: string) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const expiry = (v?: string) => (v && new Date(v).getTime() <= Date.now() ? `已过期 · ${date(v)}` : `到期：${date(v)}`);
const stateText = (r: home.HomeRow) =>
  r.result || (r.expiresAt ? (new Date(r.expiresAt).getTime() <= Date.now() ? '已过期' : '即将到期') : r.enabled ? '启用' : '停用');
const tagType = (r: home.HomeRow): 'success' | 'warning' | 'info' | 'danger' =>
  ['失败', '拒绝', '已过期'].includes(stateText(r)) ? 'danger' : r.expiresAt ? 'warning' : 'info';
const rowDescription = (r: home.HomeRow) =>
  identity.value?.role === 'SYSADMIN'
    ? r.id
    : identity.value?.role === 'SECADMIN'
      ? `应用 ${r.applicationId} · ${expiry(r.expiresAt)}`
      : `${date(r.time)} · ${r.user} · ${r.objectName || ''}`;
const openRow = (r: home.HomeRow) =>
  go(mainPath.value, identity.value?.role === 'AUDITOR' ? { result: r.result || '', operation: r.operation || '' } : undefined);
function flatten(list: Menu[]): string[] {
  return list.flatMap((m) => [m.path, ...flatten(m.children)]).filter(Boolean);
}
async function load() {
  if (loading.value || !alive) return;
  loading.value = true;
  try {
    if (!identity.value) {
      const [current, tree] = await Promise.all([session(), menus()]);
      if (!alive) return;
      if (!['SYSADMIN', 'SECADMIN', 'AUDITOR'].includes(current.role) || current.tenantId !== 9) throw new Error('当前账号没有有效的SVS产品角色');
      identity.value = current;
      paths.value = flatten(tree);
    }
    const result = await home.summary();
    if (!alive) return;
    if (result.role !== identity.value.role || result.username !== identity.value.username) throw new Error('首页身份与登录账号不一致，请重新登录');
    data.value = result;
    error.value = '';
    if (Object.values(result.sections).every((s) => s.ready)) lastSuccess.value = result.updatedAt;
  } catch (e) {
    if (alive) error.value = e instanceof Error ? e.message : '首页数据读取失败，请重试';
  } finally {
    if (alive) loading.value = false;
  }
}
onMounted(() => {
  load();
  timer = setInterval(() => {
    if (!document.hidden) load();
  }, 60000);
});
onUnmounted(() => {
  alive = false;
  if (timer) clearInterval(timer);
});
</script>
<style scoped>
.svs-home {
  padding: 24px;
}
.home-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}
.product-label {
  color: var(--el-color-primary);
  font-size: 12px;
  margin: 0;
}
.home-heading h1 {
  font-size: 26px;
  font-weight: 600;
  margin: 8px 0;
}
.muted,
.footnote {
  color: var(--el-text-color-secondary);
}
.footnote {
  font-size: 12px;
  line-height: 1.8;
}
.notice {
  margin-bottom: 20px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.card-value {
  font-size: 30px;
  font-weight: 600;
  margin: 12px 0;
}
.good {
  color: var(--el-color-success);
}
.warn {
  color: var(--el-color-warning);
}
.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr);
  gap: 20px;
}
.home-grid > div {
  min-width: 0;
}
.panel {
  margin-bottom: 20px;
}
.panel-heading,
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.status-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.quick {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.quick .el-button {
  margin: 0;
  white-space: normal;
  min-height: 54px;
  height: auto;
}
.failure {
  padding: 20px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
.tabs {
  margin-bottom: 16px;
}
h3 {
  font-size: 14px;
  margin-top: 24px;
}
@media (max-width: 1100px) {
  .cards {
    grid-template-columns: 1fr 1fr;
  }
  .home-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .svs-home {
    padding: 12px;
  }
  .home-heading {
    flex-direction: column;
  }
  .home-heading h1 {
    font-size: 22px;
  }
  .cards {
    gap: 10px;
  }
  .card-value {
    font-size: 24px;
  }
}
</style>
