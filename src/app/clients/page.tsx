'use client';

import { useEffect, useState } from 'react';
import { getClients } from "./actions";
import { columns, Client } from "./columns";
import { DataTable } from "./data-table";
import ClientForm from "./client-form";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);

  const fetchClients = async () => {
    const data = await getClients();
    setClients(data);
  };

  useEffect(() => {
    let active=true;
    void getClients().then(data=>{if(active)setClients(data);});
    return()=>{active=false;};
  }, []);

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Clients</h1>
        <ClientForm onSave={fetchClients} />
      </div>
      <DataTable columns={columns} data={clients} />
    </div>
  );
}
