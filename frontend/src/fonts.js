export const fonts = [
  { id: 'theme', label: 'Theme default' },
  { id: 'liberation-serif', label: 'Liberation Serif' },
  { id: 'geist-serif', label: 'Geist Serif' },
  { id: 'adwaita-sans', label: 'Adwaita Sans' },
];

export const getFont = (id) => fonts.find((font) => font.id === id) || fonts[0];
