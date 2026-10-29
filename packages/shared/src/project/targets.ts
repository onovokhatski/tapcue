// Where commands go, and what is sent (docs/project-format.md §6, §7).
// Both are discriminated unions: `protocol` (target) or `type` (command) decides the other fields.
import { z } from 'zod';
import { Name, TargetId } from './values';

// ---------- Targets ----------

const DOTTED_NUMBERS = /^\d+(\.\d+){3}$/;
const ipv4 = z.ipv4();
const hostname = z.hostname();

/** IPv4 address or host name. Something that looks like an IP must be a valid one, so a typo is not read as a host name. */
const Host = z.string().superRefine((host, ctx) => {
  if (DOTTED_NUMBERS.test(host)) {
    if (!ipv4.safeParse(host).success) {
      ctx.addIssue({ code: 'custom', message: 'Each part of an IP address must be 0–255' });
    }
  } else if (!hostname.safeParse(host).success) {
    ctx.addIssue({
      code: 'custom',
      message: 'Expected an IP address like 192.168.1.20 or a host name like resolume.local',
    });
  }
});

const Port = z
  .int('Expected a whole number')
  .min(1, 'Expected a port from 1 to 65535')
  .max(65535, 'Expected a port from 1 to 65535');

const targetBase = { id: TargetId, name: Name };

export const OscUdpTarget = z.strictObject({
  ...targetBase,
  protocol: z.literal('osc-udp'),
  host: Host,
  port: Port,
});

export const UdpTarget = z.strictObject({
  ...targetBase,
  protocol: z.literal('udp'),
  host: Host,
  port: Port,
});

export const HttpTarget = z.strictObject({
  ...targetBase,
  protocol: z.literal('http'),
  baseUrl: z.url({
    protocol: /^https?$/,
    error: 'Expected an http:// or https:// address like http://192.168.1.30:8080',
  }),
});

export const Target = z.discriminatedUnion('protocol', [OscUdpTarget, UdpTarget, HttpTarget]);
export type Target = z.infer<typeof Target>;
export type Protocol = Target['protocol'];

// ---------- Commands ----------

const INT32_MIN = -(2 ** 31);
const INT32_MAX = 2 ** 31 - 1;

/** One OSC argument: 32-bit integer (i), 32-bit float (f) or string (s). */
export const OscArgument = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('i'),
    value: z.int('Expected a whole number').min(INT32_MIN).max(INT32_MAX),
  }),
  z.strictObject({ type: z.literal('f'), value: z.number('Expected a number') }),
  z.strictObject({ type: z.literal('s'), value: z.string() }),
]);
export type OscArgument = z.infer<typeof OscArgument>;

export const OscUdpCommand = z.strictObject({
  type: z.literal('osc-udp'),
  targetId: TargetId,
  address: z.string().regex(/^\/\S*$/, 'Expected an OSC address starting with "/", without spaces'),
  args: z.array(OscArgument),
});

export const UdpCommand = z.strictObject({
  type: z.literal('udp'),
  targetId: TargetId,
  text: z
    .string()
    .min(1, 'Expected some text to send')
    .max(1024, 'Expected at most 1024 characters'),
});

export const HttpCommand = z
  .strictObject({
    type: z.literal('http'),
    targetId: TargetId,
    method: z.enum(['GET', 'POST', 'PUT']),
    path: z.string().startsWith('/', 'Expected a path starting with "/"'),
    body: z.string().nullable(),
  })
  .refine((command) => command.method !== 'GET' || command.body === null, {
    message: 'A GET request cannot have a body',
    path: ['body'],
  });

export const Command = z.discriminatedUnion('type', [OscUdpCommand, UdpCommand, HttpCommand]);
export type Command = z.infer<typeof Command>;
