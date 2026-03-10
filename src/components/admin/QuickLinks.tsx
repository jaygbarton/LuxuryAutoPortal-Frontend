import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, FileText, HelpCircle, ClipboardList, Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";

interface QuickLink {
  id: number;
  category: string;
  title: string;
  url: string;
  visibleToAdmins: boolean;
  visibleToClients: boolean;
  visibleToEmployees: boolean;
  createdAt: string;
}

const categoryIcons: Record<string, any> = {
  "Reports Center": FileText,
  "Support Center": HelpCircle,
  "Forms Center": ClipboardList,
};

const categoryColors: Record<string, string> = {
  "Reports Center": "text-blue-700",
  "Support Center": "text-green-700",
  "Forms Center": "text-purple-400",
};

export default function QuickLinks() {
  const { data: quickLinks, isLoading } = useQuery<QuickLink[]>({
    queryKey: ["/api/quick-links"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/quick-links"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch quick links");
      const data = await response.json();
      return data.quickLinks ?? [];
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-[#EAEB80]" />
      </div>
    );
  }

  if (!quickLinks || quickLinks.length === 0) {
    return null;
  }

  // Group links by category
  const groupedLinks = quickLinks.reduce((acc, link) => {
    if (!acc[link.category]) {
      acc[link.category] = [];
    }
    acc[link.category].push(link);
    return acc;
  }, {} as Record<string, QuickLink[]>);

  // Get categories that have visible links
  const categoriesWithLinks = Object.keys(groupedLinks).filter(
    (category) => groupedLinks[category].length > 0
  );

  // If no categories have links, show nothing
  if (categoriesWithLinks.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {categoriesWithLinks.map((category) => {
        const links = groupedLinks[category];
        const Icon = categoryIcons[category] || ExternalLink;
        const iconColor = categoryColors[category] || "text-[#EAEB80]";

        return (
          <Card key={category} className="bg-card border-border hover:border-primary/40 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Icon className={`w-5 h-5 ${iconColor}`} />
                {category}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#EAEB80] transition-colors group"
                    >
                      <span className="flex-1 truncate">{link.title}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

