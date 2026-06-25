<template>
  <div class="app-container home">
    <!-- 头部介绍 -->
    <el-card v-if="!isLicense" class="box-card header-card" shadow="hover">
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

    <div v-if="isLicense" class="license-dashboard">
      <section class="license-hero">
        <div class="license-hero-main">
          <div class="license-kicker">License 授权中心</div>
          <h1>{{ systemTitle }}</h1>
          <p>面向 CA、KMC、RA 与 ZX-TrustReader 等产品，统一签发、校验、吊销和下载授权文件，集中掌握客户授权状态与即将到期风险。</p>
          <div class="license-hero-actions">
            <el-button type="primary" icon="Plus" @click="goTarget('/license/admin')">签发 License</el-button>
            <el-button icon="CircleCheck" @click="goTarget('/license/admin')">校验 License</el-button>
          </div>
        </div>
        <div class="license-hero-side">
          <div class="license-status-row">
            <span>授权服务</span>
            <el-tag type="success" effect="plain">运行中</el-tag>
          </div>
          <div class="license-service-score">
            <strong>{{ licenseSummary.active }}</strong>
            <span>当前可用授权</span>
          </div>
          <div class="license-service-grid">
            <div>
              <span>已签发</span>
              <b>{{ licenseSummary.issued }}</b>
            </div>
            <div>
              <span>即将到期</span>
              <b>{{ licenseSummary.expiring }}</b>
            </div>
          </div>
        </div>
      </section>

      <el-row :gutter="16" class="license-metrics">
        <el-col v-for="item in licenseMetricCards" :key="item.label" :xs="12" :sm="12" :md="6">
          <div class="license-metric-card" :class="item.tone">
            <div class="license-metric-icon">
              <el-icon><component :is="item.icon" /></el-icon>
            </div>
            <div class="license-metric-copy">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="16" class="license-main-grid">
        <el-col :xs="24" :lg="16">
          <el-card class="license-panel" shadow="never">
            <template #header>
              <div class="license-panel-header">
                <div>
                  <h2>产品授权概览</h2>
                  <span>不同产品保持独立功能点，签发时自动带入默认授权能力。</span>
                </div>
                <el-button text type="primary" icon="Refresh" @click="fetchLicenseHomeData">刷新</el-button>
              </div>
            </template>
            <div class="license-product-list">
              <button v-for="item in licenseProducts" :key="item.name" type="button" class="license-product-item" @click="goTarget('/license/admin')">
                <div class="license-product-title">
                  <el-icon><component :is="item.icon" /></el-icon>
                  <div>
                    <b>{{ item.label }}</b>
                    <span>{{ item.version }}</span>
                  </div>
                </div>
                <div class="license-product-count">
                  <strong>{{ licenseProductCounts[item.name] || 0 }}</strong>
                  <span>授权记录</span>
                </div>
                <div class="license-feature-tags">
                  <el-tag v-for="feature in item.features.slice(0, 4)" :key="feature" effect="plain">{{ feature }}</el-tag>
                </div>
              </button>
            </div>
          </el-card>

          <el-card class="license-panel license-workflow-panel" shadow="never">
            <template #header>
              <div class="license-panel-header">
                <div>
                  <h2>授权处理流程</h2>
                  <span>从客户资料到授权交付，每一步都有明确状态和可追溯记录。</span>
                </div>
              </div>
            </template>
            <div class="license-flow">
              <div v-for="step in licenseFlowSteps" :key="step.title" class="license-flow-step">
                <div class="license-flow-icon">
                  <el-icon><component :is="step.icon" /></el-icon>
                </div>
                <div>
                  <b>{{ step.title }}</b>
                  <p>{{ step.desc }}</p>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :xs="24" :lg="8">
          <el-card class="license-panel license-action-panel" shadow="never">
            <template #header>
              <div class="license-panel-header">
                <div>
                  <h2>快捷操作</h2>
                  <span>常用授权动作集中入口。</span>
                </div>
              </div>
            </template>
            <div class="license-actions">
              <button v-for="action in licenseActions" :key="action.title" type="button" @click="goTarget(action.path)">
                <el-icon><component :is="action.icon" /></el-icon>
                <span>{{ action.title }}</span>
                <small>{{ action.desc }}</small>
              </button>
            </div>
          </el-card>

          <el-card class="license-panel" shadow="never">
            <template #header>
              <div class="license-panel-header">
                <div>
                  <h2>风险提醒</h2>
                  <span>优先关注吊销和到期风险。</span>
                </div>
              </div>
            </template>
            <div class="license-risk-list">
              <div v-for="item in licenseRiskItems" :key="item.label" class="license-risk-item">
                <div>
                  <span>{{ item.label }}</span>
                  <p>{{ item.desc }}</p>
                </div>
                <el-tag :type="item.type" effect="plain">{{ item.value }}</el-tag>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>


    <!-- 密钥库状态 (全宽) - 仅 KMC admin 显示 -->
    <el-card v-if="!isLicense && isKMC && userStore.permissions.includes('kmc:dashboard:view')" class="box-card status-card" shadow="hover">
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
    <NASDashboard v-if="!isLicense && isNAS" />

    <!-- CA 专用仪表盘 -->
    <CADashboard v-if="!isLicense && isCA" />

    <!-- RA 专用首页 -->
    <div v-if="!isLicense && isRA" class="ra-dashboard">
      <el-row :gutter="16" class="ra-metrics">
        <el-col v-for="item in raMetrics" :key="item.label" :xs="12" :sm="12" :md="6">
          <div class="ra-metric">
            <div class="metric-icon" :class="item.type">
              <el-icon><component :is="item.icon" /></el-icon>
            </div>
            <div class="metric-content">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="main-content">
        <el-col :xs="24" :lg="16">
          <el-card class="box-card ra-workbench" shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon><Menu /></el-icon>
                <span>注册认证业务工作台</span>
              </div>
            </template>
            <div class="ra-flow">
              <div v-for="step in raFlowSteps" :key="step.title" class="ra-flow-step">
                <div class="flow-icon">
                  <el-icon><component :is="step.icon" /></el-icon>
                </div>
                <div class="flow-copy">
                  <b>{{ step.title }}</b>
                  <p>{{ step.desc }}</p>
                </div>
              </div>
            </div>
          </el-card>

          <el-card class="box-card ra-action-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon><Operation /></el-icon>
                <span>常用操作</span>
              </div>
            </template>
            <div class="ra-actions">
              <button v-for="action in filteredRaActions" :key="action.title" type="button" class="ra-action" @click="goTarget(action.path)">
                <el-icon><component :is="action.icon" /></el-icon>
                <span>{{ action.title }}</span>
                <small>{{ action.desc }}</small>
              </button>
            </div>
          </el-card>
        </el-col>

        <el-col :xs="24" :lg="8">
          <el-card class="box-card ra-status-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon><Connection /></el-icon>
                <span>接入状态</span>
              </div>
            </template>
            <div class="ra-status-list">
              <div v-for="item in raStatusItems" :key="item.label" class="ra-status-item">
                <div>
                  <span>{{ item.label }}</span>
                  <p>{{ item.desc }}</p>
                </div>
                <el-tag :type="item.type" effect="plain">{{ item.status }}</el-tag>
              </div>
            </div>
          </el-card>

          <el-card class="box-card ra-compliance-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon><Stamp /></el-icon>
                <span>安全边界</span>
              </div>
            </template>
            <ul class="ra-compliance-list">
              <li v-for="item in raComplianceItems" :key="item">
                <el-icon><SuccessFilled /></el-icon>
                <span>{{ item }}</span>
              </li>
            </ul>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-row v-if="!isLicense && !isNAS && !isCA && !isRA" :gutter="20" class="main-content">
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
                    <div class="feature-icon">
                      <el-icon><Key /></el-icon>
                    </div>
                    <div class="feature-content">
                      <b>密钥生成与保存</b>
                      <p>在硬件密码设备中安全生成加密密钥对，并加密存储于密钥库。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon">
                      <el-icon><Share /></el-icon>
                    </div>
                    <div class="feature-content">
                      <b>密钥分发</b>
                      <p>通过安全通道向CA中心分发密钥，确保只有最终用户能获取其私钥。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon">
                      <el-icon><CopyDocument /></el-icon>
                    </div>
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
                    <div class="feature-icon">
                      <el-icon><Refresh /></el-icon>
                    </div>
                    <div class="feature-content">
                      <b>密钥更新与撤销</b>
                      <p>支持证书到期或用户请求时的密钥更新，并安全撤销旧密钥。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon">
                      <el-icon><OfficeBuilding /></el-icon>
                    </div>
                    <div class="feature-content">
                      <b>认证中心管理</b>
                      <p>维护接入的CA机构信息，实现注册、更新、冻结、解冻等操作。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon">
                      <el-icon><Document /></el-icon>
                    </div>
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
                    <div class="feature-icon">
                      <el-icon><Key /></el-icon>
                    </div>
                    <div class="feature-content">
                      <b>证书签发</b>
                      <p>支持多种算法（RSA, SM2）的证书签发，满足不同安全需求。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon">
                      <el-icon><Share /></el-icon>
                    </div>
                    <div class="feature-content">
                      <b>证书吊销</b>
                      <p>提供证书吊销服务，并发布CRL（证书吊销列表）。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon">
                      <el-icon><CopyDocument /></el-icon>
                    </div>
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
                    <div class="feature-icon">
                      <el-icon><Refresh /></el-icon>
                    </div>
                    <div class="feature-content">
                      <b>证书更新</b>
                      <p>支持证书到期前的自动或手动更新，确保证书持续可用。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon">
                      <el-icon><OfficeBuilding /></el-icon>
                    </div>
                    <div class="feature-content">
                      <b>RA管理</b>
                      <p>管理注册机构（RA），实现证书申请的审核与批准。</p>
                    </div>
                  </li>
                  <li>
                    <div class="feature-icon">
                      <el-icon><Document /></el-icon>
                    </div>
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
    <el-card v-if="!isLicense && !isNAS && !isCA && !isRA" class="box-card update-log" shadow="hover">
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
                <div class="icon-box">
                  <el-icon><User /></el-icon>
                </div>
                <div class="info">
                  <span class="label">技术支持</span>
                  <a href="mailto:liuzhenxin@ec.com.cn">liuzhenxin@ec.com.cn</a>
                </div>
              </div>
              <div class="contact-item">
                <div class="icon-box">
                  <el-icon><Phone /></el-icon>
                </div>
                <div class="info">
                  <span class="label">联系电话</span>
                  <a href="javascript:;">010-12345678</a>
                </div>
              </div>
            </div>
          </el-col>
          <el-col v-if="!isKMC" :xs="24" :sm="24" :md="16">
            <h4 style="margin: 0 0 15px 0; font-size: 16px; color: #303133; font-weight: 600">更新日志</h4>
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
import { nextTick, onMounted, ref, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import { useUserStore } from '@/store/modules/user';
import { getTenant } from '@/api/system/tenant';
import { getKmcDashboardStats } from '@/api/kmc/dashboard';
import { readKmcPage, unwrapKmcData } from '@/api/kmc/common';
import { listLicense, listProduct } from '@/api/license/license';
import { LicenseVO, ProductVO } from '@/api/license/license/types';
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
const kmcDashboardStats = ref<any>({});
const currentTenantId = computed(() => userStore.tenantId || localStorage.getItem('tenantId'));
const isKMC = computed(() => String(currentTenantId.value) === '3');
const isNAS = computed(() => String(currentTenantId.value) === '10');
const isCA = computed(() => String(currentTenantId.value) === '4');
const isRA = computed(() => String(currentTenantId.value) === '5');
const isLicense = computed(() => String(currentTenantId.value) === '2');

const systemTitle = computed(() => {
  if (tenantInfo.value && tenantInfo.value.name) {
    return tenantInfo.value.name;
  }
  if (isKMC.value) return 'PKI-Cloud-KMC密钥管理中心';
  if (isNAS.value) return 'PKI-Cloud-NAS网络存储管理系统';
  if (isRA.value) return 'PKI-Cloud-RA注册认证中心';
  if (isLicense.value) return 'License 授权中心';
  return 'PKI-Cloud-CA证书认证系统';
});

const systemDesc = computed(() => {
  if (isLicense.value) {
    return '面向 CA、KMC、RA、ZX-TrustReader 等产品签发 License 授权文件，提供授权校验、吊销、下载和到期风险管理。';
  }
  if (isKMC.value) {
    return '为数字认证中心（CA）提供加密密钥对，并提供对这些密钥对的备份、归档、恢复、更新等全生命周期服务，以满足认证中心和司法取证的需要。';
  }
  if (isNAS.value) {
    return '提供高性能、高可靠的网络存储管理服务，支持多协议接入、数据迁移、备份恢复及容量动态扩展，确保存储资源的高效利用与安全。';
  }
  if (isRA.value) {
    return '面向证书用户注册、资料核验、证书申请审批与签发联动，承接 CA 授权模板并形成可审计的注册认证业务闭环。';
  }
  return '提供数字证书的全生命周期管理服务，包括证书申请、签发、查询、吊销、更新等，构建可信的网络安全基础环境。';
});

const licenseList = ref<LicenseVO[]>([]);
const backendLicenseProducts = ref<ProductVO[]>([]);

const defaultLicenseProducts = [
  {
    name: 'ZX-TrustReader',
    label: 'ZX-TrustReader',
    version: '4.1.2',
    icon: 'Reading',
    features: ['PDF 阅读', 'OFD 阅读', '电子签章', '签名验签', '批注能力', '安全水印']
  },
  {
    name: 'CA',
    label: 'CA 证书认证系统',
    version: '4.1.2',
    icon: 'Stamp',
    features: ['根 CA 管理', '子 CA 管理', '证书签发', '证书吊销', '证书模板', 'CRL 发布']
  },
  {
    name: 'KMC',
    label: 'KMC 密钥管理中心',
    version: '4.1.2',
    icon: 'Key',
    features: ['密钥池管理', '密钥归档', '密钥恢复', '密钥轮换', '审批流程', '审计追踪']
  },
  {
    name: 'RA',
    label: 'RA 注册认证系统',
    version: '4.1.2',
    icon: 'UserFilled',
    features: ['证书申请', '申请审核', '用户管理', '证书下载', '证书更新', '通知提醒']
  }
];

const licenseProducts = computed(() =>
  defaultLicenseProducts.map((item) => {
    const backendProduct = backendLicenseProducts.value.find((product) => product.name === item.name);
    return {
      ...item,
      version: backendProduct?.productVersion || item.version
    };
  })
);

const licenseProductCounts = computed<Record<string, number>>(() => {
  return licenseList.value.reduce((counts, item) => {
    counts[item.product] = (counts[item.product] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
});

const licenseSummary = computed(() => {
  const nowTime = Date.now();
  const warningWindow = 30 * 24 * 60 * 60 * 1000;
  const total = licenseList.value.length;
  const revoked = licenseList.value.filter((item) => item.status === 'REVOKED').length;
  const active = licenseList.value.filter((item) => item.status === 'ACTIVE' || item.status === 'ISSUED').length;
  const expiring = licenseList.value.filter((item) => {
    if (!item.notAfter || item.status === 'REVOKED') {
      return false;
    }
    const notAfterTime = new Date(item.notAfter).getTime();
    return notAfterTime >= nowTime && notAfterTime <= nowTime + warningWindow;
  }).length;
  return {
    total,
    active,
    issued: licenseList.value.filter((item) => item.status === 'ISSUED').length,
    revoked,
    expiring,
    products: Object.keys(licenseProductCounts.value).length
  };
});

const licenseMetricCards = computed(() => [
  { label: '授权总数', value: licenseSummary.value.total, icon: 'Tickets', tone: 'primary' },
  { label: '可用授权', value: licenseSummary.value.active, icon: 'CircleCheck', tone: 'success' },
  { label: '即将到期', value: licenseSummary.value.expiring, icon: 'Timer', tone: 'warning' },
  { label: '已吊销', value: licenseSummary.value.revoked, icon: 'CircleClose', tone: 'danger' }
]);

const licenseActions = [
  { title: '签发授权', desc: '选择产品与功能点生成授权文件', path: '/license/admin', icon: 'Plus' },
  { title: '校验授权', desc: '粘贴 License 内容验证有效性', path: '/license/admin', icon: 'CircleCheck' },
  { title: '下载文件', desc: '获取客户可交付 .lzxlic 文件', path: '/license/admin', icon: 'Download' },
  { title: '吊销授权', desc: '停用异常或过期授权记录', path: '/license/admin', icon: 'CircleClose' }
];

const licenseFlowSteps = [
  { title: '客户建档', desc: '录入客户名称、联系人和授权归属信息。', icon: 'User' },
  { title: '选择产品', desc: '从产品下拉中选择 CA、KMC、RA 或 ZX-TrustReader。', icon: 'Operation' },
  { title: '配置功能点', desc: '按产品自动带入不同功能点，并可调整配额与有效期。', icon: 'SetUp' },
  { title: '签发交付', desc: '生成签名 License 文件，支持下载、校验和吊销。', icon: 'Finished' }
];

const licenseRiskItems = computed(() => [
  {
    label: '30 天内到期',
    desc: '建议提前联系客户续签或调整授权有效期',
    value: licenseSummary.value.expiring,
    type: licenseSummary.value.expiring > 0 ? ('warning' as const) : ('success' as const)
  },
  {
    label: '已吊销授权',
    desc: '确认客户侧是否已停止使用对应授权文件',
    value: licenseSummary.value.revoked,
    type: licenseSummary.value.revoked > 0 ? ('danger' as const) : ('success' as const)
  },
  {
    label: '覆盖产品',
    desc: '当前授权记录涉及的产品数量',
    value: `${licenseSummary.value.products}/${licenseProducts.value.length}`,
    type: 'info' as const
  }
]);

const raMetrics = [
  { label: '待审核申请', value: '0', icon: 'DocumentChecked', type: 'warning' },
  { label: '授权模板', value: '就绪', icon: 'Collection', type: 'success' },
  { label: 'RA 身份证书', value: '有效', icon: 'Medal', type: 'primary' },
  { label: '审计状态', value: '开启', icon: 'View', type: 'info' }
];

const raFlowSteps = [
  {
    title: '用户注册受理',
    desc: '集中接收个人、机构和设备证书申请，统一校验主体资料与申请来源。',
    icon: 'User'
  },
  {
    title: '资料审核与授权',
    desc: '按业务角色完成资料核验、证书模板匹配和审批流流转。',
    icon: 'DocumentChecked'
  },
  {
    title: '联动 CA 签发',
    desc: '使用 RA 身份证书向 CA 发起签发请求，并同步根证书与授权模板。',
    icon: 'Connection'
  },
  {
    title: '证书交付与审计',
    desc: '完成证书下载、USBKey 写入、操作留痕和生命周期审计。',
    icon: 'Finished'
  }
];

const raActions = [
  { title: '证书申请', desc: '提交普通证书申请并选择授权模板', path: '/ra-certificate/ra-cert-apply', icon: 'EditPen', permission: 'ra:apply' },
  { title: '证书查询', desc: '查询申请记录、签发状态和证书详情', path: '/ra-certificate/ra-cert-list', icon: 'Search', permission: 'ra:cert' },
  { title: '待办审核', desc: '处理待审核的证书业务流程', path: '/ra-workflow/ra-workflow-todo', icon: 'Checked', permission: 'ra:workflow:todo' },
  { title: '已办记录', desc: '查看已办流程和业务流转记录', path: '/ra-workflow/ra-workflow-instance', icon: 'Tickets', permission: 'ra:workflow:instance' },
  { title: '证书续期', desc: '处理证书有效期延续业务', path: '/ra-certificate/ra-cert-renewal', icon: 'Timer', permission: 'ra:renewal' },
  { title: '证书更新', desc: '处理证书信息或密钥更新业务', path: '/ra-certificate/ra-cert-update', icon: 'Refresh', permission: 'ra:update' },
  { title: '证书吊销', desc: '处理证书吊销申请和状态变更', path: '/ra-certificate/ra-cert-revoke', icon: 'Lock', permission: 'ra:revoke' },
  { title: '证书补办', desc: '提交证书遗失、损坏等补办申请', path: '/ra-certificate/ra-cert-reissue', icon: 'Key', permission: 'ra:reissue' },
  { title: '证书冻结', desc: '对证书进行临时停用控制', path: '/ra-certificate/ra-cert-freeze', icon: 'Lock', permission: 'ra:freeze' },
  { title: '证书解冻', desc: '恢复已冻结证书的使用状态', path: '/ra-certificate/ra-cert-unfreeze', icon: 'Unlock', permission: 'ra:unfreeze' },
  { title: '证书统计', desc: '查看证书申请、签发和生命周期数据', path: '/ra-statistics/ra-cert-stat', icon: 'DataAnalysis', permission: 'ra:stat:cert' },
  { title: '用户统计', desc: '查看普通证书用户统计数据', path: '/ra-statistics/ra-user-stat', icon: 'User', permission: 'ra:stat:user' },
  { title: '趋势分析', desc: '查看证书业务趋势和变化情况', path: '/ra-statistics/ra-trend', icon: 'TrendCharts', permission: 'ra:stat:trend' },
  { title: '业务管理员', desc: '维护 RA 业务经办与审核账号', path: '/ra-admin/ra-admin-operator', icon: 'Avatar', permission: 'ra:admin' },
  { title: '根证书授权', desc: '查看 CA 同步的根证书与模板', path: '/ra-admin/ra-admin-ca/ra-root-cert', icon: 'Key', permission: 'ra:root' },
  { title: '系统配置', desc: '维护 RA 运行参数与业务开关', path: '/ra-system/ra-system-config', icon: 'SetUp', permission: 'ra:config' }
];

const hasPermission = (permission: string) => {
  const permissions = userStore.permissions || [];
  return permissions.includes('*:*:*') || permissions.includes(permission);
};
const filteredRaActions = computed(() => raActions.filter((action) => hasPermission(action.permission)));

const raStatusItems = [
  { label: 'CA 授权关系', desc: '根证书与证书模板由 CA 授权同步', status: '已接入', type: 'success' as const },
  { label: '证书申请流程', desc: '注册、审核、签发、交付分阶段留痕', status: '启用', type: 'success' as const },
  { label: 'USBKey 写入', desc: '管理员和审计员证书支持本地介质写入', status: '可用', type: 'info' as const },
  { label: '审计留痕', desc: '关键操作进入统一审计日志', status: '开启', type: 'warning' as const }
];

const raComplianceItems = ['RA 不保存 CA 私钥，只承接授权签发能力', '管理员与审计员职责分离，关键操作可追溯', '支持国密算法证书申请与 USBKey 交付', '根证书、模板、申请记录按租户隔离'];

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

const fetchLicenseHomeData = async () => {
  if (!isLicense.value) {
    return;
  }
  try {
    const [licenseRes, productRes] = await Promise.all([
      listLicense({ pageNum: 1, pageSize: 100 }, true),
      listProduct({ pageNum: 1, pageSize: 100 }, true)
    ]);
    licenseList.value = readKmcPage<LicenseVO>(licenseRes).records;
    backendLicenseProducts.value = readKmcPage<ProductVO>(productRes).records;
  } catch {
    licenseList.value = [];
    backendLicenseProducts.value = [];
  }
};

const goTarget = (url: string) => {
  if (url.startsWith('http')) {
    window.open(url, '__blank');
  } else {
    router.push(url);
  }
};

const keyDistributionLabels = computed(() => {
  const labels = new Set<string>();
  [reserveKeyDistribution.value, usedKeyDistribution.value, archiveKeyDistribution.value].forEach((distribution) => {
    Object.keys(distribution).forEach((key) => labels.add(key));
  });
  return Array.from(labels).sort();
});

const reserveKeyDistribution = computed<Record<string, number>>(() => normalizeDistribution(kmcDashboardStats.value.reserveKeyDistribution ?? kmcDashboardStats.value.keyDistribution));
const usedKeyDistribution = computed<Record<string, number>>(() => normalizeDistribution(kmcDashboardStats.value.usedKeyDistribution));
const archiveKeyDistribution = computed<Record<string, number>>(() => normalizeDistribution(kmcDashboardStats.value.archiveKeyDistribution));

const normalizeDistribution = (value: Record<string, unknown> | undefined) => {
  if (!value) {
    return {};
  }
  return Object.fromEntries(Object.entries(value).map(([key, count]) => [key, Number(count || 0)]));
};

const createChartOption = (distribution: Record<string, number>) => {
  const labels = keyDistributionLabels.value.length > 0 ? keyDistributionLabels.value : ['暂无数据'];
  const values = labels.map((label) => distribution[label] ?? 0);
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
      data: labels,
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
        data: values.map((value, index) => ({
          value,
          itemStyle: { color: ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399'][index % 5] }
        })),
        label: {
          show: true,
          position: 'top'
        }
      }
    ]
  };
};

const fetchKmcDashboardStats = async () => {
  if (!isKMC.value) {
    return;
  }
  try {
    kmcDashboardStats.value = unwrapKmcData(await getKmcDashboardStats()) ?? {};
  } catch (error) {
    console.error('获取KMC首页统计失败:', error);
    kmcDashboardStats.value = {};
  }
};

const initCharts = () => {
  if (isKMC.value) {
    if (backupKeyChartRef.value) {
      backupKeyChart = backupKeyChart ?? echarts.init(backupKeyChartRef.value);
      backupKeyChart.setOption(createChartOption(reserveKeyDistribution.value));
    }

    if (activeKeyChartRef.value) {
      activeKeyChart = activeKeyChart ?? echarts.init(activeKeyChartRef.value);
      activeKeyChart.setOption(createChartOption(usedKeyDistribution.value));
    }

    if (historyKeyChartRef.value) {
      historyKeyChart = historyKeyChart ?? echarts.init(historyKeyChartRef.value);
      historyKeyChart.setOption(createChartOption(archiveKeyDistribution.value));
    }
  }
};

onMounted(async () => {
  fetchTenantInfo();
  await fetchLicenseHomeData();
  if (isKMC.value && userStore.permissions.includes('kmc:dashboard:view')) {
    await fetchKmcDashboardStats();
    await nextTick();
    initCharts();
  }
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

  .license-dashboard {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .license-hero {
    min-height: 220px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 16px;
    padding: 24px;
    border: 1px solid #d9e2ec;
    border-radius: 8px;
    background: linear-gradient(135deg, #ffffff 0%, #eef6ff 56%, #f7fbf5 100%);
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
  }

  .license-hero-main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;

    .license-kicker {
      width: fit-content;
      margin-bottom: 10px;
      padding: 4px 10px;
      border-radius: 4px;
      color: #0f766e;
      background: #ccfbf1;
      font-size: 13px;
      font-weight: 600;
    }

    h1 {
      margin: 0;
      color: #172033;
      font-size: 28px;
      line-height: 1.3;
      font-weight: 700;
    }

    p {
      max-width: 760px;
      margin: 12px 0 0;
      color: #4b5563;
      font-size: 14px;
      line-height: 1.8;
    }
  }

  .license-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 20px;
  }

  .license-hero-side {
    min-height: 172px;
    padding: 18px;
    border: 1px solid #dbeafe;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.82);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .license-status-row,
  .license-service-grid,
  .license-product-title,
  .license-panel-header,
  .license-risk-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .license-status-row {
    span {
      color: #475569;
      font-size: 13px;
      font-weight: 600;
    }
  }

  .license-service-score {
    strong {
      display: block;
      color: #0f172a;
      font-size: 42px;
      line-height: 1;
      font-weight: 700;
    }

    span {
      display: block;
      margin-top: 8px;
      color: #64748b;
      font-size: 13px;
    }
  }

  .license-service-grid {
    div {
      flex: 1;
      padding: 12px;
      border-radius: 6px;
      background: #f8fafc;

      span {
        display: block;
        color: #64748b;
        font-size: 12px;
      }

      b {
        display: block;
        margin-top: 6px;
        color: #1f2937;
        font-size: 18px;
      }
    }
  }

  .license-metrics {
    .el-col {
      margin-bottom: 0;
    }
  }

  .license-metric-card {
    min-height: 96px;
    padding: 18px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);

    .license-metric-icon {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      font-size: 22px;
      flex-shrink: 0;
    }

    &.primary .license-metric-icon {
      color: #1d4ed8;
      background: #eff6ff;
    }

    &.success .license-metric-icon {
      color: #15803d;
      background: #f0fdf4;
    }

    &.warning .license-metric-icon {
      color: #b45309;
      background: #fffbeb;
    }

    &.danger .license-metric-icon {
      color: #b91c1c;
      background: #fef2f2;
    }
  }

  .license-metric-copy {
    min-width: 0;

    span {
      display: block;
      color: #64748b;
      font-size: 13px;
    }

    strong {
      display: block;
      margin-top: 6px;
      color: #111827;
      font-size: 24px;
      line-height: 1.1;
    }
  }

  .license-main-grid {
    row-gap: 16px;
  }

  .license-panel {
    margin-bottom: 16px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);

    :deep(.el-card__header) {
      padding: 16px 18px;
      border-bottom-color: #eef2f7;
    }

    :deep(.el-card__body) {
      padding: 18px;
    }
  }

  .license-panel-header {
    h2 {
      margin: 0;
      color: #1f2937;
      font-size: 16px;
      line-height: 1.4;
    }

    span {
      display: block;
      margin-top: 4px;
      color: #909399;
      font-size: 12px;
      line-height: 1.5;
    }
  }

  .license-product-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .license-product-item {
    min-height: 166px;
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;

    &:hover {
      border-color: #93c5fd;
      box-shadow: 0 8px 22px rgba(37, 99, 235, 0.12);
      transform: translateY(-1px);
    }
  }

  .license-product-title {
    align-items: flex-start;

    .el-icon {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      color: #1d4ed8;
      background: #eff6ff;
      font-size: 20px;
      flex-shrink: 0;
    }

    b {
      display: block;
      color: #111827;
      font-size: 15px;
      line-height: 1.4;
    }

    span {
      display: block;
      margin-top: 4px;
      color: #94a3b8;
      font-size: 12px;
    }
  }

  .license-product-count {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 16px 0 12px;

    strong {
      color: #172033;
      font-size: 28px;
      line-height: 1;
    }

    span {
      color: #64748b;
      font-size: 12px;
    }
  }

  .license-feature-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .license-workflow-panel {
    margin-bottom: 0;
  }

  .license-flow {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .license-flow-step {
    min-height: 148px;
    padding: 14px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fbfdff;
  }

  .license-flow-icon {
    width: 36px;
    height: 36px;
    margin-bottom: 12px;
    border-radius: 8px;
    color: #0f766e;
    background: #ccfbf1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .license-flow-step {
    b {
      display: block;
      color: #1f2937;
      font-size: 14px;
    }

    p {
      margin: 8px 0 0;
      color: #64748b;
      font-size: 12px;
      line-height: 1.7;
    }
  }

  .license-action-panel {
    .license-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    button {
      min-height: 118px;
      padding: 14px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #fff;
      color: #303133;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-align: center;
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;

      .el-icon {
        color: #1d4ed8;
        font-size: 24px;
      }

      span {
        color: #1f2937;
        font-size: 14px;
        font-weight: 600;
      }

      small {
        color: #909399;
        font-size: 12px;
        line-height: 1.5;
      }

      &:hover {
        border-color: #93c5fd;
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.12);
        transform: translateY(-1px);
      }
    }
  }

  .license-risk-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .license-risk-item {
    align-items: flex-start;
    padding-bottom: 14px;
    border-bottom: 1px dashed #e5e7eb;

    &:last-child {
      padding-bottom: 0;
      border-bottom: none;
    }

    span {
      display: block;
      margin-bottom: 4px;
      color: #1f2937;
      font-size: 14px;
      font-weight: 600;
    }

    p {
      margin: 0;
      color: #909399;
      font-size: 12px;
      line-height: 1.6;
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

  .ra-dashboard {
    .ra-metrics {
      margin-bottom: 20px;
    }

    .ra-metric {
      min-height: 92px;
      padding: 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      background: #fff;
      border: 1px solid #e4e7ed;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(0, 21, 41, 0.06);

      .metric-icon {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        font-size: 22px;
        flex-shrink: 0;

        &.primary {
          color: #1d4ed8;
          background: #eff6ff;
        }

        &.success {
          color: #15803d;
          background: #f0fdf4;
        }

        &.warning {
          color: #b45309;
          background: #fffbeb;
        }

        &.info {
          color: #475569;
          background: #f1f5f9;
        }
      }

      .metric-content {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;

        span {
          color: #606266;
          font-size: 13px;
        }

        strong {
          color: #1f2937;
          font-size: 24px;
          line-height: 1.1;
        }
      }
    }

    .ra-workbench {
      .ra-flow {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .ra-flow-step {
        min-height: 118px;
        padding: 18px;
        display: flex;
        gap: 14px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #fbfdff;

        .flow-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #2563eb;
          background: #eff6ff;
          font-size: 20px;
          flex-shrink: 0;
        }

        .flow-copy {
          min-width: 0;

          b {
            display: block;
            margin-bottom: 8px;
            color: #1f2937;
            font-size: 15px;
          }

          p {
            margin: 0;
            color: #606266;
            font-size: 13px;
            line-height: 1.7;
          }
        }
      }
    }

    .ra-action-card {
      .ra-actions {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .ra-action {
        min-height: 104px;
        padding: 16px 12px;
        border: 1px solid #dcdfe6;
        border-radius: 8px;
        background: #fff;
        color: #303133;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;

        .el-icon {
          color: #2563eb;
          font-size: 24px;
        }

        span {
          font-size: 14px;
          font-weight: 600;
        }

        small {
          max-width: 100%;
          color: #909399;
          font-size: 12px;
          line-height: 1.4;
          text-align: center;
        }

        &:hover {
          border-color: #93c5fd;
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.12);
          transform: translateY(-1px);
        }
      }
    }

    .ra-status-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .ra-status-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 14px;
      border-bottom: 1px dashed #e5e7eb;

      &:last-child {
        padding-bottom: 0;
        border-bottom: none;
      }

      span {
        display: block;
        margin-bottom: 4px;
        color: #1f2937;
        font-size: 14px;
        font-weight: 600;
      }

      p {
        margin: 0;
        color: #909399;
        font-size: 12px;
        line-height: 1.5;
      }
    }

    .ra-compliance-list {
      list-style: none;
      padding: 0;
      margin: 0;

      li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 0;
        color: #606266;
        font-size: 13px;
        line-height: 1.6;
        border-bottom: 1px dashed #ebeef5;

        &:last-child {
          border-bottom: none;
        }

        .el-icon {
          margin-top: 3px;
          color: #16a34a;
          flex-shrink: 0;
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

  @media (max-width: 992px) {
    .license-hero {
      grid-template-columns: 1fr;
    }

    .license-product-list,
    .license-flow {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ra-dashboard {
      .ra-workbench .ra-flow,
      .ra-action-card .ra-actions {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  }

  @media (max-width: 640px) {
    padding: 12px;

    .header-card .header {
      align-items: flex-start;

      .icon-wrapper {
        margin-right: 14px;
      }

      .header-title h2 {
        font-size: 22px;
      }
    }

    .license-hero {
      padding: 18px;
    }

    .license-hero-main {
      h1 {
        font-size: 22px;
      }
    }

    .license-product-list,
    .license-flow,
    .license-action-panel .license-actions {
      grid-template-columns: 1fr;
    }

    .license-service-grid,
    .license-panel-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .ra-dashboard {
      .ra-workbench .ra-flow,
      .ra-action-card .ra-actions {
        grid-template-columns: 1fr;
      }

      .ra-metric {
        min-height: 84px;
        padding: 14px;

        .metric-content strong {
          font-size: 20px;
        }
      }
    }
  }
}
</style>
