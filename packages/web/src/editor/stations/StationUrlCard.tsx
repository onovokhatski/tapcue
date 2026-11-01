// A station's URL for the tablets, as a QR code to scan, with Copy and Open (spec ST-6;
// design: qrCard()). The address is this computer's on the stand network (GET /api/network); the
// port is the one this editor is served on, which is the one a tablet must use.
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Select } from '../../ui/Select';
import { type LocalAddress, useNetworkAddresses } from './useNetworkAddresses';

/** `http://192.168.1.40:5173/play/main`; without a network address, the editor's own host. */
export function stationUrl(
  stationId: string,
  address: string | undefined,
  location: Pick<Location, 'protocol' | 'hostname' | 'port'>,
) {
  const host = address ?? location.hostname;
  const port = location.port ? `:${location.port}` : '';
  return `${location.protocol}//${host}${port}/play/${stationId}`;
}

export function StationUrlCard({ stationId }: { stationId: string }) {
  const addresses = useNetworkAddresses();
  const [chosen, setChosen] = useState<string | null>(null);
  /** The URL last copied; "Copied" shows only while it is still the URL on screen. */
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const address = addresses.find((a) => a.address === chosen) ?? addresses[0];
  const url = stationUrl(stationId, address?.address, window.location);
  const copied = copiedUrl === url;

  useEffect(() => {
    let current = true;
    void QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then((svg) => {
      if (current) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    });
    return () => {
      current = false;
    };
  }, [url]);

  return (
    <div className="w-[288px] rounded-xl border border-default bg-surface p-5 shadow-1">
      <p className="text-overline text-muted uppercase">Station URL</p>
      <div className="mx-auto my-4 w-[176px] rounded-lg bg-white p-3">
        {qr && <img src={qr} alt={`QR code for ${url}`} className="block aspect-square w-full" />}
      </div>
      <p className="font-mono text-mono-s break-all text-primary" data-testid="station-url">
        {url}
      </p>
      {addresses.length > 1 && (
        <div className="mt-3">
          <Select
            label="Network"
            size="s"
            value={address?.address ?? null}
            options={addresses.map((a: LocalAddress) => ({
              value: a.address,
              label: `${a.address} · ${a.interface}`,
            }))}
            onChange={setChosen}
          />
        </div>
      )}
      {addresses.length === 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-body-s text-secondary">
          <Icon name="alert" className="mt-px h-3.5 w-3.5 text-warning-solid" />
          <span>
            No network address found. Connect this computer to the stand network so tablets can
            reach it.
          </span>
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {copied ? (
          <span className="inline-flex h-8 items-center justify-center gap-2 rounded border border-success-border bg-success-bg px-3 text-label-m text-success-fg">
            <Icon name="check" />
            Copied
          </span>
        ) : (
          <Button
            icon="copy"
            label="Copy"
            className="justify-center"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(() => setCopiedUrl(url));
            }}
          />
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center justify-center gap-2 rounded border border-strong bg-surface px-3 text-label-m text-primary hover:bg-hover"
        >
          <Icon name="external" />
          Open
        </a>
      </div>
      {copied && (
        <p role="status" className="mt-2 text-body-s text-muted">
          URL copied to the clipboard.
        </p>
      )}
    </div>
  );
}
