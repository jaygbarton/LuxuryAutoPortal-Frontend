import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {FeaturedCars} from '../../src/components/home/featured-cars';
import {PUBLIC_LOCATIONS} from '../../src/lib/location-config';
import '../../src/index.css';
const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><FeaturedCars location={PUBLIC_LOCATIONS.slc}/></QueryClientProvider>);
