import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link,Redirect,useLocation} from 'wouter';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {lycNext,lycRequest} from '@/lib/lyc';

export default function Signup() {
  const [,setLocation]=useLocation(),client=useQueryClient();
  const next=lycNext(new URLSearchParams(window.location.search).get('next'));
  const auth=useQuery({queryKey:['/api/auth/me'],queryFn:()=>lycRequest('/api/auth/me')});
  const [values,setValues]=useState({firstName:'',lastName:'',email:'',phoneOwner:'',password:'',confirmPassword:''});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  if(auth.data?.user) return <Redirect to={next}/>;
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setError('');
    if(values.password!==values.confirmPassword){setError('Passwords do not match.');return;}
    setBusy(true);
    let created=false;
    try {
      await lycRequest('/api/auth/signup','POST',{firstName:values.firstName.trim(),lastName:values.lastName.trim(),email:values.email.trim(),password:values.password});
      created=true;
      const login=await lycRequest('/api/auth/login','POST',{email:values.email.trim(),password:values.password});
      client.clear();client.setQueryData(['/api/auth/me'],{user:login.user});
      if(values.phoneOwner) await lycRequest('/api/lyc/profile','PATCH',{phoneOwner:values.phoneOwner});
      setLocation(next);
    } catch(e:any) {setError(created?'Your account was created. Sign in below to continue; do not create a second account.':e.message);}
    finally{setBusy(false);}
  };
  return <main className="mx-auto min-h-screen max-w-lg px-4 py-8 sm:py-12">
    <Link href="/"><img src="/logo.png" alt="Golden Luxury Auto" className="mx-auto mb-6 h-20 w-60 object-contain"/></Link>
    <h1 className="text-2xl font-semibold">Create your account</h1>
    <p className="mb-6 mt-2 text-muted-foreground">For future bookings or the List Your Car program. Save your details now and complete your LYC steps whenever you’re ready.</p>
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {([{key:'firstName',label:'First name',type:'text',auto:'given-name'},{key:'lastName',label:'Last name',type:'text',auto:'family-name'},{key:'email',label:'Email',type:'email',auto:'email'},{key:'phoneOwner',label:'Phone (optional)',type:'tel',auto:'tel'},{key:'password',label:'Choose a password',type:'password',auto:'new-password'},{key:'confirmPassword',label:'Confirm password',type:'password',auto:'new-password'}] as const).map(field=><label key={field.key} className="text-sm">{field.label}<Input className="mt-1" type={field.type} autoComplete={field.auto} required={field.key!=='phoneOwner'} minLength={field.type==='password'?8:undefined} maxLength={field.type==='password'?128:254} value={values[field.key]} onChange={e=>setValues({...values,[field.key]:e.target.value})}/></label>)}
      <p className="text-sm text-muted-foreground sm:col-span-2">Use at least 8 characters for your password. Your initial workspace contains your profile and LYC progress; client access follows application approval and contract signing.</p>
      {error&&<p role="alert" className="text-destructive sm:col-span-2">{error}</p>}
      <Button className="sm:col-span-2" disabled={busy||auth.isLoading}>{busy?'Creating your account…':'Create account & continue'}</Button>
    </form>
    <p className="mt-6 text-sm">Already have an account? <Link className="underline" href={`/admin/login?next=${encodeURIComponent(next)}`}>Sign in to continue</Link></p>
  </main>;
}
