import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { BouncieConnectionBanner } from "@/components/admin/BouncieConnectionBanner";

interface BouncieDevice {
  id: string;
  imei: string;
  nickname?: string;
  carId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  liveData?: any;
}

interface GlaCar {
  id: string;
  label: string;
  make: string;
  model: string;
  year: string;
  plate: string;
}

interface AddDeviceData {
  imei: string;
  nickname?: string;
  carId?: string;
}

interface UpdateDeviceData {
  nickname?: string;
  carId?: string;
  isActive?: boolean;
}

const UNASSIGNED = "__none__";

export default function BouncieDevicesPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState<BouncieDevice | null>(null);
  const [addFormData, setAddFormData] = useState<AddDeviceData>({ imei: "", nickname: "", carId: "" });
  const [editFormData, setEditFormData] = useState<UpdateDeviceData>({ nickname: "", carId: "", isActive: true });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch devices
  const { data: devicesData, isLoading, error } = useQuery<{ success: boolean; data: BouncieDevice[] }>({
    queryKey: ["/api/bouncie/devices"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/bouncie/devices"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch devices");
      return res.json();
    },
  });

  // Fetch GLA cars for picker
  const { data: carsData } = useQuery<{ success: boolean; data: GlaCar[] }>({
    queryKey: ["/api/bouncie/cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/bouncie/cars"), { credentials: "include" });
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
  });
  const cars = carsData?.data ?? [];

  // Add device
  const addDeviceMutation = useMutation({
    mutationFn: async (data: AddDeviceData) => {
      const res = await fetch(buildApiUrl("/api/bouncie/devices"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add device");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/devices"] });
      setShowAddDialog(false);
      setAddFormData({ imei: "", nickname: "", carId: "" });
      toast({ title: "Success", description: "Device added successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Update device
  const updateDeviceMutation = useMutation({
    mutationFn: async ({ deviceId, data }: { deviceId: string; data: UpdateDeviceData }) => {
      const res = await fetch(buildApiUrl(`/api/bouncie/devices/${deviceId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update device");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/devices"] });
      setEditingDevice(null);
      toast({ title: "Success", description: "Device updated successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Delete device
  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await fetch(buildApiUrl(`/api/bouncie/devices/${deviceId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete device");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/devices"] });
      toast({ title: "Success", description: "Device deleted successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleAddDevice = () => {
    if (!addFormData.imei.trim()) {
      toast({ title: "Error", description: "IMEI is required", variant: "destructive" });
      return;
    }
    if (!/^\d{15}$/.test(addFormData.imei.replace(/\s/g, ""))) {
      toast({ title: "Error", description: "IMEI must be exactly 15 digits", variant: "destructive" });
      return;
    }
    addDeviceMutation.mutate({ ...addFormData, imei: addFormData.imei.replace(/\s/g, "") });
  };

  const handleEditDevice = (device: BouncieDevice) => {
    setEditingDevice(device);
    setEditFormData({ nickname: device.nickname || "", carId: device.carId || "", isActive: device.isActive });
  };

  const handleUpdateDevice = () => {
    if (!editingDevice) return;
    updateDeviceMutation.mutate({ deviceId: editingDevice.id, data: editFormData });
  };

  const handleDeleteDevice = (deviceId: string) => {
    if (confirm("Are you sure you want to delete this device?")) {
      deleteDeviceMutation.mutate(deviceId);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const carLabel = (carId?: string) => {
    if (!carId) return "-";
    const car = cars.find(c => c.id === carId);
    return car ? car.label.trim() || carId : carId;
  };

  // CarPicker sub-component
  const CarPicker = ({
    value,
    onChange,
  }: {
    value?: string;
    onChange: (val: string) => void;
  }) => (
    <Select value={value || UNASSIGNED} onValueChange={(v) => onChange(v === UNASSIGNED ? "" : v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select a GLA car…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
        {cars.map((car) => (
          <SelectItem key={car.id} value={car.id}>
            {car.label.trim() || car.id}
            {car.plate ? ` (${car.plate})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6 text-red-600">Error loading devices: {(error as Error).message}</div>
      </AdminLayout>
    );
  }

  const devices = devicesData?.data ?? [];

  return (
    <AdminLayout>
      <div className="container mx-auto p-6">
        <BouncieConnectionBanner />

        <div className="flex justify-between items-center mb-6 mt-4">
          <div>
            <h1 className="text-3xl font-bold">Bouncie Device Management</h1>
            <p className="text-muted-foreground mt-2">Manage GPS tracking devices and link them to fleet vehicles</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Device
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registered Devices ({devices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading devices…
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Bouncie Devices</h3>
                <p className="text-muted-foreground mb-4">Add your first GPS tracking device to monitor your fleet.</p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Device
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IMEI</TableHead>
                      <TableHead>Nickname</TableHead>
                      <TableHead>Assigned Car</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Connection</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-mono text-sm">{device.imei}</TableCell>
                        <TableCell>{device.nickname || "-"}</TableCell>
                        <TableCell className="text-sm">{carLabel(device.carId)}</TableCell>
                        <TableCell>
                          <Badge variant={device.isActive ? "default" : "secondary"}>
                            {device.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {device.liveData ? (
                            <div className="flex items-center text-green-600 text-sm gap-1">
                              <Wifi className="w-4 h-4" /> Online
                            </div>
                          ) : (
                            <div className="flex items-center text-gray-400 text-sm gap-1">
                              <WifiOff className="w-4 h-4" /> Unknown
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(device.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditDevice(device)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteDevice(device.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Device Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bouncie Device</DialogTitle>
              <DialogDescription>Register a new GPS tracking device to monitor vehicle location and activity.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="imei">IMEI * (15 digits)</Label>
                <Input
                  id="imei"
                  value={addFormData.imei}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 15);
                    setAddFormData({ ...addFormData, imei: value });
                  }}
                  placeholder="123456789012345"
                  maxLength={15}
                />
                <p className="text-xs text-muted-foreground mt-1">Found on device label or in Bouncie app</p>
              </div>
              <div>
                <Label htmlFor="nickname">Nickname</Label>
                <Input
                  id="nickname"
                  value={addFormData.nickname}
                  onChange={(e) => setAddFormData({ ...addFormData, nickname: e.target.value })}
                  placeholder="Optional display name"
                />
              </div>
              <div>
                <Label>Assign to GLA Car</Label>
                <CarPicker
                  value={addFormData.carId}
                  onChange={(val) => setAddFormData({ ...addFormData, carId: val })}
                />
                <p className="text-xs text-muted-foreground mt-1">Link this device to a specific rental car</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddDevice} disabled={!addFormData.imei || addDeviceMutation.isPending}>
                {addDeviceMutation.isPending ? "Adding…" : "Add Device"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Device Dialog */}
        <Dialog open={!!editingDevice} onOpenChange={() => setEditingDevice(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Device</DialogTitle>
              <DialogDescription>Update device information and assignment.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>IMEI</Label>
                <p className="text-sm font-mono text-muted-foreground mt-1">{editingDevice?.imei}</p>
              </div>
              <div>
                <Label htmlFor="edit-nickname">Nickname</Label>
                <Input
                  id="edit-nickname"
                  value={editFormData.nickname}
                  onChange={(e) => setEditFormData({ ...editFormData, nickname: e.target.value })}
                  placeholder="Optional display name"
                />
              </div>
              <div>
                <Label>Assign to GLA Car</Label>
                <CarPicker
                  value={editFormData.carId}
                  onChange={(val) => setEditFormData({ ...editFormData, carId: val })}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="edit-isActive"
                  checked={editFormData.isActive}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, isActive: checked })}
                />
                <Label htmlFor="edit-isActive">Active tracking enabled</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingDevice(null)}>Cancel</Button>
              <Button onClick={handleUpdateDevice} disabled={updateDeviceMutation.isPending}>
                {updateDeviceMutation.isPending ? "Updating…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
