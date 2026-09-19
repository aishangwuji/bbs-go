# bbs-go 移动端配套应用 (Android)

本项目是基于 Flutter 框架构建的 `bbs-go` 官方配套移动端应用，为社区用户提供高帧率、原生质感、完整的论坛移动端浏览与互动体验。

---

## 一、核心特性与技术亮点

1. **Material 3 现代化设计**：
   - 清新沉稳的科技蓝主题，精致的卡片化排版；
   - 包含置顶/精选标识、等级称号勋章展示、绝对楼层定位。
2. **“做教一体”的鉴权通信架构**：
   - **Token 无状态流转**：通过 Dio 拦截器统一封装 `Authorization: Bearer <token>` 与 `X-User-Token: <token>`，无缝契合 Go 后端 `user_token_service.go` 的三级读取鉴权机制；
   - **动态服务端地址**：支持在 APP 界面内自由配置服务端接口基准地址（开发机局域网 IP、模拟器 `10.0.2.2:8082`、或生产线上域名）；
   - **游标与分页自适应**：支持基于 Cursor 和 Page 的平滑瀑布流无限滚动与下拉刷新。
3. **功能矩阵完整**：
   - **论坛大厅**：版块横向滚动标签、话题瀑布流卡片、一键点赞、浏览量统计；
   - **帖子详情**：原生 Markdown 高性能渲染与语法高亮、作者资料卡、实时点赞收藏、层级评论流；
   - **发帖中心**：版块下拉选择、标题与正文输入、集成常用的 Markdown 快捷编辑工具条；
   - **个人中心**：个人资料与社区成长数据展示（发帖数/跟帖数/积分）、每日一键签到打卡、服务器配置管理与退出登录。

---

## 二、工程目录结构

```text
app_mobile/
├── android/                  # Android 原生工程配置（Manifest 网络权限、Cleartext 支持）
├── lib/
│   ├── core/                 # 基础支撑层
│   │   ├── constants/        # API 路由端点常量 (api_constants.dart)
│   │   ├── network/          # Dio 客户端引擎与拦截器 (api_client.dart)
│   │   ├── storage/          # SharedPreferences 本地持久化 (sp_storage.dart)
│   │   ├── theme/            # Material 3 主题样式 (app_theme.dart)
│   │   └── utils/            # 时间与格式化工具 (date_util.dart)
│   ├── models/               # 数据实体映射层
│   │   ├── api_response.dart # 响应信封与游标模型
│   │   ├── user_model.dart   # 用户信息模型
│   │   ├── category_model.dart # 版块分类模型
│   │   ├── topic_model.dart  # 话题模型
│   │   └── comment_model.dart# 评论模型
│   ├── providers/            # 状态管理层
│   │   ├── auth_provider.dart# 用户登录/注册/签到/状态管理
│   │   └── topic_provider.dart # 话题列表/分类筛选/点赞/收藏状态
│   ├── views/                # UI 展现层
│   │   ├── auth/             # 登录/注册界面
│   │   ├── home/             # 论坛大厅主界面
│   │   ├── settings/         # 服务器地址配置弹窗
│   │   ├── topic/            # 话题详情与发帖界面
│   │   ├── user/             # 个人中心界面
│   │   └── widgets/          # 通用业务组件（头像、帖子卡片）
│   └── main.dart             # 应用主入口
├── test/                     # 单元测试集合
└── pubspec.yaml              # 依赖与资源配置
```

---

## 三、快速开始与调试运行

### 1. 启动 Go 后端服务
在仓库根目录下运行后端：
```bash
go run main.go
# 默认监听 8082 端口
```

### 2. 运行移动端（连接手机或模拟器）
确保已连接 Android 手机（开启 USB 调试）或已启动 Android 模拟器：

```bash
cd app_mobile

# 查看已识别的设备列表
flutter devices

# 启动并热重载调试
flutter run
```

### 3. 网络配置说明（关键）
- **若使用 Android 官方模拟器**：
  - Android 模拟器访问电脑宿主机使用 IP `http://10.0.2.2:8082`（APP 默认已设置为此地址）。
- **若使用真实 Android 手机真机调试**：
  - 手机需与电脑连接在**同一个局域网 Wi-Fi** 下；
  - 打开 APP 顶部 AppBar 右侧的“**服务器配置**”图标（或在“个人中心”进入“服务器地址设置”）；
  - 填入电脑的局域网 IP（例如 `http://192.168.1.100:8082`），点击保存即可立即连通！
- **若访问线上部署的域名**：
  - 直接填入线上域名（例如 `https://your-domain.com`）即可。

---

## 四、打包 Android APK 安装包

在 `app_mobile` 目录下运行：

```bash
# 1. 构建 Debug APK（快速安装体验）
flutter build apk --debug

# 产物路径：app_mobile/build/app/outputs/flutter-apk/app-debug.apk

# 2. 构建 Release APK（优化体积与运行效率）
flutter build apk --release

# 产物路径：app_mobile/build/app/outputs/flutter-apk/app-release.apk
```

直接将生成的 `.apk` 文件发送或传输到安卓手机上即可点击安装使用！
