import test from "node:test";
import assert from "node:assert/strict";
import { validatePostPayload } from "../lib/social/post-validation.mjs";
test("accepts text-only and photo without caption", () => {
  assert.equal(validatePostPayload({body:"hello"}), null);
  assert.equal(validatePostPayload({media:[{url:"https://cdn.example.org/image.png",type:"image"}]}), null);
});
test("rejects empty and unsafe media", () => {
  assert.equal(validatePostPayload({}), "EMPTY_POST");
  assert.equal(validatePostPayload({media:[{url:"data:image/png;base64,AAAA"}]}), "INVALID_MEDIA");
  assert.equal(validatePostPayload({media:[{url:"http://example.org/x"}]}), "INVALID_MEDIA");
  assert.equal(validatePostPayload({media:[{url:"https://user:pass@example.org/x"}]}), "INVALID_MEDIA");
});
test("limits body length and number of assets", () => {
  assert.equal(validatePostPayload({body:"x".repeat(10001)}), "INVALID_POST");
  assert.equal(validatePostPayload({media:Array.from({length:11},()=>({url:"https://example.org/x"}))}), "INVALID_POST");
});
