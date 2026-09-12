import assert from "node:assert/strict";
import test from "node:test";
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  getExportStatusClassToken,
} from "../client/src/lib/export-template";

test("export HTML text escaping neutralizes markup and quotes", () => {
  assert.equal(
    escapeHtmlText(`Farm & "Ewe" <tag> 'quote'`),
    "Farm &amp; &quot;Ewe&quot; &lt;tag&gt; &#039;quote&#039;",
  );
});

test("export HTML attribute escaping neutralizes javascript-like values", () => {
  assert.equal(
    escapeHtmlAttribute(`javascript:alert("x")&next=<script>`),
    "javascript:alert(&quot;x&quot;)&amp;next=&lt;script&gt;",
  );
});

test("export status class tokens are strictly whitelisted", () => {
  assert.equal(getExportStatusClassToken(" ACTIVE "), "active");
  assert.equal(getExportStatusClassToken("deceased"), "deceased");
  assert.equal(getExportStatusClassToken(`active" onclick="alert(1)`), "unknown");
  assert.equal(getExportStatusClassToken("<script>"), "unknown");
});