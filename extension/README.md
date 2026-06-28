# GNS3 Management Proxy — Browser Extension

让用户浏览器通过 GNS3 server 的 **3090 CONNECT 代理** 访问拓扑内设备的 Web 管理界面（如 CSR1000v、pfSense 的 WebUI）。装一次扩展，浏览器自动对管理网段流量走代理，不配系统代理、不影响正常上网。

支持 **Chrome / Chromium** 和 **Firefox**，共用一套代码。

## 工作方式

```
用户浏览器
  │ proxy PAC: isInNet(管理网段) → PROXY gns3host:3090
  │ webRequest.onAuthRequired: 注入 admin 凭据
  ▼
gns3server 3090 CONNECT 代理
  → 校验用户名密码（复用 GNS3 login API）
  → 透传 TCP 到设备
```

## 技术选型

- **平台**: Chrome / Chromium + Firefox（Manifest V3，共用一套代码）
- **后端**: 无后端，纯前端扩展

## 安装

### Chrome 开发者模式加载

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展」
4. 选择本 `extension/` 目录

### Firefox 临时加载

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「临时加载附加组件」
3. 选择本目录下的 `manifest.firefox.json`

### 打包发布

```bash
cd extension/
./build.sh chrome      # → dist/gns3-proxy-chrome-<version>.zip
./build.sh firefox     # → dist/gns3-proxy-firefox-<version>.zip
```

`build.sh` 会自动选择正确的 manifest（Firefox 版替换为 `manifest.firefox.json`）。生成的 zip 上传 Chrome Web Store 或 AMO（addons.mozilla.org）。

## Chrome / Firefox 差异

同一份代码通过运行时兼容层处理两浏览器的 API 差异：

| 部分 | Chrome | Firefox |
|---|---|---|
| API 命名空间 | `chrome.*` | `browser.*`（代码用 `api` 变量自动选择） |
| 后台脚本 | `service_worker` | 事件页 `scripts` |
| 代理设置 | `mode:"pac_script"` + 内联 PAC | `proxyType:"autoConfig"` + data URL |
| 代理认证 | `asyncBlocking` 回调 | `blocking` 同步返回 |
| 额外权限 | `webRequestAuthProvider` | `webRequestBlocking` |

两份 manifest 文件：
- `manifest.json` — Chrome（也可直接加载未打包）
- `manifest.firefox.json` — Firefox

## 配置

| 字段 | 默认值 | 说明 |
|---|---|---|
| GNS3 Server 地址 | `127.0.0.1` | gns3server 的主机名或 IP |
| 代理端口 | `3090` | CONNECT 代理端口 |
| 管理网段 | `172.16.40.0/23` | 触发代理的 IP 段，只这个段走代理 |
| 用户名 | `admin` | GNS3 login 用户名 |
| 密码 | （空） | GNS3 login 密码 |
| 启用代理 | off | 一键开关 |

UI 语言跟随浏览器语言（`chrome.i18n`，已内置 `en` / `zh_CN`）。

## 测试

1. 确认 gns3server 的 3090 代理已启动
2. 在扩展配置页配好 Server 地址、管理网段、用户名密码
3. 开启代理
4. 在浏览器中打开设备页面（如 `https://172.16.40.2/`）
5. 页面正常加载即为成功
6. 访问管理网段外的地址（如 `example.com`）应直连，不走代理

排查代理是否生效可用 `chrome://net-export/` 录日志，搜索 `proxy_chain`。

## 项目结构

```
extension/
├── manifest.json              # Chrome 扩展清单 (MV3)
├── manifest.firefox.json      # Firefox 扩展清单
├── build.sh                   # 打包脚本 (chrome / firefox)
├── background.js              # 后台脚本 — PAC 代理 + 认证 (跨浏览器)
├── i18n.js                    # 多语言辅助 (data-i18n 属性)
├── popup.html / popup.js      # 工具栏弹出面板
├── options.html / options.js  # 配置页
├── styles.css                 # 主题 (跟随浏览器明暗)
├── icons/                     # 扩展图标 (PNG)
└── _locales/                  # 多语言 (en, zh_CN)
```
