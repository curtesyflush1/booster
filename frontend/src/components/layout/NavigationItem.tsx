import { memo } from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface NavigationItemProps {
  item: {
    name: string;
    href: string;
    icon: LucideIcon;
  };
  isActive: boolean;
  onClick?: () => void;
  className?: string;
}

const NavigationItem = memo<NavigationItemProps>(({ 
  item, 
  isActive, 
  onClick, 
  className = '' 
}) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={clsx(
        'flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary-600 text-white'
          : 'text-gray-300 hover:text-white hover:bg-gray-700',
        className
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      <span>{item.name}</span>
    </Link>
  );
});

NavigationItem.displayName = 'NavigationItem';

export default NavigationItem;