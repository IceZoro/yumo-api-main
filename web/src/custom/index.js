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

import React from 'react';
import { Route } from 'react-router-dom';
import { AuthRedirect, PrivateRoute } from '../helpers';

// 自定义页面
const CustomHome = React.lazy(() => import('./pages/Home'));
const ImageGenerator = React.lazy(() => import('./pages/ImageGenerator'));
const Asset = React.lazy(() => import('./pages/Asset'));

// 自定义 Auth 组件
const CustomLoginForm = React.lazy(() => import('./components/Auth/LoginForm'));
const CustomRegisterForm = React.lazy(() => import('./components/Auth/RegisterForm'));

/**
 * 自定义路由组件
 * 放在 App.jsx 的 Routes 中，优先于 upstream 路由匹配
 */
const CustomRoutes = () => {
  return (
    <>
      {/* 自定义首页 - 覆盖 upstream 的 / */}
      <Route
        path='/'
        element={
          <CustomHome />
        }
      />

      {/* 自定义图像生成页 */}
      <Route
        path='/image-generator'
        element={
          <PrivateRoute>
            <ImageGenerator />
          </PrivateRoute>
        }
      />

      {/* 自定义资产页 */}
      <Route
        path='/asset'
        element={
          <PrivateRoute>
            <Asset />
          </PrivateRoute>
        }
      />

      {/* 自定义登录页 - 覆盖 upstream 的 /login */}
      <Route
        path='/login'
        element={
          <AuthRedirect>
            <CustomLoginForm />
          </AuthRedirect>
        }
      />

      {/* 自定义注册页 - 覆盖 upstream 的 /register */}
      <Route
        path='/register'
        element={
          <AuthRedirect>
            <CustomRegisterForm />
          </AuthRedirect>
        }
      />
    </>
  );
};

export { CustomRoutes };
