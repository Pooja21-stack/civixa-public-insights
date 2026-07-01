# CivIxa Frontend - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Navigate to the web app directory:**
```bash
cd apps/web
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
Create a `.env.local` file in `apps/web/`:
```bash
# Optional: For Mapbox heatmap (get free token at https://account.mapbox.com/access-tokens/)
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here

# API endpoint (if backend is running)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. **Run the development server:**
```bash
npm run dev
```

5. **Open your browser:**
Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
apps/web/
├── src/
│   ├── app/                    # Next.js 14 App Router pages
│   │   ├── page.tsx           # Homepage (/)
│   │   ├── submit/            # Submission form (/submit)
│   │   ├── dashboard/         # MP Dashboard (/dashboard)
│   │   ├── globals.css        # Global styles
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   │   ├── Navbar.tsx         # Navigation bar
│   │   ├── SubmissionForm.tsx # Citizen submission form
│   │   ├── DashboardStatsPanel.tsx
│   │   ├── PriorityProjectsList.tsx
│   │   ├── DemandHeatmap.tsx
│   │   ├── SubmissionsFeed.tsx
│   │   └── ui.tsx             # Reusable UI components
│   ├── lib/                   # Utilities
│   │   ├── api.ts             # API client
│   │   ├── api-mock.ts        # Mock data for demo
│   │   ├── constants.ts       # App constants
│   │   └── mock-data.ts       # Sample data
│   └── types/                 # TypeScript types
│       └── index.ts
├── public/                    # Static assets
├── tailwind.config.ts         # Tailwind CSS configuration
├── next.config.mjs            # Next.js configuration
└── package.json
```

## 🎨 Design System

The frontend uses a modern design system with:
- **Soft pastel colors**: Pink, blue, green, purple
- **Glassmorphism**: Backdrop blur effects
- **Smooth animations**: Fade, slide, scale transitions
- **Responsive design**: Mobile-first approach
- **Accessibility**: WCAG AA compliant

See [`docs/FRONTEND_DESIGN.md`](../../docs/FRONTEND_DESIGN.md) for complete design documentation.

## 🔧 Available Scripts

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Type checking
npm run type-check
```

## 📱 Pages Overview

### 1. Homepage (`/`)
- Hero section with animated background
- Feature showcase
- Call-to-action buttons
- Trust indicators

### 2. Submit Page (`/submit`)
- Multilingual submission form
- Text, voice, and photo input
- Category and ward selection
- Real-time validation
- Success/error states

### 3. Dashboard (`/dashboard`)
- Statistics panel with charts
- Priority projects list (AI-ranked)
- Interactive demand heatmap
- Recent submissions feed
- Export PDF functionality

## 🎯 Key Features

### Multilingual Support
- Auto-detect language
- Translate to English for AI processing
- Support for Hindi, Tamil, Bengali, etc.

### Voice Input
- Browser-based voice recording
- Whisper API transcription
- No additional setup required

### AI-Powered Insights
- Theme extraction
- Urgency scoring
- Demand clustering
- Priority ranking

### Interactive Heatmap
- Mapbox GL JS integration
- Demand intensity visualization
- Ward boundaries
- Zoom and pan controls

## 🔌 API Integration

The frontend is designed to work with mock data by default. To connect to the real backend:

1. Ensure the FastAPI backend is running (see `apps/api/README.md`)
2. Update `NEXT_PUBLIC_API_URL` in `.env.local`
3. Replace mock API calls in `src/lib/api-mock.ts` with real API calls from `src/lib/api.ts`

## 🎨 Customization

### Colors
Edit `tailwind.config.ts` to customize the color palette:
```typescript
colors: {
  primary: { /* your colors */ },
  mint: { /* your colors */ },
  // ...
}
```

### Animations
Modify animation timings in `tailwind.config.ts`:
```typescript
animation: {
  'fade-in': 'fadeIn 0.5s ease-in-out',
  // ...
}
```

### Components
All components are in `src/components/` and use Tailwind CSS for styling.

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use a different port
npm run dev -- -p 3001
```

### TypeScript Errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Mapbox Not Loading
- Ensure `NEXT_PUBLIC_MAPBOX_TOKEN` is set in `.env.local`
- Get a free token at https://account.mapbox.com/access-tokens/
- Restart the dev server after adding the token

## 📦 Dependencies

### Core
- **Next.js 14**: React framework with App Router
- **React 18**: UI library
- **TypeScript**: Type safety

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **clsx**: Conditional class names

### Data Visualization
- **Recharts**: Charts and graphs
- **Mapbox GL JS**: Interactive maps

### Forms
- **react-hook-form**: Form validation and management

## 🚢 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy automatically

### Other Platforms
```bash
# Build for production
npm run build

# The output will be in .next/
# Deploy the .next/ folder to your hosting provider
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [React Hook Form Documentation](https://react-hook-form.com/)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

See the main project LICENSE file.

---

**Need Help?** Check the main project README or open an issue on GitHub.