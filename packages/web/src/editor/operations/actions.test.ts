import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { emptyCommand, setCommand, setCommandTarget, setGoTo } from './actions';

const expectValid = (project: Project) =>
  expect(validateProject(project)).toMatchObject({ ok: true });
const action = (project: Project, id = 'h_carda0') =>
  project.pages[0]!.hotspots.find((h) => h.id === id)!.action;

describe('action operations (spec ACT-1)', () => {
  describe('setGoTo', () => {
    it('links to a page, or to none', () => {
      const project = setGoTo(demoProject(), 'p_home00', 'h_carda0', 'p_about0');
      expect(action(project).goTo).toBe('p_about0');
      expect(action(setGoTo(project, 'p_home00', 'h_carda0', null)).goTo).toBeNull();
      expectValid(project);
    });

    it('never links a hotspot to its own page, or to a page that is not there', () => {
      const before = demoProject();
      expect(setGoTo(before, 'p_home00', 'h_carda0', 'p_home00')).toBe(before);
      expect(setGoTo(before, 'p_home00', 'h_carda0', 'p_zzzzzz')).toBe(before);
    });
  });

  describe('setCommandTarget', () => {
    it('clears the command for "no command", and keeps the page link', () => {
      const project = setCommandTarget(demoProject(), 'p_home00', 'h_carda0', null);
      expect(action(project)).toEqual({ goTo: 'p_proda0', command: null });
      expectValid(project);
    });

    it('starts the empty command of another protocol', () => {
      const toUdp = setCommandTarget(demoProject(), 'p_home00', 'h_carda0', 't_projec');
      expect(action(toUdp).command).toEqual({ type: 'udp', targetId: 't_projec', text: 'GO' });
      const toHttp = setCommandTarget(demoProject(), 'p_home00', 'h_carda0', 't_demo00');
      expect(action(toHttp).command).toEqual({
        type: 'http',
        targetId: 't_demo00',
        method: 'POST',
        path: '/',
        body: null,
      });
      expectValid(toUdp);
      expectValid(toHttp);
    });

    it('keeps the command and only changes where it goes, for a target of the same protocol', () => {
      const before = demoProject();
      before.targets.push({
        id: 't_resol2',
        name: 'Resolume 2',
        protocol: 'osc-udp',
        host: '192.168.1.21',
        port: 7000,
      });
      const original = action(before).command;
      const project = setCommandTarget(before, 'p_home00', 'h_carda0', 't_resol2');
      expect(action(project).command).toEqual({ ...original, targetId: 't_resol2' });
      expectValid(project);
    });

    it('keeps the project for an unknown target or the same one', () => {
      const before = demoProject();
      expect(setCommandTarget(before, 'p_home00', 'h_carda0', 't_zzzzzz')).toBe(before);
      expect(setCommandTarget(before, 'p_home00', 'h_carda0', 't_resolm')).toBe(before);
    });
  });

  describe('setCommand', () => {
    it('replaces the command', () => {
      const project = setCommand(demoProject(), 'p_home00', 'h_carda0', {
        type: 'osc-udp',
        targetId: 't_resolm',
        address: '/layer/1/clip/2/connect',
        args: [{ type: 'f', value: 0.5 }],
      });
      expect(action(project).command).toMatchObject({ address: '/layer/1/clip/2/connect' });
      expectValid(project);
    });

    it('refuses a command that does not match its target', () => {
      const before = demoProject();
      expect(
        setCommand(before, 'p_home00', 'h_carda0', {
          type: 'udp',
          targetId: 't_resolm',
          text: 'X',
        }),
      ).toBe(before);
    });
  });

  it('starts every protocol with a valid command', () => {
    const project = demoProject();
    for (const target of project.targets) {
      const next = setCommand(project, 'p_home00', 'h_carda0', emptyCommand(target));
      expectValid(next);
    }
  });
});
