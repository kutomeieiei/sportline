import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Image as ImageIcon } from 'lucide-react';
import { SportConfig, SportType } from '../types';
import { getSportConfigs, updateSportConfig } from '../services/sportService';
import { SPORTS_LIST, parseGoogleDriveLink } from '../constants';

interface SportAdminViewProps {
  onClose: () => void;
  onUpdate: () => void;
}

const SportAdminView: React.FC<SportAdminViewProps> = ({ onClose, onUpdate }) => {
  const [configs, setConfigs] = useState<Record<string, SportConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchConfigs = async () => {
      setIsLoading(true);
      const fetchedConfigs = await getSportConfigs();
      const configMap: Record<string, SportConfig> = {};
      
      // Initialize with default sports if not in DB
      SPORTS_LIST.forEach(sport => {
        if (sport.type !== 'All') {
          const existing = fetchedConfigs.find(c => c.id === sport.type);
          configMap[sport.type] = existing || {
            id: sport.type,
            type: sport.type,
            label: sport.label,
            markerUrl: ''
          };
        }
      });
      
      setConfigs(configMap);
      setIsLoading(false);
    };

    fetchConfigs();
  }, []);

  const handleUrlChange = (sportType: string, url: string) => {
    setConfigs(prev => ({
      ...prev,
      [sportType]: {
        ...prev[sportType],
        markerUrl: url
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const promises = Object.values(configs).map(config => 
        updateSportConfig(config.id, { markerUrl: config.markerUrl })
      );
      await Promise.all(promises);
      alert('Sport markers updated successfully!');
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error saving sport configs:", error);
      alert('Failed to save sport markers.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[4000] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Manage Sport Markers</h2>
            <p className="text-sm text-gray-500 mt-1">Set custom PNG images for map markers.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(configs).map((config) => (
                <div key={config.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">{config.label}</span>
                    {config.markerUrl ? (
                      <img src={parseGoogleDriveLink(config.markerUrl)} alt={config.label} className="w-8 h-8 object-contain drop-shadow-md" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                        <ImageIcon size={16} />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Marker Image URL (PNG)</label>
                    <input
                      type="text"
                      placeholder="https://example.com/marker.png"
                      value={config.markerUrl || ''}
                      onChange={(e) => handleUrlChange(config.id, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SportAdminView;
