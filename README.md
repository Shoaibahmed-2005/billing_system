# Naveen Airtech

**Billing counter — live: https://billing-system-one-swart.vercel.app**

Two sites for Naveen Airtech (Chengalpattu), sharing one database and one set of parts.

- **`apps/billing`** — the billing counter. Pick the buyer, tap the parts, settle the price, and
  the printed invoice comes out matching the firm's existing Tally bill exactly.
- **`apps/quotations`** — the quotations desk, and later the annual-maintenance renewals. The
  frame is up and reads the same catalogue; the printed quotation is not built yet.
- **`packages/shared`** — everything both of them use: the data layer, the GST maths, the PDF
  engine, the spreadsheet reader, the sign-in screen, the buttons and the palette.

One copy of the shared code is the whole point of the arrangement. The firm's GSTIN was wrong on
every bill for a while; it was one line to fix because it lives in one file. In two repositories
it would have been two fixes, and the second is the one people forget.

Sign in with the shop account. There is no sign-up — the one account is created in the Supabase
dashboard, and the session is kept per device, so after the first time it opens straight to the
bill.

| | |
| --- | --- |
| Live site | https://billing-system-one-swart.vercel.app |
| Hosting | Vercel — every push to `main` redeploys |
| Database | Supabase (`ablhveylchqtnkuynkjz`), row level security on |
| Stack | React 18 · TypeScript · Vite · Tailwind v4 |

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173 for the billing counter.

```bash
npm run dev:quotations
```

Then open http://localhost:5174 for the quotations desk. Both can run at once.

`npm install` is run once, at the top of the repository — it installs for both sites. Everything
else is a workspace script: `npm run build:billing`, `npm run build:quotations`, `npm run build:all`,
`npm run typecheck`.

Without `.env.local` it runs on this machine's browser storage and skips the login entirely, which
is the quickest way to try something out without touching live data. Copy `.env.example` to
`.env.local` and fill in the anon key to point it at the real database instead.

## On a phone

The counter is used on a phone more than a desktop, so below 1024px the layout changes rather
than just shrinking:

- The sidebar becomes a top bar with a slide-in drawer, giving the full width to the bill.
- Bill lines and the product catalogue become cards instead of wide tables — nothing scrolls
  sideways.
- In the preview, the bill is shrunk with `zoom` to fit the screen, so the whole sheet is visible
  and every figure on it is still tappable. The running total is pinned to the bottom of the
  screen while you bargain.

Printing from a phone goes through the browser's own print dialog, same as desktop.

## Screens

| Screen | What it does |
| --- | --- |
| New Bill | Pick the buyer, add items, open the preview |
| Repeat Bill | Send an earlier bill out again, with a search over companies and parts |
| Invoices | Every saved bill — search, reprint, edit, delete |
| Products | The catalogue — name, HSN, unit, rate, GST slab |
| Companies | The buyers — address, GSTIN, state |
| Settings | Your own firm block, the signature, the buyer list, seed-data controls |

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
no., despatch through, destination, terms of delivery.

The invoice number stays editable, because they run a second handwritten series and keep the two in
step. A new bill opens with the next number already filled in — one past the highest sequence used
so far this financial year, as `7/2026-2027` — and the field shows which bill was the previous one,
so a wrong suggestion is obvious before it is saved. Reusing a number that is already on another
bill is flagged.

The summary's columns are headed **CGST / SGST**, or **IGST** on an inter-state bill, rather
than Tally's "Central Tax" and "State Tax" — the client reads the short names faster. The Rate
column is centred.

**GST is separated per HSN/SAC.** Every product carries its own HSN code and GST rate. Lines
sharing an HSN are summed into one row of the tax summary — all the motors under 8501 give one
figure, all the bolts under 7318 another, exactly as the printed bill does.

**Rounding** follows the bill: the grand total is rounded to the nearest rupee and the difference
shows on the "Rounded Off" line.

## The signature

