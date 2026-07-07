# GNS3 Management Proxy — Firefox Extension

让浏览器通过 GNS3 server 的 **3090 SOCKS5 代理** 访问拓扑内设备的 Web 管理界面（CSR1000v、pfSense 等）。装一次扩展，浏览器自动对管理网段流量走代理，不配系统代理、不影响正常上网。

## 工作方式

```
Firefox
  │ browser.proxy.onRequest: 匹配管理网段 IP → SOCKS5 + auth
  │ 用户名密码在 SOCKS5 握手时注入
  ▼
gns3server:3090 (SOCKS5 + auth)
  → 校验用户名密码
  → 透传 TCP 到设备
```

纯扩展实现，无需 native host、无需系统代理配置。

## 安装

### 临时加载（开发）

1. Firefox 打开 `about:debugging#/runtime/this-firefox`
2. 点击「临时加载附加组件」
3. 选择本目录下的 `manifest.json`

### 打包发布

```bash
cd extension/
./build.sh
# → dist/gns3-proxy-firefox-<version>.zip
```

生成的 zip 上传 [AMO](https://addons.mozilla.org/)（addons.mozilla.org）。

## 配置

| 字段 | 默认值 | 说明 |
|---|---|---|
| GNS3 Server 地址 | `127.0.0.1` | gns3server 的主机名或 IP |
| 代理端口 | `3090` | SOCKS5 端口 |
| 管理网段 | `172.16.40.0/23` | 每行一个 CIDR，匹配的 IP 走代理 |
| 用户名 | `admin` | GNS3 login 用户名（SOCKS5 认证用） |
| 密码 | （空） | GNS3 login 密码 |
| 启用代理 | off | 一键开关 |

UI 语言跟随浏览器语言（`browser.i18n`，已内置 `en` / `zh_CN`）。

## 技术要点

- 使用 `browser.proxy.onRequest` 按请求粒度决策代理
- 匹配管理网段时返回 `{ type: "socks", host, port, username, password, proxyDNS: true }`
- 非管理网段流量直连，不干扰正常上网
- SOCKS5 认证在协议握手阶段完成，无需 `webRequest.onAuthRequired`

## 测试

1. 确认 gns3server 的 3090 SOCKS5 代理已启动
2. 在扩展配置页配好 Server 地址、管理网段、用户名密码
3. 开启代理
4. 访问设备页面（如 `https://172.16.40.2/`）→ 应正常加载
5. 访问外部地址（如 `example.com`）→ 应直连，不走代理

## 项目结构

```
extension/
├── manifest.json       # 扩展清单 (Firefox MV3)
├── build.sh            # 打包脚本
├── background.js       # 后台 — proxy.onRequest SOCKS5 + auth
├── i18n.js             # 多语言辅助 (data-i18n 属性)
├── popup.html / .js    # 工具栏弹出面板
├── options.html / .js  # 配置页
├── styles.css          # 主题 (跟随浏览器明暗)
├── icons/              # 扩展图标 (PNG)
└── _locales/           # 多语言 (en, zh_CN)
```
