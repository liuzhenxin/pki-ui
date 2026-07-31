import type { OpsContainer, OpsOverview, OpsServer, OpsSummary } from '@/api/ops/types';

export const statusTagType = (status?: string, running?: boolean, present = true) => {
  if (!present) {
    return 'danger';
  }
  if (running || status === 'UP' || status === 'running') {
    return 'success';
  }
  if (status === 'DEGRADED' || status?.includes('starting')) {
    return 'warning';
  }
  return 'danger';
};

export const statusText = (status?: string, running?: boolean, present = true) => {
  if (!present) {
    return '未发现';
  }
  if (running || status === 'UP' || status === 'running') {
    return '运行中';
  }
  if (status === 'DEGRADED') {
    return '降级';
  }
  if (status === 'DOWN') {
    return '离线';
  }
  return status || '未知';
};

export const percentText = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '-';
  }
  return `${Number(value).toFixed(1)}%`;
};

export const dateTimeText = (value?: string) => {
  if (!value) {
    return '-';
  }
  return value.replace('T', ' ').replace(/\.\d+.*/, '');
};

export const flattenComponents = (overview?: OpsOverview) => {
  return (overview?.layers || []).flatMap((layer) => layer.components.map((component) => ({ ...component, layerName: layer.name, layerOrder: layer.order })));
};

export const collectContainers = (servers: OpsServer[], fallback: OpsContainer[] = []) => {
  const fromServers = servers.flatMap((server) => server.containers.map((container) => ({ ...container, serverCode: server.code, serverName: server.name, serverHost: server.host })));
  if (fromServers.length > 0) {
    return fromServers;
  }
  return fallback.map((container) => ({ ...container, serverCode: '-', serverName: '-', serverHost: '-' }));
};

export const buildSummary = (overview?: OpsOverview, servers: OpsServer[] = [], containers: OpsContainer[] = []): OpsSummary => {
  const components = flattenComponents(overview);
  const allContainers = collectContainers(servers, containers);
  return {
    serverCount: servers.length,
    onlineServerCount: servers.filter((server) => server.online).length,
    containerCount: allContainers.length,
    runningContainerCount: allContainers.filter((container) => container.running).length,
    componentCount: components.length,
    runningComponentCount: components.filter((component) => component.container?.running).length,
    abnormalComponentCount: components.filter((component) => !component.container?.running).length
  };
};
