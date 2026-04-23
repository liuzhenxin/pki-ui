<template>
  <div class="p-2">
    <!-- 安全概览看板 -->
    <el-row :gutter="20" class="mb-4">
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <template #header
            ><div class="card-header"><span class="title">敏感操作</span><el-tag type="danger" effect="dark" round>高风险</el-tag></div></template
          >
          <div class="card-body">
            <div class="value">{{ stats.sensitiveOps }}</div>
            <div class="desc">累计执行</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <template #header
            ><div class="card-header"><span class="title">吊销请求</span><el-tag type="warning" effect="dark" round>待处理</el-tag></div></template
          >
          <div class="card-body">
            <div class="value">{{ stats.revokeRequests }}</div>
            <div class="desc">待审核</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="status-card">
          <template #header
            ><div class="card-header"><span class="title">异常登录</span><el-tag type="info" effect="dark" round>告警</el-tag></div></template
          >
          <div class="card-body">
            <div class="value">{{ stats.alerts }}</div>
            <div class="desc">近24小时</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="status-card health">
          <template #header
            ><div class="card-header"><span class="title">系统健康度</span><el-tag type="success" effect="dark" round>正常</el-tag></div></template
          >
          <div class="card-body">
            <div class="value">{{ stats.healthScore }}</div>
            <div class="desc">安全评分</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-tabs type="border-card">
      <el-tab-pane label="审计员管理">
        <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
          <div v-show="showSearch" class="mb-10px">
            <el-form ref="queryFormRef" :model="queryParams" :inline="true">
              <el-form-item label="用户名称" prop="username">
                <el-input v-model="queryParams.username" placeholder="请输入用户名称" clearable @keyup.enter="handleQuery" />
              </el-form-item>
              <el-form-item label="手机号码" prop="mobile">
                <el-input v-model="queryParams.mobile" placeholder="请输入手机号码" clearable @keyup.enter="handleQuery" />
              </el-form-item>
              <el-form-item label="状态" prop="status">
                <el-select v-model="queryParams.status" placeholder="用户状态" clearable>
                  <el-option label="正常" value="0" />
                  <el-option label="停用" value="1" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
                <el-button icon="Refresh" @click="resetQuery">重置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </transition>

        <el-row :gutter="10" class="mb-4">
          <el-col :span="1.5">
            <el-button type="primary" plain icon="Plus" @click="handleAdd">新增审计员</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>

        <el-table v-loading="loading" border :data="userList" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="50" align="center" />
          <el-table-column label="用户名称" align="center" prop="username" :show-overflow-tooltip="true" />
          <el-table-column label="手机号码" align="center" prop="mobile" width="120" />
          <el-table-column label="邮箱" align="center" prop="mail" width="200" :show-overflow-tooltip="true" />
          <el-table-column label="状态" align="center" width="80">
            <template #default="scope">
              <el-switch
                v-model="scope.row.status"
                :active-value="0"
                :inactive-value="1"
                active-color="#13ce66"
                inactive-color="#ff4949"
                @change="(val) => handleStatusChange(scope.row, val)"
              />
            </template>
          </el-table-column>
          <el-table-column label="证书状态" align="center" prop="certSn" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.certSn ? 'success' : 'info'">{{ scope.row.certSn ? '已签发' : '未签发' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" fixed="right" width="240" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)">修改</el-button>
              <el-button v-if="!scope.row.certSn" link type="success" icon="Document" @click="handleIssueCert(scope.row)">签发证书</el-button>
              <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)">删除</el-button>
              <el-button link type="primary" icon="Key" @click="handleResetPwd(scope.row)">重置密码</el-button>
            </template>
          </el-table-column>
        </el-table>
        <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
      </el-tab-pane>
      <el-tab-pane label="实时审计日志">
        <el-form :model="logQueryParams" :inline="true" class="mb-2">
          <el-form-item label="操作模块">
            <el-input v-model="logQueryParams.moduleName" placeholder="请输入模块名" clearable @keyup.enter="handleLogQuery" />
          </el-form-item>
          <el-form-item label="操作人员">
            <el-input v-model="logQueryParams.operator" placeholder="请输入人员" clearable @keyup.enter="handleLogQuery" />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="logQueryParams.status" placeholder="操作状态" clearable style="width: 120px">
              <el-option label="成功" :value="0" />
              <el-option label="失败" :value="1" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleLogQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetLogQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="logLoading" :data="logList" border stripe>
          <el-table-column label="操作时间" align="center" prop="createTime" width="180" />
          <el-table-column label="模块名称" align="center" prop="moduleName" width="120" />
          <el-table-column label="操作方法" align="center" prop="methodName" :show-overflow-tooltip="true" min-width="180" />
          <el-table-column label="操作人员" align="center" prop="operator" width="100" />
          <el-table-column label="IP地址" align="center" prop="ip" width="130" />
          <el-table-column label="状态" align="center" width="80">
            <template #default="scope">
              <el-tag :type="scope.row.status === 0 ? 'success' : 'danger'">{{ scope.row.status === 0 ? '成功' : '失败' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="耗时" align="center" width="90">
            <template #default="scope">
              <span>{{ scope.row.costTime }}ms</span>
            </template>
          </el-table-column>
        </el-table>

        <pagination
          v-show="logTotal > 0"
          v-model:page="logQueryParams.pageNum"
          v-model:limit="logQueryParams.pageSize"
          :total="logTotal"
          @pagination="getLogList"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 安全确认对话框 -->
    <SecurityConfirm
      v-model="securityConfirm.visible"
      :title="securityConfirm.title"
      :action="securityConfirm.action"
      @confirm="securityConfirm.onConfirm"
    />

    <!-- 添加或修改业务管理员对话框 -->
    <el-dialog ref="formDialogRef" v-model="dialog.visible" :title="dialog.title" width="600px" append-to-body @close="closeDialog">
      <el-form ref="userFormRef" :model="form" :rules="rules" label-width="80px">
        <el-row>
          <el-col :span="24" style="display: none">
            <el-form-item label="归属部门" prop="deptId">
              <el-input v-model="deptName" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="手机号码" prop="mobile">
              <el-input v-model="form.mobile" placeholder="请输入手机号码" maxlength="11" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="mail">
              <el-input v-model="form.mail" placeholder="请输入邮箱" maxlength="50" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="用户名称" prop="username">
              <el-input v-model="form.username" placeholder="请输入用户名称" maxlength="30" :disabled="form.userId != undefined" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item v-if="form.userId == undefined" label="用户密码" prop="password">
              <el-input v-model="form.password" placeholder="请输入用户密码" type="password" maxlength="20" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio :value="0">正常</el-radio>
                <el-radio :value="1">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="角色" prop="roleIds">
              <el-select v-model="form.roleIds" multiple placeholder="请选择" disabled style="width: 100%">
                <el-option label="审计员" value="404" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" placeholder="请输入内容" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 签发证书对话框 -->
    <el-dialog v-model="certDialog.visible" title="签发证书" width="600px" append-to-body @close="closeCertDialog">
      <el-form ref="certFormRef" :model="certForm" :rules="certRules" label-width="120px">
        <el-form-item label="用户名">
          <el-input v-model="certForm.username" disabled />
        </el-form-item>
        <el-form-item label="手机号码">
          <el-input v-model="certForm.mobile" disabled />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="certForm.mail" disabled />
        </el-form-item>
        <div style="margin-top: 20px; border-top: 1px dashed #eee; padding-top: 20px; margin-bottom: 20px">
          <h4 style="margin-top: 0; color: #606266; font-size: 14px">证书主题信息</h4>
          <CertSubject v-model="certForm.subjectItems" propPrefix="subjectItems" />
        </div>
        <div style="margin-top: 20px; border-top: 1px dashed #eee; padding-top: 20px; margin-bottom: 20px">
          <h4 style="margin-top: 0; color: #606266; font-size: 14px">USBKey 证书设置</h4>
          <el-form-item label="设备提供商" prop="provider">
            <div class="flex-row" style="display: flex; gap: 10px; width: 100%">
              <el-select v-model="certForm.provider" placeholder="请选择或刷新" style="flex: 1" @change="onCertProviderChange">
                <el-option v-for="p in certProviders" :key="p" :label="p" :value="p" />
              </el-select>
              <el-button @click="refreshCertProviders" :icon="Refresh" circle />
            </div>
          </el-form-item>
          <el-form-item label="设备列表" prop="device">
            <el-select v-model="certForm.device" placeholder="请选择设备" style="width: 100%" @change="onCertDeviceChange">
              <el-option v-for="d in certDevices" :key="d" :label="d" :value="d" />
            </el-select>
          </el-form-item>
          <el-form-item label="应用" prop="appName">
            <el-select v-model="certForm.appName" placeholder="请选择应用" style="width: 100%" @change="onCertAppChange">
              <el-option v-for="a in certApps" :key="a" :label="a" :value="a" />
            </el-select>
          </el-form-item>
          <el-form-item label="容器名" prop="containerName">
            <el-input v-model="certForm.containerName" placeholder="建议使用用户名作为容器名" />
          </el-form-item>
          <el-form-item label="User PIN" prop="pin">
            <el-input v-model="certForm.pin" type="password" show-password placeholder="请输入 USBKey User PIN" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="certDialog.loading" @click="submitCertForm">签发证书</el-button>
          <el-button @click="closeCertDialog">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="BusinessAdmin" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Refresh, Search, Plus, Edit, Delete, Key, Document, Lock, Bell, Warning, SuccessFilled, InfoFilled } from '@element-plus/icons-vue';
import { to } from 'await-to-js';
import { listUser, getUser, addUser, updateUser, delUser, resetUserPwd, changeStatus } from '@/api/system/user';
import { list as listOperLog } from '@/api/system/operlog';
import { issueAdminCert } from '@/api/ca/root';
import { getProfileByName } from '@/api/ca/profile';
import { parseJson } from '@/utils/json';
import { UserForm, UserQuery } from '@/api/system/user/types';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';
import SecurityConfirm from '@/components/SecurityConfirm/index.vue';
import SKFClient from '@/api/skf/skf_api';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const securityConfirm = reactive({
  visible: false,
  title: '敏感操作安全确认',
  action: '',
  onConfirm: () => {}
});

const userList = ref<any[]>([]);
const loading = ref(true);
const showSearch = ref(true);

// 日志相关状态
const logList = ref<any[]>([]);
const logTotal = ref(0);
const logLoading = ref(false);
const logQueryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  moduleName: undefined,
  operator: undefined,
  status: undefined
});

