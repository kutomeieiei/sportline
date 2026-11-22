import React from 'react';
import { InfoWindowF } from '@react-google-maps/api';
import { X } from 'lucide-react';
import Portal from './Portal';

interface MapCardProps {
  /** Phone-sized screen: show as a bottom sheet instead of a popup on the map. */
  isPhone: boolean;
  position: google.maps.LatLngLiteral;
  /** How far above the point the popup sits (PC), e.g. -46 for a pin. */
  offsetY: number;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}

/**
 * Details for something on the map (venue, game, player, sharing).
 * PC: a popup pointing at it. Phone: a sheet across the bottom of the screen,
 * because map popups get too narrow on small phones and cut the content off.
 */
const MapCard: React.FC<MapCardProps> = ({ isPhone, position, offsetY, onClose, label, children }) => {
  if (!isPhone) {
    return (
      <InfoWindowF position={position} onCloseClick={onClose} options={{ pixelOffset: new google.maps.Size(0, offsetY) }}>
        {children}
      </InfoWindowF>
    );
  }
  return (
    <Portal>
      <div
        role="dialog"
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-[2500] bg-white rounded-t-3xl shadow-elev-3 max-h-[65vh] flex flex-col sheet-up"
      >
        <div className="relative shrink-0 h-9">
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-300" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="press absolute right-2 top-1 w-9 h-9 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4 pb-safe">{children}</div>
      </div>
    </Portal>
  );
};

export default MapCard;
