import React, { useState } from 'react';
import { Settings, Radio, Database, BarChart, Shield, Code } from 'lucide-react';
import { ConfigurationPage } from './components/demo/ConfigurationPage';
import { ApiTestingPage } from './components/demo/ApiTestingPage';
import { CachingPage } from './components/demo/CachingPage';
import { MonitoringPage } from './components/demo/MonitoringPage';
import { AuthorizationPage } from './components/demo/AuthorizationPage';
import { CodeExamplesPage } from './components/demo/CodeExamplesPage';
import { Toaster } from './components/ui/sonner';
import Favicon from './imports/Favicon1';

declare global {
  interface Window {
    DataClientLoaded: boolean;
    DataClientError: string | null;
    DataClient?: any;
  }
}

export default function App() {
  const [activeSection, setActiveSection] = useState('configuration');

  const renderContent = () => {
    switch (activeSection) {
      case 'configuration':
        return <ConfigurationPage />;
      case 'api-testing':
        return <ApiTestingPage />;
      case 'caching':
        return <CachingPage />;
      case 'monitoring':
        return <MonitoringPage />;
      case 'authorization':
        return <AuthorizationPage />;
      case 'code-examples':
        return <CodeExamplesPage />;
      default:
        return <ConfigurationPage />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <DemoSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

// Custom Sidebar for Demo App
function DemoSidebar({ activeSection, onSectionChange }: { activeSection: string; onSectionChange: (section: string) => void }) {
  const navigationItems = [
    { id: 'configuration', label: 'Configuration', icon: Settings },
    { id: 'api-testing', label: 'API Testing', icon: Radio },
    { id: 'caching', label: 'Caching & Storage', icon: Database },
    { id: 'monitoring', label: 'Monitoring & Logs', icon: BarChart },
    { id: 'authorization', label: 'Authorization', icon: Shield },
    { id: 'code-examples', label: 'Code Examples', icon: Code },
  ];

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10">
            <Favicon />
          </div>
          <div>
            <h1 className="text-sidebar-foreground font-medium">AI Fabrix</h1>
            <p className="text-sm text-muted-foreground">MISO Data Client</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4" role="navigation" aria-label="Main navigation">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = activeSection === item.id;
            const Icon = item.icon;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                    ${isActive 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Version</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>Environment</span>
            <span className="font-medium text-green-600">Development</span>
          </div>
        </div>
      </div>
    </div>
  );
}