// 统计数据状态
const stats = reactive({
  sensitiveOps: 0,
  revokeRequests: 0,
  alerts: 0,
  healthScore: '99%'
});
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const deptName = ref('业务部门 (ID: 401)');
const isDataLoaded = ref(false);

const queryFormRef = ref<FormInstance>();
const userFormRef = ref<FormInstance>();
const formDialogRef = ref<any>();

const dialog = reactive({
  visible: false,
  title: ''
});

const certDialog = reactive({
  visible: false,
  loading: false
});

const certFormRef = ref<FormInstance>();
const skfClient = ref<SKFClient | null>(null);
const certProviders = ref<string[]>([]);
const certDevices = ref<string[]>([]);
const certApps = ref<string[]>([]);

const certForm = reactive({
  userId: '',
  username: '',
  mobile: '',
  mail: '',
  provider: '',
  device: '',
  appName: '',
  containerName: '',
  pin: '',
  subjectItems: [] as any[]
});

const certRules: FormRules = {
  provider: [{ required: true, message: '请选择设备提供商', trigger: 'change' }],
  device: [{ required: true, message: '请选择设备', trigger: 'change' }],
  appName: [{ required: true, message: '请选择应用', trigger: 'change' }],
  containerName: [{ required: true, message: '请输入容器名', trigger: 'blur' }],
  pin: [{ required: true, message: '请输入User PIN', trigger: 'blur' }]
};

