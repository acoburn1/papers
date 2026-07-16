import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("includes local persistence and relationship features", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.match(page, /indexedDB\.open/);
  assert.match(page, /Result dependencies/);
  assert.match(page, /function commonAuthors/);
  assert.match(page, /Group by understanding/);
  assert.match(page, /priorityOpacity/);
  assert.doesNotMatch(page, /className="priority-column"/);
  assert.match(page, /normalizeLibrary/);
  assert.match(layout, /title: "papers"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
