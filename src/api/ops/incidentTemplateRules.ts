import request from '@/utils/request';
import { opsApiBaseURL } from './index';

export interface IncidentTemplateBinding {
  source: string;
  channel: string;
  triggerChannel: string | null;
  recoveryChannel: string | null;
  revision: string;
}

export interface IncidentTemplateRules {
  sources: { source: string; application: string; trigger: string; recovery: string }[];
  channels: { name: string; channel: string; templateChannels: string[] }[];
  bindings: IncidentTemplateBinding[];
  editable: boolean;
}

type BindingEdit = Pick<IncidentTemplateBinding, 'triggerChannel' | 'recoveryChannel'> & { revision: string | null };

const directory = '/v1/alert/incident-template-rules';

export function getIncidentTemplateRules() {
  return request<unknown, IncidentTemplateRules>({ baseURL: opsApiBaseURL, url: directory, method: 'get' });
}

export function saveIncidentTemplateBinding(source: string, channel: string, data: BindingEdit) {
  return request<unknown, IncidentTemplateBinding>({
    baseURL: opsApiBaseURL,
    url: `${directory}/${encodeURIComponent(source)}/${encodeURIComponent(channel)}`,
    method: 'put',
    data
  });
}
