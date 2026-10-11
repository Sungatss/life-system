export const themes = [
  { id: 'light', label: 'White with blue', background: '#f3f5f6', accent: '#216db4' },
  { id: 'dark', label: 'Dark blue with white', background: '#0c1219', accent: '#8bbefb' },
  { id: 'dark-purple', label: 'Dark with purple', background: '#101114', accent: '#b99aeb' },
  { id: 'light-matcha', label: 'White with matcha green', background: '#fbfcf9', accent: '#506d3d' },
];

export const getTheme = (id) => themes.find((theme) => theme.id === (id === 'light-brown' ? 'light-matcha' : id)) || themes[1];
