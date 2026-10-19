export const themes = [
  { id: 'light', label: 'White with black text', background: '#ffffff', accent: '#000000' },
  { id: 'dark', label: 'Dark blue with white', background: '#0c1219', accent: '#8bbefb' },
  { id: 'dark-gray', label: 'Dark gray with white', background: '#161616', accent: '#ffffff' },
  { id: 'light-matcha', label: 'White with matcha green', background: '#fbfcf9', accent: '#506d3d' },
];

export const getTheme = (id) => {
  const currentId = id === 'light-brown' ? 'light-matcha' : id === 'dark-purple' ? 'dark-gray' : id;
  return themes.find((theme) => theme.id === currentId) || themes[1];
};
