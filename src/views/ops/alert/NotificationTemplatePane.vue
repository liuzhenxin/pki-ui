<template>
  <div v-loading="busy" class="template-pane">
    <el-form label-position="top" @submit.prevent="save">
      <div class="selectors">
        <el-form-item label="应用">
          <el-select :model-value="selection.application" :disabled="busy" @update:model-value="selectTemplate('application', $event)">
            <el-option v-for="option in catalog?.applications" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="场景">
          <el-select :model-value="selection.scene" :disabled="busy" @update:model-value="selectTemplate('scene', $event)">
            <el-option v-for="option in application?.scenes" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="渠道">
          <el-select :model-value="selection.channel" :disabled="busy" @update:model-value="selectTemplate('channel', $event)">
            <el-option v-for="option in catalog?.channels" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
      </div>
      <el-alert v-if="stale" title="模板已更新，请重新加载后再保存" type="warning" :closable="false" show-icon />
      <el-alert v-if="!catalog && !busy" title="模板目录加载失败" type="error" :closable="false">
        <el-button link type="primary" @click="loadCatalog">重新加载</el-button>
      </el-alert>

      <div v-if="catalog" class="workspace">
        <section>
          <div class="template-toolbar">
            <el-tag v-if="template" effect="plain">{{ sourceLabel }}</el-tag>
            <el-tag v-if="dirty" type="warning">未保存</el-tag>
            <el-button link type="primary" :disabled="busy" @click="reload">重新加载</el-button>
          </div>
          <el-form-item label="标题" required>
            <el-input ref="titleInput" v-model="draft.title" @focus="activeField = 'title'" :maxlength="255" :disabled="!template || busy" />
          </el-form-item>
          <el-form-item label="正文" required>
            <el-input
              ref="bodyInput"
              v-model="draft.body"
              @focus="activeField = 'body'"
              type="textarea"
              :rows="9"
              :maxlength="8000"
              show-word-limit
              :disabled="!template || busy"
            />
          </el-form-item>
          <el-form-item label="可用变量">
            <div class="variables">
              <el-tooltip
                v-for="variable in scene?.variables"
                :key="variable.name"
                :content="`${formatVariable(variable.name)} · ${variable.sample}`"
              >
                <el-button size="small" :disabled="!template || busy" @click="insertVariable(variable.name)">{{ variable.label }}</el-button>
              </el-tooltip>
            </div>
          </el-form-item>
          <el-space wrap>
            <el-button v-if="catalog.editable" type="primary" native-type="submit" :disabled="!canUseDraft || stale">保存模板</el-button>
            <el-button :disabled="!canUseDraft" @click="preview">模拟预览</el-button>
          </el-space>
        </section>
        <section class="preview" aria-label="模拟预览">
          <h3>{{ channelLabel }} · {{ scene?.label }}</h3>
          <small>模拟数据</small>
          <p v-if="!previewResult" class="preview-hint">{{ dirty ? '内容已修改，请重新预览。' : '点击模拟预览查看示例。' }}</p>
          <template v-else>
            <div v-if="isEmail">主题</div>
            <strong class="preview-title">{{ previewResult.title }}</strong>
            <div v-if="isEmail">正文</div>
            <p class="preview-body" :class="{ message: !isEmail }">{{ previewResult.body }}</p>
          </template>
        </section>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage, ElMessageBox, type InputInstance } from 'element-plus';
import {
  getNotificationTemplate,
  getNotificationTemplateCatalog,
  previewNotificationTemplate,
  saveNotificationTemplate,
  type NotificationTemplate,
  type NotificationTemplateCatalog,
  type NotificationTemplateDraft,
  type NotificationTemplateKey
} from '@/api/ops/notificationTemplates';

const catalog = ref<NotificationTemplateCatalog>();
const selection = reactive<NotificationTemplateKey>({ application: '', scene: '', channel: '' });
const template = ref<NotificationTemplate>();
const draft = reactive<NotificationTemplateDraft>({ title: '', body: '' });
const busy = ref(false);
const stale = ref(false);
const previewResult = ref<NotificationTemplateDraft>();

