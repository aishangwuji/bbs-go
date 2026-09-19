import 'user_model.dart';
import 'category_model.dart';

/// 话题/帖子实体模型
///
/// 映射 Go 后端 resp.TopicResponse
class TopicModel {
  final String id;
  final String title;
  final String? summary;
  final String? content;
  final int viewCount;
  final int commentCount;
  int likeCount;
  bool liked;
  bool favorited;
  final bool sticky;
  final bool recommend;
  final int createTime;
  final String? ipLocation;
  final UserModel? user;
  final CategoryModel? category;
  final List<String> imageList;

  TopicModel({
    required this.id,
    required this.title,
    this.summary,
    this.content,
    this.viewCount = 0,
    this.commentCount = 0,
    this.likeCount = 0,
    this.liked = false,
    this.favorited = false,
    this.sticky = false,
    this.recommend = false,
    this.createTime = 0,
    this.ipLocation,
    this.user,
    this.category,
    this.imageList = const [],
  });

  factory TopicModel.fromJson(Map<String, dynamic> json) {
    // 提取图片列表
    List<String> images = [];
    if (json['imageList'] is List) {
      for (final item in json['imageList']) {
        if (item is Map && item['url'] != null) {
          images.add(item['url'].toString());
        } else if (item is String) {
          images.add(item);
        }
      }
    }

    return TopicModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      summary: json['summary']?.toString(),
      content: json['content']?.toString(),
      viewCount: json['viewCount'] is int
          ? json['viewCount'] as int
          : int.tryParse(json['viewCount']?.toString() ?? '0') ?? 0,
      commentCount: json['commentCount'] is int
          ? json['commentCount'] as int
          : int.tryParse(json['commentCount']?.toString() ?? '0') ?? 0,
      likeCount: json['likeCount'] is int
          ? json['likeCount'] as int
          : int.tryParse(json['likeCount']?.toString() ?? '0') ?? 0,
      liked: json['liked'] as bool? ?? false,
      favorited: json['favorited'] as bool? ?? false,
      sticky: json['sticky'] as bool? ?? false,
      recommend: json['recommend'] as bool? ?? false,
      createTime: json['createTime'] is int
          ? json['createTime'] as int
          : int.tryParse(json['createTime']?.toString() ?? '0') ?? 0,
      ipLocation: json['ipLocation']?.toString(),
      user: json['user'] is Map<String, dynamic>
          ? UserModel.fromJson(json['user'] as Map<String, dynamic>)
          : null,
      category: json['category'] is Map<String, dynamic>
          ? CategoryModel.fromJson(json['category'] as Map<String, dynamic>)
          : null,
      imageList: images,
    );
  }
}
