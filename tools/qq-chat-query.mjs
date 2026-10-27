#!/usr/bin/env node
/**
 * QQ 聊天记录检索工具（只读，不发布）
 *
 * 用法：
 *   node tools/qq-chat-query.mjs <文件> --probe
 *   node tools/qq-chat-query.mjs <文件> --from 2024-04-03 --to 2024-04-06 [选项]
 *
 * 选项：
 *   --from YYYY-MM-DD[ HH:mm]   起始时间（含）
 *   --to   YYYY-MM-DD[ HH:mm]   结束时间（含）
 *   --grep 词1,词2               只保留包含任一关键词的消息
 *   --user 昵称1,昵称2           只保留这些发送者
 *   --limit N                    最多输出多少条（默认 400）
 *   --context N                  命中行前后各带 N 条上下文（配合 --grep）
 *   --full                       输出完整内容（默认截断到 200 字）
 *   --probe                      只打印文件结构，不筛消息
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.error('用法：node tools/qq-chat-query.mjs <文件> [--from ...] [--to ...] [--grep ...] [--probe]');
  process.exit(2);
}

function flag(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : true;
}

const probe = flag('--probe');
const from = flag('--from');
const to = flag('--to');
const grep = flag('--grep');
const userFilter = flag('--user');
const limit = Number(flag('--limit') || 400);
const contextSize = Number(flag('--context') || 0);
const full = Boolean(flag('--full'));

const raw = readFileSync(file, 'utf8');

/* ---------- 自动探测消息数组与字段 ---------- */

const TIME_KEYS = ['time', 'timestamp', 'sendTime', 'msgTime', 'date', 'createdAt'];
const SENDER_KEYS = ['senderName', 'nickname', 'sender', 'name', 'uin', 'userId', 'from'];
const CONTENT_KEYS = ['content', 'text', 'message', 'plainText', 'msg'];

function findMessageArray(value, path = '', depth = 0) {
  if (depth > 4 || !value || typeof value !== 'object') return null;
  if (Array.isArray(value) && value.length && typeof value[0] === 'object') {
    const keys = Object.keys(value[0]);
    const score = [TIME_KEYS, SENDER_KEYS, CONTENT_KEYS].filter((group) =>
      group.some((key) => keys.includes(key))).length;
    if (score >= 2) return { array: value, path, sample: value[0] };
  }
  for (const [key, child] of Object.entries(value)) {
    const found = findMessageArray(child, path ? `${path}.${key}` : key, depth + 1);
    if (found) return found;
  }
  return null;
}

function pick(message, keys) {
  for (const key of keys) {
    if (message[key] !== undefined && message[key] !== null) return message[key];
  }
  return undefined;
}

function normalizeTime(value) {
  if (value === undefined) return null;
  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms);
  }
  const text = String(value);
  if (/^\d+$/.test(text)) return normalizeTime(Number(text));
  const parsed = new Date(text.replace(/\//g, '-'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function flattenContent(value, depth = 0) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (depth > 3) return '';
  if (Array.isArray(value)) return value.map((item) => flattenContent(item, depth + 1)).filter(Boolean).join('');
  if (typeof value === 'object') {
    for (const key of ['text', 'content', 'data', 'msg', 'value']) {
      if (value[key] !== undefined) return flattenContent(value[key], depth + 1);
    }
    return '';
  }
  return '';
}

/* ---------- TXT 兜底：按行解析 ---------- */

function parseTextLog(text) {
  const messages = [];
  const lines = text.split(/\r?\n/);
  const linePattern = /^\[?(\d{4}[-/]\d{1,2}[-/]\d{1,2}[ T]\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(?:\[[^\]]*\])?\s*([^:：]{1,40})[:：]\s?(.*)$/;
  for (const line of lines) {
    const match = line.match(linePattern);
    if (match) {
      messages.push({ time: match[1], sender: match[2].trim(), content: match[3] });
    } else if (messages.length) {
      messages[messages.length - 1].content += '\n' + line;
    }
  }
  return messages;
}

let messages = [];
let format = '';

const trimmed = raw.trim();
if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
  const data = JSON.parse(trimmed);
  const found = findMessageArray(data);
  if (!found) {
    console.error('未能自动识别消息数组，顶层键：', Object.keys(data).slice(0, 20));
    process.exit(1);
  }
  format = `JSON（数组路径 ${found.path || '(根)'}，${found.array.length} 条）`;
  if (probe) {
    console.log('格式：', format);
    console.log('单条消息字段：', Object.keys(found.sample));
    console.log('样例：', JSON.stringify(found.sample).slice(0, 600));
    process.exit(0);
  }
  messages = found.array.map((item) => ({
    time: normalizeTime(pick(item, TIME_KEYS)),
    sender: String(pick(item, SENDER_KEYS) ?? '未知'),
    content: flattenContent(pick(item, CONTENT_KEYS)),
    raw: item,
  }));
} else {
  messages = parseTextLog(raw);
  format = `TXT（${messages.length} 条）`;
  if (probe) {
    console.log('格式：', format);
    console.log('样例：', JSON.stringify(messages.slice(0, 3)));
    process.exit(0);
  }
}

console.log(`# 格式：${format}`);

/* ---------- 过滤 ---------- */

const startTime = from ? normalizeTime(from) : null;
const endTime = to ? normalizeTime(to) : null;
const keywords = grep ? String(grep).split(/[,，]/).map((item) => item.trim()).filter(Boolean) : [];
const users = userFilter ? String(userFilter).split(/[,，]/).map((item) => item.trim()).filter(Boolean) : [];

let filtered = messages.filter((message) => {
  if (startTime && message.time && message.time < startTime) return false;
  if (endTime && message.time && message.time > endTime) return false;
  if (users.length && !users.some((name) => message.sender.includes(name))) return false;
  return true;
});

if (keywords.length) {
  const hitIndexes = new Set();
  filtered.forEach((message, index) => {
    if (keywords.some((word) => message.content.includes(word))) {
      for (let offset = -contextSize; offset <= contextSize; offset += 1) {
        const target = index + offset;
        if (target >= 0 && target < filtered.length) hitIndexes.add(target);
      }
    }
  });
  filtered = filtered.filter((_, index) => hitIndexes.has(index));
}

const total = filtered.length;
filtered = filtered.slice(0, limit);

console.log(`# 命中 ${total} 条，输出 ${filtered.length} 条（时间 ${from || '不限'} ~ ${to || '不限'}）\n`);

let lastDay = '';
for (const message of filtered) {
  const stamp = message.time
    ? `${message.time.getFullYear()}-${String(message.time.getMonth() + 1).padStart(2, '0')}-${String(message.time.getDate()).padStart(2, '0')} ${String(message.time.getHours()).padStart(2, '0')}:${String(message.time.getMinutes()).padStart(2, '0')}`
    : '时间未知';
  const day = stamp.slice(0, 10);
  if (day !== lastDay) {
    console.log(`\n===== ${day} =====`);
    lastDay = day;
  }
  const text = full ? message.content : message.content.slice(0, 200).replace(/\n/g, ' ⏎ ');
  console.log(`${stamp.slice(11)}  ${message.sender}：${text}`);
}
