<template>
  <div class="app-container home">
    <el-row :gutter="20">
      <el-col :sm="24" :lg="12" style="padding-left: 20px">
        <h2>PKI-Cloud-KMC密钥管理中心</h2>
        <p>
          PKI-Cloud-KMC密钥管理中心
          <br />
          * 前端开发框架 Vue3、TS、Element UI<br />
          * 后端开发框架 Spring Boot<br />
          * 微服务开发框架 Spring Cloud、Spring Cloud Alibaba<br />
          * 权限认证框架 Sa-Token、Jwt 支持多终端认证系统<br />
          * 关系数据库 MySQL 适配 8.X 最低 5.7<br />
          * 关系数据库 Oracle 适配 11g 12c<br />
          * 关系数据库 PostgreSQL 适配 13 14<br />
          * 关系数据库 SQLServer 适配 2017 2019<br />
          * 缓存数据库 Redis 适配 6.X 最低 5.X<br />
          * 分布式注册中心 Alibaba Nacos 采用2.X 基于GRPC通信高性能<br />
          * 分布式配置中心 Alibaba Nacos 采用2.X 基于GRPC通信高性能<br />
          * 服务网关 Spring Cloud Gateway 响应式高性能网关<br />
          * 负载均衡 Spring Cloud Loadbalancer 负载均衡处理<br />
          * RPC远程调用 Apache Dubbo 原生态使用体验、高性能<br />
          * 分布式限流熔断 Alibaba Sentinel 无侵入、高扩展<br />
          * 分布式事务 Alibaba Seata 无侵入、高扩展 支持 四种模式<br />
          * 分布式消息队列 Apache Kafka 高性能高速度<br />
          * 分布式消息队列 Apache RocketMQ 高可用功能多样<br />
          * 分布式消息队列 RabbitMQ 支持各种扩展插件功能多样性<br />
          * 分布式搜索引擎 ElasticSearch 业界知名<br />
          * 分布式链路追踪 Apache SkyWalking 链路追踪、网格分析、度量聚合、可视化<br />
          * 分布式日志中心 ELK 业界成熟解决方案<br />
          * 分布式监控 Prometheus、Grafana 全方位性能监控<br />
          * 其余与 Vue 版本一致<br />
        </p>
        <p><b>当前版本:</b> <span>v2.5.1</span></p>
        <p>
          <el-tag type="danger">&yen;免费开源</el-tag>
        </p>
        <p>
          <el-button type="primary" icon="Cloudy" plain @click="goTarget('https://gitee.com/dromara/RuoYi-Cloud-Plus')">访问码云</el-button>
          <el-button type="primary" icon="Cloudy" plain @click="goTarget('https://github.com/dromara/RuoYi-Cloud-Plus')">访问GitHub</el-button>
          <el-button type="primary" icon="Cloudy" plain @click="goTarget('https://plus-doc.dromara.org/#/ruoyi-cloud-plus/changlog')"
            >更新日志</el-button
          >
        </p>
      </el-col>
    </el-row>
    <el-divider />
  </div>
</template>

<script setup name="Index" lang="ts">
const goTarget = (url: string) => {
  window.open(url, '__blank');
};
</script>

<style lang="scss" scoped>
.home {
  blockquote {
    padding: 10px 20px;
    margin: 0 0 20px;
    font-size: 17.5px;
    border-left: 5px solid #eee;
  }
  hr {
    margin-top: 20px;
    margin-bottom: 20px;
    border: 0;
    border-top: 1px solid #eee;
  }
  .col-item {
    margin-bottom: 20px;
  }

  ul {
    padding: 0;
    margin: 0;
  }

  font-family: 'open sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 13px;
  color: #676a6c;
  overflow-x: hidden;

  ul {
    list-style-type: none;
  }

  h4 {
    margin-top: 0px;
  }

  h2 {
    margin-top: 10px;
    font-size: 26px;
    font-weight: 100;
  }

  p {
    margin-top: 10px;

    b {
      font-weight: 700;
    }
  }

  .update-log {
    ol {
      display: block;
      list-style-type: decimal;
      margin-block-start: 1em;
      margin-block-end: 1em;
      margin-inline-start: 0;
      margin-inline-end: 0;
      padding-inline-start: 40px;
    }
  }
}
</style>
