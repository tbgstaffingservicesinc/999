﻿'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from 'react';

export default function TfvPage() {
  const [step, setStep] = useState(1);
  const [clientId,setClientId]=useState('');
  const [phoneNumberIds,setPhoneNumberIds]=useState('');
  const [operationId,setOperationId]=useState(()=>crypto.randomUUID());
  const [message,setMessage]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const submit=async()=>{const ids=phoneNumberIds.split(',').map(v=>v.trim()).filter(Boolean);if(!clientId||!ids.length){setMessage('Enter a client ID and at least one purchased phone-number record ID.');return;}if(!window.confirm(`Submit ${ids.length} TFV request(s)? Operation ${operationId}. Each PN SID creates one irreversible Twilio verification request.`))return;setLoading(true);try{const response=await fetch('/api/twilio/tfv',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,phoneNumberIds:ids,operationId,operatorConfirmed:true,dryRun:false,profile:{mode:'WITHOUT_PROFILE'}})});const data=await response.json() as {results?:Array<{applicationId:string;status:string;errors:string[]}>;error?:string};if(!response.ok)throw new Error(data.error??'TFV submission failed.');setMessage((data.results??[]).map(r=>`${r.applicationId}: ${r.status}${r.errors.length?` ? ${r.errors.join('; ')}`:''}`).join(' | '));setOperationId(crypto.randomUUID());}catch(e){setMessage(e instanceof Error?e.message:'TFV submission failed.');}finally{setLoading(false);}};

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Toll-Free Verification</h1>

      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Step 1: Business Information</h2>
          <div className="space-y-4 max-w-md">
            <div><Label htmlFor="tfv-client">Client ID</Label><Input id="tfv-client" value={clientId} onChange={e=>setClientId(e.target.value)} /></div>
            <div><Label htmlFor="tfv-phones">Purchased Phone Number Record IDs (comma separated)</Label><Input id="tfv-phones" value={phoneNumberIds} onChange={e=>setPhoneNumberIds(e.target.value)} /></div>
            <div><Label htmlFor="tfv-operation">Operation ID</Label><Input id="tfv-operation" value={operationId} readOnly /></div>
            <div>
              <Label htmlFor="business-name">Legal Business Name</Label>
              <Input id="business-name" />
            </div>
            <div>
              <Label htmlFor="business-website">Business Website</Label>
              <Input id="business-website" />
            </div>
            <Button onClick={() => setStep(2)}>Next</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Step 2: Use Case</h2>
          <div className="space-y-4 max-w-md">
            <div>
              <Label htmlFor="use-case">Messaging Use Case</Label>
              <Textarea id="use-case" />
            </div>
            <Button onClick={() => setStep(1)}>Previous</Button>
            <Button type="button" onClick={submit} disabled={loading}>{loading?"Submitting?":"Submit TFV"}</Button>
          </div>
        </div>
      )}
      {message?<p role="status" className="mt-4 text-sm">{message}</p>:null}
    </div>
  );
}

