import { getClientById } from "@/lib/clients";
import { getTwilioConnection } from "@/lib/twilio-connections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TwilioConnectionForm } from "@/components/twilio/twilio-connection-form";


export default async function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const [client, twilioConnection] = await Promise.all([
    getClientById(params.clientId),
    getTwilioConnection(params.clientId),
  ]);

  if (!client) {
    return <div>Client not found.</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{client.legal_business_name}</h1>
        <p className="text-sm text-gray-500">{client.internal_client_id}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="font-medium">Status</span>
              <span 
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${client.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {client.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Authorization</span>
              <span 
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${client.authorization_confirmed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {client.authorization_confirmed ? "Confirmed" : "Pending"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Twilio Connection</CardTitle>
          </CardHeader>
          <CardContent>
            {twilioConnection ? (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="font-medium">Status</span>
                  <span 
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${twilioConnection.connection_status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {twilioConnection.connection_status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Account SID</span>
                  <span>{twilioConnection.account_sid_masked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Last Checked</span>
                  <span>{new Date(twilioConnection.last_checked_at).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <TwilioConnectionForm clientId={client.id} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
