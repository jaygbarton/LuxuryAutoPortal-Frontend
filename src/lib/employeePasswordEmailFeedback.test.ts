import {expect,it} from 'vitest';
import {employeePasswordEmailFeedback} from './employeePasswordEmailFeedback';
it('shows the email failure even though approval succeeded',()=>{
 expect(employeePasswordEmailFeedback('Approved',{status:'failed',message:'Delivery disabled'})).toEqual({title:'Approved; password email needs attention',description:'Delivery disabled',variant:'destructive'});
});
it('retains the provider acceptance wording without claiming inbox delivery',()=>{
 expect(employeePasswordEmailFeedback('Approved',{status:'accepted',message:'Accepted by provider; delivery not confirmed'})).toMatchObject({description:'Accepted by provider; delivery not confirmed',variant:'default'});
});
it('supports pending creation without claiming a password email was sent',()=>{
 expect(employeePasswordEmailFeedback('Created')).toEqual({title:'Created',description:'Employee created successfully.',variant:'default'});
});
