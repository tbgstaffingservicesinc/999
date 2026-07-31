'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const clientSchema = z.object({
  internal_client_id: z.string().min(1, 'Client ID is required'),
  legal_business_name: z.string().min(1, 'Business name is required'),
  // Add other fields here
});

type ClientFormValues=z.infer<typeof clientSchema>;
type EditableClient=Partial<ClientFormValues>&{id:string};
export default function ClientForm({ client, onSave }: { client?: EditableClient, onSave: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {internal_client_id:client?.internal_client_id??"",legal_business_name:client?.legal_business_name??""},
  });

  const onSubmit = async (data: ClientFormValues) => {
    const url = client ? `/api/clients/${client.id}` : '/api/clients';
    const method = client ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      onSave();
    } else {
      const error = await response.json();
      alert(`Error: ${error.error}`);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{client ? 'Edit Client' : 'Add Client'}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? 'Edit Client' : 'Add Client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="internal_client_id">Client ID</Label>
            <Input id="internal_client_id" {...register('internal_client_id')} />
            {errors.internal_client_id?.message && typeof errors.internal_client_id.message === 'string' && <p className="text-red-500 text-sm">{errors.internal_client_id.message}</p>}
          </div>
          <div>
            <Label htmlFor="legal_business_name">Legal Business Name</Label>
            <Input id="legal_business_name" {...register('legal_business_name')} />
            {errors.legal_business_name?.message && typeof errors.legal_business_name.message === 'string' && <p className="text-red-500 text-sm">{errors.legal_business_name.message}</p>}          </div>
          <Button type="submit">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
