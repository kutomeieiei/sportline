import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders pop-ups at the top level of the page, so they always appear above
 * the navigation bar/side menu no matter where they're opened from.
 */
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);

export default Portal;
