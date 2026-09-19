import 'user_model.dart';

/// 评论数据实体模型
///
/// 映射 Go 后端 resp.CommentResponse
class CommentModel {
  final int id;
  final int? floor;
  final UserModel? user;
  final String content;
  int likeCount;
  bool liked;
  final CommentModel? quote;
  final int createTime;
  final String? ipLocation;

  CommentModel({
    required this.id,
    this.floor,
    this.user,
    required this.content,
    this.likeCount = 0,
    this.liked = false,
    this.quote,
    this.createTime = 0,
    this.ipLocation,
  });

  factory CommentModel.fromJson(Map<String, dynamic> json) {
    return CommentModel(
      id: json['id'] is int
          ? json['id'] as int
          : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      floor: json['floor'] as int?,
      user: json['user'] is Map<String, dynamic>
          ? UserModel.fromJson(json['user'] as Map<String, dynamic>)
          : null,
      content: json['content']?.toString() ?? '',
      likeCount: json['likeCount'] is int
          ? json['likeCount'] as int
          : int.tryParse(json['likeCount']?.toString() ?? '0') ?? 0,
      liked: json['liked'] as bool? ?? false,
      quote: json['quote'] is Map<String, dynamic>
          ? CommentModel.fromJson(json['quote'] as Map<String, dynamic>)
          : null,
      createTime: json['createTime'] is int
          ? json['createTime'] as int
          : int.tryParse(json['createTime']?.toString() ?? '0') ?? 0,
      ipLocation: json['ipLocation']?.toString(),
    );
  }
}
