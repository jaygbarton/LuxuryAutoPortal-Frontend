import {describe,it,expect} from 'vitest';
import {organizeSidebar,activeSidebarItems,type SidebarItem} from '../sidebar-navigation';
const item=(label:string,href:string,children?:SidebarItem[]):SidebarItem=>({label,href,children,icon:()=>null});
const ops=[item('Day Schedule','/admin/operations?tab=day-schedule'),item('Car Block Off','/admin/operations?tab=car-block-off'),item('Maintenance','/admin/operations?tab=maintenance'),item('Service Due','/admin/operations?tab=service-due')];
const source=[item('Dashboard','/dashboard'),item('Admins','/admin/admins'),item('Co-Hosts','/admin/co-hosts',[item('Co-Hosts','/admin/co-hosts'),item('My Co-Host Cars','/admin/my-co-host-cars')]),item('Applicants','/admin/applicants'),item('Clients','/admin/clients'),item('Cars','/cars'),item('AI Hub','/admin/ai-hub'),item('Turo Trips','/admin/turo-trips'),item('BOUNCIE','/admin/bouncie',[item('Fleet Tracking','/admin/bouncie'),item('Devices','/admin/bouncie-devices')]),item('Operations','/admin/operations',ops),item('Car Block Off','/admin/car-block-off'),{...item('Car Rental','https://turo.com/host'),external:true},item('Rental Listings','/admin/rental-listings'),item('Turo Guide','/admin/turo-guide'),item('System Tutorial','/admin/training-manual'),item('Client Testimonials','/admin/testimonials'),item('News & Media','/admin/news-media'),item('Notice Board','/admin/notice-board')];
const leaves=(items:SidebarItem[]):SidebarItem[]=>items.flatMap(item=>item.children?leaves(item.children):[item]);
describe('organized authorized sidebar',()=>{
 it('groups accounts and system pages, nests vehicle tools, and preserves external links and nested co-host links',()=>{
  const result=organizeSidebar(source),find=(label:string)=>result.find(item=>item.label===label)!;
  expect(find('Accounts').children?.map(item=>item.label)).toEqual(['Admins','Co-Hosts','Applicants','Clients']);
  expect(find('Accounts').children?.[1].children?.map(item=>item.label)).toContain('My Co-Host Cars');
  expect(find('System').children?.map(item=>item.label)).toEqual(['Turo Guide','System Tutorial','Client Testimonials','News & Media','Notice Board','AI Hub']);
  expect(find('Cars').children?.map(item=>item.label)).toEqual(['All Cars','BOUNCIE','Car Rental']);
  expect(find('Cars').children?.at(-1)?.external).toBe(true);
  expect(find('Operations').children?.map(item=>item.label)).toEqual(['Day Schedule','Car Block Off','Maintenance','Service Due','Turo Trips']);
  expect(result.map(item=>item.label)).not.toContain('Car Block Off');
  expect(leaves(result).map(item=>item.href)).not.toContain('/admin/rental-listings');
  expect(source.find(item=>item.label==='Cars')?.children).toBeUndefined();
 });
 it('groups only existing authorized entries, without granting car/account/admin pages to staff or clients',()=>{
  const staff=[item('Operations','/admin/operations',ops),source.find(item=>item.label==='BOUNCIE')!,item('System Tutorial','/staff/training-manual')];
  const result=organizeSidebar(staff);
  expect(result.map(item=>item.label)).toEqual(['Operations','Cars','System']);
  expect(leaves(result).map(item=>item.href)).not.toContain('/cars');
  expect(result.some(item=>item.label==='Accounts')).toBe(false);
  expect(leaves(result).map(item=>item.href)).not.toContain('/admin/ai-hub');
 });
 it('opens every ancestor of deep Bouncie and co-host links and highlights only the destination',()=>{
  const result=organizeSidebar(source);
  const devices=activeSidebarItems(result,'/admin/bouncie-devices');
  expect([...devices.groups]).toEqual(['/admin/bouncie','/cars']);expect([...devices.leaves]).toEqual(['/admin/bouncie-devices']);
  const cars=activeSidebarItems(result,'/admin/my-co-host-cars');
  expect([...cars.groups]).toEqual(['/admin/co-hosts','#accounts']);expect([...cars.leaves]).toEqual(['/admin/my-co-host-cars']);
 });
 it('keeps Operations query matching separate from the Turo Trips page and external links',()=>{
  const result=organizeSidebar(source);
  expect([...activeSidebarItems(result,'/admin/operations','tab=maintenance').leaves]).toEqual(['/admin/operations?tab=maintenance']);
  expect([...activeSidebarItems(result,'/admin/operations').leaves]).toEqual(['/admin/operations?tab=day-schedule']);
  expect([...activeSidebarItems(result,'/admin/turo-trips','tab=earnings').leaves]).toEqual(['/admin/turo-trips']);
  expect(activeSidebarItems(result,'/dashboard').groups.size).toBe(0);
 });
});
