export const themes = [
  { id: 'light', label: 'White with black text', background: '#ffffff', accent: '#000000' },
  { id: 'dark', label: 'Dark blue with white', background: '#0c1219', accent: '#8bbefb' },
  { id: 'dark-gray', label: 'Dark gray with white', background: '#161616', accent: '#ffffff' },
  { id: 'glass-green', label: 'Dark glass gray', background: '#141819', accent: '#93a99e' },
  { id: 'light-matcha', label: 'White with matcha green', background: '#fbfcf9', accent: '#506d3d' },
  {
    id: 'bloom', label: 'Bloom · peach and blue', background: '#f4eee0', accent: '#3173ad',
    swatch: 'linear-gradient(90deg, #ffa47f 0 25%, #f4eee0 25% 50%, #3173ad 50% 75%, #193857 75%)',
  },
  {
    id: 'bloom-dark', label: 'Bloom Dark · navy and peach', background: '#102b45', accent: '#ffa47f',
    swatch: 'linear-gradient(90deg, #193857 0 25%, #3173ad 25% 50%, #ffa47f 50% 75%, #f4eee0 75%)',
  },
];

export const getTheme = (id) => {
  const currentId = id === 'light-brown' ? 'light-matcha' : id === 'dark-purple' ? 'dark-gray' : id;
  return themes.find((theme) => theme.id === currentId) || themes[1];
};
