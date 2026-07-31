﻿'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

interface AvailableNumber {
  phone_number: string;
  friendly_name: string;
  locality: string;
}

export default function FindPurchasePage() {
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [areaCode, setAreaCode] = useState('');
  const [contains, setContains] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [clientId,setClientId]=useState('');
  const [operationId,setOperationId]=useState(()=>crypto.randomUUID());
  const [purchaseResults,setPurchaseResults]=useState<Array<{requestedNumber:string;status:string;errorMessage:string|null}>>([]);
  const [purchasing,setPurchasing]=useState(false);

  const handleSearch = async () => {
    setError(null);
    const params = new URLSearchParams();
    if (areaCode) params.set('areaCode', areaCode);
    if (contains) params.set('contains', contains);
    try {
      const response = await fetch(`/api/twilio/available-phone-numbers?${params}`);
      const data = await response.json() as { available_phone_numbers?: AvailableNumber[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Search failed.');
      setNumbers(data.available_phone_numbers ?? []);
    } catch (searchError) {
      setNumbers([]);
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    }
  };

  const handleSelectNumber = (phoneNumber: string) => {
    setSelectedNumbers(prev => 
      prev.includes(phoneNumber) 
        ? prev.filter(n => n !== phoneNumber) 
        : [...prev, phoneNumber]
    );
  };

  const handlePurchase=async()=>{if(!clientId||selectedNumbers.length===0||purchasing){setError('Select a client and at least one number.');return;}if(!window.confirm(`Purchase ${selectedNumbers.length} number(s) for client ${clientId}? Operation ${operationId}. This action is irreversible and may incur Twilio charges.`))return;setPurchasing(true);setError(null);try{const response=await fetch('/api/twilio/purchases',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,phoneNumbers:selectedNumbers,operationId,operatorConfirmed:true,dryRun:false})});const data=await response.json() as {items?:Array<{requestedNumber:string;status:string;errorMessage:string|null}>;error?:string};if(!response.ok)throw new Error(data.error??'Purchase failed.');setPurchaseResults(data.items??[]);setOperationId(crypto.randomUUID());}catch(e){setError(e instanceof Error?e.message:'Purchase failed.');}finally{setPurchasing(false);}};

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Find & Purchase Numbers</h1>
      <div className="space-y-4 max-w-md mb-8">
        <div><Label htmlFor="purchase-client">Client ID</Label><Input id="purchase-client" value={clientId} onChange={e=>setClientId(e.target.value)} /></div>
        <div><Label htmlFor="purchase-operation">Operation ID</Label><Input id="purchase-operation" value={operationId} readOnly /></div>
        <div>
          <Label htmlFor="area-code">Area Code or Prefix</Label>
          <Input id="area-code" value={areaCode} onChange={(event) => setAreaCode(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="contains">Contains</Label>
          <Input id="contains" value={contains} onChange={(event) => setContains(event.target.value)} />
        </div>
        <Button onClick={handleSearch}>Search</Button>
      </div>

      {error ? <p role="alert" className="text-sm mb-4">{error}</p> : null}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Available Numbers</h2>
        <Button type="button" onClick={handlePurchase} disabled={purchasing||selectedNumbers.length===0||!clientId}>{purchasing?"Purchasing?":`Purchase Selected (${selectedNumbers.length})`}</Button>
      </div>

      {purchaseResults.length?<div role="status" className="mb-4 space-y-1">{purchaseResults.map(item=><p key={item.requestedNumber}>{item.requestedNumber}: {item.status}{item.errorMessage?` ? ${item.errorMessage}`:""}</p>)}</div>:null}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Select</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Locality</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {numbers.map((number) => (
              <TableRow key={number.phone_number}>
                <TableCell>
                  <Checkbox 
                    checked={selectedNumbers.includes(number.phone_number)}
                    onCheckedChange={() => handleSelectNumber(number.phone_number)}
                  />
                </TableCell>
                <TableCell>{number.friendly_name}</TableCell>
                <TableCell>{number.locality}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

