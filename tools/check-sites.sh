#!/usr/bin/env bash
# 四站可用性巡检：状态码 + 响应时间（不依赖外部服务）
# 用法：bash tools/check-sites.sh
set -u
sites=(
  "https://manager.yanghanlin.cn/|管理中心"
  "https://manager.yanghanlin.cn/studio.html|文章工作台"
  "https://server.yanghanlin.cn/|控制台"
  "https://history.yanghanlin.cn/|岁月史书"
  "https://blogs.yanghanlin.cn/|博客"
)
fail=0
for item in "${sites[@]}"; do
  url="${item%%|*}"
  name="${item##*|}"
  info=$(curl -s -o /dev/null -w "%{http_code} %{time_total}s" --max-time 15 "$url")
  code="${info%% *}"
  if [ "$code" != "200" ]; then
    echo "[FAIL] $name   $code"
    fail=1
  else
    echo "[OK]   $name   $info"
  fi
done
exit $fail
