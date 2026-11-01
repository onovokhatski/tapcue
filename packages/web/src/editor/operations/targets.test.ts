import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { addTarget, changeProtocol, deleteTarget, targetUsage, updateTarget } from './targets';

const expectValid = (project: Project) =>
  expect(validateProject(project)).toMatchObject({ ok: true });
const target = (project: Project, id: string) => project.targets.find((t) => t.id === id);
const commandsTo = (project: Project, id: string) =>
  project.pages.flatMap((p) => p.hotspots).filter((h) => h.action.command?.targetId === id);

describe('target operations (spec TGT-1)', () => {
  it('adds an OSC target with a placeholder address and the next free name', () => {
    const before = demoProject();
    before.targets[0]!.name = 'Target 4';
    const { project, targetId } = addTarget(before);
    expect(target(project, targetId)).toEqual({
      id: targetId,
      name: 'Target 5',
      protocol: 'osc-udp',
      host: '127.0.0.1',
      port: 7000,
    });
    expect(targetId).toMatch(/^t_[a-z0-9]{6}$/);
    expectValid(project);
  });

  it("updates a target's name and address", () => {
    const project = updateTarget(demoProject(), 't_resolm', {
      name: 'Resolume Arena',
      host: '10.0.0.5',
      port: 7001,
    });
    expect(target(project, 't_resolm')).toMatchObject({
      name: 'Resolume Arena',
      host: '10.0.0.5',
      port: 7001,
    });
    expectValid(project);
  });

  it('gives each protocol only its own fields', () => {
    const project = updateTarget(demoProject(), 't_demo00', {
      host: '10.0.0.5',
      baseUrl: 'http://10.0.0.5:8080',
    });
    expect(target(project, 't_demo00')).toEqual({
      id: 't_demo00',
      name: 'Demo receiver',
      protocol: 'http',
      baseUrl: 'http://10.0.0.5:8080',
    });
    expectValid(project);
  });

  it('keeps the project when nothing changes or the target is not there', () => {
    const before = demoProject();
    expect(updateTarget(before, 't_resolm', { name: 'Resolume' })).toBe(before);
    expect(updateTarget(before, 't_zzzzzz', { name: 'X' })).toBe(before);
  });

  describe('changeProtocol', () => {
    it('switches protocol, clearing its commands and keeping the page links', () => {
      const before = demoProject();
      const used = commandsTo(before, 't_resolm');
      expect(used.length).toBeGreaterThan(0);
      const project = changeProtocol(before, 't_resolm', 'udp');
      expect(target(project, 't_resolm')).toEqual({
        id: 't_resolm',
        name: 'Resolume',
        protocol: 'udp',
        host: '192.168.1.20',
        port: 7000,
      });
      expect(commandsTo(project, 't_resolm')).toEqual([]);
      const links = project.pages
        .flatMap((p) => p.hotspots)
        .filter((h) => used.some((u) => u.id === h.id));
      expect(links.map((h) => h.action.goTo)).toEqual(used.map((h) => h.action.goTo));
      expectValid(project);
    });

    it('gives an HTTP target a placeholder base URL, and a UDP one a placeholder address', () => {
      const toHttp = changeProtocol(demoProject(), 't_resolm', 'http');
      expect(target(toHttp, 't_resolm')).toEqual({
        id: 't_resolm',
        name: 'Resolume',
        protocol: 'http',
        baseUrl: 'http://localhost:8080',
      });
      const toOsc = changeProtocol(demoProject(), 't_demo00', 'osc-udp');
      expect(target(toOsc, 't_demo00')).toMatchObject({
        protocol: 'osc-udp',
        host: '127.0.0.1',
        port: 7000,
      });
      expectValid(toHttp);
      expectValid(toOsc);
    });

    it('keeps the project for the same protocol', () => {
      const before = demoProject();
      expect(changeProtocol(before, 't_resolm', 'osc-udp')).toBe(before);
    });
  });

  describe('deleteTarget (project format §10)', () => {
    it('deletes the target and clears the commands that sent to it; links stay', () => {
      const before = demoProject();
      const project = deleteTarget(before, 't_demo00');
      expect(target(project, 't_demo00')).toBeUndefined();
      expect(commandsTo(project, 't_demo00')).toEqual([]);
      expect(commandsTo(project, 't_resolm')).toEqual(commandsTo(before, 't_resolm'));
      expectValid(project);
    });

    it('keeps the project for a target that is not there', () => {
      const before = demoProject();
      expect(deleteTarget(before, 't_zzzzzz')).toBe(before);
    });
  });

  it('lists the hotspots that send to a target, with their page', () => {
    const usage = targetUsage(demoProject(), 't_demo00');
    expect(usage.length).toBeGreaterThan(0);
    expect(usage.every(({ hotspot }) => hotspot.action.command?.targetId === 't_demo00')).toBe(
      true,
    );
    expect(usage.every(({ page, hotspot }) => page.hotspots.includes(hotspot))).toBe(true);
  });
});
