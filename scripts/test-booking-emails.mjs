import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const shared = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../supabase/functions/_shared/email.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports: shared },
);
const source = readFileSync(
  new URL("../supabase/functions/booking-emails/core.ts", import.meta.url),
  "utf8",
);
const exports = {};
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  {
    exports,
    require: (name) => {
      assert.equal(name, "../_shared/email.ts");
      return shared;
    },
    Intl,
    AbortSignal,
    Date,
    fetch: () => {
      throw Error("Network forbidden");
    },
  },
);
const { emailContent, sendJob, drain } = exports;
const base = {
  id: "job-1",
  booking_id: "11111111-1111-4111-8111-111111111111",
  kind: "customer_requested",
  recipient: "fixture@example.invalid",
  attempts: 1,
  payload: {
    id: "11111111-1111-4111-8111-111111111111",
    full_name: '<script>alert("x")</script>',
    service: "Portrait & Event",
    booking_date: "2027-01-01",
    start_time: "09:00:00",
    end_time: "11:00:00",
    location: "<img src=x onerror=alert(1)>",
    total_price: 5000,
    transportation_fee: 0,
    email: "fixture@example.invalid",
    phone: "09000000000",
    message: "Private note",
  },
};
const config = {
  key: "fixture-secret",
  from: "Studio <bookings@mail.example.invalid>",
};
let count = 0;
for (const kind of [
  "customer_requested",
  "studio_requested",
  "customer_confirmed",
  "booking_cancelled", "request_received", "request_resolved", "booking_message", "payment_rejected", "gallery_ready", "shoot_reminder", "delivery_overdue", "owner_booking_unseen",
]) {
  const content = emailContent({ ...base, kind });
  assert(!content.html.includes("<script>"));
  assert(!content.html.includes("<img src=x"));
  assert(content.html.includes("&lt;script&gt;"));
  assert(!content.html.includes(config.key));
  assert.equal(
    content.text.includes("Customer email:"),
    kind === "studio_requested",
  );
  assert.equal(
    content.text.includes("Private note"),
    kind === "studio_requested",
  );
  count += 6;
}
assert(emailContent(base).text.includes("does not confirm payment"));
assert(emailContent(base).text.includes("Balance if deposit is verified: ₱2,500.00"));
assert(emailContent(base).html.includes("/account/bookings?booking=" + base.booking_id));
assert(!emailContent({...base,kind:"booking_cancelled",payload:{...base.payload,remaining_balance:5000}}).text.includes("Outstanding balance"));
count += 3;
count++;
let requests = [];
const fetcher = async (url, init) => {
  requests.push({ url, init, body: JSON.parse(init.body) });
  return new Response(JSON.stringify({ id: "email-id" }), { status: 200 });
};
assert.equal((await sendJob(base, config, fetcher)).ok, true);
await sendJob(base, config, fetcher);
assert.equal(
  requests[0].init.headers["Idempotency-Key"],
  requests[1].init.headers["Idempotency-Key"],
);
await sendJob(
  { ...base, kind: "studio_requested", recipient: "attacker@example.invalid" },
  config,
  fetcher,
);
assert.deepEqual(requests[2].body.to, ["tutokpitikstudios@gmail.com"]);
assert.equal(requests[0].body.reply_to, "tutokpitikstudios@gmail.com");
count += 4;
for (const status of [400, 401, 403, 429, 500]) {
  const result = await sendJob(
    base,
    config,
    async () => new Response("secret response with key", { status }),
  );
  assert.equal(result.ok, false);
  assert(!result.error.includes("secret"));
  count += 2;
}
const changes = [];
const db = {
  rpc: async (name, args) => {
    assert.equal(name, "claim_booking_emails");
    assert.equal(args.p_booking, base.booking_id);
    return { data: [base], error: null };
  },
  from: () => ({
    update: (patch) => ({
      eq: () => ({
        eq: async () => {
          changes.push(patch);
          return { error: null };
        },
      }),
    }),
  }),
};
let result = await drain(db, config, base.booking_id, fetcher);
assert.equal(result.sent, 1);
assert.equal(changes[0].state, "sent");
assert.equal(changes[0].provider_id, "email-id");
count += 3;
result = await drain(db, config, base.booking_id, async () => {
  throw Error("secret credential");
});
assert.equal(result.failed, 1);
assert.equal(changes[1].state, "failed");
assert(!changes[1].last_error.includes("secret"));
count += 3;
const empty = { ...db, rpc: async () => ({ data: [], error: null }) };
result = await drain(empty, config, null, () => {
  throw Error("Must not resend");
});
assert.equal(result.sent, 0);
count++;
const broken = {
  ...db,
  rpc: async () => ({ data: null, error: { message: "private DB details" } }),
};
await assert.rejects(
  () => drain(broken, config, null),
  /Email queue unavailable/,
);
count++;
console.log(`${count} booking email checks passed (no network or real mail).`);
// All account templates share escaped, email-client-friendly markup.
for (const kind of ['welcome', 'profile']) {
  const content = shared.accountContent(kind, '<img src=x onerror=alert(1)>');
  assert(!content.html.includes('<img src=x'));
  assert(content.html.includes('&lt;img'));
  assert(content.html.includes('role="presentation"'));
}
const authConfig = JSON.parse(readFileSync(new URL('../supabase/templates/auth-config.json', import.meta.url), 'utf8'));
assert.equal(authConfig.rate_limit_email_sent, 100);
for (const kind of ['confirmation', 'invite', 'magic_link', 'email_change', 'recovery']) {
  const template = authConfig[`mailer_templates_${kind}_content`];
  assert(template.includes('href="{{ .ConfirmationURL }}"'), 'Provider-generated secure action must survive rendering');
  assert(!template.includes('{{ .Data'), 'Untrusted metadata is not interpolated into security emails');
}
assert(authConfig.mailer_templates_reauthentication_content.includes('{{ .Token }}'));
console.log('Branded account templates preserve secure provider links and escape profile values.');

