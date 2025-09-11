import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import AuthProvider from './auth/AuthProvider';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster position="top-right" /> {/* 👈 Toaster đặt một lần ở gốc */}
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
