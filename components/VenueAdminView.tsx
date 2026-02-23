import React, { useState } from 'react';
import { Venue, Court, SportType } from '../types';
import { X, Plus, Trash2 } from 'lucide-react';

interface VenueAdminViewProps {
  onClose: () => void;
  onAddVenue: (venue: Omit<Venue, 'id'>) => Promise<void>;
}

const SPORT_TYPES: SportType[] = ['Football', 'Basketball', 'Badminton', 'Tennis', 'Running', 'Cycling', 'Yoga'];

const VenueAdminView: React.FC<VenueAdminViewProps> = ({ onClose, onAddVenue }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [courts, setCourts] = useState<Omit<Court, 'id'>[]>([{ name: '', sport: 'Football' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCourtChange = (index: number, field: 'name' | 'sport', value: string) => {
    const newCourts = [...courts];
    newCourts[index] = { ...newCourts[index], [field]: value };
    setCourts(newCourts);
  };

  const addCourt = () => {
    setCourts([...courts, { name: '', sport: 'Football' }]);
  };

  const removeCourt = (index: number) => {
    const newCourts = courts.filter((_, i) => i !== index);
    setCourts(newCourts);
  };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !latitude || !longitude) {
        alert('Please fill in Name, Latitude, and Longitude.');
        return;
    }

    setIsSubmitting(true);
    try {
      await onAddVenue({
        name,
        description,
        imageUrl,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        courts,
      });
      onClose();
    } catch (error) {
      console.error("Failed to add venue", error);
      alert("Failed to add venue. See console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Add New Sports Venue</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        <form id="venue-admin-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Venue Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Image URL</label>
            <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.png" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Latitude</label>
              <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Longitude</label>
              <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
            </div>
          </div>
          
          <div className="pt-2">
            <h3 className="text-lg font-medium text-gray-800">Courts / Fields</h3>
            <div className="space-y-3 mt-2">
              {courts.map((court, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border">
                  <input type="text" placeholder="Court Name (e.g., Court 1)" value={court.name} onChange={(e) => handleCourtChange(index, 'name', e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm" required />
                  <select value={court.sport} onChange={(e) => handleCourtChange(index, 'sport', e.target.value)} className="px-2 py-1 border border-gray-300 rounded-md text-sm">
                    {SPORT_TYPES.map(sport => <option key={sport} value={sport}>{sport}</option>)}
                  </select>
                  <button type="button" onClick={() => removeCourt(index)} className="p-2 text-red-500 hover:bg-red-100 rounded-full">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addCourt} className="mt-2 flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800">
              <Plus size={16} /> Add Court
            </button>
          </div>
        </form>
        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
          <button onClick={onClose} type="button" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Cancel</button>
          <button form="venue-admin-form" disabled={isSubmitting} type="submit" className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Save Venue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VenueAdminView;
