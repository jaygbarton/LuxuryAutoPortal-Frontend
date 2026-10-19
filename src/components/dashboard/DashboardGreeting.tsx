import { useQuery } from "@tanstack/react-query";
import { authMeQueryFn } from "@/lib/queryClient";

export function DashboardGreeting() {
  const { data } = useQuery<{ user?: {
    firstName?: string;
    name?: string;
    viewAsEmployee?: { employeeName?: string };
  } }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const user = data?.user;
  const name = user?.viewAsEmployee?.employeeName?.trim() || user?.firstName?.trim() || user?.name?.trim();
  return <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Hello{name ? `, ${name}` : ""}</h1>;
}