for(const kind of ['request_received','delivery_overdue']){const job={...base,kind,recipient:'wrong@example.invalid',payload:{...base.payload,studio:true,notice:'<script>unsafe</script>'}};const content=emailContent(job);assert(content.html.includes('/admin/bookings/'));assert(content.html.includes('&lt;script&gt;unsafe'));assert(!content.html.includes('<script>'));await sendJob(job,config,fetcher);assert.deepEqual(requests.at(-1).body.to,['tutokpitikstudios@gmail.com']);}
console.log('All workflow templates and server-selected studio recipients verified.');

// Owner reminders select the official destination even when payload flags disagree.
{
 const job={...base,kind:'owner_booking_unseen',recipient:'attacker@example.invalid',payload:{...base.payload,studio:false,waiting_hours:2}};
 const content=emailContent(job);assert(content.subject.includes('not been opened'));assert(content.html.includes('/admin/bookings/'));assert(content.text.includes('2 hours'));assert(!content.text.includes('Private note'));assert(!content.text.includes('09000000000'));assert(!content.text.includes('Customer email:'));
 await sendJob(job,config,fetcher);assert.deepEqual(requests.at(-1).body.to,['tutokpitikstudios@gmail.com']);
 for(const eligible of [true,false,null]) {
  let calls=0;const updates=[];
  const ownerDb={rpc:async(name,args)=>name==='claim_booking_emails'?{data:[job],error:null}:(assert.equal(name,'studio_prepare_owner_reminder'),assert.equal(args.p_job,job.id),{data:eligible,error:null}),from:()=>({update:patch=>({eq:()=>({eq:async()=>{updates.push(patch);return {error:null};}})})})};
  const result=await drain(ownerDb,config,null,async(...args)=>{calls++;return fetcher(...args);});
  assert.equal(calls,eligible===true?1:0);assert.equal(result.skipped,eligible===true?0:1);assert.equal(updates.length,eligible===true?1:0);
 }
 let sent=0;const ownerDb={...db,rpc:async name=>name==='claim_booking_emails'?{data:[job],error:null}:{data:null,error:{message:'private database diagnostic'}}};
 const result=await drain(ownerDb,config,base.booking_id,async()=>{sent++;throw Error('must not send');});assert.equal(sent,0);assert.equal(result.failed,1);assert(!changes.at(-1).last_error.includes('private'));
}
console.log('Owner reminder recipient, private-content minimization and pre-send cancellation checks passed.');
