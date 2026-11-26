// What each folded section of the hotspot panel says about the selected hotspots, in one line
// (spec ED-20). For several hotspots a value they do not share reads as "mixed".
import { activeSteps, type Hotspot, type Project } from '@tapcue/shared';
import { describeCommand } from '../log/logEntries';
import { sequenceLength } from '../operations/actions';
import { boundingBox } from '../operations/geometry';
import { MIXED, shared } from './mixed';

const join = (parts: (string | null | false | undefined)[]) =>
  parts.filter((part): part is string => Boolean(part)).join(' · ');

const percent = (value: number) => `${Math.round(value * 100)} %`;

/** "2.5 s", as the command cards say it. */
const seconds = (ms: number) => `${Number((ms / 1000).toFixed(1))} s`;

export function nameSummary(hotspot: Hotspot): string {
  return hotspot.name || 'Unnamed';
}

/** "Button", or "Fader · vertical, 0 to 1". */
export function typeSummary(hotspot: Hotspot): string {
  if (hotspot.kind !== 'fader' || !hotspot.fader) return 'Button';
  const { orientation, min, max } = hotspot.fader;
  return `Fader · ${orientation}, ${min} to ${max}`;
}

/** "144, 500 · 560 × 720": where the hotspots' common box stands, and its size. */
export function positionSummary(hotspots: Hotspot[]): string {
  const box = boundingBox(hotspots);
  return box ? `${box.x}, ${box.y} · ${box.width} × ${box.height}` : '';
}

function shapeLabel(hotspot: Hotspot): string {
  const { shape } = hotspot;
  return shape.type === 'ellipse' ? 'Ellipse' : `Rectangle R ${shape.cornerRadius}`;
}

/**
 * "Rectangle R 40 · fill #FFFFFF 30 % · border 2 px": the shape, then what visitors see. Without
 * a fill, border, frost or image it says the hotspot is invisible.
 */
export function styleSummary(hotspots: Hotspot[]): string {
  const shape = shared(hotspots.map(shapeLabel));
  const fill = shared(
    hotspots.map((h) => (h.style.fill ? [h.style.fill, h.style.fillOpacity ?? 1] : null)),
  );
  const border = shared(hotspots.map((h) => h.style.border?.width ?? null));
  const blur = shared(hotspots.map((h) => h.style.backdropBlur ?? 0));
  const image = shared(hotspots.map((h) => Boolean(h.style.image)));
  const opacity = shared(hotspots.map((h) => h.style.opacity));
  const visible = hotspots.some(
    (h) => h.style.fill || h.style.border || h.style.backdropBlur || h.style.image,
  );
  return join([
    shape === MIXED ? 'Mixed shapes' : shape,
    !visible && 'invisible',
    fill === MIXED
      ? 'mixed fill'
      : fill && `fill ${fill[0]}${fill[1] === 1 ? '' : ` ${percent(Number(fill[1]))}`}`,
    border === MIXED ? 'mixed border' : border !== null && `border ${border} px`,
    blur === MIXED ? 'mixed frost' : blur > 0 && `frost ${blur} px`,
    image === MIXED ? 'some with an image' : image && 'image',
    opacity === MIXED ? 'mixed opacity' : opacity < 1 && `opacity ${percent(opacity)}`,
  ]);
}

/** "“Label” · 48 px medium", or "No text"; for several, the style the labelled ones share. */
export function textSummary(hotspots: Hotspot[]): string {
  const labelled = hotspots.filter((h) => h.text);
  if (labelled.length === 0) return 'No text';
  const texts = labelled.map((h) => h.text!);
  const size = shared(texts.map((t) => t.size));
  const weight = shared(texts.map((t) => t.weight));
  const style = `${size === MIXED ? 'mixed size' : `${size} px`} ${
    weight === MIXED ? 'mixed weight' : weight
  }`;
  if (hotspots.length === 1) return join([`“${texts[0]!.content}”`, style]);
  return join([`${labelled.length} of ${hotspots.length} with text`, style]);
}

/**
 * "Go to Product A · 2 commands over 1.5 s", "Nothing yet"; a fader says what a drag sends. Steps
 * that are off are not counted (spec ACT-9).
 */
export function onTapSummary(hotspot: Hotspot, project: Project): string {
  const { action } = hotspot;
  if (hotspot.kind === 'fader') {
    const step = action.commands[0];
    if (!step) return 'Sends nothing yet';
    const target = project.targets.find((t) => t.id === step.command.targetId);
    return join([
      target?.name,
      describeCommand(step.command).text,
      step.enabled === false && 'off',
    ]);
  }
  const page = project.pages.find((p) => p.id === action.goTo);
  const all = action.commands.length;
  const on = activeSteps(action).length;
  const total = sequenceLength(action);
  const commands =
    all > 0 &&
    `${on < all ? `${on} of ${all}` : all} ${all === 1 ? 'command' : 'commands'}${
      total > 0 ? ` over ${seconds(total)}` : ''
    }`;
  return join([page && `Go to ${page.name}`, commands]) || 'Nothing yet';
}

/** "1 of 5 from the bottom". */
export function stackingSummary(index: number, count: number): string {
  return `${index + 1} of ${count} from the bottom`;
}
