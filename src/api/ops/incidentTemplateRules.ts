import request from '@/utils/request';
import { opsApiBaseURL } from './index';

export interface IncidentTemplateBinding {
  source: string;
  channel: string;
  triggerChannel: string | null;
  recoveryChannel: string | null;
  revision: string;
  enabled: boolean;
}

export interface IncidentTemplateRules {
  sources: { source: string; application: string; trigger: string; recovery: string | null }[];
  channels: {
    name: string;
    channel: string;
    templateChannels: string[];
    recipient?: string | null;
    available?: boolean;
    deployedSources?: string[];
  }[];
  bindings: IncidentTemplateBinding[];
  notificationsEnabled?: boolean;
  cpuRoutes?: { channel: string; phase: 'TRIGGERED' | 'RECOVERED'; objectPrefix: string | null; deploymentTemplate: boolean }[];
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

export function saveIncidentChannels(source: string, changes: Record<string, BindingEdit & { enabled: boolean }>) {
  return request<unknown, IncidentTemplateBinding[]>({
    baseURL: opsApiBaseURL,
    url: directory + '/' + encodeURIComponent(source),
    method: 'put',
    data: changes
  });
}
