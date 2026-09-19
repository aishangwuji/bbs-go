import 'package:flutter/foundation.dart';
import 'package:fluttertoast/fluttertoast.dart';
import '../core/constants/api_constants.dart';
import '../core/network/api_client.dart';
import '../models/category_model.dart';
import '../models/topic_model.dart';

/// 话题列表与分类状态管理
class TopicProvider extends ChangeNotifier {
  List<CategoryModel> _categories = [];
  int _selectedCategoryId = 0; // 0 表示全部分类

  List<TopicModel> _topics = [];
  String? _cursor;
  bool _hasMore = true;
  bool _isLoading = false;
  bool _isRefreshing = false;

  List<CategoryModel> get categories => _categories;
  int get selectedCategoryId => _selectedCategoryId;
  List<TopicModel> get topics => _topics;
  bool get hasMore => _hasMore;
  bool get isLoading => _isLoading;
  bool get isRefreshing => _isRefreshing;

  /// 加载版块分类列表
  Future<void> loadCategories() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConstants.topicCategories,
      );
      if (response.isSuccess && response.data is List) {
        final list = (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((item) => CategoryModel.fromJson(item))
            .toList();

        // 插入首项“全部”
        _categories = [
          CategoryModel(id: 0, name: '全部'),
          ...list,
        ];
        notifyListeners();
      }
    } catch (_) {}
  }

  /// 切换分类
  Future<void> selectCategory(int categoryId) async {
    if (_selectedCategoryId == categoryId) return;
    _selectedCategoryId = categoryId;
    notifyListeners();
    await refreshTopics();
  }

  /// 下拉刷新话题列表
  Future<void> refreshTopics() async {
    if (_isRefreshing) return;
    _isRefreshing = true;
    _cursor = null;
    notifyListeners();

    await _fetchTopics(isRefresh: true);

    _isRefreshing = false;
    notifyListeners();
  }

  /// 上拉加载更多
  Future<void> loadMoreTopics() async {
    if (_isLoading || !_hasMore) return;
    _isLoading = true;
    notifyListeners();

    await _fetchTopics(isRefresh: false);

    _isLoading = false;
    notifyListeners();
  }

  /// 核心数据拉取逻辑
  Future<void> _fetchTopics({required bool isRefresh}) async {
    try {
      final queryParams = <String, dynamic>{
        'cursor': isRefresh ? 0 : (_cursor ?? 0),
      };
      if (_selectedCategoryId > 0) {
        queryParams['categoryId'] = _selectedCategoryId;
      }

      final response = await ApiClient.instance.get(
        ApiConstants.topicTopics,
        queryParameters: queryParams,
      );

      if (response.isSuccess && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final rawResults = data['results'] as List<dynamic>? ?? [];
        final newTopics = rawResults
            .whereType<Map<String, dynamic>>()
            .map((e) => TopicModel.fromJson(e))
            .toList();

        _cursor = data['cursor']?.toString();
        _hasMore = data['hasMore'] as bool? ?? false;

        if (isRefresh) {
          _topics = newTopics;
        } else {
          _topics.addAll(newTopics);
        }
      }
    } catch (e) {
      Fluttertoast.showToast(msg: '加载帖子失败: $e');
    }
  }

  /// 点赞 / 取消点赞
  Future<bool> toggleLike(TopicModel topic) async {
    final originalLiked = topic.liked;
    final originalCount = topic.likeCount;

    // 乐观更新 UI
    topic.liked = !originalLiked;
    topic.likeCount += topic.liked ? 1 : -1;
    notifyListeners();

    final path = originalLiked ? ApiConstants.topicUnlike : ApiConstants.topicLike;
    final response = await ApiClient.instance.post(
      path,
      data: {
        'entityType': 'topic',
        'entityId': topic.id,
      },
    );

    if (!response.isSuccess) {
      // 失败回滚
      topic.liked = originalLiked;
      topic.likeCount = originalCount;
      notifyListeners();
      return false;
    }
    return true;
  }

  /// 收藏 / 取消收藏
  Future<bool> toggleFavorite(TopicModel topic) async {
    final originalFavorited = topic.favorited;

    topic.favorited = !originalFavorited;
    notifyListeners();

    final path = originalFavorited ? ApiConstants.favoriteDelete : ApiConstants.favoriteAdd;
    final response = await ApiClient.instance.post(
      path,
      data: {
        'entityType': 'topic',
        'entityId': topic.id,
      },
    );

    if (!response.isSuccess) {
      topic.favorited = originalFavorited;
      notifyListeners();
      return false;
    }
    Fluttertoast.showToast(msg: topic.favorited ? '已收藏' : '已取消收藏');
    return true;
  }
}
