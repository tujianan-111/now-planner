import test from "node:test";
import assert from "node:assert/strict";
import { extractCourseDetails, formatDateInput, inferTermStart, mergeOccurrences, parseKbTableHtml, parseWeekExpression } from "../src/schedule.js";

const sample = `
<table class="table kb_table">
  <thead><tr><th>周/节次</th><th>星期一</th><th>星期二</th><th>星期三</th><th>星期四</th><th>星期五</th><th>星期六</th><th>星期日</th></tr></thead>
  <tbody>
    <tr><td>第一大节<br>08:30-10:00</td>
      <td><p title="课程学分：1&lt;br/&gt;课程属性：必修&lt;br/&gt;课程名称：大学生创新创业教育&lt;br/&gt;上课时间：第5周 星期一 [01-02]节&lt;br/&gt;上课地点：2106">大学生创新创..</p></td>
      <td><p title="课程学分：4&lt;br/&gt;课程属性：必修&lt;br/&gt;课程名称：机械设计基础&lt;br/&gt;上课时间：第5周 星期二 [01-02]节&lt;br/&gt;上课地点：2204">机械设计..</p></td>
      <td></td><td></td><td></td><td></td><td></td>
    </tr>
  </tbody>
</table>`;

test("解析当前周课表 HTML", () => {
  const courses = parseKbTableHtml(sample, 5);
  assert.equal(courses.length, 2);
  assert.equal(courses[0].name, "大学生创新创业教育");
  assert.equal(courses[0].weekday, "星期一");
  assert.equal(courses[0].startTime, "08:30");
  assert.equal(courses[0].endTime, "10:00");
  assert.equal(courses[0].location, "2106");
  assert.deepEqual(courses[0].weekNumbers, [5]);
});

test("解析周次表达式", () => {
  assert.deepEqual(parseWeekExpression("1-3,7、9"), [1, 2, 3, 7, 9]);
  assert.deepEqual(parseWeekExpression("单", 6), [1, 3, 5]);
  assert.deepEqual(parseWeekExpression("双", 6), [2, 4, 6]);
});

test("从当前周和日期推导学期开始日期", () => {
  const start = inferTermStart("2026-10-06", 5);
  assert.equal(formatDateInput(start), "2026-09-07");
});

test("合并相同课程的不同周次", () => {
  const occurrenceA = extractCourseDetails("课程学分：4<br/>课程属性：必修<br/>课程名称：工程力学<br/>上课时间：第1周 星期一 [03-04]节<br/>上课地点：2204", 1, "星期一", "第二大节 10:20-11:50");
  const occurrenceB = { ...occurrenceA, weekNumbers: [3] };
  const merged = mergeOccurrences([occurrenceA, occurrenceB], "semester-1");
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].weekNumbers, [1, 3]);
  assert.equal(merged[0].weekday, 1);
});
