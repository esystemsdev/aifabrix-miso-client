# CollectPro - Collections Management Platform

A comprehensive collections management platform with enterprise-grade navigation, integration management, and AI-powered assistance.

## 🚀 Features

### Navigation System

- **6 Main Sections**: Dashboard, External Systems, Integration Templates, Audit & Logs, Administration, AI Assist
- **Multiple Navigation Patterns**: Breadcrumbs, Tabs, Sub-navigation
- **Keyboard Shortcuts**: Full keyboard navigation support (Alt + Key)
- **Accessibility**: WCAG compliant with ARIA labels and screen reader support
- **Responsive Design**: Desktop, tablet, and mobile layouts

### Core Functionality

#### Dashboard (NEW in v2.1)

- **Environment Overview**: System version, component health, queue latency
- **System Health Monitoring**: Real-time status for all external systems
- **Active Sync Jobs**: Live tracking of data synchronization operations
- **CIP Pipeline Health**: Operation-level health heatmap (list/get/create/update/delete)
- **Developer Insights**: Schema drift, field mapping coverage, CIP integrity, data quality
- **Security & Audit Summary**: RBAC/ABAC tracking, sensitive field blocks, policy changes
- **Quick Actions**: Create systems, start syncs, view errors
- **Real-time Metrics**: Comprehensive KPIs and health indicators

#### External Systems

- System integration management
- Multiple data source connections
- System health monitoring
- Import/export capabilities

#### Integration Templates

- Reusable integration templates
- OpenAPI specification support
- Version control
- Template marketplace

#### Audit & Logs

- Comprehensive event logging
- Sync logs tracking
- ABAC permission logs
- Publishing history
- System event monitoring

#### Administration

- Secrets management
- Environment configuration
- System diagnostics
- Security settings

#### AI Assist

- Context-aware assistance
- Code generation
- Log analysis
- Troubleshooting support

## 🎨 Design System

### Icons

All icons use the Lucide React icon set for consistency:

- **Dashboard**: Gauge
- **External Systems**: Layers
- **Integration Templates**: Blocks
- **Audit & Logs**: History
- **Administration**: Settings
- **AI Assist**: Sparkles

### Color Scheme

- High contrast for accessibility
- Consistent use of design tokens
- Clear visual hierarchy
- Semantic colors for states

## ⌨️ Keyboard Shortcuts

| Shortcut  | Action                            |
| --------- | --------------------------------- |
| `Alt + D` | Navigate to Dashboard             |
| `Alt + E` | Navigate to External Systems      |
| `Alt + I` | Navigate to Integration Templates |
| `Alt + A` | Navigate to Audit & Logs          |
| `Alt + S` | Navigate to Administration        |
| `Alt + /` | Navigate to AI Assist             |
| `Esc`     | Close modals and dialogs          |

## 📁 Project Structure

```
/
├── components/
│   ├── navigation/          # Navigation components
│   │   ├── NavItem.tsx
│   │   ├── Breadcrumb.tsx
│   │   ├── TabNavigation.tsx
│   │   ├── SubNavigation.tsx
│   │   ├── MobileNav.tsx
│   │   ├── KeyboardShortcutsHelp.tsx
│   │   └── index.ts
│   ├── ui/                  # UI components
│   ├── Dashboard.tsx        # Main dashboard
│   ├── ExternalSystems.tsx  # External systems management
│   ├── IntegrationTemplates.tsx
│   ├── AuditLogs.tsx
│   ├── Administration.tsx
│   ├── AIAssist.tsx
│   └── Sidebar.tsx          # Main navigation sidebar
├── hooks/
│   └── useKeyboardNavigation.ts
├── docs/
│   ├── NAVIGATION.md        # Navigation system docs
│   └── COMPONENT_GUIDE.md   # Component usage guide
├── styles/
│   └── globals.css          # Global styles and tokens
└── App.tsx                  # Main application
```

## 🛠️ Development

### Navigation Components

#### NavItem

Individual navigation item with active states and badges.

