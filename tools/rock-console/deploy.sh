#!/usr/bin/env bash
#
# 部署 rock-console 前端。
#
# 背景：Cloudflare 忽略 query string，且默认缓存 .js/.css 四小时，
# 所以改 `?v=` 无效。这里改为按文件内容生成带哈希的文件名，
# 只要内容变了文件名就变，天然绕开 CDN 与浏览器缓存。
#
# 用法：./deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")/public"

hash_of() {
  sha256sum "$1" | cut -c1-10
}

APP_HASH=$(hash_of app.js)
CSS_HASH=$(hash_of styles.css)

APP_FILE="app-${APP_HASH}.js"
CSS_FILE="styles-${CSS_HASH}.css"

cp -f app.js "$APP_FILE"
cp -f styles.css "$CSS_FILE"

# 把 HTML 里的引用替换成带哈希的文件名
python3 - "$APP_FILE" "$CSS_FILE" <<'PY'
import re
import sys

app_file, css_file = sys.argv[1], sys.argv[2]
path = 'index.html'
text = open(path, encoding='utf-8').read()

# 允许 app.js / app-v9.js / app-<hash>.js 以及可选的 ?v=
text = re.sub(r'"app[-a-zA-Z0-9_.]*\.js(\?v=\d+)?"', '"' + app_file + '"', text)
text = re.sub(r'"styles[-a-zA-Z0-9_.]*\.css(\?v=\d+)?"', '"' + css_file + '"', text)

open(path, 'w', encoding='utf-8').write(text)
print('HTML 引用已更新')
PY

# 清理不用的历史文件（保留当前两份）
for f in app-*.js; do
  [ "$f" = "$APP_FILE" ] || rm -f "$f"
done
for f in styles-*.css; do
  [ "$f" = "$CSS_FILE" ] || rm -f "$f"
done

echo "部署完成"
echo "  JS   $APP_FILE"
echo "  CSS  $CSS_FILE"
