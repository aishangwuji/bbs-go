/// 论坛服务端 API 端点常量配置
///
/// 遵循 RESTful 规范，与 Go 后端 internal/server/router.go 路由表严格对应
class ApiConstants {
  // 默认服务器地址
  // 在 Android 模拟器环境下，10.0.2.2 映射宿主机 localhost:8082
  // 在真机环境下，可通过应用内的设置修改为电脑局域网 IP (如 http://192.168.1.100:8082) 或线上生产域名
  static const String defaultBaseUrl = 'http://10.0.2.2:8082';

  // 认证与用户
  static const String loginSignin = '/api/login/signin';
  static const String loginSignup = '/api/login/signup';
  static const String loginSignout = '/api/login/signout';
  static const String userCurrent = '/api/user/current';
  static const String userDetail = '/api/user'; // /api/user/:id

  // 话题相关
  static const String topicCategories = '/api/topic/categories';
  static const String topicCategoryNavs = '/api/topic/category_navs';
  static const String topicTopics = '/api/topic/topics';
  static const String topicRecent = '/api/topic/recent';
  static const String topicDetail = '/api/topic'; // /api/topic/:id
  static const String topicCreate = '/api/topic/create';
  static const String topicLike = '/api/like/like';
  static const String topicUnlike = '/api/like/unlike';
  static const String favoriteAdd = '/api/favorite/add';
  static const String favoriteDelete = '/api/favorite/delete';

  // 评论相关
  static const String commentList = '/api/comment/comments';
  static const String commentCreate = '/api/comment/create';

  // 签到相关
  static const String checkinStatus = '/api/checkin/checkin';
  static const String checkinSubmit = '/api/checkin/checkin';
}
