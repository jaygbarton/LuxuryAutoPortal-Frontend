import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
  Route, 
  BarChart3,
  Wifi,
  WifiOff 
} from "lucide-react";

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

export default function BouncieDevicesPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState<BouncieDevice | null>(null);
  const [addFormData, setAddFormData] = useState<AddDeviceData>({
    imei: "",
    nickname: "",
    carId: "",
  });
  const [editFormData, setEditFormData] = useState<UpdateDeviceData>({
    nickname: "",
    carId: "",
    isActive: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch devices
  const { data: devices, isLoading, error } = useQuery<{ success: boolean; data: BouncieDevice[] }>({
    queryKey: ["/api/bouncie/devices"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/bouncie/devices"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch devices");
      }
      return response.json();
    },
  });

  // Add device mutation
  const addDeviceMutation = useMutation({
    mutationFn: async (data: AddDeviceData) => {
      const response = await fetch(buildApiUrl("/api/bouncie/devices"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add device");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/devices"] });
      setShowAddDialog(false);
      setAddFormData({ imei: "", nickname: "", carId: "" });
      toast({
        title: "Success",
        description: "Device added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update device mutation
  const updateDeviceMutation = useMutation({
    mutationFn: async ({ deviceId, data }: { deviceId: string; data: UpdateDeviceData }) => {
      const response = await fetch(buildApiUrl(`/api/bouncie/devices/${deviceId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update device");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/devices"] });
      setEditingDevice(null);
      toast({
        title: "Success",
        description: "Device updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete device mutation
  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const response = await fetch(buildApiUrl(`/api/bouncie/devices/${deviceId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete device");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/devices"] });
      toast({
        title: "Success",
        description: "Device deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddDevice = () => {
    if (!addFormData.imei.trim()) {
      toast({
        title: "Error",
        description: "IMEI is required",
        variant: "destructive",
      });
      return;
    }
    
    // Basic IMEI validation (15 digits)
    if (!/^\d{15}$/.test(addFormData.imei.replace(/\s/g, ""))) {
      toast({
        title: "Error", 
        description: "IMEI must be exactly 15 digits",
        variant: "destructive",
      });
      return;
    }
    
    addDeviceMutation.mutate({
      ...addFormData,
      imei: addFormData.imei.replace(/\s/g, "") // Remove spaces
    });
  };

  const handleEditDevice = (device: BouncieDevice) => {
    setEditingDevice(device);
    setEditFormData({
      nickname: device.nickname || "",
      carId: device.carId || "",
      isActive: device.isActive,
    });
  };

  const handleUpdateDevice = () => {
    if (!editingDevice) return;
    updateDeviceMutation.mutate({
      deviceId: editingDevice.id,
      data: editFormData,
    });
  };

  const handleDeleteDevice = (deviceId: string) => {
    if (confirm("Are you sure you want to delete this device?")) {
      deleteDeviceMutation.mutate(deviceId);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="text-red-600">
            Error loading devices: {error.message}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Bouncie Device Management</h1>
            <p className="text-gray-600 mt-2">
              Manage GPS tracking devices for fleet vehicles
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Device
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registered Devices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading devices...</div>
            ) : !devices?.data || devices.data.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bouncie Devices</h3>
                <p className="text-gray-500 mb-4">
                  Get started by adding your first GPS tracking device to monitor your fleet.
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Device
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Nickname</TableHead>
                    <TableHead>Car ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Connection</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices?.data?.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-mono">{device.imei}</TableCell>
                      <TableCell>{device.nickname || "-"}</TableCell>
                      <TableCell>{device.carId || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={device.isActive ? "default" : "secondary"}>
                          {device.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {device.liveData ? (
                          <div className="flex items-center text-green-600">
                            <Wifi className="w-4 h-4 mr-1" />
                            Online
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <WifiOff className="w-4 h-4 mr-1" />
                            Unknown
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(device.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditDevice(device)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteDevice(device.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Device Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bouncie Device</DialogTitle>
              <DialogDescription>
                Register a new GPS tracking device to monitor vehicle location and activity.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="imei">IMEI * (15 digits)</Label>
                <Input
                  id="imei"
                  value={addFormData.imei}
                  onChange={(e) => {
                    // Only allow digits and limit to 15 characters
                    const value = e.target.value.replace(/\D/g, '').slice(0, 15);
                    setAddFormData({ ...addFormData, imei: value });
                  }}
                  placeholder="123456789012345"
                  maxLength={15}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Usually found on device label or in Bouncie app
                </p>
              </div>
              <div>
                <Label htmlFor="nickname">Nickname</Label>
                <Input
                  id="nickname"
                  value={addFormData.nickname}
                  onChange={(e) =>
                    setAddFormData({ ...addFormData, nickname: e.target.value })
                  }
                  placeholder="Optional display name"
                />
              </div>
              <div>
                <Label htmlFor="carId">Car ID</Label>
                <Input
                  id="carId"
                  value={addFormData.carId}
                  onChange={(e) =>
                    setAddFormData({ ...addFormData, carId: e.target.value })
                  }
                  placeholder="Associated car identifier"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddDevice}
                disabled={!addFormData.imei || addDeviceMutation.isPending}
              >
                {addDeviceMutation.isPending ? "Adding..." : "Add Device"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Device Dialog */}
        <Dialog open={!!editingDevice} onOpenChange={() => setEditingDevice(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Device</DialogTitle>
              <DialogDescription>
                Update device information and settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-nickname">Nickname</Label>
                <Input
                  id="edit-nickname"
                  value={editFormData.nickname}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, nickname: e.target.value })
                  }
                  placeholder="Optional display name"
                />
              </div>
              <div>
                <Label htmlFor="edit-carId">Car ID</Label>
                <Input
                  id="edit-carId"
                  value={editFormData.carId}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, carId: e.target.value })
                  }
                  placeholder="Associated car identifier"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-isActive"
                  checked={editFormData.isActive}
                  onCheckedChange={(checked) =>
                    setEditFormData({ ...editFormData, isActive: checked })
                  }
                />
                <Label htmlFor="edit-isActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingDevice(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateDevice}
                disabled={updateDeviceMutation.isPending}
              >
                {updateDeviceMutation.isPending ? "Updating..." : "Update Device"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}