import { describe, expect, it } from 'vitest';
import type { OpsServer } from '../../src/api/ops/types';
import { collectContainers, findOverviewAgent } from '../../src/views/ops/utils';

describe('OPS overview Agent node selection', () => {
  const agents = collectContainers(
    ['ca-node-181', 'ops-250'].map(
      (code): OpsServer => ({
        code,
        name: code,
        host: code,
        role: '',
        status: 'UP',
        online: true,
        runningContainerCount: 1,
        components: [],
        containers: [
          {
            name: 'pki-ops-agent',
            containerId: code,
            image: 'pki-ops-agent',
            state: 'running',
            status: '',
            ports: '',
            present: true,
            running: true
          }
        ]
      })
    )
  );

  it('uses the only available Agent when no node is selected', () => {
    expect(findOverviewAgent([agents[0]], '')).toBe(agents[0]);
  });

  it('requires a node among same-named Agents and returns its exact container', () => {
    expect(findOverviewAgent(agents, '')).toBeUndefined();
    expect(findOverviewAgent(agents, 'ops-250')).toBe(agents[1]);
    expect(findOverviewAgent([...agents].reverse(), 'ca-node-181')).toBe(agents[0]);
  });

  it('keeps logs unavailable if the selected node disappears', () => {
    expect(findOverviewAgent([agents[0]], 'ops-250')).toBeUndefined();
    expect(findOverviewAgent([], '')).toBeUndefined();
  });
});
