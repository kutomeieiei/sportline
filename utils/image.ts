// Shrinks a picked image so it fits safely inside a Firestore document
// (documents are limited to 1 MB, and photos from phones are often 3-10 MB).
export const resizeImageToDataUrl = (file: File, maxSize = 256, quality = 0.8): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This image format is not supported.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process the image.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

// Default avatar when a user has no photo.
export const fallbackAvatar = (name?: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`;
