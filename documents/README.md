# Documents

The firm's own paperwork, kept because the code is copied from it.

```
documents/
  samples/   the firm's own sheets, as they print them
  tools/     how to measure one
```

These PDFs are the source of truth for `apps/quotations`. The templates were
not designed — they were copied, and every time the printed sheet has been
wrong it has been because something in the code was judged by eye instead of
read out of these files. Measure, then change.

## The files

| file in `samples/` | the template it governs |
| --- | --- |
| `Spares Quotation.pdf` | `spares` — priced, totalled, consignee block, SI No / Ref |
| `Air Compressor Quotation.pdf` | `machine` — no total, "GST 18% Extra", subject line |

Both are typed in Word on **US Letter** (612 × 792pt), not A4. That matters:
the ruled box is 217.3mm tall on the spares sheet and 251.5mm on the machine
one, and assuming A4 is how it ended up 268mm on both for a while.

## Measuring them

```
node documents/tools/measure-pdf.cjs "documents/samples/Spares Quotation.pdf"
node documents/tools/measure-pdf.cjs "documents/samples/Spares Quotation.pdf" rects
```

The first prints every run of text with its font, size and position. The
second prints every rectangle, which is where the rules, the table box and
the underlines are. A rule is a rectangle with a zero height or width, and
its position is exact — unlike type, whose baseline has to be read against
the font's own metrics. Prefer the rules when checking alignment.

Positions are in points from the **bottom left** of the page. To compare
against the rendered sheet, convert to millimetres down from the top of the
ruled box:

```
mm = (boxTop - y) * 25.4 / 72
```

where `boxTop` is the y of the outer box rectangle plus its height — 765 on
the spares sheet, 768 on the machine one.

## What was read out of them

Everything in `apps/quotations/src/styles/quotation.css` that carries a
number: the column widths, the type sizes per block, the box heights, the
signature rule widths, and which headings are underlined. Both sheets are
set entirely in **Arial Bold** — there is not one word of regular weight on
either — with the letterhead in **Courier New Bold**, which is where its
wide typewritten look comes from.

## A note on what is in them

These are real quotations, so they carry a customer's name and address and
the firm's GSTIN. They are here because the templates cannot be maintained
without them. If this repository is ever made public, take them out first.
