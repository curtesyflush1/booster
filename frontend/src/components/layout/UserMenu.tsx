import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { User as UserType } from '../../types';
import {
  User,
  Settings,
  LogOut,
  ChevronDown
} from 'lucide-react';
import clsx from 'clsx';

interface UserMenuProps {
  user: UserType | null;
  isOpen: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

const UserMenu = memo<UserMenuProps>(({ user, isOpen, onToggle, onLogout }) => {
  const userMenuItems = useMemo(() => [
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Settings', href: '/settings', icon: Settings },
  ], []);

  const displayName = useMemo(() => {
    return user?.firstName || user?.email?.split('@')[0] || 'User';
  }, [user?.firstName, user?.email]);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg p-1"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User menu"
      >
        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4" />
        </div>
        <span className="hidden sm:block text-sm font-medium truncate max-w-24">
          {displayName}
        </span>
        <ChevronDown className={clsx("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-background-secondary rounded-lg shadow-lg border border-gray-700 py-1 z-50">
          {userMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onToggle}
                className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          <hr className="border-gray-700 my-1" />
          <button
            onClick={onLogout}
            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
});

UserMenu.displayName = 'UserMenu';

export default UserMenu;