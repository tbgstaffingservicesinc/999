'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ClientForm from './client-form';

// This type is a placeholder for your database schema.
export type Client = {
  id: string;
  internal_client_id: string;
  legal_business_name: string;
  active: boolean;
  authorization_confirmed: boolean;
};

export const columns: ColumnDef<Client>[] = [
  {
    accessorKey: 'internal_client_id',
    header: 'Client ID',
  },
  {
    accessorKey: 'legal_business_name',
    header: 'Business Name',
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => {
      const client = row.original;
      return (
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            client.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {client.active ? 'Active' : 'Inactive'}
        </span>
      );
    },
  },
  {
    accessorKey: 'authorization_confirmed',
    header: 'Authorization',
    cell: ({ row }) => {
        const client = row.original;
        return client.authorization_confirmed ? 'Confirmed' : 'Pending';
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const client = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(client.id)}
            >
              Copy client ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <ClientForm client={client} onSave={() => {}} />
            </DropdownMenuItem>
            <DropdownMenuItem>View client details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
