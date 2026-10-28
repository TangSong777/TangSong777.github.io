#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cloudflare 边缘静态资源暖机：抓四站首页 HTML，提取静态资源，逐个 curl 触发边缘缓存。

用法：python3 tools/warmup-cf.py
说明：发布/部署后跑一次，让 CF 边缘尽快缓存新资源。静态资源命中后为 max-age=31536000 immutable。
"""
import re
import subprocess
import sys

SITES = [
    "https://manager.yanghanlin.cn/",
    "https://manager.yanghanlin.cn/studio.html",
    "https://server.yanghanlin.cn/",
    "https://history.yanghanlin.cn/",
    "https://blogs.yanghanlin.cn/",
]

ASSET_EXT = (".css", ".js", ".png", ".svg", ".jpg", ".jpeg", ".webp", ".ico", ".woff2")


def fetch(url: str) -> str:
    return subprocess.run(["curl", "-s", "--max-time", "15", url], capture_output=True, text=True).stdout


def warm(url: str) -> str:
    return subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "15", url],
        capture_output=True,
        text=True,
    ).stdout.strip()


def assets_from(html: str, site: str) -> set:
    host = site.split("/")[2]
    urls = set()
    for m in re.finditer(r'(?:href|src)="([^"]+)"', html):
        u = m.group(1)
        if "api/" in u or u.startswith("data:") or u.startswith("http"):
            continue
        if u.lower().endswith(ASSET_EXT) or any(f"{ext}?" in u.lower() for ext in ASSET_EXT):
            urls.add(f"https://{host}{u}")
    return urls


def main() -> int:
    total = 0
    fail = 0
    for site in SITES:
        html = fetch(site)
        if not html:
            print(f"[FAIL] {site}（无响应）")
            fail += 1
            continue
        urls = assets_from(html, site)
        for url in sorted(urls):
            code = warm(url)
            total += 1
            if code != "200":
                fail += 1
                print(f"[WARN] {code} {url}")
        print(f"[OK] {site}（{len(urls)} 个静态资源）")
    print(f"\n完成：{total} 个静态资源，失败 {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
