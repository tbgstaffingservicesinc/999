import Link from "next/link";
import { Users, Upload, Phone, FileText, BarChart, Settings } from 'lucide-react';

const navigation = [
  { name: 'Find & Purchase', href: '/find-purchase', icon: Phone },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'TFV Applications', href: '/tfv', icon: FileText },
  { name: 'Status', href: '/status', icon: BarChart },
  { name: 'Audit', href: '/audit', icon: BarChart },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <div className="flex flex-col w-64 bg-gray-50 border-r border-gray-200">
      <div className="flex items-center justify-center h-16 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold">Twilio TFN Console</h1>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center px-2 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100"
          >
            <item.icon className="w-6 h-6 mr-3" />
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}
