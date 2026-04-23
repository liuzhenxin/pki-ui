<template>
  <div class="app-container home">
    <!-- 头部介绍 -->
    <el-card class="box-card header-card" shadow="hover">
      <div class="header">
        <div class="icon-wrapper">
          <el-icon :size="48" color="#fff"><Platform /></el-icon>
        </div>
        <div class="header-title">
          <h2>{{ systemTitle }}</h2>
          <p>{{ systemDesc }}</p>
        </div>
      </div>
    </el-card>

    <!-- 密钥库状态 (全宽) - 仅 KMC 显示 -->
    <el-card v-if="isKMC" class="box-card status-card" shadow="hover">
      <template #header>
        <div class="card-header status-header">
          <div class="title">
            <el-icon><DataLine /></el-icon>
            <span>密钥库状态监控</span>
          </div>
          <div class="status-tags">
            <el-tag type="success" effect="dark" class="mr-2">系统运行状态：正常</el-tag>
            <el-tag type="info" effect="plain">安全告警：无告警</el-tag>
          </div>
        </div>
      </template>
      <el-row :gutter="20">
        <el-col :xs="24" :sm="24" :md="8">
          <div class="chart-wrapper">
            <div class="chart-header">
              <span>备用密钥库</span>
              <el-tooltip content="存放待使用的密钥对，低于阈值时将自动补充。" placement="top">
                <el-icon><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <div ref="backupKeyChartRef" style="width: 100%; height: 220px"></div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="24" :md="8">
          <div class="chart-wrapper">
            <div class="chart-header">
              <span>在用密钥库</span>
              <el-tooltip content="存放在当前使用的密钥对，与用户证书关联。" placement="top">
                <el-icon><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <div ref="activeKeyChartRef" style="width: 100%; height: 220px"></div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="24" :md="8">
          <div class="chart-wrapper">
            <div class="chart-header">
              <span>历史密钥库</span>
              <el-tooltip content="存放已过期或被撤销的密钥对，供审计与恢复使用。" placement="top">
                <el-icon><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <div ref="historyKeyChartRef" style="width: 100%; height: 220px"></div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- NAS 专用仪表盘 -->
    <NASDashboard v-if="isNAS" />

    <!-- CA 专用仪表盘 -->
    <CADashboard v-if="isCA" />

    <el-row v-if="!isNAS && !isCA" :gutter="20" class="main-content">
      <!-- 左侧：核心功能 -->
      <el-col :xs="24" :sm="24" :lg="16">
        <el-card class="box-card feature-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><Menu /></el-icon>
              <span>核心功能{{ isKMC ? '（遵循 GM/T 0038）' : '' }}{{ isNAS ? '（高性能网络存储）' : '' }}</span>
            </div>
          </template>
          <el-row :gutter="20" class="feature-list">
            <template v-if="isKMC">
              <el-col :span="12">
                <ul>
                  <li>
                    <div class="feature-icon"><el-icon><Key /></el-icon></div>
                    <div class="feature-content">
                      <b>密钥生成与保存</b>
                      <p>在硬件密码设备中安全生成加密密钥对，并加密存储于密钥库。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon"><el-icon><Share /></el-icon></div>
                    <div class="feature-content">
                      <b>密钥分发</b>
                      <p>通过安全通道向CA中心分发密钥，确保只有最终用户能获取其私钥。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon"><el-icon><CopyDocument /></el-icon></div>
                    <div class="feature-content">
                      <b>密钥备份与恢复</b>
                      <p>提供已用密钥的自动备份及授权恢复机制，应对密钥丢失或设备损坏。</p>
                    </div>
                  </li>
                </ul>
              </el-col>
              <el-col :span="12">
                <ul>
                  <li>
                    <div class="feature-icon"><el-icon><Refresh /></el-icon></div>
                    <div class="feature-content">
                      <b>密钥更新与撤销</b>
                      <p>支持证书到期或用户请求时的密钥更新，并安全撤销旧密钥。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon"><el-icon><OfficeBuilding /></el-icon></div>
                    <div class="feature-content">
                      <b>认证中心管理</b>
                      <p>维护接入的CA机构信息，实现注册、更新、冻结、解冻等操作。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon"><el-icon><Document /></el-icon></div>
                    <div class="feature-content">
                      <b>安全审计</b>
                      <p>独立审计员角色，对所有密钥生命周期及管理操作进行全面审计。</p>
                    </div>
                  </li>
                </ul>
              </el-col>
            </template>
            <template v-else>
              <el-col :span="12">
                <ul>
                  <li>
                    <div class="feature-icon"><el-icon><Key /></el-icon></div>
                    <div class="feature-content">
                      <b>证书签发</b>
                      <p>支持多种算法（RSA, SM2）的证书签发，满足不同安全需求。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon"><el-icon><Share /></el-icon></div>
                    <div class="feature-content">
                      <b>证书吊销</b>
                      <p>提供证书吊销服务，并发布CRL（证书吊销列表）。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon"><el-icon><CopyDocument /></el-icon></div>
                    <div class="feature-content">
                      <b>证书查询</b>
                      <p>提供证书状态查询服务（OCSP），实时验证证书有效性。</p>
                    </div>
                  </li>
                </ul>
              </el-col>
              <el-col :span="12">
                <ul>
                  <li>
                    <div class="feature-icon"><el-icon><Refresh /></el-icon></div>
                    <div class="feature-content">
                      <b>证书更新</b>
                      <p>支持证书到期前的自动或手动更新，确保证书持续可用。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon"><el-icon><OfficeBuilding /></el-icon></div>
                    <div class="feature-content">
                      <b>RA管理</b>
                      <p>管理注册机构（RA），实现证书申请的审核与批准。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon"><el-icon><Document /></el-icon></div>
                    <div class="feature-content">
                      <b>日志审计</b>
                      <p>记录所有证书操作日志，满足合规性审计要求。</p>
                    </div>
                  </li>
                </ul>
              </el-col>
            </template>
          </el-row>
        </el-card>
      </el-col>

      <!-- 右侧：合规性与技术特性 -->
      <el-col :xs="24" :sm="24" :lg="8">
        <el-card class="box-card compliance-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <el-icon><Stamp /></el-icon>
              <span>合规性与技术特性</span>
            </div>
          </template>
          <el-row>
            <el-col :span="24">
              <ul class="compliance-list">
                <template v-if="isKMC">
                  <li>
                    <el-icon><SuccessFilled /></el-icon> 符合 GM/T 0038 证书认证密钥管理系统检测规范
                  </li>
                  <li>
                    <el-icon><SuccessFilled /></el-icon> 密码运算在经国家密码主管部门审批的硬件密码设备中运行
                  </li>
                  <li>
                    <el-icon><SuccessFilled /></el-icon> 采用三权分立管理机制（系统管理员、密钥管理员、安全审计员）
                  </li>
                </template>
                <template v-else>
                  <li>
                    <el-icon><SuccessFilled /></el-icon> 符合 X.509 v3 标准及相关国家标准
                  </li>
                  <li>
                    <el-icon><SuccessFilled /></el-icon> 支持国密算法（SM2, SM3, SM4）及国际算法
                  </li>
                  <li>
                    <el-icon><SuccessFilled /></el-icon> 高可用架构，确保CA服务的连续性与稳定性
                  </li>
                </template>
              </ul>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>

    <!-- 系统信息 (全宽) -->
    <el-card v-if="!isNAS && !isCA" class="box-card update-log" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon><InfoFilled /></el-icon>
          <span>系统信息</span>
        </div>
      </template>
      <div class="body">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="24" :md="8">
            <div class="contact-info-box">
              <div class="contact-item">
                <div class="icon-box"><el-icon><User /></el-icon></div>
                <div class="info">
                  <span class="label">技术支持</span>
                  <a href="mailto:liuzhenxin@ec.com.cn">liuzhenxin@ec.com.cn</a>
                </div>
              </div>
              <div class="contact-item">
                <div class="icon-box"><el-icon><Phone /></el-icon></div>
                <div class="info">
                  <span class="label">联系电话</span>
                  <a href="javascript:;">010-12345678</a>
                </div>
              </div>
            </div>
          </el-col>
          <el-col :xs="24" :sm="24" :md="16">
            <h4 style="margin: 0 0 15px 0; font-size: 16px; color: #303133; font-weight: 600;">更新日志</h4>
            <el-collapse accordion>
              <el-collapse-item title="v4.1.2 - 2025-11-25" name="1">
                <ol>
                  <template v-if="isKMC">
                    <li>新增：密钥库状态监控面板，实时显示备用、在用、历史密钥库状态</li>
                    <li>优化：密钥分发流程，增强分发安全性</li>
                    <li>修复：密钥备份恢复功能的问题</li>
                  </template>
                  <template v-else>
                    <li>新增：请求者管理功能，支持API/LDAP/DATABASE三种类型</li>
                    <li>新增：请求者证书管理，支持证书PEM数据的查看和管理</li>
                    <li>新增：根证书授权模板功能，支持模板授权管理</li>
                    <li>优化：证书模板管理，支持RootCA类型模板筛选</li>
                    <li>优化：业务管理员管理，支持证书签发和USBKey集成</li>
                    <li>修复：证书状态显示问题</li>
                  </template>
                </ol>
              </el-collapse-item>
              <el-collapse-item title="v4.1.1 - 2025-08-20" name="2">
                <ol>
                  <template v-if="isKMC">
                    <li>优化：密钥生成算法，提高生成效率</li>
                    <li>新增：密钥使用情况统计报表</li>
                    <li>修复：密钥库容量预警不准确的问题</li>
                  </template>
                  <template v-else>
                    <li>新增：证书吊销列表（CRL）管理功能</li>
                    <li>新增：CRL导入导出功能</li>
                    <li>优化：证书模板管理界面，使用标签页展示基本信息、主题信息、扩展信息</li>
                    <li>优化：证书主题组件，支持动态配置字段</li>
                    <li>修复：证书模板保存时的数据格式问题</li>
                  </template>
                </ol>
              </el-collapse-item>
              <el-collapse-item title="v4.1.0 - 2025-05-10" name="3">
                <ol>
                  <template v-if="isKMC">
                    <li>新增：CA机构管理功能，支持注册、更新、冻结、解冻操作</li>
                    <li>新增：密钥更新自动化流程</li>
                    <li>优化：密钥备份策略，支持多级备份</li>
                    <li>修复：审计日志记录不完整的问题</li>
                  </template>
                  <template v-else>
                    <li>新增：证书管理功能，支持证书申请、签发、查询、吊销</li>
                    <li>新增：证书模板管理，支持自定义证书模板配置</li>
                    <li>新增：X509证书解析组件，支持证书详细信息查看</li>
                    <li>新增：证书主题组件，支持证书主题信息配置</li>
                    <li>优化：证书状态查询（OCSP）性能</li>
                  </template>
                </ol>
              </el-collapse-item>
              <el-collapse-item title="v4.0.2 - 2025-03-15" name="4">
                <ol>
                  <template v-if="isKMC">
                    <li>优化：三权分立权限管理，增强系统安全性</li>
                    <li>新增：密钥分发日志记录</li>
                    <li>修复：密钥恢复失败的问题</li>
                  </template>
                  <template v-else>
                    <li>新增：根证书管理功能，支持根证书创建和管理</li>
                    <li>新增：根证书初始化功能</li>
                    <li>优化：CA系统整体架构，提升系统稳定性</li>
                    <li>修复：用户权限控制问题</li>
                  </template>
                </ol>
              </el-collapse-item>
              <el-collapse-item title="v4.0.1 - 2025-01-20" name="5">
                <ol>
                  <template v-if="isKMC">
                    <li>KMC 密钥管理中心初始版本发布</li>
                    <li>遵循 GM/T 0038 规范实现密钥全生命周期管理</li>
                    <li>集成国密算法支持</li>
                  </template>
                  <template v-else>
                    <li>CA 证书认证系统初始版本发布</li>
                    <li>支持全生命周期证书管理</li>
                    <li>全面支持国密算法体系</li>
                  </template>
                </ol>
              </el-collapse-item>
            </el-collapse>
          </el-col>
        </el-row>
      </div>
    </el-card>
  </div>
