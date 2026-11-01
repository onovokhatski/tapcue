// This computer's addresses on the local network, from GET /api/network (spec ST-6).
import { useEffect, useState } from 'react';

export interface LocalAddress {
  address: string;
  interface: string;
}

/** Empty until the answer arrives, and when there is no network (or the request fails). */
export function useNetworkAddresses(): LocalAddress[] {
  const [addresses, setAddresses] = useState<LocalAddress[]>([]);
  useEffect(() => {
    let current = true;
    fetch('/api/network')
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ addresses: LocalAddress[] }>)
          : { addresses: [] },
      )
      .then((body) => {
        if (current) setAddresses(body.addresses);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);
  return addresses;
}
