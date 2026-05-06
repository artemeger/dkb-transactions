import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/Settings';
import Navigation from './components/Navigation';
import TitleBar from './components/TitleBar';

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <TitleBar />
        <Navigation />
        <main className="container mx-auto px-4 py-8 max-w-7xl pt-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </ThemeProvider>
  );
}
