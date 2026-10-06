import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../extension/content-shared.js", import.meta.url), "utf8");
vm.runInThisContext(source, { filename: "content-shared.js" });

test("扩展解析器与网页解析结果一致", () => {
  const html = `<table class="kb_table"><thead><tr><th>周/节次</th><th>星期一</th></tr></thead><tbody><tr><td>第一大节<br>08:30-10:00</td><td><p title="课程学分：1&lt;br/&gt;课程属性：必修&lt;br/&gt;课程名称：大学生创新创业教育&lt;br/&gt;上课时间：第5周 星期一 [01-02]节&lt;br/&gt;上课地点：2106">课程</p></td></tr></tbody></table>`;
  const parsed = globalThis.NowPlannerShared.parseKbTableHtml(html, 5);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, "大学生创新创业教育");
  assert.deepEqual(parsed[0].weekNumbers, [5]);
});
