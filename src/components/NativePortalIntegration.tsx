import { useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { focusManager, onlineManager, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { WifiOff } from "lucide-react";
import { dismissNativeOverlay, installNativeHistory, isNativeRootPath, nativePortalPath, shouldRefreshNativeQuery } from "@/lib/nativePortal";

type NetworkStatus = { connected: boolean };
interface NativeAppPlugin {
  addListener(name: "backButton", listener: (event: { canGoBack: boolean }) => void): Promise<PluginListenerHandle>;
  addListener(name: "appStateChange", listener: (event: { isActive: boolean }) => void): Promise<PluginListenerHandle>;
  addListener(name: "appUrlOpen", listener: (event: { url: string }) => void): Promise<PluginListenerHandle>;
  getLaunchUrl(): Promise<{ url: string } | undefined>;
  minimizeApp(): Promise<void>;
}
interface NativeNetworkPlugin {
  getStatus(): Promise<NetworkStatus>;
  addListener(name: "networkStatusChange", listener: (status: NetworkStatus) => void): Promise<PluginListenerHandle>;
}

const NativeApp = registerPlugin<NativeAppPlugin>("App");
const NativeNetwork = registerPlugin<NativeNetworkPlugin>("Network");

/** The browser website stays unchanged; native bridges are used only inside Capacitor. */
export function NativePortalIntegration() {
  const [, navigate] = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const queryClient = useQueryClient();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const native = Capacitor.isNativePlatform();
    const shell = native || /GLA-Portal-App|Capacitor/i.test(navigator.userAgent);
    document.documentElement.classList.toggle("native-app-shell", shell);
    if (!native) return () => document.documentElement.classList.remove("native-app-shell");

    let disposed = false;
    let wasOffline = !navigator.onLine;
    let wasBackgrounded = false;
    const handles: PluginListenerHandle[] = [];
    const history = installNativeHistory(window);
    const refresh = () => {
      void queryClient.invalidateQueries({ predicate: query => shouldRefreshNativeQuery(query.queryKey), refetchType: "active" });
    };
    const networkChanged = ({ connected }: NetworkStatus) => {
      if (disposed) return;
      setOffline(!connected);
      onlineManager.setOnline(connected);
      if (connected && wasOffline) refresh();
      wasOffline = !connected;
    };
    const listen = (promise: Promise<PluginListenerHandle>) => {
      void promise.then(handle => {
        if (disposed) void handle.remove().catch(() => {});
        else handles.push(handle);
      }).catch(() => {}); // Older app builds may not contain every optional plugin.
    };
    const openLink = ({ url }: { url: string }) => {
      const path = nativePortalPath(url);
      if (!disposed && path) navigateRef.current(path);
    };
    networkChanged({ connected: navigator.onLine });
    const browserOnline = () => networkChanged({ connected: true });
    const browserOffline = () => networkChanged({ connected: false });
    window.addEventListener("online", browserOnline);
    window.addEventListener("offline", browserOffline);

    if (Capacitor.isPluginAvailable("Network")) {
      listen(NativeNetwork.addListener("networkStatusChange", networkChanged));
      void NativeNetwork.getStatus().then(networkChanged).catch(() => {});
    }
    if (Capacitor.isPluginAvailable("App")) {
      listen(NativeApp.addListener("appStateChange", ({ isActive }) => {
        if (disposed) return;
        focusManager.setFocused(isActive);
        if (isActive && wasBackgrounded && onlineManager.isOnline()) refresh();
        wasBackgrounded = !isActive;
      }));
      listen(NativeApp.addListener("appUrlOpen", openLink));
      // A launch link still passes through the ordinary route/auth guards.
      void NativeApp.getLaunchUrl().then(result => { if (result) openLink(result); }).catch(() => {});
      if (Capacitor.getPlatform() === "android") {
        listen(NativeApp.addListener("backButton", ({ canGoBack }) => {
          if (disposed || dismissNativeOverlay(document)) return;
          if (canGoBack && history.canGoBack() && !isNativeRootPath(window.location.pathname)) window.history.back();
          else void NativeApp.minimizeApp().catch(() => {});
        }));
      }
    }

    return () => {
      disposed = true;
      handles.forEach(handle => { void handle.remove().catch(() => {}); });
      history.dispose();
      window.removeEventListener("online", browserOnline);
      window.removeEventListener("offline", browserOffline);
      focusManager.setFocused(undefined);
      onlineManager.setOnline(navigator.onLine);
      document.documentElement.classList.remove("native-app-shell");
    };
  }, [queryClient]);

  if (!offline) return null;
  return (
    <div role="status" aria-live="polite" data-native-offline className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[4500] mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg">
      <WifiOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div><p className="font-semibold">You’re offline</p><p className="mt-0.5 text-xs leading-relaxed">Reconnect before submitting. Keep this screen open to retain unsaved entries.</p></div>
    </div>
  );
}
