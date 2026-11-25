// A web page as a page's background (spec PG-7, PG-9, ADR 0024): an online address, checked for
// embedding before it is used, or a mini-site uploaded as a .zip; and the row that shows the one
// in use.
import { type PageId, type WebBackground, WebUrl } from '@tapcue/shared';
import { useEffect, useRef, useState } from 'react';
import { checkEmbed, type EmbedCheck } from '../../lib/embedCheck';
import {
  checkSiteFile,
  type Upload,
  UploadCancelled,
  type UploadedSite,
  uploadSite,
} from '../../lib/uploadAsset';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { TextField } from '../../ui/TextField';
import { setBackground } from '../operations/pages';
import { useEditor } from '../useEditor';

type AddressState =
  | { state: 'idle' }
  | { state: 'checking' }
  /** What the check said about the address in the field, when it was not "ok"; editing forgets it. */
  | { state: 'answered'; check: Unusable };

/** An "ok" is used at once, so only the other answers are ever shown. */
type Unusable = Exclude<EmbedCheck, { result: 'ok' }>;

type SiteState =
  | { state: 'idle' }
  | { state: 'uploading'; name: string; percent: number; upload: Upload<UploadedSite> }
  | { state: 'failed'; message: string };

/**
 * Chooses a web background for one page. The parent keys it by page, so an answer or an upload in
 * progress never lands on another page: leaving the page cancels the upload.
 */
export function WebBackgroundChooser({
  pageId,
  onChosen,
}: {
  pageId: PageId;
  /** A web background was set on the page. */
  onChosen?: () => void;
}) {
  const change = useEditor((state) => state.change);
  const demo = useEditor((state) => state.demo);
  const offline = useEditor((state) => state.connection === 'closed');
  const [address, setAddress] = useState('');
  const [check, setCheck] = useState<AddressState>({ state: 'idle' });
  const [site, setSite] = useState<SiteState>({ state: 'idle' });
  const picker = useRef<HTMLInputElement>(null);

  const running = site.state === 'uploading' ? site.upload : null;
  useEffect(() => () => running?.cancel(), [running]);

  const apply = (background: WebBackground) => {
    change((project) => setBackground(project, pageId, background));
    onChosen?.();
  };

  const trimmed = address.trim();
  const invalid = trimmed !== '' && !WebUrl.safeParse(trimmed).success;

  async function checkAddress() {
    if (trimmed === '' || invalid) return;
    setCheck({ state: 'checking' });
    const answer = await checkEmbed(trimmed);
    // Only an address that can be embedded is used at once (spec PG-9).
    if (answer.result === 'ok') apply({ type: 'web', url: trimmed });
    else setCheck({ state: 'answered', check: answer });
  }

  function upload(file: File) {
    const problem = checkSiteFile(file);
    if (problem) return setSite({ state: 'failed', message: problem });
    const started = uploadSite(file, (percent) =>
      setSite((current) => (current.state === 'uploading' ? { ...current, percent } : current)),
    );
    setSite({ state: 'uploading', name: file.name, percent: 0, upload: started });
    started.done.then(
      (uploaded) => {
        setSite({ state: 'idle' });
        apply({ type: 'web', site: uploaded.site });
      },
      (error: unknown) => {
        if (error instanceof UploadCancelled) setSite({ state: 'idle' });
        else setSite({ state: 'failed', message: (error as Error).message });
      },
    );
  }

  const answer = check.state === 'answered' ? check.check : null;
  const uploadsOff = demo || offline;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <TextField
          label="Online address"
          size="s"
          mono
          placeholder="https://"
          value={address}
          maxLength={2000}
          error={invalid ? 'Expected an address starting with http:// or https://' : null}
          onChange={(value) => {
            setAddress(value);
            if (check.state === 'answered') setCheck({ state: 'idle' });
          }}
          onEnter={() => void checkAddress()}
        />
        <Button
          size="s"
          label={check.state === 'checking' ? 'Checking…' : 'Use address'}
          disabled={trimmed === '' || invalid || check.state === 'checking'}
          onClick={() => void checkAddress()}
        />
        {answer && (
          <CheckAnswer check={answer} onUseAnyway={() => apply({ type: 'web', url: trimmed })} />
        )}
        <p className="text-body-s text-muted">
          An online site needs internet on the stand. Tapcue checks that it allows being shown
          inside another page.
        </p>
      </div>

      <div className="space-y-2 border-t border-default pt-3">
        <p className="text-label-s text-secondary">Or a mini-site</p>
        <input
          ref={picker}
          type="file"
          hidden
          accept=".zip,application/zip"
          data-testid="site-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) upload(file);
          }}
        />
        {site.state === 'uploading' ? (
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-label-m">{site.name}</span>
            <span className="text-body-s text-muted tabular-nums">{site.percent}%</span>
            <Button variant="ghost" size="s" label="Cancel" onClick={site.upload.cancel} />
          </div>
        ) : (
          <Button
            size="s"
            icon="upload"
            label="Upload .zip"
            disabled={uploadsOff}
            title={demo ? 'Uploads are off in demo mode' : offline ? OFFLINE : undefined}
            onClick={() => picker.current?.click()}
          />
        )}
        {site.state === 'failed' && (
          <Banner tone="error" title="Upload failed" onDismiss={() => setSite({ state: 'idle' })}>
            {site.message}
          </Banner>
        )}
        <p className="text-body-s text-muted">
          A folder of HTML pages with an index.html, zipped. It works without internet.
        </p>
      </div>
    </div>
  );
}

const OFFLINE = 'Uploads are paused until the connection to the server is back.';

/** What the check found, and a way on where the answer may be wrong. */
function CheckAnswer({ check, onUseAnyway }: { check: Unusable; onUseAnyway: () => void }) {
  if (check.result === 'blocked') {
    // The browser would show an empty frame: never used.
    return (
      <Banner tone="error" title="This site cannot be shown">
        {capitalize(check.reason)}. Use another address, or the site as a mini-site.
      </Banner>
    );
  }
  // A site on the stand's own network may be off while the stand is set up, and demo mode cannot
  // check: the integrator decides.
  return (
    <div className="space-y-2">
      <Banner
        tone="warning"
        title={
          check.result === 'off'
            ? 'Checking is off in demo mode'
            : 'The address could not be checked'
        }
      >
        {check.result === 'off'
          ? 'The site may refuse to be shown inside another page.'
          : `${capitalize(check.reason)}.`}
      </Banner>
      <Button size="s" label="Use anyway" onClick={onUseAnyway} />
    </div>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The web background in use: where it comes from, with Replace and Remove. */
export function WebBackgroundRow({
  background,
  onReplace,
  onRemove,
}: {
  background: WebBackground;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const label = background.url ?? background.site?.replace(/^assets\/sites\//, '') ?? '';
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded border border-default px-2 py-1.5">
        <Icon name="external" className="h-4 w-4 flex-none text-secondary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-label-m" title={label}>
            {label}
          </p>
          <p className="text-body-s text-muted">{background.url ? 'Online page' : 'Mini-site'}</p>
        </div>
        <Button variant="ghost" size="s" label="Replace" onClick={onReplace} />
        <Button variant="ghost" size="s" label="Remove" onClick={onRemove} />
      </div>
      <p className="text-body-s text-muted">
        Visitors can scroll and tap the site. It moves under the hotspots, so draw them as visible
        buttons near the edges.
      </p>
    </div>
  );
}
