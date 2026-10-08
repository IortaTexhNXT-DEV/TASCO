-- Pandoc Lua filter for the iorta TechNXT Word generator (build_docx.py).
-- Maps Markdown constructs onto the custom paragraph / character styles that
-- build_docx.py installs into the corporate template.

local function is_external(target)
  return target:match('^https?://') or target:match('^mailto:')
end

-- Internal cross-references become plain text; external links stay links.
function Link(el)
  if is_external(el.target) then return el end
  return el.content
end

-- Inline code -> "Code Char" character style.
function Code(el)
  return pandoc.Span({ pandoc.Str(el.text) }, { ['custom-style'] = 'Code Char' })
end

-- Raw HTML inlines: <br> becomes a line break, comments disappear, anything
-- else is shown literally (GitHub would hide it, but in prose like
-- "Insurance <plate>" the author meant the text).
local HTML_TAGS = {}
for t in ('a abbr b big center code del details div em font hr i img ins kbd mark p pre q s ' ..
          'samp small span strike strong sub summary sup table tbody td th thead tr tt u var'):gmatch('%S+') do
  HTML_TAGS[t] = true
end

function RawInline(el)
  if el.format:match('html') then
    local s = el.text
    if s:match('^<%s*[bB][rR]%s*/?%s*>$') then return pandoc.LineBreak() end
    if s:match('^<!%-%-') then return {} end
    local name = s:match('^</?%s*([a-zA-Z][a-zA-Z0-9]*)')
    if name and HTML_TAGS[name:lower()] then return {} end
    return pandoc.Str(s)
  end
  return el
end

function RawBlock(el)
  if el.format:match('html') then
    if el.text:match('^%s*<!%-%-') then return {} end
    return {}
  end
  return el
end

-- Fenced / indented code -> one "Code Block" paragraph with line breaks.
function CodeBlock(el)
  local text = el.text:gsub('\t', '    ')
  local inl = {}
  local first = true
  for line in (text .. '\n'):gmatch('(.-)\n') do
    if not first then table.insert(inl, pandoc.LineBreak()) end
    first = false
    if #line > 0 then table.insert(inl, pandoc.Str(line)) end
  end
  return pandoc.Div({ pandoc.Para(inl) }, { ['custom-style'] = 'Code Block' })
end

-- Block quotes -> "Callout" paragraphs. Lists inside a callout are flattened
-- into paragraphs with a bullet / number prefix so every line keeps the
-- callout shading and border.
local function flatten(blocks, out, prefix)
  for _, b in ipairs(blocks) do
    if b.t == 'BulletList' then
      for _, item in ipairs(b.content) do
        flatten(item, out, (prefix or '') .. '\u{2022}\u{00A0}\u{00A0}')
      end
    elseif b.t == 'OrderedList' then
      local n = b.listAttributes and b.listAttributes.start or 1
      for _, item in ipairs(b.content) do
        flatten(item, out, (prefix or '') .. tostring(n) .. '.\u{00A0}')
        n = n + 1
      end
    elseif b.t == 'Para' or b.t == 'Plain' then
      local inl = pandoc.List(b.content)
      if prefix then inl:insert(1, pandoc.Str(prefix)); prefix = nil end
      table.insert(out, pandoc.Para(inl))
    elseif b.t == 'BlockQuote' or b.t == 'Div' then
      flatten(b.content, out, prefix)
    else
      table.insert(out, b)
    end
  end
  return out
end

function BlockQuote(el)
  return pandoc.Div(flatten(el.content, {}, nil), { ['custom-style'] = 'Callout' })
end

-- Horizontal rules carry no meaning in the corporate layout.
function HorizontalRule(el)
  return {}
end
