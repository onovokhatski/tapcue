import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import {
  addStep,
  emptyCommand,
  moveStep,
  sequenceLength,
  setCommand,
  setCommandTarget,
  setGoTo,
  setStepDelay,
  withStep,
} from './actions';
import { setKind } from './hotspots';

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
      expect(action(project)).toEqual({ goTo: 'p_proda0', commands: [] });
      expectValid(project);
    });

    it('starts the empty command of another protocol', () => {
      const toUdp = setCommandTarget(demoProject(), 'p_home00', 'h_carda0', 't_projec');
      expect(action(toUdp).commands[0]?.command).toEqual({
        type: 'udp',
        targetId: 't_projec',
        text: 'GO',
      });
      const toHttp = setCommandTarget(demoProject(), 'p_home00', 'h_carda0', 't_demo00');
      expect(action(toHttp).commands[0]?.command).toEqual({
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
      const original = action(before).commands[0]?.command;
      const project = setCommandTarget(before, 'p_home00', 'h_carda0', 't_resol2');
      expect(action(project).commands[0]?.command).toEqual({ ...original, targetId: 't_resol2' });
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
      expect(action(project).commands[0]?.command).toMatchObject({
        address: '/layer/1/clip/2/connect',
      });
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

  it("starts a fader's UDP and HTTP commands with {value}, valid at once (ADR 0020)", () => {
    const fader = setKind(demoProject(), 'p_home00', 'h_about0', 'fader');
    const commandOf = (project: Project) =>
      project.pages[0]!.hotspots.find((h) => h.id === 'h_about0')!.action.commands[0]?.command;
    const udp = setCommandTarget(fader, 'p_home00', 'h_about0', 't_projec');
    expect(commandOf(udp)).toEqual({ type: 'udp', targetId: 't_projec', text: '{value}' });
    expectValid(udp);
    const http = setCommandTarget(fader, 'p_home00', 'h_about0', 't_demo00');
    expect(commandOf(http)).toMatchObject({ type: 'http', path: '/{value}', body: null });
    expectValid(http);
    // A button starts as before.
    const button = setCommandTarget(demoProject(), 'p_home00', 'h_about0', 't_projec');
    expect(commandOf(button)).toMatchObject({ text: 'GO' });
  });

  it('starts every protocol with a valid command', () => {
    const project = demoProject();
    for (const target of project.targets) {
      const next = setCommand(project, 'p_home00', 'h_carda0', emptyCommand(target));
      expectValid(next);
    }
  });
});

describe('sequences (spec ACT-5, ACT-6, ADR 0022)', () => {
  const udp = (text: string) => ({ type: 'udp' as const, targetId: 't_projec', text });
  const texts = (project: Project) =>
    action(project).commands.map((s) => ('text' in s.command ? s.command.text : s.command.type));
  /** The demo stand with Product A's card sending these steps. */
  function withSteps(commands: Project['pages'][number]['hotspots'][number]['action']['commands']) {
    const project = demoProject();
    const card = project.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!;
    card.action = { ...card.action, commands };
    return project;
  }
  const three = () =>
    withSteps([
      { command: udp('ONE') },
      { delayMs: 500, command: udp('TWO') },
      { command: udp('THREE') },
    ]);

  describe('withStep', () => {
    const sequence = {
      goTo: null,
      commands: [
        { delayMs: 500, command: udp('ONE') },
        { delayMs: 2000, command: udp('TWO') },
      ],
    };

    it("replaces a step's command, keeping its delay and the other steps", () => {
      expect(withStep(sequence, 1, udp('NEW'))).toEqual({
        goTo: null,
        commands: [sequence.commands[0], { delayMs: 2000, command: udp('NEW') }],
      });
    });

    it('adds a step just past the end, and removes one for null', () => {
      expect(withStep(sequence, 2, udp('NEW')).commands).toHaveLength(3);
      expect(withStep(sequence, 0, null)).toEqual({ goTo: null, commands: [sequence.commands[1]] });
    });

    it('changes nothing for an index that is not there, or past 20 steps', () => {
      expect(withStep(sequence, 5, udp('NEW'))).toBe(sequence);
      expect(withStep(sequence, -1, udp('NEW'))).toBe(sequence);
      const full = {
        goTo: null,
        commands: Array.from({ length: 20 }, () => ({ command: udp('X') })),
      };
      expect(withStep(full, 20, udp('NEW'))).toBe(full);
    });
  });

  it('edits and removes the step it is given, and leaves the others', () => {
    const project = three();
    const changed = setCommand(project, 'p_home00', 'h_carda0', udp('EDITED'), 1);
    expect(texts(changed)).toEqual(['ONE', 'EDITED', 'THREE']);
    expect(action(changed).commands[1]!.delayMs).toBe(500);
    const removed = setCommandTarget(project, 'p_home00', 'h_carda0', null, 1);
    expect(texts(removed)).toEqual(['ONE', 'THREE']);
    expectValid(removed);
  });

  it("starts a step to another protocol with that protocol's empty command", () => {
    const project = setCommandTarget(three(), 'p_home00', 'h_carda0', 't_resolm', 2);
    expect(action(project).commands[2]!.command).toEqual({
      type: 'osc-udp',
      targetId: 't_resolm',
      address: '/',
      args: [],
    });
    expect(texts(project).slice(0, 2)).toEqual(['ONE', 'TWO']);
  });

  it('adds a command to the target of the last step, or to the first target', () => {
    const added = addStep(three(), 'p_home00', 'h_carda0');
    expect(action(added).commands[3]).toEqual({ command: emptyCommand(target(added, 't_projec')) });
    expectValid(added);

    const none = addStep(withSteps([]), 'p_home00', 'h_carda0');
    expect(action(none).commands).toEqual([{ command: emptyCommand(none.targets[0]!) }]);
  });

  it('adds nothing at 20 commands or without a target', () => {
    const full = withSteps(Array.from({ length: 20 }, () => ({ command: udp('X') })));
    expect(addStep(full, 'p_home00', 'h_carda0')).toBe(full);
    const noTargets = { ...withSteps([]), targets: [] };
    expect(addStep(noTargets, 'p_home00', 'h_carda0')).toBe(noTargets);
  });

  it('moves a step, delay and all, within the list', () => {
    const project = three();
    expect(texts(moveStep(project, 'p_home00', 'h_carda0', 0, 2))).toEqual(['TWO', 'THREE', 'ONE']);
    const up = moveStep(project, 'p_home00', 'h_carda0', 1, 0);
    expect(action(up).commands[0]).toEqual({ delayMs: 500, command: udp('TWO') });
    expect(texts(moveStep(project, 'p_home00', 'h_carda0', 0, 99))).toEqual([
      'TWO',
      'THREE',
      'ONE',
    ]);
    expect(texts(moveStep(project, 'p_home00', 'h_carda0', 2, -1))).toEqual([
      'THREE',
      'ONE',
      'TWO',
    ]);
    expect(moveStep(project, 'p_home00', 'h_carda0', 1, 1)).toBe(project);
    expect(moveStep(project, 'p_home00', 'h_carda0', 7, 0)).toBe(project);
  });

  it('sets a delay in whole ms from 0 to 60 s, and leaves the field out for 0', () => {
    const project = three();
    const later = setStepDelay(project, 'p_home00', 'h_carda0', 2, 2500);
    expect(action(later).commands[2]).toEqual({ delayMs: 2500, command: udp('THREE') });
    const none = setStepDelay(project, 'p_home00', 'h_carda0', 1, 0);
    expect(action(none).commands[1]).toEqual({ command: udp('TWO') });
    for (const bad of [-1, 60_001, 2.5]) {
      expect(setStepDelay(project, 'p_home00', 'h_carda0', 1, bad)).toBe(project);
    }
    expect(setStepDelay(project, 'p_home00', 'h_carda0', 9, 100)).toBe(project);
    expectValid(later);
  });

  it('adds up the pauses of a sequence', () => {
    expect(sequenceLength(action(three()))).toBe(500);
    expect(sequenceLength({ goTo: null, commands: [] })).toBe(0);
  });
});

function target(project: Project, id: string) {
  return project.targets.find((t) => t.id === id)!;
}
