import { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  Plug,
  Lightbulb,
  Monitor,
  Film,
  Cog,
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Button, Card, Modal, Spinner } from '../components/common';
import {
  ServiceCard,
  ServiceForm,
  CapabilitiesDisplay,
  type Service,
  type ServiceFormData,
} from '../components/services';
import { apiClient } from '../api/client';
import { useLayoutStore } from '../stores/layoutStore';

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

const categoryIcons: Record<string, React.ReactNode> = {
  lighting: <Lightbulb size={18} />,
  player: <Monitor size={18} />,
  media_source: <Film size={18} />,
  actuator: <Cog size={18} />,
  metadata: <Database size={18} />,
};

export function ServicesConfig() {
  const { language } = useLayoutStore();
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

  const t = {
    title: language === 'fr' ? 'Services' : 'Services',
    subtitle: language === 'fr' ? 'Configurez vos services externes (éclairage, lecteurs, sources média)' : 'Configure external services (lighting, players, media sources)',
    addService: language === 'fr' ? 'Ajouter un service' : 'Add Service',
    refresh: language === 'fr' ? 'Actualiser' : 'Refresh',
    all: language === 'fr' ? 'Tous' : 'All',
    lighting: language === 'fr' ? 'Éclairage' : 'Lighting',
    player: language === 'fr' ? 'Lecteurs' : 'Players',
    media_source: language === 'fr' ? 'Sources média' : 'Media Sources',
    actuator: language === 'fr' ? 'Actionneurs' : 'Actuators',
    metadata: language === 'fr' ? 'Métadonnées' : 'Metadata',
    noServices: language === 'fr' ? 'Aucun service configuré' : 'No services configured',
    addFirst: language === 'fr' ? 'Ajouter votre premier service' : 'Add Your First Service',
    services: language === 'fr' ? 'services' : 'services',
    connected: language === 'fr' ? 'connectés' : 'connected',
    errors: language === 'fr' ? 'erreurs' : 'errors',
    editService: language === 'fr' ? 'Modifier le service' : 'Edit Service',
    newService: language === 'fr' ? 'Nouveau service' : 'New Service',
    deleteService: language === 'fr' ? 'Supprimer le service' : 'Delete Service',
    deleteConfirm: language === 'fr' ? 'Êtes-vous sûr de vouloir supprimer' : 'Are you sure you want to delete',
    deleteWarning: language === 'fr' ? 'Cette action est irréversible. Les séquences utilisant ce service devront être mises à jour.' : 'This action cannot be undone. Sequences using this service will need to be updated.',
    cancel: language === 'fr' ? 'Annuler' : 'Cancel',
    delete: language === 'fr' ? 'Supprimer' : 'Delete',
    capabilities: language === 'fr' ? 'Capacités' : 'Capabilities',
  };

  const categoryFilters = [
    { value: '', label: t.all, icon: null },
    { value: 'lighting', label: t.lighting, icon: categoryIcons.lighting },
    { value: 'player', label: t.player, icon: categoryIcons.player },
    { value: 'media_source', label: t.media_source, icon: categoryIcons.media_source },
    { value: 'actuator', label: t.actuator, icon: categoryIcons.actuator },
    { value: 'metadata', label: t.metadata, icon: categoryIcons.metadata },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [servicesRes, adaptersRes] = await Promise.all([
        apiClient.get<{ items: Service[]; total: number }>('/services'),
        apiClient.get<{ items: AdapterInfo[] }>('/services/adapters'),
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
    const created = await apiClient.post<Service>('/services', data);
    setServices((prev) => [...prev, created]);
    setIsFormModalOpen(false);
  };

  const handleUpdateService = async (data: ServiceFormData) => {
    if (!editingService) return;

    const updated = await apiClient.patch<Service>(`/services/${editingService.id}`, data);
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingService(null);
    setIsFormModalOpen(false);
  };

  const handleDeleteService = async () => {
    if (!deleteConfirmService) return;

    await apiClient.delete(`/services/${deleteConfirmService.id}`);
    setServices((prev) => prev.filter((s) => s.id !== deleteConfirmService.id));
    setDeleteConfirmService(null);
  };

  const handleToggleService = async (service: Service) => {
    const endpoint = service.is_enabled
      ? `/services/${service.id}/disable`
      : `/services/${service.id}/enable`;

    const updated = await apiClient.post<Service>(endpoint, {});
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleTestConnection = async (serviceId: string) => {
    setTestingServiceId(serviceId);
    try {
      await apiClient.post<{ success: boolean; status: string }>(`/services/${serviceId}/test`, {});
      const updated = await apiClient.get<Service>(`/services/${serviceId}`);
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

  // Stats
  const connectedCount = services.filter((s) => s.connection_status === 'connected').length;
  const errorCount = services.filter((s) => s.connection_status === 'error').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">{t.title}</h1>
          <p className="text-dark-muted text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={fetchData} className="flex-shrink-0">
            <RefreshCw size={16} />
          </Button>
          <Button
            onClick={() => {
              setEditingService(null);
              setIsFormModalOpen(true);
            }}
          >
            <Plus size={16} className="mr-1" />
            <span className="hidden sm:inline">{t.addService}</span>
            <span className="sm:hidden">Ajouter</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {services.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-theatarr-500/20 flex items-center justify-center">
                <Plug size={18} className="text-theatarr-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-dark-text">{services.length}</div>
                <div className="text-xs text-dark-muted">{t.services}</div>
              </div>
            </div>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle size={18} className="text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-dark-text">{connectedCount}</div>
                <div className="text-xs text-dark-muted">{t.connected}</div>
              </div>
            </div>
          </div>
          <div className="bg-dark-surface border border-dark-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                {errorCount > 0 ? (
                  <XCircle size={18} className="text-red-400" />
                ) : (
                  <AlertCircle size={18} className="text-dark-muted" />
                )}
              </div>
              <div>
                <div className="text-2xl font-bold text-dark-text">{errorCount}</div>
                <div className="text-xs text-dark-muted">{t.errors}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Filters - Horizontal scroll on mobile */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {categoryFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setCategoryFilter(filter.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              categoryFilter === filter.value
                ? 'bg-theatarr-500 text-white'
                : 'bg-dark-surface text-dark-muted hover:bg-dark-border/50 border border-dark-border'
            }`}
          >
            {filter.icon}
            {filter.label}
          </button>
        ))}
      </div>

      {/* Services List */}
      {filteredServices.length === 0 ? (
        <Card className="p-12 text-center">
          <Plug size={48} className="mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted mb-4">{t.noServices}</p>
          <Button
            onClick={() => {
              setEditingService(null);
              setIsFormModalOpen(true);
            }}
          >
            <Plus size={16} className="mr-1" />
            {t.addFirst}
          </Button>
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
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-dark-surface border border-dark-border flex items-center justify-center text-dark-muted">
                  {categoryIcons[category] || <Cog size={16} />}
                </div>
                <h2 className="text-lg font-semibold text-dark-text">
                  {categoryFilters.find((f) => f.value === category)?.label || category}
                </h2>
                <span className="text-sm text-dark-muted">({categoryServices.length})</span>
              </div>
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
        title={editingService ? t.editService : t.newService}
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
        title={t.deleteService}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-dark-text">
            {t.deleteConfirm} "{deleteConfirmService?.name}" ?
          </p>
          <p className="text-sm text-dark-muted">{t.deleteWarning}</p>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmService(null)}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={handleDeleteService}>
              {t.delete}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Capabilities Modal */}
      {viewingCapabilities && (
        <Modal
          isOpen={true}
          onClose={() => setViewingCapabilities(null)}
          title={`${t.capabilities} - ${viewingCapabilities.name}`}
          size="lg"
        >
          <CapabilitiesDisplay
            serviceId={viewingCapabilities.id}
            initialCapabilities={viewingCapabilities.capabilities}
          />
        </Modal>
      )}
    </div>
  );
}
