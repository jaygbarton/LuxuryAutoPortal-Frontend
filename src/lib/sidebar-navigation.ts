import {Car,Settings,Users} from 'lucide-react';

export interface SidebarItem {
  href:string;
  label:string;
  icon:any;
  roles?:('admin'|'client'|'employee'|'cohost')[];
  children?:SidebarItem[];
  external?:boolean;
  superAdminOnly?:boolean;
}

/** Group only already-authorized entries, retaining their children and URLs. */
export function organizeSidebar(items:SidebarItem[]):SidebarItem[] {
  const accountLabels=new Set(['Admins','Co-Hosts','Applicants','Clients']);
  const systemLabels=new Set(['Turo Guide','System Tutorial','Client Testimonials','News & Media','Notice Board','AI Hub']);
  const accounts=items.filter(item=>accountLabels.has(item.label));
  const system=[...systemLabels].flatMap(label=>items.filter(item=>item.label===label));
  const systemAnchor=system.find(item=>item.label!=='AI Hub')??system[0];
  const cars=items.find(item=>item.label==='Cars');
  const vehicleTools=items.filter(item=>['BOUNCIE','Car Rental','My Co-Host Cars'].includes(item.label));
  const turo=items.find(item=>item.label==='Turo Trips');
  const result:SidebarItem[]=[];
  let insertedCars=false;
  for(const item of items) {
    if(item.label==='Rental Listings'||item.href==='/admin/car-block-off')continue;
    if(accountLabels.has(item.label)) {
      if(item===accounts[0])result.push({href:'#accounts',label:'Accounts',icon:Users,children:accounts});
      continue;
    }
    if(systemLabels.has(item.label)) {
      if(item===systemAnchor)result.push({href:'#system',label:'System',icon:Settings,children:system});
      continue;
    }
    if(item===cars||vehicleTools.includes(item)) {
      if(!insertedCars) {
        const fleet=cars?(cars.children??[{...cars,label:'All Cars'}]):[];
        result.push({href:'/cars',label:'Cars',icon:Car,children:[...fleet,...vehicleTools]});
        insertedCars=true;
      }
      continue;
    }
    if(item===turo)continue;
    if(item.label==='Operations'&&turo) {
      const children=[...(item.children??[])];children.splice(4,0,turo);
      result.push({...item,children});continue;
    }
    result.push(item);
  }
  return result;
}

export function isSidebarPathActive(pathname:string,href:string,currentSearch='',tabKey?:string,isDefaultChild=false):boolean {
  const [hrefPath,hrefQuery]=href.split('?');
  const params=new URLSearchParams(currentSearch);
  if(hrefQuery!=null) {
    if(pathname!==hrefPath)return false;
    const wanted=[...new URLSearchParams(hrefQuery).entries()];
    if(!wanted.length)return isDefaultChild;
    let sawParam=false;
    for(const [key,value] of wanted) {
      const current=params.get(key);if(current===null)continue;
      sawParam=true;if(current!==value)return false;
    }
    return sawParam?true:isDefaultChild;
  }
  if(pathname===hrefPath)return tabKey?!params.get(tabKey):true;
  return hrefPath!=='/dashboard'&&pathname.startsWith(hrefPath+'/');
}

/** Shared with the renderer so deep links open every ancestor, not sibling groups. */
export function activeSidebarItems(items:SidebarItem[],pathname:string,search='') {
  const matched=new Set<string>();
  function collect(siblings:SidebarItem[]) {
    siblings.forEach((item,index)=>{
      if(item.external)return;
      if(item.children?.length){collect(item.children);return;}
      const samePage=siblings.filter(sibling=>sibling.href.split('?')[0]===item.href.split('?')[0]);
      const tabKey=samePage.map(sibling=>sibling.href.split('?')[1]).find(Boolean)?.split('=')[0];
      if(isSidebarPathActive(pathname,item.href,search,tabKey,index===0))matched.add(item.href);
    });
  }
  collect(items);
  // Prefix matching lets /admin/payroll claim /admin/payroll/commissions too.
  // When a more specific item matched, it alone is the active one.
  const pathOf=(href:string)=>href.split('?')[0];
  const leaves=new Set([...matched].filter(href=>![...matched].some(other=>pathOf(other).startsWith(pathOf(href)+'/'))));
  const groups=new Set<string>();
  function mark(siblings:SidebarItem[]):boolean {
    let any=false;
    for(const item of siblings) {
      if(item.children?.length){if(mark(item.children)){groups.add(item.href);any=true;}}
      else if(leaves.has(item.href))any=true;
    }
    return any;
  }
  mark(items);return {groups,leaves};
}
