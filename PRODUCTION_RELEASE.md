# Production release

## Required server environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET`
- `TWILIO_EXECUTION_ENABLED` (`false` during smoke tests; `true` only for controlled operator execution)

Never expose Twilio variables with a `NEXT_PUBLIC_` prefix.

## Database migrations

Back up and review the target database, then run from the project root:

```powershell
npx supabase db push
```

This applies the ordered files under `supabase/migrations/`. Do not run it until the target project is explicitly linked and approved. Verify unique constraints and RLS after application.

## Deployment

1. Set `TWILIO_EXECUTION_ENABLED=false`.
2. Apply reviewed migrations manually.
3. Run `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run lint`, and `npm run build`.
4. Deploy the built application through the approved platform process.
5. Sign in and test import plus Available Numbers read-only search.
6. Run Purchase and TFV Dry Run for one controlled client.
7. Set `TWILIO_EXECUTION_ENABLED=true` only in the production server environment.
8. Purchase one approved toll-free number with operator confirmation; verify PN SID and audit rows.
9. Submit one approved English TFV draft; verify one HH SID, snapshot, link, and audit rows.
10. Sync that HH SID and verify the exact remote status is persisted.
11. Return the execution flag to `false` if the controlled verification fails.
