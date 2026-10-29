export const themes = [
  { id: 'light', label: 'White with black text', background: '#ffffff', accent: '#000000' },
  { id: 'dark-gray', label: 'Dark gray with white', background: '#121212', accent: '#ffffff' },
  { id: 'dark-green', label: 'Dark green · solid', background: '#101a15', accent: '#9bd1ad' },
  { id: 'glass-green', label: 'Dark glass gray', background: '#141819', accent: '#93a99e' },
  {
    id: 'bloom', label: 'Bloom · peach and blue', background: '#f4eee0', accent: '#3173ad',
    swatch: 'linear-gradient(90deg, #ffa47f 0 25%, #f4eee0 25% 50%, #3173ad 50% 75%, #193857 75%)',
  },
];

// Keep saved preferences usable when themes are retired or renamed.
const themeAliases = {
  dark: 'dark-gray',
  'dark-purple': 'dark-gray',
  'bloom-dark': 'dark-gray',
  'light-matcha': 'light',
  'light-brown': 'light',
};

export const getTheme = (id) => {
  const currentId = themeAliases[id] || id;
  return themes.find((theme) => theme.id === currentId) || themes.find((theme) => theme.id === 'dark-gray');
};
