import { useLayoutEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { authMeQueryFn } from '@/lib/queryClient';
import { customerHelpAllowed, customerHelpTeaserAllowed, type CustomerHelpUser } from '@/lib/customerHelpRoutes';
import { getGhlWidgetConfig, updateGhlNativeWidget, type GhlNativeWidgetConfig } from '@/lib/ghlNativeWidget';

function ConfiguredCustomerHelpWidget({ config }: { config: GhlNativeWidgetConfig }) {
  const [location] = useLocation();
  const search = useSearch();
  // Subscribe to the app's existing session cache; never start an auth request.
  const { data, isError } = useQuery<{ user?: CustomerHelpUser }>({ queryKey: ['/api/auth/me'], queryFn: authMeQueryFn, enabled: false });
  const allowed = customerHelpAllowed(`${location}${search ? `?${search}` : ''}`, isError ? null : data?.user);
  useLayoutEffect(() => {
    updateGhlNativeWidget(document, config, allowed, customerHelpTeaserAllowed(location));
    return () => updateGhlNativeWidget(document, config, false);
  }, [allowed, location, search, config]);
  return null;
}

/** Mounted once outside individual layouts. Disabled means no UI or requests. */
export function CustomerHelpWidget() {
  useLocation(); // Re-evaluate an explicit local preview toggle on navigation.
  useSearch(); // Query-only preview toggles can keep the same pathname.
  const config = getGhlWidgetConfig();
  return config ? <ConfiguredCustomerHelpWidget config={config} /> : null;
}
