'use client';

import type { RemoteSupportDeviceClass, RemoteSupportProtocol } from '@repo/contract';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { Edit2, Laptop, Monitor, Plus, PowerOff, Search, Server, Shield } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { deactivateRemoteSupportDevice, upsertRemoteSupportDevice } from '../actions';
import type { SupportDeviceView } from '../types/remote-support-ui';

export interface ManagedDevicesPanelProps {
  readonly devices: readonly SupportDeviceView[];
  readonly userRole: string;
  readonly onDevicesChanged: (devices: readonly SupportDeviceView[]) => void;
  readonly onConnectDevice: (device: SupportDeviceView) => void;
}

const DEFAULT_PORT_BY_PROTOCOL: Readonly<Record<RemoteSupportProtocol, number>> = {
  rdp: 3389,
  vnc: 5900,
  ssh: 22,
  meshcentral: 443,
};

export function ManagedDevicesPanel({
  devices,
  userRole,
  onDevicesChanged,
  onConnectDevice,
}: ManagedDevicesPanelProps) {
  const isAdmin = userRole === 'admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [hostname, setHostname] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [deviceClass, setDeviceClass] = useState<RemoteSupportDeviceClass>('workstation');
  const [protocol, setProtocol] = useState<RemoteSupportProtocol>('rdp');
  const [networkHost, setNetworkHost] = useState('');
  const [networkPort, setNetworkPort] = useState<number>(3389);
  const [requireConsent, setRequireConsent] = useState(true);

  const [editingDevice, setEditingDevice] = useState<SupportDeviceView | null>(null);
  const [editHostname, setEditHostname] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editDeviceClass, setEditDeviceClass] = useState<RemoteSupportDeviceClass>('workstation');
  const [editProtocol, setEditProtocol] = useState<RemoteSupportProtocol>('rdp');
  const [editNetworkHost, setEditNetworkHost] = useState('');
  const [editNetworkPort, setEditNetworkPort] = useState<number>(3389);
  const [editRequireConsent, setEditRequireConsent] = useState(true);

  const filteredDevices = devices.filter((device) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return (
      device.hostname.toLowerCase().includes(query) ||
      device.display_name.toLowerCase().includes(query) ||
      device.network_host.toLowerCase().includes(query) ||
      device.protocol.toLowerCase().includes(query)
    );
  });

  const handleSaveDevice = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await upsertRemoteSupportDevice({
        hostname: hostname.trim(),
        displayName: displayName.trim(),
        deviceClass,
        protocol,
        networkHost: networkHost.trim(),
        networkPort,
        requireUserConsent: requireConsent,
        isActive: true,
      });

      onDevicesChanged([result.device, ...devices]);
      setHostname('');
      setDisplayName('');
      setNetworkHost('');
      setShowForm(false);
      toast.success(`Registered ${result.device.hostname}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to register workstation');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (device: SupportDeviceView) => {
    setEditingDevice(device);
    setEditHostname(device.hostname);
    setEditDisplayName(device.display_name);
    setEditDeviceClass(device.device_class);
    setEditProtocol(device.protocol);
    setEditNetworkHost(device.network_host);
    setEditNetworkPort(device.network_port);
    setEditRequireConsent(device.require_user_consent);
  };

  const handleSaveEditDevice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingDevice) return;
    setSaving(true);
    try {
      const result = await upsertRemoteSupportDevice({
        id: editingDevice.id,
        hostname: editHostname.trim(),
        displayName: editDisplayName.trim(),
        siteId: editingDevice.site_id,
        departmentId: editingDevice.department_id,
        assignedEmployeeId: editingDevice.assigned_employee_id,
        deviceClass: editDeviceClass,
        protocol: editProtocol,
        networkHost: editNetworkHost.trim(),
        networkPort: editNetworkPort,
        requireUserConsent: editRequireConsent,
        isActive: editingDevice.is_active,
      });

      onDevicesChanged(
        devices.map((item) => (item.id === result.device.id ? result.device : item))
      );
      setEditingDevice(null);
      toast.success(`Updated workstation ${result.device.hostname}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update workstation');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (device: SupportDeviceView) => {
    try {
      await deactivateRemoteSupportDevice({ deviceId: device.id });
      onDevicesChanged(devices.filter((item) => item.id !== device.id));
      toast.info(`Deactivated ${device.hostname}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to deactivate device');
    }
  };

  return (
    <GlassCard className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--text-heading)] text-sm">
            Managed Workstations (Tier 2 OS Desktop)
          </h3>
          <p className="text-[var(--text-muted)] text-xs">
            Zero stored OS passwords — connections route through guacd with 60s signed tokens.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search host, IP, protocol…"
              className="h-8 rounded-lg border border-black/10 bg-[var(--bg-primary)] pr-3 pl-8 text-xs"
            />
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 font-semibold text-white text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Workstation</span>
            </button>
          )}
        </div>
      </div>

      {isAdmin && showForm && (
        <form
          onSubmit={handleSaveDevice}
          className="grid grid-cols-1 gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-3 md:grid-cols-3"
        >
          <input
            type="text"
            required
            placeholder="Hostname (e.g. CR-OP-01)"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            className="h-8 rounded-lg border border-black/10 bg-[var(--bg-primary)] px-2.5 text-xs"
          />
          <input
            type="text"
            required
            placeholder="Display Name (e.g. Control Room Desk 1)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-8 rounded-lg border border-black/10 bg-[var(--bg-primary)] px-2.5 text-xs"
          />
          <input
            type="text"
            required
            placeholder="Internal Host / IP (e.g. 10.20.4.18)"
            value={networkHost}
            onChange={(e) => setNetworkHost(e.target.value)}
            className="h-8 rounded-lg border border-black/10 bg-[var(--bg-primary)] px-2.5 text-xs"
          />
          <select
            value={deviceClass}
            onChange={(e) => setDeviceClass(e.target.value as RemoteSupportDeviceClass)}
            className="h-8 rounded-lg border border-black/10 bg-[var(--bg-primary)] px-2 text-xs"
          >
            <option value="workstation">Workstation</option>
            <option value="laptop">Laptop</option>
            <option value="scada_hmi">SCADA HMI</option>
            <option value="unattended_kiosk">Unattended Kiosk</option>
            <option value="server">Server</option>
          </select>
          <select
            value={protocol}
            onChange={(e) => {
              const nextProto = e.target.value as RemoteSupportProtocol;
              setProtocol(nextProto);
              setNetworkPort(DEFAULT_PORT_BY_PROTOCOL[nextProto]);
            }}
            className="h-8 rounded-lg border border-black/10 bg-[var(--bg-primary)] px-2 text-xs"
          >
            <option value="rdp">RDP (Windows)</option>
            <option value="vnc">VNC (Linux / HMI)</option>
            <option value="ssh">SSH (Terminal)</option>
            <option value="meshcentral">MeshCentral (Roaming)</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={65535}
              value={networkPort}
              onChange={(e) => setNetworkPort(Number(e.target.value))}
              className="h-8 w-24 rounded-lg border border-black/10 bg-[var(--bg-primary)] px-2.5 text-xs"
            />
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={requireConsent}
                onChange={(e) => setRequireConsent(e.target.checked)}
              />
              <span>Require Consent</span>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="ml-auto h-8 rounded-lg bg-[var(--accent-blue)] px-3 font-semibold text-white text-xs"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {filteredDevices.length === 0 ? (
        <div className="rounded-xl border border-black/10 border-dashed p-6 text-center text-[var(--text-muted)] text-xs">
          No managed workstations registered yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {filteredDevices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-[var(--bg-primary)]/80 p-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
                  {device.device_class === 'laptop' ? (
                    <Laptop className="h-4 w-4" />
                  ) : device.device_class === 'server' ? (
                    <Server className="h-4 w-4" />
                  ) : (
                    <Monitor className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-[var(--text-heading)] text-xs">
                      {device.display_name}
                    </span>
                    <span className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase">
                      {device.protocol}
                    </span>
                  </div>
                  <p className="truncate font-mono text-[10px] text-[var(--text-muted)]">
                    {device.hostname} · {device.network_host}:{device.network_port}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]',
                    device.require_user_consent
                      ? 'bg-[var(--accent-green)]/12 text-[var(--accent-green)]'
                      : 'bg-accent-amber/12 text-accent-amber'
                  )}
                >
                  <Shield className="h-2.5 w-2.5" />
                  {device.require_user_consent ? 'Consent' : 'Unattended'}
                </span>

                <button
                  type="button"
                  onClick={() => onConnectDevice(device)}
                  className="h-7 rounded-lg bg-[var(--accent-blue)] px-2.5 font-semibold text-white text-xs hover:opacity-90"
                >
                  Connect
                </button>

                {isAdmin && (
                  <>
                    <button
                      type="button"
                      aria-label={`Edit ${device.hostname}`}
                      onClick={() => openEditModal(device)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Deactivate ${device.hostname}`}
                      onClick={() => void handleDeactivate(device)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 text-[var(--text-muted)] hover:text-[var(--accent-red)]"
                    >
                      <PowerOff className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Workstation Modal */}
      <Dialog
        open={Boolean(editingDevice)}
        onOpenChange={(open) => !open && setEditingDevice(null)}
      >
        <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-primary)]">
          <DialogHeader>
            <DialogTitle>Edit Managed Workstation</DialogTitle>
            <DialogDescription>
              Update network endpoint, protocol, or consent policy for{' '}
              <span className="font-mono">{editingDevice?.hostname}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditDevice} className="space-y-3">
            <div>
              <label
                htmlFor="edit-device-hostname"
                className="mb-1 block font-medium text-[var(--text-heading)] text-xs"
              >
                Hostname
              </label>
              <input
                id="edit-device-hostname"
                type="text"
                required
                value={editHostname}
                onChange={(e) => setEditHostname(e.target.value)}
                className="h-8 w-full rounded-lg border border-black/10 bg-[var(--bg-secondary)] px-2.5 font-mono text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="edit-device-display-name"
                className="mb-1 block font-medium text-[var(--text-heading)] text-xs"
              >
                Display Name
              </label>
              <input
                id="edit-device-display-name"
                type="text"
                required
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="h-8 w-full rounded-lg border border-black/10 bg-[var(--bg-secondary)] px-2.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="edit-device-host"
                  className="mb-1 block font-medium text-[var(--text-heading)] text-xs"
                >
                  Internal Host / IP
                </label>
                <input
                  id="edit-device-host"
                  type="text"
                  required
                  value={editNetworkHost}
                  onChange={(e) => setEditNetworkHost(e.target.value)}
                  className="h-8 w-full rounded-lg border border-black/10 bg-[var(--bg-secondary)] px-2.5 font-mono text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-device-port"
                  className="mb-1 block font-medium text-[var(--text-heading)] text-xs"
                >
                  Port
                </label>
                <input
                  id="edit-device-port"
                  type="number"
                  min={1}
                  max={65535}
                  required
                  value={editNetworkPort}
                  onChange={(e) => setEditNetworkPort(Number(e.target.value))}
                  className="h-8 w-full rounded-lg border border-black/10 bg-[var(--bg-secondary)] px-2.5 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="edit-device-class"
                  className="mb-1 block font-medium text-[var(--text-heading)] text-xs"
                >
                  Device Class
                </label>
                <select
                  id="edit-device-class"
                  value={editDeviceClass}
                  onChange={(e) => setEditDeviceClass(e.target.value as RemoteSupportDeviceClass)}
                  className="h-8 w-full rounded-lg border border-black/10 bg-[var(--bg-secondary)] px-2 text-xs"
                >
                  <option value="workstation">Workstation</option>
                  <option value="laptop">Laptop</option>
                  <option value="scada_hmi">SCADA HMI</option>
                  <option value="unattended_kiosk">Unattended Kiosk</option>
                  <option value="server">Server</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="edit-device-protocol"
                  className="mb-1 block font-medium text-[var(--text-heading)] text-xs"
                >
                  Protocol
                </label>
                <select
                  id="edit-device-protocol"
                  value={editProtocol}
                  onChange={(e) => {
                    const nextProto = e.target.value as RemoteSupportProtocol;
                    setEditProtocol(nextProto);
                    setEditNetworkPort(DEFAULT_PORT_BY_PROTOCOL[nextProto]);
                  }}
                  className="h-8 w-full rounded-lg border border-black/10 bg-[var(--bg-secondary)] px-2 text-xs"
                >
                  <option value="rdp">RDP (Windows)</option>
                  <option value="vnc">VNC (Linux / HMI)</option>
                  <option value="ssh">SSH (Terminal)</option>
                  <option value="meshcentral">MeshCentral (Roaming)</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-xs">
              <input
                type="checkbox"
                checked={editRequireConsent}
                onChange={(e) => setEditRequireConsent(e.target.checked)}
              />
              <span>Require explicit user consent before OS desktop launch</span>
            </label>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setEditingDevice(null)}
                className="h-8 rounded-lg border border-black/10 bg-[var(--bg-secondary)] px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-8 rounded-lg bg-[var(--accent-blue)] px-3.5 font-semibold text-white text-xs"
              >
                {saving ? 'Saving…' : 'Save Workstation'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </GlassCard>
  );
}