The authorised signature prints above "Authorised Signatory". **Settings → Your firm → Signature**
uploads a replacement; the white background is cut out on the way in, so a photo of a signature on
paper drops onto the ruled line without a white box around it.

Each bill can leave it off — there is a **Print the signature** tick in the preview — for the times
they print the sheet and sign it by hand.

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

## Finding an old bill

Both the Invoices and Repeat Bill screens are built the same way, because these pile up over years
and a flat list stops being usable.

The front page shows the year buttons, then the most recent 15 bills. Open a year and you get its
months, April through March; open a month and you get its bills in the order they were written —
**first of the month first**, not newest first.

Every month of the year is listed whether or not anything was billed in it, and every box is the
same size. A quiet month showing "0 bills" is itself worth seeing, and a grid that keeps its shape
from year to year is quicker to read when you are looking for the same month each time. Both
screens get this from one component, so they cannot drift apart.

The search box follows you down: on the front page it searches every bill, inside a year only that
year, inside a month only that month.

**Download month PDF**, in any month view, puts that whole month into a single PDF, one bill per
page — what the accountant wants for GST review. A big month takes a while; the button counts the
pages as it goes.

## Repeat Bill

For the companies that buy the same handful of parts over and over. The front page groups past
bills by company, in alphabetical order — that is how they think about it ("what did we last send
Kavin?"). The year and month buttons above are for when they remember the date instead.

**Use again** opens that bill as a fresh copy: same buyer, same items, same prices, with the
invoice number cleared and the date set to today — both still typed by hand, as always. Change
quantities, change prices, add or drop parts, then save. It files as a **new** invoice; the
original is left exactly as it was. The same **Use again** button sits on each row of the Invoices
screen.

## Printing, PDF and WhatsApp

**Save & Print** saves the bill and opens the browser print dialog. Set the printer to **A4,
portrait** and press print; nothing in the dialog needs changing.

Nothing but the bill reaches the paper. The app's own screens are excluded, and so is the
browser's own furniture — the page title along the top, the site address and page number along
the bottom, which Chrome on a phone had been stamping under every bill. The sheet asks for a page
margin of zero and draws its own 11mm instead, which leaves the browser nowhere to put them.

It fits one page whatever paper the printer is set to. A4 is what it asks for, but a phone print
dialog often defaults to US Letter, which is 18mm shorter — the bill closes up to suit rather than
running onto a second sheet. The sheet is sized to the page rather than to a fixed height, keeps
4mm of slack for printers that scale to their own printable area, and clips rather than
paginates, so a stray pixel can never become a second page.

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

### Backup, and putting it back

Supabase charges for its own backups, so the firm keeps theirs as spreadsheets. **Settings →
Backup** has three downloads — products, companies, bills — and one **Import a backup** button
that reads any of them back in.

Two rules make that safe to press:

- **Everything carries its id.** Importing the same file twice changes nothing the second time,
  and a product renamed since the backup still matches itself rather than arriving as a copy. A
  row typed in by hand with no id is matched on its name instead.
- **Nothing already here is ever touched.** Only rows that have gone missing are put back, so
  loading last quarter's file by mistake cannot undo this quarter's prices. The report afterwards
  says what happened: "Products: 3 put back, 54 already here."

The cost of the second rule is that bulk-editing rates in Excel and loading them back does
nothing at all. That is deliberate — ask the client before changing it.

GSTINs, HSN codes and phone numbers are written as text cells. Left as numbers, Excel reformats
them and the round trip quietly loses data.

### The month's GST sheet

In **Invoices**, open a year and a month and there is a button named for the month —
**June'2026 GST**. It opens the month on screen first, as a table on a laptop and as a block per
bill on a phone, with **Download Excel** in the same panel. Nothing downloads until that is
pressed, and a web page cannot open Excel itself — the file saves to the device and is opened
there.

`src/lib/gstSheet.ts` reproduces the SALES tab of the workbook the firm already keeps, down to
the headings: "Invo No", "Amont", and the two spaces in "Sl  No " and "SGST  %" are theirs, not
typos. One row per line of a bill, the bill's own details only on its first row, then a row
carrying just the invoice total. Red type, ruled cells, and the money columns written as
formulas rather than answers, so the sheet still adds up after the accountant corrects a rate.

The one deliberate difference from their file: it has a single IGST column holding the amount,
with the rate nowhere. The client asked for the rate and amount side by side, as CGST and SGST
already have, so the sheet runs to column P rather than O.

### Reading and writing .xlsx

`src/lib/xlsx.ts` does both, in about two hundred lines and with nothing installed. An .xlsx is
a zip of XML parts; writing one means a zip writer with stored entries and a CRC, and reading
one means the same in reverse with `DecompressionStream` for the deflated parts. A spreadsheet
library would have been a few hundred kilobytes downloaded onto a phone on mobile data for a
button used once a month.

It is tested against their own June'2026 workbook, which Excel wrote: three tabs, shared
strings, deflate, 151 rows read back character for character.

## The database

Supabase project `ablhveylchqtnkuynkjz`, with four tables created by `supabase/schema.sql`:
`products`, `companies`, `invoices` and `settings`.

The buyer and the line items are stored as a **snapshot on the invoice itself**, not as foreign
keys. A bill printed last year must keep showing the address and the prices it was printed with,
even after the company moves or the catalogue is repriced.

Row level security is on, and the only policies are for signed-in users. That matters because the
anon key ships inside the browser bundle — anyone who loads the site has it. Checked against the
live project: an anonymous read returns nothing and an anonymous insert is rejected outright with
`42501 new row violates row-level security policy`. Worth re-running that check after any schema
change.

### Signing in

One email and password, typed once per device. The session is kept in that browser's storage and
the token is renewed in the background, so every later visit opens straight to the bill — no
retyping. The account's email and a **sign-out** button sit at the foot of the sidebar; signing out
is the only thing that brings the login screen back.

If the browser's site data is cleared, or the machine sits unused long enough for the refresh token
to lapse, it asks once more. Passwords are changed and reset from the Supabase dashboard, under
**Authentication → Users**.

## Hosting

Already deployed at **https://billing-system-one-swart.vercel.app**, from `vercel.json` in this
repo. Every push to `main` redeploys on its own.

Two environment variables are set in the Vercel project:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://ablhveylchqtnkuynkjz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the `anon public` key |

They are baked into the bundle at build time, so changing one needs a **Redeploy** to take
effect. The giveaway that they did not reach a build is the site opening straight to New Bill
with no login — that is the browser-storage fallback, not the database.

Nothing needs configuring on the Supabase side: the app signs in with email and password, so
there are no redirect URLs to whitelist.

### Two sites, two Vercel projects, one repository

A Vercel project serves one site at one address, so two sites means two projects. They can both
point at this repository.

**The billing project needs no change.** Its Root Directory stays at the top of the repository;
the `vercel.json` there now builds `apps/billing` and serves `apps/billing/dist`. That was
deliberate — moving the app into a subfolder should not require anyone to touch the dashboard of
a site that is already live.

**The quotations project is new.** Add Project, same Git repository, then set:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/quotations` |
| Build / Output | leave alone — `apps/quotations/vercel.json` sets them |
| Environment variables | the same two as the billing project |

Its build command steps up to the top of the repository first, because the shared package and
the lockfile live there. If Vercel offers "Include files outside the Root Directory", it must
stay on.

Both projects redeploy on every push to `main`, including pushes that only touch the other app.
That is wasteful rather than wrong; Vercel's Ignored Build Step can be pointed at a path check
later if the builds ever get slow enough to care about.

### Setting it up again from scratch

Only needed for a second shop or a fresh Supabase project.

1. **SQL Editor → New query**, paste `supabase/schema.sql`, Run.
2. **Authentication → Users → Add user**, with *Auto Confirm User* ticked.
3. Copy the URL and `anon public` key into `.env.local`, and into the host's environment
   variables.

## Before the client uses it for real

- **Confirm the GSTIN against the certificate.** The firm block was first transcribed from a
  scan of their printed bill, and three details were misread off it. Their own quotation PDFs —
  typed rather than scanned — give `33BHFPK3895N1ZS`, `9626458081` and pincode `603 002`, where the
  scan had given `33BHPFN5396M1ZS`, `9626468081` and `603 001`. The GSTIN is the one that mattered:
  every GSTIN carries a check digit in its last character, the scanned number fails it (those
  fourteen characters give a final `2`, not `S`) and the quotation number passes. All three are
  corrected in `src/lib/seller.ts`. A check digit only proves a number is well formed, though, not
  that it is theirs — so still hold it against the registration certificate, along with the bank
  account number, which came off the same scan and has no checksum to test it.
  **If the firm details were ever saved from Settings → Your firm, that saved copy wins over the
  code.** Open that screen and confirm the GSTIN reads `33BHFPK3895N1ZS`; if it does not, press
  the reset there, or edit it by hand.
- **Clear the demo data** once their own products are in: **Settings → Before the shop starts
  billing → Remove the demo data**. That deletes the seeded catalogue and sample companies by
  their shipped ids, clears any test bills, and then takes itself off the page for good.
- **One shared login.** Everyone at the counter signs in as the same user, so there is no record of
  who billed what. Separate staff accounts and an audit trail are a schema change, not a settings
  toggle — worth deciding before a year of invoices is in there.
- **Back-ups.** Supabase's free tier keeps limited point-in-time history. If these invoices are the
  only copy of the firm's billing record, check what the plan actually retains.

## Where the printed layout comes from

Every column width and type size in `src/styles/invoice.css` was measured off the client's own
printed sample, kept in the repo root as
`Sample bill for you to check the allignement and missing columns.png`. The column rules were
scanned out of that image and the type sizes derived from the measured width of known strings.
Change them against a fresh measurement rather than by eye.

The one structural thing worth knowing: the items table and the HSN summary share a single
seven-column grid, which is what makes the two line up down the page. The header block above
them is struck off that same grid — the rule beside `Despatch Through` is the Description column
rule and the one beside `Terms of Delivery` is the Quantity column rule, each carried up the
page so that it reads as one unbroken line, the way it does on the bill the shop has always
used. Move a column width and those two have to move with it; check it by measuring.

There is a half-hairline catch in that. The tables collapse their borders, so a table rule is
centred on the boundary between two cells, while a border on an ordinary `div` is painted
inside its own box. For the two to read as one line the `div` has to reach half a rule
further, which is what the `--hbw` variable in the stylesheet is for.

## Knowing what you just tapped

A product card shows **Added 1**, **Added 2** and so on once it is on the bill, the card itself
picks up a tint, and a note slides up at the foot of the screen naming what went on. On a phone
the bill lines sit far below the catalogue, so without this the only way to tell a tap had landed
was to scroll down — and the same part went on twice.

The count is read off the bill's own lines, so it is right wherever the bill came from: a new
bill, one opened for editing, or one opened with **Use again**, which starts with its parts
already counted.

## How the PDF is made

**Save PDF** and **WhatsApp** do not photograph the screen. `src/lib/billPdf.ts` walks the bill
the browser has already laid out and transcribes it into the PDF: every rule drawn where that
element's border is, every piece of text where the browser put it, read off the live nodes.

That is not a refinement, it is the fix for a real fault. It used to go through html2canvas, which
does not photograph the page either — it clones the bill into a frame of its own and lays it out a
*second* time there. On Android that second layout came out different from the first, so the bill
was right on the phone's screen, right on the laptop, and reached the customer through WhatsApp
with every figure sitting on its rule. Tracing the existing layout means there is no second layout
to disagree with the first: whatever the preview shows is what the file contains.

Two things follow. The text is text, so it can be selected, searched and copied out. And a bill is
about 22 KB rather than 420 KB, which matters on a counter's mobile data.

Verified by comparing the file against the live page: 140 text runs and 239 border edges, every
one present, none out of place by as much as a hundredth of a millimetre, and no rule anywhere
crossing a figure.

## Figures too wide for their column

A bill past a lakh used to print its total across the column rule: "2,88,000.00" is simply wider
than the Amount column at full size. Rather than widen the column — the widths are the sample's,
and changing them would stop the bill matching — each column is measured against its longest
figure before anything is drawn, and shrinks only as far as it has to.

A column shrinks as a whole, never cell by cell, because a column with two or three type sizes
running down it looks like a fault even when every figure is inside its rules. CGST and SGST are
measured together for the same reason, so the same number is never printed twice at two sizes side
by side.

On an ordinary bill nothing moves. On the client's own ₹4.6 lakh invoice the Amount column comes
down 5%, which is not visible unless you are looking for it. A ₹2.1 crore invoice brings it down a
quarter, and still nothing touches a rule. The measuring is done on a canvas in the same font the
sheet uses, so it holds on a phone too, where the font stack resolves to Roboto rather than Arial.

## Known limits

- A bill long enough to overflow one A4 page runs onto a second. The reference bill and anything
  near its length fit on one.
- Direct file sharing to WhatsApp needs a browser that supports sharing files — Android, iOS and
  recent desktop Chrome on Windows. Elsewhere the PDF downloads and WhatsApp Web opens with the
  message ready, leaving only the attach step.

## Layout of the code

```
apps/
  billing/                  The billing counter (the live site)
    src/
      lib/fit.ts            Shrink-to-fit so a six-figure total stays in its column
      lib/gstSheet.ts       The month's SALES sheet, in the firm's own layout
      components/
        InvoiceDocument.tsx The bill — printed, previewed and edited from this one component
        BillArchive.tsx     Year -> month -> bills, shared by Invoices and Repeat
        BackupCard.tsx      The three downloads and the importer, in Settings
        GstSheetModal.tsx   The month on screen before it is downloaded
      pages/                One file per screen
      styles/invoice.css    Print styles in mm — owns the printed document
      index.css             Pulls in Tailwind, the shared theme, and the bill styles
  quotations/               The quotations desk — frame only so far

packages/shared/src/        Everything both sites use
  types.ts                  Product, Company, Invoice, InvoiceItem, Seller
  seller.ts                 Naveen Airtech's own details + the state list
  gst.ts                    CGST/SGST vs IGST, per-line and per-HSN totals, rounding
  words.ts                  Rupees in words, Tally-style
  format.ts                 Number formatting matched to the reference bill
  invoiceNo.ts              Next number, previous bill, and the date/order of a bill
  billPdf.ts                Draws a document into a PDF by tracing the laid-out page
  pdf.ts                    File names, downloads, and the WhatsApp hand-off
  xlsx.ts                   Reads and writes .xlsx with nothing installed
  backup.ts                 Products, companies and bills to a sheet, and back again
  store.ts                  Picks a backend and re-exports it
  backends/                 local.ts (browser storage), supabase.ts, types.ts (the interface)
  auth.ts                   Sign in / sign out, and whether a sign-in is needed at all
  signature.ts              Cuts the white background off an uploaded signature
  seed.ts                   Demo products and companies, and which ids they are
  SignIn.tsx                The front door, shown only when Supabase is configured
  ui.tsx                    Button, Card, Modal, Field, Pill, Empty
  theme.css                 The palette, base styles and animations

supabase/schema.sql         Tables, indexes and row level security
```

A module moves into `packages/shared` when the second site needs it, not before. The rule of
thumb that has held: anything that knows about the database, the tax, the money or the look is
shared; anything that knows about a *bill* belongs to the billing app.
