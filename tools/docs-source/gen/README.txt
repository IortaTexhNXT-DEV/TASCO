Markdown -> Word generator (iorta TechNXT corporate template)
==============================================================

Turns Markdown with YAML front matter (docs-brief.md, sections 3 and 5) into a
.docx built on scratchpad/tpl/template.docx: cover, table of contents, Document
Control, Acronyms, numbered body, Sign-Off and back cover.


1. Running it
-------------
One document:

    python3 gen/build_docx.py <input.md> <output.docx> [--img-dir DIR]
        [--preview DIR]        also write a PDF and PNG pages (LibreOffice) to DIR
        [--toc-mode inject|roundtrip|none]   default: inject (see section 4)
        [--template T.docx]    default: scratchpad/tpl/template.docx
        [--json]               print the build report as JSON
        [--keep-work]          keep the temporary work folder (pandoc input/output)

A whole folder:

    python3 gen/build_all.py <docsrc/docs dir> <out dir> [--jobs 3] [--preview]
        [--only "architecture/*"] [--img-dir DIR]

  * Builds every *.md that has front matter with an id and a title. Files
    without front matter (README.md, drafts) are skipped with a warning.
  * Output mirrors the source folders, and each file is named
    "<ID> <Title>.docx", e.g. "architecture/TGP-ARC-02 Integration Architecture.docx".
  * Writes <out dir>/build_report.txt and build_report.json (status, heading,
    figure and section counts, warnings per document).

The exit code is non-zero when a document has structural problems (see
"Checks" below).

Requirements, all installed here: python3 with lxml, PyYAML, Pillow and python-docx;
pandoc 3.1.3; node with the global playwright package (Chromium); LibreOffice
(soffice) and /usr/bin/python3 with the uno module; pdftoppm (for previews only).
Mermaid comes from scratchpad/conv/mermaid/package/dist/mermaid.min.js.


2. Input format
---------------
    ---
    id: TGP-ARC-02
    title: Integration Architecture
    subtitle: TASCO Motor Insurance Growth Platform
    version: "1.0"
    date: 07/10/2026                      (DD/MM/YYYY; ISO dates also accepted)
    prepared_by: iorta TechNXT, Solution Architecture
    reviewed_by: TASCO Insurance, IT Architecture
    approved_by: TASCO Insurance, Programme Sponsor
    change_history: Initial issue for submission
    acronyms:
      - [API, Application Programming Interface]
    signoff:
      - [Description of the open item, Owner, Open]
    ---
    # Introduction
    ...

* The body starts at "#" (Heading 1) and has no title H1. Use ## and ### for
  sub-sections; do not type numbers. #### and deeper become an unnumbered
  bold Heading 4.
* For older drafts the generator also accepts a single H1 title at the top
  (dropped, and the other headings move up one level), a "| Document | Version |"
  metadata table under it (dropped), and typed numbers in headings ("2.1 Scope",
  stripped). A warning is printed when this happens.
* Acronyms and sign-off rows may contain commas: the first item of an acronym
  row is the abbreviation and the rest is the meaning; the last two items of a
  sign-off row are owner and status.
* GitHub-flavoured Markdown (pandoc "gfm" reader, plus smart quotes,
  footnotes and fenced divs): pipe tables, lists, task lists, block quotes,
  fenced code, links, images, footnotes.
