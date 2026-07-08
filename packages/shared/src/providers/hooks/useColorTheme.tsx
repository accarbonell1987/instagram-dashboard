'use client';

import { createContext, useContext } from 'react';

import type { ColorThemeContextValueInterface } from '../types/ThemeProvider.types';

export const ColorThemeContext = createContext<ColorThemeContextValueInterface | undefined>(
  undefined
);

const useColorTheme = (): ColorThemeContextValueInterface => {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error('useColorTheme must be used within a ThemeProvider');
  }
  return context;
};

export default useColorTheme;
