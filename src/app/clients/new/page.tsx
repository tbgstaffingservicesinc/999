
import { CreateClientForm } from '@/components/clients/create-client-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function NewClientPage() {
  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Add a New Client</CardTitle>
          <CardDescription>
            Enter the details for the new client. Only the legal business name is required to start.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
