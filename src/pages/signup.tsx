import { useQuery } from '@tanstack/react-query';
import { Link, Redirect } from 'wouter';
import { CreateAccountForm } from '@/components/auth/CreateAccountForm';
import { lycNext, lycRequest } from '@/lib/lyc';

export default function Signup() {
  const next = lycNext(new URLSearchParams(window.location.search).get('next'));
  const auth = useQuery({ queryKey: ['/api/auth/me'], queryFn: () => lycRequest('/api/auth/me') });
  if (auth.data?.user) return <Redirect to={next} />;
  return <main className="mx-auto min-h-screen max-w-lg px-4 py-8 sm:py-12">
    <Link href="/"><img src="/logo.png" alt="Golden Luxury Auto" className="mx-auto mb-6 h-20 w-60 object-contain" /></Link>
    <CreateAccountForm next={next} />
  </main>;
}
