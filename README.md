# Golden Luxury Auto - Frontend Portal

Modern React application for Golden Luxury Auto's car rental management system.

## 🚀 Features

- **Admin Dashboard** - Complete fleet and user management interface
- **Employee Portal** - HR tools, scheduling, and expense tracking
- **Client Interface** - Customer onboarding and rental management
- **Responsive Design** - Works on all devices and screen sizes
- **Real-time Updates** - Live data with TanStack Query
- **Type Safety** - Full TypeScript implementation

## 🛠️ Tech Stack

- **React 18** - Latest React with hooks and concurrent features
- **TypeScript** - Full type safety throughout the application
- **Vite** - Fast build tool and development server
- **TanStack Query** - Server state management and caching
- **Tailwind CSS** - Utility-first CSS framework
- **Wouter** - Lightweight React router
- **Zod** - Runtime type validation

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Development Setup

1. **Clone Repository**
   ```bash
   git clone https://github.com/goldenluxuryauto/LuxuryAutoPortal-Frontend.git
   cd LuxuryAutoPortal-Frontend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create `.env` file in root:
   ```env
   VITE_API_URL=http://localhost:3000
   VITE_APP_TITLE="Golden Luxury Auto Portal"
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Open Browser**
   Navigate to: http://localhost:5000

## 📁 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base UI components (buttons, inputs, etc.)
│   ├── forms/           # Form-specific components
│   ├── modals/          # Modal dialogs
│   ├── admin/           # Admin-specific components
│   └── onboarding/      # Onboarding flow components
├── pages/               # Page components
│   ├── admin/           # Admin pages
│   ├── staff/           # Employee pages
│   └── client/          # Client pages
├── lib/                 # Utilities and configuration
│   ├── queryClient.ts   # TanStack Query setup
│   ├── utils.ts         # General utilities
│   └── logger.ts        # Logging utilities
└── types/              # TypeScript type definitions
```

## 🎨 UI Components

### Design System
- **Colors** - Consistent brand colors throughout
- **Typography** - Structured heading and text styles
- **Spacing** - Consistent margins and padding
- **Components** - Reusable UI elements

### Component Library
```typescript
// Example usage
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

<Button variant="primary" onClick={handleClick}>
  Save Changes
</Button>
```

## 🔗 API Integration

### Query Client Configuration
```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});
```

### API Requests
```typescript
// Example API hook
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function useCarData(carId: number) {
  return useQuery({
    queryKey: ['car', carId],
    queryFn: () => apiRequest(`/api/admin/cars/${carId}`),
  });
}
```

## 🎯 Key Features

### Admin Dashboard
- **User Management** - Create, edit, and manage users
- **Fleet Management** - Car inventory and maintenance tracking
- **Financial Tracking** - Income, expenses, and payments
- **Reporting** - Analytics and performance metrics

### Employee Portal
- **Time Tracking** - Clock in/out and schedule management
- **Expense Submissions** - Submit and track expense reports
- **Task Management** - Assignments and progress tracking
- **Training Resources** - Access to training materials

### Client Interface
- **Onboarding** - Step-by-step registration process
- **Car Browsing** - View available rental cars
- **Booking Management** - Manage reservations and rentals
- **Document Signing** - Electronic contract signing

## 🧪 Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

### Development Guidelines

1. **TypeScript First** - Always use TypeScript for new code
2. **Component Structure** - Keep components small and focused
3. **State Management** - Use TanStack Query for server state
4. **Styling** - Use Tailwind CSS classes consistently
5. **Error Handling** - Implement proper error boundaries

### Code Quality

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Format code
npm run prettier
```

## 🚀 Build & Deployment

### Production Build
```bash
npm run build
```

This creates an optimized build in the `dist/` folder.

### Deployment Options

#### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

#### Netlify
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

#### Static Hosting
Upload the contents of `dist/` folder to any static hosting provider.

## ⚙️ Configuration

### Environment Variables
```env
# API Configuration
VITE_API_URL=http://localhost:3000

# App Configuration
VITE_APP_TITLE="Golden Luxury Auto Portal"
VITE_APP_VERSION=1.0.0

# Feature Flags (optional)
VITE_ENABLE_DEBUG=true
VITE_ENABLE_ANALYTICS=false
```

### Build Configuration
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

## 🔧 Troubleshooting

### Common Issues

1. **Build Errors**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **API Connection Issues**
   - Verify VITE_API_URL in .env
   - Check backend server is running
   - Inspect network tab in browser

3. **Type Errors**
   ```bash
   # Run type checking
   npm run type-check
   ```

4. **Hot Reload Not Working**
   ```bash
   # Restart development server
   npm run dev
   ```

### Debug Mode
Set `VITE_ENABLE_DEBUG=true` in .env to enable detailed logging.

## 📊 Performance

### Optimization Features
- **Code Splitting** - Automatic route-based splitting
- **Tree Shaking** - Dead code elimination
- **Image Optimization** - Lazy loading and compression
- **Caching** - Aggressive caching with TanStack Query

### Bundle Analysis
```bash
npm run build
npm run analyze
```

## 🧪 Testing

### Test Setup (Future Enhancement)
```bash
# Install testing dependencies
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage
```

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/new-feature`
2. Follow TypeScript and React best practices
3. Test thoroughly in multiple browsers
4. Update documentation as needed
5. Create Pull Request

### Coding Standards
- Use TypeScript for all new code
- Follow React hooks patterns
- Implement proper error handling
- Use semantic HTML and accessibility features
- Write self-documenting code with clear names

## 📱 Browser Support

- **Modern Browsers** - Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Mobile** - iOS Safari, Chrome Mobile
- **Responsive Design** - Works on all screen sizes

## 🔐 Security

- **XSS Protection** - Input sanitization and output encoding
- **CSRF Protection** - Server-side token validation
- **Secure Authentication** - HTTP-only session cookies
- **Content Security Policy** - Configured for production builds

## 📞 Support

- **Documentation** - This README and inline code comments
- **Issues** - Use GitHub Issues for bug reports
- **Feature Requests** - Submit via Pull Requests

---

**Built with ❤️ for Golden Luxury Auto**