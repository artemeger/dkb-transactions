import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import Icon from './Icon';

const navItems = [
  { path: '/', label: 'Übersicht', icon: 'bar_chart' },
  { path: '/settings', label: 'Einstellungen', icon: 'settings' },
];

// Navigation title (hardcoded German)
const NAV_TITLE = 'DKB Bilanz';

export default function Navigation() {
  const location = useLocation();

  return (
    <nav className="bg-surface border-b border-border sticky top-0 z-50 shadow-card">
      {/* Backdrop blur effect for glassmorphism */}
      <div className="absolute inset-0 bg-surface/80 backdrop-blur-md" />
      
      <div className="container mx-auto px-4 max-w-7xl relative">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
            <Icon name="account_balance" size={24} /> {NAV_TITLE}
          </Link>
          
          <div className="flex items-center gap-2">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  location.pathname === item.path
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-surface-hover'
                }`}
              >
                <Icon name={item.icon} size={18} className="opacity-80" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
            
            {/* Theme Toggle */}
            <div className="w-[1px] h-6 bg-border mx-1" />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