```tsx
<NavItem
  icon={Gauge}
  label="Dashboard"
  active={true}
  badge={5}
  onClick={() => navigate("dashboard")}
/>
```

#### Breadcrumb

Contextual navigation showing current page hierarchy.

```tsx
<Breadcrumb
  items={[
    { label: "Home", href: "/" },
    { label: "Section", current: true },
  ]}
/>
```

#### TabNavigation

Horizontal tabs for detail pages.

```tsx
<TabNavigation
  tabs={[
    { id: "overview", label: "Overview" },
    { id: "settings", label: "Settings" },
  ]}
  activeTab="overview"
  onChange={setActiveTab}
/>
```

#### SubNavigation

Secondary navigation for section views.

```tsx
<SubNavigation
  items={[
    { id: "list", label: "List View" },
    { id: "create", label: "Create New" },
  ]}
  activeItem="list"
  onChange={setActiveItem}
/>
```

### Creating a New Page

Follow this template for consistency:

```tsx
import React from "react";
import { Breadcrumb } from "./navigation/Breadcrumb";

export function MyPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="px-6 py-4 border-b border-border">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "My Page", current: true },
          ]}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Your content */}
        </div>
      </div>
    </div>
  );
}
```

## 📱 Responsive Design

### Desktop (> 1024px)

- Left sidebar always visible (240px fixed width)
- Full breadcrumb navigation
- All labels and icons visible

### Tablet (768px - 1024px)

- Collapsible sidebar
- Icon-only mode when collapsed
- Truncated breadcrumbs

### Mobile (< 768px)

- Hamburger menu
- Drawer navigation
- Simplified breadcrumbs
- Touch-optimized interactions

## ♿ Accessibility

### WCAG Compliance

- High contrast mode support
- Keyboard navigation
- Screen reader compatibility
- Focus management
- Skip links

### ARIA Labels

- Descriptive navigation labels
- Current page indicators
- Role definitions
- State announcements

## 🔗 Navigation Flows

### Dashboard → External Systems

```
Dashboard
  → External Systems (click nav item)
    → Systems List (default view)
      → System Detail (click system)
        → Datasource Detail (click datasource)
```

### Dashboard → Integration Templates

```
Dashboard
  → Integration Templates (click nav item)
    → Templates List (default view)
      → Template Detail (click template)
```

### Dashboard → Audit & Logs

```
Dashboard
  → Audit & Logs (click nav item)
    → All Logs (default view)
      → Filter by type (tabs)
      → Log Detail (click entry)
```

## 📚 Documentation

- [Navigation System](./docs/NAVIGATION.md) - Complete navigation architecture
- [Component Guide](./docs/COMPONENT_GUIDE.md) - Component usage and patterns

## 🎯 Best Practices

### Navigation

1. Always include breadcrumb navigation
2. Use consistent spacing and layout
3. Provide clear page titles and descriptions
4. Include loading and empty states
5. Test keyboard navigation
6. Verify accessibility

### Code Style

1. Use TypeScript for type safety
2. Follow component patterns
3. Maintain consistent naming
4. Document complex logic
5. Use semantic HTML
6. Keep components focused

## 🚦 Status

- ✅ Navigation system implemented
- ✅ All 6 main sections created
- ✅ Breadcrumb navigation
- ✅ Tab navigation
- ✅ Sub-navigation
- ✅ Keyboard shortcuts
- ✅ Accessibility features
- ✅ Responsive design
- ✅ Documentation

## 🔮 Future Enhancements

- [ ] Command palette (Cmd/Ctrl + K)
- [ ] Search functionality
- [ ] Recently viewed sections
- [ ] Favorites/bookmarks
- [ ] Deep linking support
- [ ] Analytics integration
- [ ] Mobile app
- [ ] Offline support

## 📄 License

Proprietary - All rights reserved

## 🤝 Contributing

Please read the documentation before contributing:

1. Review navigation patterns
2. Follow component guidelines
3. Test accessibility
4. Update documentation
5. Submit pull request

---

Built with ❤️ using React, TypeScript, and Tailwind CSS