// The Stations tab: one entry point per tablet — a list on the left, the selected station's form,
// and its URL as a QR code to scan with the tablet (spec ST-1, ST-2, ST-6, ED-4, ED-10;
// design: stationsScreen(), qrCard()).
import type { Project, Station } from '@tapcue/shared';
import { useState } from 'react';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import { Segmented } from '../../ui/Segmented';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { useDraft } from '../../ui/useDraft';
import {
  addStation,
  changeStationId,
  checkStationId,
  deleteStation,
  updateStation,
} from '../operations/stations';
import { useEditor } from '../useEditor';
import { StationUrlCard } from './StationUrlCard';

/** On GitHub, so it opens from any editor; the stand network itself may have no internet. */
export const STAND_SETUP_URL =
  'https://github.com/onovokhatski/tapcue/blob/main/docs/stand-setup.md';

export function StationsTab() {
  const project = useEditor((state) => state.project);
  const change = useEditor((state) => state.change);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Changes when another station is chosen, not when this one's id is edited: the form, and its
  // "old URL" warning, belong to the station the integrator opened.
  const [formKey, setFormKey] = useState(0);
  const open = (id: string | null) => {
    setSelectedId(id);
    setFormKey((key) => key + 1);
  };
  if (!project) return null;
  const { stations } = project;
  const selected = stations.find((s) => s.id === selectedId) ?? stations[0];
  const pageName = (pageId: string) => project.pages.find((p) => p.id === pageId)?.name ?? pageId;

  function add() {
    if (!project) return;
    const added = addStation(project);
    change(() => added.project);
    open(added.stationId);
  }

  return (
    <>
      <aside
        aria-label="Stations"
        className="flex w-[264px] flex-none flex-col border-r border-default bg-surface"
      >
        <div className="flex h-11 flex-none items-center justify-between border-b border-default pr-2 pl-4">
          <h2 className="text-label-m">
            Stations <span className="text-body-s text-muted">{stations.length}</span>
          </h2>
          <Button variant="ghost" size="s" icon="plus" label="Add station" onClick={add} />
        </div>
        {stations.length === 0 ? (
          <p className="p-4 text-body-s text-muted">No stations yet.</p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {stations.map((station) => {
              const isSelected = station.id === selected?.id;
              return (
                <li key={station.id}>
                  <button
                    type="button"
                    aria-current={isSelected || undefined}
                    onClick={() => open(station.id)}
                    className={`block w-full rounded border px-3 py-2 text-left ${
                      isSelected
                        ? 'border-selection-border bg-selection'
                        : 'border-transparent hover:bg-hover'
                    }`}
                  >
                    <span className="block text-label-m">{station.name}</span>
                    <span
                      className={`block truncate text-body-s ${isSelected ? 'text-secondary' : 'text-muted'}`}
                    >
                      <span className="font-mono text-mono-s">/play/{station.id}</span> · starts on{' '}
                      {pageName(station.startPageId)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      {selected ? (
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="flex max-w-[1080px] items-start gap-6 p-6">
            <div className="max-w-[600px] min-w-0 flex-1">
              <StationForm
                key={formKey}
                project={project}
                station={selected}
                onIdChanged={setSelectedId}
                onDeleted={() => open(null)}
              />
            </div>
            <div className="space-y-3">
              <StationUrlCard stationId={selected.id} />
              <p className="w-[288px] text-body-s text-secondary">
                Scan with the tablet camera to open the station. For a kiosk, add it to the Home
                Screen and turn on Guided Access: see the{' '}
                <a
                  href={STAND_SETUP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link underline hover:text-link-hover"
                >
                  stand setup guide
                </a>
                .
              </p>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex min-w-0 flex-1 items-center justify-center p-6">
          <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent-strong">
              <Icon name="external" className="h-6 w-6" />
            </span>
            <h2 className="text-heading-l">Add a station for each tablet</h2>
            <p className="text-body-m text-secondary">
              A station is an entry point with its own start page and idle timeout. Each tablet
              opens its station URL, shown as a QR code.
            </p>
            <Button variant="primary" icon="plus" label="Add station" onClick={add} />
          </div>
        </main>
      )}
    </>
  );
}

const checkName = (text: string) =>
  text.trim().length === 0
    ? 'Expected a name'
    : text.trim().length > 100
      ? 'Expected at most 100 characters'
      : null;
const checkSeconds = (text: string) => {
  if (!/^\d+$/.test(text.trim())) return 'Expected a whole number of seconds';
  const seconds = Number(text);
  return seconds < 5 || seconds > 3600 ? 'Expected 5 to 3600 seconds' : null;
};

/** The idle timeout a station gets when "Return to start" is switched on again. */
const DEFAULT_IDLE_SECONDS = 60;

function StationForm({
  project,
  station,
  onIdChanged,
  onDeleted,
}: {
  project: Project;
  station: Station;
  onIdChanged: (id: string) => void;
  onDeleted: () => void;
}) {
  const change = useEditor((state) => state.change);
  const [deleting, setDeleting] = useState(false);
  // The id the station had when it was selected: changing it breaks tablets set up with the old URL.
  const [originalId] = useState(station.id);
  const update = (patch: Parameters<typeof updateStation>[2]) =>
    change((p) => updateStation(p, station.id, patch));

  const name = useDraft(station.name, checkName, (text) => update({ name: text.trim() }));
  const id = useDraft(
    station.id,
    (text) => checkStationId(project, station.id, text.trim()),
    (text) => {
      change((p) => changeStationId(p, station.id, text.trim()));
      onIdChanged(text.trim());
    },
  );
  const seconds = useDraft(
    station.idleTimeoutSeconds === null ? '' : String(station.idleTimeoutSeconds),
    checkSeconds,
    (text) => update({ idleTimeoutSeconds: Number(text) }),
  );

  return (
    <section aria-label={station.name} className="rounded-lg border border-default bg-surface">
      <div className="flex h-12 items-center justify-between border-b border-default px-5">
        <h2 className="text-heading-m">{station.name}</h2>
        <Button
          variant="ghost"
          size="s"
          icon="trash"
          label="Delete station"
          onClick={() => setDeleting(true)}
        />
      </div>
      <div className="space-y-5 p-5">
        <TextField
          label="Name"
          value={name.text}
          error={name.error}
          helper="Shown in the command log."
          maxLength={100}
          onChange={name.onChange}
          onBlur={name.onBlur}
        />
        <TextField
          label="Id"
          mono
          prefix="/play/"
          value={id.text}
          error={id.error}
          helper="Lowercase letters, digits and hyphens. Part of the URL."
          onChange={id.onChange}
          onBlur={id.onBlur}
        />
        {station.id !== originalId && (
          <Banner tone="warning" title="Tablets using the old URL will stop working">
            Changing the id from <span className="font-mono text-mono-s">{originalId}</span> changes
            the station URL. Scan the new QR code on every tablet already set up.
          </Banner>
        )}
        <Select
          label="Start page"
          value={station.startPageId}
          options={project.pages.map((p) => ({ value: p.id, label: p.name }))}
          helper="Where the tablet opens and where it returns after idle."
          onChange={(pageId) => {
            if (pageId) update({ startPageId: pageId });
          }}
        />
        <div className="space-y-1.5">
          <p className="text-label-s text-secondary">Return to start after idle</p>
          <div className="flex items-center gap-2">
            <Segmented
              label="Idle return"
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
              value={station.idleTimeoutSeconds === null ? 'off' : 'on'}
              onChange={(value) =>
                update({ idleTimeoutSeconds: value === 'off' ? null : DEFAULT_IDLE_SECONDS })
              }
            />
            <div className="w-[112px]">
              <NumberField
                suffix="s"
                ariaLabel="Idle seconds"
                value={station.idleTimeoutSeconds === null ? '–' : seconds.text}
                disabled={station.idleTimeoutSeconds === null}
                error={seconds.error !== null}
                onChange={seconds.onChange}
                onBlur={seconds.onBlur}
              />
            </div>
          </div>
          <p className={`text-body-s ${seconds.error ? 'text-danger-fg' : 'text-muted'}`}>
            {seconds.error ?? '5–3600 s. Every tap restarts the timer.'}
          </p>
        </div>
        <p className="text-body-s text-muted">Changes save automatically.</p>
      </div>
      {deleting && (
        <Dialog
          tone="danger"
          title={`Delete station “${station.name}”?`}
          confirmLabel="Delete station"
          onConfirm={() => {
            change((p) => deleteStation(p, station.id));
            onDeleted();
          }}
          onCancel={() => setDeleting(false)}
        >
          <p>
            Tablets that open <span className="font-mono text-mono-s">/play/{station.id}</span> will
            show “Station not found” until a station with that id exists again.
          </p>
        </Dialog>
      )}
    </section>
  );
}