* Diagrams: ```mermaid blocks. Caption = a "%% caption: ..." line inside the
  block, otherwise the paragraph right before the diagram when it is a single
  sentence (that paragraph then becomes the caption and is not repeated as
  body text), otherwise the heading of the section.
* Images: ![Caption](path) on its own line, relative to the Markdown file
  (or --img-dir). Remote images are not embedded.
* Table captions: a line "Table: caption" directly before or after a pipe
  table gives "Table n - caption" above the table.


3. What the parts do
--------------------
build_docx.py   The generator.
  1. Reads the front matter and normalises the Markdown (older drafts).
  2. Pre-processes the body: renders Mermaid blocks to PNG, turns diagrams and
     images into centred figures with "Figure n - ..." captions, numbers
     "Table:" captions, adds blank lines GitHub tolerates but pandoc needs.
  3. Builds a reference .docx (the template plus the generator's styles) and
     runs pandoc with filter.lua to convert the body.
  4. Opens a copy of the template and fills the frame:
     - cover text boxes: title; subtitle " . " ID (font steps down from 18 to
       16 or 14 pt so that it stays on one line); "Prepared by - <organisation>",
       "Version - x", "Date - 07 October 2026". The boxes are widened so the
       text no longer overflows (the template's own date was clipped). The
       template colours, weights and positions are kept.
     - Document Control (one row) and Acronyms (sorted, as many rows as needed,
       empty rows removed);
     - deletes the placeholder sections (Introduction ... Appendix lorem text)
       and splices the converted body in their place;
     - "Requirements Sign-Off" for TGP-BUS-02/03/04, "Sign-Off" otherwise: the
       first table is filled from the signoff rows (1..n, or "No open items /
       Closed"); the signature table keeps empty date and signature cells and
       lists the approver, reviewer and preparer (organisation in Approved By,
       unit or role in Department & Project Role);
     - removes the template's padding paragraphs and its extra blank page
       before the back cover, which stays last.
  5. Body formatting:
     - Heading 1 paragraphs are cloned from the template's own heading, so
       they look identical; one multilevel list continues the template
       numbering (Document Control = 1, Acronyms = 2, body from 3, Sign-Off
       last). New Heading 2/3 styles use the same theme font and heading blue,
       at 13 / 11.5 pt, numbered 3.1 / 3.1.1.
     - Body Text: Segoe UI 11 pt, colour 101820, justified (as the template).
     - Lists: real Word bullets and numbering (blue Segoe UI bullets).
     - Inline code: "Code Char" (Consolas 9.5 pt, dark blue). Code blocks:
       "Code Block" (Consolas 9 pt, light grey shading, thin border).
     - Block quotes: "Callout" (light blue shading, blue left border);
       lists inside a quote stay inside the callout.
     - Tables: header row in the heading blue (0F4761) with white bold text,
       repeated on every page; thin grey borders; 9.5 pt text; full width;
       light zebra rows; column widths computed from the content (no
       mid-word breaks; tables with the same header share widths, so a run of
       requirement tables lines up); w:noWrap on ID cells (FR-001, TC-012,
       R-03 ...); rows do not split across pages unless very long. The frame
       tables (Document Control, Acronyms, Sign-Off) get the same header look.
     - Tables with 6 or more columns, and diagrams that are much larger in
       landscape, go into landscape sections together with their heading and
       caption; neighbouring wide tables share one landscape section. The
       landscape section keeps the header and footer: footer3.xml is the
       template's navy footer band, widened for the landscape page.
     - Diagrams: inserted at their natural size, capped at 16.5 x 18 cm
       (portrait) or 24 x 14 cm (landscape). A very long left-to-right strip
       is re-rendered top-down when that is more legible (warning printed).
       A warning is also printed when a diagram must be shrunk below 60 %.
     - Internal links (other documents, .md/.pdf files, anchors) become
       plain text; external http(s)/mailto links stay hyperlinks.
  6. Table of contents: rebuilt as a real TOC field (\o "1-3" \h \z \u) with
     hyperlinked entries and PAGEREF fields to bookmarks on every heading.
     LibreOffice (lo_tools.py) opens the finished document, updates all
     indexes and reports the page of every entry; those page numbers are
     written into the field results. settings.xml has
     <w:updateFields w:val="true"/>, so Word refreshes the page numbers when
     the document is opened (Word asks "update the fields?"; answer Yes).
  7. Properties: title, subject (ID), creator "iorta TechNXT", keywords,
     company. The SharePoint customXml parts and the ContentTypeId custom
     property are removed, as is the stale page/word count.
  8. Checks (printed and returned in the JSON report): no duplicate
     relationship ids in any .rels part, every r:id used in document.xml
     defined, unique drawing ids and bookmark names, every content-type
     override has a part, and python-docx opens the file. XML children of
     pPr/rPr/trPr/tcPr are put in schema order.
filter.lua        Pandoc Lua filter: links, inline code, code blocks, callouts,
                  raw HTML (<br> -> line break; tags dropped; "<plate>" kept as text).
render_mermaid.js Renders Mermaid to PNG at 2x with Playwright/Chromium in the
                  template colours (primary blue 1D74BA, heading blue 0F4761,
                  light fills E8F1FA, Segoe UI with Inter fallback). PNGs are
                  cached in gen/.cache/mermaid (delete the folder to force).
lo_tools.py       LibreOffice UNO helper (run with /usr/bin/python3): updates
                  indexes, writes TOC/heading pages as JSON, optional PDF
                  export (--pdf) and .docx re-save (--save).
build_all.py      Folder build with mirrored output and a summary report.
sheet.py          Preview helper: joins page PNGs into one contact sheet.


4. TOC modes
------------
inject (default)  LibreOffice only computes the page numbers; the document
                  itself is never re-saved by LibreOffice, so the cover, back
                  cover, footer band, fonts and styles stay exactly as in the
                  template.
roundtrip         Keeps LibreOffice's re-saved .docx. Tested: LibreOffice
                  rewrites the file (VML fallbacks added back, heading run
                  formatting changed, the TOC's PAGEREF fields replaced), so
                  this mode is only for comparison.
none              No LibreOffice step; the TOC shows the headings with blank
                  page numbers until Word updates the fields.


5. Known limitations
--------------------
* Page numbers come from LibreOffice, which lays out with Inter in place of
  Segoe UI (not installed here). Word, with Segoe UI, can paginate a little
  differently; it corrects the numbers when it updates fields on opening. If
  the prompt is declined, numbers may be off by a page in long documents.
* PDF/PNG previews use the same substitute fonts, so line breaks in Word
  differ slightly from the previews.
* Diagram legibility depends on the source: large diagrams are scaled to fit
  and the generator warns below 60 %. The fix is in the Markdown (fewer
  nodes, short labels), as docs-brief.md section 5 asks.
* Caption detection uses one-sentence paragraphs before a diagram; a longer
  lead-in paragraph stays in the text, and the section heading is used as the
  caption unless "%% caption:" is given.
* Headings are plain text (inline formatting in headings is dropped).
* Merged cells, HTML tables, math and SVG images are not supported (convert
  SVG to PNG). Remote images are not downloaded.
* Footnotes are carried over with basic formatting only.
* Table column widths are estimated from character counts, not measured.
