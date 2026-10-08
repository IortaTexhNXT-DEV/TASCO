# Documentation sources

The Word documents in `docs/` are generated from these sources. Edit the Markdown here, never the Word files.

| Folder | Content |
|---|---|
| `docs/` | Markdown sources of the 38 documents (front matter per document: ID, title, version, sign-off) |
| `proposal/` | Proposal parts, cover letter and their assembly scripts |
| `shots/` | Screenshots referenced by the documents |
| `gen/` | Generator: Markdown → iorta TechNXT Word template (`gen/README.txt`) |
| `tpl/template.docx` | The Word template |

Build (needs Python 3 with python-docx and lxml, pandoc, LibreOffice and Node with Mermaid CLI):

```sh
python3 gen/build_all.py docs ../../docs --jobs 3          # the 38 documents
python3 proposal/make_tpl.py                               # assemble the proposal
python3 gen/build_docx.py proposal/tpl/proposal.md "../../docs/proposal/ITN-TASCO-2026-001 Proposal for the TASCO Motor Insurance Growth Platform.docx"
python3 proposal/make_letter_tpl.py proposal/cover-letter.md tpl/template.docx "../../docs/proposal/ITN-TASCO-2026-001 Cover Letter.docx"
```
