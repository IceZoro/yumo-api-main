/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from 'react';

const ThemeContext = createContext('dark');
export const useTheme = () => useContext(ThemeContext);

const ActualThemeContext = createContext('dark');
export const useActualTheme = () => useContext(ActualThemeContext);

const SetThemeContext = createContext(null);
export const useSetTheme = () => useContext(SetThemeContext);

export const ThemeProvider = ({ children }) => {
  // 始终强制深色模式，忽略 localStorage 和系统偏好
  const theme = 'dark';
  const actualTheme = 'dark';

  // 始终将 body 设置为深色模式
  useEffect(() => {
    const body = document.body;
    body.setAttribute('theme-mode', 'dark');
    document.documentElement.classList.add('dark');
    // 覆盖 localStorage 中可能存在的浅色模式设置
    try {
      localStorage.setItem('theme-mode', 'dark');
    } catch {
      // ignore
    }
  }, []);

  // setTheme 保留但不生效，保持接口兼容
  const setTheme = useCallback(() => {
    // 强制深色模式，忽略切换请求
  }, []);

  return (
    <SetThemeContext.Provider value={setTheme}>
      <ActualThemeContext.Provider value={actualTheme}>
        <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
      </ActualThemeContext.Provider>
    </SetThemeContext.Provider>
  );
};
