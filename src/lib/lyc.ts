import { buildApiUrl } from './queryClient';
export const personalFields = ['tshirtSize','phoneOwner','representative','heardAboutUs','streetAddress','city','state','zipCode','birthday','emergencyContactName','emergencyContactPhone'];
export const questionnaireFields = ['acquisitionPlan','knowsPlannedCar','plannedVehicleYear','plannedVehicleMake','plannedVehicleModel','requirementsAcknowledged'];
export const applicantUser = (user:any) => !!user && (user.isApplicant === true || user.roleName === 'LYC Applicant');
export async function lycRequest(path:string,method='GET',body?:unknown) {
  const response=await fetch(buildApiUrl(path),{method,credentials:'include',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error || result.message || 'Unable to save. Please try again.');
  return result;
}
/** Keep login/signup continuation local and limited to the onboarding workspace. */
export function lycNext(value:string|null, fallback='/lyc/status') {
  if(!value) return fallback;
  return /^\/(?:onboarding|salt-lake-city\/onboarding|wilmington-nc\/onboarding|lyc\/(?:status|profile|records))(?:\?[^#]*)?$/.test(value) ? value : fallback;
}
