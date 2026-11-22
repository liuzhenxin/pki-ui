// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { beforeEach, expect, it, vi } from 'vitest';
import NotificationTemplatePane from '@/views/ops/alert/NotificationTemplatePane.vue';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/utils/request', () => ({ default: mocks.request }));

const directory = '/v1/alert/notification-templates';
const url = `${directory}/RA/CERT_EXPIRY/EMAIL`;
const defaults = { title: '证书到期提醒', body: '证书 {{serialNumber}}', revision: null, origin: 'DEFAULT', inheritedFrom: null };
const catalog = {
  applications: [
    {
      value: 'RA',
      label: 'RA 注册认证中心',
      scenes: [
        {
          value: 'CERT_EXPIRY',
          label: '证书到期提醒',
          variables: [{ name: 'serialNumber', label: '证书序列号', sample: 'A1002F' }]
        }
      ]
    }
  ],
  channels: [{ value: 'EMAIL', label: '邮件（SMTP）' }],
  editable: true
};

beforeEach(() => mocks.request.mockReset());

it('edits the selected default, previews it without saving, then saves the same draft', async () => {
  mocks.request
    .mockResolvedValueOnce(catalog)
    .mockResolvedValueOnce(defaults)
    .mockResolvedValueOnce({ title: '到期提醒 A1002F', body: '<strong>模拟正文</strong>' })
    .mockResolvedValueOnce({ ...defaults, title: '到期提醒 {{serialNumber}}', revision: 'saved', origin: 'CUSTOM' });
  const wrapper = mount(NotificationTemplatePane, { global: { plugins: [ElementPlus] } });

  try {
    await flushPromises();
    expect(wrapper.text()).toContain('默认模板');
    expect(mocks.request).toHaveBeenNthCalledWith(2, expect.objectContaining({ url, method: 'get' }));

    await wrapper.get('input[maxlength="255"]').setValue('到期提醒 {{serialNumber}}');
    const button = wrapper.findAll('button').find((item) => item.text() === '模拟预览');
    expect(button).toBeDefined();
    await button!.trigger('click');
    await flushPromises();
    const data = { title: '到期提醒 {{serialNumber}}', body: defaults.body };
    expect(mocks.request).toHaveBeenNthCalledWith(3, expect.objectContaining({ url: `${url}/preview`, method: 'post', data }));
    expect(wrapper.get('.preview-body').text()).toBe('<strong>模拟正文</strong>');
    expect(wrapper.find('.preview-body strong').exists()).toBe(false);

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.request).toHaveBeenNthCalledWith(4, expect.objectContaining({ url, method: 'put', data: { ...data, revision: null } }));
    expect(mocks.request).toHaveBeenCalledTimes(4);
    expect(wrapper.text()).toContain('已自定义');
  } finally {
    wrapper.unmount();
  }
});

it('does not offer saving for a read-only session', async () => {
  mocks.request.mockResolvedValueOnce({ ...catalog, editable: false }).mockResolvedValueOnce(defaults);
  const wrapper = mount(NotificationTemplatePane, { global: { plugins: [ElementPlus] } });

  try {
    await flushPromises();
    expect(wrapper.text()).toContain('模拟预览');
    expect(wrapper.text()).not.toContain('保存模板');
    await wrapper.get('form').trigger('submit');
    expect(mocks.request).toHaveBeenCalledTimes(2);
  } finally {
    wrapper.unmount();
  }
});