const initFormData: UserForm = {
  userId: undefined,
  deptId: 401,
  username: '',
  password: '',
  mobile: undefined,
  mail: undefined,
  status: 0,
  remark: '',
  roleIds: ['404']
};

const data = reactive({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    username: '',
    mobile: '',
    status: '',
    roleId: '404'
  },
  rules: {
    username: [
      { required: true, message: '用户名称不能为空', trigger: 'blur' },
      { min: 2, max: 20, message: '用户名称长度必须介于 2 和 20 之间', trigger: 'blur' }
    ],
    password: [
      { required: true, message: '用户密码不能为空', trigger: 'blur' },
      { min: 5, max: 20, message: '用户密码长度必须介于 5 和 20 之间', trigger: 'blur' },
      { pattern: /^[^<>"'|\\]+$/, message: '不能包含非法字符：< > " \' \\ |', trigger: 'blur' }
    ],
    mail: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: ['blur', 'change'] }],
    mobile: [
      {
        pattern: /^1[3456789][0-9]\d{8}$/,
        message: '请输入正确的手机号码',
        trigger: 'blur'
      }
    ],
    roleIds: [{ required: true, message: '用户角色不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询列表 */
async function getList() {
  loading.value = true;
  isDataLoaded.value = false;
  try {
    const res = await listUser(queryParams.value);
    // 先清空列表，避免el-switch触发change事件
    userList.value = [];
    total.value = res.data.total || 0;
    // 使用nextTick确保DOM更新完成后再设置数据
    await nextTick();
    userList.value = res.data.rows || res.data.records || [];
    // 延迟设置数据加载完成标志，确保数据完全渲染
    setTimeout(() => {
      isDataLoaded.value = true;
    }, 200);
  } catch (error) {
    console.error('获取列表失败', error);
  } finally {
    loading.value = false;
  }
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

/** 多选框选中数据 */
function handleSelectionChange(selection: any[]) {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

/** 用户状态修改 */
async function handleStatusChange(row: any, newStatus: number) {
  // 如果数据还在加载中，不处理状态变更
  if (!isDataLoaded.value) {
    return;
  }

  // 根据新状态确定操作文本：0->1是停用，1->0是启用
  const text = newStatus === 0 ? '启用' : '停用';

  try {
    await proxy?.$modal.confirm('确认要"' + text + '""' + row.username + '"用户吗?');
    await changeStatus(row.id, newStatus);
    proxy?.$modal.msgSuccess(text + '成功');
  } catch (err) {
    // 用户取消，恢复到相反状态
    row.status = newStatus === 0 ? 1 : 0;
  }
}

/** 新增按钮操作 */
function handleAdd() {
  reset();
  dialog.visible = true;
  dialog.title = '添加业务管理员';
  form.value.password = '';
  form.value.deptId = 401;
  form.value.roleIds = ['404'];
}

/** 修改按钮操作 */
async function handleUpdate(row?: any) {
  reset();
  const userId = row?.id || ids.value[0];
  try {
    const { data } = await getUser(userId);
    dialog.visible = true;
    dialog.title = '修改业务管理员';
    Object.assign(form.value, data);
    // 确保正确设置userId字段
    if (data.id) {
      form.value.userId = data.id;
    }
    // 移除不需要的字段
    delete form.value.nickName;
    delete form.value.sex;
    form.value.roleIds = ['404'];
    form.value.deptId = 401;
    form.value.password = '';
  } catch (error) {
    ElMessage.error('获取用户信息失败');
  }
}

/** 提交按钮 */
async function submitForm() {
  userFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      // 强制设置部门ID为401
      form.value.deptId = 401;
      // 强制设置角色ID为403
      form.value.roleIds = ['404'];

      try {
        if (form.value.userId) {
          await updateUser(form.value);
        } else {
          await addUser(form.value);
        }
        proxy?.$modal.msgSuccess('操作成功');
        dialog.visible = false;
        await getList();
      } catch (error) {
        console.error('操作失败', error);
      }
    }
  });
}

/** 删除按钮操作 */
async function handleDelete(row?: any) {
  const userIds = row?.id || ids.value;
  const username = row?.username || '选中的用户';

  securityConfirm.action = `删除审计员 "${username}" (ID: ${userIds})`;
  securityConfirm.onConfirm = async () => {
    try {
      await delUser(userIds);
      await getList();
      proxy?.$modal.msgSuccess('删除成功');
    } catch (error) {
      console.error('删除失败', error);
    }
  };
  securityConfirm.visible = true;
}

/** 重置密码按钮操作 */
async function handleResetPwd(row: any) {
  const [err, res] = await to(
    ElMessageBox.prompt('请输入"' + row.username + '"的新密码', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      closeOnClickModal: false,
      inputPattern: /^.{5,20}$/,
      inputErrorMessage: '用户密码长度必须介于 5 和 20 之间',
      inputValidator: (value) => {
        if (/<|>|"|'|\||\\/.test(value)) {
          return '不能包含非法字符：< > " \' \\ |';
        }
      }
    })
  );

  if (!err && res) {
    securityConfirm.action = `重置用户 "${row.username}" 的密码`;
    securityConfirm.onConfirm = async () => {
      try {
        await resetUserPwd(row.id, res.value);
        proxy?.$modal.msgSuccess('修改成功，新密码是：' + res.value);
      } catch (error) {
        console.error('重置密码失败', error);
      }
    };
    securityConfirm.visible = true;
  }
}

/** 签发证书按钮操作 */
async function handleIssueCert(row: any) {
  try {
    certForm.userId = row.id;
    certForm.username = row.username;
    certForm.mobile = row.mobile || '';
    certForm.mail = row.mail || '';
    certForm.provider = '';
    certForm.device = '';
    certForm.appName = '';
    certForm.containerName = row.username;
    certForm.pin = '';

    // 获取"通用证书模板"配置
    ElMessage.info('正在加载证书模板...');
    const profileRes = await getProfileByName('通用证书模板');
    const profile = profileRes.data;
    const conf = parseJson(profile.conf);

    // 根据模板配置和用户信息填充主题字段
    if (conf && conf.subject) {
      const items: any[] = [];
      const defaultValues: any = {
        country: 'CN',
        commonName: row.username,
        organization: '业务部门',
        organizationalUnit: '审计员',
        emailAddress: row.mail || ''
      };

      conf.subject.forEach((rdn: any) => {
        let compType = rdn.type.toLowerCase();
        for (const [type, meta] of Object.entries(typeMapping)) {
          if (meta.key.toLowerCase() === rdn.type.toLowerCase() || type.toLowerCase() === rdn.type.toLowerCase()) {
            compType = type;
            break;
          }
        }
        let val = rdn.value || '';
        if (!val && defaultValues[compType]) {
          val = defaultValues[compType];
        }

        const count = Math.max(1, rdn.minOccurs || 0);
        for (let i = 0; i < count; i++) {
          items.push({
            type: compType,
            value: val,
            minOccurs: rdn.minOccurs,
            maxOccurs: rdn.maxOccurs
          });
        }
      });
      certForm.subjectItems = sortSubjectItems(items);
    } else {
      // 如果没有模板配置，使用默认值
      certForm.subjectItems = sortSubjectItems([
        { type: 'country', value: 'CN' },
        { type: 'commonName', value: row.username },
        { type: 'organization', value: '业务部门' },
        { type: 'organizationalUnit', value: '审计员' },
        { type: 'emailAddress', value: row.mail || '' }
      ]);
    }

    certDialog.visible = true;
    await refreshCertProviders();
  } catch (error: any) {
    ElMessage.error('加载证书模板失败: ' + (error.message || error));
  }
}

/** 获取SKF客户端 */
async function getSkfClient(): Promise<SKFClient> {
  if (skfClient.value && skfClient.value.isConnected()) {
    return skfClient.value;
  }
  skfClient.value = new SKFClient('ws://127.0.0.1:9001');
  await skfClient.value.connect();
  return skfClient.value;
}

/** 刷新设备提供商 */
async function refreshCertProviders() {
  try {
    const skf = await getSkfClient();
    const providers = await skf.enumProvider();
    certProviders.value = providers;
    if (providers.length > 0) {
      certForm.provider = providers[0];
      await onCertProviderChange();
    } else {
      certForm.provider = '';
      certDevices.value = [];
      certForm.device = '';
    }
  } catch (e: any) {
    ElMessage.error('SKF 服务连接失败: ' + (e.message || e));
  }
}

/** 设备提供商变更 */
async function onCertProviderChange() {
  if (!certForm.provider) return;
  try {
    const skf = await getSkfClient();
    const devices = await skf.enumDevice(certForm.provider);
    certDevices.value = devices;
    if (devices.length > 0) {
      certForm.device = devices[0];
      await onCertDeviceChange();
    } else {
      certForm.device = '';
      certApps.value = [];
      certForm.appName = '';
    }
  } catch (e: any) {
    ElMessage.error('获取设备列表失败: ' + (e.message || e));
  }
}

/** 设备变更 */
async function onCertDeviceChange() {
  if (!certForm.provider || !certForm.device) return;
  try {
    const skf = await getSkfClient();
    const apps = await skf.enumApplication(certForm.provider, certForm.device);
    certApps.value = apps;
    if (apps.length > 0) {
      certForm.appName = apps[0];
    } else {
      certForm.appName = '';
    }
  } catch (e: any) {
    ElMessage.error('获取应用列表失败: ' + (e.message || e));
  }
}

/** 应用变更 */
function onCertAppChange() {
  // 应用变更时的处理
}

/** 提交签发证书表单 */
async function submitCertForm() {
  certFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      try {
        certDialog.loading = true;
        const skf = await getSkfClient();

        // 构建主题信息
        const subject = certForm.subjectItems
          .filter((item: any) => item.value)
          .map((item: any) => {
            const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
            return `${key}=${item.value}`;
          })
          .join(',');

        // 1. 验证PIN并创建CSR
        ElMessage.info('正在验证 PIN...');
        await skf.checkPIN(`${certForm.provider}/${certForm.device}/${certForm.appName}`, certForm.pin);

        ElMessage.info('正在从 USBKey 生成 CSR...');
        const csrRes = await skf.createPKCS10(certForm.provider, certForm.device, certForm.appName, subject, 'SM2', 256, certForm.containerName);

        // 2. 调用后端API签发证书
        ElMessage.info('正在请求后端签发证书...');
        const issueRes = await issueAdminCert({
          userId: certForm.userId,
          username: certForm.username,
          csrPem: csrRes.pem
        });

        if (!issueRes.data || !issueRes.data.cert) {
          throw new Error('签发证书失败: 无返回数据');
        }

        // 3. 导入证书到USBKey
        ElMessage.info('正在将证书写入 USBKey...');
        await skf.importCertificate(certForm.provider, certForm.device, certForm.appName, csrRes.container, true, issueRes.data.cert);

        // 4. 更新用户信息，将证书和证书序列号写入用户表
        ElMessage.info('正在更新用户证书信息...');
        const userDataRes = await getUser(certForm.userId);
        const userData = userDataRes.data;
        await updateUser({
          id: userData.id,
          userId: userData.id,
          deptId: userData.deptId,
          username: userData.username,
          password: '',
          mobile: userData.mobile,
          mail: userData.mail,
          status: userData.status,
          remark: userData.remark || '',
          postIds: [],
          roleIds: ['404'],
          certSn: issueRes.data.serialNumber || '',
          cert: issueRes.data.cert
        });

        ElMessage.success('证书签发成功');
        certDialog.visible = false;
        await getList();
      } catch (error: any) {
        ElMessage.error('证书签发失败: ' + (error.message || error));
      } finally {
        certDialog.loading = false;
      }
    }
  });
}

