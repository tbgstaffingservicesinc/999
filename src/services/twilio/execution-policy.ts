export function isTwilioExecutionEnabled(environment:Readonly<Record<string,string|undefined>>=process.env):boolean{return environment.TWILIO_EXECUTION_ENABLED?.trim().toLowerCase()==="true";}
