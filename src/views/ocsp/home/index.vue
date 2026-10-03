<template>
  <div class="ocsp-home">
    <header>
      <span class="eyebrow">OCSP</span>
      <h1>在线证书状态服务</h1>
      <p>根据证书颁发者与序列号查询证书状态，生成签名 OCSP 响应，为证书验证提供状态依据。</p>
    </header>
    <section aria-labelledby="ocsp-core">
      <h2 id="ocsp-core">核心功能</h2>
      <div class="feature-grid">
        <article v-for="item in features" :key="item.title">
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
          <el-button v-if="findEntry(item.menu)" link type="primary" @click="openEntry(item.menu)"
            >{{ item.action }} <span aria-hidden="true">→</span></el-button
          >
        </article>
      </div>
    </section>
    <section class="flow">
      <h2>状态验证流程</h2>
      <ol>
        <li>接收 OCSP GET / POST 请求</li>
        <li>识别 CA 与证书序列号</li>
        <li>查询权威状态来源</li>
        <li>签名并返回 OCSP 响应</li>
      </ol>
      <p>GOOD、REVOKED、UNKNOWN 表示证书状态。数据源异常和响应生成失败应通过诊断确认，不能等同于证书状态。</p>
    </section>
    <section class="boundary">
      <h2>服务范围</h2>
      <p>本系统提供在线证书状态响应与运行管理。证书申请、签发、更新及注册审批由 CA / RA 系统处理。</p>
      <p>首页展示功能入口；实时请求统计和运行结果请查看服务概览与运行监控。</p>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { usePermissionStore } from '@/store/modules/permission';
import type { RouteRecordRaw } from 'vue-router';
const router = useRouter();
const permissions = usePermissionStore();
const entries = computed(() => {
  const result: Array<{ title: string; path: string }> = [];
  const walk = (routes: RouteRecordRaw[], base = '') => {
    for (const route of routes) {
      if (route.hidden) continue;
      const path = route.path.startsWith('/') ? route.path : (base + '/' + route.path).replace(/\/+/g, '/');
      if (route.children?.length) walk(route.children, path);
      else if (route.meta?.title) result.push({ title: String(route.meta.title), path });
    }
  };
  walk(permissions.getSidebarRoutes());
  return result;
});
const findEntry = (title: string) => entries.value.find((entry) => entry.title === title);
const openEntry = (title: string) => {
  const entry = findEntry(title);
  if (entry) void router.push(entry.path);
};
const features = [
  {
    title: '证书状态响应',
    description: '提供 RFC 6960 GET / POST 服务，返回 GOOD、REVOKED 或 UNKNOWN，并携带签名和有效期信息。',
    menu: '服务概览',
    action: '查看服务概览'
  },
  {
    title: '响应者与签名证书',
    description: '管理 CA 对应的响应者、签名证书和响应策略，支持现有软件及硬件签名配置。',
    menu: '响应者管理',
    action: '管理响应者'
  },
  {
    title: '证书状态数据源',
    description: '按 CA 配置数据库或 LDAP / AD 状态来源，管理校验、发布与生效配置。',
    menu: '按 CA 配置',
    action: '查看状态数据源'
  },
  { title: '运行监控', description: '查看运行汇总、数据源检查结果及告警，掌握服务异常和配置风险。', menu: '运行监控', action: '查看运行监控' },
  {
    title: '诊断与状态查询',
    description: '查询指定 CA 和序列号的证书状态，结合响应者详情中的路由诊断排查问题。',
    menu: '诊断工具',
    action: '进入诊断工具'
  },
  { title: '请求日志与审计', description: '查询 OCSP 请求记录，结合配置变更历史追踪运行行为与管理操作。', menu: '请求日志', action: '查看请求日志' }
];
</script>
<style scoped>
.ocsp-home {
  max-width: 1400px;
  margin: 0 auto;
  color: var(--el-text-color-primary);
}
header {
  padding: 28px 32px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  margin-bottom: 24px;
}
.eyebrow {
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--el-color-primary);
  font-weight: 600;
}
h1 {
  font-size: 28px;
  margin: 12px 0;
}
h2 {
  font-size: 20px;
  margin: 0 0 20px;
}
h3 {
  font-size: 17px;
  margin: 0 0 12px;
}
p {
  line-height: 1.8;
  color: var(--el-text-color-secondary);
  margin: 0;
}
section {
  margin-bottom: 24px;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
article {
  padding: 24px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
article p {
  flex: 1;
}
article .el-button {
  align-self: flex-start;
  margin: 0;
}
.flow,
.boundary {
  padding: 24px 28px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
}
ol {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
  margin: 0 0 20px;
  padding-left: 20px;
}
li {
  line-height: 1.8;
  padding-left: 4px;
}
@media (max-width: 1000px) {
  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  ol {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  header {
    padding: 20px;
  }
  h1 {
    font-size: 24px;
  }
  .feature-grid,
  ol {
    grid-template-columns: 1fr;
  }
  article,
  .flow,
  .boundary {
    padding: 20px;
  }
}
</style>
