import { test } from "node:test";
import assert from "node:assert/strict";
import {
	DEFAULT_LIMIT,
	MAX_LIMIT,
	buildSearchRequest,
	formatTime,
	renderHits,
	renderUnavailable,
	toPlainHit,
	validateRecallArgs
} from "../lib/recall.js";

test("validateRecallArgs accepts valid input", () => {
	assert.equal(validateRecallArgs({ query: "fix the widget" }), null);
	assert.equal(validateRecallArgs({ query: "  spaced  ", limit: 3 }), null);
	assert.equal(validateRecallArgs({ query: "x", sessionIds: ["s1", "s2"] }), null);
});

test("validateRecallArgs rejects bad input", () => {
	assert.match(validateRecallArgs({}), /non-empty/);
	assert.match(validateRecallArgs({ query: "" }), /non-empty/);
	assert.match(validateRecallArgs({ query: "x".repeat(501) }), /too long/);
	assert.match(validateRecallArgs({ query: "a\0b" }), /NUL/);
	assert.match(validateRecallArgs({ query: "x", limit: 0 }), /limit/);
	assert.match(validateRecallArgs({ query: "x", limit: 21 }), /limit/);
	assert.match(validateRecallArgs({ query: "x", limit: 2.5 }), /limit/);
	assert.match(validateRecallArgs({ query: "x", sessionIds: [] }), /empty/);
	assert.match(validateRecallArgs({ query: "x", sessionIds: ["ok", ""] }), /session id/);
	assert.match(validateRecallArgs({ query: "x", sessionIds: "s1" }), /array/);
});

test("buildSearchRequest normalizes query and applies defaults and filters", () => {
	const basic = buildSearchRequest({ query: "  hello  " });
	assert.equal(basic.query, "hello");
	assert.equal(basic.limit, DEFAULT_LIMIT);
	assert.equal(basic.sessionFilters, undefined);
	const scoped = buildSearchRequest({ query: "x", limit: 7, sessionIds: ["a", "b"] });
	assert.deepEqual(scoped.sessionFilters, [{ kind: "id", values: ["a", "b"] }]);
	assert.equal(scoped.limit, 7);
});

test("toPlainHit copies only leaf fields, never live objects", () => {
	const hit = {
		header: { id: "s_1", cwd: "C:/repo" },
		live: true,
		persisted: false,
		bestMatch: { sessionId: "s_1", seq: 3, type: "assistant/message", time: 1700000000000, surface: "current", snippet: "  matched text  " }
	};
	const plain = toPlainHit(hit);
	assert.deepEqual(plain, {
		sessionId: "s_1",
		live: true,
		persisted: false,
		time: 1700000000000,
		type: "assistant/message",
		snippet: "  matched text  "
	});
	assert.equal("header" in plain, false);
	assert.equal("bestMatch" in plain, false);
});

test("formatTime renders epoch ms and unknown", () => {
	assert.equal(formatTime(1700000000000), "2023-11-14T22:13:20.000Z");
	assert.equal(formatTime(null), "?");
});

test("renderHits renders hits and the empty case", () => {
	const hits = [
		{ sessionId: "s_1", live: true, persisted: false, time: 1700000000000, type: "assistant/message", snippet: "we decided to use sqlite" }
	];
	const text = renderHits("sqlite", hits);
	assert.match(text, /recall: "sqlite" \(1 hit\)/);
	assert.match(text, /s_1/);
	assert.match(text, /we decided to use sqlite/);
	assert.match(text, /· live/);
	const empty = renderHits("zzz", []);
	assert.match(empty, /No matching sessions found/);
});

test("renderUnavailable is self-explanatory", () => {
	assert.match(renderUnavailable(), /sessionQuery/);
});
