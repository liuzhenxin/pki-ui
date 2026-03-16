<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
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
        </el-card>
      </div>
    </transition>

    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <el-button type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate">修改</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete">删除</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

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
  @change="(val) => handleStatusChange(scope.row, val)">
</el-switch>
          </template>
        </el-table-column>
        <el-table-column label="证书状态" align="center" prop="certSn" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.certSn ? 'success' : 'info'">{{ scope.row.certSn ? '已签发' : '未签发' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" width="180">
          <template #default="scope">
            <span>{{ scope.row.createTime }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="180" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="修改" placement="top">
              <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="重置密码" placement="top">
              <el-button link type="primary" icon="Key" @click="handleResetPwd(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

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
            <el-form-item v-if="form.userId == undefined" label="用户名称" prop="username">
              <el-input v-model="form.username" placeholder="请输入用户名称" maxlength="30" />
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
                <el-radio value="0">正常</el-radio>
                <el-radio value="1">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="角色" prop="roleIds">
              <el-select v-model="form.roleIds" multiple placeholder="请选择" disabled style="width: 100%">
                <el-option label="业务管理员" value="403" />
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
  </div>
</template>

<script setup name="BusinessAdmin" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { to } from 'await-to-js';
import { listUser, getUser, addUser, updateUser, delUser, resetUserPwd, changeStatus } from '@/api/system/user';
import { UserForm, UserQuery } from '@/api/system/user/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const userList = ref<any[]>([]);
const loading = ref(true);
const showSearch = ref(true);
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

const initFormData: UserForm = {
  userId: undefined,
  deptId: 401,
  username: '',
  password: '',
  mobile: undefined,
  mail: undefined,
  status: 0,
  remark: '',
  roleIds: ['403']
};

const data = reactive({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    username: '',
    mobile: '',
    status: '',
    roleId: '403'
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
  ids.value = selection.map((item) => item.userId);
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
    await changeStatus(row.userId, newStatus);
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
  form.value.roleIds = ['403'];
}

/** 修改按钮操作 */
async function handleUpdate(row?: any) {
  reset();
  const userId = row?.userId || ids.value[0];
  try {
    const { data } = await getUser(userId);
    dialog.visible = true;
    dialog.title = '修改业务管理员';
    Object.assign(form.value, data.user);
    // 移除不需要的字段
    delete form.value.nickName;
    delete form.value.sex;
    form.value.roleIds = ['403'];
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
      form.value.roleIds = ['403'];

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
  const userIds = row?.userId || ids.value;
  const [err] = await to(proxy?.$modal.confirm('是否确认删除用户编号为"' + userIds + '"的数据项？') as any);
  if (!err) {
    try {
      await delUser(userIds);
      await getList();
      proxy?.$modal.msgSuccess('删除成功');
    } catch (error) {
      console.error('删除失败', error);
    }
  }
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
    try {
      await resetUserPwd(row.userId, res.value);
      proxy?.$modal.msgSuccess('修改成功，新密码是：' + res.value);
    } catch (error) {
      console.error('重置密码失败', error);
    }
  }
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

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.p-2 {
  padding: 8px;
}

.mb-10px {
  margin-bottom: 10px;
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