/** 关闭签发证书对话框 */
function closeCertDialog() {
  certDialog.visible = false;
  certFormRef.value?.resetFields();
}

/** 重置操作表单 */
function reset() {
  form.value = { ...initFormData };
  userFormRef.value?.resetFields();
}

/** 取消按钮 */
function cancel() {
  dialog.visible = false;
  reset();
}

/** 关闭用户弹窗 */
function closeDialog() {
  dialog.visible = false;
  resetForm();
}

/** 重置表单 */
function resetForm() {
  userFormRef.value?.resetFields();
  userFormRef.value?.clearValidate();
  form.value.userId = undefined;
  form.value.status = '0';
}

/** 查询操作日志列表 */
async function getLogList() {
  logLoading.value = true;
  try {
    const res = await listOperLog(logQueryParams);
    logList.value = res.data.rows || res.data.records || [];
    logTotal.value = res.data.total || 0;

    // 模拟联动统计数据
    stats.sensitiveOps = logTotal.value; // 展示总操作数作为敏感操作参考
    stats.revokeRequests = logList.value.filter((l: any) => l.methodName?.toLowerCase().includes('revoke')).length;
  } catch (error) {
    console.error('获取日志失败', error);
  } finally {
    logLoading.value = false;
  }
}

/** 日志查询操作 */
function handleLogQuery() {
  logQueryParams.pageNum = 1;
  getLogList();
}

/** 日志重置操作 */
function resetLogQuery() {
  logQueryParams.moduleName = undefined;
  logQueryParams.operator = undefined;
  logQueryParams.status = undefined;
  handleLogQuery();
}

onMounted(() => {
  getList();
  getLogList();
});
</script>

<style scoped lang="scss">
.p-2 {
  padding: 15px;
}

.mb-4 {
  margin-bottom: 20px;
}

.status-card {
  border-radius: 8px;
  border-left: 5px solid #f56c6c;
  background: #fff;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .title {
      font-size: 14px;
      font-weight: bold;
      color: #606266;
    }
  }

  .card-body {
    padding: 10px 0;
    text-align: center;
    .value {
      font-size: 28px;
      font-weight: bold;
      color: #303133;
    }
    .desc {
      font-size: 12px;
      color: #909399;
      margin-top: 5px;
    }
  }

  &.health {
    border-left-color: #67c23a;
    background: linear-gradient(135deg, #fff 0%, #f0f9eb 100%);
    .value {
      color: #67c23a;
    }
  }
}

.small-padding {
  .cell {
    padding: 0 5px;
  }
}

.fixed-width {
  min-width: 180px;
}
</style>