</template>

<script setup name="Index" lang="ts">
import { useRouter } from 'vue-router';
import { onMounted, ref, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import { useUserStore } from '@/store/modules/user';
import { getTenant } from '@/api/system/tenant';
import NASDashboard from '@/views/nas/index.vue';
import CADashboard from '@/views/ca/index.vue';

const router = useRouter();
const userStore = useUserStore();
const backupKeyChartRef = ref<HTMLElement | null>(null);
const activeKeyChartRef = ref<HTMLElement | null>(null);
const historyKeyChartRef = ref<HTMLElement | null>(null);

let backupKeyChart: echarts.ECharts | null = null;
let activeKeyChart: echarts.ECharts | null = null;
let historyKeyChart: echarts.ECharts | null = null;

const tenantInfo = ref<any>(null);
const currentTenantId = computed(() => userStore.tenantId || localStorage.getItem('tenantId'));
const isKMC = computed(() => String(currentTenantId.value) === '3');
const isNAS = computed(() => String(currentTenantId.value) === '10');
const isCA = computed(() => String(currentTenantId.value) === '4');

const systemTitle = computed(() => {
  if (tenantInfo.value && tenantInfo.value.name) {
    return tenantInfo.value.name;
  }
  if (isKMC.value) return 'PKI-Cloud-KMC密钥管理中心';
  if (isNAS.value) return 'PKI-Cloud-NAS网络存储管理系统';
  return 'PKI-Cloud-CA证书认证系统';
});

const systemDesc = computed(() => {
  if (isKMC.value) {
    return '为数字认证中心（CA）提供加密密钥对，并提供对这些密钥对的备份、归档、恢复、更新等全生命周期服务，以满足认证中心和司法取证的需要。';
  }
  if (isNAS.value) {
    return '提供高性能、高可靠的网络存储管理服务，支持多协议接入、数据迁移、备份恢复及容量动态扩展，确保存储资源的高效利用与安全。';
  }
  return '提供数字证书的全生命周期管理服务，包括证书申请、签发、查询、吊销、更新等，构建可信的网络安全基础环境。';
});

/**
 * 获取租户信息
 */
const fetchTenantInfo = async () => {
  if (currentTenantId.value) {
    try {
      const res = await getTenant(currentTenantId.value);
      tenantInfo.value = res.data;
    } catch (error) {
      console.error('获取租户信息失败:', error);
    }
  }
};

const goTarget = (url: string) => {
  if (url.startsWith('http')) {
    window.open(url, '__blank');
  } else {
    router.push(url);
  }
};

const createChartOption = (data: number[]) => {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['RSA 2048', 'SM2'],
      axisTick: {
        alignWithLabel: true
      }
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '数量',
        type: 'bar',
        barWidth: '40%',
        data: [
          { value: data[0], itemStyle: { color: '#409EFF' } },
          { value: data[1], itemStyle: { color: '#67C23A' } }
        ],
        label: {
          show: true,
          position: 'top'
        }
      }
    ]
  };
};

