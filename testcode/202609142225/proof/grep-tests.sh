#!/bin/sh
# GRAMMAR §10.5 grep tests over the lens modules and the whole page. Run from the page folder.
cd "$(dirname "$0")/.." || exit 1
fail=0
echo "== lens modules: no fetch(, no hex colour literal, no history., no state. write, no 'dependents', no 'REPO' chip"
for f in lenses/*.js; do
  for pat in 'fetch(' '#[0-9a-fA-F]\{6\}' 'history\.' 'state\.[a-zA-Z]* *=[^=]' 'dependents' 'depended on by' 'REPO' 'DEPENDS-ON' 'FOUND-IN' 'CONTAINS'; do
    if grep -n "$pat" "$f" >/dev/null; then echo "FAIL $f: $pat"; grep -n "$pat" "$f"; fail=1; fi
  done
done
echo "== whole page: every legend word with its hex only in core.js REL"
grep -n "'contains': '#8b93a7'\|'depends on': '#ffd54a'\|'uses': '#00e5ff'\|'used by': '#ff7ab6'\|'shared line': '#39d353'\|'random link': '#8b93a7'\|'entangled': '#b8ccff'" core.js | wc -l
echo "== hex literals outside core.js, gl.js, style.css (should be none)"
grep -n '#[0-9a-fA-F]\{6\}' ui.js index.html lenses/*.js && fail=1
echo "== retired words anywhere in shipped code (should be none)"
grep -n 'dependents\|depended on by\|BLOCK [0-9]\|DEPENDS-ON\|FOUND-IN' core.js ui.js gl.js lenses/*.js index.html style.css && fail=1
echo "== verdict colours: red/green/amber words in CSS/JS (only .u-fail red allowed)"
grep -n 'ff5c5c\|ffb3b3' style.css
grep -inw 'verdict\|amber\|rag' core.js ui.js gl.js lenses/*.js style.css | grep -v 'never\|not shown\|no red\|forbidden'
echo "grep tests exit $fail"
exit $fail
