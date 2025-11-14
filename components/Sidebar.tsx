'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, X, ChevronLeft, ChevronRight, GitBranch, Mail, Users, ClipboardCheck, Wand2 } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { isCollapsed, setIsCollapsed } = useSidebar();

  useEffect(() => {
    // Get user role from localStorage
    const role = localStorage.getItem('user_role');
    setUserRole(role);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    router.push('/login');
  };

  const allMenuItems = [
    {
      name: 'Prompt Difficulty Evaluator',
      shortName: 'Evaluator',
      path: '/dashboard/evaluator',
      icon: Mail,
      roles: ['ADMIN', 'HDM'],
    },
    {
      name: 'JSON State Validator',
      shortName: 'Validator',
      path: '/dashboard/json-validator-v2',
      icon: GitBranch,
      roles: ['ADMIN', 'HDM'],
    },
    {
      name: 'Rubrics Creator',
      shortName: 'Rubrics',
      path: '/dashboard/rubrics-creator',
      icon: ClipboardCheck,
      roles: ['ADMIN', 'HDM'],
    },
    {
      name: 'Prompt Generator',
      shortName: 'Generator',
      path: '/dashboard/prompt-generator',
      icon: Wand2,
      roles: ['ADMIN', 'HDM'],
    },
    {
      name: 'User Management',
      shortName: 'Users',
      path: '/dashboard/users',
      icon: Users,
      roles: ['ADMIN'], // Only visible to ADMIN
    },
  ];

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter(item =>
    userRole && item.roles.includes(userRole)
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-100 hover:bg-zinc-800/70 transition-colors"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 bg-zinc-900 border-r border-zinc-700 transform transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'w-20' : 'w-72'}`}
      >
        <div className="flex flex-col h-screen">
          {/* Header */}
          <div className={`p-6 border-b border-zinc-700 flex-shrink-0 ${isCollapsed ? 'p-4' : ''}`}>
            {!isCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-zinc-50 whitespace-nowrap">Nexus Eval</h1>
                <p className="text-xs text-zinc-400 whitespace-nowrap">AI Evaluation Platform</p>
              </div>
            )}
          </div>

          {/* Navigation - con scroll overflow */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium text-sm leading-tight">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Collapse toggle button - Desktop only */}
          <div className="hidden lg:block flex-shrink-0 p-4 border-t border-zinc-700">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors ${
                isCollapsed ? 'justify-center' : ''
              }`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm">Collapse</span>
                </>
              )}
            </button>
          </div>

          {/* Logout button */}
          <div className="flex-shrink-0 p-4 border-t border-zinc-700">
            <button
              onClick={handleLogout}
              title={isCollapsed ? 'Logout' : undefined}
              className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium text-sm">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-10"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}