const application = computed(() => catalog.value?.applications.find((item) => item.value === selection.application));
const scene = computed(() => application.value?.scenes.find((item) => item.value === selection.scene));
const canUseDraft = computed(() => !!template.value && !busy.value && !!draft.title.trim() && !!draft.body.trim());
const channelLabel = computed(() => catalog.value?.channels.find((item) => item.value === selection.channel)?.label);
const isEmail = computed(() => /EMAIL|SMTP|MAIL/i.test(selection.channel));
const dirty = computed(() => !!template.value && (draft.title !== template.value.title || draft.body !== template.value.body));
const titleInput = ref<InputInstance>();
const bodyInput = ref<InputInstance>();
const activeField = ref<'title' | 'body'>('body');
async function allowLeave() {
  if (busy.value) return false;
  if (!dirty.value) return true;
  try {
    await ElMessageBox.confirm('当前模板有未保存的修改。关闭此对话框可继续编辑。', '离开模板编辑', {
      confirmButtonText: catalog.value?.editable ? '保存并继续' : '放弃修改',
      cancelButtonText: catalog.value?.editable ? '放弃修改' : '继续编辑',
      distinguishCancelAndClose: true,
      closeOnClickModal: false
    });
    if (!catalog.value?.editable) return true;
    await save();
    return !dirty.value;
  } catch (action) {
    if (action === 'cancel' && catalog.value?.editable && template.value) {
      show(template.value);
      return true;
    }
    return false;
  }
}
async function selectTemplate(key: keyof NotificationTemplateKey, value: string) {
  if (selection[key] === value || !(await allowLeave())) return;
  selection[key] = value;
  if (key === 'application') await changeApplication();
  else await loadTemplate();
}
async function reload() {
  if (await allowLeave()) await loadTemplate();
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
onBeforeRouteLeave(allowLeave);
defineExpose({ allowLeave });
const sourceLabel = computed(() => {
  if (template.value?.origin === 'CUSTOM') return '已自定义';
  if (template.value?.origin === 'INHERITED') {
    const channel = catalog.value?.channels.find((item) => item.value === template.value?.inheritedFrom);
    return `继承${channel?.label || '通用渠道'}`;
  }
  return '默认模板';
});

function show(value: NotificationTemplate) {
  template.value = value;
  draft.title = value.title;
  draft.body = value.body;
}

async function loadCatalog() {
  busy.value = true;
  try {
    catalog.value = await getNotificationTemplateCatalog();
    selection.application = catalog.value.applications[0].value;
    selection.channel = catalog.value.channels[0].value;
    await changeApplication();
  } catch {
    catalog.value = undefined;
  } finally {
    busy.value = false;
  }
}

async function changeApplication() {
  selection.scene = application.value?.scenes[0]?.value || '';
  await loadTemplate();
}

async function loadTemplate() {
  if (!selection.application || !selection.scene || !selection.channel) return;
  busy.value = true;
  stale.value = false;
  template.value = undefined;
  draft.title = '';
  draft.body = '';
  try {
    show(await getNotificationTemplate(selection));
  } catch {
    // The request interceptor shows the failure.
  } finally {
    busy.value = false;
  }
}

function formatVariable(name: string) {
  return `{{${name}}}`;
}

async function insertVariable(name: string) {
  const key = activeField.value;
  const input = key === 'title' ? titleInput.value?.input : bodyInput.value?.textarea;
  if (!input) return;
  const start = input.selectionStart ?? draft[key].length;
  const end = input.selectionEnd ?? start;
  const token = formatVariable(name);
  const value = draft[key].slice(0, start) + token + draft[key].slice(end);
  if (value.length > input.maxLength) {
    ElMessage.warning('插入变量后超过字数限制');
    return;
  }
  draft[key] = value;
  await nextTick();
  input.focus();
  input.setSelectionRange(start + token.length, start + token.length);
}

async function save() {
  if (!catalog.value?.editable || !canUseDraft.value || stale.value || !template.value) return;
  busy.value = true;
  try {
    show(await saveNotificationTemplate(selection, { ...draft }, template.value.revision));
    ElMessage.success('通知模板已保存');
  } catch (error) {
    stale.value = (error as { response?: { status?: number } })?.response?.status === 409;
  } finally {
    busy.value = false;
  }
}

async function preview() {
  if (!canUseDraft.value) return;
  busy.value = true;
  previewResult.value = undefined;
  try {
    previewResult.value = await previewNotificationTemplate(selection, { ...draft });
  } catch {
    // The request interceptor shows the variable validation error.
  } finally {
    busy.value = false;
  }
}

watch(draft, () => {
  previewResult.value = undefined;
});
onMounted(loadCatalog);
</script>

<style scoped>
.selectors {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 185px), 1fr));
  gap: 0 16px;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr);
  gap: 24px;
  align-items: start;
}

.template-toolbar,
.variables {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.template-toolbar {
  min-height: 32px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.variables .el-button {
  margin-left: 0;
}

.preview {
  min-height: 176px;
  padding: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--el-border-radius-base);
}

.preview-body.message {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 12px;
}
.preview h3 {
  margin: 0 0 16px;
}

.preview-hint {
  color: var(--el-text-color-secondary);
}

.preview-title,
.preview-body {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

@media (max-width: 820px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
