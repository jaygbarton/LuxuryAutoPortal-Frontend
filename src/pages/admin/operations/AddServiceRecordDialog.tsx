import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExpenseFormSubmission from '../forms/ExpenseFormSubmission';
import type { ServiceCar } from '@/lib/serviceWorkspace';
export function AddServiceRecordDialog({ car, onClose, onSaved }: { car: ServiceCar; onClose: () => void; onSaved: () => void }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader className="pr-6 text-left"><DialogTitle>Add service record</DialogTitle><DialogDescription>{car.car_name} · {car.car_plate || 'No plate'} · VIN {car.car_vin || 'not recorded'}</DialogDescription></DialogHeader>
    <ExpenseFormSubmission initialCategory="cogs" initialCarId={car.car_id} initialServiceKind={car.nextService?.kind === 'registration' ? 'license_registration' : car.nextService?.kind || undefined} serviceOnly onSubmitted={() => { onSaved(); onClose(); }} />
  </DialogContent></Dialog>;
}
