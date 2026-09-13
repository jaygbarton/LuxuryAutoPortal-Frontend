const refreshUrl = new URL(window.location.href);
refreshUrl.searchParams.set("appRefresh", String(Date.now()));
window.location.replace(refreshUrl.toString());

export default function StaleDashboardRouter() {
  return null;
}
