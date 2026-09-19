import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:provider/provider.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/date_util.dart';
import '../../models/comment_model.dart';
import '../../models/topic_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/topic_provider.dart';
import '../auth/login_screen.dart';
import '../widgets/avatar_widget.dart';

/// 话题详情与评论页面
class TopicDetailScreen extends StatefulWidget {
  final String topicId;
  final TopicModel? initialTopic;

  const TopicDetailScreen({
    super.key,
    required this.topicId,
    this.initialTopic,
  });

  @override
  State<TopicDetailScreen> createState() => _TopicDetailScreenState();
}

class _TopicDetailScreenState extends State<TopicDetailScreen> {
  TopicModel? _topic;
  List<CommentModel> _comments = [];
  bool _isLoading = true;
  bool _isSendingComment = false;
  final TextEditingController _commentController = TextEditingController();
  final FocusNode _commentFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _topic = widget.initialTopic;
    _loadDetail();
    _loadComments();
  }

  @override
  void dispose() {
    _commentController.dispose();
    _commentFocusNode.dispose();
    super.dispose();
  }

  /// 加载帖子详情
  Future<void> _loadDetail() async {
    try {
      final response = await ApiClient.instance.get(
        '${ApiConstants.topicDetail}/${widget.topicId}',
      );
      if (response.isSuccess && response.data is Map<String, dynamic>) {
        setState(() {
          _topic = TopicModel.fromJson(response.data as Map<String, dynamic>);
          _isLoading = false;
        });
      }
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  /// 加载评论列表
  Future<void> _loadComments() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConstants.commentList,
        queryParameters: {
          'entityType': 'topic',
          'entityId': widget.topicId,
          'page': 1,
          'pageSize': 50,
        },
      );
      if (response.isSuccess && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final rawList = data['results'] as List<dynamic>? ?? [];
        setState(() {
          _comments = rawList
              .whereType<Map<String, dynamic>>()
              .map((e) => CommentModel.fromJson(e))
              .toList();
        });
      }
    } catch (_) {}
  }

  /// 提交评论
  Future<void> _submitComment() async {
    final authProvider = context.read<AuthProvider>();
    if (!authProvider.isLoggedIn) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
      return;
    }

    final content = _commentController.text.trim();
    if (content.isEmpty) {
      Fluttertoast.showToast(msg: '请输入评论内容');
      return;
    }

    setState(() => _isSendingComment = true);

    try {
      final response = await ApiClient.instance.post(
        ApiConstants.commentCreate,
        data: {
          'entityType': 'topic',
          'entityId': widget.topicId,
          'content': content,
        },
      );

      setState(() => _isSendingComment = false);

      if (response.isSuccess) {
        _commentController.clear();
        _commentFocusNode.unfocus();
        Fluttertoast.showToast(msg: '回复成功');
        await _loadComments();
        await _loadDetail(); // 刷新评论总数
      }
    } catch (e) {
      setState(() => _isSendingComment = false);
      Fluttertoast.showToast(msg: '发布评论失败: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('话题详情'),
        actions: [
          if (_topic != null)
            IconButton(
              icon: Icon(
                _topic!.favorited ? Icons.star : Icons.star_border,
                color: _topic!.favorited ? Colors.amber : null,
              ),
              onPressed: () {
                context.read<TopicProvider>().toggleFavorite(_topic!);
                setState(() {});
              },
            ),
        ],
      ),
      body: _isLoading && _topic == null
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () async {
                      await Future.wait([_loadDetail(), _loadComments()]);
                    },
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      children: [
                        // 1. 标题
                        Text(
                          _topic?.title ?? '',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            height: 1.35,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 12),

                        // 2. 作者栏
                        Row(
                          children: [
                            AvatarWidget(
                              avatarUrl: _topic?.user?.avatar,
                              nickname: _topic?.user?.nickname ?? '匿名',
                              size: 42,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        _topic?.user?.nickname ?? '匿名',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 14,
                                        ),
                                      ),
                                      if (_topic?.user?.levelTitle != null &&
                                          _topic!.user!.levelTitle!.isNotEmpty) ...[
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 6, vertical: 1),
                                          decoration: BoxDecoration(
                                            color: AppTheme.primaryColor.withOpacity(0.1),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            _topic!.user!.levelTitle!,
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: AppTheme.primaryColor,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${DateUtil.formatFullDate(_topic?.createTime)} · 浏览 ${_topic?.viewCount ?? 0}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppTheme.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 16),
                        const Divider(),
                        const SizedBox(height: 16),

                        // 3. 正文 (Markdown 渲染)
                        MarkdownBody(
                          data: _topic?.content ?? _topic?.summary ?? '暂无内容',
                          selectable: true,
                          styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                            p: const TextStyle(
                              fontSize: 15,
                              height: 1.6,
                              color: Color(0xFF1E293B),
                            ),
                            code: TextStyle(
                              backgroundColor: Colors.grey.shade100,
                              fontFamily: 'monospace',
                              fontSize: 13,
                            ),
                          ),
                        ),

                        const SizedBox(height: 28),

                        // 4. 点赞交互胶囊
                        Center(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _topic?.liked == true
                                  ? AppTheme.primaryColor
                                  : Colors.grey.shade100,
                              foregroundColor: _topic?.liked == true
                                  ? Colors.white
                                  : Colors.black87,
                              shape: const StadiumBorder(),
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                            ),
                            icon: Icon(
                              _topic?.liked == true ? Icons.thumb_up : Icons.thumb_up_outlined,
                              size: 18,
                            ),
                            label: Text(
                              '点赞 ${_topic?.likeCount ?? 0}',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            onPressed: () {
                              if (_topic != null) {
                                context.read<TopicProvider>().toggleLike(_topic!);
                                setState(() {});
                              }
                            },
                          ),
                        ),

                        const SizedBox(height: 24),
                        const Divider(thickness: 4, color: Color(0xFFF1F5F9)),
                        const SizedBox(height: 16),

                        // 5. 评论区标题
                        Row(
                          children: [
                            const Text(
                              '全部回复',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '(${_comments.length})',
                              style: const TextStyle(
                                fontSize: 14,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 12),

                        // 6. 评论列表
                        if (_comments.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 36),
                            child: Center(
                              child: Text(
                                '暂无回复，快来抢沙发吧~',
                                style: TextStyle(color: Colors.grey, fontSize: 13),
                              ),
                            ),
                          )
                        else
                          ..._comments.map((comment) => _buildCommentItem(comment)),

                        const SizedBox(height: 40),
                      ],
                    ),
                  ),
                ),

                // 7. 底部固定评论输入条
                _buildBottomInputBar(),
              ],
            ),
    );
  }

  Widget _buildCommentItem(CommentModel comment) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              AvatarWidget(
                avatarUrl: comment.user?.avatar,
                nickname: comment.user?.nickname ?? '用户',
                size: 32,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      comment.user?.nickname ?? '匿名',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    Text(
                      DateUtil.formatRelativeTime(comment.createTime),
                      style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ),
              if (comment.floor != null)
                Text(
                  '#${comment.floor}',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade400),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.only(left: 40),
            child: Text(
              comment.content,
              style: const TextStyle(fontSize: 14, height: 1.4, color: AppTheme.textPrimary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomInputBar() {
    return Container(
      padding: EdgeInsets.only(
        left: 14,
        right: 14,
        top: 8,
        bottom: 8 + MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _commentController,
              focusNode: _commentFocusNode,
              maxLines: null,
              decoration: InputDecoration(
                hintText: '写下你的友善评论...',
                hintStyle: const TextStyle(fontSize: 13, color: Colors.grey),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                fillColor: Colors.grey.shade100,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: const BorderSide(color: AppTheme.primaryColor),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          _isSendingComment
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : IconButton(
                  icon: const Icon(Icons.send, color: AppTheme.primaryColor),
                  onPressed: _submitComment,
                ),
        ],
      ),
    );
  }
}
