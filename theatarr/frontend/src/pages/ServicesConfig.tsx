import { useState, useEffect } from 'react';
import { Plus, Filter, RefreshCw } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, Modal } from '../components/common';
import {
  ServiceCard,
  ServiceForm,
  CapabilitiesDisplay,
  type Service,
  type ServiceFormData,
} from '../components/services';
import { apiClient } from '../api/client';

interface AdapterInfo {
  type: string;
  category: string;
  display_name: string;
  config_schema: {
    type: string;
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

const categoryFilters = [
  { value: '', label: 'All Categories' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'player', label: 'Media Players' },
  { value: 'media_source', label: 'Media Sources' },
  { value: 'actuator', label: 'Actuators' },
  { value: 'metadata', label: 'Metadata' },
];

export function ServicesConfig() {
  const [services, setServices] = useState<Service[]>([]);
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [testingServiceId, setTestingServiceId] = useState<string | null>(null);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [viewingCapabilities, setViewingCapabilities] = useState<Service | null>(null);
  const [deleteConfirmService, setDeleteConfirmService] = useState<Service | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [servicesRes, adaptersRes] = await Promise.all([
        apiClient.get<{ items: Service[]; total: number }>('/api/v1/services'),
        apiClient.get<{ items: AdapterInfo[] }>('/api/v1/services/adapters'),
      ]);
      setServices(servicesRes.items);
      setAdapters(adaptersRes.items);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateService = async (data: ServiceFormData) => {
    const created = await apiClient.post<Service>('/api/v1/services', data);
    setServices((prev) => [...prev, created]);
    setIsFormModalOpen(false);
  };

  const handleUpdateService = async (data: ServiceFormData) => {
    if (!editingService) return;

    const updated = await apiClient.patch<Service>(`/api/v1/services/${editingService.id}`, data);
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingService(null);
    setIsFormModalOpen(false);
  };

  const handleDeleteService = async () => {
    if (!deleteConfirmService) return;

    await apiClient.delete(`/api/v1/services/${deleteConfirmService.id}`);
    setServices((prev) => prev.filter((s) => s.id !== deleteConfirmService.id));
    setDeleteConfirmService(null);
  };

  const handleToggleService = async (service: Service) => {
    const endpoint = service.is_enabled
      ? `/api/v1/services/${service.id}/disable`
      : `/api/v1/services/${service.id}/enable`;

    const updated = await apiClient.post<Service>(endpoint);
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleTestConnection = async (serviceId: string) => {
    setTestingServiceId(serviceId);
    try {
      const result = await apiClient.post<{ success: boolean; status: string }>(
        `/api/v1/services/${serviceId}/test`
      );
      // Refresh service to get updated connection status
      const updated = await apiClient.get<Service>(`/api/v1/services/${serviceId}`);
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (error) {
      console.error('Connection test failed:', error);
    } finally {
      setTestingServiceId(null);
    }
  };

  const filteredServices = categoryFilter
    ? services.filter((s) => s.category === categoryFilter)
    : services;

  const servicesByCategory = filteredServices.reduce(
    (acc, service) => {
      if (!acc[service.category]) {
        acc[service.category] = [];
      }
      acc[service.category].push(service);
      return acc;
    },
    {} as Record<string, Service[]>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-dark-muted">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Services Configuration</h1>
            <p className="text-dark-muted mt-1">
              Configure external services and adapters for your home cinema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={fetchData}>
              <RefreshCw size={16} />
            </Button>
            <Button
              onClick={() => {
                setEditingService(null);
                setIsFormModalOpen(true);
              }}
            >
              <Plus size={16} className="mr-1" />
              Add Service
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-dark-muted" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            >
              {categoryFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-dark-muted">
            {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Services List */}
        {filteredServices.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-dark-muted mb-4">No services configured yet.</p>
              <Button
                onClick={() => {
                  setEditingService(null);
                  setIsFormModalOpen(true);
                }}
              >
                <Plus size={16} className="mr-1" />
                Add Your First Service
              </Button>
            </CardContent>
          </Card>
        ) : categoryFilter ? (
          // Flat list when filtered
          <div className="space-y-3">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={() => {
                  setEditingService(service);
                  setIsFormModalOpen(true);
                }}
                onDelete={() => setDeleteConfirmService(service)}
                onToggle={() => handleToggleService(service)}
                onTest={() => handleTestConnection(service.id)}
                isTestLoading={testingServiceId === service.id}
              />
            ))}
          </div>
        ) : (
          // Grouped by category
          <div className="space-y-8">
            {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
              <div key={category}>
                <h2 className="text-lg font-semibold text-dark-text mb-3 capitalize">
                  {categoryFilters.find((f) => f.value === category)?.label || category}
                </h2>
                <div className="space-y-3">
                  {categoryServices.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      onEdit={() => {
                        setEditingService(service);
                        setIsFormModalOpen(true);
                      }}
                      onDelete={() => setDeleteConfirmService(service)}
                      onToggle={() => handleToggleService(service)}
                      onTest={() => handleTestConnection(service.id)}
                      isTestLoading={testingServiceId === service.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Service Modal */}
        <Modal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingService(null);
          }}
          title={editingService ? 'Edit Service' : 'Add Service'}
          size="lg"
        >
          <ServiceForm
            service={editingService || undefined}
            adapters={adapters}
            onSubmit={editingService ? handleUpdateService : handleCreateService}
            onCancel={() => {
              setIsFormModalOpen(false);
              setEditingService(null);
            }}
          />
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!deleteConfirmService}
          onClose={() => setDeleteConfirmService(null)}
          title="Delete Service"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-dark-text">
              Are you sure you want to delete "{deleteConfirmService?.name}"?
            </p>
            <p className="text-sm text-dark-muted">
              This action cannot be undone. Any sequences using this service will need to be updated.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteConfirmService(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteService}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>

        {/* Capabilities Modal */}
        {viewingCapabilities && (
          <Modal
            isOpen={true}
            onClose={() => setViewingCapabilities(null)}
            title={`Capabilities - ${viewingCapabilities.name}`}
            size="lg"
          >
            <CapabilitiesDisplay
              serviceId={viewingCapabilities.id}
              initialCapabilities={viewingCapabilities.capabilities}
            />
          </Modal>
        )}
      </div>
    </div>
  );
}
