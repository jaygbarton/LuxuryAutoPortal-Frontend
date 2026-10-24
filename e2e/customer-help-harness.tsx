// Browser test harness only; never imported by the production application.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerHelpWidget } from '../src/components/customer-help/CustomerHelpWidget';

const cache = new QueryClient();
Object.assign(window, { chatTestCache: cache });
const root = document.createElement('div');
document.body.append(root);
createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={cache}><CustomerHelpWidget /></QueryClientProvider>
  </React.StrictMode>,
);
