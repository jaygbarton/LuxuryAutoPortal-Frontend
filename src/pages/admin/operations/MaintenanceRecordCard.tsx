import { useState, type ReactNode } from "react";
import { ChevronDown, Edit, History, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MaintenanceRecordCardProps {
  carName: ReactNode;
  carLabel: string;
  plate?: string | null;
  image?: ReactNode;
  service?: string | null;
  description: string;
  scheduled: string;
  due: string;
  statusControl: ReactNode;
  assigneeControl: ReactNode;
  approval?: ReactNode;
  details: { label: string; value: ReactNode }[];
  notes?: string | null;
  photos?: ReactNode;
  accentBg: string;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
}

/** Keep the maintenance task and its working controls in view; reveal the
 * linked trip, repair details and attachments only when they are needed. */
export function MaintenanceRecordCard({
  carName, carLabel, plate, image, service, description, scheduled, due,
  statusControl, assigneeControl, approval, details, notes, photos, accentBg,
  onEdit, onHistory, onDelete,
}: MaintenanceRecordCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
      <article className="relative min-w-0 overflow-hidden rounded-xl border border-border bg-card" aria-label={`Maintenance for ${carLabel}`}>
        <div className={`absolute inset-y-0 left-0 w-1 ${accentBg}`} />
        <div className="space-y-3 p-3 pl-4 sm:p-4 sm:pl-5">
          <div className="flex items-start gap-3">
            {image && <div className="shrink-0 pt-1">{image}</div>}
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-[15px] font-semibold leading-5 text-foreground">{carName}</h3>
              {plate && <p className="mt-1 break-words text-xs text-muted-foreground">{plate}</p>}
              {service && <p className="mt-1 text-xs font-medium text-muted-foreground">{service}</p>}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="-mr-1 -mt-1 h-11 w-11 shrink-0" aria-label={`More actions for ${carLabel}`}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={onHistory} className="min-h-11">
                  <History /> Edit history
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onDelete} className="min-h-11 text-destructive focus:text-destructive">
                  <Trash2 /> Delete record
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="line-clamp-2 break-words text-sm leading-5 text-foreground">{description || "No maintenance description"}</p>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Scheduled</dt>
              <dd className="mt-1 break-words leading-5">{scheduled}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Due</dt>
              <dd className="mt-1 break-words leading-5">{due}</dd>
            </div>
          </dl>

          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <p className="mb-1 text-xs text-muted-foreground">Assigned to</p>
              {assigneeControl}
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-xs text-muted-foreground">Status</p>
              {statusControl}
            </div>
          </div>
          {approval && <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Owner approval</span>{approval}</div>}

          <div className="flex items-center gap-2 border-t border-border pt-2">
            <Button type="button" variant="outline" onClick={onEdit} className="min-h-11 sm:min-h-9">
              <Edit /> Edit
            </Button>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="min-h-11 min-w-0 flex-1 justify-between px-3 text-muted-foreground sm:min-h-9">
                {expanded ? "Hide details" : "View details"}
                <ChevronDown className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="space-y-4 border-t border-border pt-3">
              <dl className="grid grid-cols-1 gap-x-5 gap-y-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
                {details.map(({ label, value }) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm leading-5">{value}</dd>
                  </div>
                ))}
              </dl>
              {notes && <div><p className="mb-1 text-xs text-muted-foreground">Notes</p><p className="whitespace-pre-wrap break-words text-sm leading-5">{notes}</p></div>}
              {photos && <div><p className="mb-2 text-xs text-muted-foreground">Maintenance photos</p>{photos}</div>}
            </div>
          </CollapsibleContent>
        </div>
      </article>
    </Collapsible>
  );
}
