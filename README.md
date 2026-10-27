# Naveen Airtech — Billing

A billing counter for Naveen Airtech (Chengalpattu). Pick the buyer, tap the parts, settle the
price, and the printed invoice comes out matching the firm's existing Tally bill exactly.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Screens

| Screen | What it does |
| --- | --- |
| New Bill | Pick the buyer, add items, open the preview |
| Repeat Bill | Send an earlier bill out again, with a search over companies and parts |
| Invoices | Every saved bill — search, reprint, edit, delete |
| Products | The catalogue — name, HSN, unit, rate, GST slab |
| Companies | The buyers — address, GSTIN, state |
| Settings | Your own firm block, the buyer list, seed-data controls |

## How it works

**The "from" company is the same on every bill.** Naveen Airtech's name, address, phone, email,
GSTIN, declaration and bank line print verbatim at the top of each invoice. The original wording
lives in `src/lib/seller.ts`; **Settings → Your firm → Edit** can correct it (a phone number, the
bank line) and **Reset** puts the original back. The billing screen cannot touch it.

**The "to" company** is picked from the dropdown, added on the spot with **+ New**, or corrected
with the **Edit** button on the consignee card. Settings holds the same list.

**Tax follows the buyer's state.**

| Buyer's state | Tax on the bill |
| --- | --- |
| Tamil Nadu | CGST 9% + SGST 9% (half the product's GST rate each) |
| Puducherry / anywhere else | IGST at the full rate |

The billing screen shows which one is active and has a **Force** toggle if a bill ever needs the
other treatment.

**The top-right block is typed by hand** — invoice number, date, mode/terms of payment, customer PO
no., despatch through, destination, terms of delivery. Invoice numbering is deliberately manual,
since the firm also writes bills by hand on a separate series.

**GST is separated per HSN/SAC.** Every product carries its own HSN code and GST rate. Lines
sharing an HSN are summed into one row of the tax summary — all the motors under 8501 give one
figure, all the bolts under 7318 another, exactly as the printed bill does.

**Rounding** follows the bill: the grand total is rounded to the nearest rupee and the difference
shows on the "Rounded Off" line.

## Bargaining in the preview

The catalogue rate is only a starting figure. **Preview & Print** opens the bill at full size with
four kinds of cell live — click any of them and type the agreed number.

| Cell | What happens |
| --- | --- |
| Quantity | Line amount follows |
| Rate | Line amount follows |
| Amount | Works backwards to the rate, so the line lands exactly on the figure agreed |
| **Sub Total** or **Total** | Spread back over every line in proportion — "make it twenty thousand all-in" |

Every edit re-runs the whole calculation: GST, the HSN summary, the round-off, the grand total and
the amount in words all follow the final price. Changes affect that bill only — the catalogue rate
is never touched.

Rates are held to four decimals internally so a bargained total divides back out cleanly: three
units talked down to ₹10,000 print as rate 3,333.33 and amount 10,000.00, not 9,999.99.

## Repeat Bill

For the companies that buy the same handful of parts over and over. The page groups past bills by
company, with a search across company name, invoice number, PO number and the part names on the
bill.

**Use again** opens that bill as a fresh copy: same buyer, same items, same prices, with the
invoice number cleared and the date set to today — both still typed by hand, as always. Change
quantities, change prices, add or drop parts, then save. It files as a **new** invoice; the
original is left exactly as it was. The same **Use again** button sits on each row of the Invoices
screen.

## Printing, PDF and WhatsApp

**Save & Print** saves the bill and opens the browser print dialog. Set the printer to **A4,
portrait**, margins **Default**, and leave headers and footers off. The bill occupies exactly one
A4 sheet, and nothing but the bill is printed — the app's own screens are excluded.

**Save PDF** writes a single-page A4 PDF of the bill, named like
`Invoice-145-2026-2027-Primetec-Industries.pdf`.

**WhatsApp** builds the same PDF and hands it to the system share sheet where the browser supports
sharing files (Android, iOS, recent desktop Chrome on Windows). Everywhere else the PDF downloads
and WhatsApp Web opens with the message ready — addressed to the buyer's saved number when there is
one — so the only step left is attaching the file that just landed.

## Data

Out of the box everything is stored in the browser on this machine. Every read and write goes
through `src/lib/store.ts`, which picks a backend:

| Setup | Backend |
| --- | --- |
| No environment variables | `src/lib/backends/local.ts` — browser storage |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set | `src/lib/backends/supabase.ts` |

### Seed data

`src/lib/seed.ts` holds 53 compressor parts/consumables, 4 services and 6 buyer companies (three in
Tamil Nadu, two in Puducherry, plus Primetec Industries from the reference bill). It loads once, on
first open.

To clear it: **Settings → Clear all seed data**. To put it back: **Restore demo catalogue**.

## Moving to Supabase

Supabase runs the database. It does **not** host a web front-end, so the site itself goes to a
static host — Vercel, Netlify or Cloudflare Pages all have a free tier and all deploy this project
with `npm run build` and a `dist` output directory.

The project is already pointed at `ablhveylchqtnkuynkjz`. What is left:

1. **Run the schema.** Supabase dashboard → **SQL Editor → New query**, paste
   `supabase/schema.sql`, Run. That creates the four tables and turns on row level security.
2. **Create the one account.** **Authentication → Users → Add user**, with an email and password,
   and tick *Auto Confirm User*. There is no sign-up in the app by design — this is the only
   account, and it is created here.
3. **Paste the anon key.** `.env.local` already holds the project URL; fill in
   `VITE_SUPABASE_ANON_KEY` from **Project Settings → API Keys → anon public**.
4. `npm run dev` — the app now asks to sign in, then reads and writes Supabase.
5. Deploy `dist` to the static host, setting the same two environment variables there.

Until the anon key is filled in, the app keeps running on this machine's browser storage, so
nothing breaks halfway through the setup.

### Signing in

One email and password, typed once per device. The session is kept in that browser's storage and
the token is renewed in the background, so every later visit opens straight to the bill — no
retyping. The account's email and a **sign-out** button sit at the foot of the sidebar; signing out
is the only thing that brings the login screen back.

If the browser's site data is cleared, or the machine sits unused long enough for the refresh token
to lapse, it asks once more. Passwords are changed and reset from the Supabase dashboard, under
**Authentication → Users**.

## Deploying to Vercel

The repo already carries `vercel.json`, so the build settings are picked up automatically.

1. **vercel.com → Add New → Project**, and import `naveenairtech/billing_system`.
2. Vercel reads the framework, build command and output directory from `vercel.json` — leave
   those alone.
3. Open **Environment Variables** and add the same two that are in `.env.local`:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://ablhveylchqtnkuynkjz.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the `anon public` key |

   Tick all three environments (Production, Preview, Development). These are baked into the
   bundle at build time, so a later change needs a redeploy to take effect.
4. **Deploy.**

Every push to `main` redeploys. Nothing else needs configuring on the Supabase side — the app
signs in with email and password, so there are no redirect URLs to whitelist.

### Before handing it to the client

The site is public: anyone with the URL reaches the login screen. The data behind it is not —
row level security refuses every read and write that is not signed in, which is worth
re-checking after any schema change.

Clear the demo catalogue once their real products are in: **Settings → Clear all seed data**.

## Layout of the code

```
src/
  lib/
    seller.ts     Naveen Airtech's default details + state list
    types.ts      Product, Company, Invoice, InvoiceItem, Seller
    gst.ts        CGST/SGST vs IGST, per-line and per-HSN totals, rounding
    words.ts      Rupees in words, Tally-style ("... Five Hundred and Seventy Nine Only")
    format.ts     Number formatting matched to the reference bill
    pdf.ts        A4 PDF export and the WhatsApp hand-off
    auth.ts       Sign in / sign out, and whether a sign-in is needed at all
    store.ts      Picks a backend and re-exports it
    backends/     local.ts (browser storage), supabase.ts, types.ts (the interface)
    seed.ts       Demo products and companies
  components/
    InvoiceDocument.tsx   The bill — printed, previewed and edited from this one component
    SignIn.tsx            The front door, shown only when Supabase is configured
    ...
  styles/invoice.css      Print styles in mm — owns the printed document
  pages/                  One file per screen
supabase/schema.sql       Tables, indexes and row level security
```
