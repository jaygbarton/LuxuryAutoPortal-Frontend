import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CUSTOMER_HELP_PUBLIC_PATHS, CUSTOMER_HELP_OPERATIONS_TABS, customerHelpAllowed } from './customerHelpRoutes';
import { GHL_NATIVE_WIDGET_CONFIG, GHL_LOCAL_PREVIEW_CONFIG, GHL_PUBLIC_EMBED, getGhlWidgetConfig, localChatPreviewAllowed } from './ghlNativeWidget';
const owner = { isClient: true };
const cohost = { isCoHost: true, isAdmin: true };
describe('customer help visibility does not grant access', () => {
  it('enables exactly the verified public config without a preview opt-in', () => {
    expect(GHL_NATIVE_WIDGET_CONFIG).toBe(GHL_LOCAL_PREVIEW_CONFIG);
    expect(GHL_NATIVE_WIDGET_CONFIG).toEqual(GHL_PUBLIC_EMBED);
    expect(getGhlWidgetConfig()).toBe(GHL_NATIVE_WIDGET_CONFIG);
  });
  it('uses the supplied public embed unchanged', () => {
    expect(GHL_PUBLIC_EMBED).toEqual({
      scriptUrl: 'https://widgets.leadconnectorhq.com/loader.js',
      attributes: {
        'data-resources-url': 'https://widgets.leadconnectorhq.com/chat-widget/loader.js',
        'data-widget-id': '6adbf3186c0798678b00aa14',
      },
    });
  });
  it('permits preview only in a development build on loopback hosts', () => {
    for (const host of ['localhost','127.0.0.1','[::1]']) {
      expect(localChatPreviewAllowed(true,host)).toBe(true);
      expect(localChatPreviewAllowed(false,host)).toBe(false);
    }
    for (const host of ['goldenluxuryauto.com','www.goldenluxuryauto.com','example.replit.dev','localhost.example.com']) {
      expect(localChatPreviewAllowed(true,host)).toBe(false);
      expect(localChatPreviewAllowed(false,host)).toBe(false);
    }
  });
  it('covers every public route actually registered in App.tsx', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    for (const [,path] of app.matchAll(/<PublicRoute path="([^"]+)"/g)) expect(CUSTOMER_HELP_PUBLIC_PATHS).toContain(path);
    for (const path of CUSTOMER_HELP_PUBLIC_PATHS) expect(app).toContain(`path="${path}"`);
    for (const path of CUSTOMER_HELP_PUBLIC_PATHS) expect(customerHelpAllowed(path)).toBe(true);
  });
  it('covers shared login, token links, and public navigation with queries/trailing slashes', () => {
    for (const path of ['/admin/login','/reset-password?token=secret','/sign-contract/opaque','/maintenance-approval/opaque','/fleet/?location=slc']) expect(customerHelpAllowed(path)).toBe(true);
  });
  it('covers owner pages under admin URLs without enabling staff screens', () => {
    for (const path of ['/dashboard','/cars','/client/trip-history','/admin/cars/7/records/9/files','/admin/cars/7/income-expense','/admin/forms?section=document-updates']) expect(customerHelpAllowed(path,owner)).toBe(true);
    for (const path of ['/admin/operations','/client/maintenance-history','/admin/cars/7/maintenance','/admin/cars/7/income-expense/log','/admin/hr/time','/admin/developer','/staff/dashboard','/unknown']) expect(customerHelpAllowed(path,owner)).toBe(false);
  });
  it('recognizes co-host roles even with admin flags; excludes operational staff screens', () => {
    for (const path of ['/dashboard','/admin/my-co-host-cars','/admin/co-host-payments','/admin/trip-calendar','/admin/bouncie','/cohost/training-manual']) expect(customerHelpAllowed(path,cohost)).toBe(true);
    for (const path of ['/admin/admins','/admin/hr','/admin/payroll']) expect(customerHelpAllowed(path,cohost)).toBe(false);
  });
  it('covers existing Operations vehicle tabs and admin profile only for already-authorized customer contexts', () => {
    const contexts = [cohost, {isClient:true,isAdmin:true}, {isAdmin:true,viewAsCoHost:{coHostId:2}}, {isAdmin:true,viewAsClient:{clientId:2}}];
    for (const user of contexts) {
      for (const path of ['/admin/profile', '/admin/operations', ...CUSTOMER_HELP_OPERATIONS_TABS.map(tab=>`/admin/operations?location=slc&tab=${tab}`)]) {
        expect(customerHelpAllowed(path,user),path).toBe(true);
      }
      for (const path of ['/admin/profiles','/admin/profile/edit','/admin/operations/private','/admin/operations?tab=payroll','/admin/operations?tab=unknown','/admin/hr/time','/admin/payroll','/admin/admins','/admin/developer']) {
        expect(customerHelpAllowed(path,user),path).toBe(false);
      }
    }
  });
  it('does not give these shared admin routes chat for staff, client-only, unresolved or employee-preview sessions', () => {
    for (const user of [undefined, {}, owner, {isCoHost:true}, {isAdmin:true}, {isEmployee:true}, {isAdmin:true,isEmployee:true}, {isSuperAdmin:true}, {...cohost,viewAsEmployee:{employeeId:3}}, {isClient:true,viewAsClient:{clientId:2}}]) {
      for (const path of ['/admin/profile','/admin/operations','/admin/operations?tab=maintenance']) expect(customerHelpAllowed(path,user)).toBe(false);
    }
    expect(customerHelpAllowed('/profile',owner)).toBe(true);
  });
  it('keeps the explicit Operations chat tabs aligned with the existing vehicle workflow page', () => {
    const page = readFileSync(new URL('../pages/admin/operations.tsx', import.meta.url), 'utf8');
    const tabs = JSON.parse(page.match(/const TAB_IDS = (\[[^\n]+\]) as const;/)![1]);
    expect([...CUSTOMER_HELP_OPERATIONS_TABS]).toEqual(tabs);
  });
  it('is hidden for unresolved/logged-out sessions, normal staff and employee previews', () => {
    for (const user of [undefined,{}, {isAdmin:true}, {isEmployee:true}, {isSuperAdmin:true}, {...owner,isAdmin:true}, {...owner,viewAsEmployee:{employeeId:3}}]) expect(customerHelpAllowed('/dashboard',user)).toBe(false);
    expect(customerHelpAllowed('/dashboard',{isAdmin:true,viewAsClient:{clientId:2}})).toBe(true);
    expect(customerHelpAllowed('/admin/co-host-profile',{isAdmin:true,viewAsCoHost:{coHostId:2}})).toBe(true);
  });
});
