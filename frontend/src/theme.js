export const themes = [
  { id: 'light', label: 'White with blue', background: '#f3f5f6', accent: '#216db4' },
  { id: 'dark', label: 'Dark blue with white', background: '#0c1219', accent: '#8bbefb' },
  { id: 'dark-purple', label: 'Black with purple', background: '#120e1b', accent: '#c9a4f7' },
  { id: 'light-brown', label: 'White with dark brown', background: '#fcfaf7', accent: '#784628' },
];

export const getTheme = (id) => themes.find((theme) => theme.id === id) || themes[1];