const initCharts = () => {
  if (isKMC.value) {
    if (backupKeyChartRef.value) {
      backupKeyChart = echarts.init(backupKeyChartRef.value);
      backupKeyChart.setOption(createChartOption([50, 50]));
    }

    if (activeKeyChartRef.value) {
      activeKeyChart = echarts.init(activeKeyChartRef.value);
      activeKeyChart.setOption(createChartOption([500, 500]));
    }

    if (historyKeyChartRef.value) {
      historyKeyChart = echarts.init(historyKeyChartRef.value);
      historyKeyChart.setOption(createChartOption([67, 67]));
    }
  }
};

onMounted(() => {
  fetchTenantInfo();
  initCharts();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  backupKeyChart?.dispose();
  activeKeyChart?.dispose();
  historyKeyChart?.dispose();
});

const handleResize = () => {
  backupKeyChart?.resize();
  activeKeyChart?.resize();
  historyKeyChart?.resize();
};
</script>

<style lang="scss" scoped>
.home {
  background-color: #f0f2f5;
  padding: 20px;
  min-height: 100vh;

  .box-card {
    margin-bottom: 20px;
    border-radius: 8px;
    border: none;
    box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
    transition: all 0.3s;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 21, 41, 0.12);
    }
  }

  .header-card {
    background: linear-gradient(135deg, #409eff 0%, #3a8ee6 100%);
    color: #fff;

    .header {
      display: flex;
      align-items: center;
      padding: 10px;

      .icon-wrapper {
        background: rgba(255, 255, 255, 0.2);
        padding: 15px;
        border-radius: 50%;
        margin-right: 25px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .header-title {
        h2 {
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 1px;
        }
        p {
          margin: 0;
          font-size: 15px;
          opacity: 0.9;
          line-height: 1.6;
          max-width: 800px;
        }
      }
    }
  }

  .card-header {
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    color: #303133;

    .el-icon {
      margin-right: 8px;
      font-size: 18px;
      color: #409eff;
    }
  }

  .status-header {
    justify-content: space-between;

    .title {
      display: flex;
      align-items: center;
    }

    .status-tags {
      .el-tag {
        margin-left: 10px;
      }
    }
  }

  .feature-card {
    .feature-list ul {
      list-style-type: none;
      padding: 0;
      margin: 0;
      li {
        display: flex;
        margin-bottom: 20px;
        align-items: flex-start;

        .feature-icon {
          background-color: #ecf5ff;
          color: #409eff;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 15px;
          flex-shrink: 0;
          font-size: 18px;
        }

        .feature-content {
          b {
            display: block;
            font-size: 15px;
            color: #303133;
            margin-bottom: 5px;
          }
          p {
            margin: 0;
            font-size: 13px;
            color: #909399;
            line-height: 1.5;
          }
        }
      }
    }
  }

  .compliance-card {
    background: #fff;
    height: 100%;

    .compliance-list {
      list-style-type: none;
      padding: 0;
      margin: 0;
      li {
        line-height: 40px;
        font-size: 14px;
        color: #606266;
        display: flex;
        align-items: center;
        border-bottom: 1px dashed #ebeef5;

        &:last-child {
          border-bottom: none;
        }

        .el-icon {
          margin-right: 10px;
          color: #67c23a;
          font-size: 16px;
        }
      }
    }
  }

  .chart-wrapper {
    background-color: #fff;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    padding: 15px;
    transition: all 0.3s;

    &:hover {
      border-color: #c6e2ff;
      box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
    }

    .chart-header {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 15px;
      font-weight: 600;
      color: #303133;
      font-size: 15px;

      .el-icon {
        margin-left: 8px;
        color: #909399;
        cursor: pointer;
        font-size: 14px;

        &:hover {
          color: #409eff;
        }
      }
    }
  }

  .update-log {
    ol {
      display: block;
      list-style-type: decimal;
      margin-block-start: 0.5em;
      margin-block-end: 0.5em;
      margin-inline-start: 0;
      margin-inline-end: 0;
      padding-inline-start: 20px;

      li {
        color: #606266;
        line-height: 1.8;
        font-size: 14px;
      }
    }

    .contact-info-box {
      background-color: #f8f9fa;
      padding: 25px;
      border-radius: 8px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;

      .contact-item {
        display: flex;
        align-items: center;
        margin-bottom: 20px;

        &:last-child {
          margin-bottom: 0;
        }

        .icon-box {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #e6f7ff;
          color: #1890ff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 15px;
          font-size: 20px;
        }

        .info {
          display: flex;
          flex-direction: column;

          .label {
            font-size: 12px;
            color: #909399;
            margin-bottom: 2px;
          }

          a {
            color: #303133;
            text-decoration: none;
            font-weight: 500;
            font-size: 15px;
            transition: color 0.3s;

            &:hover {
              color: #409eff;
            }
          }
        }
      }
    }
  }

  .mr-2 {
    margin-right: 10px;
  }
}
</style>
