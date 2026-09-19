/// 用户基础与展示模型
///
/// 严格映射 Go 后端 resp.UserInfo 与 resp.UserProfile 字段
class UserModel {
  final String id;
  final String nickname;
  final String? username;
  final String? avatar;
  final String? smallAvatar;
  final String? description;
  final String? signature;
  final int score;
  final int level;
  final String? levelTitle;
  final int topicCount;
  final int commentCount;
  final int fansCount;
  final int followCount;
  final int createTime;

  UserModel({
    required this.id,
    required this.nickname,
    this.username,
    this.avatar,
    this.smallAvatar,
    this.description,
    this.signature,
    this.score = 0,
    this.level = 0,
    this.levelTitle,
    this.topicCount = 0,
    this.commentCount = 0,
    this.fansCount = 0,
    this.followCount = 0,
    this.createTime = 0,
  });

  /// 获取用于头像展示的完整 URL（若头像为相对路径则补齐）
  String getAvatarUrl(String baseUrl) {
    if (avatar == null || avatar!.isEmpty) {
      return '';
    }
    if (avatar!.startsWith('http://') || avatar!.startsWith('https://')) {
      return avatar!;
    }
    return '$baseUrl$avatar';
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      nickname: json['nickname']?.toString() ?? '匿名用户',
      username: json['username']?.toString(),
      avatar: json['avatar']?.toString(),
      smallAvatar: json['smallAvatar']?.toString(),
      description: json['description']?.toString(),
      signature: json['signature']?.toString(),
      score: json['score'] as int? ?? 0,
      level: json['level'] as int? ?? 0,
      levelTitle: json['levelTitle']?.toString(),
      topicCount: json['topicCount'] as int? ?? 0,
      commentCount: json['commentCount'] as int? ?? 0,
      fansCount: json['fansCount'] as int? ?? 0,
      followCount: json['followCount'] as int? ?? 0,
      createTime: json['createTime'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nickname': nickname,
      'username': username,
      'avatar': avatar,
      'smallAvatar': smallAvatar,
      'description': description,
      'signature': signature,
      'score': score,
      'level': level,
      'levelTitle': levelTitle,
      'topicCount': topicCount,
      'commentCount': commentCount,
      'fansCount': fansCount,
      'followCount': followCount,
      'createTime': createTime,
    };
  }
}
